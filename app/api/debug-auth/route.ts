import { NextRequest, NextResponse } from 'next/server';
import { debugApiAuth } from '@/app/utils/apiAuth';

export async function GET(request: NextRequest) {
  try {
    const debugInfo = await debugApiAuth();
    return NextResponse.json(debugInfo);
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      hasClerkAuth: false,
      userId: null,
      userRole: null
    }, { status: 500 });
  }
}
