#!/bin/bash
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
elif [ -f "../.env" ]; then
    export $(grep -v '^#' ../.env | xargs)
else
    echo "Error: .env file not found" >&2
    exit 1
fi


PROJECT_ID="812751601631" # Ensure this Project ID is correct and has Vision API access
REQUEST_JSON="request.json"
OUTPUT_FILE="annotations.txt" # This file is for your internal debugging/logging, not consumed by Node.js

# Check if API key is set
if [ -z "$GOOGLE_API_KEY" ]; then
    echo "Error: GOOGLE_API_KEY environment variable not set" >&2
    exit 1
fi

# Make sure request.json is created before calling curl
if [ ! -f "$REQUEST_JSON" ]; then
    echo "Error: request.json not found. Did base64_converter.py run successfully?" >&2
    exit 1
fi

# Call Google Vision API using API key instead of gcloud auth
response=$(curl -s -X POST \
    -H "Content-Type: application/json; charset=utf-8" \
    -d "@$REQUEST_JSON" \
    "https://vision.googleapis.com/v1/images:annotate?key=$GOOGLE_API_KEY")

# Check if curl failed (e.g., network error, bad auth)
if [ $? -ne 0 ]; then
    echo "Error: curl command failed to connect to Google Vision API." >&2
    exit 1
fi

# Check if the Vision API returned an error (e.g., invalid request, permission denied)
if echo "$response" | jq -e 'has("error")' > /dev/null; then
    echo "Google Vision API Error: $(echo "$response" | jq -r '.error.message')" >&2
    exit 1
fi

# Extract and format the labels/objects using jq and print to stdout
# This is the ONLY thing that should be printed to stdout by this script
echo "$response" | jq -r '[.responses[].localizedObjectAnnotations[] | "\(.name): \(.score)"] + [.responses[].labelAnnotations[] | "\(.description): \(.score)"] | join(", ") | "[" + . + "]"'

# --- The following lines are for local logging/debugging and DO NOT go to Node.js stdout ---
# Log the Base64 content from the request.json to a file
jq -r '.requests[].image.content' "$REQUEST_JSON" >> "$OUTPUT_FILE"

# Add a separator
echo "-----" >> "$OUTPUT_FILE"

# Log the full Google Vision API response to a file for debugging
echo "$response" >> "$OUTPUT_FILE"
# --- End of local logging ---