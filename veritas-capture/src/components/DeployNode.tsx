import React from 'react';
import { Terminal, Copy, Box, Server, Database } from 'lucide-react';

export const DeployNode: React.FC = () => {
  const dockerCommand = `docker-compose up --build -d`;

  return (
    <div className="tab-pane active" style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: '800', marginBottom: '1rem', background: 'linear-gradient(90deg, #fff, var(--text-muted))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Host Your Own Veritas Node
        </h1>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto' }}>
          The Veritas Protocol is completely open-source. Spin up your own decentralized verification engine and hardware ledger locally with zero API limits.
        </p>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '24px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid var(--accent-color)', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Terminal size={20} color="var(--accent-color)" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Quickstart Command</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Requires Docker and Docker Compose installed on your system.</p>
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <pre style={{ background: '#0d1117', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', overflowX: 'auto', color: '#e6edf3', fontSize: '1.1rem', fontFamily: 'monospace' }}>
            {dockerCommand}
          </pre>
          <button 
            style={{ position: 'absolute', top: '12px', right: '12px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '6px 12px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => navigator.clipboard.writeText(dockerCommand)}
          >
            <Copy size={14} /> Copy
          </button>
        </div>

      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem' }}>
          <Server size={24} color="var(--accent-color)" style={{ marginBottom: '1rem' }} />
          <h4 style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Verification Engine</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            The API runs natively via Docker with FFmpeg built-in, enabling real-time deepfake pHash detection entirely on your own hardware.
          </p>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem' }}>
          <Database size={24} color="var(--success-color)" style={{ marginBottom: '1rem' }} />
          <h4 style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Persistent SQLite Ledger</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            The Docker volume automatically mounts your local hardware registry database (`dev.db`), ensuring no cryptographic proofs are lost during restarts.
          </p>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem' }}>
          <Box size={24} color="var(--warning-color)" style={{ marginBottom: '1rem' }} />
          <h4 style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>No API Keys Needed</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Since the node runs securely on your own network (or behind your reverse proxy), the REST verification endpoints are open by default.
          </p>
        </div>

      </div>

    </div>
  );
};
