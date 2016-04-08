var zerorpc = require("zerorpc");
var path = require('path');
var child_process = require('child_process');

var PlayerTracker = require('../PlayerTracker');
var gameServer = require('../GameServer');

function BotPlayer(currentGameServer, s, spawnPython, zerorpcPort) {
    PlayerTracker.apply(this, Array.prototype.slice.call(arguments));
    //this.color = gameServer.getRandomColor();

    this.currentGameServer = currentGameServer;
    this.spawnPython = spawnPython;
    this.zerorpcPort = zerorpcPort
    // AI only
    this.gameState = 0;
    this.path = [];

    this.predators = []; // List of cells that can eat this bot
    this.threats = []; // List of cells that can eat this bot but are too far away
    this.prey = []; // List of cells that can be eaten by this bot
    this.food = [];
    this.foodImportant = []; // Not used - Bots will attempt to eat this regardless of nearby prey/predators
    this.virus = []; // List of viruses

    this.juke = false;

    this.target;
    this.targetVirus; // Virus used to shoot into the target
    this.virusShots = 0; // Amount of pressed W to explode target via target virus

    this.ejectMass = 0; // Amount of times to eject mass
    this.targetPos = {
        x: 0,
        y: 0
    };

    if (spawnPython) {
        this.pythonLogic = child_process.spawn('python', [path.resolve(__dirname, 'BotLogic.py'), String(this.zerorpcPort)]);

        this.pythonLogic.stdout.on('data', (data) => {
          console.log(`stdout: ${data}`);
        });

        this.pythonLogic.stderr.on('data', (data) => {
          console.log(`stderr: ${data}`);
        });

        this.pythonLogic.on('close', (code) => {
          console.log(`child process exited with code ${code}`);
        });
    }

    this.zerorpcClient = new zerorpc.Client();
    this.zerorpcClient.connect("tcp://127.0.0.1:"+this.zerorpcPort);

}

module.exports = BotPlayer;
BotPlayer.prototype = new PlayerTracker();

BotPlayer.prototype.update = function() { // Overrides the update function from player tracker
    //if cell is dead 
    if (this.cells[0] == null){
        if (this.spawnPython) {
            console.log('bot was eaten')
            this.pythonLogic.kill();
        }
        this.socket.close();
        return
    }

    // Remove nodes from visible nodes if possible
    for (var i = 0; i < this.nodeDestroyQueue.length; i++) {
        var index = this.visibleNodes.indexOf(this.nodeDestroyQueue[i]);
        if (index > -1) {
            this.visibleNodes.splice(index, 1);
        }
    }

    // // Respawn if bot is dead
    // if (this.cells.length <= 0) {
    //     this.gameServer.gameMode.onPlayerSpawn(this.gameServer, this);
    //     if (this.cells.length == 0) {
    //         // If the bot cannot spawn any cells, then disconnect it
    //         this.socket.close();
    //         return;
    //     }
    // }

    // Calculate nodes
    this.visibleNodes = this.calcViewBox();

    var that = this;
    // var nodes = this.currentGameServer.nodes.map(function(node) {
    //         if (that.cells[0].owner !== node.owner) {
    //             return nodeSimp(node);
    //         } else {
    //             console.log('removing self')
    //             return null;
    //         }
    //     }
    // );
    // var nodes = this.currentGameServer.nodes.reduce(function(previousValue, currentValue, currentIndex, array) {
    //         if (that.cells[0].owner !== currentValue.owner) {
    //             return previousValue.concat(nodeSimp(currentValue));
    //         } else {
    //             return previousValue;
    //         }
    // }, []);
    // //console.log(this)

    gameInfo = {
        'cell': this.cells[0],
        'nodes': this.visibleNodes.filter(function(node) {return node.owner !== that.cells[0].owner})
    }

    var gameInfoString = JSON.stringify(gameInfo, function(key, value) {
            if (typeof value === 'object' && value !== null) {
                // console.log(value.owner)
                try {
                    if (!( value.constructor.name === "Cell"
                        || value.constructor.name === "Object"
                        || value.constructor.name === "Array")) {
                    // Circular reference found, discard key
                        return;
                    }

                } catch (err) {
                    console.log(err)
                    return 
                }
            }
            return value;
        }
    );
    // console.log(gameInfoString)
    this.zerorpcClient.invoke("getNewMousePosition", gameInfoString, (function(error, res, more) {
            if (error) {
                return console.log(error)
            }
            // console.log(res.message)
            // console.log(res.x + ", " + res.y)
            this.mouse = {
                x: res.x,
                y: res.y
            }
        }).bind(this)
    );

    // Reset queues
    this.nodeDestroyQueue = [];
    this.nodeAdditionQueue = [];
};

var nodeSimp = function(node) {
    var newNode = {}
    newNode.position = node.position;
    newNode.mass = node.mass;
    newNode.cellType = node.cellType;
    newNode.size = node.size;
    newNode.cellType = node.cellType;
    newNode.angle = node.angle;
    newNode.moveEngineSpeed = node.moveEngineSpeed;
    return newNode;
}

BotPlayer.prototype.kill = function() {
    console.log('killing bot: ' + this.zerorpcPort)
    if (this.spawnPython) {
        try {
            this.pythonLogic.kill();
        } catch (err) {
            console.log(err)
        }
    }

}