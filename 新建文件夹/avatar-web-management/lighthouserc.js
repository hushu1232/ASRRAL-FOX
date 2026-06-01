module.exports = {
  ci: {
    collect: {
      staticDistDir: './.next',
      settings: {
        chromeFlags: '--no-sandbox --headless',
        preset: 'desktop',
        skipAudits: ['is-on-https'],
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.5 }],
        'categories:accessibility': ['error', { minScore: 0.8 }],
        'categories:best-practices': ['warn', { minScore: 0.7 }],
        'categories:seo': ['warn', { minScore: 0.6 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
