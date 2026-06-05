'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { WsMessage, SceneState } from '@/lib/ws/types';

interface UseEditorSyncOptions {
  avatarId: string;
  enabled?: boolean;
  wsUrl?: string;
}

interface UseEditorSyncReturn {
  isConnected: boolean;
  clientCount: number;
  sendSceneUpdate: (state: Partial<SceneState>) => void;
  sendPartsUpdate: (equippedParts: Record<string, string>) => void;
  sendMaterialUpdate: (materialOverrides: Record<string, { albedo: string; roughness: number; metallic: number }>) => void;
  sendCameraUpdate: (position: [number, number, number], rotation: [number, number, number, number]) => void;
  sendCursorMove: (position: [number, number, number]) => void;
  sendSelectionChange: (partId?: string, boneName?: string) => void;
  lastRemoteState: SceneState | null;
  reconnect: () => void;
}

export function useEditorSync({
  avatarId,
  enabled = true,
  wsUrl,
}: UseEditorSyncOptions): UseEditorSyncReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [clientCount, setClientCount] = useState(0);
  const [lastRemoteState, setLastRemoteState] = useState<SceneState | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const connect = useCallback(() => {
    if (!enabled || !avatarId) return;

    const url = wsUrl || `ws://localhost:${process.env.NEXT_PUBLIC_WS_PORT || '3001'}`;
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setIsConnected(true);
      wsRef.current = ws;

      // Join editing room
      ws.send(JSON.stringify({
        type: 'join_room',
        avatarId,
        payload: {},
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data as string);
        switch (msg.type) {
          case 'sync_response':
            setLastRemoteState(msg.payload as unknown as SceneState);
            break;
          case 'scene_update':
            setLastRemoteState((prev) => ({ ...prev, ...(msg.payload as unknown as Partial<SceneState>) } as SceneState));
            break;
          case 'join_room':
          case 'leave_room':
            if (typeof msg.payload.clientCount === 'number') {
              setClientCount(msg.payload.clientCount);
            }
            break;
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
      // Auto-reconnect after 3s
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [avatarId, enabled, wsUrl]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const send = useCallback((type: string, payload: Record<string, unknown>) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type, avatarId, payload }));
  }, [avatarId]);

  const sendSceneUpdate = useCallback((state: Partial<SceneState>) => {
    send('scene_update', state as unknown as Record<string, unknown>);
  }, [send]);

  const sendPartsUpdate = useCallback((equippedParts: Record<string, string>) => {
    send('parts_update', { equippedParts });
  }, [send]);

  const sendMaterialUpdate = useCallback((materialOverrides: Record<string, { albedo: string; roughness: number; metallic: number }>) => {
    send('material_update', { materialOverrides });
  }, [send]);

  const sendCameraUpdate = useCallback((position: [number, number, number], rotation: [number, number, number, number]) => {
    send('camera_update', { cameraTransform: { position, rotation } });
  }, [send]);

  const sendCursorMove = useCallback((position: [number, number, number]) => {
    send('cursor_move', { position });
  }, [send]);

  const sendSelectionChange = useCallback((partId?: string, boneName?: string) => {
    send('selection_change', { selectedPartId: partId, selectedBoneName: boneName });
  }, [send]);

  return {
    isConnected,
    clientCount,
    sendSceneUpdate,
    sendPartsUpdate,
    sendMaterialUpdate,
    sendCameraUpdate,
    sendCursorMove,
    sendSelectionChange,
    lastRemoteState,
    reconnect: connect,
  };
}
