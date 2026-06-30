import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffprobePath from 'ffprobe-static';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Jimp from 'jimp';

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}
if (ffprobePath.path) {
  ffmpeg.setFfprobePath(ffprobePath.path);
}

export interface VideoMetadata {
  duration: number;
  size: number;
  width: number;
  height: number;
}

export const extractVideoMetadata = (buffer: Buffer): Promise<VideoMetadata> => {
  return new Promise((resolve, reject) => {
    // Write buffer to a temp file because fluent-ffmpeg prefers file paths
    const tempFile = path.join(os.tmpdir(), `veritas_temp_${Date.now()}.webm`);
    fs.writeFileSync(tempFile, buffer);

    ffmpeg.ffprobe(tempFile, (err, metadata) => {
      fs.unlinkSync(tempFile); // Clean up immediately
      if (err) {
        return reject(err);
      }
      
      const format = metadata.format;
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      
      resolve({
        duration: format.duration || 0,
        size: format.size || buffer.length,
        width: videoStream?.width || 0,
        height: videoStream?.height || 0
      });
    });
  });
};

export const compareVisualFrames = async (v1Buffer: Buffer, v2Buffer: Buffer): Promise<number> => {
  const timestamp = Date.now();
  const t1 = path.join(os.tmpdir(), `v1_${timestamp}.webm`);
  const t2 = path.join(os.tmpdir(), `v2_${timestamp}.webm`);
  const img1 = path.join(os.tmpdir(), `img1_${timestamp}.png`);
  const img2 = path.join(os.tmpdir(), `img2_${timestamp}.png`);

  fs.writeFileSync(t1, v1Buffer);
  fs.writeFileSync(t2, v2Buffer);

  const extractFrame = (videoPath: string, outPath: string) => {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: ['0'], // Extract the very first frame
          folder: path.dirname(outPath),
          filename: path.basename(outPath),
          size: '320x240' // Downsample to guarantee consistent hashing
        })
        .on('end', resolve)
        .on('error', reject);
    });
  };

  try {
    await extractFrame(t1, img1);
    await extractFrame(t2, img2);

    const j1 = await Jimp.read(img1);
    const j2 = await Jimp.read(img2);

    // Calculate Perceptual Hash Distance (0 = identical, 1 = completely different)
    const distance = Jimp.distance(j1, j2); 
    
    // Cleanup
    if (fs.existsSync(t1)) fs.unlinkSync(t1);
    if (fs.existsSync(t2)) fs.unlinkSync(t2);
    if (fs.existsSync(img1)) fs.unlinkSync(img1);
    if (fs.existsSync(img2)) fs.unlinkSync(img2);
    
    return distance;
  } catch (err) {
    console.error("[FFmpeg] Frame extraction failed", err);
    if (fs.existsSync(t1)) fs.unlinkSync(t1);
    if (fs.existsSync(t2)) fs.unlinkSync(t2);
    return 1.0; // Assume complete tampering on failure
  }
};
