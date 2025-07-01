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

  // Helper function to get the correct column suffix based on filters
  const getColumnSuffix = () => {
    if (conferenceGamesOnly && regularSeasonOnly) {
      return '_conf_reg';
    } else if (conferenceGamesOnly) {
      return '_conference';  
    } else if (regularSeasonOnly) {
      return '_regular';
    }
    return ''; // Default columns
  };

  // Helper function to get values based on active tab and filters
  const getTabValue = (team, baseFieldName) => {
    const suffix = getColumnSuffix();
    let fieldName;
    
    if (activeTab === 'overall') {
      fieldName = `${baseFieldName}${suffix}`;
    } else if (activeTab === 'remaining') {
      fieldName = `${baseFieldName.replace('overall', 'remaining')}${suffix}`;
    } else if (activeTab === 'played') {
      fieldName = `${baseFieldName.replace('overall', 'played')}${suffix}`;
    }
    
    const value = team[fieldName];
    // Always return a number, defaulting to 0 if value is null/undefined/NaN
    return (value !== null && value !== undefined && !isNaN(parseFloat(value))) ? parseFloat(value) : 0;
  };

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
      
      // Add filter parameters
      if (conferenceGamesOnly) {
        url.searchParams.append('conferenceOnly', 'true');
      }
      
      url.searchParams.append('regularSeasonOnly', regularSeasonOnly.toString());
      
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
        
        // Create a map for quick lookup of power ratings and ranks (FBS ONLY)
        const powerRatingMap = new Map();
        powerRatings.filter(team => {
          // Only include FBS teams for ranking calculations
          return team.classification === 'fbs' || team.classification === 'FBS';
        }).forEach((team, index) => {
          powerRatingMap.set(team.team_name || team.teamName, {
            rating: team.power_rating || team.powerRating,
            rank: index + 1 // Now ranks 1-134 for FBS only
          });
        });
        
        // Apply frontend filters based on checkboxes
        if (conferenceGamesOnly || !regularSeasonOnly) {
          // Show filter warning since we can't perfectly filter pre-calculated data
          // but keep all teams for now
          teams = teams.filter(() => true);
        }
        
        // Enhance teams with power rating data and fix Top 40 formatting
        const enhancedTeams = teams.map(team => {
          const powerData = powerRatingMap.get(team.team_name);
          
          return {
            ...team,
            team: team.team_name, // Standardize field name
            power_rating: powerData?.rating || 0,
            power_rating_rank: powerData?.rank || 999,
            win_difference: parseFloat(team.actual_wins || 0) - parseFloat(team.projected_wins || 0),
            top40_record: `${team.top40_wins || 0}-${(team.top40_games || 0) - (team.top40_wins || 0)}`,
            // Fix expected wins showing as 0 - use projected_wins from table
            projected_wins: team.projected_wins || '0.0'
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
  }, [conferenceGamesOnly, regularSeasonOnly, selectedSeason, selectedClassification]); // Re-added filter dependencies

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
            padding: '10px 20px',
            border: '2px solid #28a745',
            borderRadius: '8px',
            backgroundColor: showExplanation ? '#28a745' : '#ffffff',
            color: showExplanation ? '#ffffff' : '#28a745',
            fontFamily: 'Trebuchet MS, sans-serif',
            fontSize: '15px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
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

      {/* Checkbox Options - Re-enabled */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: '16px',
        marginTop: '16px',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        <label style={{
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#212529',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer'
        }}>
          <input
            type="checkbox"
            checked={conferenceGamesOnly}
            onChange={(e) => setConferenceGamesOnly(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          CONFERENCE GAMES ONLY
        </label>

        <label style={{
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#212529',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer'
        }}>
          <input
            type="checkbox"
            checked={regularSeasonOnly}
            onChange={(e) => setRegularSeasonOnly(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          REGULAR SEASON ONLY
        </label>
        
        {(conferenceGamesOnly || !regularSeasonOnly) && (
          <div style={{
            padding: '4px 8px',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#856404'
          }}>
            ⚠️ Note: Filters affect future calculations
          </div>
        )}
      </div>

      {/* Desktop Table */}
      <div style={{ 
        overflowX: 'auto',
        maxWidth: '1000px', // Centered and narrower
        margin: '0 auto'
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
                  borderLeft: '3px solid #007bff', // Changed to blue
                  backgroundColor: '#e3f2fd', // Light blue background
                  fontFamily: 'Trebuchet MS, sans-serif',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  userSelect: 'none',
                  width: '70px' // Reduced width for mobile
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
                  backgroundColor: '#e3f2fd', // Light blue background
                  fontFamily: 'Trebuchet MS, sans-serif',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  userSelect: 'none',
                  width: '70px' // Reduced width for mobile
                }}
                onClick={() => handleSort('projected_wins')}
              >
                <span className="exp-wins-desktop">EXP. WINS</span>
                <span className="exp-wins-mobile" style={{ display: 'none' }}>EXP<br/>WINS</span>
                <span className="sort-arrow-desktop">{getSortArrow('projected_wins')}</span>
              </th>
              
              <th 
                style={{ 
                  padding: '8px 4px', 
                  textAlign: 'center', 
                  border: '1px solid #dee2e6',
                  borderRight: '3px solid #007bff', // Changed to blue
                  fontFamily: 'Trebuchet MS, sans-serif',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
                onClick={() => handleSort('win_difference')}
              >
                <span className="act-vs-exp-desktop">ACT VS EXP</span>
                <span className="act-vs-exp-mobile" style={{ display: 'none' }}>ACT VS<br/>EXP</span>
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
                    value={getTabValue(team, 'sos_overall')}
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
                    borderLeft: '3px solid #007bff', // Changed to blue
                    backgroundColor: '#e3f2fd', // Light blue background
                    fontFamily: 'Consolas, monospace',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    width: '70px' // Reduced width
                  }}>
                    {activeTab === 'remaining' ? '0-0' : 
                     `${getTabValue(team, 'actual_wins')}-${getTabValue(team, 'actual_losses')}`}
                  </td>
                  
                  {/* Expected Wins */}
                  <td style={{
                    padding: '8px 4px',
                    border: '1px solid #dee2e6',
                    backgroundColor: '#e3f2fd', // Light blue background
                    fontFamily: 'Consolas, monospace',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    width: '70px' // Reduced width
                  }}>
                    {getTabValue(team, 'projected_wins').toFixed(1)}
                  </td>
                  
                  {/* Win Difference - Now uses 20-color percentile system */}
                  {(() => {
                    const diff = getTabValue(team, 'win_difference');
                    const diffRank = getSortedAndFilteredData()
                      .sort((a, b) => getTabValue(b, 'win_difference') - getTabValue(a, 'win_difference'))
                      .findIndex(t => t.team === team.team) + 1;
                    const diffColors = getRankColor(diffRank, totalTeams, true); // Higher difference = better = green
                    
                    return (
                      <td style={{
                        padding: '8px 4px',
                        border: '1px solid #dee2e6',
                        borderRight: '3px solid #007bff', // Changed to blue
                        backgroundColor: diffColors.bg,
                        color: diffColors.text,
                        fontFamily: 'Consolas, monospace',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        width: '90px'
                      }}>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <div style={{ fontSize: '12px', lineHeight: '1' }}>
                            {`${diff > 0 ? '+' : ''}${diff.toFixed(1)}`}
                          </div>
                          <div style={{
                            fontSize: '10px',
                            fontWeight: 'normal',
                            opacity: 0.8,
                            marginTop: '2px',
                            lineHeight: '1'
                          }}>
                            #{diffRank}
                          </div>
                        </div>
                      </td>
                    );
                  })()}
                  
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
                    {(() => {
                      const wins = getTabValue(team, 'top40_wins');
                      const games = getTabValue(team, 'top40_games');
                      const losses = games - wins;
                      return `${wins}-${losses}`;
                    })()}
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
                        <span style={{ fontSize: '10px' }} className="difficulty-emojis-desktop difficulty-emojis-mobile">🪙</span>
                        <span style={{ fontWeight: 'bold' }}>{getTabValue(team, 'coinflip_games')}</span>
                      </div>
                      
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '2px',
                        color: '#28a745'
                      }}>
                        <span style={{ fontSize: '10px' }} className="difficulty-emojis-desktop difficulty-emojis-mobile">🔒</span>
                        <span style={{ fontWeight: 'bold' }}>{getTabValue(team, 'sure_thing_games')}</span>
                      </div>
                      
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '2px',
                        color: '#dc3545'
                      }}>
                        <span style={{ fontSize: '10px' }} className="difficulty-emojis-desktop difficulty-emojis-mobile">🎯</span>
                        <span style={{ fontWeight: 'bold' }}>{getTabValue(team, 'longshot_games')}</span>
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
          /* Mobile header text changes */
          .exp-wins-desktop {
            display: none !important;
          }
          .exp-wins-mobile {
            display: inline !important;
          }
          .act-vs-exp-desktop {
            display: none !important;
          }
          .act-vs-exp-mobile {
            display: inline !important;
          }
          table {
            min-width: 600px;
          }
          /* Mobile font size reductions for record columns */
          td:nth-child(3), /* Record */
          td:nth-child(4), /* Expected Wins */
          td:nth-child(5) { /* Act vs Exp */
            font-size: 11px !important;
          }
          /* Show emojis on mobile for difficulty */
          .difficulty-emojis-mobile {
            display: inline !important;
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