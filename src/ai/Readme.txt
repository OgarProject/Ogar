[Ogar player bots]
These bots are designed to be used for testing new commits of Ogar.
To install this module, set the serverBots config field in gameserver.js to an amount higher than 0 (10 is a good amount),
or issue command addBots [number] in console.

[Changelog]
(3/28/16)
- Bots now have intelligent pathfinding - will ignore viruses in most cases
- Bot updating is now async and happens every 50ms
- Removed most of bot properties which use a lot of CPU
- Bots won't shoot viruses to threats anymore; the current program layout of the bot makes it hard to implement

(2/19/16)
- Bots won't passively gain mass when running anymore
- Bots will target with their largest cell when chasing enemies
- Bots will update once one of three possibilities are made:
  - Bot is staying in one place
  - 10% random chance
  - Target is out of range/eaten
- Bots shoot viruses more familiar than before (UNTESTED! If they don't do it correctly all the time, report it!)
- Bots will target with their largest cell when chasing enemies, instead of smallest

(1/27/16)
- Bots' update function is triggered randomly (50 to 600 ms), to prevent massive update lag when having a lot of bots
- Bots are a lot more aggressive
- Bots will split even though more massive cells are near it

(1/18/16)
- Bots won't recognize mother cells as viruses anymore

(1/1/16)
- Bot will now actively target the biggest prey

(6/24/15)
-Bots will now consider threats when splitting
-Bots now passively gain mass when running away
-Bots will sometimes juke when being chased
-Bots will try to merge (if possible) if they are being chased
-Fixed bots trying to chase cells with more mass than them
-Fixed bots getting stuck when there is no food on the map
-Bots can now ignore viruses

(6/9/15)
-Bots will sometimes shoot viruses at big cells (Experimental)
-Distance required for a large cell to be marked as a "predator" reduced to a reasonable amount (300)

(6/2/15) Public release
-Bot ai updates more per second
-Bots will move to a random food cell in the map when wandering rather than a random location

(6/1/15)
-Ejected mass now counts as food
-Rewrote findNearest function
-Improved split kill algorithms

(5/31/15)
-Added 2 Gamestates (Fleeing and targeting low mass cells)

(5/30/15) Initial release
-Added 2 Gamestates (Wandering and eating food)

[Issues]
-Bots can get stuck in the corners
-Bots run into viruses
-Pathing needs to be improved
