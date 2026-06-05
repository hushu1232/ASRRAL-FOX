export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { revokeRefreshToken, verifyRefreshToken } from '@/lib/auth/jwt';
import { success } from '@/lib/api-response';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const cookie = req.cookies.get('refreshToken');
    if (cookie?.value) {
      const payload = await verifyRefreshToken(cookie.value);
      if (payload) {
        logAudit({ userId: payload.sub, action: 'auth.logout', resourceType: 'auth', req });
      }
      await revokeRefreshToken(cookie.value);
    }

    const response = success({ message: 'Logged out' });
    response.cookies.set('refreshToken', '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch {
    return success({ message: 'Logged out' });
  }
}
