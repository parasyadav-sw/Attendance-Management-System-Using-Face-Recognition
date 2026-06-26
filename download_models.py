import os
import urllib.request

# Base URL for face-api.js weights
BASE_URL = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/"

# Models and their associated files to download
MODEL_FILES = [
    # SSD Mobilenet V1
    "ssd_mobilenetv1_model-weights_manifest.json",
    "ssd_mobilenetv1_model-shard1",
    "ssd_mobilenetv1_model-shard2",
    
    # Face Landmark 68
    "face_landmark_68_model-weights_manifest.json",
    "face_landmark_68_model-shard1",
    
    # Face Recognition
    "face_recognition_model-weights_manifest.json",
    "face_recognition_model-shard1",
    "face_recognition_model-shard2",
    
    # Tiny Face Detector
    "tiny_face_detector_model-weights_manifest.json",
    "tiny_face_detector_model-shard1"
]

def download_models():
    target_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
    if not os.path.exists(target_dir):
        os.makedirs(target_dir)
        print(f"Created models directory: {target_dir}")

    print("Starting download of face-api.js model files...")
    
    for filename in MODEL_FILES:
        url = BASE_URL + filename
        target_path = os.path.join(target_dir, filename)
        
        if os.path.exists(target_path):
            print(f"Already exists (skipping): {filename}")
            continue
            
        print(f"Downloading: {filename} ... ", end="", flush=True)
        try:
            # Add user-agent header to bypass potential blockings
            req = urllib.request.Request(
                url, 
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
            )
            with urllib.request.urlopen(req) as response, open(target_path, 'wb') as out_file:
                out_file.write(response.read())
            print("OK")
        except Exception as e:
            print("FAILED")
            print(f"Error downloading {filename}: {e}")

if __name__ == "__main__":
    download_models()
