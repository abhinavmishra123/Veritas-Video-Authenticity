import React, { useState, useRef } from 'react';
import { Clock, CheckCircle, AlertTriangle, ArrowDown, Scissors, GitMerge, AlertOctagon, Activity, UploadCloud } from 'lucide-react';
export const VerificationPortal: React.FC = () => {
  const [dragActive, setDragActive] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const verifyFile = async (file: File) => {
    setIsVerifying(true);
    setError(null);
    setData(null);
    setVideoUrl(null);
    
    try {
      // Efficiently read only the tail of the file to prevent memory spikes
      const MAX_MANIFEST_SIZE = 65536;
      const tailSlice = file.slice(Math.max(0, file.size - MAX_MANIFEST_SIZE));
      const buffer = await tailSlice.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      
      const text = new TextDecoder().decode(bytes);
      
      const match = text.match(/\[VERITAS_MANIFEST:(.*?)\]/);
      
      if (!match || !match[1]) {
        throw new Error("No Veritas Cryptographic Signature found in file.");
      }
      
      const manifest = JSON.parse(match[1]);
      const videoId = manifest.id;

      const res = await fetch(`http://localhost:3000/api/v1/credential/verify/${videoId}`);
      if (!res.ok) {
        throw new Error("Failed to verify credential against Veritas Global Ledger.");
      }
      
      const result = await res.json();
      
      if (result.status !== "AUTHENTIC") {
         throw new Error("Video originated from an untrusted or REVOKED hardware device.");
      }

      setData(result);
      
      // Create a local blob URL for playback
      const url = URL.createObjectURL(file);
      setVideoUrl(url);

    } catch (err: any) {
      setError(err.message || "An unknown error occurred");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      verifyFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      verifyFile(e.target.files[0]);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {!videoUrl && !isVerifying && !error && (
        <div 
          className="proof-panel"
          style={{
            padding: '5rem 2rem',
            border: `2px dashed ${dragActive ? 'var(--accent-color)' : 'var(--border-color)'}`,
            background: dragActive ? 'rgba(56, 189, 248, 0.05)' : 'var(--bg-panel)',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem'
          }}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadCloud size={64} color={dragActive ? 'var(--accent-color)' : 'var(--text-muted)'} opacity={0.8} />
          <h2>Drop Video Evidence Here</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            We will extract the cryptographic signature from the binary file and verify it against the Veritas Hardware Ledger.
          </p>
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="video/webm,video/mp4" 
            style={{ display: 'none' }} 
          />
        </div>
      )}

      {isVerifying && (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <Activity size={48} className="spin" style={{ opacity: 0.5, animation: 'pulse 1.5s infinite', color: 'var(--accent-color)' }} />
          <h3 style={{ marginTop: '1rem' }}>Extracting Cryptographic Proofs...</h3>
        </div>
      )}

      {error && (
        <div style={{ padding: '3rem', background: 'rgba(239, 68, 68, 0.05)', border: '2px solid var(--danger-color)', borderRadius: '12px', textAlign: 'center', boxShadow: '0 0 40px rgba(239, 68, 68, 0.15)' }}>
          <AlertOctagon size={64} color="var(--danger-color)" style={{ margin: '0 auto 1rem', animation: 'pulse 2s infinite' }} />
          <h2 style={{ color: 'var(--danger-color)', fontSize: '2rem', marginBottom: '1rem', textTransform: 'uppercase' }}>
            {error.includes("TAMPERED") ? "Deepfake / Tampered Video Detected" : "Verification Failed"}
          </h2>
          <p style={{ color: 'var(--text-main)', fontSize: '1.2rem', marginBottom: '2rem' }}>{error}</p>
          <button className="btn" onClick={() => setError(null)} style={{ border: '1px solid var(--danger-color)', color: 'var(--danger-color)' }}>
            Verify Another File
          </button>
        </div>
      )}

      {data && videoUrl && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div className="proof-panel" style={{ overflow: 'hidden', position: 'relative', border: '1px solid var(--success-color)', padding: 0 }}>
            {/* Cinematic Verification Overlay */}
            <div style={{ 
              position: 'absolute', 
              top: '1rem', 
              left: '1rem', 
              zIndex: 10, 
              background: 'rgba(0, 0, 0, 0.6)', 
              backdropFilter: 'blur(10px)',
              padding: '8px 16px', 
              borderRadius: '24px', 
              border: `1px solid ${data.credential.editActions?.includes("DEEPFAKE") ? 'var(--danger-color)' : data.credential.parentId ? '#eab308' : 'var(--success-color)'}`,
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              color: data.credential.editActions?.includes("DEEPFAKE") ? 'var(--danger-color)' : data.credential.parentId ? '#eab308' : 'var(--success-color)',
              fontWeight: 'bold',
              boxShadow: `0 0 20px ${data.credential.editActions?.includes("DEEPFAKE") ? 'rgba(239, 68, 68, 0.5)' : data.credential.parentId ? 'rgba(234, 179, 8, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
              animation: 'pulse 2s infinite'
            }}>
              {data.credential.editActions?.includes("DEEPFAKE") ? <AlertOctagon size={18} /> : data.credential.parentId ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
              {data.credential.editActions?.includes("DEEPFAKE") ? 'TAMPERED DEEPFAKE DETECTED' : data.credential.parentId ? 'EDITED VIDEO (AUTHENTIC LINEAGE)' : 'RAW CAPTURE (100% AUTHENTIC)'}
            </div>
            
            <div style={{ 
              position: 'absolute', 
              bottom: '1rem', 
              right: '1rem', 
              zIndex: 10, 
              background: 'rgba(0, 0, 0, 0.6)', 
              backdropFilter: 'blur(10px)',
              padding: '6px 12px', 
              borderRadius: '8px', 
              fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.7)',
              fontFamily: 'monospace'
            }}>
              HW_KEY: {data.credential.devicePublicKey.substring(0, 12)}...
            </div>

            <video 
              src={videoUrl} 
              controls 
              autoPlay 
              style={{ width: '100%', maxHeight: '500px', background: '#000', display: 'block', borderRadius: '12px' }}
            />
          </div>

          {data.credential.parentId && (
            <div className="proof-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem', background: data.credential.editActions?.includes("DEEPFAKE") ? 'rgba(239, 68, 68, 0.05)' : 'rgba(234, 179, 8, 0.05)', border: `1px solid ${data.credential.editActions?.includes("DEEPFAKE") ? 'var(--danger-color)' : '#eab308'}` }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: data.credential.editActions?.includes("DEEPFAKE") ? 'var(--danger-color)' : '#eab308', marginBottom: '1.5rem' }}>
                <GitMerge size={24} /> Provenance Graph
              </h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%', maxWidth: '500px' }}>
                <div style={{ padding: '1rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', width: '100%', textAlign: 'center' }}>
                  <p style={{ fontWeight: 'bold', color: 'var(--success-color)' }}>Raw Parent Capture [v1]</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>UUID: {data.credential.parentId}</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ borderLeft: '2px dashed var(--border-color)', height: '30px' }}></div>
                  {data.credential.editActions?.includes("DEEPFAKE") ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '2px solid var(--danger-color)', borderRadius: '12px', fontSize: '0.9rem', boxShadow: '0 0 20px rgba(239, 68, 68, 0.4)' }}>
                      <AlertOctagon size={18} color="var(--danger-color)" style={{ animation: 'pulse 1s infinite' }} />
                      <span style={{ color: 'var(--danger-color)', fontWeight: 'bold', letterSpacing: '1px' }}>DEEPFAKE TAMPERING DETECTED</span>
                      <span style={{ color: 'var(--danger-color)', opacity: 0.8 }}>({data.credential.editActions})</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '0.8rem' }}>
                      <Scissors size={14} color="#eab308" />
                      <span style={{ color: '#eab308', fontWeight: 'bold' }}>{data.credential.editPercentage?.toFixed(2)}% DEVIATION</span>
                      <span>({data.credential.editActions})</span>
                    </div>
                  )}
                  <div style={{ borderLeft: '2px dashed var(--border-color)', height: '30px' }}></div>
                  <ArrowDown size={20} color="var(--border-color)" />
                </div>

                <div style={{ padding: '1rem', background: 'var(--bg-card)', border: `1px solid ${data.credential.editActions?.includes("DEEPFAKE") ? 'var(--danger-color)' : '#eab308'}`, borderRadius: '8px', width: '100%', textAlign: 'center', boxShadow: `0 0 15px ${data.credential.editActions?.includes("DEEPFAKE") ? 'rgba(239, 68, 68, 0.2)' : 'rgba(234, 179, 8, 0.1)'}` }}>
                  <p style={{ fontWeight: 'bold', color: data.credential.editActions?.includes("DEEPFAKE") ? 'var(--danger-color)' : '#eab308' }}>Edited Child Video [v2]</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>UUID: {data.credential.videoId}</p>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div className="proof-panel" style={{ height: 'fit-content' }}>
              <div className="proof-header">
                <CheckCircle size={20} color="var(--accent-color)" />
                <h2>Cryptographic Proofs</h2>
              </div>
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Device Public Key</span>
                  <span style={{ fontFamily: 'monospace' }}>{data.credential.devicePublicKey.substring(0, 16)}...</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Cryptographic Signature</span>
                  <span style={{ fontFamily: 'monospace' }}>{data.credential.signature.substring(0, 16)}...</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Device Chain Hash</span>
                  <span style={{ fontFamily: 'monospace', color: 'var(--success-color)' }}>{data.credential.deviceChainHash.substring(0, 16)}...</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Capture Duration</span>
                  <span>{((data.credential.endTime - data.credential.startTime) / 1000).toFixed(1)} Seconds</span>
                </div>
              </div>
            </div>

            <div className="proof-panel">
              <div className="proof-header">
                <Activity size={20} color="var(--accent-color)" />
                <h2>Frame Hash Chain</h2>
              </div>
              <div className="hash-list" style={{ maxHeight: '250px' }}>
                {data.credential.frameHashes.map((fh: any) => (
                  <div key={fh.id} className="hash-item" style={{ animation: 'none' }}>
                    <div className="hash-meta">
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} />
                        {new Date(fh.timestamp).toISOString().split('T')[1].replace('Z', '')}
                      </span>
                      <span>FRAME #{fh.sequence.toString().padStart(4, '0')}</span>
                    </div>
                    <div className="hash-value">
                      {fh.hash}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button className="btn" onClick={() => { setVideoUrl(null); setData(null); }} style={{ margin: '0 auto', display: 'block' }}>
            Verify Another Video
          </button>
        </div>
      )}
    </div>
  );
};
