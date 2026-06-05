// Rigging 一键部署 — 将生成的 Live2D 模型部署到 Unity 桌面端
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { deployModel } from '@/lib/rigging/client';
import { petService } from '@/lib/services/petService';
import { requireRole } from '@/lib/auth/middleware';
import { createLogger } from '@/lib/logger';

const log = createLogger('rigging-deploy');

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

  const modelId = body.modelId as string;
  if (!modelId) {
    return NextResponse.json(
      { success: false, error: 'modelId is required' },
      { status: 400 },
    );
  }

  // Build anim params from pet config if available
  let animParams: Record<string, Record<string, unknown>> | undefined;
  let targetName: string | undefined;

  if (body.petConfigId) {
    try {
      const exportConfig = await petService.exportConfig(user.sub, user.workspaceId);
      targetName = exportConfig.petName || undefined;

      // Convert pet params to anim state overrides
      if (exportConfig.params?.length) {
        animParams = {
          idle: Object.fromEntries(exportConfig.params.map((p) => [p.key, p.value])),
        };
      }
    } catch (err) {
      log.warn({ err, userId: user.sub }, 'Failed to load pet config for deploy — using defaults');
    }
  }

  log.info({ userId: user.sub, modelId, targetName }, 'Deploying model to desktop');

  try {
    const result = await deployModel(modelId, animParams, targetName);

    return NextResponse.json({
      success: true,
      data: {
        modelId: result.modelId,
        deployedPath: result.deployedPath,
        reloadTriggered: result.reloadTriggered,
        configsWritten: result.configsWritten,
        processingTimeMs: result.processingTimeMs,
      },
    });
  } catch (err) {
    log.error({ err, userId: user.sub, modelId }, 'Deploy failed');
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 502 },
    );
  }
});
