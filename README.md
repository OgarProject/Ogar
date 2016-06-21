# MultiOgar
Ogar game server with vanilla physics and multi-protocol support.

## Project Info
![Language](https://img.shields.io/badge/language-node.js-yellow.svg)
[![License](https://img.shields.io/badge/license-APACHE2-blue.svg)](https://github.com/Barbosik/OgarMulti/blob/master/LICENSE.md)

## [![Language](https://img.shields.io/badge/Ogar-Node-red.svg)](https://github.com/OgarProject/Ogar) Ogar
Copy of Ogar that I heavily modified, and will continue to update. 
The [OgarProject](https://ogarproject.com) owns Ogar, and I do not claim it as mine! 
Original Ogar found [here](https://github.com/OgarProject/Ogar)


The goal is to cleanup the code, fix the bugs and improve physics.

## Clients

Ogar clients and server trackers, that I found on internet

###Ogar server trackers

URL | Description
--- | ---
http://ogar.mivabe.nl/master | MivaBe, tracks a lot of servers

Now you can enable MultiOgar to be listed on server tracker.
Just set serverTracker = 1 in the gameserver.ini and your server will appears
on this page: http://ogar.mivabe.nl/master
If you don't want to include your server to tracker list. 
Just set serverTracker = 0 and server will not ping the server tracker.


###Ogar clients
Just replace ip:port in the url to play

URL | Protocol | Description
--- | --- | ---
http://ogar.mivabe.nl/?ip=127.0.0.1:50000 | early 5 | MivaBe, pretty smooth, custom graphics (anime)
http://play.ogarul.tk/?ip=127.0.0.1:50000 | 4 | OgarUL, vanilla style (sends invalid protocol=1)
http://c0nsume.me/private4.php?ip=127.0.0.1:50000 | 5 | vanilla style

###MultiOgar Servers

IP | Location
--- | ---
164.132.48.230:600 | France


## What's new:
* Massive perfromance improvement & reduce network traffic
* Split behavior - fixed;
* Protocol code optimized;
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
* Memory leaks fixed;
* Performance improved and optimized
* Added support for server tracker ogar.mivabe.nl/master

Most of the physics code from original ogar were rewritten.
The physics engine in MultiOgar is pretty close to the old vanilla physics.