import { NextRequest, NextResponse } from 'next/server';

// Basic Auth for /stats/*. Any username; password must match STATS_PASSWORD env var.
export function middleware(req: NextRequest) {
  const expected = process.env.STATS_PASSWORD;
  if (!expected) {
    return new NextResponse('STATS_PASSWORD env var not configured', { status: 500 });
  }

  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Basic ')) {
    try {
      const decoded = atob(auth.slice(6));
      const idx = decoded.indexOf(':');
      const pass = idx >= 0 ? decoded.slice(idx + 1) : decoded;
      if (pass === expected) return NextResponse.next();
    } catch {
      // fall through to 401
    }
  }

  return new NextResponse('Auth required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="bizarrebounce stats"' },
  });
}

export const config = {
  matcher: ['/stats', '/stats/:path*'],
};
