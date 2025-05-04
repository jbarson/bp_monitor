import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Secret key for JWT verification - must match the one in auth.ts
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-at-least-32-characters-long'
);

// Public paths that don't require authentication
const publicPaths = [
  '/login',
  '/api/auth/login',
  '/api/auth/register',
  '/favicon.ico',
  '/_next',
  '/images',
];

// Helper function to check if a path is public
function isPublicPath(path: string): boolean {
  return publicPaths.some(publicPath => 
    path === publicPath || path.startsWith(`${publicPath}/`)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Allow access to public paths without authentication
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check for auth token in cookies
  const token = request.cookies.get('auth-token')?.value;

  // If no token is found, redirect to login
  if (!token) {
    const url = new URL('/login', request.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  try {
    // Verify the token
    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    // Check if token is expired
    const currentTime = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < currentTime) {
      throw new Error('Token expired');
    }

    // Token is valid, allow access to the requested page
    return NextResponse.next();
  } catch (error) {
    // Token verification failed, redirect to login
    const url = new URL('/login', request.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }
}

// Configure which paths the middleware should be applied to
export const config = {
  matcher: [
    /*
     * Match all paths except:
     * 1. /api/auth/login and /api/auth/register (needed for authentication)
     * 2. /_next (Next.js internals)
     * 3. /images (static files)
     * 4. /favicon.ico (browser tab icon)
     */
    '/((?!api/auth|_next|images|favicon.ico).*)',
  ],
};

