import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { openai } from '@ai-sdk/openai';
import { fireworks } from '@ai-sdk/fireworks';
import { isTestEnvironment } from '../constants';
import {
  artifactModel,
  chatModel,
  reasoningModel,
  titleModel,
} from './models.test';

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        'gpt-3.5-turbo': chatModel,
        'chat-model-large': chatModel,
        'chat-model-reasoning': reasoningModel,
        'title-model': titleModel,
        'artifact-model': artifactModel,
      },
    })
  : customProvider({
      languageModels: {
        'gpt-3.5-turbo': openai('gpt-3.5-turbo'),
        'chat-model-large': openai('gpt-4o'),
        'chat-model-reasoning': wrapLanguageModel({
          model: fireworks('accounts/fireworks/models/deepseek-r1'),
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        'title-model': openai('gpt-3.5-turbo'),
        'artifact-model': openai('gpt-3.5-turbo'),
      },
      imageModels: {
        'small-model': openai.image('dall-e-3'),
      },
    });
