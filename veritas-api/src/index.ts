import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import nacl from 'tweetnacl';
import crypto from 'crypto';
import multer from 'multer';
import { ethers } from 'ethers';
import rateLimit from 'express-rate-limit';
import NodeCache from 'node-cache';
import { extractVideoMetadata, compareVisualFrames } from './ffmpeg-utils';

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 1. Rate Limiting Setup
// Gateway endpoint gets strict rate limiting (e.g., 100 requests per 15 minutes per IP)
const gatewayLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: "Too many verification requests from this IP, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

// 2. Blockchain Caching Setup
// We cache the results of Smart Contract calls to prevent RPC node spam and improve latency.
const contractCache = new NodeCache({ stdTTL: 60, checkperiod: 30 }); // Cache for 60 seconds

const upload = multer({ storage: multer.memoryStorage() });

// Smart Contract Setup
const RPC_URL = "http://127.0.0.1:8545";
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const ABI = [
  "function registerDevice(string memory publicKey) public",
  "function revokeDevice(string memory publicKey) public",
  "function isDeviceTrusted(string memory publicKey) public view returns (bool)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
// Using Hardhat Account 0 to act as the "Manufacturer" calling the contract
const signer = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);
const registryContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer) as any;

const fromHex = (hex: string): Uint8Array => {
  const match = hex.match(/.{1,2}/g);
  if (!match) return new Uint8Array();
  return new Uint8Array(match.map(byte => parseInt(byte, 16)));
};

// API Key logic removed for Open Source release
// Internal Endpoint: Create Credential (used by capture devices)
app.post('/api/v1/credential/create', async (req, res) => {
  try {
    const credential = req.body;
    const { signature, ...payload } = credential;
    
    const payloadStr = JSON.stringify(payload);
    const messageUint8 = new TextEncoder().encode(payloadStr);
    
    const signatureUint8 = fromHex(signature);
    const pubKeyUint8 = fromHex(payload.device.public_key);
    
    const isValid = nacl.sign.detached.verify(messageUint8, signatureUint8, pubKeyUint8);
    
    if (!isValid) {
      return res.status(401).send("Invalid Cryptographic Signature");
    }

    // Auto-register device on Blockchain (and cache in DB for dashboard)
    const isTrusted = await registryContract.isDeviceTrusted(payload.device.public_key);
    if (!isTrusted) {
      console.log(`[Blockchain] Registering new hardware device: ${payload.device.public_key}`);
      const tx = await registryContract.registerDevice(payload.device.public_key);
      await tx.wait();
      console.log(`[Blockchain] Device registered successfully!`);
    }

    await prisma.hardwareDevice.upsert({
      where: { publicKey: payload.device.public_key },
      update: {},
      create: {
        publicKey: payload.device.public_key,
        type: payload.device.type
      }
    });

    const lastDeviceCredential = await prisma.credential.findFirst({
      where: { devicePublicKey: payload.device.public_key },
      orderBy: { createdAt: 'desc' }
    });

    const devicePreviousHash = lastDeviceCredential ? lastDeviceCredential.deviceChainHash : "DEVICE_GENESIS_BLOCK_0000";
    const deviceChainHash = crypto.createHash('sha256').update(devicePreviousHash + signature).digest('hex');

    const savedCredential = await prisma.credential.create({
      data: {
        videoId: payload.video_id,
        devicePublicKey: payload.device.public_key,
        deviceType: payload.device.type,
        startTime: payload.capture.start_time,
        endTime: payload.capture.end_time,
        frameCount: payload.capture.frame_count,
        fileHash: payload.file_hash,
        signature: signature,
        deviceChainHash: deviceChainHash,
        devicePreviousHash: devicePreviousHash,
        frameHashes: {
          create: payload.frame_hashes.map((fh: any) => ({
            sequence: fh.sequence,
            timestamp: fh.timestamp,
            hash: fh.hash
          }))
        }
      }
    });

    res.status(201).json({ success: true, id: savedCredential.id });
  } catch (error) {
    console.error("Failed to process credential:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Internal Endpoint: Verify Credential by ID (used by our web portal)
app.get('/api/v1/credential/verify/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    
    const credential = await prisma.credential.findFirst({
      where: { videoId: videoId },
      include: {
        frameHashes: {
          orderBy: { sequence: 'asc' }
        }
      }
    });

    if (!credential) {
      return res.status(404).json({ error: "Credential not found" });
    }

    // Verify via Blockchain Smart Contract (with caching)
    const cacheKey = `device_trusted_${credential.devicePublicKey}`;
    let isDeviceTrusted = contractCache.get<boolean>(cacheKey);

    if (isDeviceTrusted === undefined) {
      isDeviceTrusted = await registryContract.isDeviceTrusted(credential.devicePublicKey);
      contractCache.set(cacheKey, isDeviceTrusted);
    }

    res.json({
      status: isDeviceTrusted ? "AUTHENTIC" : "UNTRUSTED_DEVICE",
      isDeviceTrusted,
      credential
    });

  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Admin CA Endpoints
app.get('/api/v1/admin/hardware', async (req, res) => {
  try {
    const devices = await prisma.hardwareDevice.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch hardware devices" });
  }
});

app.post('/api/v1/admin/hardware/revoke', async (req, res) => {
  try {
    const { publicKey } = req.body;
    if (!publicKey) return res.status(400).json({ error: "Public Key required" });

    // Revoke on the Immutable Blockchain
    console.log(`[Blockchain] Revoking hardware device: ${publicKey}`);
    const tx = await registryContract.revokeDevice(publicKey);
    await tx.wait();
    console.log(`[Blockchain] Device revoked successfully!`);

    // Invalidate Cache
    contractCache.del(`device_trusted_${publicKey}`);

    // Update read-replica cache for the dashboard
    const updated = await prisma.hardwareDevice.update({
      where: { publicKey },
      data: { isRevoked: true }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to revoke device" });
  }
});

// Developer API Key endpoints removed for Open Source release
// Gateway Endpoint: B2B File Verification
app.post('/api/v1/gateway/verify', gatewayLimiter, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No video file provided" });
    }

    // Read the last 64KB bytes of the uploaded video buffer to find the injected metadata
    const MAX_MANIFEST_SIZE = 65536;
    const buffer = req.file.buffer;
    const tailSlice = buffer.subarray(Math.max(0, buffer.length - MAX_MANIFEST_SIZE));
    
    // Find exact byte index of the manifest
    const searchToken = Buffer.from('[VERITAS_MANIFEST:');
    const manifestIdx = tailSlice.lastIndexOf(searchToken);
    
    if (manifestIdx === -1) {
      return res.status(400).json({ 
        error: "UNTRUSTED_HARDWARE",
        message: "Video Rejected: Not captured using trusted Veritas hardware. No cryptographic proofs found in the file." 
      });
    }

    const text = tailSlice.toString('utf-8', manifestIdx);
    const match = text.match(/\[VERITAS_MANIFEST:(.*?)\]/);
    if (!match) {
      return res.status(400).json({ error: "UNTRUSTED_HARDWARE", message: "Invalid signature format." });
    }

    let manifest;
    try {
      manifest = JSON.parse(match[1]);
    } catch (e) {
      return res.status(400).json({ error: "TAMPERED_FILE", message: "Invalid manifest format." });
    }

    const videoId = manifest.id;

    const credential = await prisma.credential.findFirst({
      where: { videoId: videoId }
    });

    if (!credential) {
      return res.status(404).json({ 
        error: "UNTRUSTED_HARDWARE",
        message: "Video Rejected: The credential embedded in this video is not registered in the Veritas Hardware Ledger." 
      });
    }

    // Mathematical File Tamper Check
    const absoluteFooterIndex = Math.max(0, buffer.length - MAX_MANIFEST_SIZE) + manifestIdx;
    const videoBuffer = buffer.subarray(0, absoluteFooterIndex - 1); // Exclude the leading newline
    const calculatedHash = crypto.createHash('sha256').update(videoBuffer).digest('hex');

    // Verify against the offline manifest payload, NOT just the database!
    if (manifest.file_hash !== calculatedHash || (credential.fileHash && credential.fileHash !== calculatedHash)) {
      return res.status(401).json({
        error: "TAMPERED_FILE",
        message: "Video Rejected: The mathematical file hash does not match the cryptographically signed credential. The file has been modified."
      });
    }

    // VERIFY HARDWARE TRUST ON THE BLOCKCHAIN (with caching)
    const cacheKey = `device_trusted_${credential.devicePublicKey}`;
    let isDeviceTrusted = contractCache.get<boolean>(cacheKey);

    if (isDeviceTrusted === undefined) {
      isDeviceTrusted = await registryContract.isDeviceTrusted(credential.devicePublicKey);
      contractCache.set(cacheKey, isDeviceTrusted);
    }

    if (!isDeviceTrusted) {
      return res.status(403).json({
        error: "UNTRUSTED_APPLICATION",
        message: "Video Rejected: The video was captured, but the capturing application has been REVOKED or is not recognized by the Veritas Certificate Authority."
      });
    }

    res.json({
      veritas_report: {
        authenticity_status: "AUTHENTIC_APPLICATION_CAPTURE",
        application_trusted: true,
        provenance: {
          capture_start: new Date(credential.startTime).toISOString(),
          capture_end: new Date(credential.endTime).toISOString(),
          frame_count: credential.frameCount
        },
        cryptography: {
          device_public_key: credential.devicePublicKey,
          signature: credential.signature,
          device_chain_hash: credential.deviceChainHash,
          device_previous_hash: credential.devicePreviousHash
        }
      }
    });

  } catch (error) {
    console.error("Gateway verification error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Gateway Endpoint: Lineage & Edit Verification
app.post('/api/v1/gateway/edit-lineage', gatewayLimiter, upload.fields([{ name: 'video_v1', maxCount: 1 }, { name: 'video_v2', maxCount: 1 }]), async (req, res) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (!files || !files['video_v1'] || !files['video_v2']) {
      return res.status(400).json({ error: "Must provide both video_v1 (raw parent) and video_v2 (edited child)" });
    }

    const v1File = files['video_v1'][0];
    const v2File = files['video_v2'][0];

    // 1. Verify v1 is authentic (Extract credential ID from Manifest)
    const MAX_MANIFEST_SIZE = 65536; // 64KB
    const v1TailBuffer = v1File.buffer.subarray(Math.max(0, v1File.buffer.length - MAX_MANIFEST_SIZE));
    
    // Find the exact byte index of the manifest start to slice the buffer accurately
    const searchToken = Buffer.from('[VERITAS_MANIFEST:');
    const manifestIdx = v1TailBuffer.lastIndexOf(searchToken);
    
    if (manifestIdx === -1) {
      return res.status(400).json({ error: "UNTRUSTED_V1", message: "The raw video (v1) does not contain a Veritas cryptographic signature." });
    }
    
    const v1TailText = v1TailBuffer.toString('utf-8', manifestIdx);
    const v1Match = v1TailText.match(/\[VERITAS_MANIFEST:(.*?)\]/);
    
    if (!v1Match) {
      return res.status(400).json({ error: "UNTRUSTED_V1", message: "Invalid signature format." });
    }
    
    let v1Manifest;
    try {
      v1Manifest = JSON.parse(v1Match[1]);
    } catch (e) {
      return res.status(400).json({ error: "TAMPERED_V1", message: "Invalid manifest format in v1." });
    }
    const v1Id = v1Manifest.id;

    const v1Credential = await prisma.credential.findFirst({ where: { videoId: v1Id } });
    if (!v1Credential) {
      return res.status(404).json({ error: "UNTRUSTED_V1", message: "v1 credential not found in ledger." });
    }

    // Mathematical tamper check on v1 using exact byte index of the injected footer
    const absoluteFooterIndex = Math.max(0, v1File.buffer.length - MAX_MANIFEST_SIZE) + manifestIdx;
    
    // We expect the footer to have a leading newline: `\n[VERITAS_MANIFEST...`
    // So we step back 1 byte to exclude the newline.
    const v1BufferNoFooter = v1File.buffer.subarray(0, absoluteFooterIndex - 1);
    const v1CalcHash = crypto.createHash('sha256').update(v1BufferNoFooter).digest('hex');
    
    if (v1Manifest.file_hash !== v1CalcHash || (v1Credential.fileHash && v1Credential.fileHash !== v1CalcHash)) {
      return res.status(401).json({ error: "TAMPERED_V1", message: "The raw video (v1) fails mathematical verification. Lineage cannot be established." });
    }

    // 2. Analyze v1 and v2 using FFmpeg to calculate Edit Percentage
    const v1Meta = await extractVideoMetadata(v1BufferNoFooter);
    const v2Meta = await extractVideoMetadata(v2File.buffer);
    
    // Perceptual Visual Hashing (Deepfake Detection)
    const visualDistance = await compareVisualFrames(v1BufferNoFooter, v2File.buffer);
    
    // Calculate deviation (Temporal & Spatial)
    let temporalDeviation = 0;
    if (v1Meta.duration > 0 && v2Meta.duration > 0) {
      temporalDeviation = Math.abs(v1Meta.duration - v2Meta.duration) / v1Meta.duration * 100;
    }

    // A visual distance > 0.15 means the pixel structure drastically changed (Deepfake/Tampering)
    let isDeepfake = false;
    // Only run deepfake pHash check if the video hasn't been significantly trimmed to avoid false positives on misaligned timestamps
    if (temporalDeviation < 1 && visualDistance > 0.15) {
      isDeepfake = true;
    }

    const totalDeviation = Math.min(100, Math.max(temporalDeviation, visualDistance * 100)); // Simplify for MVP

    let editActions = [];
    if (isDeepfake) editActions.push("DEEPFAKE/TAMPERED_PIXELS");
    if (temporalDeviation > 1) editActions.push("TRIMMED/TIME-EDITED");
    if (v1Meta.width !== v2Meta.width || v1Meta.height !== v2Meta.height) editActions.push("CROPPED/RESIZED");
    if (editActions.length === 0 && v1Meta.size !== v2Meta.size && !isDeepfake) editActions.push("COMPRESSED/TRANSCODED");

    // 3. Create a NEW credential for v2 that acts as a cryptographically linked child
    const v2Id = crypto.randomUUID();
    const v2FileHash = crypto.createHash('sha256').update(v2File.buffer).digest('hex');
    
    const v2Credential = await prisma.credential.create({
      data: {
        videoId: v2Id,
        devicePublicKey: v1Credential.devicePublicKey,
        deviceType: "veritas-edit-gateway",
        startTime: v1Credential.startTime,
        endTime: Date.now(),
        frameCount: v1Credential.frameCount,
        fileHash: v2FileHash,
        signature: `LINEAGE_SIGNATURE_DERIVED_FROM_${v1Id}`,
        deviceChainHash: crypto.createHash('sha256').update(v1Credential.deviceChainHash + v2Id).digest('hex'),
        parentId: v1Id,
        editPercentage: totalDeviation,
        editActions: editActions.join(", ")
      }
    });

    // 4. Return Provenance Graph
    res.json({
      veritas_report: {
        status: "SUCCESSFUL_LINEAGE_LINK",
        provenance_graph: {
          v1_parent: {
            video_id: v1Id,
            authenticity: "100%_AUTHENTIC"
          },
          v2_child: {
            video_id: v2Id,
            edit_percentage: `${totalDeviation.toFixed(2)}%`,
            detected_actions: editActions,
            file_hash: v2FileHash
          }
        }
      }
    });
    
  } catch (error) {
    console.error("Lineage verification error:", error);
    res.status(500).json({ error: "Internal Server Error during FFmpeg processing" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Veritas Verification API listening on port ${PORT}`);
});
