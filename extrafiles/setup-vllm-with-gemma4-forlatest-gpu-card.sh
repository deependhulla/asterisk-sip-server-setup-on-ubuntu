#!/bin/bash

mkdir /opt/vllm-ai-brain
/bin/cp extrafiles/vllm_docker_compose.yaml /opt/vllm-ai-brain/docker-compose.yaml
/bin/cp extrafiles/vllm-generation_config.json /opt/vllm-ai-brain/generation_config.json
cd /opt/vllm-ai-brain
docker compose up -d
