'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Textarea,
} from '@trycompai/design-system';
import { Add, Close, Edit, Link as LinkIcon, OverflowMenuVertical, TrashCan } from '@trycompai/design-system/icons';
import { GripVertical } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePermissions } from '@/hooks/use-permissions';
import { useTrustPortalCustomLinks } from '@/hooks/use-trust-portal-custom-links';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface CustomLink {
  id: string;
  title: string;
  description: string | null;
  url: string;
  order: number;
  isActive: boolean;
}

interface TrustPortalCustomLinksProps {
  initialLinks: CustomLink[];
  orgId: string;
}

function SortableLink({
  link,
  onEdit,
  onDelete,
  canUpdate,
}: {
  link: CustomLink;
  onEdit: (link: CustomLink) => void;
  onDelete: (linkId: string) => void;
  canUpdate: boolean;
}) {
  const t = useTranslations('trust');
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: link.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-md border border-border bg-background p-4"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing"
        type="button"
      >
        <GripVertical size={20} className="text-muted-foreground" />
      </button>
      <div className="flex-1 space-y-1">
        <div className="flex items-start justify-between">
          <h4 className="font-medium">{link.title}</h4>
          {canUpdate && (
            <DropdownMenu>
              <DropdownMenuTrigger variant="ellipsis">
                <OverflowMenuVertical size={16} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(link)}>
                  <Edit size={16} />
                  {t('portal.customLinks.edit')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(link.id)}>
                  <TrashCan size={16} />
                  {t('portal.customLinks.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {link.description && (
          <p className="text-sm text-muted-foreground">{link.description}</p>
        )}
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary dark:brightness-175 hover:underline flex items-center gap-1"
        >
          <LinkIcon size={14} />
          {link.url}
        </a>
      </div>
    </div>
  );
}

export function TrustPortalCustomLinks({
  initialLinks,
  orgId,
}: TrustPortalCustomLinksProps) {
  const t = useTranslations('trust');
  const { hasPermission } = usePermissions();
  const canUpdate = hasPermission('trust', 'update');
  const {
    createLink: createLinkApi,
    updateLink: updateLinkApi,
    deleteLink: deleteLinkApi,
    reorderLinks: reorderLinksApi,
  } = useTrustPortalCustomLinks(orgId);

  const [links, setLinks] = useState<CustomLink[]>(initialLinks);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<CustomLink | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');

  const [isMutating, setIsMutating] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setUrl('');
    setEditingLink(null);
    setIsModalOpen(false);
  };

  const handleSave = async () => {
    if (isMutating) return;

    if (!title.trim() || !url.trim()) {
      toast.error(t('portal.customLinks.titleUrlRequired'));
      return;
    }

    const trimmedUrl = url.trim();
    const normalizedUrl =
      trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')
        ? trimmedUrl
        : `https://${trimmedUrl}`;

    try {
      new URL(normalizedUrl);
    } catch {
      toast.error(t('portal.customLinks.invalidUrl'));
      return;
    }

    setUrl(normalizedUrl);
    setIsMutating(true);

    try {
      if (editingLink) {
        const updated = await updateLinkApi(editingLink.id, {
          title,
          description: description || null,
          url: normalizedUrl,
        });
        if (updated) {
          setLinks((prev) =>
            prev.map((l) => (l.id === (updated as CustomLink).id ? (updated as CustomLink) : l)),
          );
        }
        toast.success(t('portal.customLinks.linkUpdated'));
      } else {
        const created = await createLinkApi({
          title,
          description: description || null,
          url: normalizedUrl,
        });
        if (created) {
          setLinks((prev) => [...prev, created as CustomLink]);
        }
        toast.success(t('portal.customLinks.linkCreated'));
      }
      resetForm();
    } catch {
      toast.error(
        editingLink
          ? t('portal.customLinks.updateFailed')
          : t('portal.customLinks.createFailed'),
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleEdit = (link: CustomLink) => {
    setEditingLink(link);
    setTitle(link.title);
    setDescription(link.description ?? '');
    setUrl(link.url);
    setIsModalOpen(true);
  };

  const handleDelete = async (linkId: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== linkId));
    try {
      await deleteLinkApi(linkId);
      toast.success(t('portal.customLinks.linkDeleted'));
    } catch {
      toast.error(t('portal.customLinks.deleteFailed'));
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setLinks((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);

        reorderLinksApi(newItems.map((item) => item.id)).then(
          () => toast.success(t('portal.customLinks.linksReordered')),
          () => toast.error(t('portal.customLinks.reorderFailed')),
        );

        return newItems;
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-medium">{t('portal.customLinks.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('portal.customLinks.description')}
          </p>
        </div>
        {canUpdate && (
          <Button onClick={() => setIsModalOpen(true)} iconLeft={<Add size={16} />}>
            {t('portal.customLinks.addLink')}
          </Button>
        )}
      </div>

      {links.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">{t('portal.customLinks.emptyState')}</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={links.map((l) => l.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {links.map((link) => (
                <SortableLink
                  key={link.id}
                  link={link}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  canUpdate={canUpdate}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editingLink
                  ? t('portal.customLinks.editLinkTitle')
                  : t('portal.customLinks.addLink')}
              </h3>
              <button onClick={resetForm} type="button">
                <Close size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="link-title" className="text-sm font-medium">
                  {t('portal.customLinks.titleLabel')}
                </label>
                <Input
                  id="link-title"
                  placeholder={t('portal.customLinks.titlePlaceholder')}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="link-description" className="text-sm font-medium">
                  {t('portal.customLinks.descriptionLabel')}
                </label>
                <Textarea
                  id="link-description"
                  placeholder={t('portal.customLinks.descriptionPlaceholder')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={500}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="link-url" className="text-sm font-medium">
                  {t('portal.customLinks.urlLabel')}
                </label>
                <Input
                  id="link-url"
                  type="url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  maxLength={2000}
                />
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <Button
                    onClick={handleSave}
                    width="full"
                    loading={isMutating}
                  >
                    {editingLink
                      ? t('portal.customLinks.update')
                      : t('portal.customLinks.create')}
                  </Button>
                </div>
                <div className="flex-1">
                  <Button onClick={resetForm} variant="outline" width="full">
                    {t('portal.customLinks.cancel')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
