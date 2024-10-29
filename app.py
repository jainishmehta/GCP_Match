import pymongo
import json

MONGODB_URI = "mongodb://localhost:27017/" 
DATABASE_NAME = "clothing_images"     
COLLECTION_NAME = "clothes" 

# Create a MongoDB client
client = pymongo.MongoClient(MONGODB_URI)
db = client[DATABASE_NAME]
collection = db[COLLECTION_NAME]

# Read annotations.txt
with open("/home/jainishmehta/jainish/GCP_Match/updated_images/annotations.txt", "r") as file:
    content = file.read()
    segments = content.split("-----")
    print(segments)
print("Annotations have been stored in MongoDB.")
