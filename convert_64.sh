#!/bin/bash

SOURCE_DIR="original_images"
DEST_DIR="../updated_images"
cd original_images
for image in *.jpg;
    do
    image_name=${image}
    base64_image_name='base64_'${image}
    python3 base64_converter.py ${image_name} -w 0 > ${base64_image_name}
done
echo $PWD
mv base64_*.jpg "$DEST_DIR"/