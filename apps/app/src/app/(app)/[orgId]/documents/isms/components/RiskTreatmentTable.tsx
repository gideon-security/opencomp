'use client';

import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@trycompai/design-system';
import { useTranslations } from 'next-intl';
import type { IsmsAcceptanceState } from '../isms-types';

/** The columns shared by the organisational and supplier risk tables. */
export interface RiskTreatmentTableRow {
  /** First cell: risk reference (R-01) or vendor name. */
  key: string;
  title: string;
  category: string;
  inherentLevel: string;
  treatment: string;
  controls: string;
  ownerName: string;
  residualLevel: string;
  acceptance: string;
  acceptanceState: IsmsAcceptanceState;
  status: string;
}

const ACCEPTANCE_BADGE: Record<IsmsAcceptanceState, { variant: 'accent' | 'secondary' | 'destructive' }> = {
  accepted: { variant: 'accent' },
  awaiting: { variant: 'secondary' },
  stale: { variant: 'destructive' },
};

interface RiskTreatmentTableProps {
  /** Header of the first column ("Ref" for risks, "Vendor" for suppliers). */
  keyHeader: string;
  /** Hide the description column for vendors (the key cell is the name). */
  showTitle: boolean;
  rows: RiskTreatmentTableRow[];
  emptyText: string;
}

export function RiskTreatmentTable({
  keyHeader,
  showTitle,
  rows,
  emptyText,
}: RiskTreatmentTableProps) {
  const t = useTranslations('isms');
  const acceptanceLabels: Record<IsmsAcceptanceState, string> = {
    accepted: t('riskTreatment.accepted'),
    awaiting: t('riskTreatment.awaitingAcceptance'),
    stale: t('riskTreatment.stale'),
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-md border py-8 text-center">
        <Text variant="muted">{emptyText}</Text>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{keyHeader}</TableHead>
            {showTitle && <TableHead>{t('riskTreatment.columns.description')}</TableHead>}
            <TableHead>{t('riskTreatment.columns.category')}</TableHead>
            <TableHead>{t('riskTreatment.columns.inherent')}</TableHead>
            <TableHead>{t('riskTreatment.columns.treatment')}</TableHead>
            <TableHead>{t('riskTreatment.columns.controlsActions')}</TableHead>
            <TableHead>{t('riskTreatment.columns.owner')}</TableHead>
            <TableHead>{t('riskTreatment.columns.residual')}</TableHead>
            <TableHead>{t('riskTreatment.columns.acceptance')}</TableHead>
            <TableHead>{t('riskTreatment.columns.status')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const badge = ACCEPTANCE_BADGE[row.acceptanceState];
            return (
              // Index-suffixed: two vendors can share a display name.
              <TableRow key={`${row.key}-${index}`}>
                <TableCell>
                  <span className="font-medium">{row.key}</span>
                </TableCell>
                {showTitle && (
                  <TableCell>
                    <span className="block min-w-40 whitespace-normal">{row.title}</span>
                  </TableCell>
                )}
                <TableCell>{row.category}</TableCell>
                <TableCell>{row.inherentLevel}</TableCell>
                <TableCell>{row.treatment}</TableCell>
                <TableCell>
                  <span className="block min-w-48 max-w-md whitespace-normal">
                    {row.controls}
                  </span>
                </TableCell>
                <TableCell>{row.ownerName}</TableCell>
                <TableCell>{row.residualLevel}</TableCell>
                <TableCell>
                  <span className="flex min-w-40 flex-col items-start gap-1">
                    <Badge variant={badge.variant}>
                      {acceptanceLabels[row.acceptanceState]}
                    </Badge>
                    {row.acceptanceState !== 'awaiting' && (
                      <span className="whitespace-normal text-xs text-muted-foreground">
                        {row.acceptance}
                      </span>
                    )}
                  </span>
                </TableCell>
                <TableCell>{row.status}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
