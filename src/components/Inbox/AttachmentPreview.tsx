import { X, FileText, Film, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AttachmentPreviewProps {
  url: string;
  type: string;
  fileName: string;
  onRemove: () => void;
}

export function AttachmentPreview({ url, type, fileName, onRemove }: AttachmentPreviewProps) {
  const isImage = type.startsWith('image/');
  const isVideo = type.startsWith('video/');
  const isDocument = !isImage && !isVideo;

  return (
    <div className="flex items-center gap-2 p-2 bg-muted rounded-lg border">
      <div className="relative flex-shrink-0">
        {isImage && (
          <img 
            src={url} 
            alt={fileName}
            className="h-12 w-12 object-cover rounded"
          />
        )}
        {isVideo && (
          <div className="h-12 w-12 bg-primary/10 rounded flex items-center justify-center">
            <Film className="h-6 w-6 text-primary" />
          </div>
        )}
        {isDocument && (
          <div className="h-12 w-12 bg-orange-500/10 rounded flex items-center justify-center">
            <FileText className="h-6 w-6 text-orange-500" />
          </div>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{fileName}</p>
        <p className="text-xs text-muted-foreground">
          {isImage ? 'Imagem' : isVideo ? 'Vídeo' : 'Documento'}
        </p>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={onRemove}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
