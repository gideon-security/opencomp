export type FileKind = 'image' | 'pdf' | 'document' | 'generic';

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);
const PDF_EXTENSIONS = new Set(['pdf']);
const DOC_EXTENSIONS = new Set(['doc', 'docx', 'txt']);

export function getFileKind(fileName: string): FileKind {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (!extension) return 'generic';
  if (IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (PDF_EXTENSIONS.has(extension)) return 'pdf';
  if (DOC_EXTENSIONS.has(extension)) return 'document';
  return 'generic';
}

export function isImageFile(fileName: string): boolean {
  return getFileKind(fileName) === 'image';
}
