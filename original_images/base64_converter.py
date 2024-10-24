import base64
import sys
import requests

# Pass the image data to an encoding function.
def encode_image(image):
    with open(image, "rb") as image_file:
        encoded_string = base64.b64encode(image_file.read())
    print(encoded_string)
    return encoded_string
encode_image(sys.argv[1])
#TODO: Need to get this into the request.json and then get the labelling
response = requests.get(...)
data = response.json()