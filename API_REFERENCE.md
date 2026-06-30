# Veritas API Reference

The Veritas API provides endpoints for hardware registration, credential generation, video verification, and lineage tracking. The API is completely open-source and does not require any API keys.

## Base URL

`http://localhost:3000/api/v1`

---

## 1. Gateway Endpoints

### 1.1 Verify Video
Verifies the cryptographic signature, mathematical file hash, and hardware trustworthiness of an uploaded video.

* **Endpoint**: `/gateway/verify`
* **Method**: `POST`
* **Content-Type**: `multipart/form-data`
* **Rate Limit**: 100 requests per 15 minutes per IP

**Parameters**:
* `video` (file): The video file containing the injected C2PA Veritas Manifest.

**Success Response (200 OK)**:
```json
{
  "veritas_report": {
    "authenticity_status": "AUTHENTIC_APPLICATION_CAPTURE",
    "application_trusted": true,
    "provenance": {
      "capture_start": "2023-10-01T12:00:00Z",
      "capture_end": "2023-10-01T12:05:00Z",
      "frame_count": 9000
    },
    "cryptography": {
      "device_public_key": "...",
      "signature": "...",
      "device_chain_hash": "...",
      "device_previous_hash": "..."
    }
  }
}
```

### 1.2 Verify Lineage (Edit Verification)
Analyzes a parent video and a child video to calculate edit deviations, detect deepfakes via pHash, and establish a linked provenance credential.

* **Endpoint**: `/gateway/edit-lineage`
* **Method**: `POST`
* **Content-Type**: `multipart/form-data`

**Parameters**:
* `video_v1` (file): The original, authentic raw parent video.
* `video_v2` (file): The edited child video.

**Success Response (200 OK)**:
```json
{
  "veritas_report": {
    "status": "SUCCESSFUL_LINEAGE_LINK",
    "provenance_graph": {
      "v1_parent": {
        "video_id": "...",
        "authenticity": "100%_AUTHENTIC"
      },
      "v2_child": {
        "video_id": "...",
        "edit_percentage": "10.00%",
        "detected_actions": ["TRIMMED/TIME-EDITED"],
        "file_hash": "..."
      }
    }
  }
}
```

---

## 2. Internal Credential Endpoints

### 2.1 Create Credential
Registers a new video capture credential and auto-registers the hardware public key on the Ethereum smart contract if it's the first time it has been seen.

* **Endpoint**: `/credential/create`
* **Method**: `POST`
* **Content-Type**: `application/json`

**Body**:
Includes the cryptographic signature, hardware public key, timestamps, frame count, mathematical file hash, and frame hashes.

### 2.2 Verify Credential by ID
Fetches a specific credential by its UUID and verifies its device trust status against the Ethereum ledger.

* **Endpoint**: `/credential/verify/:videoId`
* **Method**: `GET`

---

## 3. Admin & Certificate Authority (CA) Endpoints

### 3.1 List Hardware Devices
Returns a list of all known hardware devices.

* **Endpoint**: `/admin/hardware`
* **Method**: `GET`

### 3.2 Revoke Hardware Device
Revokes a compromised hardware device permanently on the Ethereum blockchain, preventing its videos from passing future verification checks.

* **Endpoint**: `/admin/hardware/revoke`
* **Method**: `POST`
* **Content-Type**: `application/json`

**Body**:
```json
{
  "publicKey": "hex_string_of_public_key"
}
```
