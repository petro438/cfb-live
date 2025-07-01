import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';

const RushingStatsPage = () => {
  // State management
  const [teams, setTeams] = useState([]);
  const [filteredTeams, setFilteredTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filter state
  const [selectedSeason, setSelectedSeason] = useState('2024');
  const [selectedConference, setSelectedConference] = useState('all');
  const [offenseDefense, setOffenseDefense] = useState('offense');
  const [basicAdvanced, setBasicAdvanced] = useState('basic');
  const [totalPerGame, setTotalPerGame] = useState('per_game'); // Default to per game
  const [conferenceGamesOnly, setConferenceGamesOnly] = useState(false);
  const [regularSeasonOnly, setRegularSeasonOnly] = useState(true); // Default to regular season only
  
  // Available data
  const [availableSeasons, setAvailableSeasons] = useState(['2024', '2023']);
  const [availableConferences, setAvailableConferences] = useState([]);
  const [allConferences, setAllConferences] = useState([]); // Store all conferences
  const [sortConfig, setSortConfig] = useState({ key: 'rushing_rate', direction: 'desc' });
  const [conferenceRankingMode, setConferenceRankingMode] = useState('national'); // 'national' or 'conference'

  // Force recalculation when conference ranking mode changes
  useEffect(() => {
    console.log(`🔄 Conference ranking mode changed to: ${conferenceRankingMode}`);
    // This will trigger the useMemo recalculation
  }, [conferenceRankingMode]);

  // Reset conference ranking mode when switching to 'all' conferences
  useEffect(() => {
    if (selectedConference === 'all') {
      setConferenceRankingMode('national');
    }
  }, [selectedConference]);
  useEffect(() => {
    const fetchRushingStats = async () => {
      setLoading(true);
      try {
        const endpoint = `https://cfbapi-production.up.railway.app/api/leaderboards/rushing/${selectedSeason}`;
        const params = new URLSearchParams({
          offense_defense: offenseDefense,
          conference_games_only: conferenceGamesOnly,
          regular_season_only: regularSeasonOnly
        });
        
        if (selectedConference !== 'all') {
          params.append('conference', selectedConference);
        }
        
        console.log('🔍 Fetching from:', `${endpoint}?${params}`);
        
        const response = await fetch(`${endpoint}?${params}`);
        if (!response.ok) throw new Error('Failed to fetch rushing stats');
        
        const data = await response.json();
        console.log('📊 API Response:', data);
        
        // Handle both array and object with teams property
        const teamsData = Array.isArray(data) ? data : (data.teams || []);
        console.log('📋 Teams data:', teamsData.length, 'teams');
        
        setTeams(teamsData);
        
        // Extract ALL unique conferences for dropdown
        const allConfs = [...new Set(teamsData.map(team => team.conference))].filter(Boolean).sort();
        setAllConferences(['all', ...allConfs]);
        
        // Set available conferences (same as all conferences)
        setAvailableConferences(['all', ...allConfs]);
        
      } catch (err) {
        console.error('❌ Fetch error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRushingStats();
  }, [selectedSeason, offenseDefense, conferenceGamesOnly, regularSeasonOnly, selectedConference]);

  // Process and sort teams
  const processedTeams = useMemo(() => {
    console.log('🔄 Processing teams:', teams.length);
    
    if (!teams || teams.length === 0) {
      console.log('⚠️ No teams to process');
      return [];
    }
    
    let processed = teams.map((team, index) => {
      if (index < 3) {
        console.log('📊 Sample team data:', team);
      }
      
      // Calculate per-game stats if needed
      const gamesPlayed = team.games_played || 1;
      
      // Ensure we have valid numbers
      const rushingAttempts = parseInt(team.rushing_attempts) || 0;
      const rushingYards = parseInt(team.rushing_yards) || 0;
      const rushingTds = parseInt(team.rushing_tds) || 0;
      const totalPlays = parseInt(team.total_plays) || 0;
      const yardsPerRush = parseFloat(team.yards_per_rush) || 0;
      
      return {
        ...team,
        // Ensure we have team_name
        team_name: team.team_name || team.team,
        
        // Calculate rushing rate: rush_attempts / total_plays
        rushing_rate: totalPlays > 0 ? 
          ((rushingAttempts / totalPlays) * 100) : 0,
        
        // Per-game calculations
        rushing_attempts_per_game: totalPerGame === 'per_game' ? 
          (rushingAttempts / gamesPlayed) : rushingAttempts,
        rushing_yards_per_game: totalPerGame === 'per_game' ? 
          (rushingYards / gamesPlayed) : rushingYards,
        yards_per_rush_display: yardsPerRush,
        rushing_tds_per_game: totalPerGame === 'per_game' ? 
          (rushingTds / gamesPlayed) : rushingTds,
        rushing_rate_display: totalPlays > 0 ? 
          ((rushingAttempts / totalPlays) * 100) : 0,
          
        // Ensure numeric values
        rushing_attempts: rushingAttempts,
        rushing_yards: rushingYards,
        rushing_tds: rushingTds,
        yards_per_rush: yardsPerRush,
        games_played: gamesPlayed
      };
    });
    
    console.log('✅ Processed teams:', processed.length);

    // Apply conference filter
    if (selectedConference !== 'all') {
      processed = processed.filter(team => team.conference === selectedConference);
      console.log('🔍 After conference filter:', processed.length);
    }

    // Sort teams
    if (sortConfig.key) {
      processed.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];
        
        // Handle different data types
        if (typeof aVal === 'string') aVal = parseFloat(aVal) || 0;
        if (typeof bVal === 'string') bVal = parseFloat(bVal) || 0;
        
        return sortConfig.direction === 'desc' ? bVal - aVal : aVal - bVal;
      });
    }

    return processed;
  }, [teams, selectedConference, sortConfig, totalPerGame]);

  // Calculate percentile rankings
  const teamsWithRankings = useMemo(() => {
    console.log('📈 Starting percentile calculations for', processedTeams.length, 'teams');
    
    if (!processedTeams || processedTeams.length === 0) {
      console.log('⚠️ No processed teams for ranking');
      return [];
    }
    
    const rankedTeams = [...processedTeams];
    
    // Calculate percentiles for each stat
    const stats = ['rushing_rate_display', 'rushing_attempts', 'rushing_yards', 'yards_per_rush', 'rushing_tds'];
    if (totalPerGame === 'per_game') {
      stats[1] = 'rushing_attempts_per_game';
      stats[2] = 'rushing_yards_per_game'; 
      stats[4] = 'rushing_tds_per_game';
    }
    
    console.log('📊 Calculating percentiles for stats:', stats);
    
    stats.forEach((stat, statIndex) => {
      console.log(`🔢 Processing stat ${statIndex + 1}/${stats.length}: ${stat}`);
      console.log(`📊 Conference ranking mode: ${conferenceRankingMode}, Selected conference: ${selectedConference}`);
      
      // Determine ranking universe based on conference ranking mode
      const rankingUniverse = conferenceRankingMode === 'conference' && selectedConference !== 'all' 
        ? rankedTeams.filter(team => team.conference === selectedConference)
        : rankedTeams;
      
      console.log(`🎯 Ranking universe: ${rankingUniverse.length} teams (${conferenceRankingMode} mode)`);
      
      // Sort values - SPECIAL HANDLING FOR DEFENSE
      let sortedValues;
      if (offenseDefense === 'defense') {
        // Defense: LOWER is BETTER for ALL rushing stats
        // (Less rushing allowed = better defense)
        sortedValues = rankingUniverse
          .map(team => {
            const value = parseFloat(team[stat]);
            return isNaN(value) ? 999 : value; // Put invalid values at end (worst)
          })
          .sort((a, b) => a - b); // Ascending: lowest values first (best defense)
      } else {
        // Offense: higher is better for all stats
        sortedValues = rankingUniverse
          .map(team => {
            const value = parseFloat(team[stat]);
            return isNaN(value) ? 0 : value;
          })
          .sort((a, b) => b - a); // Descending for offense
      }
        
      console.log(`📋 ${stat} values range in ${conferenceRankingMode} mode: ${sortedValues[sortedValues.length-1]} to ${sortedValues[0]}`);
        
      rankedTeams.forEach((team, teamIndex) => {
        const value = parseFloat(team[stat]);
        const cleanValue = isNaN(value) ? (offenseDefense === 'defense' ? 999 : 0) : value;
        
        // Find rank within the appropriate universe - MORE ROBUST METHOD
        let rank = 1;
        if (offenseDefense === 'defense') {
          // Count how many teams in universe have LOWER values (better defense)
          rank = rankingUniverse.filter(t => {
            const tValue = parseFloat(t[stat]);
            const tCleanValue = isNaN(tValue) ? 999 : tValue;
            return tCleanValue < cleanValue;
          }).length + 1;
        } else {
          // Count how many teams in universe have HIGHER values (better offense)
          rank = rankingUniverse.filter(t => {
            const tValue = parseFloat(t[stat]);
            const tCleanValue = isNaN(tValue) ? 0 : tValue;
            return tCleanValue > cleanValue;
          }).length + 1;
        }
        
        // Calculate percentile (same for both offense and defense)
        const percentile = ((rankingUniverse.length - rank + 1) / rankingUniverse.length) * 100;
        
        team[`${stat}_rank`] = rank;
        team[`${stat}_percentile`] = percentile;
        
        if (teamIndex < 3 && (conferenceRankingMode === 'conference' || teamIndex < 1)) {
          console.log(`📊 ${team.team_name} (${team.conference}): ${stat}=${cleanValue}, rank=${rank}/${rankingUniverse.length}, percentile=${percentile.toFixed(1)}%`);
        }
      });
    });
    
    console.log('✅ Percentile calculations complete');
    return rankedTeams;
  }, [processedTeams, totalPerGame, conferenceRankingMode, selectedConference, offenseDefense]);

  // Get percentile color
  const getPercentileColor = (percentile) => {
    if (percentile >= 95) return '#58c36c';
    if (percentile >= 90) return '#6aca7c';
    if (percentile >= 85) return '#7cd08b';
    if (percentile >= 80) return '#8dd69b';
    if (percentile >= 75) return '#9fddaa';
    if (percentile >= 70) return '#b0e3ba';
    if (percentile >= 65) return '#c2e9c9';
    if (percentile >= 60) return '#d4f0d9';
    if (percentile >= 55) return '#e5f6e8';
    if (percentile >= 50) return '#f7fcf8';
    if (percentile >= 45) return '#fdf5f4';
    if (percentile >= 40) return '#fbe1df';
    if (percentile >= 35) return '#f9cdc9';
    if (percentile >= 30) return '#f7b9b4';
    if (percentile >= 25) return '#f5a59f';
    if (percentile >= 20) return '#f2928a';
    if (percentile >= 15) return '#f07e74';
    if (percentile >= 10) return '#ee6a5f';
    if (percentile >= 5) return '#ec564a';
    return '#ea4335';
  };

  // Format numbers based on filter selection
  const formatStat = (value, statType) => {
    if (value === null || value === undefined) return '-';
    
    const num = parseFloat(value);
    if (isNaN(num)) return '-';
    
    // Always format rushing_rate as percentage with 1 decimal
    if (statType === 'rushing_rate') {
      return `${num.toFixed(1)}%`;
    }
    
    // Always format yards_per_rush with 1 decimal
    if (statType === 'yards_per_rush') {
      return num.toFixed(1);
    }
    
    // Per-game stats always have 1 decimal
    if (totalPerGame === 'per_game') {
      return num.toFixed(1);
    }
    
    // Total stats: no decimals for counts
    return Math.round(num).toString();
  };

  // Sorting handler
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  // Get sort indicator
  const getSortIndicator = (columnKey) => {
    if (sortConfig.key !== columnKey) return ' ↕';
    return sortConfig.direction === 'desc' ? ' ↓' : ' ↑';
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '40px' }}>Loading rushing stats...</div>;
  if (error) return <div style={{ textAlign: 'center', padding: '40px', color: '#721c24' }}>Error: {error}</div>;

  // Debug info
  if (teams.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>
      No rushing stats data available. Check console for details.
    </div>;
  }

  // Show raw data for first few teams for debugging
  console.log('🔍 First 3 teams raw data:', teams.slice(0, 3));
  console.log('🔍 Processed teams count:', processedTeams.length);
  console.log('🔍 Teams with rankings count:', teamsWithRankings.length);

  return (
    <div style={{ 
      fontFamily: '"Trebuchet MS", sans-serif',
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px 8px'
    }}>
      {/* Header */}
      <h1 style={{
        textAlign: 'center',
        textTransform: 'uppercase',
        fontWeight: 'bold',
        fontSize: '24px',
        color: '#212529',
        marginBottom: '24px'
      }}>
        {offenseDefense.toUpperCase()} RUSHING STATS
      </h1>

      {/* Filters - 3 Tier System */}
      
      {/* Tier 1: Basic Selectors */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '16px',
        marginBottom: '16px',
        flexWrap: 'wrap'
      }}>
        <select 
          value={selectedSeason} 
          onChange={(e) => setSelectedSeason(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            fontFamily: '"Trebuchet MS", sans-serif'
          }}
        >
          {availableSeasons.map(season => (
            <option key={season} value={season}>{season}</option>
          ))}
        </select>

        <select 
          value={selectedConference} 
          onChange={(e) => setSelectedConference(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            fontFamily: '"Trebuchet MS", sans-serif'
          }}
        >
          {allConferences.map(conf => (
            <option key={conf} value={conf}>
              {conf === 'all' ? 'ALL CONFERENCES' : conf.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      {/* Tier 2: Page-Specific Toggles */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '24px',
        marginBottom: '16px',
        flexWrap: 'wrap'
      }}>
        {/* OFFENSE/DEFENSE - Rounded blue buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {['offense', 'defense'].map(type => (
            <button
              key={type}
              onClick={() => setOffenseDefense(type)}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '16px',
                background: offenseDefense === type ? '#007bff' : '#f8f9fa',
                color: offenseDefense === type ? 'white' : '#212529',
                fontFamily: '"Trebuchet MS", sans-serif',
                fontWeight: 'bold',
                cursor: 'pointer',
                textTransform: 'uppercase'
              }}
            >
              {type}
            </button>
          ))}
        </div>

        {/* BASIC/ADVANCED - Red bordered buttons */}
        <div style={{
          display: 'flex',
          border: '1px solid #dc3545',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          {['basic', 'advanced'].map(type => (
            <button
              key={type}
              onClick={() => setBasicAdvanced(type)}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: basicAdvanced === type ? '#dc3545' : 'white',
                color: basicAdvanced === type ? 'white' : '#dc3545',
                fontFamily: '"Trebuchet MS", sans-serif',
                fontWeight: 'bold',
                cursor: 'pointer',
                textTransform: 'uppercase'
              }}
            >
              {type}
            </button>
          ))}
        </div>

        {/* TOTAL/PER GAME - Green bordered buttons */}
        <div style={{
          display: 'flex',
          border: '1px solid #28a745',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          {['total', 'per_game'].map(type => (
            <button
              key={type}
              onClick={() => setTotalPerGame(type)}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: totalPerGame === type ? '#28a745' : 'white',
                color: totalPerGame === type ? 'white' : '#28a745',
                fontFamily: '"Trebuchet MS", sans-serif',
                fontWeight: 'bold',
                cursor: 'pointer',
                textTransform: 'uppercase'
              }}
            >
              {type === 'per_game' ? 'PER GAME' : 'TOTAL'}
            </button>
          ))}
        </div>
      </div>

      {/* Tier 3: Checkboxes */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '16px',
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          fontFamily: '"Trebuchet MS", sans-serif',
          fontSize: '14px'
        }}>
          <input
            type="checkbox"
            checked={conferenceGamesOnly}
            onChange={(e) => setConferenceGamesOnly(e.target.checked)}
            style={{ marginRight: '6px' }}
          />
          CONFERENCE GAMES ONLY
        </label>

        <label style={{
          display: 'flex',
          alignItems: 'center',
          fontFamily: '"Trebuchet MS", sans-serif',
          fontSize: '14px'
        }}>
          <input
            type="checkbox"
            checked={regularSeasonOnly}
            onChange={(e) => setRegularSeasonOnly(e.target.checked)}
            style={{ marginRight: '6px' }}
          />
          REGULAR SEASON ONLY
        </label>

        {/* Conference Ranking Mode - Show only when filtering by conference */}
        {selectedConference !== 'all' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: '"Trebuchet MS", sans-serif',
            fontSize: '14px'
          }}>
            <span>Rankings:</span>
            <select 
              value={conferenceRankingMode}
              onChange={(e) => setConferenceRankingMode(e.target.value)}
              style={{
                padding: '4px 8px',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                fontFamily: '"Trebuchet MS", sans-serif',
                fontSize: '12px'
              }}
            >
              <option value="national">National</option>
              <option value="conference">Conference Only</option>
            </select>
          </div>
        )}
      </div>

      {/* Results Summary */}
      <div style={{
        textAlign: 'center',
        marginBottom: '20px',
        fontFamily: '"Trebuchet MS", sans-serif',
        fontSize: '12px',
        color: '#6c757d'
      }}>
        Showing {teamsWithRankings.length} teams • {totalPerGame === 'total' ? 'Total' : 'Per Game'} Rushing Stats
      </div>

      {/* Desktop Table */}
      <div style={{ 
        display: 'block',
        '@media (max-width: 768px)': { display: 'none' }
      }} className="desktop-table">
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: '1px solid #dee2e6',
          backgroundColor: 'white'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa' }}>
              <th style={{
                padding: '8px 16px',
                textAlign: 'left',
                fontFamily: '"Trebuchet MS", sans-serif',
                fontWeight: 'bold',
                fontSize: '12px',
                textTransform: 'uppercase',
                borderBottom: '1px solid #dee2e6',
                borderRight: '1px solid #dee2e6',
                minWidth: '180px',
                cursor: 'pointer'
              }} onClick={() => handleSort('team_name')}>
                TEAM{getSortIndicator('team_name')}
              </th>
              <th style={{
                padding: '8px 16px',
                textAlign: 'center',
                fontFamily: '"Trebuchet MS", sans-serif',
                fontWeight: 'bold',
                fontSize: '12px',
                textTransform: 'uppercase',
                borderBottom: '1px solid #dee2e6',
                borderRight: '1px solid #dee2e6',
                minWidth: '60px',
                cursor: 'pointer'
              }} onClick={() => handleSort('games_played')}>
                GP{getSortIndicator('games_played')}
              </th>
              <th style={{
                padding: '8px 16px',
                textAlign: 'center',
                fontFamily: '"Trebuchet MS", sans-serif',
                fontWeight: 'bold',
                fontSize: '12px',
                textTransform: 'uppercase',
                borderBottom: '1px solid #dee2e6',
                borderRight: '1px solid #dee2e6',
                minWidth: '80px',
                cursor: 'pointer'
              }} onClick={() => handleSort('rushing_rate_display')}>
                RUSH RATE{getSortIndicator('rushing_rate_display')}
              </th>
              <th style={{
                padding: '8px 16px',
                textAlign: 'center',
                fontFamily: '"Trebuchet MS", sans-serif',
                fontWeight: 'bold',
                fontSize: '12px',
                textTransform: 'uppercase',
                borderBottom: '1px solid #dee2e6',
                borderRight: '1px solid #dee2e6',
                minWidth: '80px',
                cursor: 'pointer'
              }} onClick={() => handleSort(totalPerGame === 'per_game' ? 'rushing_attempts_per_game' : 'rushing_attempts')}>
                ATT{getSortIndicator(totalPerGame === 'per_game' ? 'rushing_attempts_per_game' : 'rushing_attempts')}
              </th>
              <th style={{
                padding: '8px 16px',
                textAlign: 'center',
                fontFamily: '"Trebuchet MS", sans-serif',
                fontWeight: 'bold',
                fontSize: '12px',
                textTransform: 'uppercase',
                borderBottom: '1px solid #dee2e6',
                borderRight: '1px solid #dee2e6',
                minWidth: '80px',
                cursor: 'pointer'
              }} onClick={() => handleSort(totalPerGame === 'per_game' ? 'rushing_yards_per_game' : 'rushing_yards')}>
                YARDS{getSortIndicator(totalPerGame === 'per_game' ? 'rushing_yards_per_game' : 'rushing_yards')}
              </th>
              <th style={{
                padding: '8px 16px',
                textAlign: 'center',
                fontFamily: '"Trebuchet MS", sans-serif',
                fontWeight: 'bold',
                fontSize: '12px',
                textTransform: 'uppercase',
                borderBottom: '1px solid #dee2e6',
                borderRight: '1px solid #dee2e6',
                minWidth: '80px',
                cursor: 'pointer'
              }} onClick={() => handleSort('yards_per_rush')}>
                Y/RUSH{getSortIndicator('yards_per_rush')}
              </th>
              <th style={{
                padding: '8px 16px',
                textAlign: 'center',
                fontFamily: '"Trebuchet MS", sans-serif',
                fontWeight: 'bold',
                fontSize: '12px',
                textTransform: 'uppercase',
                borderBottom: '1px solid #dee2e6',
                minWidth: '80px',
                cursor: 'pointer'
              }} onClick={() => handleSort(totalPerGame === 'per_game' ? 'rushing_tds_per_game' : 'rushing_tds')}>
                TDs{getSortIndicator(totalPerGame === 'per_game' ? 'rushing_tds_per_game' : 'rushing_tds')}
              </th>
            </tr>
          </thead>
          <tbody>
            {teamsWithRankings.map((team, index) => (
              <tr key={team.team_name} style={{
                backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa'
              }}>
                <td style={{
                  padding: '8px 16px',
                  fontFamily: '"Trebuchet MS", sans-serif',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  borderBottom: '1px solid #dee2e6',
                  borderRight: '1px solid #dee2e6'
                }}>
                  <Link 
                    to={`/team/${encodeURIComponent(team.team_name)}?season=${selectedSeason}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      textDecoration: 'none',
                      color: 'inherit'
                    }}
                  >
                    {team.logo_url && (
                      <img 
                        src={team.logo_url} 
                        alt={team.team_name}
                        style={{
                          width: '20px',
                          height: '20px',
                          marginRight: '8px',
                          objectFit: 'contain'
                        }}
                      />
                    )}
                    {team.team_name}
                  </Link>
                </td>
                <td style={{
                  padding: '8px 16px',
                  textAlign: 'center',
                  fontFamily: 'Consolas, monospace',
                  fontSize: '13px',
                  borderBottom: '1px solid #dee2e6',
                  borderRight: '1px solid #dee2e6'
                }}>
                  {team.games_played || 0}
                </td>
                <td style={{
                  padding: '8px 16px',
                  textAlign: 'center',
                  fontFamily: 'Consolas, monospace',
                  fontSize: '13px',
                  borderBottom: '1px solid #dee2e6',
                  borderRight: '1px solid #dee2e6',
                  backgroundColor: getPercentileColor(team.rushing_rate_display_percentile || 0),
                  position: 'relative'
                }}>
                  {formatStat(team.rushing_rate_display, 'rushing_rate')}
                  <span style={{
                    position: 'absolute',
                    bottom: '2px',
                    right: '4px',
                    fontSize: '10px',
                    color: '#6c757d'
                  }}>
                    {team.rushing_rate_display_rank || ''}
                  </span>
                </td>
                <td style={{
                  padding: '8px 16px',
                  textAlign: 'center',
                  fontFamily: 'Consolas, monospace',
                  fontSize: '13px',
                  borderBottom: '1px solid #dee2e6',
                  borderRight: '1px solid #dee2e6',
                  backgroundColor: getPercentileColor(
                    totalPerGame === 'per_game' ? 
                    team.rushing_attempts_per_game_percentile : 
                    team.rushing_attempts_percentile || 0
                  ),
                  position: 'relative'
                }}>
                  {formatStat(
                    totalPerGame === 'per_game' ? team.rushing_attempts_per_game : team.rushing_attempts,
                    'attempts'
                  )}
                  <span style={{
                    position: 'absolute',
                    bottom: '2px',
                    right: '4px',
                    fontSize: '10px',
                    color: '#6c757d'
                  }}>
                    {totalPerGame === 'per_game' ? 
                      team.rushing_attempts_per_game_rank : 
                      team.rushing_attempts_rank || ''}
                  </span>
                </td>
                <td style={{
                  padding: '8px 16px',
                  textAlign: 'center',
                  fontFamily: 'Consolas, monospace',
                  fontSize: '13px',
                  borderBottom: '1px solid #dee2e6',
                  borderRight: '1px solid #dee2e6',
                  backgroundColor: getPercentileColor(
                    totalPerGame === 'per_game' ? 
                    team.rushing_yards_per_game_percentile : 
                    team.rushing_yards_percentile || 0
                  ),
                  position: 'relative'
                }}>
                  {formatStat(
                    totalPerGame === 'per_game' ? team.rushing_yards_per_game : team.rushing_yards,
                    'yards'
                  )}
                  <span style={{
                    position: 'absolute',
                    bottom: '2px',
                    right: '4px',
                    fontSize: '10px',
                    color: '#6c757d'
                  }}>
                    {totalPerGame === 'per_game' ? 
                      team.rushing_yards_per_game_rank : 
                      team.rushing_yards_rank || ''}
                  </span>
                </td>
                <td style={{
                  padding: '8px 16px',
                  textAlign: 'center',
                  fontFamily: 'Consolas, monospace',
                  fontSize: '13px',
                  borderBottom: '1px solid #dee2e6',
                  borderRight: '1px solid #dee2e6',
                  backgroundColor: getPercentileColor(team.yards_per_rush_percentile || 0),
                  position: 'relative'
                }}>
                  {formatStat(team.yards_per_rush, 'yards_per_rush')}
                  <span style={{
                    position: 'absolute',
                    bottom: '2px',
                    right: '4px',
                    fontSize: '10px',
                    color: '#6c757d'
                  }}>
                    {team.yards_per_rush_rank || ''}
                  </span>
                </td>
                <td style={{
                  padding: '8px 16px',
                  textAlign: 'center',
                  fontFamily: 'Consolas, monospace',
                  fontSize: '13px',
                  borderBottom: '1px solid #dee2e6',
                  backgroundColor: getPercentileColor(
                    totalPerGame === 'per_game' ? 
                    team.rushing_tds_per_game_percentile : 
                    team.rushing_tds_percentile || 0
                  ),
                  position: 'relative'
                }}>
                  {formatStat(
                    totalPerGame === 'per_game' ? team.rushing_tds_per_game : team.rushing_tds,
                    'tds'
                  )}
                  <span style={{
                    position: 'absolute',
                    bottom: '2px',
                    right: '4px',
                    fontSize: '10px',
                    color: '#6c757d'
                  }}>
                    {totalPerGame === 'per_game' ? 
                      team.rushing_tds_per_game_rank : 
                      team.rushing_tds_rank || ''}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Table */}
      <div style={{ 
        display: 'none',
        '@media (max-width: 768px)': { display: 'block' }
      }} className="mobile-table">
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: '1px solid #dee2e6',
          backgroundColor: 'white'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa' }}>
              <th style={{
                padding: '4px 2px',
                textAlign: 'left',
                fontFamily: '"Trebuchet MS", sans-serif',
                fontWeight: 'bold',
                fontSize: '8px',
                textTransform: 'uppercase',
                borderBottom: '1px solid #dee2e6',
                width: '22%',
                cursor: 'pointer'
              }} onClick={() => handleSort('team_name')}>
                TEAM
              </th>
              <th style={{
                padding: '4px 2px',
                textAlign: 'center',
                fontFamily: '"Trebuchet MS", sans-serif',
                fontWeight: 'bold',
                fontSize: '8px',
                textTransform: 'uppercase',
                borderBottom: '1px solid #dee2e6',
                width: '8%',
                cursor: 'pointer'
              }} onClick={() => handleSort('games_played')}>
                GP
              </th>
              <th style={{
                padding: '4px 2px',
                textAlign: 'center',
                fontFamily: '"Trebuchet MS", sans-serif',
                fontWeight: 'bold',
                fontSize: '8px',
                textTransform: 'uppercase',
                borderBottom: '1px solid #dee2e6',
                width: '14%',
                cursor: 'pointer'
              }} onClick={() => handleSort('rushing_rate_display')}>
                RATE
              </th>
              <th style={{
                padding: '4px 2px',
                textAlign: 'center',
                fontFamily: '"Trebuchet MS", sans-serif',
                fontWeight: 'bold',
                fontSize: '8px',
                textTransform: 'uppercase',
                borderBottom: '1px solid #dee2e6',
                width: '12%',
                cursor: 'pointer'
              }} onClick={() => handleSort(totalPerGame === 'per_game' ? 'rushing_attempts_per_game' : 'rushing_attempts')}>
                ATT
              </th>
              <th style={{
                padding: '4px 2px',
                textAlign: 'center',
                fontFamily: '"Trebuchet MS", sans-serif',
                fontWeight: 'bold',
                fontSize: '8px',
                textTransform: 'uppercase',
                borderBottom: '1px solid #dee2e6',
                width: '14%',
                cursor: 'pointer'
              }} onClick={() => handleSort(totalPerGame === 'per_game' ? 'rushing_yards_per_game' : 'rushing_yards')}>
                YDS
              </th>
              <th style={{
                padding: '4px 2px',
                textAlign: 'center',
                fontFamily: '"Trebuchet MS", sans-serif',
                fontWeight: 'bold',
                fontSize: '8px',
                textTransform: 'uppercase',
                borderBottom: '1px solid #dee2e6',
                width: '14%',
                cursor: 'pointer'
              }} onClick={() => handleSort('yards_per_rush')}>
                Y/R
              </th>
              <th style={{
                padding: '4px 2px',
                textAlign: 'center',
                fontFamily: '"Trebuchet MS", sans-serif',
                fontWeight: 'bold',
                fontSize: '8px',
                textTransform: 'uppercase',
                borderBottom: '1px solid #dee2e6',
                width: '10%',
                cursor: 'pointer'
              }} onClick={() => handleSort(totalPerGame === 'per_game' ? 'rushing_tds_per_game' : 'rushing_tds')}>
                TD
              </th>
            </tr>
          </thead>
          <tbody>
            {teamsWithRankings.map((team, index) => (
              <tr key={team.team_name} style={{
                backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa'
              }}>
                <td style={{
                  padding: '4px 2px',
                  fontFamily: '"Trebuchet MS", sans-serif',
                  fontWeight: 'bold',
                  fontSize: '8px',
                  textTransform: 'uppercase',
                  borderBottom: '1px solid #dee2e6',
                  width: '22%'
                }}>
                  <Link 
                    to={`/team/${encodeURIComponent(team.team_name)}?season=${selectedSeason}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      textDecoration: 'none',
                      color: 'inherit'
                    }}
                  >
                    {team.logo_url && (
                      <img 
                        src={team.logo_url} 
                        alt={team.team_name}
                        style={{
                          width: '12px',
                          height: '12px',
                          marginRight: '4px',
                          objectFit: 'contain'
                        }}
                      />
                    )}
                    <span style={{ fontSize: '8px' }}>{team.team_name}</span>
                  </Link>
                </td>
                <td style={{
                  padding: '4px 2px',
                  textAlign: 'center',
                  fontFamily: 'Consolas, monospace',
                  fontSize: '9px',
                  borderBottom: '1px solid #dee2e6',
                  width: '8%'
                }}>
                  {team.games_played || 0}
                </td>
                <td style={{
                  padding: '4px 2px',
                  textAlign: 'center',
                  fontFamily: 'Consolas, monospace',
                  fontSize: '9px',
                  borderBottom: '1px solid #dee2e6',
                  backgroundColor: getPercentileColor(team.rushing_rate_display_percentile || 0),
                  width: '14%'
                }}>
                  {formatStat(team.rushing_rate_display, 'rushing_rate')}
                </td>
                <td style={{
                  padding: '4px 2px',
                  textAlign: 'center',
                  fontFamily: 'Consolas, monospace',
                  fontSize: '9px',
                  borderBottom: '1px solid #dee2e6',
                  backgroundColor: getPercentileColor(
                    totalPerGame === 'per_game' ? 
                    team.rushing_attempts_per_game_percentile : 
                    team.rushing_attempts_percentile || 0
                  ),
                  width: '12%'
                }}>
                  {formatStat(
                    totalPerGame === 'per_game' ? team.rushing_attempts_per_game : team.rushing_attempts,
                    'attempts'
                  )}
                </td>
                <td style={{
                  padding: '4px 2px',
                  textAlign: 'center',
                  fontFamily: 'Consolas, monospace',
                  fontSize: '9px',
                  borderBottom: '1px solid #dee2e6',
                  backgroundColor: getPercentileColor(
                    totalPerGame === 'per_game' ? 
                    team.rushing_yards_per_game_percentile : 
                    team.rushing_yards_percentile || 0
                  ),
                  width: '14%'
                }}>
                  {formatStat(
                    totalPerGame === 'per_game' ? team.rushing_yards_per_game : team.rushing_yards,
                    'yards'
                  )}
                </td>
                <td style={{
                  padding: '4px 2px',
                  textAlign: 'center',
                  fontFamily: 'Consolas, monospace',
                  fontSize: '9px',
                  borderBottom: '1px solid #dee2e6',
                  backgroundColor: getPercentileColor(team.yards_per_rush_percentile || 0),
                  width: '14%'
                }}>
                  {formatStat(team.yards_per_rush, 'yards_per_rush')}
                </td>
                <td style={{
                  padding: '4px 2px',
                  textAlign: 'center',
                  fontFamily: 'Consolas, monospace',
                  fontSize: '9px',
                  borderBottom: '1px solid #dee2e6',
                  backgroundColor: getPercentileColor(
                    totalPerGame === 'per_game' ? 
                    team.rushing_tds_per_game_percentile : 
                    team.rushing_tds_percentile || 0
                  ),
                  width: '10%'
                }}>
                  {formatStat(
                    totalPerGame === 'per_game' ? team.rushing_tds_per_game : team.rushing_tds,
                    'tds'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CSS for responsive design */}
      <style jsx>{`
        @media (max-width: 768px) {
          .desktop-table {
            display: none !important;
          }
          .mobile-table {
            display: block !important;
          }
        }
        @media (min-width: 769px) {
          .mobile-table {
            display: none !important;
          }
          .desktop-table {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
};

export default RushingStatsPage;