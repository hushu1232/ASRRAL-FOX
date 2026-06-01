// 分块上传会话管理 — 内存存储，用于追踪上传进度和断点续传
import { v4 as uuidv4 } from 'uuid';
import { getStorageAdapter } from './index';
import type { ChunkedUploadSession } from './types';

const sessions = new Map<string, ChunkedUploadSession>();

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB per chunk
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

function cleanupExpired() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL) {
      sessions.delete(id);
      const storage = getStorageAdapter();
      storage.abortChunkedUpload?.(id).catch(() => {});
    }
  }
}

function getSession(id: string): ChunkedUploadSession | undefined {
  return sessions.get(id);
}

function deleteSession(id: string) {
  sessions.delete(id);
}

export function createSession(params: {
  finalKey: string;
  fileSize: number;
  contentType: string;
  chunkSize?: number;
}): ChunkedUploadSession {
  const chunkSize = params.chunkSize || DEFAULT_CHUNK_SIZE;
  const totalChunks = Math.ceil(params.fileSize / chunkSize);

  const session: ChunkedUploadSession = {
    uploadId: uuidv4(),
    finalKey: params.finalKey,
    totalChunks,
    chunkSize,
    fileSize: params.fileSize,
    uploadedChunks: [],
    contentType: params.contentType,
    status: 'uploading',
    createdAt: Date.now(),
  };

  sessions.set(session.uploadId, session);

  // Periodic cleanup
  if (sessions.size % 10 === 0) {
    cleanupExpired();
  }

  return session;
}

export function recordChunk(uploadId: string, chunkIndex: number): ChunkedUploadSession | null {
  const session = sessions.get(uploadId);
  if (!session) return null;

  if (!session.uploadedChunks.includes(chunkIndex)) {
    session.uploadedChunks.push(chunkIndex);
  }
  return session;
}

export function getSessionStatus(uploadId: string): ChunkedUploadSession | undefined {
  return sessions.get(uploadId);
}

export { getSession, deleteSession, cleanupExpired };
