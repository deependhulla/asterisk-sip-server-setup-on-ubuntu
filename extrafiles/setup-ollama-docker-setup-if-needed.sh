#!/bin/bash

mkdir /opt/ollama-ai-brain
/bin/cp extrafiles/ollama_docker_compose.yaml /opt/ollama-ai-brain/docker-compose.yaml
cd /opt/ollama-ai-brain
docker compose up -d
echo "Downloading Model"
#docker exec -it ollama ollama pull gemma4:e2b
