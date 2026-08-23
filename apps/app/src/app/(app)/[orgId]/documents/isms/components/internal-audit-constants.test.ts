import { describe, expect, it } from 'vitest';
import { parseProgramme } from './internal-audit-constants';
import type { InternalAuditTranslator } from './internal-audit-labels';
import {
  auditValidationMessages,
  conclusionSentence,
} from './internal-audit-labels';

// The helpers take a next-intl translator; under test the mock resolves keys
// verbatim, so a bare key-identity function satisfies the contract.
const t = ((key: string) => key) as unknown as InternalAuditTranslator;

describe('auditValidationMessages (clause 9.2 client mirror)', () => {
  it('requires at least one audit', () => {
    expect(auditValidationMessages(t, { audits: [] })).toEqual([
      'internalAuditValidation.noAuditsRecorded',
    ]);
  });

  it('requires a conclusion verdict on completed audits only', () => {
    expect(
      auditValidationMessages(t, {
        audits: [
          {
            reference: 'IA-2026-01',
            status: 'complete',
            conclusionVerdict: null,
          },
          {
            reference: 'IA-2026-02',
            status: 'planned',
            conclusionVerdict: null,
          },
        ],
      }),
    ).toEqual(['internalAuditValidation.missingVerdict']);
  });

  it('passes for a complete audit with a verdict', () => {
    expect(
      auditValidationMessages(t, {
        audits: [
          {
            reference: 'IA-2026-01',
            status: 'complete',
            conclusionVerdict: 'conform',
          },
        ],
      }),
    ).toEqual([]);
  });
});

describe('conclusionSentence', () => {
  it('assembles the ticket template around the chosen verdict', () => {
    expect(conclusionSentence(t, 'conform')).toBe(
      'internalAuditValidation.conclusions.conform',
    );
    expect(conclusionSentence(t, 'substantially_conform')).toBe(
      'internalAuditValidation.conclusions.substantiallyConform',
    );
    expect(conclusionSentence(t, 'not_yet_conform')).toBe(
      'internalAuditValidation.conclusions.notYetConform',
    );
  });
});

describe('parseProgramme', () => {
  it('reads the programme out of a valid narrative', () => {
    expect(parseProgramme({ programme: 'Annual audit of the whole ISMS.' })).toBe(
      'Annual audit of the whole ISMS.',
    );
  });

  it('returns an empty string for missing or foreign narratives', () => {
    expect(parseProgramme(null)).toBe('');
    expect(parseProgramme({ statement: 'a leadership narrative' })).toBe('');
    expect(parseProgramme({ programme: 42 })).toBe('');
  });
});
