# Andrews Version of Ogar - THE FEATURE HAS ARRIVED, PERIODIC MESSAGE SENDING 
A fully functional open source Agar.io server implementation, written in Node.js. Ogar is designed to be used with the latest Agar.io client. THIS IS A FORK OF THE ORIGINAL OGAR BUT THIS HAS MORE FEATURES, also, I borrowed from other forks: Kickbots,merge (editedbyme),killrange(editedbyme),kickrange(editedbyme) commands and the nocollision game modes. Every other Extra feature I created.
This Modified copy was created to help those who want to open their server to the public. I will add more features like banning and remote control like pocket dock console in pocketmine (mabye) im also probably going to add virus mode and also might add OP/ingameadmin/staff (Soon)
### Highlight features in this modified copy
 1. PMSG command, to periodically send a message (no need for admin to be online to explain rules)
 2. msg,fmsg commands
 3. max ip connections
 4. troll command ;)
 5. more gamemodes
 5. and other features such as merge or nojoin or kick/killrange

### Official Website (for official ogar)
The official website for the Ogar Project is [ogarproject.com](http://ogarproject.com). You can register on our forums to chat with other Ogar users, get support, advertise your server, and more.

### Purchased Ogar?
If you've purchased a copy of Ogar, you've probably been ripped off. [This post on our website explains why.](http://ogarproject.com/threads/psa-if-you-purchased-ogar-youve-been-ripped-off.6/)

## Obtaining and Using
If you are on Windows, you can download the latest binary build of Ogar [from this page](http://dl.ogarproject.com/). The binary is the easiest way to get started running an Ogar server. If you'd like to tinker with the source code, you can follow the instructions below (and slightly modify them) to run the source on Windows.

As Ogar is written in Node.js, you must have Node.js and its "ws" module installed to use it (unless you are using the Windows binary). You can usually download Node using your distribution's package manager (for *nix-like systems), or from [the Node website](http://nodejs.org). To install the "ws" module that is required, open up your system command line (cmd for windows, terminal for mac) and type "npm install ws". If you are on Linux, you can use the install script which would also automatically install node.js and ws. 


Currently, Ogar listens on the following addresses and ports:
* *:80 - for the master server
* *:443 - for the game server

Please note that on some systems, you may have to run the process as root or otherwise elevate your privileges to allow the process to listen on the needed ports. **If you are getting an EADDRINUSE error, it means that the port required to run Ogar is being used. Usually, Skype is the culprit. To solve this, either close out skype, or change the serverPort value in gameserver.ini to a different port. You will have to change your connection ip to "127.0.0.1:PORT"**

Once the game server is running, you can connect (locally) by typing `agar.io/?ip=127.0.0.1:443` into your browser's address bar.

## Configuring Ogar
Use "gameserver.ini" to modify Ogar's configurations field. Player bots are currently basic and for testing purposes. To use them, change "serverBots" to a value higher than zero in the configuration file. To add/remove bot names, edit the file named "botnames.txt" which is in the same folder as "gameserver.ini". Names should be separated by using the enter key.

## Custom Game modes
Ogar has support for custom game modes. To switch between game modes, change the value of "serverGamemode" in the configurations file to the selected game mode id and restart the server. The current supported game modes are:

Id   | Name
-----|--------------
0    | Free For All
1    | Teams
2    | Experimental (As of 6/13/15)
10   | Tournament
11   | Hunger Games
12   | Zombie Mode
13   | Team Z
14   | Team X
20   | Rainbow FFA - Hint: Use with "setAcid(true)"
5    | UnlimitPVP - where you split can split indefinitly and rejoin instantly - 1v1 game (created by me)
6    | UnlimitFFA - same as above in ffa (created by me)
15   | NoCollision teams
16   | NoCollision Zteam
17   | NoCollision Xteam
18   | Leap - Where you leap instead of split, made by Ogarplus
19   | Virus - Where you shoot viruses
## Console Commands
The current available console commands are listed here. Command names are not case sensitive, but player names are.
 

 - Pfmsg [delay] [duration] [x to repeat] [msg1] [msg2] [etc...]
   * Periodically sends a force message (seconds)
 - Spfmsg []
   * stops pfmsg
 - Pmsg [delay] [duration] [x to repeat] [msg1] [msg2] [etc...]
   * Periodically sends a message (seconds)
 - Spmsg []
   * stops pmsg
 - Troll [id]
   * You figure out this one, Its a suprise!
 - Fmsg [message 1] [message 2] [etc...]
   * Forces players to read a message, This is done by changeing leaderboard to msg, freezing players, and change their name temporarily
 - Msg [message1] [message2] [etc...]
   * Changes the leaderboard to a message for a short time
 - kick/killrange [Start] [End]
   * Kicks/kills in a range (eg: killrange 1 10 will kill players whos ids are between them)
 - Nojoin [id]
   * Makes person unable to join
 - Merge [id]
   * forces user to merge
 - Addbot [Number]
   * Adds [Number] of bots to the server. If an amount is not specified, 1 bot will be added.
 - Board [String 1] [String 2] [String 3] ...
   * Replaces the text on the leaderboard with the string text.
 - Boardreset
   * Resets the leaderboard to display the proper data for the current gamemode
 - Change [Config setting] [Value]
   * Changes a config setting to a value. Ex. "change serverMaxConnections 32" will change the variable serverMaxConnections to 32. Note that some config values (Like serverGamemode) are parsed before the server starts so changing them mid game will have no effect.
 - Clear
   * Clears the console output
 - Color [Player ID] [Red] [Green] [Blue]
   * Replaces the color of the specified player with this color.
 - Exit
   * Closes the server.
 - Food [X position] [Y position] [Mass]
   * Spawns a food cell at those coordinates. If a mass value is not specified, then the server will default to "foodStartMass" in the config.
 - Gamemode [Id]
   * Changes the gamemode of the server. Warning - This can cause problems.
 - Help
   * Shows List Of Commands
 - Kick [Player ID]
   * Kicks the specified player or bot from the server.
 - Kill [Player ID]
   * Kills all cells belonging to the specified player.
 - Killall
   * Kills all player cells on the map.
 - Mass [Player ID] [Number]
   * Sets the mass of all cells belonging to the specified player to [Number].
 - Name [Player ID] [New Name]
   * Changes the name of the player with the specified id with [New Name].
 - Playerlist
   * Shows a list of connected players, their IP, player ID, the amount of cells they have, total mass, and their position. 
 - Pause
   * Pauses/Unpauses the game.
 - Reload
   * Reloads the config file used by the server. However, the following values are not affected: serverPort, serverGamemode, serverBots, serverStatsPort, serverStatsUpdate.
 - Status
   * Shows the amount of players currently connected, time elapsed, memory usage (memory used/memory allocated), and the current gamemode.
 - Tp [Player ID] [X position] [Y position]
   * Teleports the specified player to the specified coordinates.
 - Virus [X position] [Y position] [Mass]
   * Spawns a virus cell at those coordinates. If a mass value is not specified, then the server will default to "virusStartMass" in the config.

## Contributing
Please see [CONTRIBUTING.md](https://github.com/OgarProject/Ogar/blob/master/CONTRIBUTING.md) for contribution guidelines.

## License
Please see [LICENSE.md](https://github.com/OgarProject/Ogar/blob/master/LICENSE.md).
