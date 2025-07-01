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

class StatsCalculator {
  
  // Helper function for normal distribution CDF
  normalCDF(x, mean = 0, stdDev = 1) {
    const z = (x - mean) / stdDev;
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp(-z * z / 2);
    let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    if (z > 0) prob = 1 - prob;
    return prob;
  }

  // Convert moneyline to probability
  moneylineToProbability(moneyline) {
    if (!moneyline || moneyline === null) return null;
    
    if (moneyline > 0) {
      return 1 / (moneyline / 100 + 1);
    } else {
      return 1 / (1 + 100 / Math.abs(moneyline));
    }
  }

  // Convert spread to probability using normal distribution
  spreadToProbability(spread) {
    // Use NORM.DIST with 13.5 standard deviation
    return this.normalCDF(-spread, 0, 13.5);
  }

  async calculateAllSOS(season = 2024) {
    console.log(`🔍 Starting SOS calculation for ${season}...`);
    
    // Mark calculation as started
    await pool.query(`
      INSERT INTO calculation_status (calculation_type, season, status, started_at, team_count)
      VALUES ('sos', $1, 'running', NOW(), 0)
      ON CONFLICT (calculation_type, season) 
      DO UPDATE SET status = 'running', started_at = NOW()
    `, [season]);
    
    try {
      // First, clear any existing data for this season to prevent duplicates
      await pool.query(`
        DELETE FROM strength_of_schedule 
        WHERE season = $1
      `, [season]);
      
      // Get all FBS teams
      const teamsResult = await pool.query(`
        SELECT DISTINCT t.school as team_name, t.conference, t.classification
        FROM teams t
        WHERE t.classification = 'fbs'
        ORDER BY t.school
      `);
      
      const teams = teamsResult.rows;
      console.log(`📊 Processing ${teams.length} teams...`);
      
      // Calculate SOS for each team with different filter combinations
      for (let i = 0; i < teams.length; i++) {
        const team = teams[i];
        console.log(`⚙️ [${i+1}/${teams.length}] Calculating SOS for ${team.team_name}`);
        
        // Calculate for all possible filter combinations
        const allGames = await this.calculateTeamSOS(team.team_name, season, false, false); // All games
        const regularSeason = await this.calculateTeamSOS(team.team_name, season, true, false); // Regular season only
        const conferenceOnly = await this.calculateTeamSOS(team.team_name, season, false, true); // Conference games only
        const confRegular = await this.calculateTeamSOS(team.team_name, season, true, true); // Conference + Regular season
        
        // Insert into database with all filter combinations
        await pool.query(`
          INSERT INTO strength_of_schedule (
            team_name, season, classification, 
            
            -- All games
            sos_overall, sos_played, sos_remaining,
            actual_wins, actual_losses, projected_wins, win_difference,
            top40_wins, top40_games, coinflip_games, sure_thing_games, longshot_games,
            games_played, games_remaining,
            
            -- Regular season only
            sos_overall_regular, sos_played_regular, sos_remaining_regular,
            actual_wins_regular, actual_losses_regular, projected_wins_regular, win_difference_regular,
            top40_wins_regular, top40_games_regular, coinflip_games_regular, sure_thing_games_regular, longshot_games_regular,
            games_played_regular, games_remaining_regular,
            
            -- Conference games only
            sos_overall_conference, sos_played_conference, sos_remaining_conference,
            actual_wins_conference, actual_losses_conference, projected_wins_conference, win_difference_conference,
            top40_wins_conference, top40_games_conference, coinflip_games_conference, sure_thing_games_conference, longshot_games_conference,
            games_played_conference, games_remaining_conference,
            
            -- Conference + Regular season
            sos_overall_conf_reg, sos_played_conf_reg, sos_remaining_conf_reg,
            actual_wins_conf_reg, actual_losses_conf_reg, projected_wins_conf_reg, win_difference_conf_reg,
            top40_wins_conf_reg, top40_games_conf_reg, coinflip_games_conf_reg, sure_thing_games_conf_reg, longshot_games_conf_reg,
            games_played_conf_reg, games_remaining_conf_reg,
            
            last_updated
          ) VALUES (
            $1, $2, $3,
            $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
            $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31,
            $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45,
            $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56, $57, $58, $59,
            NOW()
          )
        `, [
          team.team_name, season, 'fbs',
          // All games
          allGames.sos_overall, allGames.sos_played, allGames.sos_remaining,
          allGames.actual_wins, allGames.actual_losses, allGames.projected_wins, allGames.win_difference,
          allGames.top40_wins, allGames.top40_games, allGames.coinflip_games, allGames.sure_thing_games, allGames.longshot_games,
          allGames.games_played, allGames.games_remaining,
          // Regular season only
          regularSeason.sos_overall, regularSeason.sos_played, regularSeason.sos_remaining,
          regularSeason.actual_wins, regularSeason.actual_losses, regularSeason.projected_wins, regularSeason.win_difference,
          regularSeason.top40_wins, regularSeason.top40_games, regularSeason.coinflip_games, regularSeason.sure_thing_games, regularSeason.longshot_games,
          regularSeason.games_played, regularSeason.games_remaining,
          // Conference games only
          conferenceOnly.sos_overall, conferenceOnly.sos_played, conferenceOnly.sos_remaining,
          conferenceOnly.actual_wins, conferenceOnly.actual_losses, conferenceOnly.projected_wins, conferenceOnly.win_difference,
          conferenceOnly.top40_wins, conferenceOnly.top40_games, conferenceOnly.coinflip_games, conferenceOnly.sure_thing_games, conferenceOnly.longshot_games,
          conferenceOnly.games_played, conferenceOnly.games_remaining,
          // Conference + Regular season
          confRegular.sos_overall, confRegular.sos_played, confRegular.sos_remaining,
          confRegular.actual_wins, confRegular.actual_losses, confRegular.projected_wins, confRegular.win_difference,
          confRegular.top40_wins, confRegular.top40_games, confRegular.coinflip_games, confRegular.sure_thing_games, confRegular.longshot_games,
          confRegular.games_played, confRegular.games_remaining
        ]);
      }
      
      // Calculate rankings for each filter combination
      await this.calculateSOSRankings(season);
      
      // Mark as completed
      await pool.query(`
        UPDATE calculation_status 
        SET status = 'completed', completed_at = NOW(), team_count = $2
        WHERE calculation_type = 'sos' AND season = $1
      `, [season, teams.length]);
      
      console.log(`✅ SOS calculation completed for ${teams.length} teams!`);
      
    } catch (error) {
      console.error('❌ SOS calculation failed:', error);
      await pool.query(`
        UPDATE calculation_status 
        SET status = 'failed', completed_at = NOW(), error_message = $2
        WHERE calculation_type = 'sos' AND season = $1
      `, [season, error.message]);
    }
  }
  
  async calculateTeamSOS(teamName, season, regularSeasonOnly = false, conferenceGamesOnly = false) {
    console.log(`   📊 Calculating SOS for ${teamName} (season: ${season}, regular: ${regularSeasonOnly}, conference: ${conferenceGamesOnly})`);
    
    // Build games query with DISTINCT to prevent duplicates
    let gamesQuery = `
      SELECT DISTINCT ON (g.week, g.home_team, g.away_team)
        g.*,
        CASE WHEN g.home_team = $1 THEN g.away_team ELSE g.home_team END as opponent,
        CASE WHEN g.home_team = $1 THEN 'home' ELSE 'away' END as venue,
        CASE WHEN g.home_team = $1 THEN 'home' ELSE 'away' END as home_away
      FROM games g
      WHERE (g.home_team = $1 OR g.away_team = $1) 
        AND g.season = $2
    `;
    
    const queryParams = [teamName, season];
    
    // Add filters
    if (regularSeasonOnly) {
      gamesQuery += ` AND g.season_type = 'regular'`;
    }
    
    if (conferenceGamesOnly) {
      gamesQuery += ` AND g.conference_game = true`;
    }
    
    gamesQuery += ` ORDER BY g.week, g.home_team, g.away_team, g.start_date`;
    
    const gamesResult = await pool.query(gamesQuery, queryParams);
    const games = gamesResult.rows;
    
    console.log(`   🎮 Found ${games.length} games for ${teamName} with filters`);
    
    if (games.length === 0) {
      return {
        sos_overall: 0, sos_played: 0, sos_remaining: 0,
        actual_wins: 0, actual_losses: 0, projected_wins: 0, win_difference: 0,
        top40_wins: 0, top40_games: 0, coinflip_games: 0, sure_thing_games: 0, longshot_games: 0,
        games_played: 0, games_remaining: 0
      };
    }
    
    // Get team's own power rating
    const teamRatingResult = await pool.query(`
      SELECT power_rating 
      FROM team_power_ratings 
      WHERE LOWER(TRIM(team_name)) = LOWER(TRIM($1)) AND season = $2
    `, [teamName, season]);
    
    const teamRating = teamRatingResult.rows.length > 0 ? 
      parseFloat(teamRatingResult.rows[0].power_rating) : 0;
    
    // Separate completed and future games
    const completedGames = games.filter(g => g.completed === true);
    const futureGames = games.filter(g => g.completed === false);
    
    console.log(`   ✅ ${completedGames.length} completed, 🔮 ${futureGames.length} remaining`);
    
    // Initialize counters
    let sosPlayed = 0, sosRemaining = 0;
    let playedOpponentCount = 0, remainingOpponentCount = 0;
    let actualWins = 0, actualLosses = 0, projectedWins = 0;
    let top40Wins = 0, top40Games = 0;
    let coinflipGames = 0, sureThingGames = 0, longshotGames = 0;
    
    // Process completed games
    for (const game of completedGames) {
      // Get opponent's power rating
      const opponentRating = await pool.query(`
        SELECT power_rating 
        FROM team_power_ratings 
        WHERE LOWER(TRIM(team_name)) = LOWER(TRIM($1)) AND season = $2
      `, [game.opponent, season]);
      
      if (opponentRating.rows.length > 0) {
        const oppRating = parseFloat(opponentRating.rows[0].power_rating);
        sosPlayed += oppRating;
        playedOpponentCount++;
        
        // Check if opponent is top 40
        const opponentRank = await pool.query(`
          SELECT COUNT(*) + 1 as rank
          FROM team_power_ratings tpr
          WHERE tpr.power_rating > $1 AND tpr.season = $2
        `, [oppRating, season]);
        
        const oppRank = parseInt(opponentRank.rows[0].rank);
        if (oppRank <= 40) {
          top40Games++;
        }
      }
      
      // Calculate actual wins/losses
      const teamScore = game.venue === 'home' ? game.home_points : game.away_points;
      const oppScore = game.venue === 'home' ? game.away_points : game.home_points;
      
      if (teamScore !== null && oppScore !== null) {
        if (teamScore > oppScore) {
          actualWins++;
          // Check if this was a top 40 win
          if (opponentRating.rows.length > 0) {
            const oppRating = parseFloat(opponentRating.rows[0].power_rating);
            const opponentRank = await pool.query(`
              SELECT COUNT(*) + 1 as rank
              FROM team_power_ratings tpr
              WHERE tpr.power_rating > $1 AND tpr.season = $2
            `, [oppRating, season]);
            const oppRank = parseInt(opponentRank.rows[0].rank);
            if (oppRank <= 40) top40Wins++;
          }
        } else {
          actualLosses++;
        }
      }
      
      // Calculate expected wins using betting lines or power ratings
      let expectedWinsPre = 0;
      
      // First try to get betting lines
      const bettingLines = await pool.query(`
        SELECT home_moneyline, away_moneyline, spread
        FROM game_betting_lines 
        WHERE game_id = $1 
        AND UPPER(TRIM(provider)) IN ('DRAFTKINGS', 'ESPN BET')
        LIMIT 1
      `, [game.id]);
      
      if (bettingLines.rows.length > 0) {
        const lines = bettingLines.rows[0];
        let pregameProb = null;
        
        // Try moneylines first
        if (lines.home_moneyline && lines.away_moneyline) {
          const homeRawProb = this.moneylineToProbability(lines.home_moneyline);
          const awayRawProb = this.moneylineToProbability(lines.away_moneyline);
          
          if (homeRawProb && awayRawProb) {
            const totalProb = homeRawProb + awayRawProb;
            const homeAdjustedProb = homeRawProb / totalProb;
            const awayAdjustedProb = awayRawProb / totalProb;
            pregameProb = game.home_away === 'home' ? homeAdjustedProb : awayAdjustedProb;
          }
        } else if (lines.spread) {
          // Fallback to spread
          const spreadValue = parseFloat(lines.spread);
          const adjustedSpread = game.home_away === 'home' ? spreadValue : -spreadValue;
          pregameProb = this.spreadToProbability(adjustedSpread);
        }
        
        if (pregameProb) {
          expectedWinsPre = pregameProb;
        }
      }
      
      // If no betting data, use power ratings
      if (expectedWinsPre === 0 && teamRating > 0 && opponentRating.rows.length > 0) {
        const oppRating = parseFloat(opponentRating.rows[0].power_rating);
        const homeAdvantage = game.venue === 'home' ? 2.15 : -2.15;
        const ratingDiff = teamRating - oppRating + homeAdvantage;
        expectedWinsPre = this.normalCDF(ratingDiff, 0, 13.5);
      }
      
      projectedWins += expectedWinsPre;
      
      // Categorize game difficulty
      if (expectedWinsPre >= 0.4 && expectedWinsPre <= 0.6) coinflipGames++;
      else if (expectedWinsPre >= 0.8) sureThingGames++;
      else if (expectedWinsPre <= 0.2) longshotGames++;
    }
    
    // Process future games
    for (const game of futureGames) {
      // Get opponent's power rating
      const opponentRating = await pool.query(`
        SELECT power_rating 
        FROM team_power_ratings 
        WHERE LOWER(TRIM(team_name)) = LOWER(TRIM($1)) AND season = $2
      `, [game.opponent, season]);
      
      if (opponentRating.rows.length > 0) {
        const oppRating = parseFloat(opponentRating.rows[0].power_rating);
        sosRemaining += oppRating;
        remainingOpponentCount++;
        
        // For future games, use power ratings to estimate probability
        if (teamRating > 0) {
          const homeAdvantage = game.venue === 'home' ? 2.15 : -2.15;
          const ratingDiff = teamRating - oppRating + homeAdvantage;
          const winProb = this.normalCDF(ratingDiff, 0, 13.5);
          projectedWins += winProb;
          
          // Categorize future game difficulty
          if (winProb >= 0.4 && winProb <= 0.6) coinflipGames++;
          else if (winProb >= 0.8) sureThingGames++;
          else if (winProb <= 0.2) longshotGames++;
        }
      }
    }
    
    // Calculate averages
    const avgSOSPlayed = playedOpponentCount > 0 ? sosPlayed / playedOpponentCount : 0;
    const avgSOSRemaining = remainingOpponentCount > 0 ? sosRemaining / remainingOpponentCount : 0;
    const totalOpponents = playedOpponentCount + remainingOpponentCount;
    const avgSOSOverall = totalOpponents > 0 ? (sosPlayed + sosRemaining) / totalOpponents : 0;
    const winDifference = actualWins - projectedWins;
    
    const result = {
      sos_overall: parseFloat(avgSOSOverall.toFixed(3)),
      sos_played: parseFloat(avgSOSPlayed.toFixed(3)),
      sos_remaining: parseFloat(avgSOSRemaining.toFixed(3)),
      actual_wins: actualWins,
      actual_losses: actualLosses,
      projected_wins: parseFloat(projectedWins.toFixed(1)),
      win_difference: parseFloat(winDifference.toFixed(1)),
      top40_wins: top40Wins,
      top40_games: top40Games,
      coinflip_games: coinflipGames,
      sure_thing_games: sureThingGames,
      longshot_games: longshotGames,
      games_played: completedGames.length,
      games_remaining: futureGames.length
    };
    
    console.log(`   📈 ${teamName}: SOS=${result.sos_overall}, Record=${result.actual_wins}-${result.actual_losses}, Proj=${result.projected_wins}`);
    
    return result;
  }
  
  async calculateSOSRankings(season) {
    console.log(`🏆 Calculating SOS rankings for ${season}...`);
    
    // Calculate rankings for each filter combination
    const filterTypes = [
      { suffix: '', column: 'sos_overall' },
      { suffix: '_regular', column: 'sos_overall_regular' },
      { suffix: '_conference', column: 'sos_overall_conference' },
      { suffix: '_conf_reg', column: 'sos_overall_conf_reg' }
    ];
    
    for (const filterType of filterTypes) {
      await pool.query(`
        UPDATE strength_of_schedule 
        SET sos_rank${filterType.suffix} = rankings.rank
        FROM (
          SELECT team_name, 
                 ROW_NUMBER() OVER (ORDER BY ${filterType.column} DESC) as rank
          FROM strength_of_schedule 
          WHERE season = $1 AND ${filterType.column} IS NOT NULL
        ) rankings
        WHERE strength_of_schedule.team_name = rankings.team_name 
          AND strength_of_schedule.season = $1
      `, [season]);
    }
    
    console.log(`✅ Rankings calculated for all filter combinations`);
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const calculator = new StatsCalculator();
  
  if (args.includes('--sos')) {
    const season = parseInt(args.find(arg => arg.startsWith('--season='))?.split('=')[1]) || 2024;
    await calculator.calculateAllSOS(season);
  }
  
  if (args.includes('--all')) {
    const season = parseInt(args.find(arg => arg.startsWith('--season='))?.split('=')[1]) || 2024;
    await calculator.calculateAllSOS(season);
  }
  
  console.log('✅ All calculations completed!');
  process.exit(0);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Calculation failed:', error);
    process.exit(1);
  });
}

module.exports = StatsCalculator;