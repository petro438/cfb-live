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

class SOSCalculator {
  
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
      // Clear existing data
      await pool.query(`DELETE FROM strength_of_schedule WHERE season = $1`, [season]);
      
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
            
            -- All games (26 values with projected_wins from game-level data)
            sos_overall, sos_played, sos_remaining,
            actual_wins, actual_losses, projected_wins, projected_wins_played, projected_wins_remaining, win_difference,
            top40_wins, top40_games, top40_wins_played, top40_games_played, top40_wins_remaining, top40_games_remaining,
            coinflip_games, coinflip_games_played, coinflip_games_remaining,
            sure_thing_games, sure_thing_games_played, sure_thing_games_remaining,
            longshot_games, longshot_games_played, longshot_games_remaining,
            games_played, games_remaining,
            
            -- Regular season only (26 values)
            sos_overall_regular, sos_played_regular, sos_remaining_regular,
            actual_wins_regular, actual_losses_regular, projected_wins_regular, projected_wins_played_regular, projected_wins_remaining_regular, win_difference_regular,
            top40_wins_regular, top40_games_regular, top40_wins_played_regular, top40_games_played_regular, top40_wins_remaining_regular, top40_games_remaining_regular,
            coinflip_games_regular, coinflip_games_played_regular, coinflip_games_remaining_regular,
            sure_thing_games_regular, sure_thing_games_played_regular, sure_thing_games_remaining_regular,
            longshot_games_regular, longshot_games_played_regular, longshot_games_remaining_regular,
            games_played_regular, games_remaining_regular,
            
            -- Conference games only (26 values)
            sos_overall_conference, sos_played_conference, sos_remaining_conference,
            actual_wins_conference, actual_losses_conference, projected_wins_conference, projected_wins_played_conference, projected_wins_remaining_conference, win_difference_conference,
            top40_wins_conference, top40_games_conference, top40_wins_played_conference, top40_games_played_conference, top40_wins_remaining_conference, top40_games_remaining_conference,
            coinflip_games_conference, coinflip_games_played_conference, coinflip_games_remaining_conference,
            sure_thing_games_conference, sure_thing_games_played_conference, sure_thing_games_remaining_conference,
            longshot_games_conference, longshot_games_played_conference, longshot_games_remaining_conference,
            games_played_conference, games_remaining_conference,
            
            -- Conference + Regular season (26 values)
            sos_overall_conf_reg, sos_played_conf_reg, sos_remaining_conf_reg,
            actual_wins_conf_reg, actual_losses_conf_reg, projected_wins_conf_reg, projected_wins_played_conf_reg, projected_wins_remaining_conf_reg, win_difference_conf_reg,
            top40_wins_conf_reg, top40_games_conf_reg, top40_wins_played_conf_reg, top40_games_played_conf_reg, top40_wins_remaining_conf_reg, top40_games_remaining_conf_reg,
            coinflip_games_conf_reg, coinflip_games_played_conf_reg, coinflip_games_remaining_conf_reg,
            sure_thing_games_conf_reg, sure_thing_games_played_conf_reg, sure_thing_games_remaining_conf_reg,
            longshot_games_conf_reg, longshot_games_played_conf_reg, longshot_games_remaining_conf_reg,
            games_played_conf_reg, games_remaining_conf_reg,
            
            last_updated
          ) VALUES (
            $1, $2, $3,
            -- All games (26 values)
            $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29,
            -- Regular season only (26 values)
            $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55,
            -- Conference games only (26 values)
            $56, $57, $58, $59, $60, $61, $62, $63, $64, $65, $66, $67, $68, $69, $70, $71, $72, $73, $74, $75, $76, $77, $78, $79, $80, $81,
            -- Conference + Regular season (26 values)
            $82, $83, $84, $85, $86, $87, $88, $89, $90, $91, $92, $93, $94, $95, $96, $97, $98, $99, $100, $101, $102, $103, $104, $105, $106, $107,
            -- Last updated
            NOW()
          )
        `, [
          team.team_name, season, 'fbs',
          // All games
          allGames.sos_overall, allGames.sos_played, allGames.sos_remaining,
          allGames.actual_wins, allGames.actual_losses, allGames.projected_wins, allGames.projected_wins_played, allGames.projected_wins_remaining, allGames.win_difference,
          allGames.top40_wins, allGames.top40_games, allGames.top40_wins_played, allGames.top40_games_played, allGames.top40_wins_remaining, allGames.top40_games_remaining,
          allGames.coinflip_games, allGames.coinflip_games_played, allGames.coinflip_games_remaining,
          allGames.sure_thing_games, allGames.sure_thing_games_played, allGames.sure_thing_games_remaining,
          allGames.longshot_games, allGames.longshot_games_played, allGames.longshot_games_remaining,
          allGames.games_played, allGames.games_remaining,
          // Regular season only
          regularSeason.sos_overall, regularSeason.sos_played, regularSeason.sos_remaining,
          regularSeason.actual_wins, regularSeason.actual_losses, regularSeason.projected_wins, regularSeason.projected_wins_played, regularSeason.projected_wins_remaining, regularSeason.win_difference,
          regularSeason.top40_wins, regularSeason.top40_games, regularSeason.top40_wins_played, regularSeason.top40_games_played, regularSeason.top40_wins_remaining, regularSeason.top40_games_remaining,
          regularSeason.coinflip_games, regularSeason.coinflip_games_played, regularSeason.coinflip_games_remaining,
          regularSeason.sure_thing_games, regularSeason.sure_thing_games_played, regularSeason.sure_thing_games_remaining,
          regularSeason.longshot_games, regularSeason.longshot_games_played, regularSeason.longshot_games_remaining,
          regularSeason.games_played, regularSeason.games_remaining,
          // Conference games only
          conferenceOnly.sos_overall, conferenceOnly.sos_played, conferenceOnly.sos_remaining,
          conferenceOnly.actual_wins, conferenceOnly.actual_losses, conferenceOnly.projected_wins, conferenceOnly.projected_wins_played, conferenceOnly.projected_wins_remaining, conferenceOnly.win_difference,
          conferenceOnly.top40_wins, conferenceOnly.top40_games, conferenceOnly.top40_wins_played, conferenceOnly.top40_games_played, conferenceOnly.top40_wins_remaining, conferenceOnly.top40_games_remaining,
          conferenceOnly.coinflip_games, conferenceOnly.coinflip_games_played, conferenceOnly.coinflip_games_remaining,
          conferenceOnly.sure_thing_games, conferenceOnly.sure_thing_games_played, conferenceOnly.sure_thing_games_remaining,
          conferenceOnly.longshot_games, conferenceOnly.longshot_games_played, conferenceOnly.longshot_games_remaining,
          conferenceOnly.games_played, conferenceOnly.games_remaining,
          // Conference + Regular season
          confRegular.sos_overall, confRegular.sos_played, confRegular.sos_remaining,
          confRegular.actual_wins, confRegular.actual_losses, confRegular.projected_wins, confRegular.projected_wins_played, confRegular.projected_wins_remaining, confRegular.win_difference,
          confRegular.top40_wins, confRegular.top40_games, confRegular.top40_wins_played, confRegular.top40_games_played, confRegular.top40_wins_remaining, confRegular.top40_games_remaining,
          confRegular.coinflip_games, confRegular.coinflip_games_played, confRegular.coinflip_games_remaining,
          confRegular.sure_thing_games, confRegular.sure_thing_games_played, confRegular.sure_thing_games_remaining,
          confRegular.longshot_games, confRegular.longshot_games_played, confRegular.longshot_games_remaining,
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
    
    // Build games query with DISTINCT to prevent duplicates - NOW INCLUDES win probabilities
    let gamesQuery = `
      SELECT DISTINCT ON (g.week, g.home_team, g.away_team)
        g.*,
        CASE WHEN g.home_team = $1 THEN g.away_team ELSE g.home_team END as opponent,
        CASE WHEN g.home_team = $1 THEN 'home' ELSE 'away' END as venue,
        CASE WHEN g.home_team = $1 THEN 'home' ELSE 'away' END as home_away,
        -- Get the win probability for this team
        CASE 
          WHEN g.home_team = $1 THEN g.home_pregame_win_probability
          ELSE g.away_pregame_win_probability
        END as team_win_probability
      FROM games g
      WHERE (g.home_team = $1 OR g.away_team = $1) 
        AND g.season = $2
        AND g.home_pregame_win_probability IS NOT NULL  -- Only include games with calculated probabilities
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
        actual_wins: 0, actual_losses: 0, projected_wins: 0, projected_wins_played: 0, projected_wins_remaining: 0, win_difference: 0,
        top40_wins: 0, top40_games: 0, top40_wins_played: 0, top40_games_played: 0, top40_wins_remaining: 0, top40_games_remaining: 0,
        coinflip_games: 0, coinflip_games_played: 0, coinflip_games_remaining: 0,
        sure_thing_games: 0, sure_thing_games_played: 0, sure_thing_games_remaining: 0,
        longshot_games: 0, longshot_games_played: 0, longshot_games_remaining: 0,
        games_played: 0, games_remaining: 0
      };
    }
    
    // Separate completed and future games
    const completedGames = games.filter(g => g.completed === true);
    const futureGames = games.filter(g => g.completed === false);
    
    console.log(`   ✅ ${completedGames.length} completed, 🔮 ${futureGames.length} remaining`);
    
    // Initialize counters
    let sosPlayed = 0, sosRemaining = 0;
    let playedOpponentCount = 0, remainingOpponentCount = 0;
    let actualWins = 0, actualLosses = 0;
    let top40Wins = 0, top40Games = 0;
    let top40WinsPlayed = 0, top40GamesPlayed = 0, top40WinsRemaining = 0, top40GamesRemaining = 0;
    let coinflipGames = 0, sureThingGames = 0, longshotGames = 0;
    let coinflipGamesPlayed = 0, sureThingGamesPlayed = 0, longshotGamesPlayed = 0;
    let coinflipGamesRemaining = 0, sureThingGamesRemaining = 0, longshotGamesRemaining = 0;
    
    // NEW: Calculate expected wins from game-level probabilities
    let expectedWinsPlayed = 0;
    let expectedWinsRemaining = 0;
    
    // Process completed games
    for (const game of completedGames) {
      // Get opponent's power rating for SOS calculation
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
          top40GamesPlayed++;
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
            if (oppRank <= 40) {
              top40Wins++;
              top40WinsPlayed++;
            }
          }
        } else {
          actualLosses++;
        }
      }
      
      // NEW: Use game-level win probability for expected wins
      const winProb = parseFloat(game.team_win_probability) || 0;
      expectedWinsPlayed += winProb;
      
      // Categorize game difficulty based on win probability
      if (winProb >= 0.4 && winProb <= 0.6) {
        coinflipGames++;
        coinflipGamesPlayed++;
      } else if (winProb >= 0.8) {
        sureThingGames++;
        sureThingGamesPlayed++;
      } else if (winProb <= 0.2) {
        longshotGames++;
        longshotGamesPlayed++;
      }
    }
    
    // Process future games
    for (const game of futureGames) {
      // Get opponent's power rating for SOS calculation
      const opponentRating = await pool.query(`
        SELECT power_rating 
        FROM team_power_ratings 
        WHERE LOWER(TRIM(team_name)) = LOWER(TRIM($1)) AND season = $2
      `, [game.opponent, season]);
      
      if (opponentRating.rows.length > 0) {
        const oppRating = parseFloat(opponentRating.rows[0].power_rating);
        sosRemaining += oppRating;
        remainingOpponentCount++;
        
        // Check if this is a top 40 future opponent
        const opponentRank = await pool.query(`
          SELECT COUNT(*) + 1 as rank
          FROM team_power_ratings tpr
          WHERE tpr.power_rating > $1 AND tpr.season = $2
        `, [oppRating, season]);
        
        const oppRank = parseInt(opponentRank.rows[0].rank);
        if (oppRank <= 40) {
          top40Games++;
          top40GamesRemaining++;
        }
      }
      
      // NEW: Use game-level win probability for expected wins
      const winProb = parseFloat(game.team_win_probability) || 0;
      expectedWinsRemaining += winProb;
      
      // Categorize future game difficulty
      if (winProb >= 0.4 && winProb <= 0.6) {
        coinflipGames++;
        coinflipGamesRemaining++;
      } else if (winProb >= 0.8) {
        sureThingGames++;
        sureThingGamesRemaining++;
      } else if (winProb <= 0.2) {
        longshotGames++;
        longshotGamesRemaining++;
      }
    }
    
    // Calculate averages
    const avgSOSPlayed = playedOpponentCount > 0 ? sosPlayed / playedOpponentCount : 0;
    const avgSOSRemaining = remainingOpponentCount > 0 ? sosRemaining / remainingOpponentCount : 0;
    const totalOpponents = playedOpponentCount + remainingOpponentCount;
    const avgSOSOverall = totalOpponents > 0 ? (sosPlayed + sosRemaining) / totalOpponents : 0;
    
    // NEW: Calculate win difference using game-level expected wins
    const totalExpectedWins = expectedWinsPlayed + expectedWinsRemaining;
    const winDifference = actualWins - totalExpectedWins;
    
    const result = {
      sos_overall: parseFloat(avgSOSOverall.toFixed(3)),
      sos_played: parseFloat(avgSOSPlayed.toFixed(3)),
      sos_remaining: parseFloat(avgSOSRemaining.toFixed(3)),
      actual_wins: actualWins,
      actual_losses: actualLosses,
      projected_wins: parseFloat((expectedWinsPlayed + expectedWinsRemaining).toFixed(1)),
      projected_wins_played: parseFloat(expectedWinsPlayed.toFixed(1)),
      projected_wins_remaining: parseFloat(expectedWinsRemaining.toFixed(1)),
      win_difference: parseFloat(winDifference.toFixed(1)),
      top40_wins: top40Wins,
      top40_games: top40Games,
      top40_wins_played: top40WinsPlayed,
      top40_games_played: top40GamesPlayed,
      top40_wins_remaining: top40WinsRemaining,
      top40_games_remaining: top40GamesRemaining,
      coinflip_games: coinflipGames,
      coinflip_games_played: coinflipGamesPlayed,
      coinflip_games_remaining: coinflipGamesRemaining,
      sure_thing_games: sureThingGames,
      sure_thing_games_played: sureThingGamesPlayed,
      sure_thing_games_remaining: sureThingGamesRemaining,
      longshot_games: longshotGames,
      longshot_games_played: longshotGamesPlayed,
      longshot_games_remaining: longshotGamesRemaining,
      games_played: completedGames.length,
      games_remaining: futureGames.length
    };
    
    console.log(`   📈 ${teamName}: SOS=${result.sos_overall}, Record=${result.actual_wins}-${result.actual_losses}, ExpWins=${totalExpectedWins.toFixed(1)}`);
    
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
  const calculator = new SOSCalculator();
  
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

module.exports = SOSCalculator;