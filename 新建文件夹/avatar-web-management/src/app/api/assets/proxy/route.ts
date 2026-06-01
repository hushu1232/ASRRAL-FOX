export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { getStorageAdapter } from '@/lib/storage';
import fs from 'fs';
import path from 'path';

export const GET = withAuth(async (req: NextRequest) => {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');

  if (!key) {
    return NextResponse.json({ success: false, error: 'Missing key parameter' }, { status: 400 });
  }

  try {
    const storage = getStorageAdapter();
    const fileUrl = await storage.getFileUrl(key);

    // S3/MinIO — redirect to signed URL
    if (fileUrl.startsWith('http')) {
      return NextResponse.redirect(fileUrl);
    }

    // Local filesystem — stream the file for download
    const filePath = path.resolve(fileUrl);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
    }

    const stat = fs.statSync(filePath);
    const filename = path.basename(key);
    const ext = path.extname(filename).toLowerCase();
    const MIME: Record<string, string> = {
      '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.fbx': 'application/octet-stream',
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
      '.hdr': 'image/vnd.radiance', '.exr': 'image/x-exr',
      '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg',
      '.json': 'application/json', '.zip': 'application/zip',
    };
    const contentType = MIME[ext] || 'application/octet-stream';

    const stream = fs.createReadStream(filePath);
    return new NextResponse(stream as unknown as ReadableStream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(stat.size),
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
  }
});
