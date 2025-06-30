// 🔧 Replace the header section in your SOSLeaderboard component with this:

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
      {/* ✅ Hide sort arrows on mobile */}
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
        userSelect: 'none'
      }}
      onClick={() => handleSort(
        activeTab === 'overall' ? 'sos_overall' : 
        activeTab === 'remaining' ? 'sos_remaining' : 
        'sos_played'
      )}
    >
      {activeTab === 'overall' ? 'SOS OVERALL' : 
       activeTab === 'remaining' ? 'SOS REMAINING' : 
       'SOS PLAYED'} 
      {/* ✅ Hide sort arrows on mobile */}
      <span className="sort-arrow-desktop">{getSortArrow(
        activeTab === 'overall' ? 'sos_overall' : 
        activeTab === 'remaining' ? 'sos_remaining' : 
        'sos_played'
      )}</span>
    </th>
    
    {/* ✅ ENHANCED: Record column with special styling */}
    <th 
      style={{ 
        padding: '8px 4px', 
        textAlign: 'center', 
        border: '1px solid #dee2e6',
        borderLeft: '3px solid #28a745', // ✅ Green left border
        backgroundColor: '#f8fff8', // ✅ Light green background
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
    
    {/* ✅ ENHANCED: Projected Wins column with special styling */}
    <th 
      style={{ 
        padding: '8px 4px', 
        textAlign: 'center', 
        border: '1px solid #dee2e6',
        backgroundColor: '#f8fff8', // ✅ Light green background
        fontFamily: 'Trebuchet MS, sans-serif',
        fontWeight: 'bold',
        fontSize: '12px',
        textTransform: 'uppercase',
        cursor: 'pointer',
        userSelect: 'none'
      }}
      onClick={() => handleSort('projected_wins')}
    >
      PROJ WINS
      <span className="sort-arrow-desktop">{getSortArrow('projected_wins')}</span>
    </th>
    
    {/* ✅ ENHANCED: Actual vs Projected column with special styling */}
    <th 
      style={{ 
        padding: '8px 4px', 
        textAlign: 'center', 
        border: '1px solid #dee2e6',
        borderRight: '3px solid #28a745', // ✅ Green right border
        backgroundColor: '#f8fff8', // ✅ Light green background
        fontFamily: 'Trebuchet MS, sans-serif',
        fontWeight: 'bold',
        fontSize: '12px',
        textTransform: 'uppercase',
        cursor: 'pointer',
        userSelect: 'none'
      }}
      onClick={() => handleSort('win_difference')}
    >
      ACT VS PROJ
      <span className="sort-arrow-desktop">{getSortArrow('win_difference')}</span>
    </th>
    
    {/* ✅ ENHANCED: Top 40 column with wider mobile width */}
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
        minWidth: '80px' // ✅ Ensure minimum width for mobile
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
        className="difficulty-emojis-desktop" // ✅ Hide on mobile
      >
        <span>🪙</span>
        <span>🔒</span>
        <span>🎯</span>
      </div>
    </th>
  </tr>
</thead>

// 🔧 Update the table body rows with enhanced styling for the record columns:

{getSortedAndFilteredData().map((team, index) => {
  const rank = parseInt(team.sos_rank);
  const powerRank = selectedConference === 'all' ? team.power_rating_rank : 
                  (rankingScope === 'national' ? team.power_rating_rank : 
                  getSortedAndFilteredData()
                    .sort((a, b) => parseFloat(b.team_rating) - parseFloat(a.team_rating))
                    .findIndex(t => t.team === team.team) + 1);
  
  return (
    <tr key={team.team} style={{
      backgroundColor: index % 2 === 1 ? '#f8f9fa' : '#ffffff'
    }}>
      {/* Team Name - unchanged */}
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
            to={`/team/${team.team.toLowerCase().replace(/\s+/g, '-')}?year=${selectedSeason}`}
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
          {/* Rating Badge */}
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
              title={`Power Rating: ${team.team_rating} (Rank #${powerRank})`}
              >
                #{powerRank}
              </span>
            );
          })()}
        </div>
      </td>
      
      {/* SOS Column - unchanged */}
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
      
      {/* ✅ ENHANCED: Record with special styling */}
      <td style={{ 
        padding: '8px 4px', 
        border: '1px solid #dee2e6',
        borderLeft: '3px solid #28a745', // ✅ Green left border
        backgroundColor: '#f8fff8', // ✅ Light green background
        fontFamily: 'Consolas, monospace',
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: '14px' // ✅ Slightly larger font
      }}>
        {team.actual_wins || 0}-{team.actual_losses || 0}
      </td>
      
      {/* ✅ ENHANCED: Projected Wins with special styling */}
      <td style={{
        padding: '8px 4px',
        border: '1px solid #dee2e6',
        backgroundColor: '#f8fff8', // ✅ Light green background
        fontFamily: 'Consolas, monospace',
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: '14px' // ✅ Slightly larger font
      }}>
        {team.projected_wins ? parseFloat(team.projected_wins).toFixed(1) : '0.0'}
      </td>
      
      {/* ✅ ENHANCED: Win Difference with special styling and conditional colors */}
      <td style={{
        padding: '8px 4px',
        border: '1px solid #dee2e6',
        borderRight: '3px solid #28a745', // ✅ Green right border
        backgroundColor: (() => {
          const diff = team.win_difference;
          if (diff > 1) return '#d4edda'; // Light green for over-performing
          if (diff < -1) return '#f8d7da'; // Light red for under-performing
          return '#f8fff8'; // Light green default
        })(),
        fontFamily: 'Consolas, monospace',
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: '14px',
        color: (() => {
          const diff = team.win_difference;
          if (diff > 1) return '#155724'; // Dark green
          if (diff < -1) return '#721c24'; // Dark red
          return '#212529'; // Default black
        })()
      }}>
        {team.win_difference > 0 ? '+' : ''}{team.win_difference.toFixed(1)}
      </td>
      
      {/* ✅ ENHANCED: Top 40 Record with wider mobile styling */}
      <td style={{ 
        padding: '8px 4px', 
        border: '1px solid #dee2e6',
        fontFamily: 'Consolas, monospace',
        textAlign: 'center',
        fontWeight: 'bold',
        minWidth: '80px', // ✅ Ensure minimum width
        whiteSpace: 'nowrap' // ✅ Prevent line breaking
      }}>
        {team.top40_record || '0-0'}
      </td>
      
      {/* Difficulty - unchanged */}
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

// 🔧 Update the Mobile CSS section at the bottom:

{/* Enhanced Mobile CSS */}
<style jsx>{`
  @media (max-width: 768px) {
    .team-name-desktop {
      display: none !important;
    }
    .team-name-mobile {
      display: inline !important;
    }
    /* ✅ Hide sort arrows on mobile */
    .sort-arrow-desktop {
      display: none !important;
    }
    /* ✅ Hide difficulty emojis on mobile */
    .difficulty-emojis-desktop {
      display: none !important;
    }
    /* ✅ Ensure TOP 40 column doesn't break */
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
  }
`}</style>
