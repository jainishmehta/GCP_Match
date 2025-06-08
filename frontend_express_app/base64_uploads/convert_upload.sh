#!/bin/bash

PROJECT_ID="812751601631" # Ensure this Project ID is correct and has Vision API access
REQUEST_JSON="request.json"
OUTPUT_FILE="annotations.txt" # This file is for your internal debugging/logging, not consumed by Node.js

# Execute the python script first to create request.json
# Note: The python script must be executable and in the correct path relative to where convert_upload.sh is run
# And it should NOT print anything to stdout that isn't related to its errors.
# In your Node.js app, the command is `python3 base64_converter.py ../uploads/${fileExecuted} && ./convert_upload.sh`
# So, the python script will be executed first within the `base64_uploads` directory.
# The image path `../uploads/${fileExecuted}` assumes `convert_upload.sh` is called from `base64_uploads`
# and the actual uploaded image is in `uploads/` one level up.

# Make sure request.json is created before calling curl
if [ ! -f "$REQUEST_JSON" ]; then
    echo "Error: request.json not found. Did base64_converter.py run successfully?" >&2
    exit 1
fi

# Call Google Vision API and capture the full JSON response
response=$(curl -s -X POST \
    -H "Authorization: Bearer $(gcloud auth print-access-token)" \
    -H "x-goog-user-project: $PROJECT_ID" \
    -H "Content-Type: application/json; charset=utf-8" \
    -d "@$REQUEST_JSON" \
    "https://vision.googleapis.com/v1/images:annotate")

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