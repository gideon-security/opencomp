'use client';

import { File, FileImage, FileText } from 'lucide-react';
import { getFileKind } from '@gideon-defender/utils/file';

interface FileIconProps {
  fileName: string;
}

export function FileIcon({ fileName }: FileIconProps) {
  const kind = getFileKind(fileName);

  if (kind === 'image') {
    return <FileImage className="text-muted-foreground h-12 w-12" />;
  }
  if (kind === 'pdf' || kind === 'document') {
    return <FileText className="text-muted-foreground h-12 w-12" />;
  }
  return <File className="text-muted-foreground h-12 w-12" />;
}
