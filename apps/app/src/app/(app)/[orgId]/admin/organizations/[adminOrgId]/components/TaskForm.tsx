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
import { Textarea } from '@gideon-defender/ui/textarea';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface TaskFormProps {
  orgId: string;
  onCreated: () => void;
}

const STATUS_OPTIONS = ['todo', 'in_progress', 'in_review', 'done'];
const DEPARTMENT_OPTIONS = ['none', 'admin', 'gov', 'hr', 'it', 'itsm', 'qms'];
const FREQUENCY_OPTIONS = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];

type AdminTranslator = ReturnType<typeof useTranslations<'admin'>>;

function statusLabel(t: AdminTranslator, value: string) {
  switch (value) {
    case 'todo':
      return t('organizations.taskForm.statuses.todo');
    case 'in_progress':
      return t('organizations.taskForm.statuses.inProgress');
    case 'in_review':
      return t('organizations.taskForm.statuses.inReview');
    case 'done':
      return t('organizations.taskForm.statuses.done');
    default:
      return value;
  }
}

function departmentLabel(t: AdminTranslator, value: string) {
  switch (value) {
    case 'none':
      return t('organizations.taskForm.departments.none');
    case 'admin':
      return t('organizations.taskForm.departments.admin');
    case 'gov':
      return t('organizations.taskForm.departments.gov');
    case 'hr':
      return t('organizations.taskForm.departments.hr');
    case 'it':
      return t('organizations.taskForm.departments.it');
    case 'itsm':
      return t('organizations.taskForm.departments.itsm');
    case 'qms':
      return t('organizations.taskForm.departments.qms');
    default:
      return value;
  }
}

function frequencyLabel(t: AdminTranslator, value: string) {
  switch (value) {
    case 'daily':
      return t('organizations.taskForm.frequencies.daily');
    case 'weekly':
      return t('organizations.taskForm.frequencies.weekly');
    case 'monthly':
      return t('organizations.taskForm.frequencies.monthly');
    case 'quarterly':
      return t('organizations.taskForm.frequencies.quarterly');
    case 'yearly':
      return t('organizations.taskForm.frequencies.yearly');
    default:
      return value;
  }
}

export function TaskForm({ orgId, onCreated }: TaskFormProps) {
  const t = useTranslations('admin');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('');
  const [department, setDepartment] = useState('');
  const [frequency, setFrequency] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = title.trim() && description.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setSubmitting(true);
    setError(null);

    const body: Record<string, string> = {
      title: title.trim(),
      description: description.trim(),
    };
    if (status) body.status = status;
    if (department && department !== 'none') body.department = department;
    if (frequency) body.frequency = frequency;

    const res = await api.post(
      `/v1/admin/organizations/${orgId}/tasks`,
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
          <Label htmlFor="task-title">{t('organizations.taskForm.titleLabel')}</Label>
          <Input
            id="task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('organizations.taskForm.titlePlaceholder')}
          />
        </div>

        <div>
          <Label htmlFor="task-description">
            {t('organizations.taskForm.descriptionLabel')}
          </Label>
          <Textarea
            id="task-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('organizations.taskForm.descriptionPlaceholder')}
            rows={3}
          />
        </div>

        <div>
          <Label>{t('organizations.taskForm.statusLabel')}</Label>
          <Select value={status} onValueChange={(val) => { if (val) setStatus(val); }}>
            <SelectTrigger>
              <span className="text-sm">
                {status
                  ? statusLabel(t, status)
                  : t('organizations.taskForm.statusDefault')}
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
          <Label>{t('organizations.taskForm.departmentLabel')}</Label>
          <Select value={department} onValueChange={(val) => { if (val) setDepartment(val); }}>
            <SelectTrigger>
              <span className="text-sm">
                {department
                  ? departmentLabel(t, department)
                  : t('organizations.taskForm.departmentDefault')}
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
          <Label>{t('organizations.taskForm.frequencyLabel')}</Label>
          <Select value={frequency} onValueChange={(val) => { if (val) setFrequency(val); }}>
            <SelectTrigger>
              <span className="text-sm">
                {frequency
                  ? frequencyLabel(t, frequency)
                  : t('organizations.taskForm.frequencyDefault')}
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

        <Button type="submit" loading={submitting} disabled={!isValid}>
          {t('organizations.taskForm.submit')}
        </Button>
      </Stack>
    </form>
  );
}
