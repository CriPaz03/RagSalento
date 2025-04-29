import { auth } from "@/app/(auth)/auth";
import { ElevenLabsClient } from 'elevenlabs';

const { ELEVENLABS_API_KEY } = process.env;
if (!ELEVENLABS_API_KEY) {
  throw new Error('ELEVENLABS_API_KEY is not defined');
}

const clientElevenLabs = new ElevenLabsClient({
  apiKey: ELEVENLABS_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string') {
      return new Response('Text is required', { status: 400 });
    }

    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const audioStream = await clientElevenLabs.generate({
      text: text,
      voice: 'JBFqnCBsd6RMkjVDRZzb',
      model_id: 'eleven_multilingual_v2',
    });

    const chunks: Uint8Array[] = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);
    
    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Text-to-speech error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}