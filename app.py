import pymongo
import json
import boto3
import base64
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi

def process_knn_match(extracted_list):
    clothing_types = ['dress', 'short', 'shirt', 'pants', 'skirt']
    
    colors = ['white', 'black', 'blue', 'red', 'green', 'yellow', 'purple', 'pink', 'orange', 'brown', 'grey', 'beige']

    matches = []

    color_found = False
    clothing_type_found = False

    for current_item in extracted_list:
        label = current_item[0].lower() # Extract label to check for colors and clothing types
        print(label)
        if not color_found:
            has_color = any(color in label for color in colors)
            if has_color:
                matches.append(colors[colors.index(next(color for color in colors if color in label))])
                color_found = True 
                continue  

        if not clothing_type_found:
            has_clothing_type = any(clothing_type in label for clothing_type in clothing_types)
            if has_clothing_type:
                matches.insert(0, clothing_types[clothing_types.index(next(type for type in clothing_types if type in label))] )
                clothing_type_found = True 

    return matches



# MongoDB URI and S3 Bucket Configuration
uri = "mongodb+srv://jainishmehta:jainish1234@cluster0.7izqa.mongodb.net/clothing_images?retryWrites=true&w=majority"
s3_bucket_name = 'gcpmatchproject'
s3_region = 'us-east-2'

# Initialize MongoDB client
client = MongoClient(uri)
db = client.clothing_images
clothing_collection = db.clothes

# Initialize AWS S3 client
s3 = boto3.client('s3', region_name=s3_region)
# File path
file_path = 'updated_images/annotations.txt'

# Read the file and split the content by '-----'
with open(file_path, 'r') as file:
    content = file.read()

# Split the content by the delimiter '-----'
parts = content.split('-----')

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
                    if ('description' in line) or ('name' in line):
                        print(line)
                        description = line.split(':')[1].replace('"', '').replace(',', '').strip()
                        descrip_score.append(description)
                    if '"score":' in line:
                        score = line.split(':')[1].strip().strip(',')
                        descrip_score.append(score)
        
        # Combine description and score
        final_descrip_score = []
        i=0
        while i+2<=len(descrip_score):
            final_descrip_score.append((descrip_score[i], descrip_score[i+1]))
            i+=2
        # Prepare the result object
        result = {
            "base_64": base64_encoding,
            "labels": final_descrip_score
        }

        type_color_match = process_knn_match(final_descrip_score)
        if type_color_match and type_color_match[0]=='dress':
            clothing_collection = db.dresses
        elif type_color_match and type_color_match[0]=='short':
            clothing_collection = db.shorts
        elif type_color_match and  type_color_match[0]=='shirt':
            clothing_collection = db.shirts
        elif type_color_match and type_color_match[0]=='pants':
            clothing_collection = db.pants
        elif type_color_match and type_color_match[0]=='skirts':
            clothing_collection = db.skirts

        # Insert into MongoDB if not a duplicate
        print(clothing_collection)
        existing_document = clothing_collection.find_one({"base_64": base64_encoding})
        if existing_document:
            print("Duplicate document exists!")
        else:
            clothing_collection.insert_one(result)


        # Upload the image to S3
        # Decode the base64 image
        image_data = base64.b64decode(base64_encoding)
        image_file_name = base64_encoding.replace('/', '_')
        # Generate a unique file name for the S3 object
        image_file_name = f"{image_file_name[-10:]}.jpg"  # You can customize this file name format
        
        # Upload to S3
        try:
            print("here")
            s3.put_object(Bucket=s3_bucket_name, Key=f"{image_file_name}", Body=image_data, ContentType='image/jpeg')
            print(f"Image uploaded successfully: {image_file_name}")
            result["image_s3_url"] = f"https://{s3_bucket_name}.s3.{s3_region}.amazonaws.com/images/{image_file_name}"

        except Exception as e:
            print(f"Error uploading image to S3: {e}")
            result["image_s3_url"] = None  # Set it to None if upload fails

# Print the results
print("Processing completed.")
