module.exports = {
  ci: {
    collect: {
      staticDistDir: './.next',
      settings: {
        chromeFlags: '--no-sandbox --headless',
        preset: 'desktop',
        skipAudits: ['is-on-https'],
        // Collect multiple runs for statistical stability
        numberOfRuns: 3,
      },
      // Add critical user journeys for realistic measurement
      startServerCommand: 'npm run start',
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/login',
        'http://localhost:3000/dashboard',
        'http://localhost:3000/marketplace',
      ],
    },
    assert: {
      assertions: {
        // Production-grade thresholds
        'categories:performance': ['error', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.85 }],
        'categories:seo': ['error', { minScore: 0.8 }],
        // Core Web Vitals
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 3000 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],
        'interactive': ['warn', { maxNumericValue: 5000 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
