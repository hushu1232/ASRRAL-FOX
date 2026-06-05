import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, TokenPayload } from './jwt';
import { runWithRequestContext } from '@/lib/request-context';

export interface AuthRequest extends NextRequest {
  user?: TokenPayload;
}

export interface AuthContext {
  sub: string;
  email: string;
  role: string;
  workspaceId: string;
}

type HandlerWithUser = (req: NextRequest, user: AuthContext, ctx?: { params?: Promise<unknown> }) => Promise<NextResponse>;

export function withAuth(handler: HandlerWithUser) {
  return async (req: NextRequest, ctx?: { params?: Promise<unknown> }): Promise<NextResponse> => {
    try {
      const authHeader = req.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ success: false, error: 'Missing authorization header' }, { status: 401 });
      }
      const token = authHeader.slice(7);
      const payload = verifyAccessToken(token);
      if (!payload) {
        return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 401 });
      }
      if (!payload.ws || typeof payload.ws !== 'string') {
        return NextResponse.json({ success: false, error: 'Invalid token: missing workspace' }, { status: 401 });
      }

      const authCtx: AuthContext = {
        sub: payload.sub,
        email: payload.email,
        role: payload.role,
        workspaceId: payload.ws,
      };

      const requestId = req.headers.get('x-request-id') || 'unknown';
      return await runWithRequestContext(requestId, () => handler(req, authCtx, ctx));
    } catch (err: unknown) {
      const e = err as Error;
      return NextResponse.json({ success: false, error: e.message || 'Internal server error', name: e.name }, { status: 500 });
    }
  };
}

export function requireRole(requiredRole: string) {
  return (handler: HandlerWithUser) => {
    return withAuth(async (req, user, ctx) => {
      const { ROLE_HIERARCHY } = await import('@/lib/constants');
      const userLevel = ROLE_HIERARCHY[user.role] || 0;
      const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
      if (userLevel < requiredLevel) {
        return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
      }
      return handler(req, user, ctx);
    });
  };
}
