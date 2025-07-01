const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: './dataconfig.env' });
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    console.log('🔍 CORS request from origin:', origin);
    
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) {
      console.log('✅ Allowing request with no origin');
      return callback(null, true);
    }
    
    // Allow localhost for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      console.log('✅ Allowing localhost request');
      return callback(null, true);
    }
    
    // Allow any Railway domain
    if (origin.includes('.up.railway.app')) {
      console.log('✅ Allowing Railway domain request');
      return callback(null, true);
    }
    
    // Log blocked requests for debugging
    console.log('❌ CORS blocked request from:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// PostgreSQL connection - USES DATABASE_URL ONLY
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

// Helper function for normal distribution CDF
function normalCDF(x, mean = 0, stdDev = 1) {
  const z = (x - mean) / stdDev;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (z > 0) prob = 1 - prob;
  return prob;
}

// Helper function for win probability calculation (add this near your existing normalCDF function)
function calculateWinProbability(teamRating, opponentRating, isHome = true) {
  const homeAdvantage = isHome ? 2.15 : -2.15;
  const ratingDiff = teamRating - opponentRating + homeAdvantage;
  return normalCDF(ratingDiff, 0, 13.5);
}

// 🔧 ALSO ADD this helper function if you don't already have it
// (Add this near your existing moneylineToProbability function)

function moneylineToProbability(moneyline) {
  if (!moneyline || moneyline === null) return null;
  
  if (moneyline > 0) {
    return 1 / (moneyline / 100 + 1);
  } else {
    return 1 / (1 + 100 / Math.abs(moneyline));
  }
}

// API Routes

// Get power rankings - SIMPLIFIED for new database structure
app.get('/api/power-rankings', async (req, res) => {
  try {
    const season = parseInt(req.query.season) || 2025;
    
    console.log(`Fetching power rankings for ${season} season`);
    
    const result = await pool.query(`
  SELECT 
    tpr.team_name,
    tpr.power_rating,
    tpr.offense_rating,
    tpr.defense_rating,
    tpr.season,
    t.school,
    t.mascot,
    t.conference,
    t.classification,
    t.logo_url,
    t.color,
    t.alt_color,
    COALESCE(sos.sos_overall, 0) as strength_of_schedule,
    COALESCE(sos.sos_rank, 999) as sos_rank
  FROM team_power_ratings tpr
  LEFT JOIN teams t ON LOWER(TRIM(t.school)) = LOWER(TRIM(tpr.team_name))
  LEFT JOIN strength_of_schedule sos ON LOWER(TRIM(sos.team_name)) = LOWER(TRIM(tpr.team_name))
    AND sos.season = tpr.season
  WHERE tpr.power_rating IS NOT NULL 
    AND tpr.season = $1
  ORDER BY tpr.power_rating DESC
`, [season]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: `No power rankings found for ${season} season`,
        availableSeasons: await getAvailableSeasons(pool)
      });
    }
    
    // Calculate rankings
    const sortedByPower = [...result.rows].sort((a, b) => b.power_rating - a.power_rating);
    const sortedByOffense = [...result.rows].sort((a, b) => b.offense_rating - a.offense_rating);
    const sortedByDefense = [...result.rows].sort((a, b) => b.defense_rating - a.defense_rating);
    
    const teamsWithRanks = result.rows.map(team => {
      const powerRank = sortedByPower.findIndex(t => t.team_name === team.team_name) + 1;
      const offenseRank = sortedByOffense.findIndex(t => t.team_name === team.team_name) + 1;
      const defenseRank = sortedByDefense.findIndex(t => t.team_name === team.team_name) + 1;
      
      return {
        team_name: team.team_name,
        teamName: team.team_name,
        power_rating: team.power_rating,
        powerRating: team.power_rating,
        offense_rating: team.offense_rating,
        offenseRating: team.offense_rating,
        defense_rating: team.defense_rating,
        defenseRating: team.defense_rating,
        season: team.season,
        conference: team.conference || 'Unknown',
        classification: team.classification || 'FBS',
        logo: team.logo_url || 'http://a.espncdn.com/i/teamlogos/ncaa/500/default.png',
        abbreviation: team.school?.substring(0, 4).toUpperCase() || team.team_name?.substring(0, 4).toUpperCase(),
        power_rank: powerRank,
        powerRank: powerRank,
        offense_rank: offenseRank,
        offenseRank: offenseRank,
        defense_rank: defenseRank,
        defenseRank: defenseRank,
        primary_color: team.color,
        secondary_color: team.alt_color
      };
    }).sort((a, b) => b.power_rating - a.power_rating);
    
    console.log(`Returning ${teamsWithRanks.length} teams for ${season} season`);
    
    res.json({
      season: season,
      teams: teamsWithRanks,
      totalTeams: teamsWithRanks.length
    });
  } catch (err) {
    console.error('Error fetching power rankings:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Helper function to get available seasons
async function getAvailableSeasons(pool) {
  try {
    const result = await pool.query(`
      SELECT DISTINCT season 
      FROM team_power_ratings 
      WHERE season IS NOT NULL 
      ORDER BY season DESC
    `);
    return result.rows.map(row => row.season);
  } catch (err) {
    console.error('Error fetching available seasons:', err);
    return [];
  }
}

// Get available seasons endpoint
app.get('/api/available-seasons', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT season 
      FROM team_power_ratings 
      WHERE season IS NOT NULL 
      ORDER BY season DESC
    `);
    const seasons = result.rows.map(row => row.season);
    res.json({ seasons });
  } catch (err) {
    console.error('Error fetching available seasons:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Individual team endpoint - SIMPLIFIED
app.get('/api/teams/:teamName', async (req, res) => {
  try {
    const teamName = decodeURIComponent(req.params.teamName);
    const season = parseInt(req.query.season) || 2025;
    
    console.log(`🔍 Looking for team: "${teamName}" for ${season} season`);
    
    const result = await pool.query(`
      SELECT 
        t.*,
        tpr.power_rating,
        tpr.offense_rating,
        tpr.defense_rating,
        tpr.season
      FROM teams t
      LEFT JOIN team_power_ratings tpr ON LOWER(TRIM(t.school)) = LOWER(TRIM(tpr.team_name))
        AND tpr.season = $2
      WHERE LOWER(TRIM(t.school)) = LOWER(TRIM($1))
      LIMIT 1
    `, [teamName, season]);
    
    if (result.rows.length === 0) {
      console.log(`❌ Team not found: "${teamName}"`);
      return res.status(404).json({ error: 'Team not found' });
    }
    
    const team = result.rows[0];
    
    // Calculate ranks by getting all teams for this season and ranking them
    const allTeamsResult = await pool.query(`
      SELECT team_name, power_rating, offense_rating, defense_rating
      FROM team_power_ratings 
      WHERE season = $1 AND power_rating IS NOT NULL
      ORDER BY power_rating DESC
    `, [season]);
    
    const allTeams = allTeamsResult.rows;
    const powerRank = allTeams.findIndex(t => t.team_name === team.school) + 1;
    const offenseRank = [...allTeams].sort((a, b) => b.offense_rating - a.offense_rating)
      .findIndex(t => t.team_name === team.school) + 1;
    const defenseRank = [...allTeams].sort((a, b) => b.defense_rating - a.defense_rating)
      .findIndex(t => t.team_name === team.school) + 1;
    
    console.log(`✅ Found team: "${team.school}" for ${season} season`);
    
    res.json({
      team_name: team.school,
      power_rating: team.power_rating,
      offense_rating: team.offense_rating,
      defense_rating: team.defense_rating,
      season: team.season,
      conference: team.conference,
      classification: team.classification || 'FBS',
      logo: team.logo_url || 'http://a.espncdn.com/i/teamlogos/ncaa/500/default.png',
      primary_color: team.color,
      secondary_color: team.alt_color,
      power_rank: powerRank || null,
      offense_rank: offenseRank || null,
      defense_rank: defenseRank || null,
      mascot: team.mascot
    });
  } catch (err) {
    console.error('Error fetching team:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get team's season stats
app.get('/api/teams/:teamName/stats', async (req, res) => {
  try {
    const teamName = decodeURIComponent(req.params.teamName);
    const season = parseInt(req.query.season) || 2024;
    
    console.log(`🔍 Fetching stats for: "${teamName}", season ${season}`);
    
    const query = `
      SELECT 
        ass.season,
        ass.team,
        ass.conference,
        
        -- Calculate games played for this team
        (SELECT COUNT(*) FROM games g 
         WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
         AND g.season = ass.season 
         AND g.completed = true) as games_played,
        
        -- Per-game stats (divide by games played)
        CASE 
          WHEN (SELECT COUNT(*) FROM games g 
                WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                AND g.season = ass.season 
                AND g.completed = true) > 0 
          THEN ass.offense_plays / (SELECT COUNT(*) FROM games g 
                                   WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                                   AND g.season = ass.season 
                                   AND g.completed = true)
          ELSE ass.offense_plays
        END as offense_plays_per_game,
        
        CASE 
          WHEN (SELECT COUNT(*) FROM games g 
                WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                AND g.season = ass.season 
                AND g.completed = true) > 0 
          THEN ass.defense_plays / (SELECT COUNT(*) FROM games g 
                                   WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                                   AND g.season = ass.season 
                                   AND g.completed = true)
          ELSE ass.defense_plays
        END as defense_plays_per_game,
        
        CASE 
          WHEN (SELECT COUNT(*) FROM games g 
                WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                AND g.season = ass.season 
                AND g.completed = true) > 0 
          THEN ass.offense_drives / (SELECT COUNT(*) FROM games g 
                                    WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                                    AND g.season = ass.season 
                                    AND g.completed = true)
          ELSE ass.offense_drives
        END as offense_drives_per_game,
        
        CASE 
          WHEN (SELECT COUNT(*) FROM games g 
                WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                AND g.season = ass.season 
                AND g.completed = true) > 0 
          THEN ass.defense_drives / (SELECT COUNT(*) FROM games g 
                                    WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                                    AND g.season = ass.season 
                                    AND g.completed = true)
          ELSE ass.defense_drives
        END as defense_drives_per_game,
        
        CASE 
          WHEN (SELECT COUNT(*) FROM games g 
                WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                AND g.season = ass.season 
                AND g.completed = true) > 0 
          THEN ass.offense_total_opportunities / (SELECT COUNT(*) FROM games g 
                                                 WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                                                 AND g.season = ass.season 
                                                 AND g.completed = true)
          ELSE ass.offense_total_opportunities
        END as offense_total_opportunities_per_game,
        
        CASE 
          WHEN (SELECT COUNT(*) FROM games g 
                WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                AND g.season = ass.season 
                AND g.completed = true) > 0 
          THEN ass.defense_total_opportunities / (SELECT COUNT(*) FROM games g 
                                                 WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                                                 AND g.season = ass.season 
                                                 AND g.completed = true)
          ELSE ass.defense_total_opportunities
        END as defense_total_opportunities_per_game,
        
        -- Original stats (not per-game)
        ass.offense_plays,
        ass.defense_plays,
        ass.offense_drives,
        ass.defense_drives,
        ass.offense_total_opportunities,
        ass.defense_total_opportunities,
        ass.offense_points_per_opportunity,
        ass.defense_points_per_opportunity,
        
        -- Core efficiency metrics (already per-play/percentage)
        ass.offense_ppa,
        ass.defense_ppa,
        ass.offense_success_rate,
        ass.defense_success_rate,
        ass.offense_explosiveness,
        ass.defense_explosiveness,
        ass.offense_power_success,
        ass.defense_power_success,
        ass.offense_havoc_total,
        ass.defense_havoc_total,
        
        -- Passing stats
        ass.offense_passing_plays_rate,
        ass.defense_passing_plays_rate,
        ass.offense_passing_plays_ppa,
        ass.defense_passing_plays_ppa,
        ass.offense_passing_plays_success_rate,
        ass.defense_passing_plays_success_rate,
        ass.offense_passing_plays_explosiveness,
        ass.defense_passing_plays_explosiveness,
        
        -- Rushing stats
        ass.offense_rushing_plays_rate,
        ass.defense_rushing_plays_rate,
        ass.offense_rushing_plays_ppa,
        ass.defense_rushing_plays_ppa,
        ass.offense_rushing_plays_success_rate,
        ass.defense_rushing_plays_success_rate,
        ass.offense_rushing_plays_explosiveness,
        ass.defense_rushing_plays_explosiveness,
        
        -- Line metrics
        ass.offense_stuff_rate,
        ass.defense_stuff_rate,
        ass.offense_line_yards,
        ass.defense_line_yards,
        ass.offense_second_level_yards,
        ass.defense_second_level_yards,
        ass.offense_open_field_yards,
        ass.defense_open_field_yards
        
      FROM advanced_season_stats ass
      WHERE LOWER(TRIM(ass.team)) = LOWER(TRIM($1)) 
        AND ass.season = $2
      LIMIT 1
    `;
    
    const result = await pool.query(query, [teamName, season]);
    
    if (result.rows.length === 0) {
      console.log(`❌ No stats found for "${teamName}" in season ${season}`);
      return res.status(404).json({ error: `No stats found for ${teamName} in ${season}` });
    }
    
    const teamData = result.rows[0];
    console.log(`✅ Found stats for "${teamName}":`, {
      team: teamData.team,
      season: teamData.season,
      games_played: teamData.games_played
    });
    
    res.json(teamData);
  } catch (err) {
    console.error('Error fetching team stats:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Team Games Endpoint
app.get('/api/teams/:teamName/games', async (req, res) => {
  try {
    const { teamName } = req.params;
    const season = parseInt(req.query.season) || 2024;
    
    console.log(`🏈 Getting games for team: "${teamName}", season: ${season}`);
    
    // Get the actual team name from teams table (case-insensitive)
    const teamResult = await pool.query(`
      SELECT school, conference, classification, logo_url
      FROM teams 
      WHERE LOWER(school) = LOWER($1)
      LIMIT 1
    `, [teamName]);
    
    if (teamResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Team not found',
        requested_team: teamName
      });
    }
    
    const actualTeamName = teamResult.rows[0].school;
    console.log(`📝 Found team: "${actualTeamName}"`);
    
    // Get games using the actual team name
    const gamesResult = await pool.query(`
      SELECT 
        g.*,
        CASE 
          WHEN g.home_team = $1 THEN g.away_team
          ELSE g.home_team
        END as opponent,
        CASE 
          WHEN g.home_team = $1 THEN 'home'
          WHEN g.neutral_site = true THEN 'neutral'
          ELSE 'away'
        END as venue,
        -- Get opponent info
        opp_teams.conference as opponent_conference,
        opp_teams.logo_url as opponent_logo,
        -- Get opponent ratings if available
        opp_ratings.power_rating as opponent_rating
      FROM games g
      LEFT JOIN teams opp_teams ON opp_teams.school = CASE 
        WHEN g.home_team = $1 THEN g.away_team
        ELSE g.home_team
      END
      LEFT JOIN team_power_ratings opp_ratings ON opp_ratings.team_name = CASE 
        WHEN g.home_team = $1 THEN g.away_team
        ELSE g.home_team
      END AND opp_ratings.season = $2
      WHERE (g.home_team = $1 OR g.away_team = $1) 
        AND g.season = $2
      ORDER BY g.week, g.start_date
    `, [actualTeamName, season]);
    
    console.log(`📊 Found ${gamesResult.rows.length} games for ${actualTeamName} in ${season}`);
    
    res.json({
      team: actualTeamName,
      season: season,
      total_games: gamesResult.rows.length,
      games: gamesResult.rows.map(game => ({
        ...game,
        team_score: game.home_team === actualTeamName ? game.home_points : game.away_points,
        opponent_score: game.home_team === actualTeamName ? game.away_points : game.home_points,
        result: game.completed && game.home_points !== null && game.away_points !== null ? 
          (game.home_team === actualTeamName ? 
            (game.home_points > game.away_points ? 'W' : 
             game.home_points < game.away_points ? 'L' : 'T') :
            (game.away_points > game.home_points ? 'W' : 
             game.away_points < game.home_points ? 'L' : 'T')
          ) : null
      }))
    });
    
  } catch (err) {
    console.error('❌ Error getting team games:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      details: err.message 
    });
  }
});

// Replace the passing stats endpoint in server.js with this deduplicated version

app.get('/api/leaderboards/passing/:season', async (req, res) => {
  try {
    const { season } = req.params;
    const { 
      view_type = 'offense',      // offense or defense
      stat_type = 'total',        // total or per_game
      season_type = 'regular',    // regular or all
      conference_only = 'false',  // true or false
      conference = null           // specific conference filter
    } = req.query;
    
    console.log(`🏈 Fetching passing stats: ${view_type} ${stat_type} for ${season}`);
    
    // STEP 1: Build the base query with proper filters
    let baseQuery = `
      SELECT DISTINCT
        gts.team,
        gts.game_id,
        g.season_type,
        g.conference_game,
        gts.completions,
        gts.passing_attempts,
        gts.net_passing_yards,
        gts.passing_tds,
        gts.interceptions_thrown,
        gts.sacks
      FROM game_team_stats_new gts
      JOIN games g ON gts.game_id = g.id
      WHERE g.season = $1 
        AND g.completed = true
    `;
    
    const queryParams = [season];
    
    // Add season type filter
    if (season_type === 'regular') {
      baseQuery += ` AND g.season_type = 'regular'`;
    }
    
    // Add conference games filter
    if (conference_only === 'true') {
      baseQuery += ` AND g.conference_game = true`;
    }
    
    baseQuery += ` ORDER BY gts.team, gts.game_id`;
    
    console.log('🔍 Base query:', baseQuery);
    
    const allStatsResult = await pool.query(baseQuery, queryParams);
    const allStats = allStatsResult.rows;
    
    console.log(`📊 Found ${allStats.length} individual game records`);
    
    if (allStats.length === 0) {
      return res.json({
        teams: [],
        metadata: { season: parseInt(season), message: 'No game data found' }
      });
    }
    
    // STEP 2: Process data differently for offense vs defense
    let teamStatsMap = {};
    
    if (view_type === 'offense') {
      // OFFENSE: Aggregate each team's own stats
      allStats.forEach(stat => {
        if (!teamStatsMap[stat.team]) {
          teamStatsMap[stat.team] = {
            team: stat.team,
            games_played: 0,
            completions: 0,
            attempts: 0,
            net_passing_yards: 0,
            passing_touchdowns: 0,
            interceptions: 0,
            sacks_allowed: 0,
            game_ids: new Set()
          };
        }
        
        // Only count each game once per team
        if (!teamStatsMap[stat.team].game_ids.has(stat.game_id)) {
          teamStatsMap[stat.team].game_ids.add(stat.game_id);
          teamStatsMap[stat.team].games_played++;
          teamStatsMap[stat.team].completions += parseInt(stat.completions) || 0;
          teamStatsMap[stat.team].attempts += parseInt(stat.passing_attempts) || 0;
          teamStatsMap[stat.team].net_passing_yards += parseInt(stat.net_passing_yards) || 0;
          teamStatsMap[stat.team].passing_touchdowns += parseInt(stat.passing_tds) || 0;
          teamStatsMap[stat.team].interceptions += parseInt(stat.interceptions_thrown) || 0;
        }
      });
      
      // For offense sacks, we need to get opponent sacks against us
      const sackQuery = `
        SELECT DISTINCT
          opp_gts.team as opponent_team,
          our_gts.team as our_team,
          our_gts.game_id,
          opp_gts.sacks
        FROM game_team_stats_new our_gts
        JOIN game_team_stats_new opp_gts ON our_gts.game_id = opp_gts.game_id 
          AND opp_gts.team != our_gts.team
        JOIN games g ON our_gts.game_id = g.id
        WHERE g.season = $1 AND g.completed = true
        ${season_type === 'regular' ? "AND g.season_type = 'regular'" : ''}
        ${conference_only === 'true' ? "AND g.conference_game = true" : ''}
      `;
      
      const sackResult = await pool.query(sackQuery, queryParams);
      
      sackResult.rows.forEach(sackStat => {
        if (teamStatsMap[sackStat.our_team] && 
            teamStatsMap[sackStat.our_team].game_ids.has(sackStat.game_id)) {
          teamStatsMap[sackStat.our_team].sacks_allowed += parseInt(sackStat.sacks) || 0;
        }
      });
      
    } else {
      // DEFENSE: Get opponent stats (what we allowed)
      const gameTeamMap = {};
      
      // First, map which teams played in each game
      allStats.forEach(stat => {
        if (!gameTeamMap[stat.game_id]) {
          gameTeamMap[stat.game_id] = [];
        }
        gameTeamMap[stat.game_id].push(stat);
      });
      
      // Now aggregate opponent stats for each team
      Object.values(gameTeamMap).forEach(gameStats => {
        if (gameStats.length === 2) { // Make sure we have both teams
          const team1 = gameStats[0];
          const team2 = gameStats[1];
          
          // Team 1's defense allowed Team 2's offense
          if (!teamStatsMap[team1.team]) {
            teamStatsMap[team1.team] = {
              team: team1.team,
              games_played: 0,
              completions: 0,
              attempts: 0,
              net_passing_yards: 0,
              passing_touchdowns: 0,
              interceptions: 0,
              sacks_allowed: 0,
              game_ids: new Set()
            };
          }
          
          if (!teamStatsMap[team1.team].game_ids.has(team1.game_id)) {
            teamStatsMap[team1.team].game_ids.add(team1.game_id);
            teamStatsMap[team1.team].games_played++;
            teamStatsMap[team1.team].completions += parseInt(team2.completions) || 0;
            teamStatsMap[team1.team].attempts += parseInt(team2.passing_attempts) || 0;
            teamStatsMap[team1.team].net_passing_yards += parseInt(team2.net_passing_yards) || 0;
            teamStatsMap[team1.team].passing_touchdowns += parseInt(team2.passing_tds) || 0;
            teamStatsMap[team1.team].interceptions += parseInt(team2.interceptions_thrown) || 0;
            teamStatsMap[team1.team].sacks_allowed += parseInt(team1.sacks) || 0; // Our sacks
          }
          
          // Team 2's defense allowed Team 1's offense
          if (!teamStatsMap[team2.team]) {
            teamStatsMap[team2.team] = {
              team: team2.team,
              games_played: 0,
              completions: 0,
              attempts: 0,
              net_passing_yards: 0,
              passing_touchdowns: 0,
              interceptions: 0,
              sacks_allowed: 0,
              game_ids: new Set()
            };
          }
          
          if (!teamStatsMap[team2.team].game_ids.has(team2.game_id)) {
            teamStatsMap[team2.team].game_ids.add(team2.game_id);
            teamStatsMap[team2.team].games_played++;
            teamStatsMap[team2.team].completions += parseInt(team1.completions) || 0;
            teamStatsMap[team2.team].attempts += parseInt(team1.passing_attempts) || 0;
            teamStatsMap[team2.team].net_passing_yards += parseInt(team1.net_passing_yards) || 0;
            teamStatsMap[team2.team].passing_touchdowns += parseInt(team1.passing_tds) || 0;
            teamStatsMap[team2.team].interceptions += parseInt(team1.interceptions_thrown) || 0;
            teamStatsMap[team2.team].sacks_allowed += parseInt(team2.sacks) || 0; // Our sacks
          }
        }
      });
    }
    
    // STEP 3: Convert to array and get team info
    const rawStats = Object.values(teamStatsMap);
    console.log(`📊 Aggregated stats for ${rawStats.length} teams`);
    
    if (rawStats.length === 0) {
      return res.json({
        teams: [],
        metadata: { season: parseInt(season), message: 'No team stats found' }
      });
    }
    
    // STEP 4: Get team info (logos, conferences, etc.)
    const teamNames = rawStats.map(stat => stat.team);
    const teamInfoQuery = `
      SELECT school, conference, logo_url, color, alt_color, classification
      FROM teams 
      WHERE school = ANY($1) AND classification = 'fbs'
    `;
    
    const teamInfoResult = await pool.query(teamInfoQuery, [teamNames]);
    const teamInfoMap = {};
    teamInfoResult.rows.forEach(team => {
      teamInfoMap[team.school] = team;
    });
    
    console.log(`🏫 Found info for ${teamInfoResult.rows.length} FBS teams`);
    
    // STEP 5: Process final stats
    const processedTeams = rawStats
      .filter(stat => teamInfoMap[stat.team]) // Only FBS teams
      .map(stat => {
        const teamInfo = teamInfoMap[stat.team];
        const gamesPlayed = stat.games_played || 1;
        
        // Calculate derived stats
        const attempts = stat.attempts || 0;
        const completions = stat.completions || 0;
        const completion_percentage = attempts > 0 ? (completions / attempts) * 100 : 0;
        const yards_per_attempt = attempts > 0 ? stat.net_passing_yards / attempts : 0;
        
        // For per-game stats, divide by games played
        const divisor = stat_type === 'per_game' ? gamesPlayed : 1;
        
        return {
          team: stat.team,
          conference: teamInfo.conference || 'Unknown',
          logo_url: teamInfo.logo_url || 'https://a.espncdn.com/i/teamlogos/ncaa/500/default.png',
          primary_color: teamInfo.color,
          secondary_color: teamInfo.alt_color,
          games_played: gamesPlayed,
          completions: parseFloat((completions / divisor).toFixed(1)),
          attempts: parseFloat((attempts / divisor).toFixed(1)),
          completion_percentage: parseFloat(completion_percentage.toFixed(1)),
          passing_yards: parseFloat((stat.net_passing_yards / divisor).toFixed(1)),
          yards_per_attempt: parseFloat(yards_per_attempt.toFixed(2)),
          passing_touchdowns: parseFloat((stat.passing_touchdowns / divisor).toFixed(1)),
          interceptions: parseFloat((stat.interceptions / divisor).toFixed(1)),
          sacks_allowed: parseFloat((stat.sacks_allowed / divisor).toFixed(1))
        };
      });
    
    // STEP 6: Apply conference filter if specified
    let finalTeams = processedTeams;
    if (conference && conference !== 'all') {
      finalTeams = processedTeams.filter(team => team.conference === conference);
    }
    
    console.log(`✅ Returning ${finalTeams.length} teams with realistic stats`);
    
    res.json({
      teams: finalTeams,
      metadata: {
        season: parseInt(season),
        view_type,
        stat_type,
        season_type,
        conference_only: conference_only === 'true',
        conference,
        total_teams: finalTeams.length,
        generated_at: new Date().toISOString()
      }
    });
    
  } catch (err) {
    console.error('❌ Error in passing stats endpoint:', err);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: err.message,
      endpoint: '/api/leaderboards/passing/:season'
    });
  }
});

// Add this endpoint to your server.js file

// Rushing Stats Leaderboard Endpoint
app.get('/api/leaderboards/rushing/:season', async (req, res) => {
  try {
    const { season } = req.params;
    const { 
      offense_defense = 'offense',
      conference = null,
      conference_games_only = 'false',
      regular_season_only = 'false'
    } = req.query;
    
    console.log(`🏃 Fetching rushing stats for ${season}, ${offense_defense}`);
    
    // FIXED: Add DISTINCT to prevent duplicate counting from multiple game records
    let query = `
      SELECT DISTINCT ON (gts.team)
        gts.team as team_name,
        t.logo_url,
        t.conference,
        t.abbreviation,
        t.classification,
        
        -- Count games properly using subquery to avoid duplicates
        (SELECT COUNT(DISTINCT g2.id) 
         FROM games g2 
         WHERE (g2.home_team = gts.team OR g2.away_team = gts.team) 
         AND g2.season = $1
         ${conference_games_only === 'true' ? ' AND g2.conference_game = true' : ''}
         ${regular_season_only === 'true' ? ' AND g2.season_type = \'regular\'' : ''}
        ) as games_played,
        
        -- Aggregate stats with proper deduplication
        (SELECT SUM(sub_gts.rushing_attempts) 
         FROM game_team_stats_new sub_gts
         JOIN games sub_g ON sub_gts.game_id = sub_g.id
         WHERE sub_gts.team = gts.team 
         AND sub_g.season = $1
         ${conference_games_only === 'true' ? ' AND sub_g.conference_game = true' : ''}
         ${regular_season_only === 'true' ? ' AND sub_g.season_type = \'regular\'' : ''}
        ) as rushing_attempts,
        
        (SELECT SUM(sub_gts.rushing_yards) 
         FROM game_team_stats_new sub_gts
         JOIN games sub_g ON sub_gts.game_id = sub_g.id
         WHERE sub_gts.team = gts.team 
         AND sub_g.season = $1
         ${conference_games_only === 'true' ? ' AND sub_g.conference_game = true' : ''}
         ${regular_season_only === 'true' ? ' AND sub_g.season_type = \'regular\'' : ''}
        ) as rushing_yards,
        
        (SELECT SUM(sub_gts.rushing_tds) 
         FROM game_team_stats_new sub_gts
         JOIN games sub_g ON sub_gts.game_id = sub_g.id
         WHERE sub_gts.team = gts.team 
         AND sub_g.season = $1
         ${conference_games_only === 'true' ? ' AND sub_g.conference_game = true' : ''}
         ${regular_season_only === 'true' ? ' AND sub_g.season_type = \'regular\'' : ''}
        ) as rushing_tds,
        
        -- Calculate yards per rush using subqueries
        CASE 
          WHEN (SELECT SUM(sub_gts.rushing_attempts) 
                FROM game_team_stats_new sub_gts
                JOIN games sub_g ON sub_gts.game_id = sub_g.id
                WHERE sub_gts.team = gts.team 
                AND sub_g.season = $1
                ${conference_games_only === 'true' ? ' AND sub_g.conference_game = true' : ''}
                ${regular_season_only === 'true' ? ' AND sub_g.season_type = \'regular\'' : ''}
               ) > 0 
          THEN ROUND(
            (SELECT SUM(sub_gts.rushing_yards) 
             FROM game_team_stats_new sub_gts
             JOIN games sub_g ON sub_gts.game_id = sub_g.id
             WHERE sub_gts.team = gts.team 
             AND sub_g.season = $1
             ${conference_games_only === 'true' ? ' AND sub_g.conference_game = true' : ''}
             ${regular_season_only === 'true' ? ' AND sub_g.season_type = \'regular\'' : ''}
            )::numeric / 
            (SELECT SUM(sub_gts.rushing_attempts) 
             FROM game_team_stats_new sub_gts
             JOIN games sub_g ON sub_gts.game_id = sub_g.id
             WHERE sub_gts.team = gts.team 
             AND sub_g.season = $1
             ${conference_games_only === 'true' ? ' AND sub_g.conference_game = true' : ''}
             ${regular_season_only === 'true' ? ' AND sub_g.season_type = \'regular\'' : ''}
            )::numeric, 2)
          ELSE 0 
        END as yards_per_rush,
        
        -- Calculate total plays using subqueries
        (SELECT SUM(sub_gts.passing_attempts + sub_gts.rushing_attempts) 
         FROM game_team_stats_new sub_gts
         JOIN games sub_g ON sub_gts.game_id = sub_g.id
         WHERE sub_gts.team = gts.team 
         AND sub_g.season = $1
         ${conference_games_only === 'true' ? ' AND sub_g.conference_game = true' : ''}
         ${regular_season_only === 'true' ? ' AND sub_g.season_type = \'regular\'' : ''}
        ) as total_plays,
        
        -- Rushing rate calculation using subqueries  
        CASE 
          WHEN (SELECT SUM(sub_gts.passing_attempts + sub_gts.rushing_attempts) 
                FROM game_team_stats_new sub_gts
                JOIN games sub_g ON sub_gts.game_id = sub_g.id
                WHERE sub_gts.team = gts.team 
                AND sub_g.season = $1
                ${conference_games_only === 'true' ? ' AND sub_g.conference_game = true' : ''}
                ${regular_season_only === 'true' ? ' AND sub_g.season_type = \'regular\'' : ''}
               ) > 0 
          THEN ROUND(
            ((SELECT SUM(sub_gts.rushing_attempts) 
              FROM game_team_stats_new sub_gts
              JOIN games sub_g ON sub_gts.game_id = sub_g.id
              WHERE sub_gts.team = gts.team 
              AND sub_g.season = $1
              ${conference_games_only === 'true' ? ' AND sub_g.conference_game = true' : ''}
              ${regular_season_only === 'true' ? ' AND sub_g.season_type = \'regular\'' : ''}
             )::numeric / 
             (SELECT SUM(sub_gts.passing_attempts + sub_gts.rushing_attempts) 
              FROM game_team_stats_new sub_gts
              JOIN games sub_g ON sub_gts.game_id = sub_g.id
              WHERE sub_gts.team = gts.team 
              AND sub_g.season = $1
              ${conference_games_only === 'true' ? ' AND sub_g.conference_game = true' : ''}
              ${regular_season_only === 'true' ? ' AND sub_g.season_type = \'regular\'' : ''}
             )::numeric) * 100, 1)
          ELSE 0 
        END as rushing_rate
        
      FROM game_team_stats_new gts
      JOIN games g ON gts.game_id = g.id
      LEFT JOIN teams t ON LOWER(TRIM(t.school)) = LOWER(TRIM(gts.team))url,
        t.conference,
        t.abbreviation,
        t.classification,
        COUNT(DISTINCT g.id) as games_played,
        
        -- Basic rushing stats (sum across all games)
        SUM(gts.rushing_attempts) as rushing_attempts,
        SUM(gts.rushing_yards) as rushing_yards, 
        SUM(gts.rushing_tds) as rushing_tds,
        
        -- Calculate yards per rush (total yards / total attempts)
        CASE 
          WHEN SUM(gts.rushing_attempts) > 0 
          THEN ROUND(SUM(gts.rushing_yards)::numeric / SUM(gts.rushing_attempts)::numeric, 2)
          ELSE 0 
        END as yards_per_rush,
        
        -- Calculate total plays and rushing rate
        SUM(gts.passing_attempts + gts.rushing_attempts) as total_plays,
        
        -- Rushing rate: rushing_attempts / total_plays * 100
        CASE 
          WHEN SUM(gts.passing_attempts + gts.rushing_attempts) > 0 
          THEN ROUND((SUM(gts.rushing_attempts)::numeric / SUM(gts.passing_attempts + gts.rushing_attempts)::numeric) * 100, 1)
          ELSE 0 
        END as rushing_rate
        
      FROM game_team_stats_new gts
      JOIN games g ON gts.game_id = g.id
      LEFT JOIN teams t ON LOWER(TRIM(t.school)) = LOWER(TRIM(gts.team))
    `;
    
    // Build WHERE conditions - FILTER FOR FBS TEAMS ONLY
    const conditions = [`g.season = $1`, `t.classification = 'fbs'`];
    const params = [season];
    let paramIndex = 2;
    
    // Conference filter
    if (conference && conference !== 'all') {
      conditions.push(`t.conference = $${paramIndex}`);
      params.push(conference);
      paramIndex++;
    }
    
    // Conference games only filter
    if (conference_games_only === 'true') {
      conditions.push(`g.conference_game = true`);
    }
    
    // Regular season only filter  
    if (regular_season_only === 'true') {
      conditions.push(`g.season_type = 'regular'`);
    }
    
    // Add WHERE clause with FBS filter
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    // Group by team and conference
    query += `
      GROUP BY gts.team, t.logo_url, t.conference, t.abbreviation, t.classification
      HAVING SUM(gts.rushing_attempts) > 0
      ORDER BY rushing_rate DESC
    `;
    
    console.log(`🔍 Executing rushing query with ${params.length} parameters:`, params);
    console.log(`📝 Query preview:`, query.substring(0, 200) + '...');
    
    const result = await pool.query(query, params);
    let teams = result.rows;
    
    console.log(`📊 Found ${teams.length} teams with rushing data`);
    
    if (teams.length === 0) {
      console.log(`⚠️ No teams found - checking if data exists in tables...`);
      
      // Quick debug query to see if data exists
      const debugResult = await pool.query(`
        SELECT COUNT(*) as total_games, COUNT(DISTINCT gts.team) as unique_teams
        FROM game_team_stats_new gts 
        JOIN games g ON gts.game_id = g.id 
        LEFT JOIN teams t ON LOWER(TRIM(t.school)) = LOWER(TRIM(gts.team))
        WHERE g.season = $1
      `, [season]);
      
      console.log(`🔍 Debug - Total games: ${debugResult.rows[0]?.total_games}, Unique teams: ${debugResult.rows[0]?.unique_teams}`);
      
      return res.json([]);
    }
    
    // Handle defense stats by switching to opponent stats - SIMPLIFIED WITH FBS FILTER
    if (offense_defense === 'defense') {
      console.log(`🛡️ Converting to defense stats (opponent rushing allowed) - FBS ONLY`);
      
      // Simpler approach: Get what opponents did AGAINST each FBS team
      let defenseQuery = `
        SELECT 
          defending_team as team_name,
          t.logo_url,
          t.conference, 
          t.abbreviation,
          t.classification,
          COUNT(DISTINCT g.id) as games_played,
          SUM(gts.rushing_attempts) as rushing_attempts,
          SUM(gts.rushing_yards) as rushing_yards,
          SUM(gts.rushing_tds) as rushing_tds,
          CASE 
            WHEN SUM(gts.rushing_attempts) > 0 
            THEN ROUND(SUM(gts.rushing_yards)::numeric / SUM(gts.rushing_attempts)::numeric, 2)
            ELSE 0 
          END as yards_per_rush,
          SUM(gts.passing_attempts + gts.rushing_attempts) as total_plays,
          CASE 
            WHEN SUM(gts.passing_attempts + gts.rushing_attempts) > 0 
            THEN ROUND((SUM(gts.rushing_attempts)::numeric / SUM(gts.passing_attempts + gts.rushing_attempts)::numeric) * 100, 1)
            ELSE 0 
          END as rushing_rate
        FROM (
          SELECT 
            gts.*,
            g.*,
            CASE 
              WHEN g.home_team = gts.team THEN g.away_team
              ELSE g.home_team 
            END as defending_team
          FROM game_team_stats_new gts
          JOIN games g ON gts.game_id = g.id
          WHERE g.season = $1
            ${conference_games_only === 'true' ? ' AND g.conference_game = true' : ''}
            ${regular_season_only === 'true' ? ' AND g.season_type = \'regular\'' : ''}
        ) defense_data
        LEFT JOIN teams t ON LOWER(TRIM(t.school)) = LOWER(TRIM(defense_data.defending_team))
        WHERE t.classification = 'fbs'
        ${conference && conference !== 'all' ? ' AND t.conference = $2' : ''}
        GROUP BY defending_team, t.logo_url, t.conference, t.abbreviation, t.classification
        HAVING SUM(defense_data.rushing_attempts) > 0
        ORDER BY yards_per_rush ASC
      `; // Defense: lower yards per rush is better
      
      const defenseResult = await pool.query(defenseQuery, params);
      teams = defenseResult.rows;
      
      console.log(`🛡️ Processed ${teams.length} FBS teams for defense stats`);
    }
    
    // Clean up data and ensure proper types
    const processedTeams = teams.map(team => ({
      team_name: team.team_name,
      logo_url: team.logo_url || 'https://a.espncdn.com/i/teamlogos/ncaa/500/default.png',
      conference: team.conference || 'Unknown',
      abbreviation: team.abbreviation || team.team_name?.substring(0, 4).toUpperCase(),
      games_played: parseInt(team.games_played) || 0,
      rushing_attempts: parseInt(team.rushing_attempts) || 0,
      rushing_yards: parseInt(team.rushing_yards) || 0,
      rushing_tds: parseInt(team.rushing_tds) || 0,
      yards_per_rush: parseFloat(team.yards_per_rush) || 0,
      total_plays: parseInt(team.total_plays) || 0,
      rushing_rate: parseFloat(team.rushing_rate) || 0
    }));
    
    console.log(`✅ Returning ${processedTeams.length} teams for ${offense_defense} rushing stats`);
    
    // Return consistent format - just the array of teams
    res.json(processedTeams);
    
  } catch (err) {
    console.error('❌ Error fetching rushing stats:', err);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: err.message 
    });

// Simple debug endpoint for rushing stats
app.get('/api/debug/rushing/:season', async (req, res) => {
  try {
    const { season } = req.params;
    
    console.log(`🔍 Debug rushing endpoint for season ${season}`);
    
    // Test basic data availability
    const testQuery = `
      SELECT 
        gts.team,
        COUNT(*) as game_count,
        SUM(gts.rushing_attempts) as total_rushing_attempts,
        SUM(gts.rushing_yards) as total_rushing_yards
      FROM game_team_stats_new gts
      JOIN games g ON gts.game_id = g.id
      WHERE g.season = $1
      GROUP BY gts.team
      ORDER BY total_rushing_yards DESC
      LIMIT 10
    `;
    
    const result = await pool.query(testQuery, [season]);
    
    res.json({
      season: season,
      message: `Found ${result.rows.length} teams with rushing data`,
      sample_teams: result.rows,
      query_used: testQuery
    });
    
  } catch (err) {
    console.error('❌ Debug rushing error:', err);
    res.status(500).json({ 
      error: 'Debug endpoint failed', 
      details: err.message 
    });
  }
});
  }
});
// 🔧 STEP 2: Remove debug info from TeamPage component

// In your TeamPage.js, find and DELETE these lines (around where you have the debug component):

/* DELETE THIS SECTION:
        // DEBUG INFO - Temporary 
        <GamesDebugInfo games={games} />
*/

// Also DELETE the GamesDebugInfo component definition:

/* DELETE THIS ENTIRE COMPONENT:
  const GamesDebugInfo = ({ games }) => {
    if (!games) return <div>Games is null/undefined</div>;
    if (!Array.isArray(games)) return <div>Games is not an array: {typeof games}</div>;
    
    return (
      <div style={{ 
        backgroundColor: '#f0f0f0', 
        padding: '10px', 
        margin: '10px 0',
        borderRadius: '4px',
        fontFamily: 'monospace'
      }}>
        <strong>🐛 DEBUG INFO:</strong><br/>
        Games array length: {games.length}<br/>
        {games.length > 0 && (
          <>
            First game keys: {Object.keys(games[0]).join(', ')}<br/>
            First game: {JSON.stringify(games[0], null, 2).substring(0, 200)}...
          </>
        )}
      </div>
    );
  };
*/

// 🔧 STEP 3: Test if you have the required tables

// Add this temporary debug endpoint to check your database structure:
app.get('/api/debug-tables', async (req, res) => {
  try {
    // Check what tables exist
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    const tables = tablesResult.rows.map(row => row.table_name);
    
    // Check if PPA tables exist and have data
    let ppaTableInfo = {};
    if (tables.includes('advanced_game_stats')) {
      const ppaCount = await pool.query(`
        SELECT COUNT(*) as count, COUNT(offense_ppa) as ppa_count
        FROM advanced_game_stats 
        WHERE season = 2024
      `);
      ppaTableInfo.advanced_game_stats = ppaCount.rows[0];
    }
    
    // Check betting lines table
    let bettingTableInfo = {};
    if (tables.includes('game_betting_lines')) {
      const bettingCount = await pool.query(`
        SELECT COUNT(*) as count, COUNT(DISTINCT provider) as providers
        FROM game_betting_lines
      `);
      bettingTableInfo.game_betting_lines = bettingCount.rows[0];
    }
    
    res.json({
      all_tables: tables,
      has_advanced_game_stats: tables.includes('advanced_game_stats'),
      has_game_betting_lines: tables.includes('game_betting_lines'),
      ppa_data: ppaTableInfo,
      betting_data: bettingTableInfo
    });
    
  } catch (err) {
    res.json({ error: err.message });
  }
});

app.get('/api/all-advanced-stats/:season', async (req, res) => {
  try {
    const { season } = req.params;
    
    console.log(`🔍 Fetching all advanced stats with per-game calculations for season ${season}`);
    
    const query = `
      SELECT DISTINCT ON (ass.team)
        ass.team as team_name,
        ass.season,
        
        -- Calculate games played for each team
        (SELECT COUNT(*) FROM games g 
         WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
         AND g.season = ass.season 
         AND g.completed = true) as games_played,
        
        -- Per-game stats (divide by games played)
        CASE 
          WHEN (SELECT COUNT(*) FROM games g 
                WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                AND g.season = ass.season 
                AND g.completed = true) > 0 
          THEN ass.offense_plays / (SELECT COUNT(*) FROM games g 
                                   WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                                   AND g.season = ass.season 
                                   AND g.completed = true)
          ELSE ass.offense_plays
        END as offense_plays_per_game,
        
        CASE 
          WHEN (SELECT COUNT(*) FROM games g 
                WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                AND g.season = ass.season 
                AND g.completed = true) > 0 
          THEN ass.defense_plays / (SELECT COUNT(*) FROM games g 
                                   WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                                   AND g.season = ass.season 
                                   AND g.completed = true)
          ELSE ass.defense_plays
        END as defense_plays_per_game,
        
        CASE 
          WHEN (SELECT COUNT(*) FROM games g 
                WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                AND g.season = ass.season 
                AND g.completed = true) > 0 
          THEN ass.offense_drives / (SELECT COUNT(*) FROM games g 
                                    WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                                    AND g.season = ass.season 
                                    AND g.completed = true)
          ELSE ass.offense_drives
        END as offense_drives_per_game,
        
        CASE 
          WHEN (SELECT COUNT(*) FROM games g 
                WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                AND g.season = ass.season 
                AND g.completed = true) > 0 
          THEN ass.defense_drives / (SELECT COUNT(*) FROM games g 
                                    WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                                    AND g.season = ass.season 
                                    AND g.completed = true)
          ELSE ass.defense_drives
        END as defense_drives_per_game,
        
        CASE 
          WHEN (SELECT COUNT(*) FROM games g 
                WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                AND g.season = ass.season 
                AND g.completed = true) > 0 
          THEN ass.offense_total_opportunities / (SELECT COUNT(*) FROM games g 
                                                 WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                                                 AND g.season = ass.season 
                                                 AND g.completed = true)
          ELSE ass.offense_total_opportunities
        END as offense_total_opportunities_per_game,
        
        CASE 
          WHEN (SELECT COUNT(*) FROM games g 
                WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                AND g.season = ass.season 
                AND g.completed = true) > 0 
          THEN ass.defense_total_opportunities / (SELECT COUNT(*) FROM games g 
                                                 WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                                                 AND g.season = ass.season 
                                                 AND g.completed = true)
          ELSE ass.defense_total_opportunities
        END as defense_total_opportunities_per_game,
        
        -- Original totals (for reference)
        ass.offense_plays,
        ass.defense_plays,
        ass.offense_drives,
        ass.defense_drives,
        ass.offense_total_opportunities,
        ass.defense_total_opportunities,
        ass.offense_points_per_opportunity,
        ass.defense_points_per_opportunity,
        
        -- Core efficiency metrics (already per-play/percentage)
        ass.offense_ppa,
        ass.defense_ppa,
        ass.offense_success_rate,
        ass.defense_success_rate,
        ass.offense_explosiveness,
        ass.defense_explosiveness,
        ass.offense_power_success,
        ass.defense_power_success,
        ass.offense_havoc_total,
        ass.defense_havoc_total,
        
        -- Passing stats
        ass.offense_passing_plays_rate,
        ass.defense_passing_plays_rate,
        ass.offense_passing_plays_ppa,
        ass.defense_passing_plays_ppa,
        ass.offense_passing_plays_success_rate,
        ass.defense_passing_plays_success_rate,
        ass.offense_passing_plays_explosiveness,
        ass.defense_passing_plays_explosiveness,
        
        -- Rushing stats
        ass.offense_rushing_plays_rate,
        ass.defense_rushing_plays_rate,
        ass.offense_rushing_plays_ppa,
        ass.defense_rushing_plays_ppa,
        ass.offense_rushing_plays_success_rate,
        ass.defense_rushing_plays_success_rate,
        ass.offense_rushing_plays_explosiveness,
        ass.defense_rushing_plays_explosiveness,
        
        -- Line metrics
        ass.offense_stuff_rate,
        ass.defense_stuff_rate,
        ass.offense_line_yards,
        ass.defense_line_yards,
        ass.offense_second_level_yards,
        ass.defense_second_level_yards,
        ass.offense_open_field_yards,
        ass.defense_open_field_yards
        
      FROM advanced_season_stats ass
      WHERE ass.season = $1
      ORDER BY ass.team, ass.season DESC
    `;
    
    const result = await pool.query(query, [season]);
    
    console.log(`✅ Found ${result.rows.length} UNIQUE teams with per-game calculations for season ${season}`);
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('❌ Error fetching all advanced stats:', error);
    res.status(500).json({ error: 'Failed to fetch advanced stats', details: error.message });
  }
});

// Debug teams endpoint
app.get('/api/debug-teams', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_teams,
        COUNT(CASE WHEN classification = 'fbs' THEN 1 END) as fbs_teams,
        COUNT(CASE WHEN logo_url IS NOT NULL THEN 1 END) as teams_with_logos,
        COUNT(CASE WHEN conference IS NOT NULL THEN 1 END) as teams_with_conference
      FROM teams
    `);
    
    const sampleTeams = await pool.query(`
      SELECT school, mascot, conference, classification, logo_url 
      FROM teams 
      WHERE classification = 'fbs'
      ORDER BY school 
      LIMIT 5
    `);
    
    const powerRatingsCount = await pool.query(`
      SELECT COUNT(*) as teams_with_power_ratings
      FROM team_power_ratings
      WHERE power_rating IS NOT NULL
    `);
    
    res.json({
      database: process.env.DB_NAME || process.env.DB_DATABASE,
      teamsTableStats: stats.rows[0],
      powerRatingsCount: powerRatingsCount.rows[0],
      sampleTeams: sampleTeams.rows
    });
  } catch (err) {
    console.error('Error in debug:', err);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'CFB API is running',
    database: process.env.DB_NAME || process.env.DB_DATABASE,
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint to check table structure
app.get('/api/debug-columns', async (req, res) => {
  try {
    const columns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'team_power_ratings'
      ORDER BY ordinal_position
    `);
    
    const sample = await pool.query('SELECT * FROM team_power_ratings LIMIT 1');
    
    res.json({
      columns: columns.rows.map(col => col.column_name),
      column_details: columns.rows,
      sample_row: sample.rows[0] || null,
      has_season_column: columns.rows.some(col => col.column_name === 'season'),
      has_year_column: columns.rows.some(col => col.column_name === 'year')
    });
    
  } catch (err) {
    res.json({ 
      error: err.message,
      code: err.code
    });
  }
});

// Strength of Schedule Enhanced Endpoint
app.get('/api/leaderboards/strength-of-schedule-enhanced/:season', async (req, res) => {
  try {
    const { season } = req.params;
    const { 
      conferenceOnly = 'false', 
      includePostseason = 'false',
      classification = 'fbs' 
    } = req.query;
    
    console.log(`🔍 Calculating SOS for ${season}, classification: ${classification}`);
    
    // Get all teams with their power ratings for the season
    const teamsQuery = `
      SELECT DISTINCT
        t.school as team,
        t.conference,
        t.classification,
        t.logo_url,
        t.abbreviation,
        COALESCE(tpr.power_rating, 0) as team_rating
      FROM teams t
      LEFT JOIN team_power_ratings tpr ON LOWER(TRIM(t.school)) = LOWER(TRIM(tpr.team_name))
        AND tpr.season = $1
      WHERE t.classification = $2 OR $2 = 'all'
      ORDER BY t.school
    `;
    
    const teamsResult = await pool.query(teamsQuery, [season, classification]);
    const teams = teamsResult.rows;
    
    console.log(`📊 Found ${teams.length} teams for ${classification} in ${season}`);
    
    if (teams.length === 0) {
      return res.status(404).json({ 
        error: `No teams found for ${classification} in ${season}` 
      });
    }
    
    // Calculate SOS for each team
    const sosData = [];
    
    for (const team of teams) {
      console.log(`⚙️ Calculating SOS for ${team.team}`);
      
      // Get all games for this team
      let gamesQuery = `
        SELECT 
          g.*,
          CASE 
            WHEN g.home_team = $1 THEN g.away_team
            ELSE g.home_team
          END as opponent,
          CASE 
            WHEN g.home_team = $1 THEN 'home'
            ELSE 'away'
          END as venue
        FROM games g
        WHERE (g.home_team = $1 OR g.away_team = $1) 
          AND g.season = $2
      `;
      
      const queryParams = [team.team, season];
      
      // Add filters based on query parameters
      if (conferenceOnly === 'true') {
        gamesQuery += ` AND g.conference_game = true`;
      }
      
      if (includePostseason === 'false') {
        gamesQuery += ` AND g.season_type = 'regular'`;
      }
      
      gamesQuery += ` ORDER BY g.week`;
      
      const gamesResult = await pool.query(gamesQuery, queryParams);
      const games = gamesResult.rows;
      
      // Separate completed and future games
      const completedGames = games.filter(g => g.completed === true);
      const futureGames = games.filter(g => g.completed === false);
      
      // Calculate SOS for completed games (SOS Played)
      let sosPlayed = 0;
      let playedOpponentCount = 0;
      let actualWins = 0;
      let actualLosses = 0;
      let projectedWins = 0;
      let top40Wins = 0;
      let top40Games = 0;
      let coinflipGames = 0;
      let sureThingGames = 0;
      let longshotGames = 0;
      
      for (const game of completedGames) {
        // Get opponent's power rating
        const opponentRating = await pool.query(`
          SELECT power_rating 
          FROM team_power_ratings 
          WHERE LOWER(TRIM(team_name)) = LOWER(TRIM($1)) 
            AND season = $2
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
        
        if (teamScore > oppScore) {
          actualWins++;
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
        
        // Calculate win probability for this game (simplified)
        if (opponentRating.rows.length > 0) {
          const teamRating = parseFloat(team.team_rating);
          const oppRating = parseFloat(opponentRating.rows[0].power_rating);
          const homeAdvantage = game.venue === 'home' ? 2.15 : -2.15;
          const ratingDiff = teamRating - oppRating + homeAdvantage;
          
          // Using normal distribution to calculate win probability
          const winProb = normalCDF(ratingDiff, 0, 13.5);
          projectedWins += winProb;
          
          // Categorize game difficulty
          if (winProb >= 0.4 && winProb <= 0.6) coinflipGames++;
          else if (winProb >= 0.8) sureThingGames++;
          else if (winProb <= 0.2) longshotGames++;
        }
      }
      
      // Calculate SOS for remaining games (SOS Remaining)
      let sosRemaining = 0;
      let remainingOpponentCount = 0;
      
      for (const game of futureGames) {
        const opponentRating = await pool.query(`
          SELECT power_rating 
          FROM team_power_ratings 
          WHERE LOWER(TRIM(team_name)) = LOWER(TRIM($1)) 
            AND season = $2
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
      const avgSOSOverall = totalOpponents > 0 ? 
        (sosPlayed + sosRemaining) / totalOpponents : 0;
      
      sosData.push({
        team: team.team,
        conference: team.conference,
        classification: team.classification,
        logo_url: team.logo_url,
        abbreviation: team.abbreviation,
        team_rating: team.team_rating,
        sos_overall: avgSOSOverall.toFixed(3),
        sos_played: avgSOSPlayed.toFixed(3),
        sos_remaining: avgSOSRemaining.toFixed(3),
        actual_wins: actualWins,
        actual_losses: actualLosses,
        projected_wins: projectedWins.toFixed(1),
        win_difference: actualWins - projectedWins,
        top40_record: `${top40Wins}-${top40Games - top40Wins}`,
        top40_games: top40Games,
        coinflip_games: coinflipGames,
        sure_thing_games: sureThingGames,
        longshot_games: longshotGames,
        games_played: completedGames.length,
        games_remaining: futureGames.length
      });
    }
    
    // Sort by overall SOS (higher is harder)
    sosData.sort((a, b) => parseFloat(b.sos_overall) - parseFloat(a.sos_overall));
    
    // Add SOS rankings
    sosData.forEach((team, index) => {
      team.sos_rank = index + 1;
    });
    
    console.log(`✅ Calculated SOS for ${sosData.length} teams`);
    
    res.json({
      teams: sosData,
      metadata: {
        season: season,
        classification: classification,
        total_teams: sosData.length,
        conference_only: conferenceOnly === 'true',
        include_postseason: includePostseason === 'true',
        generated_at: new Date().toISOString()
      }
    });
    
  } catch (err) {
    console.error('❌ Error calculating SOS:', err);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: err.message 
    });
  }
});

// Luck Leaderboard Endpoint
app.get('/api/leaderboards/luck/:season', async (req, res) => {
  try {
    const { season } = req.params;
    const { 
      includePostseason = 'false', 
      conferenceOnly = 'false',
      conference = null 
    } = req.query;
    
    console.log(`🍀 Calculating luck data for ${season}`);
    
    // Get all teams with their power ratings for the season
    const teamsQuery = `
      SELECT DISTINCT
        t.school as team,
        t.conference,
        t.classification,
        t.logo_url,
        t.abbreviation,
        COALESCE(tpr.power_rating, 0) as team_rating,
        (SELECT COUNT(*) + 1 FROM team_power_ratings tpr2 
         WHERE tpr2.power_rating > tpr.power_rating AND tpr2.season = $1) as power_rank
      FROM teams t
      LEFT JOIN team_power_ratings tpr ON LOWER(TRIM(t.school)) = LOWER(TRIM(tpr.team_name))
        AND tpr.season = $1
      WHERE t.classification = 'fbs'
      ${conference ? 'AND t.conference = $2' : ''}
      ORDER BY t.school
    `;
    
    const queryParams = [season];
    if (conference) queryParams.push(conference);
    
    const teamsResult = await pool.query(teamsQuery, queryParams);
    const teams = teamsResult.rows;
    
    console.log(`📊 Found ${teams.length} teams for luck calculation`);
    
    if (teams.length === 0) {
      return res.status(404).json({ 
        error: `No teams found for ${season}` 
      });
    }
    
    // Calculate luck metrics for each team
    const luckData = [];
    
    for (const team of teams) {
      console.log(`🎲 Calculating luck for ${team.team}`);
      
      // Get all games for this team
      let gamesQuery = `
        SELECT 
          g.*,
          CASE 
            WHEN g.home_team = $1 THEN g.away_team
            ELSE g.home_team
          END as opponent,
          CASE 
            WHEN g.home_team = $1 THEN 'home'
            ELSE 'away'
          END as venue
        FROM games g
        WHERE (g.home_team = $1 OR g.away_team = $1) 
          AND g.season = $2
          AND g.completed = true
      `;
      
      const gameQueryParams = [team.team, season];
      
      // Add filters based on query parameters
      if (conferenceOnly === 'true') {
        gamesQuery += ` AND g.conference_game = true`;
      }
      
      if (includePostseason === 'false') {
        gamesQuery += ` AND g.season_type = 'regular'`;
      }
      
      gamesQuery += ` ORDER BY g.week`;
      
      const gamesResult = await pool.query(gamesQuery, gameQueryParams);
      const games = gamesResult.rows;
      
      // Initialize counters
      let actualWins = 0;
      let actualLosses = 0;
      let expectedWins = 0;
      let deservedWins = 0;
      let closeGameWins = 0;
      let closeGameTotal = 0;
      let totalFumbles = 0;
      let teamFumbleRecoveries = 0;
      let totalInterceptions = 0;
      let teamInterceptions = 0;
      let turnovers = 0;
      let takeaways = 0;
      
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
        
        // Expected wins (from betting lines)
        if (game.home_moneyline && game.away_moneyline) {
          const homeProb = moneylineToProbability(game.home_moneyline);
          const awayProb = moneylineToProbability(game.away_moneyline);
          
          if (homeProb && awayProb) {
            const totalProb = homeProb + awayProb;
            const homeAdjusted = homeProb / totalProb;
            const awayAdjusted = awayProb / totalProb;
            
            const teamProb = game.venue === 'home' ? homeAdjusted : awayAdjusted;
            expectedWins += teamProb;
          }
        } else if (game.spread) {
          const spreadValue = parseFloat(game.spread);
          const adjustedSpread = game.venue === 'home' ? spreadValue : -spreadValue;
          const winProb = normalCDF(-adjustedSpread, 0, 13.5);
          expectedWins += winProb;
        }
        
        // Deserved wins (from postgame win probability)
        const postgameProb = game.venue === 'home' 
          ? parseFloat(game.home_postgame_win_probability)
          : parseFloat(game.away_postgame_win_probability);
        
        if (postgameProb) {
          deservedWins += postgameProb;
        }
        
        // Get game stats for turnover luck (if available)
        const gameStatsQuery = `
          SELECT 
            team,
            fumbles_lost,
            fumbles_recovered,
            interceptions
          FROM game_stats
          WHERE game_id = $1 AND (team = $2 OR team = $3)
        `;
        
        try {
          const gameStatsResult = await pool.query(gameStatsQuery, [
            game.id, 
            team.team, 
            game.opponent
          ]);
          
          const teamStats = gameStatsResult.rows.find(s => s.team === team.team);
          const oppStats = gameStatsResult.rows.find(s => s.team === game.opponent);
          
          if (teamStats && oppStats) {
            // Fumble luck
            const gameFumbles = (teamStats.fumbles_lost || 0) + (oppStats.fumbles_lost || 0);
            const teamRecoveries = (oppStats.fumbles_lost || 0); // Team recovers opponent fumbles
            totalFumbles += gameFumbles;
            teamFumbleRecoveries += teamRecoveries;
            
            // Interception luck
            const gameInterceptions = (teamStats.interceptions || 0) + (oppStats.interceptions || 0);
            totalInterceptions += gameInterceptions;
            teamInterceptions += (teamStats.interceptions || 0);
            
            // Turnover margin
            turnovers += (teamStats.fumbles_lost || 0);
            takeaways += (teamStats.interceptions || 0) + (oppStats.fumbles_lost || 0);
          }
        } catch (err) {
          // Game stats might not be available - continue without them
          console.log(`📊 No game stats for ${team.team} vs ${game.opponent}`);
        }
      }
      
      // Calculate final metrics
      const record = `${actualWins}-${actualLosses}`;
      const expectedVsActual = actualWins - expectedWins;
      const deservedVsActual = deservedWins - actualWins;
      const expectedVsDeserved = deservedWins - expectedWins;
      const closeGameRecord = closeGameTotal > 0 ? `${closeGameWins}-${closeGameTotal - closeGameWins}` : '0-0';
      const fumbleRecoveryRate = totalFumbles > 0 ? (teamFumbleRecoveries / totalFumbles) * 100 : 50;
      const interceptionRate = totalInterceptions > 0 ? (teamInterceptions / totalInterceptions) * 100 : 50;
      const turnoverMargin = takeaways - turnovers;
      
      luckData.push({
        team: team.team,
        conference: team.conference,
        logo_url: team.logo_url,
        abbreviation: team.abbreviation,
        power_rank: team.power_rank,
        record: record,
        expected_wins: expectedWins,
        deserved_wins: deservedWins,
        expected_vs_actual: expectedVsActual,
        deserved_vs_actual: deservedVsActual,
        expected_vs_deserved: expectedVsDeserved,
        close_game_record: closeGameRecord,
        fumble_recovery_rate: fumbleRecoveryRate,
        interception_rate: interceptionRate,
        turnover_margin: turnoverMargin,
        games_played: games.length
      });
    }
    
    // Sort by expected vs actual difference (most lucky first)
    luckData.sort((a, b) => b.expected_vs_actual - a.expected_vs_actual);
    
    console.log(`✅ Calculated luck data for ${luckData.length} teams`);
    
    res.json({
      teams: luckData,
      metadata: {
        season: season,
        total_teams: luckData.length,
        include_postseason: includePostseason === 'true',
        conference_only: conferenceOnly === 'true',
        conference_filter: conference,
        generated_at: new Date().toISOString()
      }
    });
    
  } catch (err) {
    console.error('❌ Error calculating luck data:', err);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: err.message 
    });
  }
});

// FAST SOS Endpoint - reads from pre-calculated table
app.get('/api/leaderboards/strength-of-schedule-fast/:season', async (req, res) => {
  try {
    const { season } = req.params;
    const { classification = 'fbs' } = req.query;
    
    console.log(`🚀 Fast SOS fetch for ${season}`);
    const start = Date.now();
    
    const result = await pool.query(`
      SELECT 
        sos.*,
        t.logo_url,
        t.conference,
        t.abbreviation
      FROM strength_of_schedule sos
      LEFT JOIN teams t ON LOWER(TRIM(t.school)) = LOWER(TRIM(sos.team_name))
      WHERE sos.season = $1 AND sos.classification = $2
      ORDER BY sos.sos_rank
    `, [season, classification]);
    
    console.log(`✅ Fast SOS: ${result.rows.length} teams in ${Date.now() - start}ms`);
    
    res.json({
      teams: result.rows,
      metadata: {
        season: parseInt(season),
        total_teams: result.rows.length,
        last_calculated: result.rows[0]?.last_updated,
        calculation_time: `${Date.now() - start}ms (pre-calculated)`
      }
    });
    
  } catch (err) {
    console.error('❌ Fast SOS error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// FAST Luck Endpoint - reads from pre-calculated table
app.get('/api/leaderboards/luck-fast/:season', async (req, res) => {
  try {
    const { season } = req.params;
    const { conference } = req.query;
    
    console.log(`🍀 Fast Luck fetch for ${season}`);
    const start = Date.now();
    
    let query = `
      SELECT 
        la.*,
        t.logo_url,
        t.abbreviation,
        CONCAT(la.wins, '-', la.losses) as record,
        CASE 
          WHEN la.close_game_total > 0 
          THEN CONCAT(la.close_game_wins, '-', (la.close_game_total - la.close_game_wins))
          ELSE '0-0'
        END as close_game_record
      FROM luck_analysis la
      LEFT JOIN teams t ON LOWER(TRIM(t.school)) = LOWER(TRIM(la.team_name))
      WHERE la.season = $1
    `;
    
    const params = [season];
    
    if (conference && conference !== 'all') {
      query += ` AND la.conference = $2`;
      params.push(conference);
    }
    
    query += ` ORDER BY la.expected_vs_actual DESC`;
    
    const result = await pool.query(query, params);
    
    console.log(`✅ Fast Luck: ${result.rows.length} teams in ${Date.now() - start}ms`);
    
    res.json({
      teams: result.rows,
      metadata: {
        season: parseInt(season),
        total_teams: result.rows.length,
        last_calculated: result.rows[0]?.last_updated,
        calculation_time: `${Date.now() - start}ms (pre-calculated)`
      }
    });
    
  } catch (err) {
    console.error('❌ Fast Luck error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Status endpoint to check calculation progress
app.get('/api/calculation-status/:type/:season', async (req, res) => {
  try {
    const { type, season } = req.params;
    
    const result = await pool.query(`
      SELECT * FROM calculation_status 
      WHERE calculation_type = $1 AND season = $2
    `, [type, season]);
    
    if (result.rows.length === 0) {
      return res.json({ status: 'not_started' });
    }
    
    res.json(result.rows[0]);
    
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/debug/basic-game-stats', async (req, res) => {
  try {
    console.log('🔍 Testing basic game_team_stats query...');
    
    // Step 1: Check if table exists and has any data
    const basicCount = await pool.query(`
      SELECT COUNT(*) as total_rows
      FROM game_team_stats
    `);
    
    // Step 2: Check what seasons we have
    const seasonCheck = await pool.query(`
      SELECT 
        g.season,
        COUNT(*) as stat_records,
        COUNT(DISTINCT gts.team) as unique_teams
      FROM game_team_stats gts
      LEFT JOIN games g ON gts.game_id = g.id
      WHERE g.season IS NOT NULL
      GROUP BY g.season
      ORDER BY g.season DESC
    `);
    
    // Step 3: Get a few sample rows to see the data
    const sampleData = await pool.query(`
      SELECT 
        gts.team,
        gts.completions,
        gts.passingattempts,
        gts.netpassingyards,
        g.season,
        g.completed
      FROM game_team_stats gts
      LEFT JOIN games g ON gts.game_id = g.id
      ORDER BY g.season DESC, gts.team
      LIMIT 10
    `);
    
    // Step 4: Check team name matching
    const teamNameCheck = await pool.query(`
      SELECT 
        gts.team as game_stats_team,
        t.school as teams_table_school,
        COUNT(*) as match_count
      FROM game_team_stats gts
      LEFT JOIN teams t ON LOWER(TRIM(t.school)) = LOWER(TRIM(gts.team))
      GROUP BY gts.team, t.school
      ORDER BY match_count DESC
      LIMIT 10
    `);
    
    res.json({
      debug_results: {
        total_rows_in_game_team_stats: basicCount.rows[0],
        seasons_available: seasonCheck.rows,
        sample_data: sampleData.rows,
        team_name_matching: teamNameCheck.rows
      }
    });
    
  } catch (err) {
    console.error('❌ Debug query failed:', err);
    res.status(500).json({ 
      error: 'Debug failed', 
      details: err.message 
    });
  }
});

// Default route
app.get('/', (req, res) => {
  res.json({
    message: 'CFB Analytics API',
    endpoints: [
      'GET /api/health',
      'GET /api/power-rankings?season=2025',
      'GET /api/available-seasons',
      'GET /api/teams/:teamName?season=2025',
      'GET /api/teams/:teamName/stats?season=2024',
      'GET /api/teams/:teamName/games?season=2024',
      'GET /api/teams/:teamName/games-enhanced/:season',
      'GET /api/all-advanced-stats/:season',
      'GET /api/leaderboards/luck/:season (SLOW - 20+ seconds)',
      'GET /api/leaderboards/luck-fast/:season (FAST - <100ms)',
      'GET /api/leaderboards/strength-of-schedule-enhanced/:season (SLOW)',
      'GET /api/leaderboards/strength-of-schedule-fast/:season (FAST)',
      'GET /api/calculation-status/:type/:season',
      'GET /api/debug-teams',
      'GET /api/debug-columns'
    ]
  });
});

app.listen(port, () => {
  console.log(`CFB API server running on port ${port}`);
  console.log(`Database: ${process.env.DB_NAME || process.env.DB_DATABASE}`);
  console.log(`Available endpoints: http://localhost:${port}/`);
});
