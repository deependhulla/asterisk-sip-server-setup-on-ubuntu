#!/bin/bash

mkdir /opt/ai-face-rec-compreface
cd /opt/ai-face-rec-compreface
wget -q -O tmp.zip 'https://github.com/exadel-inc/CompreFace/releases/download/v1.2.0/CompreFace_1.2.0.zip' 
unzip tmp.zip 
rm tmp.zip
cd /opt/ai-face-rec-compreface/
sed -i 's/8000:80/8095:80/g' /opt/ai-face-rec-compreface/docker-compose.yml

