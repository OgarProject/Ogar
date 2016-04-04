var zerorpc = require("zerorpc");
var path = require('path');
var child_process = require('child_process');
var portfinder = require('portfinder');

var PlayerTracker = require('../PlayerTracker');
var gameServer = require('../GameServer');

function BotPlayer(currentGameServer, s, spawnPython, zerorpcPort) {
    PlayerTracker.apply(this, Array.prototype.slice.call(arguments));
    //this.color = gameServer.getRandomColor();

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
    //console.log(this)

    gameInfo = {
        a: 'b'
    }

    this.zerorpcClient.invoke("getNewMousePosition", gameInfo, (function(error, res, more) {
            if (error) {
                return console.log(error)
            }
            //console.log(res.x + ", " + res.y)
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

BotPlayer.prototype.kill = function() {
    console.log('killing bot: ' + this.zerorpcPort)
    this.pythonLogic.kill();
}