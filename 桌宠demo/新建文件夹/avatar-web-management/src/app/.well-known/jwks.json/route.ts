import { NextResponse } from 'next/server';
import { exportJwk, getKeyId, isRs256Available } from '@/lib/auth/keys';

export const dynamic = 'force-dynamic';

export function GET() {
  if (!isRs256Available()) {
    return NextResponse.json(
      { error: 'JWKS not available — RS256 is not configured' },
      { status: 404 }
    );
  }

  const jwk = exportJwk();
  if (!jwk) {
    return NextResponse.json({ error: 'Failed to export JWK' }, { status: 500 });
  }

  return NextResponse.json(
    {
      keys: [
        {
          ...jwk,
          kid: getKeyId(),
          use: 'sig',
          alg: 'RS256',
        },
      ],
    },
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    }
  );
}
