function pickVelocity() {
  return [Math.random() - .5, Math.random() - .5];
}

function antiAFK(client) {
  client.on("update_health", function(data) {
    if (data.health <= 0 && client.enableAntiAFK) {
      client.write("client_command", { payload: 0 });
    }
  });

  const interval = setInterval(function() {
    if (client.ended) {
      clearInterval(interval);
      return;
    }

    if (!client.finishedQueue) { return; }

    let velocity = pickVelocity();
    let sneaking = false;
    let ticksRemaining = 0;

    if (client.enableAntiAFK) {

      if (ticksRemaining-- > 1) {

        ticksRemaining = 5;
        velocity = pickVelocity();

        client.write("look", {
          yaw: Math.random(),
          pitch: Math.random(),
          onGround: true
        });

        const willSneak = Math.random() > .7;

        if (willSneak) {
          velocity[0] = velocity[0] / 2;
          velocity[1] = velocity[1] / 2;
        }
        
        if (sneaking && !willSneak) {
          client.write("entity_action", {
            entityId: client.gameData.entityId,
            actionId: 1,
            jumpBoost: 0
          });
        } else if (willSneak && !sneaking) {
          client.write("entity_action", {
            entityId: client.gameData.entityId,
            actionId: 0,
            jumpBoost: 0
          });
        }

        sneaking = willSneak;
      }

      const willInteract = Math.random() > 0.91;

      if (willInteract) {
        const isPunch = Math.random() > .6;

        if (isPunch) {
          client.write("arm_animation", {
            hand: 0
          });
        } else {
          client.write("use_item", {
            hand: 0
          });
        }
      }

      lastEnabled = true;
      const newPos = [
        client.gameData.pos[0] + velocity[0],
        client.gameData.pos[1],
        client.gameData.pos[2] + velocity[1]
      ];

      client.write("position", {
        x: newPos[0],
        y: newPos[1],
        z: newPos[2],
        onGround: true
      });

      client.gameData.pos = newPos;
    } else if (sneaking) {

      client.write("entity_action", {
        entityId: client.gameData.entityId,
        actionId: 1,
        jumpBoost: 0
      });

    }

  }, 50 * 10);

}

module.exports = antiAFK;