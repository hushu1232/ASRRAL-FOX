export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { getStorageAdapter } from '@/lib/storage';
import { getSession, recordChunk } from '@/lib/storage/chunked-upload';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:upload-chunk');

export const POST = withAuth(async (req, _user) => {
  try {
    const uploadId = req.nextUrl.pathname.split('/').filter(Boolean).at(-2) || '';

    if (!uploadId || uploadId === 'upload') {
      return NextResponse.json({ success: false, error: '缺少 uploadId' }, { status: 400 });
    }

    const session = getSession(uploadId);
    if (!session) {
      return NextResponse.json({ success: false, error: '上传会话不存在或已过期' }, { status: 404 });
    }

    if (session.status !== 'uploading') {
      return NextResponse.json({ success: false, error: `上传会话状态异常: ${session.status}` }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get('chunk') as File | null;
    const chunkIndexStr = formData.get('chunkIndex') as string | null;

    if (!file || chunkIndexStr === null) {
      return NextResponse.json({ success: false, error: '缺少分块数据或索引' }, { status: 400 });
    }

    const chunkIndex = parseInt(chunkIndexStr, 10);
    if (isNaN(chunkIndex) || chunkIndex < 0 || chunkIndex >= session.totalChunks) {
      return NextResponse.json({ success: false, error: `无效的分块索引: ${chunkIndexStr}` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const expectedChunkSize = chunkIndex === session.totalChunks - 1
      ? session.fileSize - (session.chunkSize * chunkIndex)
      : session.chunkSize;

    if (buffer.length !== expectedChunkSize && chunkIndex < session.totalChunks - 1) {
      return NextResponse.json({
        success: false,
        error: `分块大小不匹配: 期望 ${expectedChunkSize}，收到 ${buffer.length}`,
      }, { status: 400 });
    }

    const storage = getStorageAdapter();
    if (!storage.uploadChunk) {
      return NextResponse.json({ success: false, error: '存储适配器不支持分块上传' }, { status: 500 });
    }

    await storage.uploadChunk(uploadId, chunkIndex, buffer);
    recordChunk(uploadId, chunkIndex);

    return NextResponse.json({
      success: true,
      data: {
        chunkIndex,
        uploadedChunks: session.uploadedChunks.length,
        totalChunks: session.totalChunks,
        progress: Math.round((session.uploadedChunks.length / session.totalChunks) * 100),
      },
    });
  } catch (err) {
    log.error({ err }, 'Chunk upload error');
    return NextResponse.json({ success: false, error: '分块上传失败' }, { status: 500 });
  }
});
