function playerList(client) {
  let playerList = {};

  client.on("player_info", function(packet) {
    packet.data.forEach(function(item) {
      if (!item.UUID) { return; }
      if (packet.action == 4) {
        delete playerList[item.UUID];
      } else {
        playerList[item.UUID] = playerList[item.UUID] || {};

        Object.keys(item).forEach(key => {
          playerList[item.UUID][key] = item[key];
        });
      }
    });
  });

  return function(pClient) {

    const list = [];

    Object.keys(playerList).forEach(function(uuid) {
      const item = playerList[uuid];
      if (item.name === undefined) { return; }
      if (item.gamemode === undefined) { return; }
      if (item.ping === undefined) { return; }
      if (item.displayName === undefined) { return; }
      if (item.properties === undefined) { return; }
      list.push(item);
    });

    pClient.write("player_info", {
      action: 0,
      data: list
    });

  };
}

module.exports = playerList;