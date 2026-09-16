#!/bin/bash

cd /usr/src/
cd asterisk-22.*/

./configure
#make menuselect
#if needed only -- Select the “format_mp3” option to tell Asterisk to build the MP3 module:
## make menuselect.makeopts
## menuselect/menuselect --enable format_mp3 menuselect.makeopts
## menuselect/menuselect --enable chan_mobile --enable cdr_addon_mysql menuselect.makeopts
#If you want to quickly turn on every single available module inside the Add-ons menu, use --enable-category
## menuselect/menuselect --enable-category MENUSELECT_ADDONS menuselect.makeopts
make menuselect.makeopts
menuselect/menuselect --enable-category MENUSELECT_ADDONS menuselect.makeopts
make -j2
make install

## or make basic-pbx
make samples
make config
#It is also a good idea to run ldconfig to update the shared libraries cache:
ldconfig
adduser --system --group --home /var/lib/asterisk --no-create-home --gecos "Asterisk PBX" asterisk


usermod -a -G dialout,audio asterisk
chown -R asterisk: /var/{lib,log,run,spool}/asterisk /usr/lib/asterisk /etc/asterisk
chmod -R 750 /var/{lib,log,run,spool}/asterisk /usr/lib/asterisk /etc/asterisk


sed -i 's/^#\(AST_USER="asterisk"\)/\1/; s/^#\(AST_GROUP="asterisk"\)/\1/' /etc/default/asterisk
sed -i -e 's/^;\(runuser = asterisk\)/\1/' -e 's/^;\(rungroup = asterisk\)/\1/' /etc/asterisk/asterisk.conf

### FOR  ERROR in syslog
## -- radcli: rc_read_config: rc_read_config: can't open /etc/radiusclient-ng/radiusclient.conf: No such  file or directory
sed -i 's";\[radius\]"\[radius\]"g' /etc/asterisk/cdr.conf
sed -i 's";radiuscfg => /usr/local/etc/radiusclient-ng/radiusclient.conf"radiuscfg => /etc/radcli/radiusclient.conf"g' /etc/asterisk/cdr.conf
sed -i 's";radiuscfg => /usr/local/etc/radiusclient-ng/radiusclient.conf"radiuscfg => /etc/radcli/radiusclient.conf"g' /etc/asterisk/cel.conf



#ufw allow 22/tcp
#ufw allow 80/tcp
#ufw allow 443/tcp
#ufw allow 5060/udp
#ufw allow 5061/tcp
#ufw allow 10000:20000/udp
#ufw enable


systemctl start asterisk
systemctl enable asterisk

## only to keep safe copy of orginal setup for study
/bin/cp -pRv /etc/asterisk /etc/asterisk_backup_full_orgina

/bin/cp -pRv sample-ext-plus-ht813-dograh-ai-config/* /etc/asterisk/

