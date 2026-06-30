# Architecture Overview

Veritas is a fully open-source, decentralized video authentication protocol. This document outlines the core components of the system, including the advanced Perceptual Hash (pHash) engine and the cryptographic signature lifecycle.

## 1. System Components

* **Veritas Capture**: A frontend dashboard (React + Vite) that mimics a hardware capture device by signing video frames at the source using Ed25519 cryptography.
* **Veritas API**: A Node.js/Express backend that validates C2PA manifests, interacts with the Ethereum ledger, and performs deepfake detection.
* **Smart Contract Ledger**: An Ethereum-based registry that tracks trusted and revoked hardware device public keys.

## 2. Cryptographic Signature Lifecycle

The lifecycle ensures that video media cannot be tampered with between capture and verification, and its provenance remains immutable.

1. **Hardware Signing**: When a video is recorded, the capturing device computes hashes for individual video frames and a master hash of the video file.
2. **Key Pair Generation**: The capture application uses an Ed25519 cryptographic keypair (via `tweetnacl`) to sign the metadata payload. This signature uniquely binds the video contents to the hardware's public key.
3. **C2PA Manifest Injection**: The generated signature, along with the device's public key and frame hashes, is compiled into a JSON manifest (`[VERITAS_MANIFEST:...]`) and appended to the tail end of the video file.
4. **Registration on Ethereum Ledger**: When the Veritas API first sees a valid signature from a new device, it automatically registers the device's public key on the Ethereum smart contract (`registerDevice`).
5. **Credential Storage & Chaining**: The API records the video credential in its local SQLite database, building a blockchain-like chain of hashes (`deviceChainHash`, `devicePreviousHash`) for each device.
6. **Verification & Revocation**: Upon verification, the system extracts the manifest from the video binary, verifies the Ed25519 signature, checks the mathematical file hash against the payload, and queries the Ethereum smart contract (`isDeviceTrusted`) to ensure the device has not been revoked by the Certificate Authority.

## 3. Deepfake Detection & pHash Comparison (`compareVisualFrames`)

Veritas incorporates a visual perceptual hash (pHash) engine to differentiate between benign video edits (e.g., trimming timestamps) and malicious pixel manipulation (e.g., deepfakes).

The `compareVisualFrames` algorithm works as follows:

1. **Frame Extraction**: The algorithm uses `fluent-ffmpeg` to extract a specific reference frame (e.g., the very first frame at timestamp `0`) from both the raw parent video (v1) and the edited child video (v2).
2. **Downsampling & Normalization**: The extracted frames are downsampled to a fixed resolution (`320x240`) to ensure that differences in video encoding or resolution do not affect the hash calculation.
3. **Perceptual Hashing (pHash)**: Both extracted images are processed using the `Jimp` image processing library. Jimp calculates the perceptual distance (`Jimp.distance()`) between the two images.
4. **Distance Evaluation**:
   * A distance of `0.0` means the pixel structures are visually identical.
   * A distance of `1.0` means the images are completely different.
   * Veritas uses a strict threshold of **0.15**. If the visual distance exceeds `0.15` and the duration has not changed drastically, the system flags the child video as a **DEEPFAKE/TAMPERED_PIXELS**.
5. **Lineage Gateway**: If the visual distance is acceptable and the parent video is cryptographically trusted, the system issues a new "child" credential linking the edited video back to the authentic original, generating a verifiable provenance graph.
