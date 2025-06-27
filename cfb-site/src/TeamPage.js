import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

function TeamPage() {
  console.log('🚀 TEAMPAGE COMPONENT LOADED!');
  
  const { teamName } = useParams();
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  console.log('🎯 Team name from URL:', teamName);
  console.log('🌐 API URL:', API_URL);

  useEffect(() => {
    const loadTeamData = async () => {
      try {
        console.log('📡 Starting API call for:', teamName);
        
        const response = await fetch(`${API_URL}/api/teams/${encodeURIComponent(teamName)}?year=2024`);
        
        if (!response.ok) {
          throw new Error(`Team not found: ${teamName}`);
        }
        
        const team = await response.json();
        console.log('✅ Team data loaded:', team);
        
        setTeamData(team);
        setLoading(false);
      } catch (err) {
        console.error('❌ Error loading team data:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    if (teamName) {
      loadTeamData();
    }
  }, [teamName, API_URL]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        fontFamily: 'Trebuchet MS'
      }}>
        <div>
          <h2>Loading {teamName}...</h2>
          <p>API URL: {API_URL}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        fontFamily: 'Trebuchet MS',
        flexDirection: 'column',
        color: '#d32f2f'
      }}>
        <h2>Error</h2>
        <p>{error}</p>
        <button 
          onClick={() => window.history.back()}
          style={{
            padding: '8px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div style={{ 
      fontFamily: 'Trebuchet MS', 
      padding: '20px',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      {/* Team Header */}
      <div style={{
        background: `linear-gradient(135deg, ${teamData.primary_color || '#333'}, ${teamData.secondary_color || '#666'})`,
        color: 'white',
        padding: '20px',
        borderRadius: '8px',
        textAlign: 'center',
        marginBottom: '30px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
          <img 
            src={teamData.logo} 
            alt={`${teamData.team_name} logo`}
            style={{ width: '80px', height: '80px' }}
          />
          <div>
            <h1 style={{ margin: '0', fontSize: '36px', textTransform: 'uppercase' }}>
              {teamData.team_name}
            </h1>
            <div style={{ fontSize: '18px', opacity: 0.9 }}>
              {teamData.conference} • 2024 Season
            </div>
          </div>
        </div>
      </div>

      {/* Basic Team Info */}
      <div style={{ marginBottom: '30px' }}>
        <h2>Team Information</h2>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '20px',
          marginTop: '20px'
        }}>
          <div style={{
            backgroundColor: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            padding: '20px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '14px', color: '#6c757d', marginBottom: '8px' }}>
              Power Rating
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', fontFamily: 'Courier New' }}>
              {teamData.power_rating ? parseFloat(teamData.power_rating).toFixed(1) : 'N/A'}
            </div>
            {teamData.power_rank && (
              <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '4px' }}>
                Rank: #{teamData.power_rank}
              </div>
            )}
          </div>

          <div style={{
            backgroundColor: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            padding: '20px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '14px', color: '#6c757d', marginBottom: '8px' }}>
              Conference
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
              {teamData.conference || 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* Success Message */}
      <div style={{
        backgroundColor: '#d4edda',
        border: '1px solid #c3e6cb',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '30px'
      }}>
        <h3 style={{ color: '#155724', margin: '0 0 10px 0' }}>
          🎉 Success! Team Page is Working!
        </h3>
        <p style={{ color: '#155724', margin: '0' }}>
          The routing is now working correctly. API calls are successful. 
          Ready to add more features like games, stats, etc.
        </p>
      </div>

      {/* Navigation */}
      <div style={{ textAlign: 'center', marginTop: '40px' }}>
        <button 
          onClick={() => window.history.back()}
          style={{
            padding: '12px 24px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            cursor: 'pointer',
            fontFamily: 'Trebuchet MS'
          }}
        >
          ← Back to Rankings
        </button>
      </div>
    </div>
  );
}

export default TeamPage;
