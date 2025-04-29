import {
  type Message,
  createDataStreamResponse,
  smoothStream,
  streamText,
} from 'ai';
import { auth } from '@/app/(auth)/auth';
import { systemPrompt } from '@/lib/ai/prompts';
import {
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import {
  generateUUID,
  getMostRecentUserMessage,
  sanitizeResponseMessages,
} from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { isProductionEnvironment } from '@/lib/constants';
import { NextResponse } from 'next/server';
import { myProvider } from '@/lib/ai/providers';

export const maxDuration = 60;

const { VECTORIZE_API_TOKEN, VECTORIZE_API } = process.env;
if (!VECTORIZE_API_TOKEN || !VECTORIZE_API) {
  throw new Error('VECTORIZE_API_TOKEN or VECTORIZE_API is not defined');
}

export async function POST(request: Request) {
  try {
    const {
      id,
      messages,
      selectedChatModel,
    }: {
      id: string;
      messages: Array<Message>;
      selectedChatModel: string;
    } = await request.json();

    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userMessage = getMostRecentUserMessage(messages);

    if (!userMessage) {
      return new Response('No user message found', { status: 400 });
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message: userMessage,
      });

      await saveChat({ id, userId: session.user.id, title });
    } else {
      if (chat.userId !== session.user.id) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    await saveMessages({
      messages: [{ ...userMessage, createdAt: new Date(), chatId: id }],
    });

    let fullPrompt = "";
    let currentMessage = messages[messages.length - 1].content;
    const base_prompt = `
    Tu sei un assistente esperto del Salento nel periodo alto-medioevale. 
    Rispondi alla seguente domanda utilizzando solo le informazioni fornite nel contesto.
    Se le informazioni nel contesto non sono sufficienti per rispondere alla domanda, dillo chiaramente.
    `
    try {
      const response = await fetch(VECTORIZE_API as string, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': VECTORIZE_API_TOKEN as string,
        },
        body: JSON.stringify({
          question: currentMessage,
          numResults: 5,
          rerank: true
        })
      });

      if (!response.ok) {
        throw new Error(`Errore nella richiesta a Vectorize: ${response.statusText}`);
      }

      const data = await response.json();

      let chunksText = "";
      data.documents.forEach((chunk: { chunk_id?: string, similarity?: number, text?: string }, index: number) => {
        const sourceId = chunk.chunk_id ?? (index + 1).toString();
        const similarity = chunk.similarity ?? 0;
        const text = chunk.text?.trim() ?? "";
        chunksText += `[source=${sourceId}&relevance=${similarity.toFixed(2)}]\n${text}\n\n`;
      });

      fullPrompt = `
      ${base_prompt}
      ${chunksText}
      
      Domanda: ${currentMessage}
    
      Risposta:
      `;
    } catch (error) {
      console.error("Errore nella richiesta a Vectorize:", error);
    }


    messages[messages.length - 1].content = fullPrompt;
    return createDataStreamResponse({
      execute: (dataStream) => {
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPrompt({ selectedChatModel }),
          messages,
          maxSteps: 5,
          experimental_activeTools:
            selectedChatModel === 'chat-model-reasoning'
              ? []
              : [
                'getWeather',
                'createDocument',
                'updateDocument',
                'requestSuggestions',
              ],
          experimental_transform: smoothStream({ chunking: 'word' }),
          experimental_generateMessageId: generateUUID,
          tools: {
            getWeather,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
            }),
          },
          onFinish: async ({ response, reasoning }) => {
            if (session.user?.id) {
              try {
                const sanitizedResponseMessages = sanitizeResponseMessages({
                  messages: response.messages,
                  reasoning,
                });

                await saveMessages({
                  messages: sanitizedResponseMessages.map((message) => {
                    return {
                      id: message.id,
                      chatId: id,
                      role: message.role,
                      content: message.content,
                      createdAt: new Date(),
                    };
                  }),
                });
              } catch (error) {
                console.error('Failed to save chat');
              }
            }
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
        });

        result.consumeStream();

        result.mergeIntoDataStream(dataStream, {
          sendReasoning: true,
        });
      },
      onError: () => {
        return 'Oops, an error occured!';
      },
    });
  } catch (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Not Found', { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await deleteChatById({ id });

    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    return new Response('An error occurred while processing your request', {
      status: 500,
    });
  }
}
