#!/bin/bash

## for vi
##stty erase ^?

apt purge snapd -y

touch /etc/cloud/cloud-init.disabled
systemctl disable --now cloud-init cloud-init-local cloud-config cloud-final
systemctl disable --now apport
systemctl disable --now multipathd
systemctl disable --now ModemManager
systemctl disable --now packagekit
systemctl disable --now networkd-dispatcher
systemctl disable --now udisks2.service
systemctl disable --now postfix
systemctl disable --now polkit.service
systemctl disable --now unattended-upgrades.service

apt -y autoremove
sudo sync && echo 3 | sudo tee /proc/sys/vm/drop_caches

#sudo vi /etc/sysctl.conf
#vm.vfs_cache_pressure = 200
#sysctl -p

##docker system prune -a --volumes 
