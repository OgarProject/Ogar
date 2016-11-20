function Plugin(gameServer) {
    // Neccesary variables.
    this.gameServer = gameServer;                  // The gameserver the plugin is connected to.
    this.pluginHandler = gameServer.pluginHandler; // The plugin handler the plugin is connected to.

    this.name = "Example Plugin";                  // Name of the plugin.
    this.description = "An example plugin.";       // Information about the plugin.
    this.author = "Everyone";                      // Author of the plugin.
    this.version = "1.0";                          // Version of the plugin.

    // Add plugin-specific variables as you wish.
    this.exampleValue = "Hello, World!";
}

module.exports = Plugin;

Plugin.prototype.start = function() {
    // Called when the server starts (after gamemode init).
    // For example, you can add commands:
    this.gameServer.pluginHandler.addCommand(
        'test', // The command name.
        function(gameServer, split) {       // What the command does. The function must have two arguments: gameServer and split.
            console.log("Hello World!");
        },                                  // You can add .bind(this) to use plugin-specific variables you added.
        "An example function",              // Optional - command description.
        ""                                  // Optional - command's accepted variables.
    );

    // You can signal that it's loaded:
    console.log("[Example plugin] Plugin loaded!");

    // You can also add custom gamemodes.
    // The plugin framework is currently under development so it can't manipulate the server directly.
    // In the future you'll be able to manipulate it under events that the server will call for you.
};
