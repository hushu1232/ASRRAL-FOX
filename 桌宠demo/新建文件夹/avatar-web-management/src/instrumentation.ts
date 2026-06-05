let wsServer: import('ws').WebSocketServer | null = null;

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // OpenTelemetry — must be first, before any other module init
    const { initTelemetry } = await import('@/lib/telemetry');
    initTelemetry();

    const { initDb } = await import('@/lib/db');
    initDb();

    // Start WebSocket server for real-time editor preview
    if (process.env.NODE_ENV !== 'test') {
      const { startWsServer } = await import('@/lib/ws/server');
      wsServer = startWsServer();

      const { startMetricsCollector } = await import('@/lib/metrics/collector');
      startMetricsCollector();
    }
  }
}

export async function deregister() {
  if (wsServer) {
    const { stopWsServer } = await import('@/lib/ws/server');
    await stopWsServer();
  }

  try {
    const { stopMetricsCollector } = await import('@/lib/metrics/collector');
    stopMetricsCollector();
  } catch { /* metrics collector shutdown is best-effort */ }

  // Shut down OpenTelemetry — flush pending spans
  try {
    const { shutdownTelemetry } = await import('@/lib/telemetry');
    await shutdownTelemetry();
  } catch { /* telemetry shutdown is best-effort */ }
}
