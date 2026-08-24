'use client';

import { usePeopleActions } from '@/hooks/use-people-api';
import { usePermissions } from '@/hooks/use-permissions';
import {
  Button,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Stack,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@trycompai/design-system';
import { Download, Search } from '@trycompai/design-system/icons';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useSWRConfig } from 'swr';
import { RemoveDeviceAlert } from '../../all/components/RemoveDeviceAlert';
import { sourceKey, sourceLabel } from '../lib/device-source';
import { buildDevicesCsv, devicesCsvFilename, downloadDevicesCsv } from '../lib/devices-csv';
import type { DeviceWithChecks } from '../types';
import { DeviceDetails } from './DeviceDetails';
import { DeviceTableRow } from './DeviceListCells';

interface DeviceAgentDevicesListProps {
  devices: DeviceWithChecks[];
}

export const DeviceAgentDevicesList = ({ devices }: DeviceAgentDevicesListProps) => {
  const t = useTranslations('people');
  const { orgId } = useParams<{ orgId: string }>();
  const { removeDeviceAgent } = usePeopleActions();
  const { hasPermission } = usePermissions();
  const canRemoveDevice = hasPermission('member', 'delete');
  const { mutate } = useSWRConfig();
  const [selectedDevice, setSelectedDevice] = useState<DeviceWithChecks | null>(null);
  const [actionDevice, setActionDevice] = useState<DeviceWithChecks | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [isRemoveDeviceAlertOpen, setIsRemoveDeviceAlertOpen] = useState(false);
  const [isRemovingDevice, setIsRemovingDevice] = useState(false);

  // Distinct sources present, keyed by a stable id (so two providers that share
  // a display name don't collapse into one option) with a label for display.
  const sourceOptions = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const d of devices) byKey.set(sourceKey(d), sourceLabel(d));
    return Array.from(byKey, ([key, label]) => ({ key, label })).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [devices]);

  const filteredDevices = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return devices.filter((device) => {
      if (sourceFilter !== 'all' && sourceKey(device) !== sourceFilter) {
        return false;
      }
      if (!query) return true;
      return (
        device.name.toLowerCase().includes(query) ||
        device.user.name.toLowerCase().includes(query) ||
        device.user.email.toLowerCase().includes(query) ||
        device.platform.toLowerCase().includes(query)
      );
    });
  }, [devices, searchQuery, sourceFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredDevices.length / perPage));
  const paginatedDevices = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredDevices.slice(start, start + perPage);
  }, [filteredDevices, page, perPage]);

  function handleExport() {
    const contents = buildDevicesCsv(devices);
    const filename = devicesCsvFilename({ orgId });
    downloadDevicesCsv(filename, contents);
  }

  async function handleRemoveDevice() {
    if (!actionDevice) return;
    setIsRemovingDevice(true);
    try {
      await removeDeviceAgent(actionDevice.id);
      await mutate(
        ['people-agent-devices', orgId],
        (currentDevices: DeviceWithChecks[] | undefined) =>
          Array.isArray(currentDevices)
            ? currentDevices.filter((device) => device.id !== actionDevice.id)
            : currentDevices,
        false,
      );
      toast.success(t('devicesList.removedToast'));
      if (selectedDevice?.id === actionDevice.id) {
        setSelectedDevice(null);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('devicesList.removeFailedToast'));
    } finally {
      setIsRemovingDevice(false);
      setIsRemoveDeviceAlertOpen(false);
      setActionDevice(null);
    }
  }

  if (selectedDevice) {
    return <DeviceDetails device={selectedDevice} onClose={() => setSelectedDevice(null)} />;
  }

  if (devices.length === 0) {
    return null;
  }

  return (
    <Stack gap="4">
      <div className="flex w-full flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center md:max-w-[520px]">
          <div className="w-full sm:max-w-[300px]">
            <InputGroup>
              <InputGroupAddon>
                <Search size={16} />
              </InputGroupAddon>
              <InputGroupInput
                placeholder={t('devicesList.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
              />
            </InputGroup>
          </div>
          {(sourceOptions.length > 1 || sourceFilter !== 'all') && (
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              aria-label={t('devicesList.filterBySource')}
            >
              <option value="all">{t('devicesList.allSources')}</option>
              {sourceOptions.map(({ key, label }) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </div>
        <Button variant="outline" iconLeft={<Download />} onClick={handleExport}>
          {t('devicesList.exportCsv')}
        </Button>
      </div>

      {filteredDevices.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t('devicesList.emptyTitle')}</EmptyTitle>
            <EmptyDescription>{t('devicesList.emptyDescription')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table
          variant="bordered"
          pagination={{
            page,
            pageCount,
            onPageChange: setPage,
            pageSize: perPage,
            pageSizeOptions: [25, 50, 100],
            onPageSizeChange: (size) => {
              setPerPage(size);
              setPage(1);
            },
          }}
        >
          <TableHeader>
            <TableRow>
              <TableHead>{t('devicesList.colDeviceName')}</TableHead>
              <TableHead>{t('devicesList.colUser')}</TableHead>
              <TableHead>{t('devicesList.colPlatform')}</TableHead>
              <TableHead>{t('devicesList.colSource')}</TableHead>
              <TableHead>{t('devicesList.colLastSeen')}</TableHead>
              <TableHead>{t('devicesList.colChecks')}</TableHead>
              <TableHead>{t('devicesList.colCompliant')}</TableHead>
              <TableHead>{t('devicesList.colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedDevices.map((device) => (
              <DeviceTableRow
                key={device.id}
                device={device}
                orgId={orgId}
                canRemoveDevice={canRemoveDevice}
                onSelect={setSelectedDevice}
                onRequestRemove={(d) => {
                  setActionDevice(d);
                  setIsRemoveDeviceAlertOpen(true);
                }}
              />
            ))}
          </TableBody>
        </Table>
      )}
      <RemoveDeviceAlert
        open={isRemoveDeviceAlertOpen}
        title={t('devicesList.removeTitle')}
        description={
          <>
            {t('devicesList.removeDescription', {
              device: actionDevice?.name ?? t('devicesList.defaultDeviceName'),
            })}
            {actionDevice?.source === 'integration' && (
              <>
                {' '}
                {t('devicesList.integrationImportedNote', {
                  provider:
                    actionDevice.integrationProvider?.name ??
                    t('devicesList.defaultIntegrationName'),
                })}
              </>
            )}
          </>
        }
        onOpenChange={setIsRemoveDeviceAlertOpen}
        onRemove={handleRemoveDevice}
        isRemoving={isRemovingDevice}
      />
    </Stack>
  );
};
