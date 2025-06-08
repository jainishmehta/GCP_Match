import base64
import sys

def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
    print(encoded_string) # <-- THIS IS THE KEY CHANGE

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 base64_converter.py <image_path>", file=sys.stderr)
        sys.exit(1)
    encode_image(sys.argv[1])