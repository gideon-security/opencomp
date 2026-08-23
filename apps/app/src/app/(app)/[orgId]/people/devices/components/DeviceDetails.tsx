'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@trycompai/design-system';
import { ArrowLeft, Information } from '@trycompai/design-system/icons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@gideon-defender/ui/tooltip';
import { useTranslations } from 'next-intl';
import type { DeviceWithChecks } from '../types';
import {
  CANONICAL_DEVICE_CHECKS,
  CHECK_FIELDS,
  PLATFORM_LABELS,
  computeSourceComplianceVerdict,
  isDeviceOnline,
  sourceChecks,
  sourceVerdict,
  staleLabel,
  staleTooltipCopy,
  unverifiedTooltipCopy,
} from '../lib/device-source';
import { NotTrackedBadge } from './DeviceListCells';
import { RevokeAgentAccessDialog } from './RevokeAgentAccessDialog';

function DeviceComplianceBadge({ device }: { device: DeviceWithChecks }) {
  const t = useTranslations('people');
  if (device.source === 'integration') {
    // CompAI's verdict, computed from the source-reported CANONICAL checks —
    // the same standard as the Comp agent. The vendor's own overall verdict is
    // informational only (shown in the info grid below).
    const verdict = computeSourceComplianceVerdict(device);
    if (verdict === null || verdict.kind === 'not_tracked') {
      return <NotTrackedBadge device={device} />;
    }
    if (verdict.kind === 'non_compliant') {
      return <Badge variant="destructive">{t('devices.nonCompliant')}</Badge>;
    }
    if (verdict.kind === 'compliant') {
      return <Badge variant="default">{t('devices.compliant')}</Badge>;
    }
    return (
      <div className="flex items-center gap-1">
        <Badge variant="secondary">
          {t('devices.unverifiedChecks', {
            reported: verdict.reported,
            total: CANONICAL_DEVICE_CHECKS.length,
          })}
        </Badge>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={t('devices.whyUnverified')}
                className="inline-flex items-center text-muted-foreground hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <Information size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              {unverifiedTooltipCopy(device, verdict)}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }
  if (device.complianceStatus === 'stale') {
    return (
      <div className="flex items-center gap-1">
        <Badge variant="secondary">{staleLabel(device.daysSinceLastCheckIn)}</Badge>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={t('devices.whatDoesStaleMean')}
                className="inline-flex items-center text-muted-foreground hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <Information size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              {staleTooltipCopy(device.daysSinceLastCheckIn)}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }
  if (device.complianceStatus === 'compliant') {
    return <Badge variant="default">{t('devices.compliant')}</Badge>;
  }
  return <Badge variant="destructive">{t('devices.nonCompliant')}</Badge>;
}

interface DeviceDetailsProps {
  device: DeviceWithChecks;
  onClose: () => void;
}

export const DeviceDetails = ({ device, onClose }: DeviceDetailsProps) => {
  const t = useTranslations('people');
  const providerName = device.integrationProvider?.name ?? t('devices.integrationFallback');
  return (
    <Stack gap="4">
      <div>
        <Button variant="outline" size="sm" onClick={onClose}>
          <ArrowLeft size={16} />
          {t('devices.back')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                {/* Live status: agent devices report directly; imported devices
                    carry the provider's last-contact timestamp (lastSeenAt), so
                    the same rule applies — and stays consistent with the list. */}
                {(device.source === 'device_agent' ||
                  device.source === 'integration') && (
                  <span
                    className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                      isDeviceOnline(device.lastCheckIn)
                        ? 'bg-green-500'
                        : 'bg-gray-300'
                    }`}
                  />
                )}
                <Text size="lg" weight="semibold">
                  {device.name}
                </Text>
                {(device.source === 'device_agent' ||
                  device.source === 'integration') && (
                  <Badge variant="outline">
                    {isDeviceOnline(device.lastCheckIn)
                      ? t('devices.online')
                      : t('devices.offline')}
                  </Badge>
                )}
                {device.source === 'integration' && (
                  <Badge variant="outline">
                    {t('devices.importedFrom', { provider: providerName })}
                  </Badge>
                )}
                {device.source === 'fleet' && (
                  <Badge variant="outline">{t('devices.fleetLegacy')}</Badge>
                )}
              </div>
              <Text size="sm" variant="muted">
                {PLATFORM_LABELS[device.platform] ?? device.platform} {device.osVersion}
                {device.hardwareModel ? ` \u2022 ${device.hardwareModel}` : ''}
              </Text>
            </div>
            <div className="flex items-center gap-2">
              {device.source === 'device_agent' && device.hasActiveAgentSession && (
                <RevokeAgentAccessDialog deviceId={device.id} deviceName={device.name} />
              )}
              <DeviceComplianceBadge device={device} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Text size="sm" variant="muted">
                {t('devices.user')}
              </Text>
              <Text size="sm" weight="medium">
                {device.user.name}
              </Text>
              <Text size="xs" variant="muted">
                {device.user.email}
              </Text>
            </div>
            <div>
              <Text size="sm" variant="muted">
                {t('devices.hostname')}
              </Text>
              <Text size="sm" weight="medium">
                {device.hostname}
              </Text>
            </div>
            <div>
              <Text size="sm" variant="muted">
                {t('devices.serialNumber')}
              </Text>
              <Text size="sm" weight="medium">
                {device.serialNumber?.startsWith('fallback:')
                  ? t('devices.genericSerialNumber')
                  : (device.serialNumber ?? t('devices.notAvailable'))}
              </Text>
            </div>
            <div>
              <Text size="sm" variant="muted">
                {device.source === 'integration'
                  ? t('devices.lastSynced')
                  : t('devices.lastCheckIn')}
              </Text>
              <Text size="sm" weight="medium">
                {device.lastCheckIn
                  ? new Date(device.lastCheckIn).toLocaleString()
                  : t('devices.never')}
              </Text>
            </div>
            <div>
              <Text size="sm" variant="muted">
                {device.source === 'integration' ? t('devices.source') : t('devices.agentVersion')}
              </Text>
              <Text size="sm" weight="medium">
                {device.source === 'integration'
                  ? providerName
                  : (device.agentVersion ?? t('devices.notAvailable'))}
              </Text>
            </div>
            <div>
              <Text size="sm" variant="muted">
                {t('devices.installed')}
              </Text>
              <Text size="sm" weight="medium">
                {new Date(device.installedAt).toLocaleDateString()}
              </Text>
            </div>
            {/* The vendor's own overall verdict — informational only. It
                reflects the customer's MDM policy configuration; CompAI's
                Compliant badge above is computed from the canonical checks. */}
            {device.source === 'integration' && sourceVerdict(device) !== undefined && (
              <div>
                <Text size="sm" variant="muted">
                  {t('devices.providerVerdict', {
                    provider: device.integrationProvider?.name ?? t('devices.provider'),
                  })}
                </Text>
                <Text size="sm" weight="medium">
                  {t('devices.perOwnPolicies', {
                    verdict: sourceVerdict(device)
                      ? t('devices.compliant')
                      : t('devices.nonCompliant'),
                  })}
                </Text>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Table variant="bordered">
        <TableHeader>
          <TableRow>
            <TableHead>{t('devices.colCheck')}</TableHead>
            <TableHead>{t('devices.colDetails')}</TableHead>
            <TableHead>{t('devices.colResult')}</TableHead>
            <TableHead>{t('devices.colException')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Imported device: always render CompAI's FOUR canonical checks —
              filled from source data where reported, honest "Not reported"
              otherwise — then any extra provider-specific checks below. */}
          {device.source === 'integration' &&
            (() => {
              const provider =
                device.integrationProvider?.name ?? t('devices.theIntegration');
              const bySourceId = new Map(sourceChecks(device).map((c) => [c.id, c]));
              const canonicalIds = new Set<string>(
                CANONICAL_DEVICE_CHECKS.map((c) => c.id),
              );
              const extras = sourceChecks(device).filter((c) => !canonicalIds.has(c.id));
              return [
                ...CANONICAL_DEVICE_CHECKS.map(({ id, label }) => {
                  const reported = bySourceId.get(id);
                  return (
                    <TableRow key={id}>
                      <TableCell>
                        <Text size="sm" weight="medium">
                          {label}
                        </Text>
                      </TableCell>
                      <TableCell>
                        <Text size="sm" variant="muted">
                          {reported
                            ? t('devices.reportedBy', { provider })
                            : t('devices.notReportedBy', { provider })}
                        </Text>
                      </TableCell>
                      <TableCell>
                        {reported ? (
                          <Badge variant={reported.passed ? 'default' : 'destructive'}>
                            {reported.passed ? t('devices.pass') : t('devices.fail')}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">{t('devices.unverified')}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Text size="sm" variant="muted">
                          —
                        </Text>
                      </TableCell>
                    </TableRow>
                  );
                }),
                ...extras.map((check) => (
                  <TableRow key={check.id}>
                    <TableCell>
                      <Text size="sm" weight="medium">
                        {check.label}
                      </Text>
                    </TableCell>
                    <TableCell>
                      <Text size="sm" variant="muted">
                        {t('devices.reportedByInformational', { provider })}
                      </Text>
                    </TableCell>
                    <TableCell>
                      <Badge variant={check.passed ? 'default' : 'destructive'}>
                        {check.passed ? t('devices.pass') : t('devices.fail')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Text size="sm" variant="muted">
                        —
                      </Text>
                    </TableCell>
                  </TableRow>
                )),
              ];
            })()}
          {device.source !== 'integration' &&
          CHECK_FIELDS.map(({ key, dbKey, label }) => {
            const isUntracked =
              device.source === 'fleet' && key !== 'diskEncryptionEnabled';
            const untrackedCopy = t('devices.notTrackedByFleet');
            const isStale = device.complianceStatus === 'stale';
            const passed = device[key];
            const details = device.checkDetails?.[dbKey];
            return (
              <TableRow key={key}>
                <TableCell>
                  <Text size="sm" weight="medium">
                    {label}
                  </Text>
                </TableCell>
                <TableCell>
                  <Text size="sm" variant="muted">
                    {isUntracked
                      ? untrackedCopy
                      : isStale
                        ? '—'
                        : (details?.message ?? '—')}
                  </Text>
                </TableCell>
                <TableCell>
                  {isUntracked ? (
                    <Badge variant="outline">{t('devices.notAvailable')}</Badge>
                  ) : isStale ? (
                    <Badge
                      variant="secondary"
                      title={t('devices.staleUnknownTitle', { label })}
                    >
                      —
                    </Badge>
                  ) : (
                    <Badge variant={passed ? 'default' : 'destructive'}>
                      {passed ? t('devices.pass') : t('devices.fail')}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Text size="sm" variant="muted">
                    {isUntracked || isStale ? '—' : (details?.exception ?? '—')}
                  </Text>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Stack>
  );
};
