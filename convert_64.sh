#!/bin/bash

SOURCE_DIR="original_images"
DEST_DIR="../updated_images"
cd original_images
for image in *.jpg;
    do
    image_name=${image}
    echo $image_name
    base64_image_name='base64_'${image}
    base64 ${image_name} -w 0 > ${base64_image_name}
done
mv base64_*.jpg "$DEST_DIR"/
cd $DEST_DIR

PROJECT_ID="812751601631"
REQUEST_JSON="request.json"
OUTPUT_FILE="annotations.txt"
> "$OUTPUT_FILE" 
for image in *.jpg;
    do
    python3 base64_converter.py ${image}
    response=$(curl -X POST \
        -H "Authorization: Bearer $(gcloud auth print-access-token)" \
        -H "x-goog-user-project: $PROJECT_ID" \
        -H "Content-Type: application/json; charset=utf-8" \
        -d @$REQUEST_JSON \
        "https://vision.googleapis.com/v1/images:annotate")
    jq -r '.requests[].image.content' "$REQUEST_JSON" >> "$OUTPUT_FILE"
    echo "$response" | jq -r '.responses[].labelAnnotations[] | {mid, description, score, topicality}' >> "$OUTPUT_FILE"
    echo "-----" >> "$OUTPUT_FILE"
done