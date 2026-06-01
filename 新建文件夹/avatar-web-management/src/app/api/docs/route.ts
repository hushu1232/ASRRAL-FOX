export const runtime = 'nodejs';

import { ApiReference } from '@scalar/nextjs-api-reference';
import openapiSpec from '@/lib/openapi.json';

const spec = openapiSpec as Record<string, unknown>;

export const GET = ApiReference({
  spec: { content: spec },
  theme: 'purple',
  darkMode: true,
  hideDownloadButton: true,
});
