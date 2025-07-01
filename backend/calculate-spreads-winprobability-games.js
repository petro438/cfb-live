const { Pool } = require('pg');
require('dotenv').config({ path: './dataconfig.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to PostgreSQL:', err);
  } else {
    const dbName = process.env.DATABASE_URL ? 
      process.env.DATABASE_URL.split('/').pop().split('?')[0] : 'Unknown';
    console.log(`Connected to PostgreSQL database: ${dbName}`);
    release();
  }
});

class GameSpreadsCalculator {
  
  // Helper function for normal distribution CDF
  normalCDF(x, mean = 0, stdDev = 1) {
    const z = (x - mean) / stdDev;
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp(-z * z / 2);
    let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    if (z > 0) prob = 1 - prob;
    return prob;
  }

  async addGameSpreadColumns() {
    console.log('📊 Adding spread and win probability columns to games table...');
    
    try {
      // Check if columns already exist
      const columnCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'games' 
        AND column_name IN ('home_spread', 'away_spread', 'home_pregame_win_probability', 'away_pregame_win_probability')
      `);
      
      const existingColumns = columnCheck.rows.map(row => row.column_name);
      console.log('🔍 Existing columns:', existingColumns);
      
      // Add missing columns
      const columnsToAdd = [
        { name: 'home_spread', type: 'DECIMAL(5,2)' },
        { name: 'away_spread', type: 'DECIMAL(5,2)' },
        { name: 'home_pregame_win_probability', type: 'DECIMAL(5,4)' },
        { name: 'away_pregame_win_probability', type: 'DECIMAL(5,4)' }
      ];
      
      for (const column of columnsToAdd) {
        if (!existingColumns.includes(column.name)) {
          console.log(`➕ Adding column: ${column.name}`);
          await pool.query(`ALTER TABLE games ADD COLUMN ${column.name} ${column.type}`);
        } else {
          console.log(`✅ Column ${column.name} already exists`);
        }
      }
      
      console.log('✅ All spread columns added successfully');
      
    } catch (error) {
      console.error('❌ Error adding columns:', error);
      throw error;
    }
  }

  async calculateGameSpreads(season = 2024) {
    console.log(`🎯 Calculating game spreads and win probabilities for ${season}...`);
    
    try {
      // Get all games for the season
      const gamesResult = await pool.query(`
        SELECT id, season, home_team, away_team, neutral_site, start_date, completed
        FROM games 
        WHERE season = $1
        ORDER BY start_date, id
      `, [season]);
      
      const games = gamesResult.rows;
      console.log(`🎮 Found ${games.length} games for ${season} season`);
      
      if (games.length === 0) {
        console.log('⚠️ No games found for this season');
        return;
      }
      
      // Get all team power ratings for this season
      const ratingsResult = await pool.query(`
        SELECT team_name, power_rating
        FROM team_power_ratings 
        WHERE season = $1
      `, [season]);
      
      const ratings = new Map();
      ratingsResult.rows.forEach(row => {
        ratings.set(row.team_name.trim().toLowerCase(), parseFloat(row.power_rating));
      });
      
      console.log(`📈 Loaded ${ratings.size} team power ratings for ${season}`);
      
      let processedCount = 0;
      let skippedCount = 0;
      
      // Process games in batches for better performance
      const batchSize = 100;
      for (let i = 0; i < games.length; i += batchSize) {
        const batch = games.slice(i, i + batchSize);
        
        console.log(`⚙️ Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(games.length/batchSize)} (${batch.length} games)...`);
        
        for (const game of batch) {
          const homeTeam = game.home_team.trim().toLowerCase();
          const awayTeam = game.away_team.trim().toLowerCase();
          
          const homeRating = ratings.get(homeTeam);
          const awayRating = ratings.get(awayTeam);
          
          if (homeRating === undefined || awayRating === undefined) {
            skippedCount++;
            console.log(`⚠️ Missing rating for game ${game.id}: ${game.home_team} vs ${game.away_team} (Home: ${homeRating}, Away: ${awayRating})`);
            continue;
          }
          
          // Calculate spreads
          // Home field advantage: +2.15 points if not neutral site
          const homeAdvantage = game.neutral_site ? 0 : 2.15;
          const ratingDifference = homeRating - awayRating + homeAdvantage;
          
          // Home spread is negative when home team is favored (standard betting format)
          const homeSpread = -ratingDifference;
          const awaySpread = ratingDifference;
          
          // Calculate win probabilities using NORM.DIST with 13.5 standard deviation
          // Higher rating difference = higher probability for home team
          const homeWinProb = this.normalCDF(ratingDifference, 0, 13.5);
          const awayWinProb = 1 - homeWinProb;
          
          // Update the game with calculated values
          await pool.query(`
            UPDATE games 
            SET 
              home_spread = $1,
              away_spread = $2,
              home_pregame_win_probability = $3,
              away_pregame_win_probability = $4
            WHERE id = $5
          `, [
            parseFloat(homeSpread.toFixed(2)),
            parseFloat(awaySpread.toFixed(2)),
            parseFloat(homeWinProb.toFixed(4)),
            parseFloat(awayWinProb.toFixed(4)),
            game.id
          ]);
          
          processedCount++;
          
          // Log some examples
          if (processedCount <= 5) {
            console.log(`   📋 Example: ${game.home_team} vs ${game.away_team}`);
            console.log(`       Ratings: ${homeRating.toFixed(1)} vs ${awayRating.toFixed(1)} | Neutral: ${game.neutral_site}`);
            console.log(`       Spread: ${homeSpread.toFixed(1)} | Win Prob: ${(homeWinProb * 100).toFixed(1)}%`);
          }
        }
      }
      
      console.log(`✅ Game spreads calculation completed!`);
      console.log(`   📊 Processed: ${processedCount} games`);
      console.log(`   ⚠️ Skipped: ${skippedCount} games (missing ratings)`);
      
      // Show some sample results
      const sampleResults = await pool.query(`
        SELECT 
          home_team, 
          away_team, 
          neutral_site,
          home_spread, 
          away_spread,
          home_pregame_win_probability,
          away_pregame_win_probability,
          start_date
        FROM games 
        WHERE season = $1 
          AND home_spread IS NOT NULL 
        ORDER BY ABS(home_spread) DESC
        LIMIT 5
      `, [season]);
      
      console.log('\n🎯 Sample results (biggest spreads):');
      sampleResults.rows.forEach(game => {
        console.log(`   ${game.home_team} vs ${game.away_team} (${game.neutral_site ? 'Neutral' : 'Home'})`);
        console.log(`   Spread: ${game.home_spread} | Win Prob: ${(parseFloat(game.home_pregame_win_probability) * 100).toFixed(1)}%`);
      });
      
    } catch (error) {
      console.error('❌ Error calculating game spreads:', error);
      throw error;
    }
  }

  async validateResults(season = 2024) {
    console.log(`🔍 Validating results for ${season}...`);
    
    try {
      // Check coverage
      const coverageResult = await pool.query(`
        SELECT 
          COUNT(*) as total_games,
          COUNT(home_spread) as games_with_spreads,
          COUNT(home_pregame_win_probability) as games_with_probabilities,
          ROUND(AVG(ABS(home_spread)), 2) as avg_spread,
          ROUND(AVG(home_pregame_win_probability), 4) as avg_home_win_prob
        FROM games 
        WHERE season = $1
      `, [season]);
      
      const stats = coverageResult.rows[0];
      
      console.log('📈 Validation Results:');
      console.log(`   Total Games: ${stats.total_games}`);
      console.log(`   Games with Spreads: ${stats.games_with_spreads}`);
      console.log(`   Games with Win Probabilities: ${stats.games_with_probabilities}`);
      console.log(`   Average Spread: ${stats.avg_spread} points`);
      console.log(`   Average Home Win Probability: ${(stats.avg_home_win_prob * 100).toFixed(1)}%`);
      
      // Check for any anomalies
      const anomaliesResult = await pool.query(`
        SELECT 
          home_team, 
          away_team, 
          home_spread,
          home_pregame_win_probability
        FROM games 
        WHERE season = $1 
          AND (
            ABS(home_spread) > 50 
            OR home_pregame_win_probability < 0.01 
            OR home_pregame_win_probability > 0.99
          )
        LIMIT 10
      `, [season]);
      
      if (anomaliesResult.rows.length > 0) {
        console.log('\n⚠️ Potential anomalies found:');
        anomaliesResult.rows.forEach(game => {
          console.log(`   ${game.home_team} vs ${game.away_team}: Spread ${game.home_spread}, Win Prob ${(game.home_pregame_win_probability * 100).toFixed(1)}%`);
        });
      } else {
        console.log('✅ No anomalies detected');
      }
      
    } catch (error) {
      console.error('❌ Error validating results:', error);
    }
  }

  async clearExistingData(season = 2024) {
    console.log(`🧹 Clearing existing spread data for ${season}...`);
    
    try {
      const result = await pool.query(`
        UPDATE games 
        SET 
          home_spread = NULL,
          away_spread = NULL,
          home_pregame_win_probability = NULL,
          away_pregame_win_probability = NULL
        WHERE season = $1
      `, [season]);
      
      console.log(`✅ Cleared spread data for ${result.rowCount} games`);
      
    } catch (error) {
      console.error('❌ Error clearing data:', error);
      throw error;
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const calculator = new GameSpreadsCalculator();
  
  try {
    const season = parseInt(args.find(arg => arg.startsWith('--season='))?.split('=')[1]) || 2024;
    
    if (args.includes('--setup')) {
      console.log('🚀 Setting up game spreads calculation...');
      await calculator.addGameSpreadColumns();
      console.log('✅ Setup completed!');
      return;
    }
    
    if (args.includes('--clear')) {
      await calculator.clearExistingData(season);
      return;
    }
    
    if (args.includes('--validate')) {
      await calculator.validateResults(season);
      return;
    }
    
    if (args.includes('--calculate') || args.includes('--all')) {
      console.log(`🎯 Starting game spreads calculation for ${season}...`);
      
      // First ensure columns exist
      await calculator.addGameSpreadColumns();
      
      // Calculate spreads and probabilities
      await calculator.calculateGameSpreads(season);
      
      // Validate results
      await calculator.validateResults(season);
      
      console.log('🎉 Game spreads calculation completed successfully!');
    } else {
      console.log('📋 Usage:');
      console.log('  node game-spreads-calculator.js --setup                    # Add columns only');
      console.log('  node game-spreads-calculator.js --calculate --season=2024  # Calculate spreads');
      console.log('  node game-spreads-calculator.js --validate --season=2024   # Validate results');
      console.log('  node game-spreads-calculator.js --clear --season=2024      # Clear existing data');
      console.log('  node game-spreads-calculator.js --all --season=2024        # Setup + Calculate + Validate');
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = GameSpreadsCalculator;