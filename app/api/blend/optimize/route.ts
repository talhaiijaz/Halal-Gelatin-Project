import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../convex/_generated/api';
import { requireApiProductionAccess } from '@/app/utils/apiAuth';
import { auth } from '@clerk/nextjs/server';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    // Check authentication and authorization
    await requireApiProductionAccess();
    
    // Get the JWT token from Clerk
    const { getToken } = await auth();
    const token = await getToken({ template: 'convex' });
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication token not found' },
        { status: 401 }
      );
    }
    
    // Create an authenticated Convex client
    const authenticatedConvex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    authenticatedConvex.setAuth(token);

    const body = await request.json();
    const {
      targetBloomMin,
      targetBloomMax,
      targetMeanBloom,
      targetBags,
      includeOutsourceBatches,
      onlyOutsourceBatches,
      fiscalYear,
      additionalTargets,
      preSelectedBatchIds,
    } = body;

    if (!targetBloomMin || !targetBloomMax) {
      return NextResponse.json(
        { error: 'Target bloom range is required' },
        { status: 400 }
      );
    }

      const result = await authenticatedConvex.query(api.blends.optimizeBatchSelection, {
        targetBloomMin: Number(targetBloomMin),
        targetBloomMax: Number(targetBloomMax),
        targetMeanBloom: targetMeanBloom ? Number(targetMeanBloom) : undefined,
        targetBags: targetBags ? Number(targetBags) : undefined,
        includeOutsourceBatches: includeOutsourceBatches || false,
        onlyOutsourceBatches: onlyOutsourceBatches || false,
        fiscalYear,
        additionalTargets,
        preSelectedBatchIds,
      });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Blend optimization error:', error);
    return NextResponse.json(
      { error: 'Failed to optimize batch selection' },
      { status: 500 }
    );
  }
}
