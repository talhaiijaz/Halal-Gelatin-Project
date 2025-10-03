# Authentication Quick Reference

## For API Routes That Call Convex Functions

### ✅ Correct Pattern
```typescript
import { createAuthenticatedConvexClient } from '@/app/utils/convexAuth';
import { requireApiProductionAccess } from '@/app/utils/apiAuth';

export async function POST(request: NextRequest) {
  try {
    await requireApiProductionAccess();
    const convex = await createAuthenticatedConvexClient();
    const result = await convex.query(api.someFunction, { ... });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

### ❌ Wrong Pattern (Will Cause "User not authenticated" Error)
```typescript
import { ConvexHttpClient } from 'convex/browser';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  // This will fail because no JWT token is passed to Convex
  const result = await convex.query(api.someFunction, { ... });
}
```

## Checklist for New API Routes

- [ ] Import `createAuthenticatedConvexClient` from `@/app/utils/convexAuth`
- [ ] Call `await requireApiProductionAccess()` first
- [ ] Create authenticated client with `await createAuthenticatedConvexClient()`
- [ ] Use the authenticated client for all Convex function calls
- [ ] Handle errors appropriately

## Files Already Updated

- ✅ `app/api/blend/optimize/route.ts`
- ✅ `app/api/blend/save/route.ts`
- ✅ `app/api/blend/pdf/route.ts`

## Files That Don't Need This Pattern

- ✅ `app/api/pdf/extract/route.ts` (no Convex calls)
- ✅ `app/api/chat/route.ts` (no Convex calls)
