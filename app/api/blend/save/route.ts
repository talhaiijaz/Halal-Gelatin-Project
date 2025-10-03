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

    const blendId = await authenticatedConvex.mutation(api.blends.createBlend, {
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
