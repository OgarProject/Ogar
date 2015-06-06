# Ogar
An open source Agar.io server implementation, written in Node.js.

## Project Status
The project is nearly complete. Here's a rough list of what's been done and what needs to be done:

- [x] Master server basic implementation
- [x] Game server basic implementation (clients can connect)
- [x] Single-cell movement
- [x] Randomly generated cells and viruses
- [x] Ejecting mass
- [x] Splitting
- [x] Multi-cell player movement
- [x] Cells eating other cells
- [x] Leaderboard
- [x] Team mode
- [x] Spectate mode

Playerbots are currently basic and for testing purposes. To use them, change "serverBots" to a value higher than zero (I like to use 50) in the config field of GameServer.js.

## Obtaining and Using
If you are on Windows, Ogar no longer requires an installation of node.js to run. Simply launch the batch file that is included to run the server. This is a beta feature, and if there are any problems, switch back to using Ogar with node.js. The rest of this section is for non Windows users.

As Ogar is written in Node.js, you must have Node.js and its "ws" module installed to use it (Unless you are on Windows). You can usually download Node using your distribution's package manager (for *nix-like systems), or from [the Node website](http://nodejs.org). To install the "ws" module that is required, open up your system command line (cmd for windows, terminal for mac) and type "npm install ws".

Although Ogar allows you to run both the Agar.io master server and game server separately, it's currently recommended that you run both servers together until the master server is more implemented. Alternatively, you could run the game server only, and use a client-side mod to connect to the IP address of the server.

```sh
~$ git clone git://github.com/forairan/Ogar.git Ogar
~$ npm install ./Ogar
~$ node Ogar
```

Currently, Ogar listens on the following addresses and ports:
* *:80 - for the master server
* *:443 - for the game server

Please note that on some systems, you may have to run the process as root or otherwise elevate your privileges to allow the process to listen on the needed ports.

## Configuring Ogar
Use gameserver.ini to modify Ogar's configurations field.

## Contributing
Please see [CONTRIBUTING.md](https://github.com/forairan/Ogar/blob/master/CONTRIBUTING.md) for contribution guidelines.

## License
Please see [LICENSE.md](https://github.com/forairan/Ogar/blob/master/LICENSE.md).
