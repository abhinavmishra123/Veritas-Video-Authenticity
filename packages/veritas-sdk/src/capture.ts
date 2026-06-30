import { VeritasCrypto } from './crypto';

// Custom Error Classes
export class VeritasError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VeritasError';
  }
}

export class VeritasNotSupportedError extends VeritasError {
  constructor(message: string) {
    super(message);
    this.name = 'VeritasNotSupportedError';
  }
}

export class VeritasNetworkError extends VeritasError {
  constructor(message: string) {
    super(message);
    this.name = 'VeritasNetworkError';
  }
}

export interface FrameHash {
  hash: string;
  timestamp: number;
  sequence: number;
}

export interface CaptureConfig {
  apiUrl: string;
  keyPair?: { publicKey: Uint8Array; secretKey: Uint8Array };
}

export class VeritasCapture {
  private mediaRecorder: MediaRecorder | null = null;
  private videoChunks: Blob[] = [];
  private hashes: FrameHash[] = [];
  private sequence = 0;
  private captureStartTime = 0;
  private keyPair: { publicKey: Uint8Array; secretKey: Uint8Array };
  private apiUrl: string;
  private intervalId: any = null;
  private canvas: HTMLCanvasElement | null = null;

  constructor(config: CaptureConfig) {
    this.apiUrl = config.apiUrl;
    this.keyPair = config.keyPair || VeritasCrypto.generateKeypair();
  }

  /**
   * Static method to check if the browser supports Veritas hardware capture requirements
   */
  public static isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    if (!window.MediaRecorder) return false;
    if (!window.crypto || !window.crypto.subtle) return false;
    if (typeof HTMLCanvasElement === 'undefined') return false;
    return true;
  }

  public getPublicKeyHex(): string {
    return VeritasCrypto.toHex(this.keyPair.publicKey);
  }

  public getSecretKeyHex(): string {
    return VeritasCrypto.toHex(this.keyPair.secretKey);
  }

  public async start(stream: MediaStream, videoElement: HTMLVideoElement, onFrameHashed?: (hash: FrameHash) => void) {
    if (!VeritasCapture.isSupported()) {
      throw new VeritasNotSupportedError("Browser does not support MediaRecorder or WebCrypto API");
    }

    this.cleanup(); // Ensure clean slate
    this.videoChunks = [];
    this.hashes = [];
    this.sequence = 0;
    this.captureStartTime = Date.now();

    try {
      this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    } catch (e: any) {
      throw new VeritasError(`Failed to initialize MediaRecorder: ${e.message}`);
    }
    
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.videoChunks.push(e.data);
    };

    this.mediaRecorder.start();

    // Setup hardware frame hashing simulation
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d');
    
    this.intervalId = setInterval(async () => {
      if (!ctx || !this.canvas || videoElement.readyState < 2) return;
      
      this.canvas.width = videoElement.videoWidth || 640;
      this.canvas.height = videoElement.videoHeight || 480;
      ctx.drawImage(videoElement, 0, 0, this.canvas.width, this.canvas.height);
      
      this.canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          const buffer = await blob.arrayBuffer();
          const hash = await VeritasCrypto.hashSHA256(buffer);
          
          const frameHash = {
            hash,
            timestamp: Date.now(),
            sequence: this.sequence++
          };
          
          this.hashes.push(frameHash);
          if (onFrameHashed) onFrameHashed(frameHash);
        } catch (err) {
          console.error("[Veritas SDK] Error hashing frame", err);
        }
      }, 'image/jpeg', 0.5);
    }, 1000);
  }

  private cleanup() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.canvas) {
      this.canvas.width = 0;
      this.canvas.height = 0;
      this.canvas = null;
    }
  }

  public async stop(): Promise<{ blobUrl: string, credentialStatus: string }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        return reject(new VeritasError("Recording not started or already stopped"));
      }

      this.cleanup();

      this.mediaRecorder.onerror = (e: Event) => {
        reject(new VeritasError(`MediaRecorder error: ${e.type}`));
      };

      this.mediaRecorder.onstop = async () => {
        try {
          const videoBlob = new Blob(this.videoChunks, { type: 'video/webm' });
          const videoBuffer = await videoBlob.arrayBuffer();
          const fileHash = await VeritasCrypto.hashSHA256(videoBuffer);

          const videoId = crypto.randomUUID();
          
          const payload = {
            version: 1,
            video_id: videoId,
            file_hash: fileHash,
            device: {
              public_key: VeritasCrypto.toHex(this.keyPair.publicKey),
              type: "browser-webcrypto"
            },
            capture: {
              start_time: this.captureStartTime,
              end_time: Date.now(),
              frame_count: this.hashes.length
            },
            frame_hashes: this.hashes
          };

          const payloadStr = JSON.stringify(payload);
          const signature = VeritasCrypto.sign(payloadStr, this.keyPair.secretKey);
          
          const credential = { ...payload, signature };
          let credentialStatus = "Signing credential...";

          try {
            // Check network state first if running in a browser
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
               throw new VeritasNetworkError("Browser is offline");
            }

            const res = await fetch(`${this.apiUrl}/api/v1/credential/create`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(credential)
            });
            
            if (res.ok) {
               credentialStatus = "Successfully Verified & Stored on Veritas Infrastructure";
            } else {
               const err = await res.text();
               credentialStatus = `Verification Failed: ${err}`;
            }
          } catch (e: any) {
            // Handle offline state or network failure
            credentialStatus = `OFFLINE MODE: Saved locally. Waiting for network to sync.`;
            this.pushToOfflineQueue(credential);
          }

          // Construct final Blob with injected C2PA-style manifest footer
          const manifest = {
            id: videoId,
            public_key: VeritasCrypto.toHex(this.keyPair.publicKey),
            file_hash: fileHash,
            signature: signature
          };
          const footerStr = `\n[VERITAS_MANIFEST:${JSON.stringify(manifest)}]\n`;
          const footerBlob = new Blob([footerStr], { type: 'text/plain' });
          const finalBlob = new Blob([...this.videoChunks, footerBlob], { type: 'video/webm' });
          
          // Clear chunks to free memory
          this.videoChunks = [];
          
          resolve({
            blobUrl: URL.createObjectURL(finalBlob),
            credentialStatus
          });
        } catch (err: any) {
          reject(new VeritasError(`Failed to process recording: ${err.message}`));
        }
      };

      this.mediaRecorder.stop();
    });
  }

  private pushToOfflineQueue(credential: any) {
    if (typeof localStorage === 'undefined') return;
    try {
      const queueStr = localStorage.getItem('veritas_offline_queue') || '[]';
      let queue: any[] = JSON.parse(queueStr);
      
      queue.push(credential);
      
      // LRU Eviction Policy: Keep maximum 50 offline credentials to prevent quota exceeded errors
      const MAX_OFFLINE_QUEUE_SIZE = 50;
      if (queue.length > MAX_OFFLINE_QUEUE_SIZE) {
        console.warn(`[Veritas SDK] Offline queue exceeded ${MAX_OFFLINE_QUEUE_SIZE}. Evicting oldest credentials.`);
        queue = queue.slice(queue.length - MAX_OFFLINE_QUEUE_SIZE);
      }
      
      localStorage.setItem('veritas_offline_queue', JSON.stringify(queue));
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('veritas_queue_updated'));
      }
    } catch (e) {
      console.error("[Veritas SDK] Failed to save offline credential. LocalStorage may be full.", e);
    }
  }

  /**
   * Attempts to sync all queued offline credentials with the Veritas API.
   * Resolves with the number of successfully synced credentials.
   */
  public async syncOfflineCredentials(): Promise<number> {
    if (typeof localStorage === 'undefined') return 0;
    
    let queue: any[];
    try {
      const queueStr = localStorage.getItem('veritas_offline_queue') || '[]';
      queue = JSON.parse(queueStr);
    } catch (e) {
      return 0;
    }
    
    if (queue.length === 0) return 0;
    
    console.log(`[Veritas SDK] Attempting to sync ${queue.length} offline credentials...`);
    
    const remainingQueue: any[] = [];
    let syncedCount = 0;

    for (const credential of queue) {
      try {
        const res = await fetch(`${this.apiUrl}/api/v1/credential/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credential)
        });
        
        if (res.ok) {
          syncedCount++;
        } else {
          // If the server explicitly rejected it (e.g. 400), we probably shouldn't retry forever.
          console.warn(`[Veritas SDK] Server rejected offline sync: ${await res.text()}`);
          remainingQueue.push(credential);
        }
      } catch (err) {
        // Still offline or network error
        console.warn(`[Veritas SDK] Sync failed, keeping in queue.`);
        remainingQueue.push(credential);
      }
    }
    
    try {
      localStorage.setItem('veritas_offline_queue', JSON.stringify(remainingQueue));
    } catch (e) {
      console.error("[Veritas SDK] Failed to update offline queue after sync", e);
    }
    
    if (syncedCount > 0 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('veritas_queue_updated'));
    }
    
    return syncedCount;
  }
}
