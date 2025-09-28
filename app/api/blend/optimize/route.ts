import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      targetBloomMin,
      targetBloomMax,
      targetMeanBloom,
      targetBags,
      includeOutsourceBatches,
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
        targetBags: targetBags ? Number(targetBags) : undefined,
        includeOutsourceBatches: includeOutsourceBatches || false,
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
