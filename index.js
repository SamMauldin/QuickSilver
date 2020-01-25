const dateFormat = require("dateformat");
const util = require("util");
const repl = require("repl");
const importFresh = require("import-fresh");

function log() {
  const logMsg = [`[${dateFormat()}]`];

  [].forEach.call(arguments, arg => {
    if (typeof arg == "string") {
      logMsg.push(arg);
    } else {
      logMsg.push(util.inspect(arg));
    }
  })

  console.log(logMsg.join(" "));
}

module.exports.log = log;

log("Welcome to QuickSilver!");

process.on("error", function(err) {
  log("Uncaught error: ", err);
});

const connections = {};

function getConnections() {
  return connections;
}

module.exports.getConnections = getConnections;

function setConnections(conns) {
  connections = conns;
}

module.exports.setConnections = setConnections;

let proxy = require("./proxy");

function reload() {
  log("Reloading...");

  proxy.cleanup();
  
  proxy = importFresh("./proxy");
  log("Reloaded!");
}

module.exports.reload = reload;

process.on("uncaughtException", function(err) {
  log("Uncaught error: ", err);
});

const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "> "
});

rl.prompt();

rl.on("line", line => {
  line = line.trim();

  if (line == "reload") {
    reload();
  } else if (line == "stop") {
    log("Closing server.");
    process.exit(0);
  } else {
    proxy.command(line);
  }

  rl.prompt();
});
