import React, { useState, useEffect } from 'react';

const StatsPageTemplate = ({ 
  pageTitle,
  apiEndpoint,
  columns,
  mobileColumns,
  defaultSort = 'team',
  calculateRankings,
  formatters = {},
  additionalFilters = []
}) => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Standard filter states
  const [selectedSeason, setSelectedSeason] = useState(2024);
  const [selectedConference, setSelectedConference] = useState('all');
  const [viewType, setViewType] = useState('offense');
  const [statCategory, setStatCategory] = useState('basic');
  const [statType, setStatType] = useState('per_game');
  const [conferenceOnly, setConferenceOnly] = useState(false);
  const [regularSeasonOnly, setRegularSeasonOnly] = useState(true);
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState({ key: defaultSort, direction: 'desc' });
  const [availableConferences, setAvailableConferences] = useState([]);

  // 20-color percentile system (standard across all pages)
  const getPercentileColor = (rank, total) => {
    if (!rank || !total || rank > total) return '#f7fcf8';
    const percentile = ((total - rank + 1) / total) * 100;
    if (percentile >= 96) return '#58c36c';
    if (percentile >= 91) return '#6aca7c';
    if (percentile >= 86) return '#7cd08b';
    if (percentile >= 81) return '#8dd69b';
    if (percentile >= 76) return '#9fddaa';
    if (percentile >= 71) return '#b0e3ba';
    if (percentile >= 66) return '#c2e9c9';
    if (percentile >= 61) return '#d4f0d9';
    if (percentile >= 56) return '#e5f6e8';
    if (percentile >= 51) return '#f7fcf8';
    if (percentile >= 46) return '#fdf5f4';
    if (percentile >= 41) return '#fbe1df';
    if (percentile >= 36) return '#f9cdc9';
    if (percentile >= 31) return '#f7b9b4';
    if (percentile >= 26) return '#f5a59f';
    if (percentile >= 21) return '#f2928a';
    if (percentile >= 16) return '#f07e74';
    if (percentile >= 11) return '#ee6a5f';
    if (percentile >= 6) return '#ec564a';
    return '#ea4335';
  };

  // Standard fetch data function
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        view_type: viewType,
        stat_type: 'total',
        season_type: regularSeasonOnly ? 'regular' : 'all',
        conference_only: conferenceOnly.toString(),
        ...(selectedConference !== 'all' && { conference: selectedConference })
      });
      
      const response = await fetch(`${apiEndpoint}/${selectedSeason}?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setTeams(data.teams || []);
      
      const conferences = [...new Set(data.teams?.map(team => team.conference).filter(Boolean))].sort();
      setAvailableConferences(conferences);
      
    } catch (err) {
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedSeason, viewType, regularSeasonOnly, conferenceOnly, selectedConference]);

  // Standard number formatting
  const formatNumber = (num, field) => {
    if (num === null || num === undefined) return '-';
    if (typeof num === 'string') return num;
    
    if (formatters[field]) {
      return formatters[field](num, statType);
    }
    
    if (field === 'games_played') return Number(num).toFixed(0);
    if (statType === 'per_game') return Number(num).toFixed(1);
    return Number(num).toFixed(0);
  };

  // Apply per-game calculations
  const processedTeams = React.useMemo(() => {
    return teams.map(team => {
      if (statType === 'per_game' && team.games_played > 0) {
        const processed = { ...team };
        columns.forEach(col => {
          if (col.perGameCalculation && processed[col.key] !== undefined) {
            processed[col.key] = processed[col.key] / processed.games_played;
          }
        });
        return processed;
      }
      return team;
    });
  }, [teams, statType]);

  // Standard sorting
  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const sortedTeams = React.useMemo(() => {
    let sortableTeams = [...processedTeams];
    if (sortConfig.key) {
      sortableTeams.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableTeams;
  }, [processedTeams, sortConfig]);

  const rankings = calculateRankings ? calculateRankings(processedTeams, viewType) : {};

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return <span style={{ color: '#6c757d', marginLeft: '4px' }}>↕</span>;
    }
    return sortConfig.direction === 'asc' ? 
      <span style={{ color: '#007bff', marginLeft: '4px' }}>↑</span> : 
      <span style={{ color: '#007bff', marginLeft: '4px' }}>↓</span>;
  };

  // Standard cell component
  const CellWithRank = ({ value, statKey, team, isDesktop = true, skipRanking = false, isMobile = false }) => {
    if (skipRanking) {
      return (
        <td style={{
          padding: isMobile ? '4px 2px' : '8px 16px',
          border: '1px solid #dee2e6',
          fontFamily: 'Consolas, monospace',
          fontSize: isMobile ? (statKey === 'games_played' ? '9px' : '11px') : '13px',
          textAlign: 'center',
          backgroundColor: '#ffffff'
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
        fontSize: isMobile ? (statKey === 'games_played' ? '9px' : '11px') : '13px',
        textAlign: 'center',
        minWidth: isMobile ? '35px' : '80px'
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
        Loading {pageTitle.toLowerCase()}...
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
      {/* Standard Header */}
      <div style={{ 
        marginBottom: '16px',
        display: 'flex',
        justifyContent: 'center',
        textAlign: 'center'
      }}>
        <h1 style={{ 
          fontFamily: 'Trebuchet MS, sans-serif',
          fontWeight: 'bold',
          fontSize: '24px',
          margin: '0 0 8px 0',
          color: '#212529',
          textTransform: 'uppercase'
        }}>
          {viewType.toUpperCase()} {pageTitle.toUpperCase()}
        </h1>
      </div>

      {/* Standard Filter Layout */}
      {/* Season & Conference - Centered */}
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

      {/* Button Groups - Centered */}
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
          {/* Offense/Defense Toggle */}
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

          {/* Basic/Advanced Toggle */}
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

          {/* Total/Per Game Toggle */}
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

          {/* Additional Filters */}
          {additionalFilters.map((filter, index) => (
            <div key={index}>
              {filter}
            </div>
          ))}
        </div>
      </div>

      {/* Checkboxes - Centered */}
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

      {/* Results Info - Centered */}
      <div style={{ 
        marginBottom: '16px', 
        fontSize: '12px', 
        color: '#6c757d',
        fontFamily: 'Trebuchet MS, sans-serif',
        textAlign: 'center'
      }}>
        Showing {sortedTeams.length} teams • {statType === 'total' ? 'Season Totals' : 'Per Game Averages'}
      </div>

      {/* Standard Table Layout */}
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
                {columns.map(col => (
                  <th 
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    style={{
                      padding: '8px 16px',
                      border: '1px solid #dee2e6',
                      fontFamily: 'Trebuchet MS, sans-serif',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      textAlign: col.align || 'center',
                      minWidth: col.minWidth || '80px',
                      lineHeight: col.lineHeight || 'normal'
                    }}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedTeams.map((team, index) => (
                <tr key={team.team} style={{ 
                  backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa'
                }}>
                  {columns.map(col => {
                    if (col.key === 'team') {
                  return (
                    <td key={col.key} style={{
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
                    <a 
                      href={`/team/${encodeURIComponent(team.team)}?season=${selectedSeason}`}
                      style={{ 
                        color: '#007bff', 
                        textDecoration: 'none',
                        fontWeight: 'bold'
                      }}
                      onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
                      onMouseOut={(e) => e.target.style.textDecoration = 'none'}
                    >
                      {team.team}
                    </a>
                  </div>
                </td>
              );
            }
                    
                    return (
                      <CellWithRank 
                        key={col.key}
                        value={formatNumber(team[col.key], col.key)} 
                        statKey={col.key} 
                        team={team.team}
                        isDesktop={true}
                        skipRanking={col.skipRanking}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile Table */}
          <table className="mobile-table" style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            backgroundColor: '#ffffff',
            border: '1px solid #dee2e6'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                {mobileColumns.map(col => (
                  <th 
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    style={{
                      padding: '4px 2px',
                      border: '1px solid #dee2e6',
                      fontFamily: 'Trebuchet MS, sans-serif',
                      fontSize: '9px',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      textAlign: col.align || 'center',
                      width: col.width || 'auto',
                      cursor: 'pointer'
                    }}
                  >
                    {col.header}{getSortIcon(col.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedTeams.map((team, index) => (
                <tr key={`mobile-${team.team}`} style={{ 
                  backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa'
                }}>
                  {mobileColumns.map(col => {
                    if (col.key === 'team') {
                    return (
                      <td key={col.key} style={{
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
                          <a 
                            href={`/team/${encodeURIComponent(team.team)}?season=${selectedSeason}`}
                            style={{ 
                              color: '#007bff', 
                              textDecoration: 'none',
                              fontSize: '8px',
                              fontWeight: 'bold'
                            }}
                          >
                            {team.team}
                          </a>
                        </div>
                      </td>
                    );
                  }
                    
                    return (
                      <CellWithRank 
                        key={col.key}
                        value={formatNumber(team[col.key], col.key)} 
                        statKey={col.key} 
                        team={team.team}
                        isDesktop={false}
                        skipRanking={col.skipRanking}
                        isMobile={true}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StatsPageTemplate;