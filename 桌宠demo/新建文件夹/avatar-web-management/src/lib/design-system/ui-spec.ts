export const uiSpec = {
  typeScale: {
    display: { fontSize: '2.5rem', lineHeight: '1.08', fontWeight: '700' },
    pageTitle: { fontSize: '2rem', lineHeight: '1.15', fontWeight: '700' },
    sectionTitle: { fontSize: '1.25rem', lineHeight: '1.25', fontWeight: '650' },
    cardTitle: { fontSize: '1rem', lineHeight: '1.35', fontWeight: '650' },
    body: { fontSize: '0.875rem', lineHeight: '1.55', fontWeight: '400' },
    metadata: { fontSize: '0.75rem', lineHeight: '1.4', fontWeight: '500' },
    button: { fontSize: '0.875rem', lineHeight: '1.2', fontWeight: '600' },
  },
  controls: {
    navCtaHeight: '36px',
    primaryCtaHeight: '40px',
    heroCtaHeight: '56px',
    pillRadius: '9999px',
    compactButtonHeight: '32px',
  },
  panels: {
    radius: '8px',
    gridMinWidth: '220px',
    densePadding: '16px',
    comfortablePadding: '20px',
  },
} as const;

export type UiSpec = typeof uiSpec;
