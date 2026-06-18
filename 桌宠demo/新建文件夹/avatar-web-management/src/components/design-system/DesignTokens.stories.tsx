import type { Meta, StoryObj } from '@storybook/nextjs';
import { darkTokens, lightTokens, flattenTokens } from '@/lib/design-system';

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          backgroundColor: color,
          border: '1px solid rgba(255,255,255,0.1)',
          flexShrink: 0,
        }}
      />
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f0' }}>{label}</div>
        <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#9494a8' }}>{color}</div>
      </div>
    </div>
  );
}

function TokenGroup({ title, tokens }: { title: string; tokens: Record<string, string> }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ color: '#e8e8f0', fontSize: 16, fontWeight: 600, margin: '0 0 12px', borderBottom: '1px solid rgba(139,92,246,0.2)', paddingBottom: 6 }}>
        {title}
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 4 }}>
        {Object.entries(tokens).map(([key, value]) => (
          <Swatch key={key} color={value} label={key} />
        ))}
      </div>
    </div>
  );
}

function SpacingScale({ tokens }: { tokens: Record<string, string> }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ color: '#e8e8f0', fontSize: 16, fontWeight: 600, margin: '0 0 12px', borderBottom: '1px solid rgba(139,92,246,0.2)', paddingBottom: 6 }}>
        Spacing Scale
      </h3>
      {Object.entries(tokens).map(([key, value]) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
          <span style={{ width: 60, fontSize: 13, color: '#e8e8f0' }}>{key}</span>
          <div style={{ width: parseFloat(value) * 2, height: 20, background: 'linear-gradient(90deg, #6d5df0, transparent)', borderRadius: 4 }} />
          <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#9494a8' }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

const meta: Meta = {
  title: 'Design System / Token Reference',
  component: () => null,
};

export default meta;

type Story = StoryObj;

export const DarkTheme: Story = {
  render: () => {
    const flatColors = flattenTokens(darkTokens.colors as unknown as Record<string, unknown>);
    const flatSpacing = flattenTokens(darkTokens.spacing as unknown as Record<string, unknown>);
    const flatRadii = flattenTokens(darkTokens.radii as unknown as Record<string, unknown>);

    return (
      <div style={{ padding: 32, background: darkTokens.colors.bg.deep, minHeight: '100vh' }}>
        <h2 style={{ color: darkTokens.colors.text.primary, fontSize: 24, marginBottom: 24 }}>
          Dark Theme — Design Tokens
        </h2>
        <TokenGroup title="Background" tokens={Object.fromEntries(Object.entries(flatColors).filter(([k]) => k.startsWith('bg-')))} />
        <TokenGroup title="Accent" tokens={Object.fromEntries(Object.entries(flatColors).filter(([k]) => k.startsWith('accent-')))} />
        <TokenGroup title="Border" tokens={Object.fromEntries(Object.entries(flatColors).filter(([k]) => k.startsWith('border-')))} />
        <TokenGroup title="Text" tokens={Object.fromEntries(Object.entries(flatColors).filter(([k]) => k.startsWith('text-')))} />
        <TokenGroup title="Semantic" tokens={Object.fromEntries(Object.entries(flatColors).filter(([k]) => k.startsWith('semantic-')))} />
        <SpacingScale tokens={flatSpacing} />
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ color: '#e8e8f0', fontSize: 16, fontWeight: 600, margin: '0 0 12px', borderBottom: '1px solid rgba(139,92,246,0.2)', paddingBottom: 6 }}>
            Border Radii
          </h3>
          {Object.entries(flatRadii).map(([key, value]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
              <span style={{ width: 60, fontSize: 13, color: '#e8e8f0' }}>{key}</span>
              <div style={{ width: 60, height: 40, border: '2px solid #6d5df0', borderRadius: value, background: 'rgba(109,93,240,0.15)' }} />
              <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#9494a8' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  },
};

export const LightTheme: Story = {
  render: () => {
    const flatColors = flattenTokens(lightTokens.colors as unknown as Record<string, unknown>);

    return (
      <div style={{ padding: 32, background: lightTokens.colors.bg.deep, minHeight: '100vh' }}>
        <h2 style={{ color: lightTokens.colors.text.primary, fontSize: 24, marginBottom: 24 }}>
          Light Theme — Design Tokens
        </h2>
        <TokenGroup title="Background" tokens={Object.fromEntries(Object.entries(flatColors).filter(([k]) => k.startsWith('bg-')))} />
        <TokenGroup title="Accent" tokens={Object.fromEntries(Object.entries(flatColors).filter(([k]) => k.startsWith('accent-')))} />
        <TokenGroup title="Border" tokens={Object.fromEntries(Object.entries(flatColors).filter(([k]) => k.startsWith('border-')))} />
        <TokenGroup title="Text" tokens={Object.fromEntries(Object.entries(flatColors).filter(([k]) => k.startsWith('text-')))} />
        <TokenGroup title="Semantic" tokens={Object.fromEntries(Object.entries(flatColors).filter(([k]) => k.startsWith('semantic-')))} />
      </div>
    );
  },
};
