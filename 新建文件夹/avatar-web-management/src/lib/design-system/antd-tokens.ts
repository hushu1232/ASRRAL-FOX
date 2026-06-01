import type { DesignTokens } from './tokens';

/**
 * Maps our DesignTokens to Ant Design's `theme.token` shape for ConfigProvider.
 * https://ant.design/docs/react/customize-theme
 */
export function toAntdThemeTokens(tokens: DesignTokens): Record<string, string | number> {
  return {
    colorPrimary: tokens.colors.accent.primary,
    colorBgContainer: tokens.colors.bg.card,
    colorBgElevated: tokens.colors.bg.elevated,
    colorBorder: tokens.colors.border.subtle,
    colorText: tokens.colors.text.primary,
    colorTextSecondary: tokens.colors.text.secondary,
    borderRadius: parseInt(tokens.radii.md, 10),
    fontFamily: tokens.typography.fontFamily,
  };
}

/**
 * Factory: returns a function that maps DesignTokens to component-level
 * Ant Design token overrides. Use for customizing a specific component's tokens.
 *
 * Example:
 *   const buttonTokens = createComponentTokenFactory((t) => ({
 *     colorPrimary: t.colors.accent.primary,
 *     borderRadius: parseInt(t.radii.md, 10),
 *   }));
 */
export function createComponentTokenFactory<T extends Record<string, unknown>>(
  mapper: (tokens: DesignTokens) => T,
): (tokens: DesignTokens) => T {
  return mapper;
}
