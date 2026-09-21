#!/bin/bash


sudo apt purge netplan.io
mv -v /etc/netplan /opt/netplain-to-del


sudo systemctl unmask networking
sudo systemctl enable networking
sudo systemctl start networking

