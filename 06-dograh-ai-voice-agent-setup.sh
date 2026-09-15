#!/bin/sh

cd /opt/
curl -o setup_remote.sh https://raw.githubusercontent.com/dograh-hq/dograh/main/scripts/setup_remote.sh && chmod +x setup_remote.sh && sudo ./setup_remote.sh

cd /opt/dograh
./remote_up.sh

touch /opt/dograh/start_up_dograh_remote_server.sh
echo '#!/bin/bash' > /opt/dograh/start_up_dograh_remote_server.sh 
echo 'cd /opt/dograh' >> /opt/dograh/start_up_dograh_remote_server.sh 
echo './remote_up.sh' >> /opt/dograh/start_up_dograh_remote_server.sh 
chmod 755 /opt/dograh/start_up_dograh_remote_server.sh

echo "Do add in /opt/dograh/start_up_dograh_remote_server.sh  in /etc/rc.local"
cd -
