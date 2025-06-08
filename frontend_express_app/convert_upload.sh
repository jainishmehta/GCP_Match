#!/bin/bash
PROJECT_ID="812751601631"
REQUEST_JSON_TEMPLATE="request_template.json" # New: Use a template
OUTPUT_FILE="annotations.txt" # This can remain for your own logs, but app.js won't use it

# Create a temporary JSON file for the Vision API request
TEMP_REQUEST_JSON="/tmp/vision_request_$(date +%s%N).json"

# Capture the base64 encoded image from the Python script's stdout
# Note: ${image} is the path to the image uploaded by Node.js
# The `base64_converter.py` should be in the same directory as convert_upload.sh,
# or provide its full path. Assuming it's in the same directory now.
IMAGE_FILE_PATH="$1" # The bash script receives the image path as its first argument
BASE64_IMAGE=$(python3 base64_converter.py "${IMAGE_FILE_PATH}")

# Ensure request_template.json exists and is a valid JSON template for Vision API
# It should look something like:
# {
#   "requests": [
#     {
#       "image": {
#         "content": "BASE64_PLACEHOLDER"
#       },
#       "features": [
#         {"type": "LABEL_DETECTION"},
#         {"type": "OBJECT_LOCALIZATION"}
#       ]
#     }
#   ]
# }

# Create the actual request JSON by injecting the base64 image
jq --arg img "$BASE64_IMAGE" '.requests[0].image.content = $img' "$REQUEST_JSON_TEMPLATE" > "$TEMP_REQUEST_JSON"

# Make the Vision API call
response=$(curl -s -X POST \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "x-goog-user-project: $PROJECT_ID" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d @"$TEMP_REQUEST_JSON" \
  "https://vision.googleapis.com/v1/images:annotate")

# Optional: Log the full response to annotations.txt for debugging
echo "$response" >> "$OUTPUT_FILE"
echo "-----" >> "$OUTPUT_FILE"

# Extract labels and print them to STDOUT in the format expected by app.js
# This targets the 'name' and 'score' from labelAnnotations
# .responses[].labelAnnotations[] | "\(.description):\(.score)" converts each to "label:score"
# to_entries | .[] | .value constructs a JSON array of strings
# You might need to adjust based on whether you want localizedObjectAnnotations or labelAnnotations
# Let's focus on labelAnnotations for now, as that's often what's used for general "labels"
LABELS_ARRAY=$(echo "$response" | jq -r '[.responses[].labelAnnotations[] | "\(.description):\(.score)"]')

# IMPORTANT: Print the formatted labels array to stdout
echo "$LABELS_ARRAY"

# Clean up the temporary request file
rm "$TEMP_REQUEST_JSON"