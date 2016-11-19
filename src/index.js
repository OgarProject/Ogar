// Imports
var Commands = require('./modules/CommandList');
var GameServer = require('./GameServer');

// Init variables
var showConsole = true;
 var text = "",
       commands = [],
       stdin = process.stdin,
       ind = 0;
// Start msg
console.log("[Game] Ogar - An open source Agar.io server implementation");

// Handle arguments
process.argv.forEach(function(val) {
    if (val == "--noconsole") {
        showConsole = false;
    } else if (val == "--help") {
        console.log("Proper Usage: node index.js");
        console.log("    --noconsole         Disables the console");
        console.log("    --help              Help menu.");
        console.log("");
    }
});

// Run Ogar
var gameServer = new GameServer();
gameServer.start();
// Add command handler
gameServer.commands = Commands.list;
// Initialize the server console
if (showConsole) {
    startPrompt()
}

// Console functions
function startPrompt() {
       
stdin.setRawMode(true);
stdin.resume();
stdin.setEncoding('utf8');
        stdin.on('data', function(key){
            if (key == '\u0003') { process.exit(); }    // ctrl-c
   prompt(key)
   


    
}.bind(this));   
    
}
function escapeChar(a) {
 var allowed = "` 1 2 3 4 5 6 7 8 9 0 - = q w e r t y u i o p [ ] | a s d f g h j k l ; ' z x c v b n m , . / ~ ! @ # $ % ^ & * ( ) _ + Q W E R T Y U I O P { } A S D F G H J K L : \\ \" Z X C V B N M < > ?"
 var allow = allowed.split(" ");
 if (a == " ") return true;
 if (allow.indexOf(a) == -1) return false;
 return true;
}
function prompt(key) {
    if (key == '\u000D') { //enter
             process.stdout.write('\n')
        if (text) {parseCommands(text.toLowerCase())
        commands.push(text)
                       }
       
        text = ""
        ind = commands.length
        process.stdout.write('>')
        
            return;
        } else if (key == '\u001B\u005B\u0041') { // up
      
            if (ind > 0) ind --;
                text = commands[ind] || ""
                 process.stdout.write('\r                                   ');
                    process.stdout.write('\r>' + text);
            return
               } else if (key == '\u001B\u005B\u0042') { // down
              
                   if (ind < commands.length) ind ++;
                   text = commands[ind] || ""
                   process.stdout.write('\r                                   ');
                    process.stdout.write('\r>' + text);
                   return;
        } else if (key == '\u007F' && text.length > 0) { // delete
            ind = commands.length
            text = text.substr(0,text.length - 1)
            process.stdout.write('\r                                   ');
            process.stdout.write('\r>' + text);
            return
        } else {
       if (!escapeChar(key)) return
       ind = commands.length
       text += key
       
       process.stdout.write(key.toString())
        }
}
    
/*
function prompt() {
    in_.question(">", function(str) {
        parseCommands(str);
        return prompt(); // Too lazy to learn async
    });
}
*/
function parseCommands(str) {
    // Log the string
    gameServer.log.onCommand(str);

    // Don't process ENTER
    if (str === '')
        return;

    // Splits the string
    var split = str.split(" ");

    // Process the first string value
    var first = split[0].toLowerCase();

    gameServer.pluginHandler.executeCommand(first, split);
}
