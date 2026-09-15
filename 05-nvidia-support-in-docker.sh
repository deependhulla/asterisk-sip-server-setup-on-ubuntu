#!/bin/bash

nvidia-ctk runtime configure --runtime=docker

systemctl stop docker
systemctl start docker
echo "Downloading and testing nvidia inside docker container"
docker run --rm --runtime=nvidia --gpus all ubuntu nvidia-smi

