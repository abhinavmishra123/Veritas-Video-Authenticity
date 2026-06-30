import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Shield } from 'lucide-react';

export const Navigation: React.FC = () => {
  const location = useLocation();

  return (
    <nav className="glass-nav">
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'var(--text-main)' }}>
        <Shield size={24} color="var(--accent-color)" />
        <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '1px' }}>VERITAS</span>
      </Link>
      
      <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
        <Link 
          to="/docs" 
          style={{ 
            color: location.pathname === '/docs' ? 'var(--accent-color)' : 'var(--text-muted)', 
            textDecoration: 'none', 
            fontWeight: 500,
            transition: 'color 0.2s'
          }}
        >
          Documentation
        </Link>
        
        {/* We link directly to the Developer Portal running on port 5173 */}
        <a 
          href="http://localhost:5173" 
          target="_blank" 
          rel="noreferrer"
          className="btn btn-outline"
        >
          Developer Login
        </a>

        {/* Link to Admin Portal */}
        <a 
          href="http://localhost:5173" 
          target="_blank" 
          rel="noreferrer"
          style={{ color: 'var(--danger-color)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Shield size={16} /> Admin CA Portal
        </a>

        <Link to="/docs" className="btn btn-primary">
          Get the SDK
        </Link>
      </div>
    </nav>
  );
};
