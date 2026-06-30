# Veritas Protocol

Veritas is a fully open-source, decentralized video authentication protocol. It leverages hardware cryptographic signatures, C2PA manifest injection, and an advanced Perceptual Hash (pHash) engine to combat deepfakes and establish immutable lineage for digital media.

## The Problem
Digital media provenance is broken. AI-generated deepfakes and manipulated videos can spread instantly. Existing solutions rely on centralized, proprietary APIs or trust-based metadata that can be easily stripped.

## The Veritas Solution
Veritas brings trust back to digital media using a decentralized, open-source approach:
1. **Hardware Cryptography**: Video frames are cryptographically signed at the hardware level during capture.
2. **Blockchain Ledger**: Hardware device public keys are registered on an immutable Ethereum smart contract.
3. **C2PA Manifest Injection**: The cryptographic proofs are compiled into an open-standard C2PA manifest and injected natively into the video binary (e.g., WebM, MP4).
4. **Deepfake Detection Engine**: A built-in FFmpeg/pHash engine mathematically compares frame pixel data between raw videos and edited variants to detect structural manipulation (Deepfakes, cropped frames) vs valid edits (Trimmed timestamps).

---

## 🚀 Quickstart: Deploy Your Own Node

The Veritas Protocol is a **100% open source** project. There are **no API keys required**, no SaaS subscriptions, and no hidden costs. You can host the verification engine entirely on your own hardware or network.

### Requirements
* Docker
* Docker Compose

### Start the Node

Run the following command to spin up the API Backend (Port 3000) and the Web UI Dashboard (Port 5173).

```bash
docker-compose up --build -d
```

That's it! 

The SQLite database (`dev.db`) will automatically persist via a Docker volume so your hardware ledger data is never lost. Because the API runs locally, the verification endpoints are open by default. You can easily put them behind an NGINX reverse proxy or API gateway of your choice if you intend to expose them publicly.

## Architecture

* **`veritas-capture`**: The React + Vite frontend dashboard. It acts as both a mock hardware camera (signing video frames in the browser using Ed25519) and the verification portal for end users.
* **`veritas-api`**: The Node.js Express backend. It handles C2PA parsing, pHash comparisons using FFmpeg, and Ethereum smart contract lookups for hardware trustworthiness.
* **`hardhat-node`**: An integrated local Ethereum development node for testing the blockchain registry.

## Community
No centralized servers. No pricing. No hustles. Just verifiable truth.
Feel free to fork, contribute, and deploy Veritas wherever media authenticity is required.
