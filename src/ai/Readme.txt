[Ogar player bots]
These bots are designed to be used for testing new commits of Ogar. To install this module, set the serverBots config field in gameserver.js to an amount higher than 0 (10 is a good amount).


[Changelog]
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
