function newConnection(sEID) {
  const serverMappings = [];
  let lastServerID = 1;
  const clientMappings = [];
  let lastClientID = 1;

  serverMappings[0] = sEID; // Key is from client, value is to server
  clientMappings[sEID] = 0; // Key is to server, value is to client

  function assignNew(type) {
    let last = 0;

    if (type == "client") {
      last = lastClientID;
    }

    if (type == "server") {
      last = lastServerID
    }

    for (let i = last; i < 4294967296; i++) {
      if (type == "client") {
        if (!serverMappings[i] && serverMappings[i] !== 0) {
          lastClientID = i;
          return i;
        }
      }

      if (type == "server") {
        if (!clientMappings[i] && clientMappings[i] !== 0) {
          lastServerID = i;
          return i;
        }
      }
    }

    throw "Unable to assign new entity ID!";
  }

  function getOther(eid, direction) {
    if (direction == "server") {
      if (serverMappings[eid] !== undefined) {
        return serverMappings[eid];
      } else {
        const assigned = assignNew(direction);
        serverMappings[assigned] = eid;
        clientMappings[eid] = assigned;
        return assigned;
      }
    }

    if (direction == "client") {
      if (clientMappings[eid] !== undefined) {
        return clientMappings[eid];
      } else {
        const assigned = assignNew(direction);
        clientMappings[eid] = assigned;
        serverMappings[assigned] = eid;
        return assigned;
      }
    }

  }

  const fieldNames = ["entityId", "vehicleId", "collectedEntityId", "collectorEntityId", "playerId"];

  return function(packet, direction) {

    if (packet.entityId) {
      packet.entityId = getOther(packet.entityId, direction);
    }

    if (packet.vehicleId) {
      packet.vehicleId = getOther(packet.vehicleId, direction);
    }

    if (packet.collectedEntityId) {
      packet.collectedEntityId = getOther(packet.collectedEntityId, direction);
    }
    
    if (packet.entityIds) {
      packet.entityIds.forEach(function(v, k) {
        packet.entityIds[k] = getOther(v, direction);
      });
    }

    return packet;
  }
}

module.exports = newConnection;