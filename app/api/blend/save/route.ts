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
      targetMesh,
      lotNumber,
      additionalTargets,
      selectedBatches,
      notes,
      fiscalYear
    } = body;

    if (!targetBloomMin || !targetBloomMax || !selectedBatches || selectedBatches.length === 0) {
      return NextResponse.json(
        { error: 'Target bloom range and selected batches are required' },
        { status: 400 }
      );
    }

    const blendId = await convex.mutation(api.blends.createBlend, {
        targetBloomMin: Number(targetBloomMin),
        targetBloomMax: Number(targetBloomMax),
        targetMeanBloom: targetMeanBloom ? Number(targetMeanBloom) : undefined,
        bloomSelectionMode: bloomSelectionMode || 'random-average',
        targetMesh: targetMesh ? Number(targetMesh) : undefined,
      lotNumber,
        additionalTargets,
        selectedBatches,
        notes,
        fiscalYear
      });

    return NextResponse.json({ 
      success: true, 
      blendId,
      message: 'Blend created successfully' 
    });
  } catch (error) {
    console.error('Blend save error:', error);
    return NextResponse.json(
      { error: 'Failed to save blend' },
      { status: 500 }
    );
  }
}
