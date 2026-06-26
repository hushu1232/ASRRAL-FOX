export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { withAuth } from '@/lib/auth/middleware';
import { avatarService } from '@/lib/services/avatar.service';
import { error } from '@/lib/api-response';

type ScreenshotJob = {
  jobId: string;
  avatarId: string;
  status: 'queued' | 'completed';
  width: number;
  height: number;
  cameraPreset: string;
  createdAt: string;
};

const jobs = new Map<string, ScreenshotJob>();

async function getAvatarId(ctx?: { params?: Promise<unknown> }) {
  if (!ctx?.params) return '';
  const params = await ctx.params;
  return (params as { id?: string } | undefined)?.id || '';
}

export const POST = withAuth(async (req: NextRequest, user, ctx) => {
  try {
    const avatarId = await getAvatarId(ctx);
    await avatarService.getById(avatarId, user.workspaceId);

    const body = await req.json().catch(() => ({})) as {
      width?: number;
      height?: number;
      cameraPreset?: string;
    };

    const width = Number(body.width ?? 1920);
    const height = Number(body.height ?? 1080);
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      return NextResponse.json({ success: false, error: 'width and height must be positive numbers' }, { status: 400 });
    }

    const jobId = randomUUID();
    const job: ScreenshotJob = {
      jobId,
      avatarId,
      status: 'completed',
      width,
      height,
      cameraPreset: body.cameraPreset || 'front',
      createdAt: new Date().toISOString(),
    };
    jobs.set(jobId, job);

    return NextResponse.json({ success: true, data: { jobId, status: 'queued' } }, { status: 202 });
  } catch (err) {
    return error(err);
  }
});

export const GET = withAuth(async (req: NextRequest, user, ctx) => {
  try {
    const avatarId = await getAvatarId(ctx);
    await avatarService.getById(avatarId, user.workspaceId);

    const jobId = req.nextUrl.searchParams.get('jobId');
    if (!jobId) {
      return NextResponse.json({ success: false, error: 'jobId is required' }, { status: 400 });
    }

    const job = jobs.get(jobId);
    if (!job || job.avatarId !== avatarId) {
      return NextResponse.json({ success: false, error: 'screenshot job not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: job });
  } catch (err) {
    return error(err);
  }
});
