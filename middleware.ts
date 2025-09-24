import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/clients(.*)',
  '/orders(.*)',
  '/finance(.*)',
  '/deliveries(.*)',
  '/shipments(.*)',
  '/users(.*)',
  '/settings(.*)',
  '/help-center(.*)',
  '/logs(.*)',
  '/api/files(.*)',
])

const isPublicRoute = createRouteMatcher([
  '/login(.*)',
  '/sign-up(.*)',
  '/verify-mfa(.*)',
  '/sso-callback(.*)',
  '/test-sso(.*)',
  '/',
])

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth()
  
  // Allow public routes
  if (isPublicRoute(req)) {
    return NextResponse.next()
  }
  
  // Protect all other routes
  if (isProtectedRoute(req)) {
    await auth.protect()
    
    // Check MFA status for authenticated users
    if (userId && sessionClaims) {
      // Check if user has completed MFA verification
      const isMfaVerified = sessionClaims.mfa_verified
      
      // If MFA is required but not verified, redirect to verification page
      if (isMfaVerified === false) {
        return NextResponse.redirect(new URL('/verify-mfa', req.url))
      }
    }
  }
  
  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
