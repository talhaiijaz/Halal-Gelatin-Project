import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { NextRequest, NextResponse } from 'next/server';

// Allow longer processing time for PDF extraction
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

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
                text: `Extract ONLY the individual data rows from this PDF document. This appears to be a product analysis report with batch data.

Extract:
- All table headers (column names)
- ONLY the individual data rows with their measurements
- All numerical values and measurements for each row
- Batch numbers and identifiers for each row

DO NOT include:
- Average rows
- Summary rows
- Total rows
- Any aggregated data

Format as a structured table with clear column separators. Include only the individual data rows, even if some cells appear empty. Do not provide summaries or analysis - just the raw row data.`,
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
    console.error('PDF extraction error:', error);
    
    // Provide more specific error information
    let errorMessage = 'Failed to process PDF';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: error instanceof Error ? error.stack : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

