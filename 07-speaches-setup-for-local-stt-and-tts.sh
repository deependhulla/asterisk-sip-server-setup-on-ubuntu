#!/bin/bash

## install uv
curl -LsSf https://astral.sh/uv/install.sh | sh

mkdir /opt/speaches-ai
cd  /opt/speaches-ai

curl --remote-name https://raw.githubusercontent.com/speaches-ai/speaches/master/compose.yaml
curl --remote-name https://raw.githubusercontent.com/speaches-ai/speaches/master/compose.cuda.yaml
curl --remote-name https://raw.githubusercontent.com/speaches-ai/speaches/master/compose.cuda-cdi.yaml
## change port to 8090 as  conflit with other
sed -i 's/8000:8000/8090:8000/g' compose.yaml
export COMPOSE_FILE=compose.cuda-cdi.yaml
docker compose up -d
