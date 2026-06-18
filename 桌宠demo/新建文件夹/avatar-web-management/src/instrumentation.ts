export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const instrumentation = await import('./instrumentation.node');
    await instrumentation.register();
  }
}

export async function deregister() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const instrumentation = await import('./instrumentation.node');
    await instrumentation.deregister();
  }
}
