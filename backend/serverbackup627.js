const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: './dataconfig.env' });
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: [
    'https://cfbsite-production.up.railway.app',
    'http://localhost:3000'
  ],
  credentials: true
}));
app.use(express.json());

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
        t.alt_color
      FROM team_power_ratings tpr
      LEFT JOIN teams t ON LOWER(TRIM(t.school)) = LOWER(TRIM(tpr.team_name))
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

// Enhanced games endpoint
app.get('/api/teams/:teamName/games-enhanced/:season', async (req, res) => {
  try {
    const teamName = decodeURIComponent(req.params.teamName);
    const { season } = req.params;
    
    console.log(`🔍 Fetching enhanced games for: "${teamName}", season ${season}`);
    
    const result = await pool.query(`
      SELECT 
        g.id,
        g.season,
        g.week,
        g.start_date,
        g.home_team,
        g.away_team,
        g.home_points,
        g.away_points,
        g.completed,
        g.home_postgame_win_probability,
        g.away_postgame_win_probability,
        g.season_type,
        CASE 
          WHEN g.home_team = $1 THEN g.away_team
          ELSE g.home_team
        END as opponent,
        CASE 
          WHEN g.home_team = $1 THEN 'home'
          ELSE 'away'
        END as home_away,
        
        -- Game betting lines with DraftKings preference, ESPN Bet fallback
        COALESCE(dk_lines.home_moneyline, espn_lines.home_moneyline) as home_moneyline,
        COALESCE(dk_lines.away_moneyline, espn_lines.away_moneyline) as away_moneyline,
        COALESCE(dk_lines.spread, espn_lines.spread) as spread,
        COALESCE(dk_lines.provider, espn_lines.provider) as betting_provider,
        
        -- Advanced game stats for this team
        ags.offense_ppa,
        ags.defense_ppa,
        
        -- Opponent team info for logos
        t_opp.logo_url as opponent_logo
        
      FROM games g
      LEFT JOIN game_betting_lines dk_lines ON g.id = dk_lines.game_id 
      AND UPPER(TRIM(dk_lines.provider)) = 'DRAFTKINGS'
      LEFT JOIN game_betting_lines espn_lines ON g.id = espn_lines.game_id 
      AND UPPER(TRIM(espn_lines.provider)) = 'ESPN BET'
      LEFT JOIN advanced_game_stats ags ON g.id = ags.game_id 
        AND UPPER(TRIM(ags.team)) = UPPER(TRIM($1))
      LEFT JOIN teams t_opp ON LOWER(TRIM(t_opp.school)) = LOWER(TRIM(CASE 
        WHEN g.home_team = $1 THEN g.away_team
        ELSE g.home_team
      END))
      
      WHERE (g.home_team = $1 OR g.away_team = $1) 
        AND g.season = $2
        AND g.completed = true
        AND g.season_type IN ('regular', 'postseason')
      ORDER BY g.week
    `, [teamName, season]);
    
    console.log(`✅ Found ${result.rows.length} enhanced games for "${teamName}" in ${season}`);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching enhanced games:', err);
    res.status(500).json({ error: err.message, details: err.stack });
  }
});

// All advanced stats endpoint
app.get('/api/all-advanced-stats/:season', async (req, res) => {
  try {
    const { season } = req.params;
    
    console.log(`🔍 Fetching all advanced stats with per-game calculations for season ${season}`);
    
    const query = `
      SELECT 
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
      ORDER BY ass.team
    `;
    
    const result = await pool.query(query, [season]);
    
    console.log(`✅ Found ${result.rows.length} teams with per-game calculations for season ${season}`);
    
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