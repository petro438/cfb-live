import React, { useState, useEffect } from 'react';

const LuckLeaderboard = () => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState('2024');
  const [conferenceFilter, setConferenceFilter] = useState('all');
  const [conferenceOnlyGames, setConferenceOnlyGames] = useState(false);
  const [regularSeasonOnly, setRegularSeasonOnly] = useState(false);
  const [sortColumn, setSortColumn] = useState('deserved_vs_actual');
  const [sortDirection, setSortDirection] = useState('asc');
  const [conferences, setConferences] = useState([]);

  // Fixed fetchLuckData function for fast endpoint
  const fetchLuckData = React.useCallback(async () => {
    try {
      setLoading(true);
      
      const API_URL = process.env.REACT_APP_API_URL || 'https://cfbapi-production.up.railway.app';
      
      // Build parameters for fast endpoint
      const params = new URLSearchParams();
      
      // Add conference filter if not 'all'
      if (conferenceFilter !== 'all') {
        params.append('conference', conferenceFilter);
      }
      
      // Build URL for fast endpoint
      const queryString = params.toString();
      const finalUrl = `${API_URL}/api/leaderboards/luck-fast/${selectedSeason}${queryString ? '?' + queryString : ''}`;
      
      console.log('🚀 Fetching luck data from:', finalUrl);
      
      const response = await fetch(finalUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      const teamsData = data.teams || [];
      
      console.log('📊 API Response:');
      console.log('- Teams received:', teamsData.length);
      console.log('- Metadata:', data.metadata);
      console.log('- Sample team:', teamsData[0]);
      
      // Extract unique conferences from the actual data
      const uniqueConferences = [...new Set(teamsData.map(team => team.conference))].filter(Boolean).sort();
      setConferences(uniqueConferences);
      
      setTeams(teamsData);
      setError(null);
      
    } catch (err) {
      console.error('❌ Error fetching luck data:', err);
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedSeason, conferenceFilter]);

  useEffect(() => {
    fetchLuckData();
  }, [fetchLuckData]);

  // Sorting function
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Sort teams
  const sortedTeams = React.useMemo(() => {
    return [...teams].sort((a, b) => {
      let aVal = a[sortColumn];
      let bVal = b[sortColumn];
      
      // Handle null values
      if (aVal === null || aVal === undefined) aVal = sortDirection === 'asc' ? Infinity : -Infinity;
      if (bVal === null || bVal === undefined) bVal = sortDirection === 'asc' ? Infinity : -Infinity;
      
      // Convert string numbers to actual numbers
      if (typeof aVal === 'string' && !isNaN(parseFloat(aVal))) aVal = parseFloat(aVal);
      if (typeof bVal === 'string' && !isNaN(parseFloat(bVal))) bVal = parseFloat(bVal);
      
      if (sortDirection === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });
  }, [teams, sortColumn, sortDirection]);

  // Get rank color for FBS-only team rank badges  
  const getRankColor = (rank, totalFBSTeams = 134) => {
    if (!rank || rank < 1) return { bg: '#6c757d', text: '#fff' };
    
    const percentile = ((totalFBSTeams - rank + 1) / totalFBSTeams) * 100;
    
    if (percentile >= 96) return { bg: '#58c36c', text: '#fff' };
    if (percentile >= 91) return { bg: '#6aca7c', text: '#fff' };
    if (percentile >= 86) return { bg: '#7cd08b', text: '#fff' };
    if (percentile >= 81) return { bg: '#8dd69b', text: '#000' };
    if (percentile >= 76) return { bg: '#9fddaa', text: '#000' };
    if (percentile >= 71) return { bg: '#b0e3ba', text: '#000' };
    if (percentile >= 66) return { bg: '#c2e9c9', text: '#000' };
    if (percentile >= 61) return { bg: '#d4f0d9', text: '#000' };
    if (percentile >= 56) return { bg: '#e5f6e8', text: '#000' };
    if (percentile >= 51) return { bg: '#f7fcf8', text: '#000' };
    if (percentile >= 46) return { bg: '#fdf5f4', text: '#000' };
    if (percentile >= 41) return { bg: '#fbe1df', text: '#000' };
    if (percentile >= 36) return { bg: '#f9cdc9', text: '#000' };
    if (percentile >= 31) return { bg: '#f7b9b4', text: '#000' };
    if (percentile >= 26) return { bg: '#f5a59f', text: '#000' };
    if (percentile >= 21) return { bg: '#f2928a', text: '#fff' };
    if (percentile >= 16) return { bg: '#f07e74', text: '#fff' };
    if (percentile >= 11) return { bg: '#ee6a5f', text: '#fff' };
    if (percentile >= 6) return { bg: '#ec564a', text: '#fff' };
    return { bg: '#ea4335', text: '#fff' };
  };

  // Color coding for luck metrics
  const getLuckColor = (value, type) => {
    if (value === null || value === undefined) return '#f8f9fa';
    
    if (type === 'deserved_difference') {
      // For Deserved vs Actual differences (DESERVED - ACTUAL)
      // Positive = unlucky/deserved better (green), Negative = lucky/overperformed (red)
      if (value >= 3) return '#58c36c';       // Very unlucky (deep green)
      if (value >= 2) return '#7cd08b';       // Unlucky (green)
      if (value >= 1) return '#b0e3ba';       // Slightly unlucky (light green)
      if (value >= 0.5) return '#d4f0d9';     // Mildly unlucky
      if (value <= -3) return '#ea4335';      // Very lucky (deep red)
      if (value <= -2) return '#f2928a';      // Lucky (red)
      if (value <= -1) return '#f9cdc9';      // Slightly lucky (light red)
      if (value <= -0.5) return '#fbe1df';    // Mildly lucky
      return '#f7fcf8';                       // Neutral (near zero)
    } else if (type === 'turnover_margin') {
      // Higher is better (positive turnover margin)
      if (value >= 15) return '#58c36c';      // Very good
      if (value >= 10) return '#7cd08b';      // Good  
      if (value >= 5) return '#b0e3ba';       // Slightly good
      if (value >= 0) return '#f7fcf8';       // Neutral
      if (value >= -5) return '#fbe1df';      // Slightly bad
      if (value >= -10) return '#f2928a';     // Bad
      return '#ea4335';                       // Very bad
    }
    
    return '#f8f9fa'; // Default
  };

  const formatStat = (value, decimals = 1) => {
    if (value === null || value === undefined) return 'N/A';
    return typeof value === 'number' ? value.toFixed(decimals) : value;
  };

  // Sortable header component
  const SortableHeader = ({ column, children, style = {} }) => (
    <th 
      style={{
        ...headerStyle,
        ...style,
        cursor: 'pointer',
        backgroundColor: sortColumn === column ? '#007bff' : '#f8f9fa',
        color: sortColumn === column ? 'white' : 'inherit'
      }}
      onClick={() => handleSort(column)}
    >
      {children} {sortColumn === column && (sortDirection === 'asc' ? '↑' : '↓')}
    </th>
  );

  const cellStyle = {
    padding: '8px',
    border: '1px solid #dee2e6',
    textAlign: 'center',
    fontSize: '13px',
    fontFamily: 'Consolas, monospace'
  };

  const headerStyle = {
    ...cellStyle,
    backgroundColor: '#f8f9fa',
    fontWeight: 'bold',
    fontSize: '11px',
    textTransform: 'uppercase',
    fontFamily: '"Trebuchet MS", Arial, sans-serif'
  };

  const groupHeaderStyle = {
    ...headerStyle,
    backgroundColor: '#e9ecef',
    fontSize: '10px',
    color: '#6c757d'
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '400px',
        fontFamily: '"Trebuchet MS", Arial, sans-serif'
      }}>
        Loading luck data...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '40px',
        color: '#d32f2f',
        fontFamily: '"Trebuchet MS", Arial, sans-serif'
      }}>
        <h3>Error Loading Luck Data</h3>
        <p>{error}</p>
        <p style={{ fontSize: '14px', color: '#666' }}>
          Make sure you've run the luck calculation script first:<br/>
          <code>node calculate-luck-data.js --luck --season={selectedSeason}</code>
        </p>
      </div>
    );
  }

  return (
    <div style={{ 
      fontFamily: '"Trebuchet MS", Arial, sans-serif',
      backgroundColor: '#ffffff',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#343a40',
        color: 'white',
        padding: '20px',
        textAlign: 'center'
      }}>
        <h1 style={{ margin: '0', fontSize: '28px' }}>🍀 LUCK LEADERBOARD</h1>
        <div style={{ fontSize: '16px', opacity: 0.9, marginTop: '8px' }}>
          Measuring fortune, misfortune, and everything in between
        </div>
      </div>

      {/* Explainer Section */}
      <div style={{
        maxWidth: '1400px',
        margin: '20px auto',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <h3 style={{ margin: '0 0 15px 0', color: '#343a40' }}>How These Stats Work</h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '15px',
          fontSize: '14px',
          lineHeight: '1.4'
        }}>
          <div>
            <strong style={{ color: '#28a745' }}>Expected Wins:</strong> Based on pregame win probabilities from betting lines or power ratings.
          </div>
          <div>
            <strong style={{ color: '#17a2b8' }}>Deserved Wins:</strong> Based on postgame win probability, measuring actual game performance.
          </div>
          <div>
            <strong style={{ color: '#dc3545' }}>Close Games:</strong> Games decided by 8 points or less, where luck has the biggest impact.
          </div>
          <div>
            <strong style={{ color: '#ffc107' }}>Turnover Luck:</strong> Fumble recovery rates and interception percentages that measure fortunate bounces.
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ 
        maxWidth: '1400px', 
        margin: '0 auto', 
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        flexWrap: 'wrap'
      }}>
        <div>
          <label style={{ marginRight: '8px', fontWeight: 'bold' }}>Season:</label>
          <select 
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            style={{
              padding: '8px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          >
            <option value="2024">2024</option>
            <option value="2023">2023</option>
          </select>
        </div>

        <div>
          <label style={{ marginRight: '8px', fontWeight: 'bold' }}>Conference:</label>
          <select 
            value={conferenceFilter}
            onChange={(e) => setConferenceFilter(e.target.value)}
            style={{
              padding: '8px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          >
            <option value="all">All Conferences</option>
            {conferences.map(conf => (
              <option key={conf} value={conf}>{conf}</option>
            ))}
          </select>
        </div>
        
        <div style={{ fontSize: '14px', color: '#6c757d' }}>
          {teams.length} teams • Last calculated: {teams[0]?.last_updated ? new Date(teams[0].last_updated).toLocaleDateString() : 'Unknown'}
        </div>
      </div>

      {/* Table */}
      <div style={{ 
        maxWidth: '1400px', 
        margin: '0 auto', 
        padding: '0 20px 20px',
        overflowX: 'auto'
      }}>
        <style>
          {`
            /* Desktop: Show desktop layout */
            .team-layout-desktop { 
              display: flex !important; 
            }
            .team-layout-mobile { 
              display: none !important; 
            }
            
            /* Mobile: Show mobile layout */
            @media (max-width: 768px) {
              .team-layout-desktop { 
                display: none !important; 
              }
              .team-layout-mobile { 
                display: flex !important; 
              }
            }
          `}
        </style>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          border: '1px solid #dee2e6',
          fontSize: '13px'
        }}>
          <thead>
            {/* Group headers */}
            <tr>
              <th style={groupHeaderStyle} rowSpan="2">Team</th>
              <th style={groupHeaderStyle} rowSpan="2">Record</th>
              <th style={{...groupHeaderStyle, borderRight: '3px solid #28a745'}} colSpan="2">Deserved vs Actual</th>
              <th style={{...groupHeaderStyle, borderRight: '3px solid #dc3545'}} rowSpan="2">Close Games<br/>(≤8 pts)</th>
              <th style={{...groupHeaderStyle}} colSpan="3">Turnover Luck</th>
            </tr>
            
            {/* Individual column headers */}
            <tr>
              <SortableHeader column="deserved_wins" style={{fontSize: '10px'}}>Deserved<br/>Wins</SortableHeader>
              <SortableHeader column="deserved_vs_actual" style={{fontSize: '10px', borderRight: '3px solid #28a745'}}>Difference</SortableHeader>
              <SortableHeader column="fumble_recovery_rate" style={{fontSize: '10px'}}>Fumble<br/>Recovery %</SortableHeader>
              <SortableHeader column="interception_rate" style={{fontSize: '10px'}}>Interception<br/>Rate %</SortableHeader>
              <SortableHeader column="turnover_margin" style={{fontSize: '10px'}}>Turnover<br/>Margin</SortableHeader>
            </tr>
          </thead>
          
          <tbody>
            {sortedTeams.map((team, index) => {
              // Calculate FBS-only ranking for proper percentile coloring
              const fbsRank = team.power_rank && team.power_rank <= 134 ? team.power_rank : null;
              const colors = getRankColor(fbsRank, 134);
              
              return (
                <tr key={team.team_name} style={{ 
                  backgroundColor: index % 2 === 1 ? '#f8f9fa' : '#ffffff'
                }}>
                  {/* Team */}
                  <td style={{...cellStyle, textAlign: 'left'}}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {/* Desktop: Logo -> Team Name -> Ranking */}
                      <div className="team-layout-desktop" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <a 
                          href={`/team/${encodeURIComponent(team.team_name)}?season=${selectedSeason}`}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px',
                            textDecoration: 'none',
                            color: 'inherit',
                            cursor: 'pointer'
                          }}
                          onMouseOver={(e) => e.target.closest('a').style.textDecoration = 'underline'}
                          onMouseOut={(e) => e.target.closest('a').style.textDecoration = 'none'}
                        >
                          <img 
                            src={team.logo_url || 'http://a.espncdn.com/i/teamlogos/ncaa/500/default.png'} 
                            alt={`${team.team_name} logo`}
                            style={{ width: '24px', height: '24px', objectFit: 'contain' }}
                          />
                          <span 
                            style={{ 
                              fontWeight: 'bold',
                              textTransform: 'uppercase',
                              fontFamily: '"Trebuchet MS", Arial, sans-serif',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {team.team_name}
                          </span>
                        </a>
                        {team.power_rank && team.power_rank <= 134 && (
                          <span style={{
                            backgroundColor: colors.bg,
                            color: colors.text,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            minWidth: '24px',
                            textAlign: 'center'
                          }}>
                            #{team.power_rank}
                          </span>
                        )}
                      </div>

                      {/* Mobile: Logo -> Abbreviation -> Ranking */}
                      <div className="team-layout-mobile" style={{ display: 'none', alignItems: 'center', gap: '4px' }}>
                        <a 
                          href={`/team/${encodeURIComponent(team.team_name)}?season=${selectedSeason}`}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '4px',
                            textDecoration: 'none',
                            color: 'inherit',
                            cursor: 'pointer'
                          }}
                          onMouseOver={(e) => e.target.closest('a').style.textDecoration = 'underline'}
                          onMouseOut={(e) => e.target.closest('a').style.textDecoration = 'none'}
                        >
                          <img 
                            src={team.logo_url || 'http://a.espncdn.com/i/teamlogos/ncaa/500/default.png'} 
                            alt={`${team.team_name} logo`}
                            style={{ width: '20px', height: '20px', objectFit: 'contain' }}
                          />
                          <span 
                            style={{ 
                              fontWeight: 'bold',
                              textTransform: 'uppercase',
                              fontFamily: '"Trebuchet MS", Arial, sans-serif',
                              fontSize: '11px'
                            }}
                          >
                            {team.abbreviation || team.team_name?.substring(0, 4).toUpperCase()}
                          </span>
                        </a>
                        {team.power_rank && team.power_rank <= 134 && (
                          <span style={{
                            backgroundColor: colors.bg,
                            color: colors.text,
                            padding: '2px 4px',
                            borderRadius: '3px',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            minWidth: '20px',
                            textAlign: 'center'
                          }}>
                            #{team.power_rank}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  
                  {/* Record */}
                  <td style={{...cellStyle, fontWeight: 'bold'}}>
                    {team.record || `${team.wins}-${team.losses}`}
                  </td>
                  
                  {/* Deserved Wins */}
                  <td style={{...cellStyle, backgroundColor: '#e8f5e8'}}>
                    {formatStat(team.deserved_wins, 1)}
                  </td>
                  
                  {/* Deserved vs Actual Difference */}
                  <td style={{
                    ...cellStyle,
                    backgroundColor: getLuckColor(team.deserved_vs_actual, 'deserved_difference'),
                    borderRight: '3px solid #28a745',
                    fontWeight: 'bold'
                  }}>
                    {team.deserved_vs_actual > 0 ? '+' : ''}{formatStat(team.deserved_vs_actual, 1)}
                  </td>
                  
                  {/* Close Games Record */}
                  <td style={{
                    ...cellStyle, 
                    fontWeight: 'bold',
                    borderRight: '3px solid #dc3545'
                  }}>
                    {team.close_game_record || `${team.close_game_wins}-${team.close_game_total - team.close_game_wins}`}
                  </td>
                  
                  {/* Fumble Recovery % */}
                  <td style={{...cellStyle, fontWeight: 'bold'}}>
                    {formatStat(team.fumble_recovery_rate, 1)}%
                  </td>
                  
                  {/* Interception Rate % */}
                  <td style={{...cellStyle, fontWeight: 'bold'}}>
                    {formatStat(team.interception_rate, 1)}%
                  </td>
                  
                  {/* Turnover Margin */}
                  <td style={{
                    ...cellStyle,
                    backgroundColor: getLuckColor(team.turnover_margin, 'turnover_margin'),
                    fontWeight: 'bold'
                  }}>
                    {team.turnover_margin > 0 ? '+' : ''}{team.turnover_margin}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '20px',
        fontSize: '12px',
        color: '#6c757d',
        borderTop: '1px solid #dee2e6'
      }}>
        <h4 style={{ margin: '0 0 10px 0' }}>How to Read This:</h4>
        <ul style={{ margin: '0', paddingLeft: '20px' }}>
          <li><strong>Deserved Wins:</strong> Sum of postgame win probabilities based on actual performance</li>
          <li><strong>Difference:</strong> Deserved wins minus actual wins - positive = unlucky/deserved better, negative = lucky/overperformed</li>
          <li><strong>Close Games:</strong> Record in games decided by 8 points or less</li>
          <li><strong>Fumble Recovery %:</strong> Percentage of all fumbles in team's games that were recovered by the team</li>
          <li><strong>Interception Rate %:</strong> Percentage of total interceptions + deflections in team's games made by the team</li>
          <li><strong>Turnover Margin:</strong> Total takeaways minus total turnovers</li>
          <li><strong>Rankings:</strong> FBS-only power rankings (1-134)</li>
        </ul>
      </div>
    </div>
  );
};

export default LuckLeaderboard;