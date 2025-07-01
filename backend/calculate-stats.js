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
      // Get all FBS teams
      const teamsResult = await pool.query(`
        SELECT DISTINCT t.school as team_name, t.conference, t.classification
        FROM teams t
        WHERE t.classification = 'fbs'
        ORDER BY t.school
      `);
      
      const teams = teamsResult.rows;
      console.log(`📊 Processing ${teams.length} teams...`);
      
      // Calculate SOS for each team
      for (let i = 0; i < teams.length; i++) {
        const team = teams[i];
        console.log(`⚙️ [${i+1}/${teams.length}] Calculating SOS for ${team.team_name}`);
        
        const sosData = await this.calculateTeamSOS(team.team_name, season);
        
        // Insert/update in database
        await pool.query(`
          INSERT INTO strength_of_schedule (
            team_name, season, classification, sos_overall, sos_played, sos_remaining,
            actual_wins, actual_losses, projected_wins, win_difference,
            top40_wins, top40_games, coinflip_games, sure_thing_games, longshot_games,
            games_played, games_remaining, last_updated
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
          ON CONFLICT (team_name, season, classification)
          DO UPDATE SET
            sos_overall = $4, sos_played = $5, sos_remaining = $6,
            actual_wins = $7, actual_losses = $8, projected_wins = $9, win_difference = $10,
            top40_wins = $11, top40_games = $12, coinflip_games = $13, sure_thing_games = $14, longshot_games = $15,
            games_played = $16, games_remaining = $17, last_updated = NOW()
        `, [
          team.team_name, season, 'fbs', sosData.sos_overall, sosData.sos_played, sosData.sos_remaining,
          sosData.actual_wins, sosData.actual_losses, sosData.projected_wins, sosData.win_difference,
          sosData.top40_wins, sosData.top40_games, sosData.coinflip_games, sosData.sure_thing_games, sosData.longshot_games,
          sosData.games_played, sosData.games_remaining
        ]);
      }
      
      // Calculate rankings
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
  
  async calculateTeamSOS(teamName, season) {
    console.log(`   📊 Calculating SOS for ${teamName} in season ${season} (type: ${typeof season})...`);
    
    // Get games for this team for the specific season only
    console.log(`   🔍 Looking for games: team="${teamName}", season=${season} (type: ${typeof season})`);
    
    const gamesResult = await pool.query(`
      SELECT 
        MIN(g.season) as season,
        g.week,
        BOOL_OR(g.completed) as completed,
        MIN(g.id) as id,
        g.home_team,
        g.away_team,
        MIN(g.home_points) as home_points,
        MIN(g.away_points) as away_points,
        MIN(g.start_date) as start_date,
        BOOL_OR(g.neutral_site) as neutral_site,
        BOOL_OR(g.conference_game) as conference_game,
        MIN(g.season_type) as season_type,
        MIN(g.home_postgame_win_probability) as home_postgame_win_probability,
        MIN(g.away_postgame_win_probability) as away_postgame_win_probability,
        CASE WHEN g.home_team = $1 THEN g.away_team ELSE g.home_team END as opponent,
        CASE WHEN g.home_team = $1 THEN 'home' ELSE 'away' END as venue
      FROM games g
      WHERE (g.home_team = $1 OR g.away_team = $1) 
        AND CAST(g.season AS INTEGER) = $2
        AND g.season IS NOT NULL
      GROUP BY g.week, g.home_team, g.away_team
      ORDER BY g.week
    `, [teamName, season]);
    
    // Debug what we got - show first few games with more detail
    const seasonBreakdown = {};
    const sampleGames = [];
    gamesResult.rows.forEach((game, index) => {
      seasonBreakdown[game.season] = (seasonBreakdown[game.season] || 0) + 1;
      if (index < 5) {
        sampleGames.push({
          week: game.week,
          season: game.season,
          opponent: game.opponent,
          completed: game.completed,
          id: game.id
        });
      }
    });
    console.log(`   📊 Games by season for ${teamName}:`, seasonBreakdown);
    console.log(`   📝 Sample games:`, sampleGames);
    
    const games = gamesResult.rows;
    console.log(`   🎮 Found ${games.length} games for ${teamName}`);
    
    if (games.length === 0) {
      return {
        sos_overall: 0,
        sos_played: 0,
        sos_remaining: 0,
        actual_wins: 0,
        actual_losses: 0,
        projected_wins: 0,
        win_difference: 0,
        top40_wins: 0,
        top40_games: 0,
        coinflip_games: 0,
        sure_thing_games: 0,
        longshot_games: 0,
        games_played: 0,
        games_remaining: 0
      };
    }
    
    // Separate completed and future games
    const completedGames = games.filter(g => g.completed === true);
    const futureGames = games.filter(g => g.completed === false);
    
    console.log(`   ✅ ${completedGames.length} completed, 🔮 ${futureGames.length} remaining`);
    
    // Get team's own power rating for win probability calculations
    const teamRatingResult = await pool.query(`
      SELECT power_rating 
      FROM team_power_ratings 
      WHERE LOWER(TRIM(team_name)) = LOWER(TRIM($1)) AND season = $2
    `, [teamName, season]);
    
    const teamRating = teamRatingResult.rows.length > 0 ? 
      parseFloat(teamRatingResult.rows[0].power_rating) : 0;
    
    // Initialize counters
    let sosPlayed = 0;
    let sosRemaining = 0;
    let playedOpponentCount = 0;
    let remainingOpponentCount = 0;
    let actualWins = 0;
    let actualLosses = 0;
    let projectedWins = 0;
    let top40Wins = 0;
    let top40Games = 0;
    let coinflipGames = 0;
    let sureThingGames = 0;
    let longshotGames = 0;
    
    // Calculate SOS for completed games
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
        
        // Calculate win probability for this game
        if (teamRating > 0) {
          const homeAdvantage = game.venue === 'home' ? 2.15 : -2.15;
          const ratingDiff = teamRating - oppRating + homeAdvantage;
          
          // Using normal distribution to calculate win probability
          const winProb = this.normalCDF(ratingDiff, 0, 13.5);
          projectedWins += winProb;
          
          // Categorize game difficulty
          if (winProb >= 0.4 && winProb <= 0.6) coinflipGames++;
          else if (winProb >= 0.8) sureThingGames++;
          else if (winProb <= 0.2) longshotGames++;
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
    }
    
    // Calculate SOS for remaining games
    for (const game of futureGames) {
      const opponentRating = await pool.query(`
        SELECT power_rating 
        FROM team_power_ratings 
        WHERE LOWER(TRIM(team_name)) = LOWER(TRIM($1)) AND season = $2
      `, [game.opponent, season]);
      
      if (opponentRating.rows.length > 0) {
        sosRemaining += parseFloat(opponentRating.rows[0].power_rating);
        remainingOpponentCount++;
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
    // Add SOS rankings to all teams
    await pool.query(`
      UPDATE strength_of_schedule 
      SET sos_rank = rankings.rank
      FROM (
        SELECT team_name, 
               ROW_NUMBER() OVER (ORDER BY sos_overall DESC) as rank
        FROM strength_of_schedule 
        WHERE season = $1
      ) rankings
      WHERE strength_of_schedule.team_name = rankings.team_name 
        AND strength_of_schedule.season = $1
    `, [season]);
  }
  
  normalCDF(x, mean = 0, stdDev = 1) {
    const z = (x - mean) / stdDev;
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp(-z * z / 2);
    let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    if (z > 0) prob = 1 - prob;
    return prob;
  }
  
  async calculateAllLuck(season = 2024) {
    console.log(`🍀 Starting Luck calculation for ${season}...`);
    
    // Mark calculation as started
    await pool.query(`
      INSERT INTO calculation_status (calculation_type, season, status, started_at, team_count)
      VALUES ('luck', $1, 'running', NOW(), 0)
      ON CONFLICT (calculation_type, season) 
      DO UPDATE SET status = 'running', started_at = NOW()
    `, [season]);
    
    try {
      // Get all FBS teams with their power ratings and conference info
      const teamsResult = await pool.query(`
        SELECT DISTINCT 
          t.school as team_name, 
          t.conference,
          t.classification,
          COALESCE(tpr.power_rating, 0) as team_rating,
          (SELECT COUNT(*) + 1 FROM team_power_ratings tpr2 
           WHERE tpr2.power_rating > tpr.power_rating AND tpr2.season = $1) as power_rank
        FROM teams t
        LEFT JOIN team_power_ratings tpr ON LOWER(TRIM(t.school)) = LOWER(TRIM(tpr.team_name))
          AND tpr.season = $1
        WHERE t.classification = 'fbs'
        ORDER BY t.school
      `, [season]);
      
      const teams = teamsResult.rows;
      console.log(`📊 Processing luck for ${teams.length} teams...`);
      
      // Calculate luck for each team
      for (let i = 0; i < teams.length; i++) {
        const team = teams[i];
        console.log(`🎲 [${i+1}/${teams.length}] Calculating luck for ${team.team_name}`);
        
        const luckData = await this.calculateTeamLuck(team.team_name, season);
        
        // Insert/update in database
        await pool.query(`
          INSERT INTO luck_analysis (
            team_name, season, wins, losses, conference, power_rank,
            expected_wins, expected_vs_actual, deserved_wins, deserved_vs_actual, expected_vs_deserved,
            close_game_wins, close_game_total, fumble_recovery_rate, interception_rate, turnover_margin,
            games_analyzed, last_updated
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
          ON CONFLICT (team_name, season)
          DO UPDATE SET
            wins = $3, losses = $4, conference = $5, power_rank = $6,
            expected_wins = $7, expected_vs_actual = $8, deserved_wins = $9, deserved_vs_actual = $10, expected_vs_deserved = $11,
            close_game_wins = $12, close_game_total = $13, fumble_recovery_rate = $14, interception_rate = $15, turnover_margin = $16,
            games_analyzed = $17, last_updated = NOW()
        `, [
          team.team_name, season, luckData.wins, luckData.losses, team.conference, team.power_rank,
          luckData.expected_wins, luckData.expected_vs_actual, luckData.deserved_wins, luckData.deserved_vs_actual, luckData.expected_vs_deserved,
          luckData.close_game_wins, luckData.close_game_total, luckData.fumble_recovery_rate, luckData.interception_rate, luckData.turnover_margin,
          luckData.games_analyzed
        ]);
      }
      
      // Mark as completed
      await pool.query(`
        UPDATE calculation_status 
        SET status = 'completed', completed_at = NOW(), team_count = $2
        WHERE calculation_type = 'luck' AND season = $1
      `, [season, teams.length]);
      
      console.log(`✅ Luck calculation completed for ${teams.length} teams!`);
      
    } catch (error) {
      console.error('❌ Luck calculation failed:', error);
      await pool.query(`
        UPDATE calculation_status 
        SET status = 'failed', completed_at = NOW(), error_message = $2
        WHERE calculation_type = 'luck' AND season = $1
      `, [season, error.message]);
    }
  }
  
  async calculateTeamLuck(teamName, season) {
    // Get all completed games for this team
    const gamesResult = await pool.query(`
      SELECT 
        g.*,
        CASE WHEN g.home_team = $1 THEN g.away_team ELSE g.home_team END as opponent,
        CASE WHEN g.home_team = $1 THEN 'home' ELSE 'away' END as venue
      FROM games g
      WHERE (g.home_team = $1 OR g.away_team = $1) 
        AND g.season = $2 
        AND g.completed = true
      ORDER BY g.week
    `, [teamName, season]);
    
    const games = gamesResult.rows;
    
    // Initialize counters
    let actualWins = 0;
    let actualLosses = 0;
    let expectedWins = 0;
    let deservedWins = 0;
    let closeGameWins = 0;
    let closeGameTotal = 0;
    
    // Process each game
    for (const game of games) {
      const teamScore = game.venue === 'home' ? game.home_points : game.away_points;
      const oppScore = game.venue === 'home' ? game.away_points : game.home_points;
      const scoreDiff = Math.abs(teamScore - oppScore);
      
      // Actual wins/losses
      if (teamScore > oppScore) {
        actualWins++;
        if (scoreDiff <= 8) closeGameWins++;
      } else {
        actualLosses++;
      }
      
      // Close games
      if (scoreDiff <= 8) {
        closeGameTotal++;
      }
      
      // Expected wins (simplified - assume 50% for each game if no betting data)
      expectedWins += 0.5;
      
      // Deserved wins (use postgame win probability if available)
      const postgameProb = game.venue === 'home' 
        ? parseFloat(game.home_postgame_win_probability || 0.5)
        : parseFloat(game.away_postgame_win_probability || 0.5);
      
      deservedWins += postgameProb;
    }
    
    // Calculate final metrics
    const expectedVsActual = actualWins - expectedWins;
    const deservedVsActual = deservedWins - actualWins;
    const expectedVsDeserved = deservedWins - expectedWins;
    
    // Mock turnover luck (random for now - replace with real data later)
    const fumbleRecoveryRate = 45 + Math.random() * 20; // 45-65%
    const interceptionRate = 45 + Math.random() * 20;   // 45-65%
    const turnoverMargin = Math.floor(-10 + Math.random() * 20); // -10 to +10
    
    return {
      wins: actualWins,
      losses: actualLosses,
      expected_wins: parseFloat(expectedWins.toFixed(1)),
      expected_vs_actual: parseFloat(expectedVsActual.toFixed(1)),
      deserved_wins: parseFloat(deservedWins.toFixed(1)),
      deserved_vs_actual: parseFloat(deservedVsActual.toFixed(1)),
      expected_vs_deserved: parseFloat(expectedVsDeserved.toFixed(1)),
      close_game_wins: closeGameWins,
      close_game_total: closeGameTotal,
      fumble_recovery_rate: parseFloat(fumbleRecoveryRate.toFixed(1)),
      interception_rate: parseFloat(interceptionRate.toFixed(1)),
      turnover_margin: turnoverMargin,
      games_analyzed: games.length
    };
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
  
  if (args.includes('--luck')) {
    const season = parseInt(args.find(arg => arg.startsWith('--season='))?.split('=')[1]) || 2024;
    await calculator.calculateAllLuck(season);
  }
  
  if (args.includes('--all')) {
    const season = parseInt(args.find(arg => arg.startsWith('--season='))?.split('=')[1]) || 2024;
    await calculator.calculateAllSOS(season);
    await calculator.calculateAllLuck(season);
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