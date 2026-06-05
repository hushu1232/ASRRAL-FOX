import { describe, it, expect } from '@jest/globals';
import {
  darkTokens,
  lightTokens,
  flattenTokens,
  generateCssVars,
  generateRootCssBlock,
  tokensToCssVarMap,
  tokensToStyleObject,
  toAntdThemeTokens,
  createComponentTokenFactory,
} from '@/lib/design-system';

describe('Design tokens', () => {
  it('darkTokens has all required color categories', () => {
    expect(darkTokens.colors.bg.deep).toBe('#09090F');
    expect(darkTokens.colors.accent.primary).toBe('#6d5df0');
    expect(darkTokens.colors.semantic.danger).toBe('#e0556a');
    expect(darkTokens.colors.semantic.info).toBe('#60a5fa');
  });

  it('lightTokens shares spacing, typography, and radii with darkTokens', () => {
    expect(lightTokens.spacing).toBe(darkTokens.spacing);
    expect(lightTokens.typography).toBe(darkTokens.typography);
    expect(lightTokens.radii).toBe(darkTokens.radii);
  });

  it('lightTokens has light-appropriate colors', () => {
    expect(lightTokens.colors.bg.deep).toBe('#f5f5fa');
    expect(lightTokens.colors.text.primary).toBe('#1a1a2e');
  });

  it('flattenTokens produces flat dotted-key Record', () => {
    const flat = flattenTokens(darkTokens.colors as unknown as Record<string, unknown>);
    expect(flat['bg-deep']).toBe('#09090F');
    expect(flat['accent-primary']).toBe('#6d5df0');
    expect(flat['semantic-success']).toBe('#4ade80');
  });

  it('flattenTokens deeply nests with prefix', () => {
    const flat = flattenTokens(darkTokens as unknown as Record<string, unknown>);
    expect(flat['colors-bg-deep']).toBe('#09090F');
    expect(flat['spacing-xs']).toBe('4px');
    expect(flat['radii-md']).toBe('8px');
  });

  it('generateCssVars produces valid CSS custom properties', () => {
    const css = generateCssVars(darkTokens);
    expect(css).toContain('--ds-colors-bg-deep: #09090F;');
    expect(css).toContain('--ds-colors-accent-primary: #6d5df0;');
    expect(css).toContain('--ds-spacing-md: 16px;');
    expect(css).toContain('--ds-radii-md: 8px;');
    expect(css).toContain('--ds-typography-fontFamily:');
  });

  it('generateRootCssBlock wraps in :root selector', () => {
    const block = generateRootCssBlock(darkTokens);
    expect(block).toMatch(/^:root \{/);
    expect(block).toMatch(/\}$/);
  });

  it('tokensToCssVarMap returns a flat Record of --ds variables', () => {
    const map = tokensToCssVarMap(darkTokens);
    expect(map['--ds-colors-bg-deep']).toBe('#09090F');
    expect(map['--ds-colors-semantic-danger']).toBe('#e0556a');
  });

  it('tokensToStyleObject returns same shape as tokensToCssVarMap', () => {
    const vars = tokensToCssVarMap(darkTokens);
    const style = tokensToStyleObject(darkTokens);
    expect(style).toEqual(vars);
  });

  it('toAntdThemeTokens maps to Ant Design shape', () => {
    const antd = toAntdThemeTokens(darkTokens);
    expect(antd.colorPrimary).toBe('#6d5df0');
    expect(antd.colorBgContainer).toBe('#12122A');
    expect(antd.colorBgElevated).toBe('#1a1a3e');
    expect(antd.colorBorder).toBe('rgba(139, 92, 246, 0.15)');
    expect(antd.colorText).toBe('#e8e8f0');
    expect(antd.colorTextSecondary).toBe('#9494a8');
    expect(antd.borderRadius).toBe(8);
    expect(antd.fontFamily).toContain('Noto Sans SC');
  });

  it('createComponentTokenFactory returns a mapper function', () => {
    const factory = createComponentTokenFactory((t) => ({
      colorPrimary: t.colors.accent.primary,
      customProp: t.colors.semantic.info,
    }));
    const result = factory(darkTokens);
    expect(result.colorPrimary).toBe('#6d5df0');
    expect(result.customProp).toBe('#60a5fa');
  });
});
