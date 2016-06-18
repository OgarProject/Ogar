// Ogar Linux Script

#!/bin/sh


##Function Definition
#Download, extract .tar.gz and clean function
download_and_extract () { 
if [ ! -d Ogar-master ]; then
	if [ ! -f master.tar.gz ]; then
			echo "No local master.tar.gz found, downloading with curl."
			curl -O -L https://github.com/Barbosik/MultiOgar/archive/master.tar.gz
	fi
	if [ ! -f master.tar.gz ]; then
		echo "curl failed to download master.tar.gz, trying wget."
		wget https://github.com/Barbosik/MultiOgar/archive/master.tar.gz
			if [ ! -f master.tar.gz ]; then
					echo "wget failed as well. Aborting!"
					exit 1
			fi
	fi
	echo "master.tar.gz found!"
	echo "Extracting master.tar.gz to /tmp."
	tar -xzf master.tar.gz -C /tmp
	echo "Removing master.tar.gz."
	rm master.tar.gz
	echo "Entering temporary directory."
	cd /tmp || exit 1
	echo "Organising and cleaning up the extracted files."
	rm Ogar-master/src/Start.bat
	rm Ogar-master/.gitignore
fi
}

#Install Function
ogar_install() {
	echo "INSTALLING"
	if [ "$2" = "" ]; then
			echo "Please specify the directory in which you would like to install Ogar."
			exit 1
	fi
	
	echo "The Ogar server will be installed inside $2/ogar."
	echo "Do you wish to continue? (Y/N)"
	read -r yn
	case $yn in
			[Yy]* ) ;;
			 * ) exit 1;;
	esac
	
	if [ ! -d "$2" ]; then
			echo "$2 doesn't exist or is otherwise not accessible. Make sure you use absolute paths."
			exit 1
	fi
	
	if [[ ! "$2" = /* ]]
	then
	   echo "$2 isn't an absolute path! This is required for proper installation."
	   exit 1
	fi
	
	if grep "Arch Linux" /etc/*-release > /dev/null; then
		echo "You are running Arch Linux. It is recommended to use the Ogar AUR package - https://aur4.archlinux.org/packages/ogar-git/"
		echo "Do you wish to continue? (Y/N)"
		read -r yn
		case $yn in
			[Yy]* ) ;;
			* ) exit 1;;
		esac
	fi
	download_and_extract
	echo "Copying the generated ogar folder to $2."
	cp -RTf Ogar-master "$2"/ogar
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
	cd "$2"/ogar || exit 1
	npm install ws
	
	echo "Symlinking gameserver.ini to /etc/ogar"
	ln -s "$2"/ogar/gameserver.ini /etc/ogar
	
	echo "Setting proper permissions"
	chown -R ogar:ogar "$2"/ogar
	chmod -R 755 "$2"/ogar
	
	echo "Finished installing! :D"
}

#Update Function
ogar_update() {
	echo "UPDATING"
	if [ "$2" = "" ]; then
			echo "Please specify your existing Ogar installation."
			exit 1
	fi
	
	echo "The Ogar server inside $2/ogar will be updated."
	echo "Do you wish to continue? (Y/N)"
	read -r yn
	case $yn in
			[Yy]* ) ;;
			 * ) exit 1;;
	esac
	
	if [ ! -f "$2/ogar/src/index.js" ]; then
			echo "$2/ogar/src/index.js either way doesn't exist or isn't accesible. Are you sure this is an Ogar installation?"
			exit 1
	fi
	
	if [[ ! "$2" = /* ]]
	then
	   echo "$2 isn't an absolute path! This is required for proper installation."
	   exit 1
	fi
	
	download_and_extract
	echo "Do you wish to install a fresh gamserver.ini? (Y/N)"
	read -r yn
	case $yn in
			[Yy]* ) ;;
			 * ) rm Ogar-master/gameserver.ini;;
	esac
	echo "Copying the generated ogar folder to $2."
	cp -RTf Ogar-master "$2"/ogar
	echo "Removing temporary files"
	rm -R Ogar-master
	
	echo "Updating ws module"
	rm -R /root/.npm
	cd "$2"/ogar || exit 1
	npm install ws
	
	echo "Setting proper permissions"
	chown -R ogar:ogar "$2"/ogar
	chmod -R 755 "$2"/ogar
	
	echo "Finished updating! :D"
}

#Uninstall Function
ogar_uninstall() {
	echo "UNINSTALLING"
	if [ "$2" = "" ]; then
			echo "Please specify the directory in which Ogar is installed."
			exit 1
	fi
	
	if [ ! -f "$2/ogar/src/index.js" ]; then
			echo "$2/ogar/src/index.js either way doesn't exist or isn't accesible. Are you sure this is an Ogar installation?"
			exit 1
	fi
	
	echo "The ENTIRE $2/ogar folder will be DELETED."
	echo "Do you wish to continue? (Y/N)"
	read -r yn
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
	cd "$2"/ogar || exit 1
	npm uninstall ws
	
	echo "Removing the ENTIRE Ogar folder"
	rm -R "$2"/ogar
	echo "Finished uninstalling!"
}

echo "OGAR INSTALL, UPDATE AND UNINSTALL SCRIPT"
echo "Make sure you have: nodejs, npm, tar and wget/curl (for automatic downloads) installed!"
echo "However, you may also download and extract master.tar.gz manually."
echo "Place it in the same directory as the installer and name the extracted folder Ogar-master."
echo "----------------------------------------------------------------------------------------------------"
echo 'IMPORTANT: Use the following command to start the server in interactive mode for improved security:'
echo 'sudo -u ogar -H /bin/sh -c "cd; /bin/node src/index.js"'
if [ ! "$(id -u)" = 0 ]; then
		echo "This script must be run as root" 1>&2
		exit 1
fi


case "$1" in
	install)
		ogar_install $1 $2
		;;
	update)
		ogar_update $1 $2
		;;
	uninstall)
		ogar_uninstall $1 $2
		;;
	"")
		echo "Blank sub-command. Please specify if you want to install, update or uninstall."
		exit 1
		;;
	*)
		echo "Invalid sub-command. Please specify if you want to install, update or uninstall."
		exit 1
		;;
esac

#If I havn't exited abnormally yet, exit normally normally now
exit 0
