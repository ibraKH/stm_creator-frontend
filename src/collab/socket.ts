import { io, type Socket } from 'socket.io-client';

import { API_BASE } from '../app/auth/api';

export type OnlineUser = {
  userId: number;
  email: string;
  role: string;
  color: string;
};

export type PresenceSyncPayload = {
  users: OnlineUser[];
};

export type PresenceJoinPayload = {
  user: OnlineUser;
};

export type PresenceLeavePayload = {
  userId: number;
};

export type CursorMovePayload = {
  userId: number;
  color: string;
  x: number;
  y: number;
};

export type ViewportUpdatePayload = {
  userId: number;
  x: number;
  y: number;
  zoom: number;
};

type ServerToClientEvents = {
  'presence:sync': (payload: PresenceSyncPayload) => void;
  'presence:join': (payload: PresenceJoinPayload) => void;
  'presence:leave': (payload: PresenceLeavePayload) => void;
  'cursor:move': (payload: CursorMovePayload) => void;
  'viewport:update': (payload: ViewportUpdatePayload) => void;
  'error:validation': (payload: { message?: string }) => void;
};

type ClientToServerEvents = {
  'room:join': (payload: { modelName: string }) => void;
  'cursor:move': (payload: { modelName: string; x: number; y: number }) => void;
  'viewport:update': (payload: { modelName: string; x: number; y: number; zoom: number }) => void;
};

type CollabSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

type ConnectOptions = {
  token: string;
  modelName: string;
};

let socket: CollabSocket | null = null;
let socketToken: string | null = null;
let joinedModelName: string | null = null;

function getCollabUrl(): string {
  const envUrl = (import.meta as any).env?.VITE_COLLAB_URL as string | undefined;
  return envUrl?.trim() || API_BASE;
}

function ensureSocket(token: string): CollabSocket {
  if (socket && socketToken === token) {
    return socket;
  }

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }

  socket = io(getCollabUrl(), {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    auth: { token },
  });
  socketToken = token;
  joinedModelName = null;

  socket.on('connect_error', (error) => {
    console.error('[collab] socket connection failed:', error.message);
  });

  socket.on('error:validation', (payload) => {
    console.error('[collab] validation error:', payload?.message || 'unknown validation error');
  });

  return socket;
}

function joinCurrentModel(activeSocket: CollabSocket, modelName: string): void {
  if (!modelName || joinedModelName === modelName) {
    return;
  }

  activeSocket.emit('room:join', { modelName });
  joinedModelName = modelName;
}

export function connectCollabSocket(options: ConnectOptions): CollabSocket {
  const activeSocket = ensureSocket(options.token);

  if (!activeSocket.connected) {
    activeSocket.connect();
  }

  if (activeSocket.connected) {
    joinCurrentModel(activeSocket, options.modelName);
  } else {
    activeSocket.off('connect', handleConnectJoin);
    activeSocket.on('connect', handleConnectJoin);
  }

  function handleConnectJoin() {
    joinCurrentModel(activeSocket, options.modelName);
  }

  return activeSocket;
}

export function disconnectCollabSocket(): void {
  if (!socket) {
    return;
  }

  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  socketToken = null;
  joinedModelName = null;
}

export function getCollabSocket(): CollabSocket | null {
  return socket;
}
