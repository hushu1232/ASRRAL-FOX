let wsServer: import('ws').WebSocketServer | null = null;

export async function register() {
  // OpenTelemetry must be first, before any other module initialization.
  const { initTelemetry } = await import('@/lib/telemetry');
  initTelemetry();

  const { initDb } = await import('@/lib/db');
  initDb();

  // Start the local WebSocket server for real-time editor preview.
  if (process.env.NODE_ENV !== 'test') {
    const { startWsServer } = await import('@/lib/ws/server');
    wsServer = startWsServer();

    const { startMetricsCollector } = await import('@/lib/metrics/collector');
    startMetricsCollector();
  }
}

export async function deregister() {
  if (wsServer) {
    const { stopWsServer } = await import('@/lib/ws/server');
    await stopWsServer();
    wsServer = null;
  }

  try {
    const { stopMetricsCollector } = await import('@/lib/metrics/collector');
    stopMetricsCollector();
  } catch {
    // Metrics collector shutdown is best-effort.
  }

  try {
    const { shutdownTelemetry } = await import('@/lib/telemetry');
    await shutdownTelemetry();
  } catch {
    // Telemetry shutdown is best-effort.
  }
}
