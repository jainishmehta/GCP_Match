import pymongo
import json


from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi

uri = "mongodb+srv://jainishmehta:jainish1234@cluster0.7izqa.mongodb.net/clothing_images?retryWrites=true&w=majority"

from pymongo import MongoClient

# Connect to the MongoDB server
client = MongoClient(uri)

# Access the clothing_images database
db = client.clothing_images
clothing_collection = db.clothes

file_path = 'updated_images/annotations.txt'

# Read the file and split the content by '-----'
with open(file_path, 'r') as file:
    content = file.read()

# Split the content by the delimiter '-----'
parts = content.split('-----')
import json

# Prepare a list to hold the results
results = []

# Process each part
for part in parts:
    if part.strip():  # Check if the part is not empty
        lines = part.strip().splitlines()
        base64_encoding = lines[0]  # First line is the base64 encoding
        descriptions = []

        descrip_score = []
        # Parse the subsequent JSON-like strings
        for json_str in lines[1:]:
            obj = json_str.strip().strip('{}')
            entries = obj.strip().split('\n\n')
            for entry in entries:
                lines = entry.split('\n')
                description = ''
                score = ''
                for line in lines:
                    if '"description":' in line:
                        description = line.split(':')[1].replace('"', '').replace(',', '').strip()
                        descrip_score.append(description)
                    if '"score":' in line:
                        score = line.split(':')[1].strip().strip(',')
                        descrip_score.append(score)
        final_descrip_score = []
        for i in range(0, len(descrip_score)-2, 2):
            final_descrip_score.append((descrip_score[i], descrip_score[i+1]))

    results.append({
        "base_64": base64_encoding,
        "labels": final_descrip_score
    })

# Print the results
for result in results:
    existing_document = clothing_collection.find_one({"base_64": result["base_64"]})
    if existing_document:
        print("Duplicate document exists!")
    else:
        clothing_collection.insert_one(result)

"""


# Clean up whitespace around each part
parts = [part.strip() for part in parts]
print(parts)
# Print the results
for i, part in enumerate(parts):
    result = clothing_collection.insert_one(part)

# Output the result of the insertion
print("Inserted clothing item with ID:", result.inserted_id)
"""