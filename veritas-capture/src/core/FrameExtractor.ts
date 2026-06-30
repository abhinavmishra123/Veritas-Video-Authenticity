export class FrameExtractor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  /**
   * Captures the current frame of a video element and returns it as an ArrayBuffer (JPEG format).
   */
  public async extractFrameBuffer(video: HTMLVideoElement): Promise<ArrayBuffer | null> {
    if (!this.ctx || video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }

    // Set canvas dimensions to match the video
    if (this.canvas.width !== video.videoWidth) {
        this.canvas.width = video.videoWidth;
        this.canvas.height = video.videoHeight;
    }

    // Draw the current video frame to the canvas
    this.ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);

    // Convert the canvas to a JPEG blob and then to an ArrayBuffer
    return new Promise((resolve) => {
      this.canvas.toBlob((blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        blob.arrayBuffer().then(resolve).catch(() => resolve(null));
      }, 'image/jpeg', 0.85); // 0.85 is a good balance between quality and hash speed
    });
  }
}
