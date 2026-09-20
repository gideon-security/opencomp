import { google } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';

type AssistantChatModelConfig = {
  model: LanguageModel;
};

export function resolveAssistantChatModel(): AssistantChatModelConfig | null {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return { model: google('gemini-3.8-flash') };
  }

  return null;
}
