import React, { useState, useEffect } from 'react';
import { Terminal, Key, Plus, Copy, CheckCircle } from 'lucide-react';

interface ApiKey {
  id: string;
  key: string;
  developerName: string;
  createdAt: string;
  isActive: boolean;
}

export const DeveloperPortal: React.FC = () => {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [developerName, setDeveloperName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchKeys = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/v1/developer/keys');
      if (res.ok) {
        setKeys(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch API keys", err);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!developerName.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/v1/developer/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ developerName })
      });
      
      if (res.ok) {
        setDeveloperName('');
        await fetchKeys();
      }
    } catch (err) {
      console.error("Failed to generate key", err);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div className="proof-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
          <Terminal size={32} color="var(--accent-color)" />
          <h2 style={{ margin: 0 }}>Developer API Keys</h2>
        </div>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
          Generate API keys to integrate Veritas Trusted Capture Verification into your own platforms. 
          Use these keys to authenticate against the Veritas B2B Gateway.
        </p>

        <form onSubmit={handleGenerate} style={{ display: 'flex', gap: '1rem' }}>
          <input 
            type="text" 
            placeholder="Application Name (e.g., 'Twitter Integration')" 
            value={developerName}
            onChange={(e) => setDeveloperName(e.target.value)}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-panel)',
              color: 'var(--text-main)',
              fontSize: '1rem'
            }}
          />
          <button type="submit" className="btn btn-primary" disabled={isLoading || !developerName.trim()}>
            <Plus size={20} />
            {isLoading ? 'Generating...' : 'Generate New Key'}
          </button>
        </form>
      </div>

      <div className="proof-panel">
        <div className="proof-header">
          <Key size={20} color="var(--accent-color)" />
          <h2>Active API Keys</h2>
        </div>
        
        {keys.length === 0 ? (
          <div className="empty-state">
            <p>No API keys generated yet.</p>
          </div>
        ) : (
          <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {keys.map(k => (
              <div key={k.id} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                padding: '1rem',
                background: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px'
              }}>
                <div>
                  <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>{k.developerName}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <span style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                      {k.key}
                    </span>
                    <span style={{ 
                      padding: '2px 8px', 
                      borderRadius: '12px', 
                      fontSize: '0.75rem',
                      background: k.isActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: k.isActive ? 'var(--success-color)' : 'var(--danger-color)'
                    }}>
                      {k.isActive ? 'Active' : 'Revoked'}
                    </span>
                  </div>
                </div>
                
                <button 
                  className="btn" 
                  onClick={() => copyToClipboard(k.key)}
                  style={{ padding: '8px', border: '1px solid var(--border-color)', background: 'transparent' }}
                  title="Copy API Key"
                >
                  {copiedKey === k.key ? <CheckCircle size={20} color="var(--success-color)" /> : <Copy size={20} color="var(--text-muted)" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
