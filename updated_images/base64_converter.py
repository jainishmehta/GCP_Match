import base64
import sys
import json
# Pass the image data to an encoding function.
def encode_image(image):
    with open(image, "rb") as image_file:
        encoded_string = (image_file.read())
    with open("request.json", "r") as file:
        data = json.load(file)
    data['requests'][0]['image']['content'] = str(encoded_string)[2:-1]
    with open("request.json", "w") as file:
        json.dump(data, file)
    return
encode_image(sys.argv[1])