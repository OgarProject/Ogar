# Ogar
An open source Agar.io server implementation, written in Node.js.

## Project Status
The project is still in its very early stages. Here's a rough list of what's been done and what needs to be done:

- [x] Master server basic implementation
- [x] Game server basic implementation (clients can connect)
- [x] Single-cell movement
- [x] Randomly generated cells and viruses
- [x] Ejecting mass
- [x] Splitting
- [x] Multi-cell player movement
- [x] Cells eating other cells
- [x] Leaderboard
- [ ] Team mode

## Known Issues
- Cells do not recombine yet
- The collision check for eating cells is off
- Players see all nodes on the map instead of nodes that are near them
- Mass of cells do not decay
- Cell speed is a fixed variable instead of being based on cell mass
- Multi cell movement sometimes gets the cells stuck in the border
- All cells are the same color
- When disconnecting, some cells from splitting are left behind

## Obtaining and Using
As Ogar is written in Node.js, you must have Node installed to use it. You can usually download Node using your distribution's package manager (for *nix-like systems), or from [the Node website](http://nodejs.org) (for Windows systems).

Although Ogar allows you to run both the Agar.io master server and game server separately, it's currently recommended that you run both servers together until the master server is more implemented. Alternatively, you could run the game server only, and use a client-side mod to connect to the IP address of the server.

```sh
~$ git clone git://github.com/forairan/Ogar.git Ogar
~$ npm install ./Ogar
~$ node Ogar --master --game
```

Currently, Ogar listens on the following addresses and ports:
* *:80 - for the master server
* *:443 - for the game server

Please note that on some systems, you may have to run the process as root or otherwise elevate your privileges to allow the process to listen on the needed ports.

## Contributing
Please see [CONTRIBUTING.md](https://github.com/forairan/Ogar/blob/master/CONTRIBUTING.md) for contribution guidelines.

## License
Please see [LICENSE.md](https://github.com/forairan/Ogar/blob/master/LICENSE.md).
