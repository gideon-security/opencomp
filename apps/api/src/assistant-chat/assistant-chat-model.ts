import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import { ASSISTANT_OPENAI_PROVIDER_OPTIONS } from './openai-options';

export type AssistantChatModelConfig = {
  model: LanguageModel;
  providerOptions?: typeof ASSISTANT_OPENAI_PROVIDER_OPTIONS;
};

export function resolveAssistantChatModel(): AssistantChatModelConfig | null {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return { model: google('gemini-3.5-flash') };
  }

  if (process.env.OPENAI_API_KEY) {
    return {
      model: openai('gpt-5'),
      providerOptions: ASSISTANT_OPENAI_PROVIDER_OPTIONS,
    };
  }

  return null;
}
