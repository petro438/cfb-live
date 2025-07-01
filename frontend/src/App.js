import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import HomePage from './HomePage';
import TeamPage from './TeamPage';
import SOSLeaderboard from './SOSLeaderboard';
import LuckLeaderboard from './LuckLeaderboard';
import PassingStatsPage from './PassingStatsPage';
import RushingStatsPage from './RushingStatsPage';

const Navigation = () => {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navigationCategories = [
    {
      title: 'Games',
      items: [
        { name: 'Strength of Schedule', path: '/strength-of-schedule' }
      ]
    },
    {
      title: 'Team Stats',
      items: [
        { name: 'Passing Stats', path: '/passing-stats' },
        { name: 'Rushing Stats', path: '/rushing-stats' }
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

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    setActiveDropdown(null);
  };

  const toggleCategoryDropdown = (categoryTitle) => {
    setActiveDropdown(activeDropdown === categoryTitle ? null : categoryTitle);
  };

  return (
    <nav style={{
      backgroundColor: '#343a40',
      padding: '0',
      fontFamily: '"Trebuchet MS", Arial, sans-serif',
      borderBottom: '1px solid #dee2e6',
      position: 'relative'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0'
      }}>
        {/* Logo/Home */}
        <Link 
          to="/" 
          onClick={closeMobileMenu}
          style={{
            color: 'white',
            textDecoration: 'none',
            fontWeight: 'bold',
            fontSize: '20px',
            padding: '16px 20px'
          }}
        >
          CFB ANALYTICS
        </Link>

        {/* Desktop Navigation */}
        <div style={{ 
          display: 'flex', 
          flex: 1,
          '@media (max-width: 768px)': { display: 'none' }
        }} className="desktop-nav">
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

              {/* Desktop Dropdown Menu */}
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

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{
            display: 'none',
            backgroundColor: 'transparent',
            border: 'none',
            color: 'white',
            fontSize: '24px',
            padding: '16px 20px',
            cursor: 'pointer'
          }}
          className="mobile-hamburger"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          style={{
            position: 'fixed',
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 999
          }}
          onClick={closeMobileMenu}
        />
      )}

      {/* Mobile Menu */}
      <div
        style={{
          position: 'fixed',
          top: '0',
          right: mobileMenuOpen ? '0' : '-300px',
          height: '100vh',
          width: '280px',
          backgroundColor: '#343a40',
          transition: 'right 0.3s ease',
          zIndex: 1000,
          overflowY: 'auto',
          boxShadow: mobileMenuOpen ? '-2px 0 5px rgba(0, 0, 0, 0.1)' : 'none'
        }}
        className="mobile-menu"
      >
        {/* Mobile Menu Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #495057',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ color: 'white', fontWeight: 'bold', fontSize: '18px' }}>
            Menu
          </span>
          <button
            onClick={closeMobileMenu}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '20px',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        {/* Mobile Menu Items */}
        <div style={{ padding: '0' }}>
          {/* Home Link */}
          <Link
            to="/"
            onClick={closeMobileMenu}
            style={{
              display: 'block',
              padding: '16px 20px',
              color: location.pathname === '/' ? '#58c36c' : 'white',
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: 'bold',
              borderBottom: '1px solid #495057',
              backgroundColor: location.pathname === '/' ? '#495057' : 'transparent'
            }}
          >
            Home
          </Link>

          {/* Category Sections */}
          {navigationCategories.map((category) => (
            <div key={category.title}>
              {/* Category Header */}
              <div
                onClick={() => category.items.length > 0 && toggleCategoryDropdown(category.title)}
                style={{
                  padding: '16px 20px',
                  color: isCategoryActive(category) ? '#58c36c' : 'white',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  borderBottom: '1px solid #495057',
                  backgroundColor: isCategoryActive(category) ? '#495057' : 'transparent',
                  cursor: category.items.length > 0 ? 'pointer' : 'default',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                {category.title}
                {category.items.length > 0 && (
                  <span style={{ fontSize: '14px' }}>
                    {activeDropdown === category.title ? '▲' : '▼'}
                  </span>
                )}
              </div>

              {/* Category Items */}
              {category.items.length > 0 && activeDropdown === category.title && (
                <div style={{ backgroundColor: '#495057' }}>
                  {category.items.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={closeMobileMenu}
                      style={{
                        display: 'block',
                        padding: '12px 40px',
                        color: isActivePath(item.path) ? '#58c36c' : '#f8f9fa',
                        textDecoration: 'none',
                        fontSize: '14px',
                        fontWeight: isActivePath(item.path) ? 'bold' : 'normal',
                        borderBottom: '1px solid #6c757d'
                      }}
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              )}

              {/* Empty Category Message */}
              {category.items.length === 0 && activeDropdown === category.title && (
                <div style={{
                  padding: '12px 40px',
                  color: '#6c757d',
                  fontSize: '14px',
                  fontStyle: 'italic',
                  backgroundColor: '#495057',
                  borderBottom: '1px solid #6c757d'
                }}>
                  Coming soon...
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CSS for responsive design */}
      <style jsx>{`
        @media (max-width: 768px) {
          .desktop-nav {
            display: none !important;
          }
          .mobile-hamburger {
            display: block !important;
          }
        }
        @media (min-width: 769px) {
          .mobile-menu {
            display: none !important;
          }
        }
      `}</style>
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
          
          {/* Team Stats Category */}
          <Route path="/passing-stats" element={<PassingStatsPage />} />
          <Route path="/rushing-stats" element={<RushingStatsPage />} />
          
          {/* Leaderboards Category */}
          <Route path="/luck-leaderboard" element={<LuckLeaderboard />} />
          
          {/* Catch-all route */}
          <Route path="*" element={<div>Page not found</div>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;