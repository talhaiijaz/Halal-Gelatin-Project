import { auth } from '@clerk/nextjs/server';
import { ConvexHttpClient } from 'convex/browser';

/**
 * Creates an authenticated Convex client for use in API routes.
 * This ensures that Convex functions receive the user's JWT token for authentication.
 * 
 * @returns An authenticated ConvexHttpClient instance
 * @throws Error if user is not authenticated or token cannot be obtained
 */
export async function createAuthenticatedConvexClient(): Promise<ConvexHttpClient> {
  // Get the JWT token from Clerk
  const { getToken } = await auth();
  const token = await getToken({ template: 'convex' });
  
  if (!token) {
    throw new Error('Authentication token not found. User may not be signed in or JWT template may be misconfigured.');
  }
  
  // Create an authenticated Convex client
  const authenticatedConvex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  authenticatedConvex.setAuth(token);
  
  return authenticatedConvex;
}

/**
 * Utility function to handle API routes that need to call Convex functions.
 * Combines authentication check with Convex client creation.
 * 
 * Usage:
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   try {
 *     const convex = await createAuthenticatedConvexClient();
 *     
 *     // Now you can call Convex functions with proper authentication
 *     const result = await convex.query(api.someFunction, { ... });
 *     
 *     return NextResponse.json(result);
 *   } catch (error) {
 *     // Handle authentication errors
 *   }
 * }
 * ```
 */
export { createAuthenticatedConvexClient as default };
