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


###Ogar clients
Just replace ip:port in the url to play

URL | Protocol | Description
--- | --- | ---
http://ogar.mivabe.nl/?ip=127.0.0.1:50000 | early 5 | MivaBe, pretty smooth, custom graphics (anime)
http://play.ogarul.tk/?ip=127.0.0.1:50000 | 4 | OgarUL, vanilla style (sends invalid protocol=1)



## What's new:
* Split/Eject - physics rewritten;
* Player speed - physics rewritten;
* Recombine - physics rewritten;
* Cell collision - physics rewritten;
* View area - rewritten
* Mouse control and cell movements - physics rewritten;
* Border calculations - rewritten;
* Border bouncy physics - fixed and improved
* mainLoop - cleaned
* added support for different protocols
* added chat support
* added anti-spam protection
* color generator replaced with hsv model
* Memory leaks fixed
* Performance improved with optimizations

Currently most of the physics code from original ogar was replaced with new code.
Now the physics engine in MultiOgar is pretty close to old vanilla physics.