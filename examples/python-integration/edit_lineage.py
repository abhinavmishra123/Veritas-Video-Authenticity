import requests
import json
import sys
import os
import argparse

API_URL = "http://localhost:3000/api/v1/gateway/edit-lineage"

def create_edit_lineage(v1_path, v2_path, api_key):
    print("==========================================")
    print("🎬 VERITAS EDIT LINEAGE GENERATOR 🎬")
    print("==========================================\n")
    print(f"[1] Reading V1 (Raw Parent Video): {v1_path}")
    print(f"[2] Reading V2 (Edited Child Video): {v2_path}")
    
    headers = {
        "x-api-key": api_key
    }
    
    try:
        with open(v1_path, 'rb') as f1, open(v2_path, 'rb') as f2:
            files = {
                'video_v1': (v1_path, f1, 'video/webm'),
                'video_v2': (v2_path, f2, 'video/webm')
            }
            
            print("\n[3] Transmitting to Veritas Protocol for structural FFmpeg analysis...")
            response = requests.post(API_URL, headers=headers, files=files)
            
        if response.status_code == 200:
            print("\n✅ LINEAGE SUCCESSFULLY LINKED!")
            report = response.json()
            print("\nPROVENANCE GRAPH:")
            print(json.dumps(report, indent=2))
        else:
            print("\n❌ LINEAGE FAILED!")
            print(f"Status Code: {response.status_code}")
            try:
                print(json.dumps(response.json(), indent=2))
            except:
                print(response.text)
                
    except FileNotFoundError as e:
        print(f"Error: File not found - {e}")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Veritas Protocol - Link Edited Video Lineage")
    parser.add_argument("v1_raw", help="Path to the original V1 (raw) WebM file")
    parser.add_argument("v2_edited", help="Path to the edited V2 (child) WebM file")
    parser.add_argument("--api-key", help="Veritas API Key (defaults to VERITAS_API_KEY env var)")
    
    args = parser.parse_args()
    
    api_key = args.api_key or os.environ.get("VERITAS_API_KEY")
    if not api_key:
        print("❌ Error: API Key is required. Set VERITAS_API_KEY in your environment or use --api-key.")
        sys.exit(1)
        
    create_edit_lineage(args.v1_raw, args.v2_edited, api_key)
