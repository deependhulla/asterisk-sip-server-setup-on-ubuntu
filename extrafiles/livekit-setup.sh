#!/bin/bash

curl -sSL https://get.livekit.io | bash
mkdir -p /etc/livekit
/bin/cp livekit.yaml /etc/livekit/
/bin/cp livekit-dev.service /etc/systemd/system/

sudo useradd -r -s /bin/false livekit
chown -R livekit:livekit /etc/livekit
chmod 600 /etc/livekit/livekit.yaml
systemctl daemon-reload
systemctl restart livekit-dev.service

#Start LiveKit in development mode by running livekit-server --dev. It'll use a placeholder API key/secret pair.

#/usr/local/bin/livekit-server --dev

#API Key: devkey
#API Secret: secret

