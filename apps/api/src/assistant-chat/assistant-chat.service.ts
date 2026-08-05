import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { withTenantRedis } from '../redis/tenant-redis.client';
import type { AssistantChatMessage } from './assistant-chat.types';

const StoredMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  text: z.string(),
  createdAt: z.number(),
});

const StoredMessagesSchema = z.array(StoredMessageSchema);

type GetAssistantChatKeyParams = {
  organizationId: string;
  userId: string;
};

const getAssistantChatKey = ({ userId }: { userId: string }): string => {
  // Org scoping is enforced by withTenantRedis, which namespaces the key as
  // `app:{organizationId}:assistant-chat:v1:{userId}`.
  return `assistant-chat:v1:${userId}`;
};

@Injectable()
export class AssistantChatService {
  /**
   * Default TTL is 7 days. This is intended to behave like "session context"
   * rather than a long-term, searchable archive.
   */
  private readonly ttlSeconds = Number(
    process.env.ASSISTANT_CHAT_TTL_SECONDS ?? 60 * 60 * 24 * 7,
  );

  async getHistory(
    params: GetAssistantChatKeyParams,
  ): Promise<AssistantChatMessage[]> {
    const key = getAssistantChatKey(params);
    return withTenantRedis(params.organizationId, async (redis) => {
      const raw = await redis.get<unknown>(key);
      const parsed = StoredMessagesSchema.safeParse(raw);
      if (!parsed.success) return [];
      return parsed.data;
    });
  }

  async saveHistory(
    params: GetAssistantChatKeyParams,
    messages: AssistantChatMessage[],
  ): Promise<void> {
    const key = getAssistantChatKey(params);
    // Always validate before writing to keep the cache shape stable.
    const validated = StoredMessagesSchema.parse(messages);
    await withTenantRedis(params.organizationId, async (redis) => {
      await redis.set(key, validated, { ex: this.ttlSeconds });
    });
  }

  async clearHistory(params: GetAssistantChatKeyParams): Promise<void> {
    const key = getAssistantChatKey(params);
    await withTenantRedis(params.organizationId, async (redis) => {
      await redis.del(key);
    });
  }
}
