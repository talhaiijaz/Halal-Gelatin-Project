# API Authentication Guide

## Overview

This guide explains how to properly handle authentication in Next.js API routes that need to call Convex functions. The key issue is ensuring that the user's JWT token is passed from Clerk to Convex for proper authentication.

## The Problem

When API routes call Convex functions that require authentication (like those using `requireRole` or `getCurrentUser`), the Convex functions receive an "User not authenticated" error because the `ConvexHttpClient` doesn't automatically include the user's JWT token.

## The Solution

Use the `createAuthenticatedConvexClient()` utility function to create a Convex client that includes the user's authentication token.

## Implementation

### 1. Import the Utility

```typescript
import { createAuthenticatedConvexClient } from '@/app/utils/convexAuth';
```

### 2. Create Authenticated Client

```typescript
export async function POST(request: NextRequest) {
  try {
    // Check authentication and authorization first
    await requireApiProductionAccess();
    
    // Create an authenticated Convex client
    const convex = await createAuthenticatedConvexClient();
    
    // Now you can call Convex functions with proper authentication
    const result = await convex.query(api.someFunction, { ... });
    
    return NextResponse.json(result);
  } catch (error) {
    // Handle errors
  }
}
```

### 3. Complete Example

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { api } from '../../../../convex/_generated/api';
import { requireApiProductionAccess } from '@/app/utils/apiAuth';
import { createAuthenticatedConvexClient } from '@/app/utils/convexAuth';

export async function POST(request: NextRequest) {
  try {
    // Step 1: Check authentication and authorization
    await requireApiProductionAccess();
    
    // Step 2: Create authenticated Convex client
    const convex = await createAuthenticatedConvexClient();

    // Step 3: Parse request data
    const body = await request.json();
    const { someParam } = body;

    // Step 4: Call Convex functions (now properly authenticated)
    const result = await convex.query(api.myFunction.query, { someParam });
    
    // Step 5: Return response
    return NextResponse.json(result);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
```

## Files That Need This Pattern

Any API route that calls Convex functions should use this pattern. Currently implemented in:

- ✅ `app/api/blend/optimize/route.ts`
- ✅ `app/api/blend/save/route.ts` 
- ✅ `app/api/blend/pdf/route.ts`

## Files That Don't Need This Pattern

API routes that don't call Convex functions don't need this pattern:

- ✅ `app/api/pdf/extract/route.ts` (calls OpenAI, not Convex)
- ✅ `app/api/chat/route.ts` (calls OpenAI, not Convex)

## Authentication Flow

```
1. Frontend → User signs in with Clerk
2. API Route → Gets JWT token from Clerk using auth().getToken()
3. Convex Client → Receives JWT token via setAuth(token)
4. Convex Function → Can access user identity via getCurrentUser()
5. Database → User permissions are properly checked
```

## Error Handling

The `createAuthenticatedConvexClient()` function will throw an error if:

- User is not authenticated with Clerk
- JWT token cannot be obtained (check JWT template configuration)
- Convex URL is not configured

## JWT Template Configuration

Ensure your Clerk JWT template includes the email claim:

```json
{
  "aud": "convex",
  "sub": "{{user.id}}",
  "email": "{{user.primary_email_address.email_address}}",
  "email_verified": "{{user.primary_email_address.verification.status}}"
}
```

## Best Practices

1. **Always check authentication first**: Use `requireApiProductionAccess()` or similar before creating the Convex client
2. **Use the utility function**: Don't manually create authenticated clients
3. **Handle errors gracefully**: The utility function throws descriptive errors
4. **Keep it consistent**: Use this pattern for all API routes that call Convex functions

## Troubleshooting

### "Authentication token not found"
- User may not be signed in
- JWT template may be misconfigured
- Check Clerk dashboard for JWT template settings

### "User not authenticated" in Convex
- Make sure you're using `createAuthenticatedConvexClient()`
- Don't use the regular `ConvexHttpClient` for authenticated requests
- Verify the JWT token is being passed correctly

### "User not found in database"
- User exists in Clerk but not in Convex
- Check user creation process
- Verify email addresses match between Clerk and Convex

## Future Development

When creating new API routes that call Convex functions:

1. Import the utility function
2. Check authentication first
3. Create authenticated Convex client
4. Call Convex functions
5. Return response

This ensures consistent authentication across the entire platform.
