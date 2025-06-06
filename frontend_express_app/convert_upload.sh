#!/bin/bash
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
    echo "$response" | jq -r '.responses[].localizedObjectAnnotations[] | {mid, name, score} ' >> "$OUTPUT_FILE"
    echo "$response" | jq -r '.responses[].labelAnnotations[] | {mid, description, score, topicality}' >> "$OUTPUT_FILE"
    echo "-----" >> "$OUTPUT_FILE"
done