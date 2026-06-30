import React, { useRef, useState, useEffect } from 'react';
import { Camera, Square, Loader } from 'lucide-react';
import { VeritasCapture } from '@veritas/sdk';
import type { FrameHash } from '@veritas/sdk';

interface CameraStreamProps {
  onFrameHashed: (hash: string, timestamp: number) => void;
  onRecordingStateChange: (isRecording: boolean) => void;
  onRecordingComplete: (blobUrl: string, status: string) => void;
  sdkCaptureRef: React.MutableRefObject<VeritasCapture | null>;
}

export const CameraStream: React.FC<CameraStreamProps> = ({ 
  onFrameHashed, 
  onRecordingStateChange,
  onRecordingComplete,
  sdkCaptureRef
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const initCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, 
          audio: true 
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("Failed to access camera", err);
      }
    };
    initCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const toggleRecording = async () => {
    if (!stream || !videoRef.current || !sdkCaptureRef.current) return;

    if (isRecording) {
      setIsRecording(false);
      onRecordingStateChange(false);
      setIsProcessing(true);
      
      try {
        const result = await sdkCaptureRef.current.stop();
        onRecordingComplete(result.blobUrl, result.credentialStatus);
      } catch (err) {
        console.error("Failed to stop recording", err);
      } finally {
        setIsProcessing(false);
      }
    } else {
      setIsRecording(true);
      onRecordingStateChange(true);
      
      await sdkCaptureRef.current.start(stream, videoRef.current, (frameHash: FrameHash) => {
        onFrameHashed(frameHash.hash, frameHash.timestamp);
      });
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', borderRadius: '16px', overflow: 'hidden', backgroundColor: '#000', aspectRatio: '16/9' }}>
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
      />
      
      {isRecording && (
        <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.6)', padding: '6px 12px', borderRadius: '24px', color: 'var(--danger-color)', fontWeight: 'bold', fontSize: '0.9rem', animation: 'pulse 2s infinite' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--danger-color)' }} />
          SECURE CAPTURE
        </div>
      )}

      {isProcessing && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', color: 'var(--accent-color)' }}>
          <Loader size={48} className="spin" style={{ marginBottom: '1rem' }} />
          <h3 style={{ margin: 0 }}>Signing Credential...</h3>
        </div>
      )}

      <div style={{ position: 'absolute', bottom: '24px', left: '0', right: '0', display: 'flex', justifyContent: 'center' }}>
        <button 
          onClick={toggleRecording}
          disabled={isProcessing}
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            border: `4px solid ${isRecording ? 'var(--danger-color)' : 'white'}`,
            background: isRecording ? 'transparent' : 'var(--danger-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            opacity: isProcessing ? 0.5 : 1
          }}
        >
          {isRecording ? <Square size={24} color="var(--danger-color)" fill="var(--danger-color)" /> : <Camera size={28} color="white" />}
        </button>
      </div>
    </div>
  );
};
