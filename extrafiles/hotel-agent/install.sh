sudo useradd --system --home-dir /opt/hotel-agent --shell /usr/sbin/nologin hotelagent
sudo chown -R hotelagent:hotelagent /opt/hotel-agent
sudo chmod 600 /opt/hotel-agent/.env

which node        # it must be /usr/bin/node, not under /home
sudo sed -i "s|__NODE__|$(which node)|" /etc/systemd/system/hotel-agent.service

sudo systemctl daemon-reload
sudo systemctl enable --now hotel-agent
sudo systemctl status hotel-agent
journalctl -u hotel-agent -f

