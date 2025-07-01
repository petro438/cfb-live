import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

// Helper function to get rank color (matches team page pattern)
const getRankColor = (rank, totalTeams = 134, isHigherBetter = true) => {
  const percentile = isHigherBetter ? 
    ((totalTeams - rank + 1) / totalTeams) * 100 : 
    (rank / totalTeams) * 100;
  
  let bgColor;
  if (percentile >= 96) bgColor = '#58c36c'; // Elite
  else if (percentile >= 91) bgColor = '#6aca7c'; // Excellent
  else if (percentile >= 86) bgColor = '#7cd08b'; // Very Good
  else if (percentile >= 81) bgColor = '#8dd69b'; // Good
  else if (percentile >= 76) bgColor = '#9fddaa'; // Above Average
  else if (percentile >= 71) bgColor = '#b0e3ba'; // Solid
  else if (percentile >= 66) bgColor = '#c2e9c9'; // Decent
  else if (percentile >= 61) bgColor = '#d4f0d9'; // Okay
  else if (percentile >= 56) bgColor = '#e5f6e8'; // Below Average
  else if (percentile >= 51) bgColor = '#f7fcf8'; // Poor
  else if (percentile >= 46) bgColor = '#fdf5f4'; // Poor
  else if (percentile >= 41) bgColor = '#fbe1df'; // Bad
  else if (percentile >= 36) bgColor = '#f9cdc9'; // Bad
  else if (percentile >= 31) bgColor = '#f7b9b4'; // Very Bad
  else if (percentile >= 26) bgColor = '#f5a59f'; // Very Bad
  else if (percentile >= 21) bgColor = '#f2928a'; // Terrible
  else if (percentile >= 16) bgColor = '#f07e74'; // Terrible
  else if (percentile >= 11) bgColor = '#ee6a5f'; // Awful
  else if (percentile >= 6) bgColor = '#ec564a'; // Awful
  else bgColor = '#ea4335'; // Worst
  
  // Calculate text color for contrast
  const color = bgColor.replace('#', '');
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const textColor = luminance > 0.5 ? '#000000' : '#ffffff';
  
  return {
    bg: bgColor,
    text: textColor
  };
};

// StatCell component for colored values
const StatCell = ({ value, rank, isHigherBetter = true, totalForPercentiles, showRank = false }) => {
  const colors = getRankColor(rank, totalForPercentiles, isHigherBetter);
  
  return (
    <td style={{
      backgroundColor: colors.bg,
      color: colors.text,
      padding: '6px 4px',
      border: '1px solid #dee2e6',
      textAlign: 'center',
      fontFamily: 'Consolas, monospace',
      fontWeight: 'bold',
      width: '80px' // Reduced from 100px
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ fontSize: '12px', lineHeight: '1' }}>
          {typeof value === 'number' ? value.toFixed(1) : value}
        </div>
        {showRank && (
          <div style={{
            fontSize: '10px',
            fontWeight: 'normal',
            opacity: 0.8,
            marginTop: '2px',
            lineHeight: '1'
          }}>
            #{rank}
          </div>
        )}
      </div>
    </td>
  );
};

const SOSLeaderboard = () => {
  const [sosData, setSOSData] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overall');
  const [sortConfig, setSortConfig] = useState({ key: 'sos_rank', direction: 'asc' });
  const [selectedConference, setSelectedConference] = useState('all');
  const [conferences, setConferences] = useState([]);
  const [rankingScope, setRankingScope] = useState('national');
  const [conferenceGamesOnly, setConferenceGamesOnly] = useState(false);
  const [regularSeasonOnly, setRegularSeasonOnly] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState('2024');
  const [selectedClassification, setSelectedClassification] = useState('fbs');
  const [availableSeasons] = useState(['2024', '2025']);
  const [showExplanation, setShowExplanation] = useState(false);

  const fetchSOSData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const startTime = performance.now();
      console.log(`🚀 Starting SOS data fetch for ${selectedSeason}...`);
      
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      
      // Use the existing fast endpoint that reads from strength_of_schedule table
      const baseUrl = `${API_URL}/api/leaderboards/strength-of-schedule-fast/${selectedSeason}`;
      const url = new URL(baseUrl);
      
      if (selectedClassification !== 'all') {
        url.searchParams.append('classification', selectedClassification);
      }
      
      console.log('🔍 Fetching SOS data:', url.toString());
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // Reduced timeout since it's pre-calculated
      
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.teams && Array.isArray(data.teams)) {
        let teams = data.teams;
        
        // Get power ratings for proper ranking badges
        const powerRatingsResponse = await fetch(`${API_URL}/api/power-rankings?season=${selectedSeason}`);
        const powerRatingsData = await powerRatingsResponse.json();
        const powerRatings = Array.isArray(powerRatingsData) ? powerRatingsData : powerRatingsData.teams || [];
        
        // Create a map for quick lookup of power ratings and ranks
        const powerRatingMap = new Map();
        powerRatings.forEach((team, index) => {
          powerRatingMap.set(team.team_name || team.teamName, {
            rating: team.power_rating || team.powerRating,
            rank: team.power_rank || team.powerRank || index + 1
          });
        });
        
        // Apply frontend filters if needed (since backend doesn't handle these yet)
        teams = teams.filter(team => {
          // Apply conference/regular season filters on frontend for now
          // Note: This is imperfect since we're filtering already-calculated data
          // but it's better than trying to recalculate everything
          return true; // Keep all teams, show filter status in UI
        });
        
        // Enhance teams with power rating data and fix Top 40 formatting
        const enhancedTeams = teams.map(team => {
          const powerData = powerRatingMap.get(team.team_name);
          
          return {
            ...team,
            team: team.team_name, // Standardize field name
            power_rating: powerData?.rating || 0,
            power_rating_rank: powerData?.rank || 999,
            win_difference: parseFloat(team.actual_wins || 0) - parseFloat(team.projected_wins || 0),
            top40_record: `${team.top40_wins || 0}-${(team.top40_games || 0) - (team.top40_wins || 0)}`
          };
        });
        
        setSOSData(enhancedTeams);
        setMetadata(data.metadata);
        
        const uniqueConferences = [...new Set(enhancedTeams.map(team => team.conference).filter(Boolean))].sort();
        setConferences(uniqueConferences);
        
        const endTime = performance.now();
        console.log(`✅ SOS data loaded in ${(endTime - startTime).toFixed(0)}ms for ${enhancedTeams.length} teams`);
        
      } else {
        throw new Error('API returned unexpected format');
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError(err.message);
      }
      console.error('❌ Error fetching SOS data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSOSData();
  }, [selectedSeason, selectedClassification]); // Removed filter dependencies since we're using pre-calculated data

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedAndFilteredData = () => {
    let data = [...sosData];
    
    if (selectedConference !== 'all') {
      data = data.filter(team => team.conference === selectedConference);
    }
    
    if (sortConfig.key) {
      data.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        
        if (typeof aValue === 'string' && !isNaN(parseFloat(aValue))) {
          aValue = parseFloat(aValue);
        }
        if (typeof bValue === 'string' && !isNaN(parseFloat(bValue))) {
          bValue = parseFloat(bValue);
        }
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    
    return data;
  };

  const getSortArrow = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return <span style={{ opacity: 0.3, marginLeft: '4px' }}>↕</span>;
    }
    return sortConfig.direction === 'asc' ? 
      <span style={{ marginLeft: '4px' }}>↑</span> : 
      <span style={{ marginLeft: '4px' }}>↓</span>;
  };

  if (loading) {
    return (
      <div style={{ 
        padding: '8px', 
        fontFamily: 'Trebuchet MS, sans-serif',
        backgroundColor: '#ffffff',
        minHeight: '100vh'
      }}>
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 8px',
          color: '#6c757d'
        }}>
          Loading strength of schedule data for {selectedSeason}...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '8px', 
        fontFamily: 'Trebuchet MS, sans-serif',
        backgroundColor: '#ffffff',
        minHeight: '100vh'
      }}>
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 8px',
          color: '#ea4335'
        }}>
          Error loading data: {error}
        </div>
      </div>
    );
  }

  const totalTeams = selectedConference === 'all' ? sosData.length : 
                   (rankingScope === 'national' ? sosData.length : getSortedAndFilteredData().length);

  return (
    <div style={{ 
      padding: '8px', 
      fontFamily: 'Trebuchet MS, sans-serif',
      backgroundColor: '#ffffff',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{ 
        marginBottom: '16px',
        textAlign: 'center'
      }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#212529',
          margin: '0 0 8px 0',
          fontFamily: 'Trebuchet MS, sans-serif'
        }}>
          {selectedSeason} STRENGTH OF SCHEDULE
        </h1>
        <p style={{
          fontSize: '14px',
          color: '#6c757d',
          margin: '0 0 16px 0',
          fontFamily: 'Trebuchet MS, sans-serif'
        }}>
          {selectedClassification.toUpperCase()} teams • {conferenceGamesOnly ? 'Conference games only • ' : ''}{!regularSeasonOnly ? 'Including postseason • ' : ''}
          Strength of schedule calculated using current team ratings for active seasons & end-of-season rankings for past seasons.
        </p>
      </div>

      {/* Explanation Section */}
      <div style={{
        marginBottom: '16px',
        textAlign: 'center'
      }}>
        <button
          onClick={() => setShowExplanation(!showExplanation)}
          style={{
            padding: '8px 16px',
            border: '1px solid #007bff',
            borderRadius: '4px',
            backgroundColor: showExplanation ? '#007bff' : '#ffffff',
            color: showExplanation ? '#ffffff' : '#007bff',
            fontFamily: 'Trebuchet MS, sans-serif',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          {showExplanation ? 'Hide' : 'Explanation of These Stats'} {showExplanation ? '▲' : '▼'}
        </button>
        
        {showExplanation && (
          <div style={{
            backgroundColor: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            padding: '16px',
            marginTop: '8px',
            textAlign: 'left',
            maxWidth: '800px',
            margin: '8px auto 0'
          }}>
            <div style={{ fontSize: '14px', color: '#212529', lineHeight: '1.5' }}>
              <p style={{ margin: '0 0 12px 0', fontWeight: 'bold' }}>
                <strong>Strength of Schedule:</strong> Average rating of opponents.
              </p>
              <p style={{ margin: '0 0 12px 0', fontWeight: 'bold' }}>
                <strong>Expected Wins:</strong> Total expected wins based on win probabilities from pregame betting lines, not season-long win totals.
              </p>
              <p style={{ margin: '0 0 0 0', fontWeight: 'bold' }}>
                <strong>Difficulty:</strong> A coinflip (🪙) is a game within 40-60% win probability. Lock (🔒) is 80%+ win probability. Longshot (🎯) is a less than 20% win probability.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Season, Classification, and Conference Filters */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: '16px',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{
            fontFamily: 'Trebuchet MS, sans-serif',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#212529'
          }}>
            SEASON:
          </label>
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            style={{
              padding: '6px 12px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              fontFamily: 'Trebuchet MS, sans-serif',
              fontSize: '14px',
              backgroundColor: '#ffffff',
              cursor: 'pointer'
            }}
          >
            {availableSeasons.map(season => (
              <option key={season} value={season}>
                {season}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{
            fontFamily: 'Trebuchet MS, sans-serif',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#212529'
          }}>
            DIVISION:
          </label>
          <select
            value={selectedClassification}
            onChange={(e) => setSelectedClassification(e.target.value)}
            style={{
              padding: '6px 12px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              fontFamily: 'Trebuchet MS, sans-serif',
              fontSize: '14px',
              backgroundColor: '#ffffff',
              cursor: 'pointer'
            }}
          >
            <option value="fbs">FBS</option>
            <option value="fcs">FCS</option>
            <option value="all">All Divisions</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{
            fontFamily: 'Trebuchet MS, sans-serif',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#212529'
          }}>
            CONFERENCE:
          </label>
          <select
            value={selectedConference}
            onChange={(e) => setSelectedConference(e.target.value)}
            style={{
              padding: '6px 12px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              fontFamily: 'Trebuchet MS, sans-serif',
              fontSize: '14px',
              backgroundColor: '#ffffff',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Conferences</option>
            {conferences.map(conference => (
              <option key={conference} value={conference}>
                {conference}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter Tabs - Sticky with borders */}
      <div style={{
        position: 'sticky',
        top: '0',
        zIndex: 100,
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #dee2e6',
        paddingTop: '8px',
        paddingBottom: '8px',
        marginBottom: '0',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '4px'
        }}>
          {['overall', 'remaining', 'played'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 16px',
                border: '2px solid #007bff',
                backgroundColor: activeTab === tab ? '#007bff' : '#ffffff',
                color: activeTab === tab ? '#ffffff' : '#007bff',
                fontFamily: 'Trebuchet MS, sans-serif',
                fontSize: '14px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                borderRadius: '4px'
              }}
            >
              {tab === 'overall' ? 'OVERALL' : tab === 'remaining' ? 'REMAINING' : 'PLAYED'}
            </button>
          ))}
        </div>
      </div>

      {/* Checkbox Options */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: '16px',
        marginTop: '16px',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '8px 16px',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#856404'
        }}>
          <span>⚠️ Note: Filters coming soon - currently showing all regular season games</span>
        </div>
      </div>

      {/* Desktop Table */}
      <div style={{ 
        overflowX: 'auto'
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '14px',
          lineHeight: '1.2'
        }}>
          <thead>
            <tr style={{ 
              backgroundColor: '#f8f9fa'
            }}>
              <th 
                style={{ 
                  padding: '8px 4px', 
                  textAlign: 'left', 
                  border: '1px solid #dee2e6',
                  fontFamily: 'Trebuchet MS, sans-serif',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
                onClick={() => handleSort('team')}
              >
                TEAM 
                <span className="sort-arrow-desktop">{getSortArrow('team')}</span>
              </th>
              <th 
                style={{ 
                  padding: '8px 4px', 
                  textAlign: 'center', 
                  border: '1px solid #dee2e6',
                  borderLeft: '3px solid #007bff',
                  borderRight: '3px solid #007bff',
                  fontFamily: 'Trebuchet MS, sans-serif',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  userSelect: 'none',
                  minWidth: '60px',
                  width: '80px' // Reduced width
                }}
                onClick={() => handleSort(
                  activeTab === 'overall' ? 'sos_overall' : 
                  activeTab === 'remaining' ? 'sos_remaining' : 
                  'sos_played'
                )}
              >
                <span className="sos-header-desktop">
                  {activeTab === 'overall' ? 'SOS OVERALL' : 
                  activeTab === 'remaining' ? 'SOS REMAINING' : 
                  'SOS PLAYED'}
                </span>
                <span className="sos-header-mobile" style={{ display: 'none' }}>
                  SOS
                </span>
                
                <span className="sort-arrow-desktop">{getSortArrow(
                  activeTab === 'overall' ? 'sos_overall' : 
                  activeTab === 'remaining' ? 'sos_remaining' : 
                  'sos_played'
                )}</span>
              </th>
        
              <th 
                style={{ 
                  padding: '8px 4px', 
                  textAlign: 'center', 
                  border: '1px solid #dee2e6',
                  borderLeft: '3px solid #28a745',
                  backgroundColor: '#f8fff8',
                  fontFamily: 'Trebuchet MS, sans-serif',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
                onClick={() => handleSort('actual_wins')}
              >
                RECORD
                <span className="sort-arrow-desktop">{getSortArrow('actual_wins')}</span>
              </th>
              
              <th 
                style={{ 
                  padding: '8px 4px', 
                  textAlign: 'center', 
                  border: '1px solid #dee2e6',
                  backgroundColor: '#f8fff8',
                  fontFamily: 'Trebuchet MS, sans-serif',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
                onClick={() => handleSort('projected_wins')}
              >
                EXP. WINS
                <span className="sort-arrow-desktop">{getSortArrow('projected_wins')}</span>
              </th>
              
              <th 
                style={{ 
                  padding: '8px 4px', 
                  textAlign: 'center', 
                  border: '1px solid #dee2e6',
                  borderRight: '3px solid #28a745',
                  backgroundColor: '#f8fff8',
                  fontFamily: 'Trebuchet MS, sans-serif',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
                onClick={() => handleSort('win_difference')}
              >
                ACT VS EXP
                <span className="sort-arrow-desktop">{getSortArrow('win_difference')}</span>
              </th>
              
              <th 
                style={{ 
                  padding: '8px 4px', 
                  textAlign: 'center', 
                  border: '1px solid #dee2e6',
                  fontFamily: 'Trebuchet MS, sans-serif',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  userSelect: 'none',
                  minWidth: '80px'
                }}
                onClick={() => handleSort('top40_games')}
              >
                TOP 40
                <span className="sort-arrow-desktop">{getSortArrow('top40_games')}</span>
              </th>
              
              <th 
                style={{ 
                  padding: '8px 4px', 
                  textAlign: 'center', 
                  border: '1px solid #dee2e6',
                  fontFamily: 'Trebuchet MS, sans-serif',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  textTransform: 'uppercase'
                }}
              >
                DIFFICULTY
                <div 
                  title="Game difficulty breakdown: 🪙 Coinflip (40-60% win probability), 🔒 Sure Thing (80%+ win probability), 🎯 Longshot (<20% win probability)"
                  style={{ 
                    cursor: 'help',
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '4px',
                    marginTop: '4px',
                    fontSize: '10px'
                  }}
                  className="difficulty-emojis-desktop"
                >
                  <span>🪙</span>
                  <span>🔒</span>
                  <span>🎯</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {getSortedAndFilteredData().map((team, index) => {
              const rank = parseInt(team.sos_rank);
              const powerRank = team.power_rating_rank || 999;
              
              return (
                <tr key={team.team} style={{
                  backgroundColor: index % 2 === 1 ? '#f8f9fa' : '#ffffff'
                }}>
                  {/* Team Name */}
                  <td style={{ 
                    padding: '8px 4px', 
                    border: '1px solid #dee2e6',
                    fontFamily: 'Trebuchet MS, sans-serif',
                    fontWeight: 'bold',
                    textTransform: 'uppercase'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {team.logo_url && (
                        <img 
                          src={team.logo_url} 
                          alt={team.team}
                          style={{ 
                            width: '20px', 
                            height: '20px',
                            objectFit: 'contain'
                          }}
                        />
                      )}
                      <Link 
                        to={`/team/${encodeURIComponent(team.team)}?season=${selectedSeason}`}
                        style={{ 
                          textDecoration: 'none', 
                          color: '#007bff',
                          fontWeight: 'bold',
                          textTransform: 'uppercase'
                        }}
                      >
                        <span className="team-name-desktop">{team.team}</span>
                        <span className="team-name-mobile" style={{ display: 'none' }}>
                          {team.abbreviation || team.team}
                        </span>
                      </Link>
                      {/* Rating Badge with correct rank */}
                      {(() => {
                        const colors = getRankColor(powerRank, totalTeams, true);
                        return (
                          <span style={{
                            fontSize: '10px',
                            color: colors.text,
                            fontFamily: '"Trebuchet MS", Arial, sans-serif',
                            fontWeight: 'bold',
                            backgroundColor: colors.bg,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            marginLeft: '4px',
                            border: '1px solid rgba(0,0,0,0.1)',
                            minWidth: '20px',
                            textAlign: 'center',
                            display: 'inline-block'
                          }}
                          title={`Power Rating: ${team.power_rating || team.team_rating} (Rank #${powerRank})`}
                          >
                            #{powerRank}
                          </span>
                        );
                      })()}
                    </div>
                  </td>
                  
                  {/* SOS Column */}
                  <StatCell 
                    value={
                      activeTab === 'overall' ? (team.sos_overall ? parseFloat(team.sos_overall) : 0) :
                      activeTab === 'remaining' ? (team.sos_remaining ? parseFloat(team.sos_remaining) : 0) :
                      (team.sos_played && team.sos_played !== '0.000' ? parseFloat(team.sos_played) : 0)
                    }
                    rank={selectedConference === 'all' ? rank : 
                          (rankingScope === 'national' ? rank : 
                          getSortedAndFilteredData()
                            .sort((a, b) => parseFloat(b.sos_overall) - parseFloat(a.sos_overall))
                            .findIndex(t => t.team === team.team) + 1)}
                    isHigherBetter={false}
                    totalForPercentiles={totalTeams}
                    showRank={true}
                  />
                  
                  {/* Record */}
                  <td style={{ 
                    padding: '8px 4px', 
                    border: '1px solid #dee2e6',
                    borderLeft: '3px solid #28a745',
                    backgroundColor: '#f8fff8',
                    fontFamily: 'Consolas, monospace',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}>
                    {team.actual_wins || 0}-{team.actual_losses || 0}
                  </td>
                  
                  {/* Expected Wins */}
                  <td style={{
                    padding: '8px 4px',
                    border: '1px solid #dee2e6',
                    backgroundColor: '#f8fff8',
                    fontFamily: 'Consolas, monospace',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}>
                    {team.projected_wins ? parseFloat(team.projected_wins).toFixed(1) : '0.0'}
                  </td>
                  
                  {/* Win Difference */}
                  <td style={{
                    padding: '8px 4px',
                    border: '1px solid #dee2e6',
                    borderRight: '3px solid #28a745',
                    backgroundColor: (() => {
                      const diff = team.win_difference;
                      if (diff > 1) return '#d4edda';
                      if (diff < -1) return '#f8d7da';
                      return '#f8fff8';
                    })(),
                    fontFamily: 'Consolas, monospace',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    color: (() => {
                      const diff = team.win_difference;
                      if (diff > 1) return '#155724';
                      if (diff < -1) return '#721c24';
                      return '#212529';
                    })()
                  }}>
                    {team.win_difference > 0 ? '+' : ''}{team.win_difference.toFixed(1)}
                  </td>
                  
                  {/* Top 40 Record */}
                  <td style={{ 
                    padding: '8px 4px', 
                    border: '1px solid #dee2e6',
                    fontFamily: 'Consolas, monospace',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    minWidth: '80px',
                    whiteSpace: 'nowrap'
                  }}>
                    {team.top40_record}
                  </td>
                  
                  {/* Difficulty */}
                  <td 
                    style={{ 
                      padding: '8px 4px', 
                      border: '1px solid #dee2e6',
                      fontFamily: 'Consolas, monospace',
                      textAlign: 'center'
                    }}
                    title="Game difficulty breakdown: 🪙 Coinflip (40-60% win probability), 🔒 Sure Thing (80%+ win probability), 🎯 Longshot (<20% win probability)"
                  >
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'center',
                      alignItems: 'center', 
                      gap: '6px',
                      fontSize: '12px',
                      lineHeight: '1.2'
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '2px',
                        color: '#007bff'
                      }}>
                        <span style={{ fontSize: '10px' }} className="difficulty-emojis-desktop">🪙</span>
                        <span style={{ fontWeight: 'bold' }}>{team.coinflip_games || 0}</span>
                      </div>
                      
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '2px',
                        color: '#28a745'
                      }}>
                        <span style={{ fontSize: '10px' }} className="difficulty-emojis-desktop">🔒</span>
                        <span style={{ fontWeight: 'bold' }}>{team.sure_thing_games || 0}</span>
                      </div>
                      
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '2px',
                        color: '#dc3545'
                      }}>
                        <span style={{ fontSize: '10px' }} className="difficulty-emojis-desktop">🎯</span>
                        <span style={{ fontWeight: 'bold' }}>{team.longshot_games || 0}</span>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        padding: '16px 8px',
        marginTop: '16px',
        borderTop: '1px solid #dee2e6',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{
          fontSize: '12px',
          color: '#6c757d',
          fontFamily: 'Trebuchet MS, sans-serif'
        }}>
          {conferenceGamesOnly && (
            <div style={{ marginBottom: '4px', fontWeight: 'bold', color: '#28a745' }}>
              ⚠️ Conference Games Only - Showing {metadata?.total_teams || sosData.length} teams
            </div>
          )}
          {!regularSeasonOnly && (
            <div style={{ marginBottom: '4px', fontWeight: 'bold', color: '#007bff' }}>
              📅 Including Postseason Games - Showing {metadata?.total_teams || sosData.length} teams
            </div>
          )}
          <div style={{ marginBottom: '4px' }}>
            <strong>{selectedSeason}</strong> • <strong>{selectedClassification.toUpperCase()}</strong> • 
            {metadata?.total_teams || sosData.length} teams analyzed
          </div>
          Win probabilities calculated using NORM.DIST with 13.5 standard deviation • Home field advantage: +2.15 points
        </div>
      </div>

      {/* Enhanced Mobile CSS */}
      <style>{`
        @media (max-width: 768px) {
          .team-name-desktop {
            display: none !important;
          }
          .team-name-mobile {
            display: inline !important;
          }
          .sort-arrow-desktop {
            display: none !important;
          }
          .difficulty-emojis-desktop {
            display: none !important;
          }
          .sos-header-desktop {
            display: none !important;
          }
          .sos-header-mobile {
            display: inline !important;
          }
          table {
            min-width: 600px;
          }
        }
        @media (min-width: 769px) {
          .team-name-desktop {
            display: inline !important;
          }
          .team-name-mobile {
            display: none !important;
          }
          .sort-arrow-desktop {
            display: inline !important;
          }
          .difficulty-emojis-desktop {
            display: inline !important;
          }
          .sos-header-desktop {
            display: inline !important;
          }
          .sos-header-mobile {
            display: none !important;
          }
        }
      `}</style>  
    </div>
  );
};

export default SOSLeaderboard;