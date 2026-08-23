'use client';

import {
  useAdminFindingTemplates,
  type FindingTemplate,
} from '@/hooks/use-admin-finding-templates';
import {
  Badge,
  Button,
  Input,
  PageHeader,
  PageLayout,
  Section,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@trycompai/design-system';
import { Add, Edit } from '@trycompai/design-system/icons';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import {
  FINDING_TEMPLATE_CATEGORIES,
  findingTemplateCategoryLabel,
} from './constants';
import { DeleteTemplateDialog } from './DeleteTemplateDialog';
import { TemplateFormDialog } from './TemplateFormDialog';

const PAGE_SIZE = 10;

export function FindingTemplatesList() {
  const t = useTranslations('admin');
  const { templates, isLoading } = useAdminFindingTemplates();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FindingTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FindingTemplate | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return templates.filter((template) => {
      if (categoryFilter !== 'all' && template.category !== categoryFilter) {
        return false;
      }
      if (!query) return true;
      return (
        template.title.toLowerCase().includes(query) ||
        template.content.toLowerCase().includes(query)
      );
    });
  }, [templates, search, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (template: FindingTemplate) => {
    setEditing(template);
    setFormOpen(true);
  };

  if (isLoading) {
    return (
      <PageLayout header={<PageHeader title={t('findingTemplates.list.title')} />}>
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          {t('findingTemplates.list.loading')}
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      header={
        <PageHeader
          title={t('findingTemplates.list.title')}
          actions={
            <Button size="sm" iconLeft={<Add size={16} />} onClick={openCreate}>
              {t('findingTemplates.list.addTemplate')}
            </Button>
          }
        />
      }
    >
      <Section>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="max-w-xs flex-1">
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t('findingTemplates.list.searchPlaceholder')}
            />
          </div>
          <div className="w-56">
            <Select
              value={categoryFilter}
              onValueChange={(value) => {
                setCategoryFilter(value ?? 'all');
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('findingTemplates.list.allCategories')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('findingTemplates.list.allCategories')}</SelectItem>
                {FINDING_TEMPLATE_CATEGORIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {findingTemplateCategoryLabel(t, value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            {templates.length === 0
              ? t('findingTemplates.list.emptyAll')
              : t('findingTemplates.list.emptyFiltered')}
          </div>
        ) : (
          <>
            <Table variant="bordered">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('findingTemplates.list.colTitle')}</TableHead>
                  <TableHead>{t('findingTemplates.list.colCategory')}</TableHead>
                  <TableHead>{t('findingTemplates.list.colContent')}</TableHead>
                  <TableHead>{t('findingTemplates.list.colOrder')}</TableHead>
                  <TableHead>{t('findingTemplates.list.colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <Text size="sm" weight="medium">
                        {template.title}
                      </Text>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {findingTemplateCategoryLabel(t, template.category)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[320px] truncate text-sm text-muted-foreground">
                        {template.content}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Text size="sm">{template.order}</Text>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          iconLeft={<Edit size={16} />}
                          onClick={() => openEdit(template)}
                        >
                          {t('findingTemplates.list.edit')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeleteTarget(template)}
                        >
                          {t('findingTemplates.list.delete')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filtered.length > PAGE_SIZE && (
              <div className="mt-4 flex items-center justify-between">
                <Text size="sm" variant="muted">
                  {t('findingTemplates.list.paginationRange', {
                    from: pageStart + 1,
                    to: Math.min(pageStart + PAGE_SIZE, filtered.length),
                    total: filtered.length,
                  })}
                </Text>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    {t('findingTemplates.list.previous')}
                  </Button>
                  <Text size="sm" variant="muted">
                    {t('findingTemplates.list.pageInfo', {
                      current: currentPage,
                      total: totalPages,
                    })}
                  </Text>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    {t('findingTemplates.list.next')}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Section>

      <TemplateFormDialog open={formOpen} template={editing} onClose={() => setFormOpen(false)} />
      <DeleteTemplateDialog template={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </PageLayout>
  );
}
