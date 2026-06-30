import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, ChevronRight, Lock, Code2, Cpu } from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div>
      {/* Hero Section */}
      <section className="section" style={{ paddingTop: '12rem', textAlign: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '800px', height: '800px', background: 'radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, rgba(0,0,0,0) 70%)', zIndex: -1, pointerEvents: 'none' }} />
        
        <div className="container animate-fade-up">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '20px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)', color: 'var(--accent-color)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '2rem' }}>
            <Shield size={14} />
            The Global Standard for Digital Authenticity
          </div>
          
          <h1 className="gradient-text" style={{ fontSize: '4.5rem', marginBottom: '1.5rem', maxWidth: '900px', margin: '0 auto 1.5rem' }}>
            Trust is Broken.<br />
            <span className="gradient-text-accent">Veritas Fixes It.</span>
          </h1>
          
          <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto 3rem' }}>
            The world's first hardware-backed cryptographic protocol for proving the authenticity of digital media. Stop deepfakes before they are created.
          </p>
          
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link to="/docs" className="btn btn-primary">
              Read the Docs <ChevronRight size={18} />
            </Link>
            <a href="http://localhost:5173" target="_blank" rel="noreferrer" className="btn btn-outline">
              Try the Demo
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="section" style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>How Veritas Works</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Zero-trust media verification powered by Ed25519 cryptography.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
              <div style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.1)', color: 'var(--accent-color)' }}>
                <Cpu size={32} />
              </div>
              <h3 style={{ fontSize: '1.25rem' }}>Hardware Provisioning</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                Camera manufacturers inject a secure Ed25519 keypair directly into the image sensor silicon at the factory level.
              </p>
            </div>

            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
              <div style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.1)', color: 'var(--accent-color)' }}>
                <Lock size={32} />
              </div>
              <h3 style={{ fontSize: '1.25rem' }}>Cryptographic Chaining</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                Every frame is hashed and chained. The final video binary is injected with a signature that makes tampering mathematically impossible.
              </p>
            </div>

            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
              <div style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.1)', color: 'var(--accent-color)' }}>
                <Code2 size={32} />
              </div>
              <h3 style={{ fontSize: '1.25rem' }}>Universal Verification</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                Social media platforms and news organizations use the Veritas API Gateway to instantly verify the provenance of any uploaded file.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Developer CTA Section */}
      <section className="section">
        <div className="container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>Built for Developers.</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '2rem' }}>
              Integrate hardware-grade authenticity into your camera app or social platform in three lines of code with the Veritas SDK.
            </p>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem', listStyle: 'none', color: 'var(--text-muted)' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Shield size={16} color="var(--accent-color)" /> Open Source SDK</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Shield size={16} color="var(--accent-color)" /> REST API Gateway</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Shield size={16} color="var(--accent-color)" /> Decentralized Hardware Registry</li>
            </ul>
            <Link to="/docs" className="btn btn-outline">View Documentation</Link>
          </div>
          
          <div className="glass-panel code-block" style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', padding: '0 1rem', gap: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#eab308' }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
            </div>
            <pre style={{ marginTop: '2rem', margin: 0 }}>
<span style={{ color: '#c678dd' }}>import</span> {'{'} VeritasCapture {'}'} <span style={{ color: '#c678dd' }}>from</span> <span style={{ color: '#98c379' }}>'@veritas/sdk'</span>;{'\n\n'}
<span style={{ color: '#5c6370', fontStyle: 'italic' }}>// 1. Initialize the SDK</span>{'\n'}
<span style={{ color: '#c678dd' }}>const</span> capture = <span style={{ color: '#c678dd' }}>new</span> <span style={{ color: '#e5c07b' }}>VeritasCapture</span>();{'\n\n'}
<span style={{ color: '#5c6370', fontStyle: 'italic' }}>// 2. Start Hardware Chaining</span>{'\n'}
<span style={{ color: '#c678dd' }}>await</span> capture.<span style={{ color: '#61afef' }}>start</span>(cameraStream);{'\n\n'}
<span style={{ color: '#5c6370', fontStyle: 'italic' }}>// 3. Stop & Cryptographically Sign</span>{'\n'}
<span style={{ color: '#c678dd' }}>const</span> secureBlob = <span style={{ color: '#c678dd' }}>await</span> capture.<span style={{ color: '#61afef' }}>stopAndExport</span>();
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
};
