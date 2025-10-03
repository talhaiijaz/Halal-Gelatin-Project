import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiProductionAccess } from '@/app/utils/apiAuth';

// Allow longer processing time for PDF extraction
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // Check authentication and authorization
    await requireApiProductionAccess();

    const formData = await request.formData();
    const file = (formData as any).get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
    }

    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size must be less than 10MB' }, { status: 400 });
    }

    // Gate sending files to OpenAI behind explicit consent header/flag
    const consent = request.headers.get('x-allow-external-ai') === 'true';
    if (!consent) {
      return NextResponse.json({ error: 'External AI processing not authorized' }, { status: 403 });
    }

    // Convert file to buffer for AI SDK
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log('PDF file size:', file.size, 'bytes');
    console.log('Processing PDF with AI SDK...');

    // Extract only tabular data - fastest approach!
    let extractedText: string;

    try {
      const extractionResult = await generateText({
        model: openai('gpt-4o'),
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extract ALL batch data rows from this PDF document. This is a product analysis report with batch data.

IMPORTANT: Extract EVERY batch row that contains actual batch data, regardless of how many there are.

Extract ALL:
- Every batch data row with sequential batch numbers (could be 1-18, 1-20, or any range)
- All numerical values and measurements for each batch row
- Batch numbers and identifiers for each batch row
- Include ALL batches in the main data table, even if some cells are empty

DO NOT include:
- SR numbers or Serial numbers (skip the first column if it contains SR/Serial)
- Average rows or summary rows
- Total rows or aggregated data
- Blending sections or lot number data (like "Lot num" sections)
- Range categories (like "201-220", "221-240", etc.)
- Footer information or document metadata

CONTINUE extracting until you have captured ALL batch rows in the main data table. Do not stop early - make sure you get the complete set of batch data.

Format as a structured table with clear column separators. Start with Batch number as the first column, then all the measurement data. Include ALL batch data rows, even if some cells appear empty. Do not provide summaries or analysis - just the raw batch data for every single batch.`,
              },
              {
                type: 'file',
                data: buffer,
                mediaType: 'application/pdf',
                filename: file.name,
              },
            ],
          },
        ],
        temperature: 0.1, // Very low temperature for accurate data extraction
      });

      extractedText = extractionResult.text;

    } catch (error) {
      console.error('PDF extraction error:', error);
      extractedText = 'Unable to extract tabular data from the PDF.';
    }

    const result = {
      text: extractedText,
      summary: 'Tabular data extraction completed.',
      keyPoints: ['Raw tabular data extracted from PDF'],
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        extractedAt: new Date().toLocaleString(),
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    // Log full error server-side only
    console.error('PDF extraction error');
    
    const message = error instanceof Error ? error.message : 'Failed to process PDF';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

