// WebSocket message protocol for real-time editor sync

export type WsMessageType =
  | 'scene_update'      // blendshape/body params change
  | 'parts_update'      // equipped parts change
  | 'material_update'   // material override change
  | 'cursor_move'       // collaborator cursor position
  | 'selection_change'  // selected part/node change
  | 'sync_request'      // request full state from server
  | 'sync_response'     // server sends full state
  | 'join_room'         // client joins avatar editing room
  | 'leave_room'        // client leaves room
  | 'camera_update'     // camera position/rotation change
  | 'typing'            // IM typing indicator
  | 'llm_token'         // LLM streaming token
  | 'llm_done'          // LLM streaming complete
  | 'audio_chunk'       // TTS streaming audio chunk
  | 'pipeline_progress' // rigging pipeline progress
  | 'pipeline_complete' // rigging pipeline complete
  | 'pipeline_error'    // rigging pipeline error
  | 'error';            // server error message

export interface WsMessage {
  type: WsMessageType;
  avatarId: string;
  payload: Record<string, unknown>;
  senderId?: string;
  timestamp?: number;
}

export interface SceneState {
  blendShapes: Record<string, number>;
  bodyParams: Record<string, number>;
  equippedParts: Record<string, string>;
  materialOverrides: Record<string, { albedo: string; roughness: number; metallic: number }>;
  cameraTransform?: { position: [number, number, number]; rotation: [number, number, number, number] };
  selectedPartId?: string;
  selectedBoneName?: string;
  avatarName?: string;
}

export interface RoomInfo {
  avatarId: string;
  clients: Set<string>;
  lastState: SceneState | null;
  createdAt: number;
}
