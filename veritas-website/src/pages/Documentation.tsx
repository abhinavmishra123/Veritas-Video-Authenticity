import React from 'react';
import { Terminal, Code, Cpu } from 'lucide-react';

export const Documentation: React.FC = () => {
  return (
    <div className="container" style={{ paddingTop: '8rem', paddingBottom: '4rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '4rem' }}>
        
        {/* Sidebar Nav */}
        <aside style={{ position: 'sticky', top: '8rem', height: 'calc(100vh - 10rem)', borderRight: '1px solid var(--border-color)', paddingRight: '2rem', overflowY: 'auto' }}>
          <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem', letterSpacing: '1px' }}>Overview</h3>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
            <li><a href="#introduction" style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 600 }}>Architecture Overview</a></li>
            <li><a href="#blockchain-registry" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Verified Application Ledger</a></li>
          </ul>

          <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem', letterSpacing: '1px' }}>SDK Developers</h3>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
            <li><a href="#sdk-install" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Install @veritas/sdk</a></li>
            <li><a href="#capture-video" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Capturing Video</a></li>
            <li><a href="#offline-quotas" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Offline Quota Management</a></li>
          </ul>

          <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem', letterSpacing: '1px' }}>Enterprise Verification</h3>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
            <li><a href="#api-gateway" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Verify via API (REST)</a></li>
            <li><a href="#edit-lineage" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Edit Lineage (v1 -&gt; v2)</a></li>
            <li><a href="#api-python" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Python Verification</a></li>
          </ul>

          <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem', letterSpacing: '1px' }}>Security & Engine</h3>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <li><a href="#c2pa-manifests" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>C2PA-Style Manifests</a></li>
            <li><a href="#tamper-resistance" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Hack-Proof Deepfake Detection</a></li>
          </ul>
        </aside>

        {/* Content */}
        <main>
          <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>Veritas Protocol Whitepaper & Docs</h1>
          <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: '4rem' }}>The end-to-end, real-world enterprise protocol for zero-trust media provenance.</p>

          <section id="introduction" style={{ marginBottom: '4rem' }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Architecture Overview</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
              The Veritas Protocol guarantees the authenticity of digital media across the internet. 
              Instead of relying on fragile "Deepfake Detectors" which are in a perpetual arms race with AI, Veritas takes a <strong>Zero-Trust Provenance</strong> approach.
            </p>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
              We do this through a three-pillar architecture:
            </p>
            <ul style={{ color: 'var(--text-muted)', marginLeft: '1.5rem', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li><strong>1. The Ledger:</strong> An immutable Ethereum Smart Contract that registers trusted software applications.</li>
              <li><strong>2. The SDK:</strong> A browser-native engine that uses Ed25519 cryptography to sign video frames immediately upon capture.</li>
              <li><strong>3. The Gateway:</strong> A stateless API that verifies C2PA-style embedded metadata and calculates structural Edit Lineage using FFmpeg.</li>
            </ul>
          </section>

          <section id="blockchain-registry" style={{ marginBottom: '4rem' }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>The Verified Application Ledger</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
              Veritas does not try to verify every physical camera lens on Earth. Instead, we authenticate the <strong>Software Application</strong> (e.g., proving a video genuinely originated from the "Official NYT App" or the "Binance KYC App").
            </p>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
              When an app uses the Veritas SDK, it is issued a unique Ed25519 Public Key. This key is minted onto an <strong>Ethereum Smart Contract</strong> by the Veritas Certificate Authority. When the API Gateway verifies a video, it mathematically proves the signature matches a trusted app on the blockchain.
            </p>
          </section>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '4rem 0' }} />

          <section id="sdk-install" style={{ marginBottom: '4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
              <Cpu size={28} color="var(--accent-color)" />
              <h2 style={{ fontSize: '2rem', margin: 0 }}>Install the Veritas SDK</h2>
            </div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
              The SDK abstracts all Ed25519 cryptography, memory cleanup, and binary hashing into a simple React hook / class.
            </p>
            <div className="code-block">
              npm install @veritas/sdk
            </div>
          </section>

          <section id="capture-video" style={{ marginBottom: '4rem' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Capturing Authentic Video</h2>
            <div className="code-block">
<pre style={{ margin: 0 }}>
<span style={{ color: '#c678dd' }}>import</span> {'{'} VeritasCapture {'}'} <span style={{ color: '#c678dd' }}>from</span> <span style={{ color: '#98c379' }}>'@veritas/sdk'</span>;{'\n\n'}
<span style={{ color: '#c678dd' }}>const</span> capture = <span style={{ color: '#c678dd' }}>new</span> <span style={{ color: '#e5c07b' }}>VeritasCapture</span>();{'\n'}
<span style={{ color: '#c678dd' }}>await</span> capture.<span style={{ color: '#61afef' }}>start</span>(cameraStream, videoElement);{'\n\n'}
<span style={{ color: '#5c6370', fontStyle: 'italic' }}>// SDK automatically calculates file hashes and signs the manifest</span>{'\n'}
<span style={{ color: '#c678dd' }}>const</span> {'{'} blobUrl {'}'} = <span style={{ color: '#c678dd' }}>await</span> capture.<span style={{ color: '#61afef' }}>stop</span>();
</pre>
            </div>
          </section>

          <section id="offline-quotas" style={{ marginBottom: '4rem' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Offline-First Quota Management</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
              The Veritas SDK is built for field journalists in war zones or areas with no internet. Videos are signed completely offline in the browser. 
            </p>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
              To prevent browser <code>localStorage</code> from overflowing and crashing the app, the SDK implements an enterprise-grade <strong>Least-Recently-Used (LRU) Eviction Policy</strong>, guaranteeing a maximum of 50 queued credentials are held in memory until connection is restored.
            </p>
          </section>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '4rem 0' }} />

          <section id="api-gateway" style={{ marginBottom: '4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
              <Terminal size={28} color="var(--accent-color)" />
              <h2 style={{ fontSize: '2rem', margin: 0 }}>Verify via API Gateway</h2>
            </div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Submit a `.webm` file containing a Veritas signature to the gateway for instantaneous verification.
            </p>
            <div className="code-block">
<pre style={{ margin: 0 }}>
curl -X POST https://api.veritas.dev/v1/gateway/verify \
  -H "x-api-key: vrt_live_your_key_here" \
  -F "video=@/path/to/evidence.webm"
</pre>
            </div>
          </section>

          <section id="edit-lineage" style={{ marginBottom: '4rem' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Edit Lineage (v1 -&gt; v2)</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
              Real-world workflows require video editing. Strict hashing breaks when a news channel trims a clip or adds a watermark.
            </p>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
              Veritas solves this with <strong>Edit Lineage</strong>. Post-production apps submit both the raw `v1` video and the edited `v2` video to the <code>/edit-lineage</code> endpoint. The API uses a server-side FFmpeg engine to structurally analyze both videos, calculates the <strong>Edit Percentage</strong> (e.g. 50% Trimmed, Cropped), and issues a new, cryptographically linked signature for `v2`.
            </p>
            <div className="code-block">
<pre style={{ margin: 0 }}>
curl -X POST https://api.veritas.dev/v1/gateway/edit-lineage \
  -H "x-api-key: vrt_live_your_key_here" \
  -F "video_v1=@/path/to/raw_parent.webm" \
  -F "video_v2=@/path/to/edited_child.webm"
</pre>
            </div>
          </section>

          <section id="c2pa-manifests" style={{ marginBottom: '4rem' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>C2PA-Style Manifest Injection</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
              Veritas videos are entirely decentralized and self-verifying. The entire cryptographic payload (signatures, public keys, frame hashes, edit lineage parents) is injected directly into the bytes of the media file itself.
            </p>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
              The API Gateway is stateless. It reads the embedded manifest, recalculates the hash, and mathematically verifies it locally—meaning the system scales infinitely and files survive even if the original database is destroyed.
            </p>
          </section>

          <section id="tamper-resistance" style={{ marginBottom: '4rem' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Hack-Proof Deepfake Detection</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
              If a malicious actor takes an authentic Veritas video and uses AI to generate a Deepfake or alters a single pixel, the internal mathematical <code>SHA-256</code> file hash will inherently change. 
            </p>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
              Upon verification, the Gateway recalculates the hash, discovers a mismatch with the Ed25519 payload, and triggers a massive red <code>DEEPFAKE / TAMPERED VIDEO DETECTED</code> alert across the Veritas ecosystem.
            </p>
          </section>

        </main>
      </div>
    </div>
  );
};
