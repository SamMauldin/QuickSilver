const main = require("./index");
const mc = require("minecraft-protocol");
const util = require("util");
const importFresh = require("import-fresh");

const eidMap = importFresh("./modules/eidMap");
const chunkStorage = importFresh("./modules/chunkStorage");
const playerList = importFresh("./modules/playerList");
// const antiAFK = importFresh("./modules/antiAFK");

const Push = require("pushover-notifications");

const config = importFresh("./config");

const p = new Push(config.push);

function notify(msg) {
  p.send({
    message: msg
  }, function(err, res) {});
}

const log = main.log;
const connections = main.getConnections();

const state = {
  listeners: [],
  attached: {}
};

const server = mc.createServer({
  "online-mode": false,
  "max-players": 100,
  port: 25567,
  version: "1.12.2",
  encryption: true,
  motd: "QuickSilver Proxy Server"
});

log("Proxy module loaded");

function addListener(account, event, listener) {
  const emitter = connections[account];

  state.listeners.push({
    emitter: emitter,
    event: event,
    listener: listener
  });

  emitter.on(event, listener);
}

const keepConnectedInterval = setInterval(function() {
  let done = false;

  config.mc.forEach(acct => {
    if (done) { return; } // Throttle automatic connections

    if (acct.keepConnected && !connections[acct.username]) {

      connect(acct.username);
      // connections[acct.username].enableAntiAFK = true;
      done = true;

    }

  });
}, 1000 * 60);

function cleanup() {
  try {
    Object.keys(server.clients).forEach(k => {
      server.clients[k].end("QuickSilver reloading!");
    });
  } catch (e) {}

  try { server.close(); } catch (e) {}
  try { clearInterval(keepConnectedInterval); } catch (e) {}

  state.listeners.forEach(meta => {
    try {
      meta.emitter.removeListener(meta.event, meta.listener);
    } catch (e) { log("Error removing listener:", e); }
  });
}

module.exports.cleanup = cleanup;

function getLogin(account) {
  let found;

  config.mc.forEach(acct => {
    if (acct.username == account) {
      found = acct;
    }
  });

  if (!found) {
    throw "Attempted to resolve login for unknown account!";
  }

  return found;
}

function attach(pClient, account, authenticated) {
  if (state.attached[account]) {
    try { state.attached[account][0].end("Another user is attaching to this account!"); } catch (e) {}
  }

  const conn = connections[account];

  if (conn.gameData.entityId === undefined) {
    throw "Client has not recieved join info yet!";
  }

  state.attached[account] = [pClient, authenticated, eidMap(conn.gameData.entityId)];

  manipulateClient(pClient, conn.gameData);

  conn.write("position", { x: conn.gameData.pos[0], y: conn.gameData.pos[1], z: conn.gameData.pos[2], onGround: true });

  setTimeout(function() {
    conn.gameData.chunkStorage(pClient);
    conn.gameData.playerList(pClient);
  }, 1000 * 5);
}

function detach(account) {
  if (state.attached[account]) {
    const pClient = state.attached[account][0];
    delete state.attached[account];

    sendChatMessage(pClient, "You were detached!", "light_purple");
    manipulateClient(pClient, {
      dimension: 0,
      difficulty: 2,
      levelType: "default",
      gamemode: 3,
      pos: [0, 100, 0]
    });
  }
}

function setupListeners(account) {
  const conn = connections[account];
  conn.setMaxListeners(100);
  conn.gameData = conn.gameData || {};
  conn.gameData.pos = conn.gameData.pos || [0, 0, 0];
  conn.gameData.chunkStorage = conn.gameData.chunkStorage || chunkStorage(conn);
  conn.gameData.playerList = conn.gameData.playerList || playerList(conn);
  
  // if (!conn.gameData.antiAFK) { conn.gameData.antiAFK = true; antiAFK(conn); }

  addListener(account, "end", function() {
    if (state.attached[account]) {
      detach(account);
    }

    if (connections[account]) {
      delete connections[account];
    }

    log(`${account} end.`);
  });

  addListener(account, "disconnect", function(data) {
    if (state.attached[account]) {
      detach(account);
    }

    if (connections[account]) {
      delete connections[account];
    }

    log(`${account} disconnected: `, data);
  });

  addListener(account, "kick_disconnect", function(data) {
    if (state.attached[account]) {
      detach(account);
    }

    if (connections[account]) {
      delete connections[account];
    }

    log(`${account} kicked: `, data);
  });

  addListener(account, "error", function(err) {
    if (state.attached[account]) {
      detach(account);
    }

    if (connections[account]) {
      delete connections[account];
    }

    log(`${account} error: `, err);
  });

  addListener(account, "packet", function(data, meta) {

    if (meta.name == "position") {
      if (data.flags & 0x01) { conn.gameData.pos[0] += data.x; } else { conn.gameData.pos[0] = data.x; }
      if (data.flags & 0x02) { conn.gameData.pos[1] += data.y; } else { conn.gameData.pos[1] = data.y; }
      if (data.flags & 0x04) { conn.gameData.pos[2] += data.z; } else { conn.gameData.pos[2] = data.z; }

      conn.write("teleport_confirm", {
        teleportId: data.teleportId
      });
    }

    if (meta.name == "login") {
      conn.gameData.entityId = data.entityId;
      conn.gameData.gamemode = data.gameMode;
      conn.gameData.difficulty = data.difficulty;
      conn.gameData.dimension = data.dimension;
      conn.gameData.levelType = data.levelType;
    }

    if (meta.name == "respawn") {
      conn.gameData.dimension = data.dimension;

      if (state.attached[account]) {
        state.attached[account][0].dimension = data.dimension;
      }

      conn.gameData.difficulty = data.difficulty;
      conn.gameData.gamemode = data.gamemode;
      conn.gameData.levelType = data.levelType;
    }

    if (meta.name == "game_state_change" && data.gameMode !== undefined) {
      conn.gameData.gamemode = data.gameMode;
    }

    if (meta.name == "difficulty") {
      conn.gameData.difficulty = data.difficulty;
    }

    if (!conn.finishedQueue && meta.name == "chat") {
      const chatMessage = JSON.parse(data.message);
      if (chatMessage.text && chatMessage.text == "Connecting to the server...") {
        log(`${account} finished queue.`, true);
        notify(`${account} connected to 2b2t.`);
        conn.finishedQueue = true;
      }
    }

    if (!conn.finishedQueue && meta.name == "playerlist_header") {
      try {
        conn.queuePos = conn.queuePos || 0;

        const headermessage = JSON.parse(data.header);
        const fullMessage = headermessage.text.split("\n")[4].trim();
        
        if (fullMessage !== "§62b2t is full") {
          conn.finishedQueue = true;
          log(`${account} finished queue.`, true);
          notify(`${account} connected to 2b2t.`);
          return;
        }

        let newQueuePos = parseInt(headermessage.text.split("\n")[5].substring(25));
        conn.queueETA = headermessage.text.split("\n")[6].substring(27);
        if (conn.queuePos !== newQueuePos) {
          conn.queueUpdated = 0;

          for (let i = conn.queuePos - 1; i >= newQueuePos; i--) {
            if (i % 100 == 0 || i == 50 || i == 10) {
              log(`${account} is #${i} in queue.`);
              notify(`${account} is #${i} in queue.`);
            }
          }

          conn.queuePos = newQueuePos;
        }

        if (conn.queueUpdated !== undefined) {
          conn.queueUpdated++;

          if (conn.queueUpdated > 250) {
            client.write("chat", { "message": "/queue main" });
          } else if (conn.queueUpdated > 300) {
            log("Queue stuck, ending", account);
            client.end();
          }
        }
      } catch (e) {}
    }

    if (state.attached[account]) {
      state.attached[account][0].write(meta.name, state.attached[account][2](data, "client"));
    }

  });
}

Object.keys(connections).forEach(function(account) {
  log(`Reclaiming connection for ${account}...`);
  setupListeners(account);
});

function connect(account) {
  if (connections[account]) { return; }

  const login = getLogin(account);

  connections[account] = mc.createClient({
    username: login.username,
    password: login.password,
    version: "1.12.2",
    host: "2b2t.org"
  });

  log(`${account} connected.`);

  setupListeners(account);
}

function disconnect(account) {
  const conn = connections[account];

  if (state.attached[account]) {
    detach(account);
  }

  connections[account].end();

  delete connections[account];

}

function manipulateClient(pClient, gameData) {

  let sendToDimFirst = -1;

  if (pClient.dimension === -1) {
    sendToDimFirst = 1;
  }

  pClient.dimension = gameData.dimension;

  pClient.write("respawn", {
    dimension: sendToDimFirst,
    difficulty: gameData.difficulty,
    gamemode: gameData.gamemode,
    levelType: gameData.levelType
  });

  pClient.write("respawn", {
    dimension: gameData.dimension,
    difficulty: gameData.difficulty,
    gamemode: gameData.gamemode,
    levelType: gameData.levelType
  });

  pClient.write("position", {
    x: gameData.pos ? gameData.pos[0] : 0,
    y: gameData.pos ? gameData.pos[1] : 1.62,
    z: gameData.pos ? gameData.pos[2] : 0,
    yaw: 0,
    pitch: 0,
    flags: 0x00
  });

}

function sendChatMessage(pClient, chatMessage, color) {
  try {
    pClient.write("chat", {
      message: JSON.stringify([
          {
            text: "QS: ",
            color: "gray"
          },
          {
            text: chatMessage,
            color: color || "white"
          }
        ]),
      position: 0
    })
  } catch (e) {}
}

server.on("login", function(pClient) {
  log("New Client!");

  pClient.dimension = -1;

  let authenticated;
  let attached;

  pClient.write("login", {
    entityId: 0,
    levelType: "default",
    gameMode: 3,
    dimension: 0,
    difficulty: 2,
    maxPlayers: 225,
    reducedDebugInfo: false
  });

  pClient.write("position", {
    x: 0,
    y: 100,
    z: 0,
    yaw: 0,
    pitch: 0,
    flags: 0x00
  });

  sendChatMessage(pClient, "Welcome to QuickSilver! Please login with \"qs login [username] [password]\"", "light_purple");

  function resolveAccount(given) {
    const acctById = authenticated.accounts[parseInt(given)];
    const acctByString = authenticated.accounts.includes(given) ? given : null;
    const resolvedAccount = acctById || acctByString;

    return resolvedAccount;
  }

  pClient.on("packet", function(data, meta) {
    if (meta.name == "chat") {
      
      try {
        const cmd = data.message.split(" ");

        if (cmd[0] == "qs") {
          cmd.shift();

          if (cmd[0] == "login") {
            const username = (cmd[1] || "").toLowerCase();
            const password = (cmd[2] || "");
            
            if (config.auth[username] && config.auth[username].password == password) {
              authenticated = config.auth[username];
              authenticated.name = username;

              log(authenticated.name, "logged in")

              sendChatMessage(pClient, "Login successful!", "green");
              sendChatMessage(pClient, "Use 'qs help' to view available commands.");
            } else {
              sendChatMessage(pClient, "Login failed. Please try again.", "red");
              return;
            }

            return;
          }

          if (!authenticated) {
            sendChatMessage(pClient, "Unauthorized, please log in first.", "red");
            return;
          }
          
          // Authorized User

          if (cmd[0] == "list") {

            const accounts = [];

            sendChatMessage(pClient, "Available Accounts:", "aqua");

            authenticated.accounts.forEach(function(account, id) {

              let color = "red";
              let status = "Offline";

              if (connections[account]) {
                color = "green";
                status = "Online";

                if (state.attached[account]) {
                  status = `Attached by ${state.attached[account][1].name}`;
                }

                const conn = connections[account];
                if (!conn.finishedQueue) {
                  color = "yellow";
                  status = `#${conn.queuePos} - ETA: ${conn.queueETA}`;
                } else {
                  if (conn.gameData && conn.gameData.pos) {
                    status += ` (${Math.round(conn.gameData.pos[0])}, ${Math.round(conn.gameData.pos[2])}, ${conn.gameData.dimension})`;
                  }
                }

                // status += conn.enableAntiAFK ? "*" : "";
              }
              
              sendChatMessage(pClient, `[${id}] ${account} - ${status}`, color);

            });

            return;
          }

          if (cmd[0] == "attach") {

            const account = resolveAccount(cmd[1]);

            if (account) {

              if (connections[account]) {
                sendChatMessage(pClient, "Attaching...", "blue");

                if (attached) {
                  sendChatMessage(pClient, "You must detach first!", "red");
                  return;
                }
                
                attach(pClient, account, authenticated);
                attached = account;

                sendChatMessage(pClient, "Attached!", "light_purple");
              } else {
                sendChatMessage(pClient, "Attach failed, account is not connected.", "red");
              }
            } else {
              sendChatMessage(pClient, "Account not found.", "red");
            }

            return;
          }

          if (cmd[0] == "detach") {
            if (attached) {
              sendChatMessage(pClient, "Detached.", "light_purple");

              detach(attached);
              attached = undefined;

              return;
            }

            sendChatMessage(pClient, "You are not attached.", "blue");

            return;
          }

          if (cmd[0] == "connect") {
            const account = resolveAccount(cmd[1]);

            if (account) {
              if (!connections[account]) {

                connect(account);
                sendChatMessage(pClient, "Connection initiated.", "green");

              } else {
                sendChatMessage(pClient, "Account is already connected!", "red");
              }
            } else {
              sendChatMessage(pClient, "Account not found.", "red");
            }

            return;
          }

          if (cmd[0] == "disconnect") {
            const account = resolveAccount(cmd[1]);

            if (account) {
              if (connections[account]) {

                disconnect(account);
                sendChatMessage(pClient, "Disconnected.", "green");

              } else {
                sendChatMessage(pClient, "Account is not connected!", "red");
              }
            } else {
              sendChatMessage(pClient, "Account not found.", "red");
            }

            return;
          }

          /* 
          if (cmd[0] == "afk") {
            if (attached) {
              connections[attached].enableAntiAFK = true;
              sendChatMessage(pClient, "Anti AFK Enabled!", "green");
              return;
            }

            sendChatMessage(pClient, "You are not attached.", "blue");

            return;
          }
          */

          // Admin Commands

          if (authenticated.admin) {
            if (cmd[0] == "reload") {
              main.reload();
              return;
            }

            if (cmd[0] == "eval") {
              cmd.shift();
              try {
                sendChatMessage(pClient, `Result: ${util.inspect(eval(cmd.join(" ")))}`, "green");
              } catch (e) {
                sendChatMessage(pClient, `Error: ${util.inspect(e)}`, "red");
              }

              return;
            }
          }
          
          // Help Command

          sendChatMessage(pClient, "Available Commands: \n" + [
            "login [username] [password] - login",
            "list - List accounts that you can attach to",
            "attach [username / id] - attach to an account",
            "connect [username / id] - connect an account",
            "disconnect [username / id] - disconnect an account"
          ].join("\n"));

          return;

        }
      } catch (e) {
        log("Error evaluating command:", e);
        sendChatMessage(pClient, "Error evaluating command!");
      }

    }

    if (attached && state.attached[attached]) {
      if (state.attached[attached][0].id == pClient.id) {
        if (meta.name == "keep_alive") { return; }
        if (meta.name == "teleport_confirm") { return; }

        connections[attached].write(meta.name, state.attached[attached][2](data, "server"));
      }
    }

  });

  pClient.on("end", function(msg) {
    log("Client disconnected:", msg);
    if (attached && state.attached[attached]) {
      if (state.attached[attached][0].id == pClient.id) {
        detach(attached);
      }
    }
  });
});

function command(line) {
  if (line.trim() == "") { return; }
  
  try {
    log("Result:", eval(line))
  } catch(err) {
    log("Error evaluating:", err);
  }
}

module.exports.command = command;
