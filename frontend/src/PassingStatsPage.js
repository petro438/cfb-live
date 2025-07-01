import React, { useState, useEffect } from 'react';

const PassingStatsPage = () => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters
  const [side, setSide] = useState('offense');
  const [perGame, setPerGame] = useState(false);
  const [regularSeasonOnly, setRegularSeasonOnly] = useState(false);
  const [conferenceOnly, setConferenceOnly] = useState(false);
  const [selectedConference, setSelectedConference] = useState('all');
  
  const API_BASE = 'https://cfbapi-production.up.railway.app';

  const fetchPassingStats = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        side: side,
        per_game: perGame.toString(),
        regular_season_only: regularSeasonOnly.toString(),
        conference_only: conferenceOnly.toString()
      });
      
      if (selectedConference && selectedConference !== 'all') {
        params.append('conference', selectedConference);
      }
      
      const url = `${API_BASE}/api/leaderboards/passing/2024?${params}`;
      console.log('📡 Fetching:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Fetch failed: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ Data received:', data);
      
      setTeams(data.teams || []);
    } catch (err) {
      console.error('❌ Error fetching passing stats:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPassingStats();
  }, [side, perGame, regularSeasonOnly, conferenceOnly, selectedConference]);

  // Get color for percentile ranking
  const getPercentileColor = (rank, totalTeams) => {
    const percentile = ((totalTeams - rank + 1) / totalTeams) * 100;
    
    if (percentile >= 95) return '#58c36c';      // Elite (green)
    if (percentile >= 90) return '#6aca7c';      // Excellent
    if (percentile >= 80) return '#7cd08b';      // Very Good
    if (percentile >= 70) return '#8dd69b';      // Good
    if (percentile >= 60) return '#9fddaa';      // Above Average
    if (percentile >= 50) return '#b0e3ba';      // Solid
    if (percentile >= 40) return '#c2e9c9';      // Decent
    if (percentile >= 30) return '#d4f0d9';      // Okay
    if (percentile >= 20) return '#e5f6e8';      // Below Average
    if (percentile >= 10) return '#fdf5f4';      // Poor
    return '#fbe1df';                            // Bad
  };

  // Define which stats to show based on current view
  const getDisplayStats = () => {
    const baseStats = [
      { key: 'display_completions', label: perGame ? 'Comp/G' : 'Completions', format: (val) => perGame ? val.toFixed(1) : val },
      { key: 'display_attempts', label: perGame ? 'Att/G' : 'Attempts', format: (val) => perGame ? val.toFixed(1) : val },
      { key: 'completion_percentage', label: 'Comp%', format: (val) => `${val}%` },
      { key: 'display_yards', label: perGame ? 'Yards/G' : 'Pass Yards', format: (val) => perGame ? val.toFixed(1) : val.toLocaleString() },
      { key: 'yards_per_attempt', label: 'YPA', format: (val) => val.toFixed(1) },
      { key: 'display_tds', label: perGame ? 'TD/G' : 'Pass TDs', format: (val) => perGame ? val.toFixed(1) : val },
      { key: 'display_interceptions', label: perGame ? 'INT/G' : 'INTs', format: (val) => perGame ? val.toFixed(1) : val },
      { key: 'display_sacks', label: perGame ? 'Sacks/G' : 'Sacks', format: (val) => perGame ? val.toFixed(1) : val },
      { key: 'display_hurries', label: perGame ? 'Hurries/G' : 'QB Hurries', format: (val) => perGame ? val.toFixed(1) : val }
    ];
    
    return baseStats;
  };

  const conferences = ['all', 'SEC', 'Big Ten', 'Big 12', 'ACC', 'Pac-12', 'American', 'Mountain West', 'C-USA', 'MAC', 'Sun Belt'];

  if (loading) {
    return (
      <div style={{ 
        padding: '20px', 
        fontFamily: 'Trebuchet MS, sans-serif',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px'
      }}>
        <div style={{ fontSize: '18px', color: '#6c757d' }}>
          Loading passing stats...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '20px', 
        fontFamily: 'Trebuchet MS, sans-serif',
        textAlign: 'center',
        color: '#dc3545'
      }}>
        <h2>Error Loading Data</h2>
        <p>{error}</p>
        <button 
          onClick={fetchPassingStats}
          style={{
            padding: '8px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const displayStats = getDisplayStats();

  return (
    <div style={{ 
      padding: '8px', 
      fontFamily: 'Trebuchet MS, sans-serif',
      backgroundColor: '#ffffff'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ 
          fontSize: '24px', 
          fontWeight: 'bold', 
          margin: '0 0 8px 0',
          color: '#212529'
        }}>
          {side === 'offense' ? 'Passing Offense' : 'Pass Defense'} Leaders - 2024
        </h1>
        <p style={{ 
          fontSize: '14px', 
          color: '#6c757d', 
          margin: '0'
        }}>
          {side === 'offense' ? 'Team passing statistics' : 'Opponent passing yards allowed'} • 
          {perGame ? ' Per Game' : ' Season Totals'} • 
          {regularSeasonOnly ? ' Regular Season Only' : ' All Games'} • 
          {conferenceOnly ? ' Conference Games Only' : ' All Games'} • 
          {teams.length} FBS Teams
        </p>
      </div>

      {/* Controls */}
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: '12px', 
        marginBottom: '16px',
        padding: '12px',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px',
        border: '1px solid #dee2e6'
      }}>
        {/* Offense/Defense Toggle */}
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => setSide('offense')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              backgroundColor: side === 'offense' ? '#007bff' : '#ffffff',
              color: side === 'offense' ? '#ffffff' : '#212529',
              cursor: 'pointer',
              fontFamily: 'Trebuchet MS, sans-serif'
            }}
          >
            Offense
          </button>
          <button
            onClick={() => setSide('defense')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              backgroundColor: side === 'defense' ? '#007bff' : '#ffffff',
              color: side === 'defense' ? '#ffffff' : '#212529',
              cursor: 'pointer',
              fontFamily: 'Trebuchet MS, sans-serif'
            }}
          >
            Defense
          </button>
        </div>

        {/* Per Game Toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
          <input
            type="checkbox"
            checked={perGame}
            onChange={(e) => setPerGame(e.target.checked)}
          />
          Per Game
        </label>

        {/* Regular Season Toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
          <input
            type="checkbox"
            checked={regularSeasonOnly}
            onChange={(e) => setRegularSeasonOnly(e.target.checked)}
          />
          Regular Season Only
        </label>

        {/* Conference Games Toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
          <input
            type="checkbox"
            checked={conferenceOnly}
            onChange={(e) => setConferenceOnly(e.target.checked)}
          />
          Conference Games Only
        </label>

        {/* Conference Filter */}
        <select
          value={selectedConference}
          onChange={(e) => setSelectedConference(e.target.value)}
          style={{
            padding: '4px 8px',
            fontSize: '12px',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            fontFamily: 'Trebuchet MS, sans-serif'
          }}
        >
          {conferences.map(conf => (
            <option key={conf} value={conf}>
              {conf === 'all' ? 'All Conferences' : conf}
            </option>
          ))}
        </select>
      </div>

      {/* Stats Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          fontSize: '12px',
          backgroundColor: '#ffffff'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa' }}>
              <th style={{ 
                padding: '8px 4px', 
                textAlign: 'left', 
                border: '1px solid #dee2e6',
                fontFamily: 'Trebuchet MS, sans-serif',
                fontWeight: 'bold',
                fontSize: '11px',
                textTransform: 'uppercase'
              }}>
                RK
              </th>
              <th style={{ 
                padding: '8px 4px', 
                textAlign: 'left', 
                border: '1px solid #dee2e6',
                fontFamily: 'Trebuchet MS, sans-serif',
                fontWeight: 'bold',
                fontSize: '11px',
                textTransform: 'uppercase'
              }}>
                TEAM
              </th>
              <th style={{ 
                padding: '8px 4px', 
                textAlign: 'center', 
                border: '1px solid #dee2e6',
                fontFamily: 'Trebuchet MS, sans-serif',
                fontWeight: 'bold',
                fontSize: '11px',
                textTransform: 'uppercase'
              }}>
                GP
              </th>
              {displayStats.map(stat => (
                <th key={stat.key} style={{ 
                  padding: '8px 4px', 
                  textAlign: 'center', 
                  border: '1px solid #dee2e6',
                  fontFamily: 'Trebuchet MS, sans-serif',
                  fontWeight: 'bold',
                  fontSize: '11px',
                  textTransform: 'uppercase'
                }}>
                  {stat.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teams.map((team, index) => (
              <tr key={team.team_name} style={{ 
                backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa'
              }}>
                <td style={{ 
                  padding: '6px 4px', 
                  border: '1px solid #dee2e6',
                  fontFamily: 'Consolas, monospace',
                  textAlign: 'center'
                }}>
                  {team.rank}
                </td>
                <td style={{ 
                  padding: '6px 4px', 
                  border: '1px solid #dee2e6',
                  fontFamily: 'Trebuchet MS, sans-serif',
                  fontWeight: 'bold',
                  textTransform: 'uppercase'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <img 
                      src={team.logo_url} 
                      alt={team.team_name}
                      style={{ width: '20px', height: '20px' }}
                      onError={(e) => {
                        e.target.src = 'http://a.espncdn.com/i/teamlogos/ncaa/500/default.png';
                      }}
                    />
                    <span>{team.team_name}</span>
                  </div>
                </td>
                <td style={{ 
                  padding: '6px 4px', 
                  border: '1px solid #dee2e6',
                  fontFamily: 'Consolas, monospace',
                  textAlign: 'center'
                }}>
                  {team.games_played}
                </td>
                {displayStats.map(stat => (
                  <td key={stat.key} style={{ 
                    padding: '6px 4px', 
                    border: '1px solid #dee2e6',
                    fontFamily: 'Consolas, monospace',
                    textAlign: 'center',
                    backgroundColor: getPercentileColor(team.rank, teams.length)
                  }}>
                    {stat.format(team[stat.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{ 
        marginTop: '16px', 
        fontSize: '11px', 
        color: '#6c757d',
        textAlign: 'center'
      }}>
        <p>
          Colors represent percentile rankings: 
          <span style={{backgroundColor: '#58c36c', padding: '2px 4px', margin: '0 2px'}}>Elite (95-100%)</span>
          <span style={{backgroundColor: '#7cd08b', padding: '2px 4px', margin: '0 2px'}}>Very Good (80-95%)</span>
          <span style={{backgroundColor: '#b0e3ba', padding: '2px 4px', margin: '0 2px'}}>Solid (50-80%)</span>
          <span style={{backgroundColor: '#fdf5f4', padding: '2px 4px', margin: '0 2px'}}>Poor (0-50%)</span>
        </p>
        <p>
          {side === 'offense' ? 'Higher values and ranks are better' : 'Lower values and ranks are better for defense'}
        </p>
      </div>
    </div>
  );
};

export default PassingStatsPage;