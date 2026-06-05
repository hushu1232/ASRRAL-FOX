// WebSocket server — standalone server for real-time editor preview sync + IM
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { createLogger } from '@/lib/logger';
import { isRedisAvailable, getRedis } from '@/lib/redis/client';
import { verifyAccessToken } from '@/lib/auth/jwt';
import type { WsMessage, SceneState, RoomInfo } from './types';

const log = createLogger('ws');

const rooms = new Map<string, RoomInfo>();
const clientRooms = new Map<WebSocket, string>();

// IM: userId → Set<WebSocket>
const userClients = new Map<string, Set<WebSocket>>();

let wss: WebSocketServer | null = null;
const WS_PORT = parseInt(process.env.WS_PORT || '3001', 10);

const REDIS_CHANNEL_PREFIX = 'ws:editor:';

/** Published from Redis flag — prevents echo loop when receiving own publish */
const REDIS_ORIGIN = Symbol('redis-origin');

function getOrCreateRoom(avatarId: string): RoomInfo {
  if (!rooms.has(avatarId)) {
    rooms.set(avatarId, {
      avatarId,
      clients: new Set(),
      lastState: null,
      createdAt: Date.now(),
    });
  }
  return rooms.get(avatarId)!;
}

function broadcastLocal(room: RoomInfo, data: string, exclude?: WebSocket) {
  for (const [client, clientAvatarId] of clientRooms) {
    if (clientAvatarId === room.avatarId && client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

function broadcast(room: RoomInfo, message: WsMessage, exclude?: WebSocket, skipRedis = false) {
  const enriched = { ...message, timestamp: Date.now() };
  const data = JSON.stringify(enriched);

  broadcastLocal(room, data, exclude);

  // Publish to Redis for other instances (avoid echo by checking flag)
  if (!skipRedis && isRedisAvailable()) {
    try {
      const redisMessage = JSON.stringify({ ...enriched, [REDIS_ORIGIN.toString()]: true });
      getRedis().publish(REDIS_CHANNEL_PREFIX + room.avatarId, redisMessage).catch((err) => {
        log.warn({ err }, 'Failed to publish to Redis channel');
      });
    } catch (err) {
      log.warn({ err }, 'Redis publish error, falling back to local-only broadcast');
    }
  }
}

export function broadcastToUser(userId: string, payload: Record<string, unknown>) {
  const clients = userClients.get(userId);
  if (!clients || clients.size === 0) return;
  const data = JSON.stringify({ ...payload, timestamp: Date.now() });
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

function trackUserClient(ws: WebSocket, userId: string) {
  if (!userClients.has(userId)) {
    userClients.set(userId, new Set());
  }
  userClients.get(userId)!.add(ws);
  (ws as unknown as { _wsUserId?: string })._wsUserId = userId;
}

function untrackUserClient(ws: WebSocket) {
  const userId = (ws as unknown as { _wsUserId?: string })._wsUserId;
  if (userId) {
    const clients = userClients.get(userId);
    if (clients) {
      clients.delete(ws);
      if (clients.size === 0) userClients.delete(userId);
    }
  }
}

function handleMessage(ws: WebSocket, raw: string) {
  let msg: WsMessage;
  try {
    msg = JSON.parse(raw);
  } catch {
    ws.send(JSON.stringify({ type: 'error', avatarId: '', payload: { error: 'Invalid JSON' } }));
    return;
  }

  const room = rooms.get(msg.avatarId);
  if (!room && msg.type !== 'join_room') {
    ws.send(JSON.stringify({ type: 'error', avatarId: msg.avatarId, payload: { error: 'Room not found' } }));
    return;
  }

  switch (msg.type) {
    case 'join_room': {
      const r = getOrCreateRoom(msg.avatarId);
      r.clients.add(getClientId(ws));
      clientRooms.set(ws, msg.avatarId);

      // Send current state to joining client first (so sync_response arrives before join_room)
      if (r.lastState) {
        ws.send(JSON.stringify({ type: 'sync_response', avatarId: msg.avatarId, payload: r.lastState as unknown as Record<string, unknown>, timestamp: Date.now() }));
      }

      // Send join confirmation to the joining client
      ws.send(JSON.stringify({ type: 'join_room', avatarId: msg.avatarId, payload: { clientId: getClientId(ws), clientCount: r.clients.size }, timestamp: Date.now() }));

      // Notify other clients in the room
      broadcast(r, { type: 'join_room', avatarId: msg.avatarId, payload: { clientId: getClientId(ws), clientCount: r.clients.size } }, ws);
      break;
    }

    case 'leave_room': {
      if (room) {
        room.clients.delete(getClientId(ws));
        clientRooms.delete(ws);
        broadcast(room, { type: 'leave_room', avatarId: msg.avatarId, payload: { clientId: getClientId(ws), clientCount: room.clients.size } });
        if (room.clients.size === 0) {
          // Keep room alive for 30 min to preserve lastState
          setTimeout(() => {
            const r = rooms.get(msg.avatarId);
            if (r && r.clients.size === 0) rooms.delete(msg.avatarId);
          }, 30 * 60 * 1000);
        }
      }
      break;
    }

    case 'scene_update': {
      if (room) {
        const state = msg.payload as unknown as Partial<SceneState>;
        room.lastState = {
          ...(room.lastState || { blendShapes: {}, bodyParams: {}, equippedParts: {}, materialOverrides: {} }),
          ...state,
        };
        broadcast(room, msg, ws);
      }
      break;
    }

    case 'parts_update':
    case 'material_update':
    case 'camera_update':
    case 'cursor_move':
    case 'selection_change': {
      if (room) {
        broadcast(room, msg, ws);
      }
      break;
    }

    case 'sync_request': {
      if (room?.lastState) {
        ws.send(JSON.stringify({
          type: 'sync_response',
          avatarId: msg.avatarId,
          payload: room.lastState as unknown as Record<string, unknown>,
          timestamp: Date.now(),
        }));
      }
      break;
    }

    // IM message types
    case 'typing': {
      const wsUser = (ws as unknown as { _wsUserId?: string })._wsUserId;
      if (wsUser && msg.payload) {
        const { conversationId, toUserId } = msg.payload as Record<string, string>;
        broadcastToUser(toUserId, {
          type: 'typing',
          data: { conversationId, userId: wsUser },
        });
      }
      break;
    }

    default:
      break;
  }
}

let clientCounter = 0;
function getClientId(ws: WebSocket): string {
  const existing = (ws as unknown as { _wsClientId?: string })._wsClientId;
  if (existing) return existing;
  const id = `client_${++clientCounter}_${Date.now().toString(36)}`;
  (ws as unknown as { _wsClientId: string })._wsClientId = id;
  return id;
}

let redisSubscribed = false;

export function startWsServer(port?: number): WebSocketServer {
  if (wss) return wss;

  const actualPort = port || WS_PORT;
  wss = new WebSocketServer({ port: actualPort });

  // Redis Pub/Sub for multi-instance horizontal scaling
  if (isRedisAvailable() && !redisSubscribed) {
    try {
      const sub = getRedis().duplicate();
      sub.subscribe(REDIS_CHANNEL_PREFIX + '*', (err) => {
        if (err) {
          log.warn({ err }, 'Redis subscribe failed, running in local-only mode');
          return;
        }
        log.info('Redis Pub/Sub enabled — multi-instance sync active');
      });

      sub.on('message', (channel, raw) => {
        try {
          const msg = JSON.parse(raw) as WsMessage & { [REDIS_ORIGIN]?: boolean };
          const avatarId = channel.slice(REDIS_CHANNEL_PREFIX.length);
          const room = getOrCreateRoom(avatarId);
          broadcast(room, msg, undefined, true); // skipRedis = true to avoid echo
        } catch (err) {
          log.warn({ err, channel }, 'Failed to process Redis message');
        }
      });

      redisSubscribed = true;
    } catch (err) {
      log.warn({ err }, 'Redis not available, running in local-only mode');
    }
  }

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    // Extract auth token from URL query param for IM
    try {
      const url = new URL(req.url || '', `http://localhost:${WS_PORT}`);
      const token = url.searchParams.get('token');
      if (token) {
        const payload = verifyAccessToken(token);
        if (payload?.sub) {
          trackUserClient(ws, payload.sub);
        }
      }
    } catch { /* unauthenticated — editor-only mode */ }

    ws.on('message', (data: Buffer | string) => {
      const raw = typeof data === 'string' ? data : data.toString('utf-8');
      handleMessage(ws, raw);
    });

    ws.on('close', () => {
      const avatarId = clientRooms.get(ws);
      if (avatarId) {
        const room = rooms.get(avatarId);
        if (room) {
          room.clients.delete(getClientId(ws));
          broadcast(room, { type: 'leave_room', avatarId, payload: { clientId: getClientId(ws), clientCount: room.clients.size } });
        }
        clientRooms.delete(ws);
      }
      untrackUserClient(ws);
    });

    ws.on('error', (err) => {
      log.error({ err }, 'Client error');
    });
  });

  wss.on('listening', () => {
    log.info('WebSocket server running on ws://localhost:%s', actualPort);
  });

  wss.on('error', (err) => {
    log.error({ err }, 'Server error');
  });

  return wss;
}

export function stopWsServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!wss) { resolve(); return; }
    wss.close(() => {
      wss = null;
      rooms.clear();
      clientRooms.clear();
      resolve();
    });
  });
}

export function getRoomCount(): number {
  return rooms.size;
}

export function getClientCount(): number {
  return clientRooms.size;
}

// Stub — full WebSocket pipeline progress broadcasting will be wired in Phase 2
export function pushPipelineProgress(
  imageId: string,
  progress: { stage: string; percent: number; message: string; error?: string; result?: Record<string, unknown> },
) {
  const payload = { type: 'pipeline_progress', imageId, ...progress, timestamp: Date.now() };
  const data = JSON.stringify(payload);
  // Broadcast to all connected clients (future: filter by pipeline:{imageId} subscribers)
  rooms.forEach((room) => broadcastLocal(room, data));
}
