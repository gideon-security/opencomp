import type { LanguageModel } from 'ai';
import { resolveAssistantChatModel } from './assistant-chat-model';

const ORIGINAL_ENV = process.env;

function modelIdOf(model: LanguageModel | undefined): string | undefined {
  return typeof model === 'object' ? model.modelId : undefined;
}

describe('resolveAssistantChatModel', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns null when no AI provider key is configured', () => {
    expect(resolveAssistantChatModel()).toBeNull();
  });

  it('prefers Gemini when the Google key is set', () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-google-key';
    const config = resolveAssistantChatModel();
    expect(config).not.toBeNull();
    expect(modelIdOf(config?.model)).toBe('gemini-3.5-flash');
    expect(config?.providerOptions).toBeUndefined();
  });

  it('falls back to OpenAI when only the OpenAI key is set', () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    const config = resolveAssistantChatModel();
    expect(config).not.toBeNull();
    expect(modelIdOf(config?.model)).toBe('gpt-5');
    expect(config?.providerOptions?.openai.store).toBe(false);
  });
});
