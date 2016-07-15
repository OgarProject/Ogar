'use strict';
/*
 * Simple logger.
 *
 * Copyright (c) 2016 Barbosik https://github.com/Barbosik
 * License: Apache License, Version 2.0
 *
 */

var fs = require("fs");
var util = require('util');
var EOL = require('os').EOL;
var LogLevelEnum = require('../enum/LogLevelEnum');


module.exports.debug = debug;
module.exports.info = info;
module.exports.warn = warn;
module.exports.error = error;
module.exports.fatal = fatal;
module.exports.print = print;
module.exports.write = write;
module.exports.writeDebug = writeDebug;
module.exports.writeError = writeError;
module.exports.start = start;
module.exports.shutdown = shutdown;
module.exports.setVerbosity = function (level) {
    logVerbosity = level;
};
module.exports.setFileVerbosity = function (level) {
    logFileVerbosity = level;
};
module.exports.getVerbosity = function () {
    return logVerbosity;
};
module.exports.getFileVerbosity = function () {
    return logFileVerbosity;
};


var logVerbosity = LogLevelEnum.DEBUG;
var logFileVerbosity = LogLevelEnum.DEBUG;

function debug(message) {
    writeCon(colorWhite, LogLevelEnum.DEBUG, message);
    writeLog(LogLevelEnum.DEBUG, message);
};

function info(message) {
    writeCon(colorWhite + colorBright, LogLevelEnum.INFO, message);
    writeLog(LogLevelEnum.INFO, message);
};

function warn(message) {
    writeCon(colorYellow + colorBright, LogLevelEnum.WARN, message);
    writeLog(LogLevelEnum.WARN, message);
};

function error(message) {
    writeCon(colorRed + colorBright, LogLevelEnum.ERROR, message);
    writeLog(LogLevelEnum.ERROR, message);
};

function fatal(message) {
    writeCon(colorRed + colorBright, LogLevelEnum.FATAL, message);
    writeLog(LogLevelEnum.FATAL, message);
};

function print(message) {
    writeCon(colorWhite, LogLevelEnum.NONE, message);
    writeLog(LogLevelEnum.NONE, message);
};

function write(message) {
    writeLog(LogLevelEnum.NONE, message);
};

function writeDebug(message) {
    writeLog(LogLevelEnum.DEBUG, message);
};

function writeError(message) {
    writeLog(LogLevelEnum.ERROR, message);
};


// --- utils ---

function getDateTimeString() {
    var date = new Date();
    var dy = date.getFullYear();
    var dm = date.getMonth() + 1;
    var dd = date.getDate();
    var th = date.getHours();
    var tm = date.getMinutes();
    var ts = date.getSeconds();
    var tz = date.getMilliseconds();
    dy = ("0000" + dy).slice(-4);
    dm = ("00" + dm).slice(-2);
    dd = ("00" + dd).slice(-2);
    th = ("00" + th).slice(-2);
    tm = ("00" + tm).slice(-2);
    ts = ("00" + ts).slice(-2);
    tz = ("000" + tz).slice(-3);
    return dy + "-" + dm + "-" + dd + "T" + th + "-" + tm + "-" + ts + "-" + tz;
};

function getTimeString() {
    var date = new Date();
    var th = date.getHours();
    var tm = date.getMinutes();
    var ts = date.getSeconds();
    th = ("00" + th).slice(-2);
    tm = ("00" + tm).slice(-2);
    ts = ("00" + ts).slice(-2);
    return th + ":" + tm + ":" + ts;
};

function writeCon(color, level, message) {
    if (level > logVerbosity) return;
    message = util.format(message);
    var prefix = "";
    if (level == LogLevelEnum.DEBUG)
        prefix = "[DEBUG] ";
    else if (level == LogLevelEnum.INFO)
        prefix = "[INFO ] ";
    else if (level == LogLevelEnum.WARN)
        prefix = "[WARN ] ";
    else if (level == LogLevelEnum.ERROR)
        prefix = "[ERROR] ";
    else if (level == LogLevelEnum.FATAL)
        prefix = "[FATAL] ";
    process.stdout.write(color + prefix + message + "\u001B[0m" + EOL);
};

function writeLog(level, message) {
    if (level > logFileVerbosity || writeError)
        return;
    message = util.format(message);
    var prefix = "";
    if (level == LogLevelEnum.DEBUG)
        prefix = "[DEBUG]";
    else if (level == LogLevelEnum.INFO)
        prefix = "[INFO ]";
    else if (level == LogLevelEnum.WARN)
        prefix = "[WARN ]";
    else if (level == LogLevelEnum.ERROR)
        prefix = "[ERROR]";
    else if (level == LogLevelEnum.FATAL)
        prefix = "[FATAL]";
    else if (level == LogLevelEnum.NONE)
        prefix = "[NONE ]";
    prefix += "[" + getTimeString() + "] ";
    
    writeQueue.push(prefix + message + EOL);
    if (writeShutdown) {
        flushSync();
    } else {
        if (writeCounter == 0) {
            flushAsync();
        }
    }
};

var writeError = false;
var writeCounter = 0;
var writeShutdown = false;
var writeStarted = false;
var writeQueue = [];

function flushAsync() {
    if (writeShutdown || consoleLog == null || writeQueue.length == 0)
        return;
    writeCounter++;
    consoleLog.write(writeQueue.shift(), function () { writeCounter--; flushAsync(); });
};

function flushSync() {
    try {
        var tail = "";
        while (writeQueue.length > 0) {
            tail += writeQueue.shift();
        }
        var fileName = logFolder + "/" + logFileName + ".log";
        fs.appendFileSync(fileName, tail);
    } catch (err) {
        writeError = true;
        writeCon(colorRed + colorBright, LogLevelEnum.ERROR, err.message);
        writeCon(colorRed + colorBright, LogLevelEnum.ERROR, "Failed to append log file!");
    }
};

function start() {
    if (writeStarted)
        return;
    writeStarted = true;
    try {
        console.log = function (message) { print(message); };
        
        var timeString = getDateTimeString();
        var fileName = logFolder + "/" + logFileName + ".log";
        var fileName2 = logBackupFolder + "/" + logFileName + "-" + timeString + ".log";
        
        if (!fs.existsSync(logFolder)) {
            // Make log folder
            fs.mkdirSync(logFolder);
        } else if (fs.existsSync(fileName)) {
            if (!fs.existsSync(logBackupFolder)) {
                // Make log backup folder
                fs.mkdirSync(logBackupFolder);
            }
            // Backup previous log
            fs.renameSync(fileName, fileName2);
        }
        
        fs.writeFileSync(fileName, "=== Started " + timeString + " ===" + EOL);
        var file = fs.createWriteStream(fileName, { flags: 'a' });
        file.on('open', function () {
            if (writeShutdown) {
                file.close();
                return;
            }
            consoleLog = file;
            flushAsync();
        });
        file.on('error', function (err) {
            writeError = true;
            consoleLog = null;
            writeCon(colorRed + colorBright, LogLevelEnum.ERROR, err.message);
        });
    } catch (err) {
        writeError = true;
        consoleLog = null;
        writeCon(colorRed + colorBright, LogLevelEnum.ERROR, err.message);
    }
}

function shutdown() {
    writeShutdown = true;
    if (writeError) return;
    if (consoleLog != null) {
        consoleLog.end();
        consoleLog.close();
        consoleLog.destroy();
        consoleLog = null;
    }
    writeQueue.push("=== Shutdown " + getDateTimeString() + " ===" + EOL);
    flushSync();
};


var logFolder = "./logs";
var logBackupFolder = "./logs/LogBackup";
var logFileName = "MultiOgar";

var consoleLog = null;
var colorBlack = "\u001B[30m";
var colorRed = "\u001B[31m";
var colorGreen = "\u001B[32m";
var colorYellow = "\u001B[33m";
var colorBlue = "\u001B[34m";
var colorMagenta = "\u001B[35m";
var colorCyan = "\u001B[36m";
var colorWhite = "\u001B[37m";
var colorBright = "\u001B[1m";
