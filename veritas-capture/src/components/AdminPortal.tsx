import React, { useState, useEffect } from 'react';
import { ShieldAlert, Server, Trash2, CheckCircle, XCircle } from 'lucide-react';

interface HardwareDevice {
  publicKey: string;
  type: string;
  isRevoked: boolean;
  createdAt: string;
}

export const AdminPortal: React.FC = () => {
  const [devices, setDevices] = useState<HardwareDevice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDevices = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/v1/admin/hardware');
      if (res.ok) {
        setDevices(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch hardware devices", err);
      setError("Failed to connect to the Veritas Certificate Authority.");
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleRevoke = async (publicKey: string) => {
    if (!window.confirm("Are you sure you want to REVOKE this hardware device? All future videos captured on this device will be rejected by the Veritas network. This cannot be undone.")) {
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/v1/admin/hardware/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey })
      });
      
      if (res.ok) {
        await fetchDevices();
      } else {
        setError("Failed to revoke device.");
      }
    } catch (err) {
      console.error("Revocation failed", err);
      setError("Failed to connect to the Veritas Certificate Authority.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div className="proof-panel" style={{ padding: '2rem', border: '1px solid var(--danger-color)', background: 'rgba(239, 68, 68, 0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
          <ShieldAlert size={32} color="var(--danger-color)" />
          <h2 style={{ margin: 0, color: 'var(--danger-color)' }}>Hardware Certificate Authority (CA)</h2>
        </div>
        <p style={{ color: 'var(--text-muted)' }}>
          Manage the Global Hardware Trust Registry. As the CA, you can view all factory-provisioned recording devices and instantly <strong>REVOKE</strong> compromised keys. Revoked devices will be permanently banned from creating Authentic credentials.
        </p>
      </div>

      {error && (
        <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger-color)', borderRadius: '8px', color: 'var(--danger-color)' }}>
          {error}
        </div>
      )}

      <div className="proof-panel">
        <div className="proof-header">
          <Server size={20} color="var(--accent-color)" />
          <h2>Registered Hardware Devices</h2>
        </div>
        
        {devices.length === 0 ? (
          <div className="empty-state">
            <p>No hardware devices registered yet.</p>
          </div>
        ) : (
          <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {devices.map(d => (
              <div key={d.publicKey} style={{ 
                display: 'flex', 
                alignItems: 'flex-start', 
                justifyContent: 'space-between',
                padding: '1.2rem',
                background: d.isRevoked ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-main)',
                border: `1px solid ${d.isRevoked ? 'var(--danger-color)' : 'var(--border-color)'}`,
                borderRadius: '8px',
                opacity: d.isRevoked ? 0.7 : 1
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {d.isRevoked ? <XCircle size={18} color="var(--danger-color)" /> : <CheckCircle size={18} color="var(--success-color)" />}
                    <h3 style={{ margin: 0, fontSize: '1rem', color: d.isRevoked ? 'var(--danger-color)' : 'var(--text-main)' }}>
                      {d.isRevoked ? 'REVOKED DEVICE' : 'TRUSTED HARDWARE'}
                    </h3>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <span>Device Key:</span>
                    <span style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{d.publicKey}</span>
                    
                    <span>Device Type:</span>
                    <span>{d.type}</span>
                    
                    <span>Registered:</span>
                    <span>{new Date(d.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                
                {!d.isRevoked && (
                  <button 
                    onClick={() => handleRevoke(d.publicKey)}
                    disabled={isLoading}
                    style={{ 
                      padding: '8px 12px', 
                      background: 'rgba(239, 68, 68, 0.1)', 
                      border: '1px solid var(--danger-color)', 
                      color: 'var(--danger-color)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap',
                      marginLeft: '1rem'
                    }}
                  >
                    <Trash2 size={16} />
                    {isLoading ? '...' : 'Revoke'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
