#!/bin/bash

cd /tmp/
curl -fsSL get.docker.com -o get-docker.sh && sh get-docker.sh

## create a global shared network ..latter other to jin that network

docker network create global-shared-net

#docker network connect global-shared-net <container_name_1>
#docker network connect global-shared-net <container_name_2>

cd -
