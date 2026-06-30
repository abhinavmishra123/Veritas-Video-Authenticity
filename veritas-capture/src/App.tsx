import { useState, useRef, useEffect } from 'react';
import { CameraStream } from './components/CameraStream';
import { VerificationPortal } from './components/VerificationPortal';

import { AdminPortal } from './components/AdminPortal';
import { DeployNode } from './components/DeployNode';
import { Shield, Fingerprint, Activity, Key, Code, Clock, XCircle, CheckCircle } from 'lucide-react';
import { VeritasCapture, VeritasCrypto } from '@veritas/sdk';
import type { FrameHash } from '@veritas/sdk';

function App() {
  const [activeTab, setActiveTab] = useState<'capture' | 'verify' | 'deploy' | 'admin'>('capture');
  const [hashes, setHashes] = useState<FrameHash[]>([]);
  const [deviceKeyStr, setDeviceKeyStr] = useState<string | null>(null);
  const [credentialStatus, setCredentialStatus] = useState<string | null>(null);
  const [offlineCount, setOfflineCount] = useState<number>(0);
  
  const hashesRef = useRef<FrameHash[]>([]);
  const hashListRef = useRef<HTMLDivElement>(null);
  const sdkCaptureRef = useRef<VeritasCapture | null>(null);

  const updateOfflineCount = () => {
    const queueStr = localStorage.getItem('veritas_offline_queue') || '[]';
    const queue = JSON.parse(queueStr);
    setOfflineCount(queue.length);
  };

  useEffect(() => {
    // Initialize Veritas SDK with persistent keys
    const savedKeys = localStorage.getItem('veritas_device_keys');
    let keyPair;
    
    if (savedKeys) {
      const parsed = JSON.parse(savedKeys);
      keyPair = {
        publicKey: VeritasCrypto.fromHex(parsed.publicKey),
        secretKey: VeritasCrypto.fromHex(parsed.secretKey)
      };
    } else {
      keyPair = VeritasCrypto.generateKeypair();
      localStorage.setItem('veritas_device_keys', JSON.stringify({
        publicKey: VeritasCrypto.toHex(keyPair.publicKey),
        secretKey: VeritasCrypto.toHex(keyPair.secretKey)
      }));
    }

    setDeviceKeyStr(VeritasCrypto.toHex(keyPair.publicKey));

    sdkCaptureRef.current = new VeritasCapture({
      apiUrl: 'http://localhost:3000',
      keyPair: keyPair
    });

    updateOfflineCount();

    const handleOnline = async () => {
      console.log("Internet restored. Syncing offline credentials...");
      if (sdkCaptureRef.current) {
        await sdkCaptureRef.current.syncOfflineCredentials();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('veritas_queue_updated', updateOfflineCount);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('veritas_queue_updated', updateOfflineCount);
    };
  }, []);

  const handleFrameHashed = (hash: string, timestamp: number) => {
    const newHash = { hash, timestamp, sequence: hashesRef.current.length };
    hashesRef.current.push(newHash);
    setHashes([...hashesRef.current]);
  };

  const handleRecordingStateChange = (recording: boolean) => {
    if (recording) {
      hashesRef.current = [];
      setHashes([]);
      setCredentialStatus(null);
    }
  };

  const handleRecordingComplete = (blobUrl: string, status: string) => {
    setCredentialStatus(status);
    
    // Auto-download for demonstration
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `veritas-evidence-${Date.now()}.webm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  };

  useEffect(() => {
    if (hashListRef.current) {
      hashListRef.current.scrollTop = hashListRef.current.scrollHeight;
    }
  }, [hashes]);

  return (
    <div className="app-container">
      <header>
        <Shield size={28} color="var(--accent-color)" />
        <h1>Veritas</h1>
        
        <div style={{ display: 'flex', gap: '8px', marginLeft: '1rem' }}>
          <button 
            className="btn" 
            style={{ padding: '6px 12px', background: activeTab === 'capture' ? 'var(--accent-glow)' : 'transparent', color: activeTab === 'capture' ? 'var(--accent-color)' : 'var(--text-muted)', border: 'none' }}
            onClick={() => setActiveTab('capture')}
          >
            Capture
          </button>
          <button 
            className="btn" 
            style={{ padding: '6px 12px', background: activeTab === 'verify' ? 'var(--accent-glow)' : 'transparent', color: activeTab === 'verify' ? 'var(--accent-color)' : 'var(--text-muted)', border: 'none' }}
            onClick={() => setActiveTab('verify')}
          >
            Verify
          </button>
          <button className={`nav-btn ${activeTab === 'deploy' ? 'active' : ''}`} onClick={() => setActiveTab('deploy')}>
            <Code size={18} /> Deploy Node
          </button>
          <button 
            className="btn" 
            style={{ padding: '6px 12px', background: activeTab === 'admin' ? 'rgba(239, 68, 68, 0.1)' : 'transparent', color: activeTab === 'admin' ? 'var(--danger-color)' : 'var(--text-muted)', border: 'none' }}
            onClick={() => setActiveTab('admin')}
          >
            Hardware CA
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginLeft: 'auto' }}>
          {deviceKeyStr && activeTab === 'capture' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {offlineCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-main)', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid var(--danger-color)', padding: '4px 8px', borderRadius: '12px' }}>
                  <Activity size={12} className="spin" />
                  {offlineCount} Pending Sync{offlineCount > 1 ? 's' : ''} (Offline)
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <Key size={14} />
                Device Key: {deviceKeyStr.substring(0, 16)}...
              </div>
            </div>
          )}
        </div>
      </header>

      {activeTab === 'capture' && (
        <main className="main-content">
          <section className="camera-section" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <CameraStream 
              onFrameHashed={handleFrameHashed}
              onRecordingStateChange={handleRecordingStateChange}
              onRecordingComplete={handleRecordingComplete}
              sdkCaptureRef={sdkCaptureRef}
            />
            
            {credentialStatus && (
              <div style={{ 
                padding: '1rem', 
                background: credentialStatus.includes('Failed') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
                border: `1px solid ${credentialStatus.includes('Failed') ? 'var(--danger-color)' : 'var(--success-color)'}`,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                animation: 'slideIn 0.3s ease-out'
              }}>
                {credentialStatus.includes('Failed') ? <XCircle color="var(--danger-color)" /> : <CheckCircle color="var(--success-color)" />}
                <span>{credentialStatus}</span>
              </div>
            )}
          </section>

          <section className="proof-panel">
            <div className="proof-header">
              <Fingerprint size={20} color="var(--accent-color)" />
              <h2>Provenance Timeline</h2>
            </div>
            
            <div className="hash-list" ref={hashListRef}>
              {hashes.length === 0 ? (
                <div className="empty-state">
                  <Activity size={48} opacity={0.5} />
                  <p>Start a trusted capture session to generate real-time cryptographic proofs.</p>
                </div>
              ) : (
                hashes.map((item) => (
                  <div key={item.sequence} className="hash-item">
                    <div className="hash-meta">
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} />
                        {new Date(item.timestamp).toISOString().split('T')[1].replace('Z', '')}
                      </span>
                      <span>FRAME #{item.sequence.toString().padStart(4, '0')}</span>
                    </div>
                    <div className="hash-value">
                      {item.hash}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </main>
      )}
      
      {activeTab === 'verify' && (
        <main>
          <VerificationPortal />
        </main>
      )}


      {activeTab === 'admin' && (
        <main>
          <AdminPortal />
        </main>
      )}

      {activeTab === 'deploy' && (
        <main>
          <DeployNode />
        </main>
      )}
    </div>
  );
}

export default App;
