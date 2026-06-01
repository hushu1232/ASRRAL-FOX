// Rigging 管线触发 — 接收参数 → 异步编排 → 立即返回
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { runPipeline } from '@/lib/rigging/client';
import { orchestratePipeline } from '@/lib/rigging/pipeline';
import { requireRole } from '@/lib/auth/middleware';
import { createLogger } from '@/lib/logger';
import { RIGGING_TEMPLATES } from '@/lib/rigging/types';
import type { PipelineOptions } from '@/lib/rigging/types';

const log = createLogger('rigging-pipeline');

const ALLOWED_DENSITIES = ['low', 'medium', 'high'];

export const POST = requireRole('workspace_admin')(async (req, user) => {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const imageId = body.imageId as string;
  const template = (body.template as string) || 'catgirl';
  const meshDensity = (body.meshDensity as string) || 'medium';
  const autoDeploy = body.autoDeploy === true;
  const async = body.async !== false; // default async=true

  if (!imageId) {
    return NextResponse.json(
      { success: false, error: 'imageId is required' },
      { status: 400 },
    );
  }

  if (!RIGGING_TEMPLATES.includes(template as typeof RIGGING_TEMPLATES[number])) {
    return NextResponse.json(
      { success: false, error: `Invalid template: ${template}. Valid: ${RIGGING_TEMPLATES.join(', ')}` },
      { status: 400 },
    );
  }

  if (!ALLOWED_DENSITIES.includes(meshDensity)) {
    return NextResponse.json(
      { success: false, error: `Invalid meshDensity: ${meshDensity}` },
      { status: 400 },
    );
  }

  const options: PipelineOptions = {
    template,
    meshDensity: meshDensity as 'low' | 'medium' | 'high',
    autoDeploy,
    targetName: body.targetName as string | undefined,
  };

  log.info({ userId: user.sub, imageId, template, meshDensity, async }, 'Pipeline requested');

  if (async) {
    // Fire-and-forget: start orchestration in background, immediately return
    orchestratePipeline(imageId, options).then((status) => {
      log.info({ imageId, totalMs: status.result?.totalTimeMs }, 'Async pipeline completed');
    }).catch((err) => {
      log.error({ err, imageId }, 'Async pipeline failed');
    });

    return NextResponse.json({
      success: true,
      data: {
        imageId,
        status: 'started',
        template,
        meshDensity,
        message: 'Pipeline started. Connect via WebSocket or poll /api/rigging/status/{imageId} for progress.',
      },
    });
  }

  // Synchronous mode — wait for completion (legacy, for API testing)
  try {
    const result = await runPipeline(imageId, options);

    return NextResponse.json({
      success: true,
      data: {
        imageId,
        status: 'completed',
        template,
        meshDensity,
        totalTimeMs: result.totalTimeMs,
        result: {
          moc3Url: result.export.moc3Url,
          cmo3Url: result.export.cmo3Url,
          model3JsonUrl: result.export.model3JsonUrl,
          texturesUrls: result.export.texturesUrls,
          deployed: result.deploy ? {
            path: result.deploy.deployedPath,
            reloadTriggered: result.deploy.reloadTriggered,
          } : null,
        },
      },
    });
  } catch (err) {
    log.error({ err, userId: user.sub, imageId }, 'Pipeline failed');
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 502 },
    );
  }
});
