import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function runTest() {
  console.log("=== Veritas API Gateway Test ===");
  console.log("Using Developer API Key: vrt_583120dbd44af972d8194595bbbaf56a\n");

  // 1. Find a valid credential in the database (created when you tested the UI)
  const credential = await prisma.credential.findFirst({
    orderBy: { createdAt: 'desc' }
  });

  if (!credential) {
    console.log("❌ No credentials found in the database. Please record a video in the UI first.");
    process.exit(1);
  }

  console.log(`✅ Found valid Credential ID: ${credential.videoId}`);

  // 2. Create a simulated video file with the cryptographic footer
  const dummyVideoContent = "This is a simulated video file binary payload.";
  const footer = `\n[VERITAS_CREDENTIAL_ID:${credential.videoId}]\n`;
  
  fs.writeFileSync('simulated-evidence.webm', dummyVideoContent + footer);
  console.log("✅ Created 'simulated-evidence.webm' with embedded metadata.");

  // 3. Construct the multipart/form-data request manually using fetch and FormData
  const fileData = fs.readFileSync('simulated-evidence.webm');
  const fileBlob = new Blob([fileData], { type: 'video/webm' });
  
  const formData = new FormData();
  formData.append('video', fileBlob, 'simulated-evidence.webm');

  console.log("\n🚀 Sending request to API Gateway (POST /api/v1/gateway/verify)...");
  
  try {
    const response = await fetch('http://localhost:3000/api/v1/gateway/verify', {
      method: 'POST',
      headers: {
        'x-api-key': 'vrt_583120dbd44af972d8194595bbbaf56a'
      },
      body: formData
    });

    const result = await response.json();
    
    console.log(`\nGateway Status Code: ${response.status} ${response.statusText}`);
    console.log("Gateway JSON Response:");
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error("Gateway request failed:", error);
  }

  // Cleanup
  fs.unlinkSync('simulated-evidence.webm');
  await prisma.$disconnect();
}

runTest();
