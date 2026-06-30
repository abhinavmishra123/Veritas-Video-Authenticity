import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import nacl from 'tweetnacl';
import { execSync } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

const generateTestVideo = (outputPath, duration, color) => {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(`color=c=${color}:s=320x240:r=30:d=${duration}`)
      .inputFormat('lavfi')
      .outputOptions([
        '-c:v libvpx-vp9'
      ])
      .save(outputPath)
      .on('end', resolve)
      .on('error', reject);
  });
};

const run = async () => {
  console.log("🎬 Setting up Veritas Integration Test...");
  const v1Path = path.join(process.cwd(), 'v1_raw.webm');
  const v2Path = path.join(process.cwd(), 'v2_edited.webm');
  const v3Path = path.join(process.cwd(), 'v3_deepfake.webm');

  // 1. Generate Fake Videos
  console.log("[1] Generating test videos using FFmpeg...");
  await generateTestVideo(v1Path, 5, "blue");
  await generateTestVideo(v2Path, 3, "blue"); // Same color, trimmed to 3s
  await generateTestVideo(v3Path, 5, "red"); // Completely different color (Deepfake)

  // 2. Sign V1 as an Authentic Hardware Capture
  console.log("[2] Cryptographically signing V1...");
  const keypair = nacl.sign.keyPair();
  const publicKeyHex = Buffer.from(keypair.publicKey).toString('hex');
  const secretKeyHex = Buffer.from(keypair.secretKey).toString('hex');
  
  const v1Buffer = fs.readFileSync(v1Path);
  const fileHash = crypto.createHash('sha256').update(v1Buffer).digest('hex');
  const videoId = crypto.randomUUID();

  const payload = {
    version: 1,
    video_id: videoId,
    file_hash: fileHash,
    device: { public_key: publicKeyHex, type: "test-script" },
    capture: { start_time: Date.now() - 5000, end_time: Date.now(), frame_count: 150 },
    frame_hashes: []
  };

  const payloadStr = JSON.stringify(payload);
  const signatureUint8 = nacl.sign.detached(new TextEncoder().encode(payloadStr), keypair.secretKey);
  const signatureHex = Buffer.from(signatureUint8).toString('hex');

  const credential = { ...payload, signature: signatureHex };

  // 3. Register V1 in the Veritas API Database
  console.log("[3] Registering V1 with Veritas Gateway...");
  const res = await fetch("http://localhost:3000/api/v1/credential/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credential)
  });
  
  if (!res.ok) {
    console.error("Failed to register V1!", await res.text());
    process.exit(1);
  }

  // 4. Inject C2PA Manifest into V1
  console.log("[4] Injecting C2PA Manifest into V1 binary...");
  const manifest = { id: videoId, public_key: publicKeyHex, file_hash: fileHash, signature: signatureHex };
  const footerStr = `\n[VERITAS_MANIFEST:${JSON.stringify(manifest)}]\n`;
  fs.appendFileSync(v1Path, footerStr);

  // 5. Test Python Integration
  const pyScript = path.join(process.cwd(), '../examples/python-integration/edit_lineage.py');
  
  console.log("\n==========================================");
  console.log("🧪 TEST 1: Valid Edit (Trimmed Video)");
  console.log("==========================================");
  try {
    const out1 = execSync(`python ${pyScript} ${v1Path} ${v2Path} --api-key vrt_test_12345`, { env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }).toString();
    console.log(out1);
  } catch (e) {
    console.log(e.stdout.toString());
  }

  console.log("\n==========================================");
  console.log("🧪 TEST 2: Deepfake Detection (Same length, tampered pixels)");
  console.log("==========================================");
  try {
    const out2 = execSync(`python ${pyScript} ${v1Path} ${v3Path} --api-key vrt_test_12345`, { env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }).toString();
    console.log(out2);
  } catch (e) {
    console.log(e.stdout.toString());
  }
};

run().catch(console.error);
