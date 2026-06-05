export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { getStorageAdapter } from '@/lib/storage';
import { getSessionStatus, deleteSession } from '@/lib/storage/chunked-upload';

// GET /api/assets/upload/[uploadId] — 查询上传进度和断点续传信息
export const GET = withAuth(async (req, _user) => {
  const uploadId = req.nextUrl.pathname.split('/').filter(Boolean).at(-1) || '';

  if (!uploadId || uploadId === 'upload') {
    return NextResponse.json({ success: false, error: '缺少 uploadId' }, { status: 400 });
  }

  const session = getSessionStatus(uploadId);
  if (!session) {
    return NextResponse.json({ success: false, error: '上传会话不存在或已过期' }, { status: 404 });
  }

  // 同步获取存储层已持久化的分块
  const storage = getStorageAdapter();
  let persistedChunks: number[] = session.uploadedChunks;
  if (storage.getUploadedChunks) {
    persistedChunks = await storage.getUploadedChunks(uploadId);
  }

  const missingChunks = [];
  for (let i = 0; i < session.totalChunks; i++) {
    if (!persistedChunks.includes(i)) missingChunks.push(i);
  }

  return NextResponse.json({
    success: true,
    data: {
      uploadId: session.uploadId,
      totalChunks: session.totalChunks,
      chunkSize: session.chunkSize,
      fileSize: session.fileSize,
      uploadedChunks: persistedChunks.length,
      missingChunks,
      progress: Math.round((persistedChunks.length / session.totalChunks) * 100),
      status: session.status,
      createdAt: session.createdAt,
    },
  });
});

// DELETE /api/assets/upload/[uploadId] — 取消/中止上传
export const DELETE = withAuth(async (req, _user) => {
  const uploadId = req.nextUrl.pathname.split('/').filter(Boolean).at(-1) || '';

  if (!uploadId || uploadId === 'upload') {
    return NextResponse.json({ success: false, error: '缺少 uploadId' }, { status: 400 });
  }

  const storage = getStorageAdapter();
  if (storage.abortChunkedUpload) {
    await storage.abortChunkedUpload(uploadId);
  }

  deleteSession(uploadId);

  return NextResponse.json({ success: true, data: { message: '上传已取消' } });
});
