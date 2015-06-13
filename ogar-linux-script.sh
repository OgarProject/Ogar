#!/bin/sh
echo "OGAR INSTALL, UPDATE AND UNINSTALL SCRIPT"
echo "Make sure you have: nodejs, npm, bsdtar/unzip and wget/curl installed!"
echo "----------------------------------------------------------------------------------------------------"
if [ ! "$(id -u)" = 0 ]; then
        echo "This script must be run as root" 1>&2
        exit 1
fi

#Install
if [ "$1" = "install" ]; then
echo "INSTALLING"
if [ "$2" = "" ]; then
        echo "Please specify the directory in which you would like to install Ogar."
        exit 1
fi

echo "The Ogar server will be installed inside $2/ogar."
echo "Do you wish to continue? (Y/N)"
read yn
case $yn in
        [Yy]* ) ;;
         * ) exit 1;;
esac

if grep "Arch Linux" /etc/*-release > /dev/null; then
	echo "You are running Arch Linux. It is recommended to use the Ogar AUR package - https://aur4.archlinux.org/packages/ogar/"
	echo "Do you wish to continue? (Y/N)"
	read yn
	case $yn in
		[Yy]* ) ;;
		* ) exit 1;;
	esac
fi

if [ ! -f master.zip ]; then
        echo "No local master.zip found, downloading with curl."
        curl -O -L https://github.com/vram4/Ogar/archive/master.zip
fi
if [ ! -f master.zip ]; then
	echo "curl failed to download master.zip, trying wget."
	wget https://github.com/vram4/Ogar/archive/master.zip
		if [ ! -f master.zip ]; then
		       	echo "wget failed as well. Aborting!"
	       		exit 1
		fi
fi
echo "master.zip found!"
if [  -f /usr/bin/bsdtar ]; then
        echo "BSDtar found. Using BSDtar to extract the archive."
        bsdtar -xf master.zip
	else
		if [ -f /usr/bin/unzip ]; then
       		 echo "unzip found. Using unzip to extract the archive."
       		 unzip master.zip
       		 else
			echo "No .zip decompression tool found. Aborting!"
			exit 1
		fi
fi
echo "Organising and cleaning up the extracted files."
rm -R Ogar-master/bin
rm Ogar-master/Launch.bat
rm Ogar-master/src/Start.bat
rm Ogar-master/.gitignore
echo "Copying the generated ogar folder to $2."
cp -RTf Ogar-master "$2"/ogar
echo "Removing master.zip"
rm master.zip
echo "Removing temporary files"
rm -R Ogar-master

echo "Creating ogar user and group if they don't exist"
  if ! getent group "ogar" >/dev/null; then
    groupadd -r ogar
  fi
  if ! getent passwd "ogar" >/dev/null; then
    useradd -r -M -N -g ogar -d "$2"/ogar -s /usr/bin/nologin -c 'Ogar Server' ogar
  fi

echo "Installing ws module"
rm -R /root/.npm
cd "$2"/ogar
npm install ws

echo "Symlinking gameserver.ini to /etc/ogar"
ln -s "$2"/ogar/gameserver.ini /etc/ogar

echo "Setting proper permissions"
chown -R ogar:ogar "$2"/ogar
chmod -R 755 "$2"/ogar

echo "Finished installing! :D"
exit 0
fi

#Update
if [ "$1" = "update" ]; then
echo "UPDATING"
if [ "$2" = "" ]; then
        echo "Please specify your existing Ogar installation."
        exit 1
fi

echo "The Ogar server inside $2/ogar will be updated."
echo "Do you wish to continue? (Y/N)"
read yn
case $yn in
        [Yy]* ) ;;
         * ) exit 1;;
esac

if [ ! -f master.zip ]; then
        echo "No local master.zip found, downloading with curl."
        curl -O -L https://github.com/vram4/Ogar/archive/master.zip
fi
if [ ! -f master.zip ]; then
	echo "curl failed to download master.zip, trying wget."
	wget https://github.com/vram4/Ogar/archive/master.zip
		if [ ! -f master.zip ]; then
		       	echo "wget failed as well. Aborting!"
	       		exit 1
		fi
fi
echo "master.zip found!"
if [  -f /usr/bin/bsdtar ]; then
        echo "BSDtar found. Using BSDtar to extract the archive."
        bsdtar -xf master.zip
	else
		if [ -f /usr/bin/unzip ]; then
       		 echo "unzip found. Using unzip to extract the archive."
       		 unzip master.zip
       		 else
			echo "No .zip decompression tool found. Aborting!"
			exit 1
		fi
fi
echo "Organising and cleaning up the extracted files."
rm -R Ogar-master/bin
rm Ogar-master/Launch.bat
rm Ogar-master/src/Start.bat
rm Ogar-master/.gitignore
rm Ogar-master/gameserver.ini
echo "Copying the generated ogar folder to $2."
cp -RTf Ogar-master "$2"/ogar
echo "Removing master.zip"
rm master.zip
echo "Removing temporary files"
rm -R Ogar-master

echo "Updating ws module"
rm -R /root/.npm
cd "$2"/ogar
npm install ws

echo "Setting proper permissions"
chown -R ogar:ogar "$2"/ogar
chmod -R 755 "$2"/ogar

echo "Finished updating! :D"
exit 0
fi

#Uninstall
if [ "$1" = "uninstall" ]; then
echo "UNINSTALLING"
if [ "$2" = "" ]; then
        echo "Please specify the directory in which Ogar is installed."
        exit 1
fi

echo "The ENTIRE $2/ogar folder will be DELETED."
echo "Do you wish to continue? (Y/N)"
read yn
case $yn in
        [Yy]* ) ;;
        * ) exit 1;;
esac

echo "Removing ogar user and group"
  if getent passwd "ogar" >/dev/null; then
    userdel ogar > /dev/null
  fi
  if getent group "ogar" >/dev/null; then
    groupdel ogar >/dev/null
  fi

echo "Unlinking /etc/ogar"
unlink /etc/ogar

echo "Removing ws module"
cd "$2"/ogar
npm uninstall ws

echo "Removing the ENTIRE Ogar folder"
rm -R "$2"/ogar
echo "Finished uninstalling!"
exit 0
fi

#If no install/update/uninstall parameter is specified
echo "Please specify if you want to install, update or uninstall."
exit 1
