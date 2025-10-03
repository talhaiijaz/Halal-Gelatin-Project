import { NextRequest, NextResponse } from 'next/server';
import { api } from '../../../../convex/_generated/api';
import { requireApiProductionAccess } from '@/app/utils/apiAuth';
import { createAuthenticatedConvexClient } from '@/app/utils/convexAuth';

export async function POST(request: NextRequest) {
  try {
    // Check authentication and authorization
    await requireApiProductionAccess();
    
    // Create an authenticated Convex client
    const convex = await createAuthenticatedConvexClient();

    const body = await request.json();
    const {
      targetBloomMin,
      targetBloomMax,
      targetMeanBloom,
      bloomSelectionMode,
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

      const result = await convex.query(api.blends.optimizeBatchSelection, {
        targetBloomMin: Number(targetBloomMin),
        targetBloomMax: Number(targetBloomMax),
        targetMeanBloom: targetMeanBloom ? Number(targetMeanBloom) : undefined,
        bloomSelectionMode: bloomSelectionMode || 'random-average',
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
