'use client';

import { useApi } from '@/hooks/use-api';
import {
  useIntegrationConnection,
  useIntegrationMutations,
} from '@/hooks/use-integration-platform';
import { usePermissions } from '@/hooks/use-permissions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@gideon-defender/ui/dialog';
import {
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  cn,
} from '@trycompai/design-system';
import { TrashCan } from '@trycompai/design-system/icons';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { ScanModeSwitchDialog } from './ScanModeSwitchDialog';
import type { AwsScanModeChoice } from '../../integrations/[slug]/components/AwsScanModeStep';

interface CloudProvider {
  id: string;
  connectionId: string;
  name: string;
  status: string;
  accountId?: string;
  regions?: string[];
  isLegacy?: boolean;
}

interface CloudSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectedProviders: CloudProvider[];
  onUpdate: () => void;
}

const getStatusColorClass = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'active':
      return 'text-green-600 dark:text-green-400';
    case 'error':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-muted-foreground';
  }
};

export function CloudSettingsModal({
  open,
  onOpenChange,
  connectedProviders,
  onUpdate,
}: CloudSettingsModalProps) {
  const t = useTranslations('integrations.list');
  const api = useApi();
  const { hasPermission } = usePermissions();
  const canDelete = hasPermission('integration', 'delete');
  // Scan-mode switch is an UPDATE operation (the API endpoint is
  // gated by integration:update — see CloudSecurityController.updateAwsScanMode),
  // so the UI must use update permission, NOT delete permission. Using
  // canDelete here would silently block valid update users from seeing
  // the "Switch" button even though the API would accept their request.
  const canUpdate = hasPermission('integration', 'update');
  const [activeProvider, setActiveProvider] = useState<string>(connectedProviders[0]?.connectionId || '');
  const [isDeleting, setIsDeleting] = useState(false);
  const { deleteConnection } = useIntegrationMutations();

  const currentProvider = connectedProviders.find((p) => p.connectionId === activeProvider) ?? connectedProviders[0];

  const handleDisconnect = async (provider: CloudProvider) => {
    if (!confirm(t('cloudTests_confirmDisconnectScanResults'))) return;

    try {
      setIsDeleting(true);
      if (provider.isLegacy) {
        const response = await api.delete(`/v1/cloud-security/legacy/${provider.connectionId}`);
        if (!response.error) {
          toast.success(t('cloudTests_providerDisconnected'));
          onUpdate();
          onOpenChange(false);
        } else {
          toast.error(t('cloudTests_failedToDisconnect'));
        }
        return;
      }
      const result = await deleteConnection(provider.connectionId);
      if (result.success) {
        toast.success(t('cloudTests_providerDisconnected'));
        onUpdate();
        onOpenChange(false);
      } else {
        toast.error(result.error || t('cloudTests_failedToDisconnect'));
      }
    } catch {
      toast.error(t('cloudTests_unexpectedError'));
    } finally {
      setIsDeleting(false);
    }
  };

  if (connectedProviders.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('cloudTests_connectionSettings')}</DialogTitle>
          <DialogDescription>
            {t('cloudTests_connectionSettingsDescription')}
          </DialogDescription>
        </DialogHeader>

        {/* Provider selector (if multiple) */}
        {connectedProviders.length > 1 && (
          <Tabs value={activeProvider} onValueChange={setActiveProvider}>
            {/* Scroll the account strip horizontally so connections beyond the
                modal width stay reachable. TabsList is `w-fit`, so without a
                width-constrained scroll container it overflows the dialog and
                the extra accounts get clipped (the modal has overflow-hidden).
                TabsList doesn't accept className, hence the wrapper. */}
            <div className="w-full overflow-x-auto">
              <TabsList variant="default">
                {connectedProviders.map((p) => (
                  <TabsTrigger key={p.connectionId} value={p.connectionId}>
                    {p.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </Tabs>
        )}

        {currentProvider && (
          <ConnectionTab
            provider={currentProvider}
            canDelete={canDelete}
            canUpdate={canUpdate}
            isDeleting={isDeleting}
            onDisconnect={handleDisconnect}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Connection Tab ─────────────────────────────────────────────────────

const UPDATE_CREDENTIALS_HINT_KEY: Record<string, 'cloudTests_updateCredsAws' | 'cloudTests_updateCredsGcp' | 'cloudTests_updateCredsAzure'> = {
  aws: 'cloudTests_updateCredsAws',
  gcp: 'cloudTests_updateCredsGcp',
  azure: 'cloudTests_updateCredsAzure',
};

function ConnectionTab({
  provider,
  canDelete,
  canUpdate,
  isDeleting,
  onDisconnect,
}: {
  provider: CloudProvider;
  canDelete: boolean;
  canUpdate: boolean;
  isDeleting: boolean;
  onDisconnect: (p: CloudProvider) => void;
}) {
  const t = useTranslations('integrations.list');
  return (
    <div className="space-y-4 pt-3">
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{t('cloudTests_status')}</span>
          <span className={cn('text-sm capitalize font-medium', getStatusColorClass(provider.status))}>
            {provider.status}
          </span>
        </div>
        {provider.accountId && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('cloudTests_account')}</span>
            <span className="text-sm font-mono">{provider.accountId}</span>
          </div>
        )}
        {provider.regions && provider.regions.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('cloudTests_regions')}</span>
            <span className="text-sm">{t('cloudTests_regionCount', { count: provider.regions.length })}</span>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {t(UPDATE_CREDENTIALS_HINT_KEY[provider.id] ?? 'cloudTests_updateCredsAws')}
      </p>

      {/* AWS-only — scan engine switcher. Lets the customer change between
          OpenComp scanners and Security Hub on an existing connection.
          Surfaces the current mode + a "Change" button that opens
          ScanModeSwitchDialog with the right confirmation copy.

          Gated by `canUpdate` (integration:update) — matches the API
          endpoint at PATCH /v1/cloud-security/connections/:id/scan-mode.
          Using canDelete here would silently block users who legitimately
          have update permission. */}
      {provider.id === 'aws' && !provider.isLegacy && (
        <AwsScanModeSection connectionId={provider.connectionId} canEdit={canUpdate} />
      )}

      {canDelete && (
        <Button
          variant="destructive"
          onClick={() => onDisconnect(provider)}
          disabled={isDeleting}
          loading={isDeleting}
          iconLeft={!isDeleting ? <TrashCan size={16} /> : undefined}
        >
          {isDeleting ? t('cloudTests_disconnecting') : t('cloudTests_disconnect')}
        </Button>
      )}
    </div>
  );
}

// ─── AWS Scan Mode Section ──────────────────────────────────────────────

/**
 * Renders the current scan engine for an AWS connection and a "Change"
 * button that opens the switch dialog. Reads the connection's
 * `variables.awsScanMode` to determine the current mode, falling back
 * to 'comp_scanners' when the field is missing (pre-feature connections).
 */
function AwsScanModeSection({
  connectionId,
  canEdit,
}: {
  connectionId: string;
  canEdit: boolean;
}) {
  const t = useTranslations('integrations.list');
  const { connection, isLoading, refresh } = useIntegrationConnection(connectionId);
  const [switchDialogOpen, setSwitchDialogOpen] = useState(false);

  if (isLoading || !connection) {
    return null;
  }

  // awsScanMode lives in metadata (non-secret, frontend-readable),
  // mirroring how `awsType`, `roleArn`, `regions` are surfaced. Missing
  // field = today's default = comp_scanners.
  const metadata = (connection.metadata ?? {}) as Record<string, unknown>;
  const currentMode: AwsScanModeChoice =
    metadata.awsScanMode === 'security_hub' ? 'security_hub' : 'comp_scanners';
  const targetMode: AwsScanModeChoice =
    currentMode === 'comp_scanners' ? 'security_hub' : 'comp_scanners';
  const currentLabel =
    currentMode === 'security_hub'
      ? t('cloudTests_scanModeSecurityHub')
      : t('cloudTests_scanModeCompScanners');
  const targetLabel =
    targetMode === 'security_hub'
      ? t('cloudTests_scanModeSecurityHub')
      : t('cloudTests_scanModeCompScanners');

  return (
    <>
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t('cloudTests_scanEngine')}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {currentLabel}
            </p>
          </div>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSwitchDialogOpen(true)}
            >
              {t('cloudTests_switchTo', { mode: targetLabel })}
            </Button>
          )}
        </div>
      </div>
      <ScanModeSwitchDialog
        open={switchDialogOpen}
        onOpenChange={setSwitchDialogOpen}
        connectionId={connectionId}
        currentMode={currentMode}
        targetMode={targetMode}
        onSwitched={() => {
          refresh();
        }}
      />
    </>
  );
}
