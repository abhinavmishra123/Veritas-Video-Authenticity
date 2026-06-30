import requests
import json
import sys

API_URL = "http://localhost:3000/api/v1/gateway/verify"
API_KEY = "vrt_test_12345" # Using the seed API key

def verify_veritas_video(file_path):
    print(f"Uploading {file_path} to Veritas API for verification...")
    
    headers = {
        "x-api-key": API_KEY
    }
    
    try:
        with open(file_path, 'rb') as f:
            files = {'video': (file_path, f, 'video/webm')}
            response = requests.post(API_URL, headers=headers, files=files)
            
        if response.status_code == 200:
            print("\n✅ Verification SUCCESS! The video is mathematically authentic.")
            report = response.json()
            print(json.dumps(report, indent=2))
        else:
            print("\n❌ Verification FAILED!")
            print(f"Status Code: {response.status_code}")
            try:
                print(json.dumps(response.json(), indent=2))
            except:
                print(response.text)
                
    except FileNotFoundError:
        print(f"Error: File not found at {file_path}")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python verify.py <path_to_video.webm>")
        sys.exit(1)
        
    verify_veritas_video(sys.argv[1])
