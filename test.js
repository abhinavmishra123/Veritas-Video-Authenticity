const axios = require('axios');
const fs = require('fs');

async function test() {
  try {
    const formData = new FormData();
    // Assuming there's a dummy video file, or we can just send text.
    // If we send no file, it should return 400 "No video file provided" instead of 401.
    const res = await axios.post('http://localhost:3000/api/v1/gateway/verify', null, {
        validateStatus: () => true // don't throw on 4xx/5xx
    });
    console.log("Status:", res.status, res.data);
  } catch (e) {
    console.error(e.message);
  }
}
test();
