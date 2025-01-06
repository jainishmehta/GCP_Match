#!/bin/bash

PROJECT_ID="812751601631"
REQUEST_JSON="request.json"
OUTPUT_FILE="annotations.txt"

response=$(curl -X POST \
    -H "Authorization: Bearer $(gcloud auth print-access-token)" \
    -H "x-goog-user-project: $PROJECT_ID" \
    -H "Content-Type: application/json; charset=utf-8" \
    -d @$REQUEST_JSON \
    "https://vision.googleapis.com/v1/images:annotate")
echo "Curl response: $response"
jq -r '.requests[].image.content' "$REQUEST_JSON" >> "$OUTPUT_FILE"
echo "-----" >> "$OUTPUT_FILE"
