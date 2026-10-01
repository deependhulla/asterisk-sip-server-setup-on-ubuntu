# Hotel AI Front-Desk (Asterisk + Sarvam + LiveKit)

## 1. Asterisk config

Needs `chan_websocket` + `res_websocket_client` (check: `asterisk -rx "module show like websocket"`).

**/etc/asterisk/http.conf**
```
[general]
enabled=yes
bindaddr=127.0.0.1
bindport=8088
```

**/etc/asterisk/ari.conf**
```
[general]
enabled=yes
[agent]
type=user
read_only=no
password=agentpass
password_format=plain
```

**/etc/asterisk/websocket_client.conf** (section name = `ARI_WS_CONNECTION`, NOT the Stasis app name)
```
[livekit_agent]
type = websocket_client
uri = ws://192.168.1.233:8099/api/v1/telephony/ws/ari
protocols = media
connection_type = per_call
connection_timeout = 5000
```

**/etc/asterisk/extensions.conf** (your 700 stays the same; Answer is done by ARI)
```
exten => 700,1,NoOp(Routing call to LiveKit AI Agent)
 same => n,Stasis(livekitserverdev)
 same => n,Hangup()
```
Then: `asterisk -rx "module reload res_ari"`, `... "dialplan reload"`, `... "module reload res_websocket_client"`.

## 2. Run
```
cp .env.example .env   # add SARVAM_API_KEY, passwords
npm install
npm start
```
Call extension 700. Debug audio: `asterisk -rx "core set debug 4 chan_websocket.so"`.
