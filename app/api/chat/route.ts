import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { requireApiProductionAccess } from '@/app/utils/apiAuth';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    // Check authentication and authorization
    await requireApiProductionAccess();

    const { messages } = await req.json();

    const result = await streamText({
      model: openai('gpt-4o'),
      messages,
      temperature: 0.7,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process chat request' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
