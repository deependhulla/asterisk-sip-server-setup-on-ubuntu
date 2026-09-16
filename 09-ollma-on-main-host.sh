#!/bin/bash

## Reason on main most ..is full binary wrks for majour old NVIDIA cards .
## while container ollma orvllm uses support latest version mostly.

mkdir /opt/ollama-custom-models
curl -fsSL https://ollama.com/install.sh | sh


# Define the directory and file path for the systemd override
SERVICE_DIR="/etc/systemd/system/ollama.service.d"
OVERRIDE_FILE="$SERVICE_DIR/override.conf"

# Create the override directory if it doesn't exist
mkdir -p "$SERVICE_DIR"

##Environment="OLLAMA_CONTEXT_LENGTH=32768"
# Write the environment variables to the override file
cat << 'EOF' > "$OVERRIDE_FILE"
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_KEEP_ALIVE=-1"
Environment="OLLAMA_CONTEXT_LENGTH=4096"
EOF

echo "Override file created at $OVERRIDE_FILE"

# Reload systemd to recognize the changes
echo "Reloading systemd manager configuration..."
systemctl daemon-reload

# Restart the Ollama service to apply the new environment variables
echo "Restarting Ollama service..."
systemctl restart ollama

echo "Ollama configuration updated successfully!"

echo "Downlaoding gemma4:e2b-it-qat total 4.3GB"
sleep 3
ollama pull gemma4:e2b-it-qat


echo '' > /opt/ollama-custom-models/Modelfile
echo 'FROM gemma4:e2b-it-qat' >> /opt/ollama-custom-models/Modelfile
echo 'PARAMETER temperature 0.1' >> /opt/ollama-custom-models/Modelfile
echo 'PARAMETER top_p 0.85' >> /opt/ollama-custom-models/Modelfile
echo 'PARAMETER top_k 20' >> /opt/ollama-custom-models/Modelfile
echo 'PARAMETER repeat_penalty 1.10' >> /opt/ollama-custom-models/Modelfile
echo 'PARAMETER num_ctx 4096' >> /opt/ollama-custom-models/Modelfile
echo 'SYSTEM "You are a professional, helpful AI front desk receptionist. You must respond ONLY in natural Hinglish (Hindi mixed with English) using the Latin alphabet (English characters). Keep your responses extremely short, polite, and punchy (maximum 1 to 2 short sentences). Never use Hindi script (Devanagari)."' >> /opt/ollama-custom-models/Modelfile

echo "Building custom model gemma4-talk..."
ollama create gemma4-talk -f /opt/ollama-custom-models/Modelfile


ollama run gemma4-talk:latest ""
touch /opt/ollama-custom-models/start-ollama-default-models-in-memmory-ready.sh
echo '#!/bin/bash' >/opt/ollama-custom-models/start-ollama-default-models-in-memmory-ready.sh
echo 'ollama run gemma4-talk:latest ""' >> /opt/ollama-custom-models/start-ollama-default-models-in-memmory-ready.sh
chmod 755 /opt/ollama-custom-models/start-ollama-default-models-in-memmory-ready.sh
echo "Do Add in /opt/ollama-custom-models/start-ollama-default-models-in-memmory-ready.sh in /etc/rc.local"


