#!/bin/bash

export SPEACHES_BASE_URL="http://localhost:8090"

uvx speaches-cli registry ls --task automatic-speech-recognition | jq > /tmp/stt-and-tts-nmodel-list-with-lang-support.json

echo "Downloading (1.5GB) Systran/faster-distil-whisper-large-v3" 
uvx speaches-cli model download Systran/faster-distil-whisper-large-v3
echo "Downloading (338M) speaches-ai/Kokoro-82M-v1.0-ONNX" 
uvx speaches-cli model download speaches-ai/Kokoro-82M-v1.0-ONNX
