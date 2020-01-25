function chunkStorage(client) {
  let chunks = [];

  client.on("unload_chunk", function(data) {
    if (chunks[data.chunkX]) {
      delete chunks[data.chunkX][data.chunkZ];
    }
  });

  client.on("respawn", function() {
    chunks = [];
  });

  client.on("map_chunk", function(data) {
    chunks[data.x] = chunks[data.x] || [];
    chunks[data.x][data.z] = data;
  });

  return function(pClient) {

    Object.keys(chunks).forEach(function(x) {
      Object.keys(chunks[x]).forEach(function(z) {
        pClient.write("map_chunk", chunks[x][z]);
      });
    });

  }
}

module.exports = chunkStorage;