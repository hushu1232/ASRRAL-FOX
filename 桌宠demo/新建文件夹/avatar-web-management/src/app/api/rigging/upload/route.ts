// Rigging 图片上传 — 接收前端图片 → 本地存储 → 转发 rigging
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getStorageAdapter } from '@/lib/storage';
import { uploadImageFromBuffer } from '@/lib/rigging/client';
import { requireRole } from '@/lib/auth/middleware';
import { createLogger } from '@/lib/logger';
import { ValidationError } from '@/lib/errors';

const log = createLogger('rigging-upload');

const ALLOWED_TYPES = ['image/png', 'image/jpeg'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export const POST = requireRole('workspace_admin')(async (req: NextRequest, user) => {
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json(
      { success: false, error: 'Content-Type must be multipart/form-data' },
      { status: 400 },
    );
  }

  let buffer: Buffer;
  let filename: string;
  let mimeType: string;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) throw new ValidationError('Missing file field');

    mimeType = file.type;
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { success: false, error: `Invalid file type: ${mimeType}. Only PNG and JPEG allowed.` },
        { status: 400 },
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File too large. Max 10MB.' },
        { status: 400 },
      );
    }

    filename = file.name || 'image.png';
    buffer = Buffer.from(await file.arrayBuffer());
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    return NextResponse.json(
      { success: false, error: 'Failed to parse upload' },
      { status: 400 },
    );
  }

  // Store original in web storage
  const storage = getStorageAdapter();
  const storageKey = `rigging/${user.sub}/${Date.now()}_${filename}`;
  let previewUrl: string;

  try {
    previewUrl = await storage.upload(storageKey, buffer, mimeType);
  } catch (err) {
    log.error({ err, userId: user.sub }, 'Failed to store uploaded image');
    return NextResponse.json(
      { success: false, error: 'Failed to store image' },
      { status: 500 },
    );
  }

  // Forward to rigging service
  try {
    const result = await uploadImageFromBuffer(buffer, filename);
    log.info({ userId: user.sub, imageId: result.image_id, size: result.size }, 'Image uploaded to rigging');

    return NextResponse.json({
      success: true,
      data: {
        imageId: result.image_id,
        previewUrl,
        filename: result.filename,
        size: result.size,
      },
    });
  } catch (err) {
    log.error({ err, userId: user.sub }, 'Rigging upload failed');
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 502 },
    );
  }
});
