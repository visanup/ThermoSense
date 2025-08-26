// src/components/Header.tsx
import React from 'react';
import { FiMenu } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const MenuIcon = FiMenu as React.FC<React.SVGProps<SVGSVGElement>>;

interface HeaderProps {
  isAuthenticated: boolean;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ isAuthenticated, onLogout }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <header
      style={{
        backgroundColor: '#3b82f6',  // Tailwind bg-blue-500
        height: '4rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}
    >
      {/* Logo / Title */}
      <div style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 600 }}>
        ThermoSense
      </div>

      {/* Navigation Buttons */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          onClick={() => navigate('/home')}
          style={{
            color: '#fff',
            background: 'transparent',
            border: 'none',
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          Home
        </button>

        <button
          onClick={() => navigate('/devices')}
          style={{
            color: '#fff',
            background: 'transparent',
            border: 'none',
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          Devices
        </button>

        {!isAuthenticated ? (
          <>
            <button
              onClick={() => navigate('/signup')}
              style={{
                color: '#fff',
                background: 'transparent',
                border: 'none',
                fontSize: '1rem',
                cursor: 'pointer',
              }}
            >
              Sign up
            </button>
            <button
              onClick={() => navigate('/login')}
              style={{
                color: '#fff',
                background: 'transparent',
                border: 'none',
                fontSize: '1rem',
                cursor: 'pointer',
              }}
            >
              Log in
            </button>
          </>
        ) : (
          <button
            onClick={handleLogout}
            style={{
              color: '#fff',
              background: 'transparent',
              border: 'none',
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            Logout
          </button>
        )}

        {/* Mobile menu icon */}
        <button
          type="button"
          aria-label="Open menu"
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            fontSize: '1.5rem',
            cursor: 'pointer',
            marginLeft: '0.5rem',
          }}
        >
          <MenuIcon />
        </button>
      </nav>
    </header>
  );
};

export default Header;
