# MultiOgar
Ogar game server with fast and smooth vanilla physics and multi-protocol support.

## Project Info
![Language](https://img.shields.io/badge/language-node.js-yellow.svg)
[![License](https://img.shields.io/badge/license-APACHE2-blue.svg)](https://github.com/Barbosik/OgarMulti/blob/master/LICENSE.md)

MultiOgar code based on Ogar code that I heavily modified, and will continue to update. 
Almost all physics and protocol code were rewritten and optimized.
The [OgarProject](https://ogarproject.com) owns Ogar, and I do not claim it as mine! 
Original Ogar found [here](https://github.com/OgarProject/Ogar)


The goal is to make good and smooth physics and cleanup the code.

## Screenshot

MultiOgar console:

![Screenshot](http://i.imgur.com/pmECJCH.png)


Map 6000x6000, 300 bots, 5000 food, 10 viruses - works pretty smooth with no lags:

![Screenshot](http://i.imgur.com/4Wg8s9b.png)

## Install

#### Windows:
* Download and install node.js: https://nodejs.org/en/download/ (64-bit recommended)
* Download MultiOgar code: https://github.com/Barbosik/MultiOgar/archive/master.zip
* Unzip MultiOgar code into some folder
* Start command line and execute from MultiOgar folder
```
npm install
```
and then:
```
node src/index.js
```

#### Linux:
* Install node.js:
```
sudo apt-get update
sudo apt-get install nodejs
sudo apt-get install npm
```
* Download MultiOgar code: https://github.com/Barbosik/MultiOgar/archive/master.zip
* Unzip MultiOgar code into some folder
* Execute from MultiOgar folder:
```
npm install
```
and then:
```
node src/index.js
```


## Clients

This lists Ogar clients and server trackers that I found on internet.

###Ogar server trackers

URL | Description
--- | ---
http://ogar.mivabe.nl/master | MivaBe, tracks a lot of servers

Now you can allow MultiOgar to be listed on a server tracker.
Just set `serverTracker = 1` in the gameserver.ini, and your server will appear
on this page: http://ogar.mivabe.nl/master
If you don't want to include your server to tracker list, 
just set `serverTracker = 0` and the server will not ping the server tracker.


###Ogar clients
Just replace `127.0.0.1:50000` in the url to the server IP and port to play.

URL | Protocol | Description
--- | --- | ---
http://agar.io/?ip=127.0.0.1:50000 | 8 | Vanilla
http://ogar.mivabe.nl/?ip=127.0.0.1:50000 | early 5 | MivaBe, pretty smooth, custom graphics (anime)
http://play.ogarul.tk/?ip=127.0.0.1:50000 | 4 | OgarUL, vanilla style (sends invalid protocol=1)
http://c0nsume.me/private4.php?ip=127.0.0.1:50000 | 5 | vanilla style

###MultiOgar Servers

IP | Location | Game Mode | Web Site
--- | --- | --- | ---
vps.simonorj.com:24270 | USA | Instant Merge | https://redd.it/4mufge
164.132.48.230:600 | France | FFA | http://c0nsume.me/private4.php?ip=164.132.48.230:600
149.202.87.51:443 | Paris |	FFA	| http://agarlist.com/
134.119.17.230:443 | Germany | FFA | http://agarlist.com/
192.34.61.57:443 | New York | FFA | http://agarlist.com/


## What's new:
* Fixed cell-split order, now split-run works ok
* A little performance improvement for split/eject
* Fixed min mass to split/eject
* Fixed mass-limit behavior
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
