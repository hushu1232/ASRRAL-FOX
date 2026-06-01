export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { createSession } from '@/lib/storage/chunked-upload';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:upload-init');

const ALLOWED_EXTENSIONS = ['.glb', '.gltf', '.png', '.jpg', '.jpeg', '.hdr', '.exr', '.fbx', '.blend', '.obj', '.mtl', '.mp4', '.moc3', '.physics3.json', '.cdi3.json', '.motion3.json', '.model3.json'];

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot >= 0 ? filename.slice(lastDot).toLowerCase() : '';
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._\-一-鿿]/g, '_').replace(/\.\./g, '');
}

export const POST = withAuth(async (req, user) => {
  try {
    const body = await req.json() as {
      filename?: string;
      fileSize?: number;
      contentType?: string;
      chunkSize?: number;
    };

    const filename = sanitizeFilename(body.filename || 'upload');
    const fileSize = body.fileSize;
    const contentType = body.contentType || 'application/octet-stream';
    const ext = getExtension(filename);

    if (!fileSize || fileSize <= 0) {
      return NextResponse.json({ success: false, error: '无效的文件大小' }, { status: 400 });
    }

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({
        success: false,
        error: `不支持的文件类型: ${ext}。支持: ${ALLOWED_EXTENSIONS.join(', ')}`,
      }, { status: 400 });
    }

    const MAX_SIZE = 500 * 1024 * 1024;
    if (fileSize > MAX_SIZE) {
      return NextResponse.json({
        success: false,
        error: `文件大小超过限制 (${(MAX_SIZE / 1024 / 1024).toFixed(0)}MB)`,
      }, { status: 400 });
    }

    const timestamp = Date.now();
    const safeName = `${timestamp}-${filename}`;
    const finalKey = `${user.workspaceId}/pending/${safeName}`;

    const session = createSession({
      finalKey,
      fileSize,
      contentType,
      chunkSize: body.chunkSize,
    });

    return NextResponse.json({
      success: true,
      data: {
        uploadId: session.uploadId,
        chunkSize: session.chunkSize,
        totalChunks: session.totalChunks,
        fileSize: session.fileSize,
      },
    });
  } catch (err) {
    log.error({ err }, 'Upload init error');
    return NextResponse.json({ success: false, error: '初始化上传失败' }, { status: 500 });
  }
});
