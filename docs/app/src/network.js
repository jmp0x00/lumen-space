import { NETWORK_CONFIG } from "./config.js";

export async function connectToRoom({
  appId,
  roomId,
  onPeerJoin,
  onPeerLeave,
  onHello,
  onPresence,
  onEvent,
  onError
}) {
  const { joinRoom, selfId } = await import(NETWORK_CONFIG.trysteroUrl);

  const room = joinRoom({ appId }, roomId, {
    onJoinError(details) {
      onError?.(details?.error ?? new Error("Unable to join room."));
    }
  });

  const helloAction = room.makeAction("hello");
  const presenceAction = room.makeAction("presence");
  const eventAction = room.makeAction("event");

  room.onPeerJoin = (peerId) => onPeerJoin?.(peerId);
  room.onPeerLeave = (peerId) => onPeerLeave?.(peerId);
  helloAction.onMessage = (data, metadata) => {
    onHello?.(metadata.peerId, data);
  };
  presenceAction.onMessage = (data, metadata) => {
    onPresence?.(metadata.peerId, data);
  };
  eventAction.onMessage = (data, metadata) => {
    onEvent?.(metadata.peerId, data);
  };

  return {
    selfId,
    sendHello(data) {
      return helloAction.send(data).catch((error) => onError?.(error));
    },
    sendPresence(data) {
      return presenceAction.send(data).catch((error) => onError?.(error));
    },
    sendEvent(data) {
      return eventAction.send(data).catch((error) => onError?.(error));
    },
    leave() {
      room.leave();
    }
  };
}
