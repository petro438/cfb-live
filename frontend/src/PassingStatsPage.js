import React, { useState, useEffect } from 'react';

const PassingStatsPage = () => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filter states
  const [selectedSeason, setSelectedSeason] = useState(2024);
  const [selectedConference, setSelectedConference] = useState('all');
  const [viewType, setViewType] = useState('offense'); // offense or defense
  const [statCategory, setStatCategory] = useState('basic'); // basic or advanced
  const [statType, setStatType] = useState('per_game'); // total or per_game
  const [conferenceOnly, setConferenceOnly] = useState(false);
  const [regularSeasonOnly, setRegularSeasonOnly] = useState(true);
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState({ key: 'passing_yards', direction: 'desc' });
  
  const [availableConferences, setAvailableConferences] = useState([]);

  // 20-color percentile system from brand book
  const getPercentileColor = (rank, total) => {
    if (!rank || !total || rank > total) return '#f7fcf8';
    
    const percentile = ((total - rank + 1) / total) * 100;
    
    if (percentile >= 96) return '#58c36c'; // Elite
    if (percentile >= 91) return '#6aca7c'; // Excellent  
    if (percentile >= 86) return '#7cd08b'; // Very Good
    if (percentile >= 81) return '#8dd69b'; // Good
    if (percentile >= 76) return '#9fddaa'; // Above Average
    if (percentile >= 71) return '#b0e3ba'; // Solid
    if (percentile >= 66) return '#c2e9c9'; // Decent
    if (percentile >= 61) return '#d4f0d9'; // Okay
    if (percentile >= 56) return '#e5f6e8'; // Below Average
    if (percentile >= 51) return '#f7fcf8'; // Poor
    if (percentile >= 46) return '#fdf5f4'; // Poor
    if (percentile >= 41) return '#fbe1df'; // Bad
    if (percentile >= 36) return '#f9cdc9'; // Bad
    if (percentile >= 31) return '#f7b9b4'; // Very Bad
    if (percentile >= 26) return '#f5a59f'; // Very Bad
    if (percentile >= 21) return '#f2928a'; // Terrible
    if (percentile >= 16) return '#f07e74'; // Terrible
    if (percentile >= 11) return '#ee6a5f'; // Awful
    if (percentile >= 6) return '#ec564a';  // Awful
    return '#ea4335'; // Worst
  };

  // Calculate rankings for each stat with defense-specific logic
  const calculateRankings = (data) => {
    const rankings = {};
    const statFields = [
      'completions', 'attempts', 'completion_percentage',
      'passing_yards', 'yards_per_attempt', 'passing_touchdowns', 
      'interceptions', 'sacks_allowed'
    ];
    
    statFields.forEach(field => {
      const sortedTeams = [...data]
        .filter(team => team[field] !== null && team[field] !== undefined)
        .sort((a, b) => {
          // For DEFENSE: Lower is better for most stats (what we allowed)
          // EXCEPT: interceptions and sacks_allowed (higher is better - more sacks/picks)
          if (viewType === 'defense') {
            if (field === 'interceptions' || field === 'sacks_allowed') {
              return b[field] - a[field]; // Higher is better
            } else {
              return a[field] - b[field]; // Lower is better (less allowed)
            }
          } else {
            // For OFFENSE: Higher is better for everything except interceptions and sacks_allowed
            if (field === 'interceptions' || field === 'sacks_allowed') {
              return a[field] - b[field]; // Lower is better
            } else {
              return b[field] - a[field]; // Higher is better
            }
          }
        });
      
      rankings[field] = {};
      sortedTeams.forEach((team, index) => {
        rankings[field][team.team] = {
          rank: index + 1,
          total: sortedTeams.length
        };
      });
    });
    
    return rankings;
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        view_type: viewType,
        stat_type: 'total', // Always fetch totals, we'll calculate per-game in frontend
        season_type: regularSeasonOnly ? 'regular' : 'all',
        conference_only: conferenceOnly.toString(),
        ...(selectedConference !== 'all' && { conference: selectedConference })
      });
      
      const response = await fetch(
        `https://cfbapi-production.up.railway.app/api/leaderboards/passing/${selectedSeason}?${params}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      console.log('API Response:', data); // Debug log
      
      setTeams(data.teams || []);
      
      // Extract unique conferences for filter
      const conferences = [...new Set(data.teams?.map(team => team.conference).filter(Boolean))].sort();
      setAvailableConferences(conferences);
      
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedSeason, viewType, regularSeasonOnly, conferenceOnly, selectedConference]);

  // Apply per-game calculations in frontend
  const processedTeams = React.useMemo(() => {
    return teams.map(team => {
      if (statType === 'per_game' && team.games_played > 0) {
        return {
          ...team,
          completions: team.completions / team.games_played,
          attempts: team.attempts / team.games_played,
          // completion_percentage stays the same
          passing_yards: team.passing_yards / team.games_played,
          // yards_per_attempt stays the same
          passing_touchdowns: team.passing_touchdowns / team.games_played,
          interceptions: team.interceptions / team.games_played,
          sacks_allowed: team.sacks_allowed / team.games_played
        };
      }
      return team;
    });
  }, [teams, statType]);

  // Sorting function
  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  // Apply sorting to teams
  const sortedTeams = React.useMemo(() => {
    let sortableTeams = [...processedTeams];
    if (sortConfig.key) {
      sortableTeams.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        
        if (aVal < bVal) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aVal > bVal) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableTeams;
  }, [processedTeams, sortConfig]);

  const rankings = calculateRankings(processedTeams);

  const formatNumber = (num, field) => {
    if (num === null || num === undefined) return '-';
    if (typeof num === 'string') return num;
    
    // Special formatting rules
    if (field === 'yards_per_attempt' || field === 'completion_percentage') {
      return Number(num).toFixed(1); // Always 1 decimal
    }
    
    // Games played: no decimals regardless of filter
    if (field === 'games_played') {
      return Number(num).toFixed(0);
    }
    
    if (statType === 'per_game') {
      return Number(num).toFixed(1); // 1 decimal for per-game
    }
    
    return Number(num).toFixed(0); // No decimals for total stats
  };

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return <span style={{ color: '#6c757d', marginLeft: '4px' }}>↕</span>;
    }
    return sortConfig.direction === 'asc' ? 
      <span style={{ color: '#007bff', marginLeft: '4px' }}>↑</span> : 
      <span style={{ color: '#007bff', marginLeft: '4px' }}>↓</span>;
  };

  const CellWithRank = ({ value, statKey, team, isDesktop = true, skipRanking = false, isMobile = false }) => {
    if (skipRanking) {
      return (
        <td style={{
          padding: isMobile ? '4px 2px' : '8px 16px',
          border: '1px solid #dee2e6',
          fontFamily: 'Consolas, monospace',
          fontSize: isMobile ? '11px' : '13px',
          textAlign: 'center',
          backgroundColor: '#ffffff',
          width: isMobile ? 'auto' : 'auto'
        }}>
          <span style={{ fontFamily: 'Consolas, monospace' }}>{value}</span>
        </td>
      );
    }

    const ranking = rankings[statKey]?.[team];
    const backgroundColor = ranking ? getPercentileColor(ranking.rank, ranking.total) : '#ffffff';
    
    return (
      <td style={{
        backgroundColor,
        position: 'relative',
        padding: isMobile ? '4px 2px' : '8px 16px',
        border: '1px solid #dee2e6',
        fontFamily: 'Consolas, monospace',
        fontSize: isMobile ? '11px' : '13px',
        textAlign: 'center',
        minWidth: isMobile ? '35px' : '80px',
        width: isMobile ? 'auto' : 'auto'
      }}>
        <span style={{ fontFamily: 'Consolas, monospace' }}>{value}</span>
        {isDesktop && ranking && (
          <span style={{
            position: 'absolute',
            bottom: '3px',
            right: '6px',
            fontSize: '10px',
            color: '#6c757d',
            fontFamily: 'Trebuchet MS, sans-serif',
            fontWeight: 'bold'
          }}>
            {ranking.rank}
          </span>
        )}
      </td>
    );
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '200px',
        fontFamily: 'Trebuchet MS, sans-serif'
      }}>
        Loading passing stats...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '20px', 
        backgroundColor: '#f8d7da', 
        color: '#721c24', 
        borderRadius: '4px',
        fontFamily: 'Trebuchet MS, sans-serif'
      }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ 
      fontFamily: 'Trebuchet MS, sans-serif',
      backgroundColor: '#ffffff',
      minHeight: '100vh',
      padding: '8px'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ 
          fontFamily: 'Trebuchet MS, sans-serif',
          fontWeight: 'bold',
          fontSize: '24px',
          margin: '0 0 8px 0',
          color: '#212529',
          textTransform: 'uppercase'
        }}>
          {viewType.toUpperCase()} PASSING STATS
        </h1>
      </div>

      {/* Top Row: Season & Conference - Centered */}
      <div style={{ 
        marginBottom: '12px',
        display: 'flex',
        justifyContent: 'center',
        flexWrap: 'wrap'
      }}>
        <div style={{ 
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ 
              fontFamily: 'Trebuchet MS, sans-serif', 
              fontSize: '12px', 
              fontWeight: 'bold',
              color: '#212529'
            }}>
              SEASON:
            </label>
            <select 
              value={selectedSeason} 
              onChange={(e) => setSelectedSeason(parseInt(e.target.value))}
              style={{
                padding: '6px 8px',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                fontFamily: 'Trebuchet MS, sans-serif',
                fontSize: '12px'
              }}
            >
              <option value={2024}>2024</option>
              <option value={2023}>2023</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ 
              fontFamily: 'Trebuchet MS, sans-serif', 
              fontSize: '12px', 
              fontWeight: 'bold',
              color: '#212529'
            }}>
              CONFERENCE:
            </label>
            <select 
              value={selectedConference} 
              onChange={(e) => setSelectedConference(e.target.value)}
              style={{
                padding: '6px 8px',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                fontFamily: 'Trebuchet MS, sans-serif',
                fontSize: '12px'
              }}
            >
              <option value="all">All Conferences</option>
              {availableConferences.map(conf => (
                <option key={conf} value={conf}>{conf}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Middle Row: Page-Specific Button Groups - Centered */}
      <div style={{ 
        marginBottom: '12px',
        display: 'flex',
        justifyContent: 'center',
        flexWrap: 'wrap'
      }}>
        <div style={{ 
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          {/* Offense/Defense Toggle - Style 1: Rounded buttons */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setViewType('offense')}
              style={{
                padding: '6px 12px',
                backgroundColor: viewType === 'offense' ? '#007bff' : '#f8f9fa',
                color: viewType === 'offense' ? 'white' : '#212529',
                border: '1px solid #007bff',
                borderRadius: '16px',
                cursor: 'pointer',
                fontFamily: 'Trebuchet MS, sans-serif',
                fontSize: '11px',
                fontWeight: 'bold'
              }}
            >
              OFFENSE
            </button>
            <button
              onClick={() => setViewType('defense')}
              style={{
                padding: '6px 12px',
                backgroundColor: viewType === 'defense' ? '#007bff' : '#f8f9fa',
                color: viewType === 'defense' ? 'white' : '#212529',
                border: '1px solid #007bff',
                borderRadius: '16px',
                cursor: 'pointer',
                fontFamily: 'Trebuchet MS, sans-serif',
                fontSize: '11px',
                fontWeight: 'bold'
              }}
            >
              DEFENSE
            </button>
          </div>

          {/* Basic/Advanced Toggle - Style 2: Square buttons */}
          <div style={{ display: 'flex', gap: '2px', border: '1px solid #6c757d', borderRadius: '4px' }}>
            <button
              onClick={() => setStatCategory('basic')}
              style={{
                padding: '6px 12px',
                backgroundColor: statCategory === 'basic' ? '#6c757d' : '#ffffff',
                color: statCategory === 'basic' ? 'white' : '#6c757d',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'Trebuchet MS, sans-serif',
                fontSize: '11px',
                fontWeight: 'bold'
              }}
            >
              BASIC
            </button>
            <button
              onClick={() => setStatCategory('advanced')}
              style={{
                padding: '6px 12px',
                backgroundColor: statCategory === 'advanced' ? '#6c757d' : '#ffffff',
                color: statCategory === 'advanced' ? 'white' : '#6c757d',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'Trebuchet MS, sans-serif',
                fontSize: '11px',
                fontWeight: 'bold'
              }}
            >
              ADVANCED
            </button>
          </div>

          {/* Total/Per Game Toggle - Style 3: Green bordered buttons */}
          <div style={{ display: 'flex', gap: '2px', border: '1px solid #28a745', borderRadius: '4px' }}>
            <button
              onClick={() => setStatType('total')}
              style={{
                padding: '6px 12px',
                backgroundColor: statType === 'total' ? '#28a745' : '#ffffff',
                color: statType === 'total' ? 'white' : '#28a745',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'Trebuchet MS, sans-serif',
                fontSize: '11px',
                fontWeight: 'bold'
              }}
            >
              TOTAL
            </button>
            <button
              onClick={() => setStatType('per_game')}
              style={{
                padding: '6px 12px',
                backgroundColor: statType === 'per_game' ? '#28a745' : '#ffffff',
                color: statType === 'per_game' ? 'white' : '#28a745',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'Trebuchet MS, sans-serif',
                fontSize: '11px',
                fontWeight: 'bold'
              }}
            >
              PER GAME
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Row: Checkboxes - Centered */}
      <div style={{ 
        marginBottom: '16px',
        display: 'flex',
        justifyContent: 'center',
        flexWrap: 'wrap'
      }}>
        <div style={{ 
          display: 'flex',
          gap: '16px',
          alignItems: 'center'
        }}>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            fontFamily: 'Trebuchet MS, sans-serif',
            fontSize: '12px',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={conferenceOnly}
              onChange={(e) => setConferenceOnly(e.target.checked)}
            />
            CONFERENCE GAMES ONLY
          </label>

          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            fontFamily: 'Trebuchet MS, sans-serif',
            fontSize: '12px',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={regularSeasonOnly}
              onChange={(e) => setRegularSeasonOnly(e.target.checked)}
            />
            REGULAR SEASON ONLY
          </label>
        </div>
      </div>

      {/* Results Info */}
      <div style={{ 
        marginBottom: '16px', 
        fontSize: '12px', 
        color: '#6c757d',
        fontFamily: 'Trebuchet MS, sans-serif'
      }}>
        Showing {sortedTeams.length} teams • {statType === 'total' ? 'Season Totals' : 'Per Game Averages'}
      </div>

      {/* Centered Table Container */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center',
        width: '100%'
      }}>
        <div style={{ 
          maxWidth: '1200px',
          width: '100%'
        }}>
          <style>
            {`
              @media (max-width: 767px) {
                .desktop-table { display: none !important; }
                .mobile-table { display: block !important; }
              }
              @media (min-width: 768px) {
                .desktop-table { display: block !important; }
                .mobile-table { display: none !important; }
              }
            `}
          </style>
          
          {/* Desktop Table */}
          <table className="desktop-table" style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            backgroundColor: '#ffffff',
            border: '1px solid #dee2e6'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th 
                  onClick={() => handleSort('team')}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #dee2e6',
                    fontFamily: 'Trebuchet MS, sans-serif',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    textAlign: 'left',
                    minWidth: '180px'
                  }}
                >
                  TEAM{getSortIcon('team')}
                </th>
                <th 
                  onClick={() => handleSort('games_played')}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #dee2e6',
                    fontFamily: 'Trebuchet MS, sans-serif',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    textAlign: 'center',
                    minWidth: '60px'
                  }}
                >
                  GP{getSortIcon('games_played')}
                </th>
                <th 
                  onClick={() => handleSort('completions')}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #dee2e6',
                    fontFamily: 'Trebuchet MS, sans-serif',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    textAlign: 'center',
                    minWidth: '80px'
                  }}
                >
                  COMP{getSortIcon('completions')}
                </th>
                <th 
                  onClick={() => handleSort('attempts')}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #dee2e6',
                    fontFamily: 'Trebuchet MS, sans-serif',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    textAlign: 'center',
                    minWidth: '80px'
                  }}
                >
                  ATT{getSortIcon('attempts')}
                </th>
                <th 
                  onClick={() => handleSort('completion_percentage')}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #dee2e6',
                    fontFamily: 'Trebuchet MS, sans-serif',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    textAlign: 'center',
                    minWidth: '80px'
                  }}
                >
                  COMP%{getSortIcon('completion_percentage')}
                </th>
                <th 
                  onClick={() => handleSort('passing_yards')}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #dee2e6',
                    fontFamily: 'Trebuchet MS, sans-serif',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    textAlign: 'center',
                    minWidth: '90px'
                  }}
                >
                  YARDS{getSortIcon('passing_yards')}
                </th>
                <th 
                  onClick={() => handleSort('yards_per_attempt')}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #dee2e6',
                    fontFamily: 'Trebuchet MS, sans-serif',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    textAlign: 'center',
                    lineHeight: '1.2',
                    minWidth: '80px'
                  }}
                >
                  YARDS/<br/>ATT{getSortIcon('yards_per_attempt')}
                </th>
                <th 
                  onClick={() => handleSort('passing_touchdowns')}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #dee2e6',
                    fontFamily: 'Trebuchet MS, sans-serif',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    textAlign: 'center',
                    minWidth: '60px'
                  }}
                >
                  TD{getSortIcon('passing_touchdowns')}
                </th>
                <th 
                  onClick={() => handleSort('interceptions')}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #dee2e6',
                    fontFamily: 'Trebuchet MS, sans-serif',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    textAlign: 'center',
                    minWidth: '60px'
                  }}
                >
                  INT{getSortIcon('interceptions')}
                </th>
                <th 
                  onClick={() => handleSort('sacks_allowed')}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #dee2e6',
                    fontFamily: 'Trebuchet MS, sans-serif',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    textAlign: 'center',
                    minWidth: '80px'
                  }}
                >
                  SACKS{getSortIcon('sacks_allowed')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTeams.map((team, index) => (
                <tr key={team.team} style={{ 
                  backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa'
                }}>
                  <td style={{
                    padding: '8px 16px',
                    border: '1px solid #dee2e6',
                    fontFamily: 'Trebuchet MS, sans-serif',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <img 
                        src={team.logo_url?.replace('http://', 'https://') || 'https://a.espncdn.com/i/teamlogos/ncaa/500/default.png'} 
                        alt={team.team}
                        style={{ width: '20px', height: '20px', objectFit: 'contain' }}
                        onError={(e) => {
                          e.target.src = 'https://a.espncdn.com/i/teamlogos/ncaa/500/default.png';
                        }}
                      />
                      {team.team}
                    </div>
                  </td>
                  <CellWithRank 
                    value={formatNumber(team.games_played, 'games_played')} 
                    statKey="games_played" 
                    team={team.team}
                    isDesktop={true}
                    skipRanking={true}
                  />
                  <CellWithRank 
                    value={formatNumber(team.completions, 'completions')} 
                    statKey="completions" 
                    team={team.team}
                    isDesktop={true}
                  />
                  <CellWithRank 
                    value={formatNumber(team.attempts, 'attempts')} 
                    statKey="attempts" 
                    team={team.team}
                    isDesktop={true}
                  />
                  <CellWithRank 
                    value={formatNumber(team.completion_percentage, 'completion_percentage') + '%'} 
                    statKey="completion_percentage" 
                    team={team.team}
                    isDesktop={true}
                  />
                  <CellWithRank 
                    value={formatNumber(team.passing_yards, 'passing_yards')} 
                    statKey="passing_yards" 
                    team={team.team}
                    isDesktop={true}
                  />
                  <CellWithRank 
                    value={formatNumber(team.yards_per_attempt, 'yards_per_attempt')} 
                    statKey="yards_per_attempt" 
                    team={team.team}
                    isDesktop={true}
                  />
                  <CellWithRank 
                    value={formatNumber(team.passing_touchdowns, 'passing_touchdowns')} 
                    statKey="passing_touchdowns" 
                    team={team.team}
                    isDesktop={true}
                  />
                  <CellWithRank 
                    value={formatNumber(team.interceptions, 'interceptions')} 
                    statKey="interceptions" 
                    team={team.team}
                    isDesktop={true}
                  />
                  <CellWithRank 
                    value={formatNumber(team.sacks_allowed, 'sacks_allowed')} 
                    statKey="sacks_allowed" 
                    team={team.team}
                    isDesktop={true}
                  />
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile Table - Compact with all columns */}
          <table className="mobile-table" style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            backgroundColor: '#ffffff',
            border: '1px solid #dee2e6'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{
                  padding: '4px 2px',
                  border: '1px solid #dee2e6',
                  fontFamily: 'Trebuchet MS, sans-serif',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  textAlign: 'left',
                  width: '22%'
                }}>
                  TEAM
                </th>
                <th style={{
                  padding: '4px 2px',
                  border: '1px solid #dee2e6',
                  fontFamily: 'Trebuchet MS, sans-serif',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                  width: '8%'
                }}>
                  GP
                </th>
                <th style={{
                  padding: '4px 2px',
                  border: '1px solid #dee2e6',
                  fontFamily: 'Trebuchet MS, sans-serif',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                  width: '9%'
                }}>
                  CMP
                </th>
                <th style={{
                  padding: '4px 2px',
                  border: '1px solid #dee2e6',
                  fontFamily: 'Trebuchet MS, sans-serif',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                  width: '9%'
                }}>
                  ATT
                </th>
                <th style={{
                  padding: '4px 2px',
                  border: '1px solid #dee2e6',
                  fontFamily: 'Trebuchet MS, sans-serif',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                  width: '10%'
                }}>
                  YDS
                </th>
                <th style={{
                  padding: '4px 2px',
                  border: '1px solid #dee2e6',
                  fontFamily: 'Trebuchet MS, sans-serif',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                  width: '9%'
                }}>
                  Y/A
                </th>
                <th style={{
                  padding: '4px 2px',
                  border: '1px solid #dee2e6',
                  fontFamily: 'Trebuchet MS, sans-serif',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                  width: '8%'
                }}>
                  TD
                </th>
                <th style={{
                  padding: '4px 2px',
                  border: '1px solid #dee2e6',
                  fontFamily: 'Trebuchet MS, sans-serif',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                  width: '8%'
                }}>
                  INT
                </th>
                <th style={{
                  padding: '4px 2px',
                  border: '1px solid #dee2e6',
                  fontFamily: 'Trebuchet MS, sans-serif',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                  width: '7%'
                }}>
                  SCK
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTeams.map((team, index) => (
                <tr key={`mobile-${team.team}`} style={{ 
                  backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa'
                }}>
                  <td style={{
                    padding: '4px 2px',
                    border: '1px solid #dee2e6',
                    fontFamily: 'Trebuchet MS, sans-serif',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <img 
                        src={team.logo_url?.replace('http://', 'https://') || 'https://a.espncdn.com/i/teamlogos/ncaa/500/default.png'} 
                        alt={team.team}
                        style={{ width: '12px', height: '12px', objectFit: 'contain' }}
                        onError={(e) => {
                          e.target.src = 'https://a.espncdn.com/i/teamlogos/ncaa/500/default.png';
                        }}
                      />
                      <span style={{ fontSize: '8px' }}>
                        {team.team}
                      </span>
                    </div>
                  </td>
                  <CellWithRank 
                    value={formatNumber(team.games_played, 'games_played')} 
                    statKey="games_played" 
                    team={team.team}
                    isDesktop={false}
                    skipRanking={true}
                    isMobile={true}
                  />
                  <CellWithRank 
                    value={formatNumber(team.completions, 'completions')} 
                    statKey="completions" 
                    team={team.team}
                    isDesktop={false}
                    isMobile={true}
                  />
                  <CellWithRank 
                    value={formatNumber(team.attempts, 'attempts')} 
                    statKey="attempts" 
                    team={team.team}
                    isDesktop={false}
                    isMobile={true}
                  />
                  <CellWithRank 
                    value={formatNumber(team.passing_yards, 'passing_yards')} 
                    statKey="passing_yards" 
                    team={team.team}
                    isDesktop={false}
                    isMobile={true}
                  />
                  <CellWithRank 
                    value={formatNumber(team.yards_per_attempt, 'yards_per_attempt')} 
                    statKey="yards_per_attempt" 
                    team={team.team}
                    isDesktop={false}
                    isMobile={true}
                  />
                  <CellWithRank 
                    value={formatNumber(team.passing_touchdowns, 'passing_touchdowns')} 
                    statKey="passing_touchdowns" 
                    team={team.team}
                    isDesktop={false}
                    isMobile={true}
                  />
                  <CellWithRank 
                    value={formatNumber(team.interceptions, 'interceptions')} 
                    statKey="interceptions" 
                    team={team.team}
                    isDesktop={false}
                    isMobile={true}
                  />
                  <CellWithRank 
                    value={formatNumber(team.sacks_allowed, 'sacks_allowed')} 
                    statKey="sacks_allowed" 
                    team={team.team}
                    isDesktop={false}
                    isMobile={true}
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PassingStatsPage;