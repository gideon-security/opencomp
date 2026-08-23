'use client';

import { api } from '@/lib/api-client';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  Stack,
  Text,
} from '@trycompai/design-system';
import { Label } from '@gideon-defender/ui/label';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface PolicyFormProps {
  orgId: string;
  onCreated: () => void;
}

const STATUS_OPTIONS = ['draft', 'published', 'needs_review'];
const DEPARTMENT_OPTIONS = ['none', 'admin', 'gov', 'hr', 'it', 'itsm', 'qms'];
const FREQUENCY_OPTIONS = ['monthly', 'quarterly', 'yearly'];

type AdminTranslator = ReturnType<typeof useTranslations<'admin'>>;

function statusLabel(t: AdminTranslator, value: string) {
  switch (value) {
    case 'draft':
      return t('organizations.policyForm.statuses.draft');
    case 'published':
      return t('organizations.policyForm.statuses.published');
    case 'needs_review':
      return t('organizations.policyForm.statuses.needsReview');
    default:
      return value;
  }
}

function departmentLabel(t: AdminTranslator, value: string) {
  switch (value) {
    case 'none':
      return t('organizations.policyForm.departments.none');
    case 'admin':
      return t('organizations.policyForm.departments.admin');
    case 'gov':
      return t('organizations.policyForm.departments.gov');
    case 'hr':
      return t('organizations.policyForm.departments.hr');
    case 'it':
      return t('organizations.policyForm.departments.it');
    case 'itsm':
      return t('organizations.policyForm.departments.itsm');
    case 'qms':
      return t('organizations.policyForm.departments.qms');
    default:
      return value;
  }
}

function frequencyLabel(t: AdminTranslator, value: string) {
  switch (value) {
    case 'monthly':
      return t('organizations.policyForm.frequencies.monthly');
    case 'quarterly':
      return t('organizations.policyForm.frequencies.quarterly');
    case 'yearly':
      return t('organizations.policyForm.frequencies.yearly');
    default:
      return value;
  }
}

export function PolicyForm({ orgId, onCreated }: PolicyFormProps) {
  const t = useTranslations('admin');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('');
  const [department, setDepartment] = useState('');
  const [frequency, setFrequency] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setError(null);

    const body: Record<string, string> = { name: name.trim() };
    if (description.trim()) body.description = description.trim();
    if (status) body.status = status;
    if (department && department !== 'none') body.department = department;
    if (frequency) body.frequency = frequency;

    const res = await api.post(
      `/v1/admin/organizations/${orgId}/policies`,
      body,
    );

    if (res.error) {
      setError(res.error);
    } else {
      onCreated();
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        <div>
          <Label htmlFor="policy-name">{t('organizations.policyForm.nameLabel')}</Label>
          <Input
            id="policy-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('organizations.policyForm.namePlaceholder')}
          />
        </div>

        <div>
          <Label htmlFor="policy-description">
            {t('organizations.policyForm.descriptionLabel')}
          </Label>
          <Input
            id="policy-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('organizations.policyForm.descriptionPlaceholder')}
          />
        </div>

        <div>
          <Label>{t('organizations.policyForm.statusLabel')}</Label>
          <Select value={status} onValueChange={(val) => { if (val) setStatus(val); }}>
            <SelectTrigger>
              <span className="text-sm">
                {status
                  ? statusLabel(t, status)
                  : t('organizations.policyForm.statusDefault')}
              </span>
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {statusLabel(t, opt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>{t('organizations.policyForm.departmentLabel')}</Label>
          <Select value={department} onValueChange={(val) => { if (val) setDepartment(val); }}>
            <SelectTrigger>
              <span className="text-sm">
                {department
                  ? departmentLabel(t, department)
                  : t('organizations.policyForm.departmentDefault')}
              </span>
            </SelectTrigger>
            <SelectContent>
              {DEPARTMENT_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {departmentLabel(t, opt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>{t('organizations.policyForm.frequencyLabel')}</Label>
          <Select value={frequency} onValueChange={(val) => { if (val) setFrequency(val); }}>
            <SelectTrigger>
              <span className="text-sm">
                {frequency
                  ? frequencyLabel(t, frequency)
                  : t('organizations.policyForm.frequencyDefault')}
              </span>
            </SelectTrigger>
            <SelectContent>
              {FREQUENCY_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {frequencyLabel(t, opt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && (
          <Text size="sm" variant="destructive">
            {error}
          </Text>
        )}

        <Button type="submit" loading={submitting} disabled={!name.trim()}>
          {t('organizations.policyForm.submit')}
        </Button>
      </Stack>
    </form>
  );
}
