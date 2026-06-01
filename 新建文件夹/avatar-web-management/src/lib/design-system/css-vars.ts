import { DesignTokens, flattenTokens } from './tokens';

const VAR_PREFIX = 'ds';

/**
 * Generate CSS custom properties string from a DesignTokens object.
 * Nested keys become `--ds-colors-bg-deep`, etc.
 */
export function generateCssVars(tokens: DesignTokens): string {
  const flattened = flattenTokens(tokens as unknown as Record<string, unknown>);
  const lines: string[] = [];
  for (const [key, value] of Object.entries(flattened)) {
    lines.push(`  --${VAR_PREFIX}-${key}: ${value};`);
  }
  return lines.join('\n');
}

/**
 * Return a flat Record of CSS variable name → value for programmatic use.
 */
export function tokensToCssVarMap(tokens: DesignTokens): Record<string, string> {
  const flattened = flattenTokens(tokens as unknown as Record<string, unknown>);
  const map: Record<string, string> = {};
  for (const [key, value] of Object.entries(flattened)) {
    map[`--${VAR_PREFIX}-${key}`] = value;
  }
  return map;
}

/**
 * Build a style object for injecting into JSX style props.
 */
export function tokensToStyleObject(tokens: DesignTokens): Record<string, string> {
  return tokensToCssVarMap(tokens);
}

/**
 * Generate the `:root` CSS block wiring design tokens as CSS custom properties.
 */
export function generateRootCssBlock(tokens: DesignTokens): string {
  return `:root {\n${generateCssVars(tokens)}\n}`;
}
