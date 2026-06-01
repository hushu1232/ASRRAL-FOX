// Minimal logger shim — the Cubism 5 framework (vendor/cubism5.js) imports "l" from this module.
// In the original live2d-widget, this is the full waifu-tips.js orchestrator.
// We only need the logger class to satisfy the import dependency.
class Logger {
  constructor(level = 'info') { this.level = level; }
  setLevel(level) { if (level) this.level = level; }
  shouldLog(level) { return Logger.levelOrder[level] <= Logger.levelOrder[this.level]; }
  error(...args) { if (this.shouldLog('error')) console.error('[Live2D]', ...args); }
  warn(...args)  { if (this.shouldLog('warn'))  console.warn('[Live2D]', ...args); }
  info(...args)  { if (this.shouldLog('info'))  console.log('[Live2D]', ...args); }
  trace(...args) { if (this.shouldLog('trace')) console.debug('[Live2D]', ...args); }
}
Logger.levelOrder = { error: 0, warn: 1, info: 2, trace: 3 };
export { Logger as l };
