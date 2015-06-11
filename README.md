# Ogar
A fully functional open source Agar.io server implementation, written in Node.js. Ogar is designed to be used with the latest Agar.io client (as of 6/9/15).

## Obtaining and Using
If you are on Windows, Ogar no longer requires an installation of node.js to run. Simply launch the batch file that is included to run the server. This is a beta feature, and if there are any problems, switch back to using Ogar with node.js. The rest of this section is for non Windows users.

As Ogar is written in Node.js, you must have Node.js and its "ws" module installed to use it (Unless you are on Windows). You can usually download Node using your distribution's package manager (for *nix-like systems), or from [the Node website](http://nodejs.org). To install the "ws" module that is required, open up your system command line (cmd for windows, terminal for mac) and type "npm install ws".

```sh
~$ git clone git://github.com/forairan/Ogar.git Ogar
~$ npm install ./Ogar
~$ node Ogar
```

Currently, Ogar listens on the following addresses and ports:
* *:80 - for the master server
* *:443 - for the game server

Please note that on some systems, you may have to run the process as root or otherwise elevate your privileges to allow the process to listen on the needed ports.

Once the server is running, you can connect (locally) by typing "agar.io?127.0.0.1:443" into your browser's address bar. No client side mods are needed to connect.

## Configuring Ogar
Use gameserver.ini to modify Ogar's configurations field. Playerbots are currently basic and for testing purposes. To use them, change "serverBots" to a value higher than zero in the configuration file.

## Custom Game modes
Ogar has support for custom game modes. To switch between game modes, change the value of "serverGamemode" in the configurations file to the selected game mode id and restart the server. The current supported game modes are:

Id   | Name
-----|--------------
0    | Free For All
1    | Teams
10   | Tournament
11   | Hunger Games

## Contributing
Please see [CONTRIBUTING.md](https://github.com/forairan/Ogar/blob/master/CONTRIBUTING.md) for contribution guidelines.

## License
Please see [LICENSE.md](https://github.com/forairan/Ogar/blob/master/LICENSE.md).
