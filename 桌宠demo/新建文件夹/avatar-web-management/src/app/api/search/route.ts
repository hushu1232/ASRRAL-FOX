export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { success } from '@/lib/api-response';
import { searchService } from '@/lib/services/search.service';

export const GET = withAuth(async (req, user) => {
  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  const result = await searchService.search(q, user.workspaceId);
  // Serialize BigInt values (fileSize) before JSON response
  return success(JSON.parse(JSON.stringify(result, (_, v) => typeof v === 'bigint' ? Number(v) : v)));
});
