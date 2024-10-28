from pymongo import MongoClient
import gridfs

# Connect to MongoDB
client = MongoClient('mongodb://localhost:27017/')
db = client['mydatabase']
fs = gridfs.GridFS(db)

# Store an image using GridFS
with open('path/to/your/image.jpg', 'rb') as image_file:
    fs.put(image_file, filename='my_image.jpg')

# Retrieve the image from GridFS
image_data = fs.get_last_version('my_image.jpg').read()

# Save the retrieved image to a file
with open('output_image.jpg', 'wb') as output_file:
    output_file.write(image_data)
