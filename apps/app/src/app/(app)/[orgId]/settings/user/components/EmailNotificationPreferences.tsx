'use client';

import {
  Button,
  Checkbox,
  HStack,
  Section,
  Stack,
  Text,
} from '@trycompai/design-system';
import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { useEmailPreferences } from '../hooks/useEmailPreferences';

interface EmailPreferences {
  policyNotifications: boolean;
  taskReminders: boolean;
  weeklyTaskDigest: boolean;
  unassignedItemsNotifications: boolean;
  taskMentions: boolean;
  taskAssignments: boolean;
}

interface RoleNotifications {
  policyNotifications: boolean;
  taskReminders: boolean;
  taskAssignments: boolean;
  taskMentions: boolean;
  weeklyTaskDigest: boolean;
  findingNotifications: boolean;
}

interface Props {
  initialPreferences: EmailPreferences;
  email: string;
  isAdminOrOwner?: boolean;
  roleNotifications?: RoleNotifications | null;
}

interface NotificationItem {
  key: keyof EmailPreferences;
  roleKey?: keyof RoleNotifications;
}

const NOTIFICATION_ITEMS: NotificationItem[] = [
  { key: 'policyNotifications', roleKey: 'policyNotifications' },
  { key: 'taskReminders', roleKey: 'taskReminders' },
  { key: 'weeklyTaskDigest', roleKey: 'weeklyTaskDigest' },
  { key: 'unassignedItemsNotifications' },
  { key: 'taskMentions', roleKey: 'taskMentions' },
  { key: 'taskAssignments', roleKey: 'taskAssignments' },
];

type SettingsTranslator = ReturnType<typeof useTranslations<'settings'>>;

function itemLabel(t: SettingsTranslator, item: NotificationItem): string {
  switch (item.key) {
    case 'policyNotifications':
      return t('emailPrefs.items.policyNotifications.label');
    case 'taskReminders':
      return t('emailPrefs.items.taskReminders.label');
    case 'weeklyTaskDigest':
      return t('emailPrefs.items.weeklyTaskDigest.label');
    case 'unassignedItemsNotifications':
      return t('emailPrefs.items.unassignedItemsNotifications.label');
    case 'taskMentions':
      return t('emailPrefs.items.taskMentions.label');
    case 'taskAssignments':
      return t('emailPrefs.items.taskAssignments.label');
  }
}

function itemDescription(t: SettingsTranslator, item: NotificationItem): string {
  switch (item.key) {
    case 'policyNotifications':
      return t('emailPrefs.items.policyNotifications.description');
    case 'taskReminders':
      return t('emailPrefs.items.taskReminders.description');
    case 'weeklyTaskDigest':
      return t('emailPrefs.items.weeklyTaskDigest.description');
    case 'unassignedItemsNotifications':
      return t('emailPrefs.items.unassignedItemsNotifications.description');
    case 'taskMentions':
      return t('emailPrefs.items.taskMentions.description');
    case 'taskAssignments':
      return t('emailPrefs.items.taskAssignments.description');
  }
}

export function EmailNotificationPreferences({
  initialPreferences,
  email,
  isAdminOrOwner = true,
  roleNotifications,
}: Props) {
  const t = useTranslations('settings');
  const { savePreferences } = useEmailPreferences({ initialPreferences });
  const [preferences, setPreferences] =
    useState<EmailPreferences>(initialPreferences);
  const [saving, setSaving] = useState(false);

  const handleToggle = (key: keyof EmailPreferences, checked: boolean) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: checked,
    }));
  };

  const handleSelectAll = () => {
    const allEnabled = Object.values(preferences).every((v) => v === true);
    setPreferences({
      policyNotifications: !allEnabled,
      taskReminders: !allEnabled,
      weeklyTaskDigest: !allEnabled,
      unassignedItemsNotifications: !allEnabled,
      taskMentions: !allEnabled,
      taskAssignments: !allEnabled,
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await savePreferences(preferences);
      toast.success(t('emailPrefs.savedToast'));
    } catch {
      toast.error(t('emailPrefs.saveFailedToast'));
    } finally {
      setSaving(false);
    }
  };

  // Check if a notification is locked by role settings (non-admin users only)
  const isLocked = (item: NotificationItem): boolean => {
    if (isAdminOrOwner) return false;
    if (!roleNotifications || !item.roleKey) return false;
    return true; // Non-admin users can't change role-controlled notifications
  };

  // Get effective checked state considering role settings
  const isChecked = (item: NotificationItem): boolean => {
    if (!isAdminOrOwner && roleNotifications && item.roleKey) {
      return roleNotifications[item.roleKey];
    }
    return preferences[item.key];
  };

  const description = isAdminOrOwner
    ? t('emailPrefs.descriptionAdmin', { email })
    : t('emailPrefs.descriptionMember', { email });

  return (
    <Section
      title={t('emailPrefs.title')}
      description={description}
      actions={
        isAdminOrOwner ? (
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t('emailPrefs.saving') : t('emailPrefs.save')}
          </Button>
        ) : undefined
      }
    >
      <Stack>
        {isAdminOrOwner && (
          <HStack align="center" justify="between">
            <div>
              <Text size="base" weight="medium">
                {t('emailPrefs.enableAll')}
              </Text>
              <Text size="sm" variant="muted">
                {t('emailPrefs.toggleAllHint')}
              </Text>
            </div>
            <Button onClick={handleSelectAll} variant="outline" size="sm">
              {Object.values(preferences).every((v) => v === true)
                ? t('emailPrefs.disableAll')
                : t('emailPrefs.enableAll')}
            </Button>
          </HStack>
        )}

        <Stack>
          {NOTIFICATION_ITEMS.map((item) => {
            const locked = isLocked(item);
            const checked = isChecked(item);

            return (
              <label
                key={item.key}
                className={`flex items-start gap-4 rounded-lg border p-4 transition-colors ${
                  locked
                    ? 'opacity-60 cursor-default'
                    : 'cursor-pointer hover:bg-muted/50'
                }`}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={
                    locked
                      ? undefined
                      : (c) => handleToggle(item.key, c === true)
                  }
                  disabled={locked}
                />
                <div className="flex-1 min-w-0">
                  <HStack align="center" gap="xs">
                    <Text weight="medium">{itemLabel(t, item)}</Text>
                    {locked && (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </HStack>
                  <Text size="sm" variant="muted">
                    {itemDescription(t, item)}
                  </Text>
                  {locked && (
                    <Text size="xs" variant="muted">
                      {t('emailPrefs.managedByAdmin')}
                    </Text>
                  )}
                </div>
              </label>
            );
          })}
        </Stack>

        <Text size="xs" variant="muted">
          {isAdminOrOwner
            ? t('emailPrefs.footerAdmin')
            : t('emailPrefs.footerMember')}
        </Text>
      </Stack>
    </Section>
  );
}
