#!/bin/bash


cat  interfaces_sample.txt  > /etc/network/interfaces

systemctl disable --now systemd-networkd

systemctl stop systemd-resolved
systemctl disable systemd-resolved
rm /etc/resolv.conf
echo "nameserver 8.8.8.8" > /etc/resolv.conf 
echo "nameserver 1.1.1.1" >> /etc/resolv.conf 
apt install -y ifupdown
apt purge netplan.io
mv -v /etc/netplan /opt/netplain-to-del


systemctl unmask networking
systemctl enable networking
systemctl start networking

