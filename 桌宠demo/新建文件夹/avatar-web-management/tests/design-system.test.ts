import fs from 'node:fs';
import path from 'node:path';

import { describe, it, expect } from '@jest/globals';
import {
  uiSpec,
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

const globalsCss = fs.readFileSync(path.join(__dirname, '..', 'src/app/globals.css'), 'utf8');

const parseCssCustomProperties = (css: string) =>
  new Map(
    Array.from(
      css.matchAll(/(--ds-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)\s*:\s*([^;]+);/g),
      ([, name, value]) => [name, value.trim()],
    ),
  );

const cssVars = parseCssCustomProperties(globalsCss);

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

describe('FOXD UI specification', () => {
  it('defines the site-wide type scale inspired by the Insta360 reference', () => {
    expect(uiSpec.typeScale.pageTitle).toEqual({
      fontSize: '2rem',
      lineHeight: '1.15',
      fontWeight: '700',
    });
    expect(uiSpec.typeScale.cardTitle.fontSize).toBe('1rem');
    expect(uiSpec.typeScale.metadata.fontSize).toBe('0.75rem');
    expect(uiSpec.typeScale.body.lineHeight).toBe('1.55');
  });

  it('defines shared CTA and panel sizing rules', () => {
    expect(uiSpec.controls.navCtaHeight).toBe('36px');
    expect(uiSpec.controls.primaryCtaHeight).toBe('40px');
    expect(uiSpec.controls.heroCtaHeight).toBe('56px');
    expect(uiSpec.controls.pillRadius).toBe('9999px');
    expect(uiSpec.panels.radius).toBe('8px');
    expect(uiSpec.panels.gridMinWidth).toBe('220px');
  });

  it('keeps original plan-required CSS variables available', () => {
    const legacyVariables = [
      '--ds-type-display-size',
      '--ds-type-display-lineHeight',
      '--ds-type-pageTitle-size',
      '--ds-type-pageTitle-lineHeight',
      '--ds-type-sectionTitle-size',
      '--ds-type-cardTitle-size',
      '--ds-type-body-size',
      '--ds-type-body-lineHeight',
      '--ds-type-metadata-size',
      '--ds-control-navCta-height',
      '--ds-control-primaryCta-height',
      '--ds-control-heroCta-height',
      '--ds-control-pillRadius',
      '--ds-panel-radius',
      '--ds-panel-gridMinWidth',
      '--ds-panel-densePadding',
      '--ds-panel-comfortablePadding',
    ];

    for (const variable of legacyVariables) {
      expect(cssVars.has(variable)).toBe(true);
    }
  });

  it('exposes canonical CSS variables for every uiSpec leaf', () => {
    const expectedCanonicalVars = new Map<string, string>();

    for (const [token, value] of Object.entries(uiSpec.typeScale)) {
      expectedCanonicalVars.set(`--ds-ui-typeScale-${token}-fontSize`, value.fontSize);
      expectedCanonicalVars.set(`--ds-ui-typeScale-${token}-lineHeight`, value.lineHeight);
      expectedCanonicalVars.set(`--ds-ui-typeScale-${token}-fontWeight`, value.fontWeight);
    }

    for (const [token, value] of Object.entries(uiSpec.controls)) {
      expectedCanonicalVars.set(`--ds-ui-controls-${token}`, value);
    }

    for (const [token, value] of Object.entries(uiSpec.panels)) {
      expectedCanonicalVars.set(`--ds-ui-panels-${token}`, value);
    }

    for (const [variable, value] of expectedCanonicalVars) {
      expect(cssVars.get(variable)).toBe(value);
    }
  });
});
