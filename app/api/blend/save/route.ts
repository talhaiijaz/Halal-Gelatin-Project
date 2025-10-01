import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../convex/_generated/api';
import { auth } from '@clerk/nextjs/server';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      targetBloomMin,
      targetBloomMax,
      targetMeanBloom,
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
