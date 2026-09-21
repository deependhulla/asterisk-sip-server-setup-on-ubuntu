#!/bin/bash

mkdir /opt/openwebui/
cp openwebui-docker-compose.yaml /opt/openwebui/docker-compose.yaml
cd /opt/openwebui/
docker compose up -d
