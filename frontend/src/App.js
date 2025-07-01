import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import HomePage from './HomePage';
import TeamPage from './TeamPage';
import SOSLeaderboard from './SOSLeaderboard';
import LuckLeaderboard from './LuckLeaderboard';
import PassingStatsPage from './PassingStatsPage';

const Navigation = () => {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const location = useLocation();

  const navigationCategories = [
    {
      title: 'Games',
      items: [
        { name: 'Strength of Schedule', path: '/strength-of-schedule' }
      ]
    },
    {
      title: 'Stats',
      items: [
        { name: 'Passing Stats', path: '/passing-stats' }
      ]
    },
    {
      title: 'Leaderboards',
      items: [
        { name: 'Luck Leaderboard', path: '/luck-leaderboard' }
      ]
    },
    {
      title: 'Betting',
      items: [
        // Add betting pages here later
      ]
    },
    {
      title: 'Fun',
      items: [
        // Add fun pages here later
      ]
    }
  ];

  const isActivePath = (path) => {
    return location.pathname === path;
  };

  const isCategoryActive = (category) => {
    return category.items.some(item => isActivePath(item.path));
  };

  return (
    <nav style={{
      backgroundColor: '#343a40',
      padding: '0',
      fontFamily: '"Trebuchet MS", Arial, sans-serif',
      borderBottom: '1px solid #dee2e6'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center'
      }}>
        {/* Logo/Home */}
        <Link 
          to="/" 
          style={{
            color: 'white',
            textDecoration: 'none',
            fontWeight: 'bold',
            fontSize: '20px',
            padding: '16px 20px',
            borderRight: '1px solid #495057'
          }}
        >
          CFB ANALYTICS
        </Link>

        {/* Navigation Categories */}
        <div style={{ display: 'flex', flex: 1 }}>
          {navigationCategories.map((category, index) => (
            <div
              key={category.title}
              style={{
                position: 'relative',
                borderRight: index < navigationCategories.length - 1 ? '1px solid #495057' : 'none'
              }}
              onMouseEnter={() => setActiveDropdown(category.title)}
              onMouseLeave={() => setActiveDropdown(null)}
            >
              {/* Category Header */}
              <div
                style={{
                  padding: '16px 20px',
                  color: isCategoryActive(category) ? '#58c36c' : 'white',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  textTransform: 'uppercase',
                  cursor: category.items.length > 0 ? 'pointer' : 'default',
                  backgroundColor: isCategoryActive(category) ? '#495057' : 'transparent',
                  transition: 'all 0.2s ease'
                }}
              >
                {category.title}
                {category.items.length > 0 && (
                  <span style={{ marginLeft: '4px', fontSize: '12px' }}>▼</span>
                )}
              </div>

              {/* Dropdown Menu */}
              {category.items.length > 0 && activeDropdown === category.title && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: '0',
                    backgroundColor: 'white',
                    border: '1px solid #dee2e6',
                    borderTop: 'none',
                    minWidth: '200px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    zIndex: 1000
                  }}
                >
                  {category.items.map((item, itemIndex) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      style={{
                        display: 'block',
                        padding: '12px 16px',
                        color: isActivePath(item.path) ? '#007bff' : '#212529',
                        textDecoration: 'none',
                        fontSize: '14px',
                        fontWeight: isActivePath(item.path) ? 'bold' : 'normal',
                        backgroundColor: isActivePath(item.path) ? '#f8f9fa' : 'transparent',
                        borderBottom: itemIndex < category.items.length - 1 ? '1px solid #dee2e6' : 'none',
                        transition: 'background-color 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!isActivePath(item.path)) {
                          e.target.style.backgroundColor = '#f8f9fa';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActivePath(item.path)) {
                          e.target.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              )}

              {/* Empty Category Placeholder */}
              {category.items.length === 0 && activeDropdown === category.title && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: '0',
                    backgroundColor: 'white',
                    border: '1px solid #dee2e6',
                    borderTop: 'none',
                    minWidth: '200px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    zIndex: 1000,
                    padding: '12px 16px',
                    color: '#6c757d',
                    fontSize: '14px',
                    fontStyle: 'italic'
                  }}
                >
                  Coming soon...
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
};

function App() {
  return (
    <Router>
      <div style={{ minHeight: '100vh', backgroundColor: '#ffffff' }}>
        <Navigation />
        
        <Routes>
          {/* Home/Rankings */}
          <Route path="/" element={<HomePage />} />
          
          {/* Team Pages */}
          <Route path="/team/:teamName" element={<TeamPage />} />
          <Route path="/team/:teamName/:season" element={<TeamPage />} />
          
          {/* Games Category */}
          <Route path="/strength-of-schedule" element={<SOSLeaderboard />} />
          
          {/* Stats Category */}
          <Route path="/passing-stats" element={<PassingStatsPage />} />  {/* ← ADD THIS LINE */}
          {/* Add stats routes here later */}
          
          {/* Leaderboards Category */}
          <Route path="/luck-leaderboard" element={<LuckLeaderboard />} />
          
          {/* Betting Category */}
          {/* Add betting routes here later */}
          
          {/* Fun Category */}
          {/* Add fun routes here later */}
          
          {/* Catch-all route */}
          <Route path="*" element={<div>Page not found</div>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;