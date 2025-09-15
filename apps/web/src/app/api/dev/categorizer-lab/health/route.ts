import { NextResponse } from 'next/server';
import { isCategorizerLabEnabled } from '@/lib/flags';

// Force Node.js runtime for consistency
export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  if (!isCategorizerLabEnabled()) {
    return NextResponse.json(
      { available: false, message: 'Lab is disabled' },
      { status: 404 }
    );
  }
  
  return NextResponse.json({
    available: true,
    message: 'Categorizer lab is available',
    features: {
      pass1: true,
      pass2: !!process.env.GEMINI_API_KEY,
      hybrid: !!process.env.GEMINI_API_KEY,
    },
    environment: process.env.NODE_ENV,
  });
}