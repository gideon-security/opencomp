import type { useTranslations } from 'next-intl';
import { z } from 'zod';

/**
 * Zod schema + ISO 27001 clause 5.1 (a)-(h) metadata for the Leadership and
 * Commitment narrative. The narrative is a `{ statement, commitments[] }` object
 * persisted via `hook.saveNarrative`.
 */
export type IsmsTranslator = ReturnType<typeof useTranslations<'isms'>>;

const leadershipCommitmentSchema = z.object({
  key: z.string().min(1),
  text: z.string(),
});

export const createLeadershipSchema = (t: IsmsTranslator) =>
  z.object({
    statement: z.string().min(1, t('leadership.statementRequired')),
    commitments: z.array(leadershipCommitmentSchema),
  });

export interface LeadershipNarrativeValues {
  statement: string;
  commitments: Array<{ key: string; text: string }>;
}

/** The eight leadership commitments mandated by ISO 27001 clause 5.1 (a)-(h). */
export interface LeadershipCommitmentMeta {
  key: string;
  clause: string;
}

export const LEADERSHIP_COMMITMENTS: LeadershipCommitmentMeta[] = [
  { key: 'a', clause: '5.1 (a)' },
  { key: 'b', clause: '5.1 (b)' },
  { key: 'c', clause: '5.1 (c)' },
  { key: 'd', clause: '5.1 (d)' },
  { key: 'e', clause: '5.1 (e)' },
  { key: 'f', clause: '5.1 (f)' },
  { key: 'g', clause: '5.1 (g)' },
  { key: 'h', clause: '5.1 (h)' },
];

/**
 * Merge the persisted narrative with the canonical (a)-(h) commitment list so the
 * form always renders all eight rows in a stable order, even when generation has
 * not yet populated every clause. Any persisted commitments beyond the canonical
 * a-h set (e.g. a Deputy SPO clause keyed 'i') are preserved so they survive a
 * save round-trip instead of being silently dropped.
 */
export function buildFormValues(
  narrative: Partial<LeadershipNarrativeValues> | null | undefined,
): LeadershipNarrativeValues {
  const persisted = Array.isArray(narrative?.commitments) ? narrative.commitments : [];
  const byKey = new Map(persisted.map((commitment) => [commitment.key, commitment.text]));
  const canonicalKeys = new Set(LEADERSHIP_COMMITMENTS.map((meta) => meta.key));

  const canonical = LEADERSHIP_COMMITMENTS.map((meta) => ({
    key: meta.key,
    text: byKey.get(meta.key) ?? '',
  }));
  const extra = persisted.filter((commitment) => !canonicalKeys.has(commitment.key));

  return {
    statement: typeof narrative?.statement === 'string' ? narrative.statement : '',
    commitments: [...canonical, ...extra],
  };
}
