#!/bin/bash

image_name=${req.file.filename}
echo $image_name
base64_image_name='base64_'${image}
base64 ${image_name} -w 0 > ${base64_image_name}