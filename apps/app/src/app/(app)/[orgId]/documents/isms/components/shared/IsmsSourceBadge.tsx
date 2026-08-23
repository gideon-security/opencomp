'use client';

import { Badge } from '@trycompai/design-system';
import { useTranslations } from 'next-intl';

export type IsmsRowSource = 'derived' | 'manual';

export interface IsmsSourceBadgeProps {
  /** Where the row came from: platform-derived vs. human-edited. */
  source: IsmsRowSource;
  /** Raw provenance key (e.g. "framework:ISO 27001", "vendors") — humanized for display. */
  derivedFrom?: string | null;
}

type IsmsTranslator = ReturnType<typeof useTranslations<'isms'>>;

/** Raw provenance keys → their `isms.sourceBadge.provenance.*` message keys. */
const PROVENANCE_LABEL_KEYS: Record<string, Parameters<IsmsTranslator>[0]> = {
  vendors: 'sourceBadge.provenance.vendors',
  subprocessors: 'sourceBadge.provenance.subprocessors',
  members: 'sourceBadge.provenance.members',
  devices: 'sourceBadge.provenance.devices',
  customers: 'sourceBadge.provenance.customers',
  risks: 'sourceBadge.provenance.risks',
  training: 'sourceBadge.provenance.training',
};

/** Turn a raw `derivedFrom` key into a friendly source label (never shows "framework:" etc.). */
function humanizeProvenance(t: IsmsTranslator, derivedFrom?: string | null): string {
  if (!derivedFrom) return t('sourceBadge.autoDerived');
  if (derivedFrom.startsWith('framework:')) {
    const name = derivedFrom.slice('framework:'.length).trim();
    return name || t('sourceBadge.framework');
  }
  // Requirement rows are derived per interested party; the suffix is the party
  // name, shown verbatim (never the raw record id).
  if (derivedFrom.startsWith('party:')) {
    const name = derivedFrom.slice('party:'.length).trim();
    return name || t('sourceBadge.interestedParty');
  }
  if (derivedFrom.startsWith('wizard:')) return t('sourceBadge.wizard');
  const mapped = PROVENANCE_LABEL_KEYS[derivedFrom];
  if (mapped) return t(mapped);
  const cleaned = derivedFrom.replace(/[:_-]+/g, ' ').trim();
  return cleaned
    ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
    : t('sourceBadge.autoDerived');
}

/**
 * The shared provenance pill for an ISMS register entry. Derived rows show their
 * humanized source ("ISO 27001 framework", "Vendor register"); manual rows show
 * "Manual". Rendered as a plain tag-style pill (no icon) meant to sit beneath the
 * entry's description. This is the ONE place this language lives.
 */
export function IsmsSourceBadge({ source, derivedFrom }: IsmsSourceBadgeProps) {
  const t = useTranslations('isms');
  const label = source === 'manual' ? t('sourceBadge.manual') : humanizeProvenance(t, derivedFrom);
  return <Badge variant="secondary">{label}</Badge>;
}
