const TRYSTERO_URL = "https://esm.run/trystero@0.25.2";

export async function connectToRoom({
  appId,
  roomId,
  onPeerJoin,
  onPeerLeave,
  onPresence,
  onPulse,
  onError
}) {
  const { joinRoom, selfId } = await import(TRYSTERO_URL);

  const room = joinRoom({ appId }, roomId, {
    onJoinError(details) {
      onError?.(details?.error ?? new Error("Unable to join room."));
    }
  });

  const presenceAction = room.makeAction("presence");
  const pulseAction = room.makeAction("pulse");

  room.onPeerJoin = (peerId) => onPeerJoin?.(peerId);
  room.onPeerLeave = (peerId) => onPeerLeave?.(peerId);
  presenceAction.onMessage = (data, metadata) => {
    onPresence?.(metadata.peerId, data);
  };
  pulseAction.onMessage = (data, metadata) => {
    onPulse?.(metadata.peerId, data);
  };

  return {
    selfId,
    sendPresence(data) {
      return presenceAction.send(data).catch((error) => onError?.(error));
    },
    sendPulse(data) {
      return pulseAction.send(data).catch((error) => onError?.(error));
    },
    leave() {
      room.leave();
    }
  };
}
