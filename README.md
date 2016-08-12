# MultiOgar
Ogar game server with fast and smooth vanilla physics and multi-protocol support.

Current version: **1.2.69**

## Project Info
![Language](https://img.shields.io/badge/language-node.js-yellow.svg)
[![License](https://img.shields.io/badge/license-APACHE2-blue.svg)](https://github.com/Barbosik/OgarMulti/blob/master/LICENSE.md)

MultiOgar code based on Ogar code that I heavily modified, and will continue to update. 
Almost all physics and protocol code were rewritten and optimized.
The [OgarProject](https://ogarproject.com) owns Ogar, and I do not claim it as mine! 
Original Ogar found [here](https://github.com/OgarProject/Ogar)


The goal is to make good and smooth physics and cleanup the code.

## Ogar Server Tracker

You can found active Ogar servers on http://ogar-tracker.tk 
It updates server information in realtime with no need to refresh the page.

If you want to include your server in the list. Just install the latest version of MultiOgar server and enable server tracking with `serverTracker = 1` in gameserver.ini

If you have other server and want to include it in the list, just insert the code to ping ogar-tracker.tk into your server.
You can found example in MultiOgar source code: https://github.com/Barbosik/MultiOgar/blob/master/src/GameServer.js#L1799-L1823


## Screenshot

MultiOgar console:

![Screenshot](https://i.imgur.com/GiJURq0.png)

Version 1.2.8: 
* 1000 bots, 500 viruses, 1000 foods, map 14142x14142
* Works very-very smooth (with a little slower speed, but it will not be noticed by user).
* CPU load: 14% (x4 core)
* Memory usage: 70 MB

![Screenshot](http://i.imgur.com/XsXjT0o.png)


## Install

#### Windows:
* Download and install node.js: https://nodejs.org/en/download/ (64-bit recommended)
* Download MultiOgar code: https://github.com/Barbosik/MultiOgar/archive/master.zip
* Unzip MultiOgar code into some folder
* Start command line and execute from MultiOgar folder
```
npm install
```
and run the server:
```
cd src
node index.js
```

#### Linux:
```
# First update your packages:
sudo apt-get update

# Install git:
sudo apt-get install git

# Install node.js:
sudo apt-get install nodejs-legacy npm

# Clone MultiOgar:
git clone git://github.com/Barbosik/MultiOgar.git

# Install dependencies:
cd MultiOgar
npm install

# Run the server:
cd src
sudo node index.js
```


## Clients

This lists Ogar clients and server trackers that I found on internet.

###Ogar server trackers

Welcome to http://ogar-tracker.tk :)

URL | Description
--- | ---
http://ogar-tracker.tk | Ogar tracker
http://ogar.mivabe.nl/master | MivaBe, tracks a lot of servers
http://c0nsume.me/tracker.php | c0nsume.me server tracker

Now you can allow MultiOgar to be listed on a server tracker.
Just set `serverTracker = 1` in the gameserver.ini, and your server will appear
on these pages: http://ogar.mivabe.nl/master , http://c0nsume.me/tracker.php
If you don't want to include your server to tracker list, 
just set `serverTracker = 0` and the server will not ping the server tracker.


###Ogar clients
Just replace `127.0.0.1:443` in the url to the server IP and port to play.

URL | Protocol | Description
--- | --- | ---
http://agar.io/?ip=127.0.0.1:443 | 8 | Vanilla
http://ogar.mivabe.nl/?ip=127.0.0.1:443 | early 5 | MivaBe, pretty smooth, custom graphics (anime)
http://play.ogarul.tk/?ip=127.0.0.1:443 | 4 | OgarUL, vanilla style
http://c0nsume.me/private4.php?ip=127.0.0.1:443 | 5 | vanilla style

###MultiOgar Servers

IP | Location | Game Mode | Web Site
--- | --- | --- | ---
bubble-wars.tk:4444 | France | FFA | http://agar.io/?ip=bubble-wars.tk:4444 (Test server)
bubble-wars.tk:4445 | France | FFA IM | http://agar.io/?ip=bubble-wars.tk:4445 (Test server)
vps.simonorj.com:24270 | Montreal | Instant Merge | https://redd.it/4mufge
164.132.48.230:600 | France | FFA | http://c0nsume.me/private4.php?ip=164.132.48.230:600
149.202.87.51:443 | Paris |	FFA	| http://agarlist.com/
134.119.17.230:443 | Germany | FFA | http://agarlist.com/
192.34.61.57:443 | New York | FFA | http://agarlist.com/


## What's new:
* 1.2.47: Improved stability and performance; added mute/unmute command
* Added support for secure websocket connections (TLS)
* Fixed mass decay
* Added ejectSizeLoss
* Added sub-net ban feature (use `ban xx.xx.xx.*` or `ban xx.xx.*.*` to ban entire sub-network)
* Added performance optimizations, now up to 700 bots with no lags at all
* Fixed bug when some cell split/eject were shown with delay for some clients
* Added a lot of protocol optimizations, now server works with no lags at all even with 64 connected players
* Added server version, now you can check if your MultiOgar code is fresh
* Significant performance improvement and more smooth physics
* Added protocol optimizations to reduce lags on cell multi split
* Fixed pop-split behavior
* Added spectate walk through feature (use Space key in spectate mode to lock the current player or to lock the next one. Use key Q to reset into the normal mode. Locked player is highlighted on leaderboard)
* Fixed cell-split order, now split-run works ok
* A little performance improvement for split/eject
* Fixed min mass to split/eject
* Fixed mass-limit behavior
* Added chat player commands /skin and /kill (to change skin, just type /skin %shark in the chat)
* Added scramble level 3 (anti-bot/anti-minimap protection), unsupported on some clients (unfortunately include vanilla, ogar.mivabe.nl works ok)
* NOTE: there is major gameserver.ini change, previous version is incompatible!
* Massive perfromance improvement & reduce network traffic
* Split behavior - fixed;
* Protocol code - optimized;
* Massive performance improvement with quad-tree lookup;
* Split/Eject - physics code rewritten;
* Player speed - physics code rewritten;
* Cell remerge - physics code rewritten;
* Cell collision - physics code rewritten;
* View area - code rewritten;
* Spectate - code rewritten;
* Mouse control and cell movements - physics code rewritten;
* Border calculations - rewritten;
* Border bouncy physics - fixed and improved;
* mainLoop - cleaned;
* Added support for different protocols (4, early 5, late 5, 6, 7, 8);
* Added automatic mouse message type recognition;
* Added chat support;
* Added anti-spam protection;
* Added skin support (use name "< shark > Fish", remove space);
* Color generator replaced with hsv model;
* Memory leaks - fixed;
* Performance improved and optimized
* Added support for server tracker ogar.mivabe.nl/master

Most of the physics code from the original Ogar were rewritten.
The physics engine in MultiOgar is pretty close to the old vanilla physics.
