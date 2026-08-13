import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, TokenPayload } from './jwt';
import { runWithRequestContext } from '@/lib/request-context';
import { createLogger } from '@/lib/logger';

const log = createLogger('auth:middleware');

export interface AuthRequest extends NextRequest {
  user?: TokenPayload;
}

export interface AuthContext {
  sub: string;
  email: string;
  role: string;
  workspaceId: string;
}

type RouteHandlerContext = { params: Promise<unknown> };
type HandlerWithUser = (req: NextRequest, user: AuthContext, ctx?: RouteHandlerContext) => Promise<NextResponse>;
type AuthenticatedRouteHandler = {
  (req: NextRequest): Promise<NextResponse>;
  (req: NextRequest, ctx: RouteHandlerContext): Promise<NextResponse>;
};

export function withAuth(handler: HandlerWithUser): AuthenticatedRouteHandler {
  const authenticatedHandler = async (req: NextRequest, ctx?: RouteHandlerContext): Promise<NextResponse> => {
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
      log.error({ err }, 'Authenticated route failed');
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  };

  return authenticatedHandler as AuthenticatedRouteHandler;
}

export function requireRole(requiredRole: string) {
  return (handler: HandlerWithUser) => {
    return withAuth(async (req, user, ctx) => {
      const { ROLE_HIERARCHY } = await import('@/lib/constants');
      const userLevel = ROLE_HIERARCHY[user.role];
      const requiredLevel = ROLE_HIERARCHY[requiredRole];
      if (userLevel === undefined || requiredLevel === undefined || userLevel < requiredLevel) {
        return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
      }
      return handler(req, user, ctx);
    });
  };
}
