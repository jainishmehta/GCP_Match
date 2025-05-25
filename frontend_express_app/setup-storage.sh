#!/bin/bash

# Check if running on Render
if [ -d "/opt/render" ]; then
    # On Render
    mkdir -p /opt/render/project/src/frontend_express_app/uploads
    chmod -R 755 /opt/render/project/src/frontend_express_app/uploads
else
    # Local environment
    mkdir -p uploads
    chmod -R 755 uploads
fi