export const DEFAULT_CHAT_MODEL: string = 'gpt-3.5-turbo';

interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'gpt-3.5-turbo',
    name: 'gpt-3.5-turbo',
    description: 'Small model for fast, lightweight tasks',
  },
];
