#!/bin/bash

cd original_images

for image in *;
    do
    echo $PWD
    image_name=${image}
    base64_image_name='base64_'${image}
    base64_converter.py ${image_name} -w 0 > ${base64_image_name}
    mv 
    find . | grep -o '\<base64_[a-z].jpg'
done