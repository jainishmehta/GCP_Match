import base64
import sys
import os
from PIL import Image
import json

def encode_image(image_path):
    try:
        print(f"Processing image: {image_path}")
        print(f"Current directory: {os.getcwd()}")
        
        # Verify file exists and is readable
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image not found: {image_path}")
        if not os.access(image_path, os.R_OK):
            raise PermissionError(f"Cannot read image: {image_path}")
            
        # Verify it's an image using PIL
        try:
            with Image.open(image_path) as img:
                print(f"Image format: {img.format}")
                print(f"Image size: {img.size}")
        except Exception as e:
            raise ValueError(f"Not a valid image file: {e}")
            
        # Read and encode image
        with open(image_path, "rb") as image_file:
            encoded_string = base64.b64encode(image_file.read())
            
            # Create request JSON
            request_data = {
                "requests": [{
                    "image": {
                        "content": encoded_string.decode('utf-8')
                    },
                    "features": [
                        {"type": "LABEL_DETECTION"},
                        {"type": "OBJECT_LOCALIZATION"}
                    ]
                }]
            }
            
            # Write request JSON
            with open('request.json', 'w') as f:
                json.dump(request_data, f)
            
            # Print the base64 string wrapped in square brackets
            print(f"[{encoded_string.decode('utf-8')}]")
            
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 base64_converter.py <image_path>", file=sys.stderr)
        sys.exit(1)
    
    encode_image(sys.argv[1])