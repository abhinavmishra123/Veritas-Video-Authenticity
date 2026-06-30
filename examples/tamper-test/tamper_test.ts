import fs from 'fs';
import path from 'path';

async function testTamperResistance(filePath: string) {
    console.log("==========================================");
    console.log("🔒 VERITAS HACK-PROOF TAMPER TEST 🔒");
    console.log("==========================================\n");

    if (!fs.existsSync(filePath)) {
        console.error(`Error: File not found at ${filePath}`);
        console.error("Please provide the path to a valid .webm video captured by the Veritas UI.");
        process.exit(1);
    }

    const API_URL = "http://localhost:3000/api/v1/gateway/verify";
    const API_KEY = "vrt_test_12345";

    // 1. Upload original authentic file
    console.log(`[TEST 1] Uploading original authentic video: ${filePath}...`);
    const originalBuffer = fs.readFileSync(filePath);
    
    // We use standard Fetch API for uploading
    const formData1 = new FormData();
    const originalBlob = new Blob([originalBuffer], { type: 'video/webm' });
    formData1.append('video', originalBlob, 'authentic.webm');

    try {
        const response1 = await fetch(API_URL, {
            method: 'POST',
            headers: { 'x-api-key': API_KEY },
            body: formData1
        });
        
        if (response1.ok) {
            console.log("✅ ORIGINAL VIDEO VERIFIED SUCCESSFULLY!");
            const data = await response1.json();
            console.log(`Authenticity Status: ${data.veritas_report.authenticity_status}\n`);
        } else {
            console.error("❌ ORIGINAL VIDEO FAILED VERIFICATION. (Is the device registered? Is the API running?)");
            const err = await response1.json();
            console.error(err);
            return;
        }
    } catch (e) {
        console.error("Network error:", e);
        return;
    }

    // 2. Tamper with the file (Deepfake attempt)
    console.log("[HACK] Simulating a deepfake attack...");
    console.log("-> Intercepting video binary...");
    
    // Create a copy of the buffer
    const tamperedBuffer = Buffer.from(originalBuffer);
    
    // Alter a byte somewhere in the middle of the video stream (simulating edited pixels)
    // We avoid the last 500 bytes to not destroy our JSON metadata footer.
    const editPosition = Math.floor(tamperedBuffer.length / 2);
    
    console.log(`-> Changing byte at position ${editPosition}...`);
    // Flip a bit to alter the video frame
    tamperedBuffer[editPosition] = tamperedBuffer[editPosition] === 0 ? 1 : 0;
    
    const tamperedFilePath = path.join(path.dirname(filePath), 'hacked_deepfake.webm');
    fs.writeFileSync(tamperedFilePath, tamperedBuffer);
    console.log(`-> Saved hacked video as: ${tamperedFilePath}\n`);

    // 3. Upload tampered file
    console.log(`[TEST 2] Uploading hacked video...`);
    const formData2 = new FormData();
    const tamperedBlob = new Blob([tamperedBuffer], { type: 'video/webm' });
    formData2.append('video', tamperedBlob, 'hacked_deepfake.webm');

    try {
        const response2 = await fetch(API_URL, {
            method: 'POST',
            headers: { 'x-api-key': API_KEY },
            body: formData2
        });
        
        if (response2.status === 401 || response2.status === 400) {
            console.log("✅ HACK PREVENTED! The Veritas Gateway successfully rejected the tampered video!");
            const err = await response2.json();
            console.log(`API Response: ${err.error} - ${err.message || 'Invalid Cryptographic Signature'}\n`);
        } else {
            console.error(`❌ CRITICAL FAILURE! The API accepted the tampered video! Status: ${response2.status}`);
        }
    } catch (e) {
        console.error("Network error:", e);
    }
}

const args = process.argv.slice(2);
if (args.length === 0) {
    console.log("Usage: npx tsx tamper_test.ts <path_to_video.webm>");
    process.exit(1);
}

testTamperResistance(args[0]);
