import { FileText, Download, FileIcon, FileSpreadsheet, FileArchive, File } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AttachmentRendererProps {
  url: string;
  mediaType?: string;
  fileName?: string;
  isOutgoing?: boolean;
  onImageClick?: () => void;
}

const getFileExtension = (url: string, mediaType?: string): string => {
  // Try to get extension from URL
  const urlMatch = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  if (urlMatch) return urlMatch[1].toLowerCase();
  
  // Fallback to media type
  if (mediaType) {
    if (mediaType.includes('pdf')) return 'pdf';
    if (mediaType.includes('word') || mediaType.includes('document')) return 'docx';
    if (mediaType.includes('sheet') || mediaType.includes('excel')) return 'xlsx';
    if (mediaType.includes('zip') || mediaType.includes('archive')) return 'zip';
  }
  
  return 'file';
};

const getFileIcon = (extension: string) => {
  switch (extension) {
    case 'pdf':
      return { icon: FileText, color: 'text-red-500', bgColor: 'bg-red-500/10' };
    case 'doc':
    case 'docx':
      return { icon: FileText, color: 'text-blue-500', bgColor: 'bg-blue-500/10' };
    case 'xls':
    case 'xlsx':
    case 'csv':
      return { icon: FileSpreadsheet, color: 'text-green-500', bgColor: 'bg-green-500/10' };
    case 'zip':
    case 'rar':
    case '7z':
      return { icon: FileArchive, color: 'text-amber-500', bgColor: 'bg-amber-500/10' };
    default:
      return { icon: File, color: 'text-muted-foreground', bgColor: 'bg-muted/50' };
  }
};

const getFileName = (url: string, providedName?: string): string => {
  if (providedName) return providedName;
  
  try {
    const urlPath = new URL(url).pathname;
    const fileName = urlPath.split('/').pop();
    if (fileName) return decodeURIComponent(fileName);
  } catch {
    // URL parsing failed, try simple extraction
    const match = url.match(/\/([^/?#]+)(?:\?|$)/);
    if (match) return decodeURIComponent(match[1]);
  }
  
  return 'Documento';
};

export function AttachmentRenderer({ 
  url, 
  mediaType, 
  fileName,
  isOutgoing = false,
  onImageClick 
}: AttachmentRendererProps) {
  const extension = getFileExtension(url, mediaType);
  const { icon: IconComponent, color, bgColor } = getFileIcon(extension);
  const displayName = getFileName(url, fileName);
  
  // Check if it's actually an image that wasn't caught by the image check
  const isImage = mediaType?.startsWith('image/') || 
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(extension);
  
  if (isImage) {
    return (
      <button 
        onClick={onImageClick} 
        className="block cursor-pointer hover:opacity-90 transition-opacity"
      >
        <img 
          src={url} 
          alt="Anexo" 
          className="rounded max-w-full max-h-64 object-cover" 
          onError={(e) => {
            // If image fails to load, hide it
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </button>
    );
  }
  
  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noopener noreferrer"
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg transition-all",
        "hover:scale-[1.02] hover:shadow-md",
        "border border-border/50",
        isOutgoing 
          ? "bg-background/30 hover:bg-background/50" 
          : "bg-muted/50 hover:bg-muted/70"
      )}
    >
      {/* Icon Container */}
      <div className={cn(
        "flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center",
        bgColor
      )}>
        <IconComponent className={cn("h-6 w-6", color)} />
      </div>
      
      {/* File Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {displayName}
        </p>
        <p className="text-xs text-muted-foreground uppercase">
          {extension === 'file' ? 'Documento' : extension.toUpperCase()}
        </p>
      </div>
      
      {/* Download indicator */}
      <Download className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </a>
  );
}
