#!/bin/bash

apt install -y build-essential git libnewt-dev libssl-dev libxml2-dev libsqlite3-dev uuid-dev tzdata libjansson-dev libedit-dev wget git-core subversion libjansson-dev sqlite3 autoconf automake  libncurses5-dev libtool pkg-config sox unzip  gnupg2 curl libncurses5-dev  uuid-dev linux-headers-$(uname -r)


## only for VM as guest agent example on ProxmoxVE
apt-get install -y qemu-guest-agent


cd /usr/src/
wget -c https://downloads.asterisk.org/pub/telephony/asterisk/asterisk-22-current.tar.gz
tar -xvzf asterisk-22-current.tar.gz
cd asterisk-22.*/
contrib/scripts/get_mp3_source.sh
contrib/scripts/install_prereq install

