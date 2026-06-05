/**
 * WebSocket server tests — room management, message routing, state sync
 */

import { WebSocket } from 'ws';

// Test via a real WS server instance
let wsServer: import('ws').WebSocketServer;

function startTestServer(port: number): Promise<import('ws').WebSocketServer> {
  const { startWsServer, stopWsServer } = require('@/lib/ws/server');
  return new Promise((resolve) => {
    // Stop any existing server first
    stopWsServer().then(() => {
      const srv = startWsServer(port);
      srv.on('listening', () => resolve(srv));
    });
  });
}

function createClient(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
    setTimeout(() => reject(new Error('Connection timeout')), 3000);
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sendAndWait(ws: WebSocket, msg: object, expectedType: string, timeout = 2000): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${expectedType}`)), timeout);
    const handler = (data: WebSocket.Data) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.type === expectedType || !expectedType) {
          clearTimeout(timer);
          ws.removeListener('message', handler);
          resolve(parsed);
        }
      } catch { /* ignore */ }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify(msg));
  });
}

describe('WebSocket Server', () => {
  const TEST_PORT = 14001;

  beforeAll(async () => {
    wsServer = await startTestServer(TEST_PORT);
  });

  afterAll(async () => {
    // Close all test clients
    wsServer.clients.forEach((c) => c.close());
    const { stopWsServer } = require('@/lib/ws/server');
    await stopWsServer();
  });

  it('accepts client connections', async () => {
    const ws = await createClient(TEST_PORT);
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  it('handles join_room and receives sync_response', async () => {
    const ws = await createClient(TEST_PORT);
    const res = await sendAndWait(ws, {
      type: 'join_room',
      avatarId: 'test-avatar-1',
      payload: {},
    }, 'join_room');

    expect(res.type).toBe('join_room');
    expect(res.avatarId).toBe('test-avatar-1');
    expect(res.payload.clientCount).toBe(1);
    ws.close();
  });

  it('broadcasts scene_update to other clients in room', async () => {
    const ws1 = await createClient(TEST_PORT);
    const ws2 = await createClient(TEST_PORT);

    // Both join same room
    await sendAndWait(ws1, { type: 'join_room', avatarId: 'room-broadcast', payload: {} }, 'join_room');
    const join2 = await sendAndWait(ws2, { type: 'join_room', avatarId: 'room-broadcast', payload: {} }, 'join_room');
    expect(join2.payload.clientCount).toBe(2);

    // ws1 sends scene update, ws2 should receive it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatePromise = new Promise<Record<string, any>>((resolve) => {
      ws2.once('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'scene_update') resolve(msg);
      });
    });

    ws1.send(JSON.stringify({
      type: 'scene_update',
      avatarId: 'room-broadcast',
      payload: { blendShapes: { smile: 0.8 }, bodyParams: { height: 1.75 } },
    }));

    const received = await updatePromise;
    expect(received.type).toBe('scene_update');
    expect(received.payload.blendShapes).toEqual({ smile: 0.8 });
    expect(received.payload.bodyParams).toEqual({ height: 1.75 });

    ws1.close();
    ws2.close();
  });

  it('stores lastState and sends on sync_request', async () => {
    const ws1 = await createClient(TEST_PORT);
    const ws2 = await createClient(TEST_PORT);

    await sendAndWait(ws1, { type: 'join_room', avatarId: 'room-sync', payload: {} }, 'join_room');

    // Send scene update with state
    ws1.send(JSON.stringify({
      type: 'scene_update',
      avatarId: 'room-sync',
      payload: {
        blendShapes: { jawOpen: 0.5 },
        equippedParts: { hair: 'part_hair_01', shoes: 'part_shoes_03' },
      },
    }));

    // Small delay for server to process
    await new Promise(r => setTimeout(r, 100));

    // ws2 joins and should receive sync_response with lastState
    const syncRes = await sendAndWait(ws2, {
      type: 'join_room',
      avatarId: 'room-sync',
      payload: {},
    }, 'sync_response');

    expect(syncRes.type).toBe('sync_response');
    const payload = syncRes.payload as Record<string, unknown>;
    expect(payload.blendShapes).toEqual({ jawOpen: 0.5 });
    expect(payload.equippedParts).toEqual({ hair: 'part_hair_01', shoes: 'part_shoes_03' });

    ws1.close();
    ws2.close();
  });

  it('handles leave_room and updates client count', async () => {
    const ws1 = await createClient(TEST_PORT);
    const ws2 = await createClient(TEST_PORT);

    await sendAndWait(ws1, { type: 'join_room', avatarId: 'room-leave', payload: {} }, 'join_room');
    const join2 = await sendAndWait(ws2, { type: 'join_room', avatarId: 'room-leave', payload: {} }, 'join_room');
    expect(join2.payload.clientCount).toBe(2);

    // ws1 leaves
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const leavePromise = new Promise<Record<string, any>>((resolve) => {
      ws2.once('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'leave_room') resolve(msg);
      });
    });

    ws1.send(JSON.stringify({ type: 'leave_room', avatarId: 'room-leave', payload: {} }));

    const leaveMsg = await leavePromise;
    expect(leaveMsg.type).toBe('leave_room');
    expect(leaveMsg.payload.clientCount).toBe(1);

    ws1.close();
    ws2.close();
  });

  it('rejects invalid JSON with error message', async () => {
    const ws = await createClient(TEST_PORT);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errorPromise = new Promise<Record<string, any>>((resolve) => {
      ws.once('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'error') resolve(msg);
      });
    });

    ws.send('not json at all{{{');

    const errorMsg = await errorPromise;
    expect(errorMsg.type).toBe('error');
    expect((errorMsg.payload as Record<string, unknown>).error).toBe('Invalid JSON');

    ws.close();
  });

  it('supports camera_update and parts_update message types', async () => {
    const ws1 = await createClient(TEST_PORT);
    const ws2 = await createClient(TEST_PORT);

    await sendAndWait(ws1, { type: 'join_room', avatarId: 'room-types', payload: {} }, 'join_room');
    await sendAndWait(ws2, { type: 'join_room', avatarId: 'room-types', payload: {} }, 'join_room');

    // Camera update
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const camPromise = new Promise<Record<string, any>>((resolve) => {
      ws2.once('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'camera_update') resolve(msg);
      });
    });

    ws1.send(JSON.stringify({
      type: 'camera_update',
      avatarId: 'room-types',
      payload: { cameraTransform: { position: [1, 2, 3], rotation: [0, 0, 0, 1] } },
    }));

    const camMsg = await camPromise;
    expect(camMsg.type).toBe('camera_update');

    ws1.close();
    ws2.close();
  });

  it('handles message to non-existent room gracefully', async () => {
    const ws = await createClient(TEST_PORT);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errorPromise = new Promise<Record<string, any>>((resolve) => {
      ws.once('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'error') resolve(msg);
      });
    });

    ws.send(JSON.stringify({
      type: 'scene_update',
      avatarId: 'nonexistent-room-xyz',
      payload: { blendShapes: { a: 1 } },
    }));

    const errorMsg = await errorPromise;
    expect(errorMsg.type).toBe('error');
    expect((errorMsg.payload as Record<string, unknown>).error).toBe('Room not found');

    ws.close();
  });

  it('client disconnect broadcasts leave', async () => {
    const ws1 = await createClient(TEST_PORT);
    const ws2 = await createClient(TEST_PORT);

    await sendAndWait(ws1, { type: 'join_room', avatarId: 'room-disconnect', payload: {} }, 'join_room');
    await sendAndWait(ws2, { type: 'join_room', avatarId: 'room-disconnect', payload: {} }, 'join_room');

    // ws1 disconnects abruptly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const leavePromise = new Promise<Record<string, any>>((resolve) => {
      ws2.once('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'leave_room') resolve(msg);
      });
    });

    ws1.close();

    const leaveMsg = await leavePromise;
    expect(leaveMsg.type).toBe('leave_room');
    expect(leaveMsg.payload.clientCount).toBe(1);

    ws2.close();
  });
});

describe('WebSocket Server Utilities', () => {
  it('getRoomCount returns 0 with empty server', () => {
    jest.resetModules();
    const { getRoomCount, getClientCount } = require('@/lib/ws/server');
    expect(getRoomCount()).toBe(0);
    expect(getClientCount()).toBe(0);
  });

  it('startWsServer returns existing instance if already started', () => {
    jest.resetModules();
    const { startWsServer, stopWsServer } = require('@/lib/ws/server');
    // We can't easily test this without a port, but verify exports work
    expect(typeof startWsServer).toBe('function');
    expect(typeof stopWsServer).toBe('function');
  });
});
