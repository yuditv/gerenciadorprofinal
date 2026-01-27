import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, X, Image, Video, FileAudio, FileText, 
  File, Loader2, CheckCircle 
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type MediaType = 'none' | 'image' | 'video' | 'audio' | 'document';

interface MediaUploaderProps {
  type: MediaType;
  currentUrl?: string;
  currentFilename?: string;
  onUpload: (url: string, filename: string, mimetype: string) => void;
  onRemove: () => void;
  disabled?: boolean;
}

const ACCEPTED_TYPES: Record<MediaType, { accept: string; maxSize: number; extensions: string[] }> = {
  none: { accept: '', maxSize: 0, extensions: [] },
  image: { accept: 'image/jpeg,image/png,image/webp,image/gif', maxSize: 5 * 1024 * 1024, extensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif'] },
  video: { accept: 'video/mp4,video/3gpp,video/quicktime', maxSize: 16 * 1024 * 1024, extensions: ['.mp4', '.3gp', '.mov'] },
  audio: { accept: 'audio/mpeg,audio/ogg,audio/wav,audio/mp4', maxSize: 16 * 1024 * 1024, extensions: ['.mp3', '.ogg', '.wav', '.m4a'] },
  document: { accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt', maxSize: 50 * 1024 * 1024, extensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'] }
};

const TYPE_ICONS: Record<MediaType, typeof Image> = {
  none: File,
  image: Image,
  video: Video,
  audio: FileAudio,
  document: FileText
};

const TYPE_LABELS: Record<MediaType, string> = {
  none: 'Arquivo',
  image: 'Imagem',
  video: 'Vídeo',
  audio: 'Áudio',
  document: 'Documento'
};

export function MediaUploader({
  type,
  currentUrl,
  currentFilename,
  onUpload,
  onRemove,
  disabled = false
}: MediaUploaderProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const typeConfig = ACCEPTED_TYPES[type];
  const Icon = TYPE_ICONS[type];

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const uploadFile = useCallback(async (file: File) => {
    if (!user) {
      setError('Usuário não autenticado');
      return;
    }

    // Validate file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!typeConfig.extensions.some(ext => ext.toLowerCase() === fileExtension)) {
      setError(`Tipo de arquivo não permitido. Use: ${typeConfig.extensions.join(', ')}`);
      return;
    }

    // Validate file size
    if (file.size > typeConfig.maxSize) {
      setError(`Arquivo muito grande. Máximo: ${formatFileSize(typeConfig.maxSize)}`);
      return;
    }

    setError(null);
    setUploading(true);
    setProgress(10);

    try {
      const timestamp = Date.now();
      const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${user.id}/${timestamp}-${safeFilename}`;

      setProgress(30);

      const { data, error: uploadError } = await supabase.storage
        .from('dispatch-media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      setProgress(80);

      const { data: urlData } = supabase.storage
        .from('dispatch-media')
        .getPublicUrl(data.path);

      setProgress(100);

      onUpload(urlData.publicUrl, file.name, file.type);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Erro ao fazer upload');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, [user, type, typeConfig, onUpload]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  if (type === 'none') return null;

  // Show preview if media is uploaded
  if (currentUrl) {
    return (
      <div className="space-y-2">
        <div className="relative rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-3">
            {type === 'image' ? (
              <img 
                src={currentUrl} 
                alt="Preview" 
                className="w-16 h-16 object-cover rounded-md"
              />
            ) : (
              <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center">
                <Icon className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{currentFilename}</p>
              <p className="text-xs text-muted-foreground">{TYPE_LABELS[type]}</p>
              <div className="flex items-center gap-1 text-xs text-primary mt-1">
                <CheckCircle className="w-3 h-3" />
                Upload concluído
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              onClick={onRemove}
              disabled={disabled}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept={typeConfig.accept}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || uploading}
      />
      
      <div
        onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative rounded-lg border-2 border-dashed transition-all cursor-pointer",
          "flex flex-col items-center justify-center py-6 px-4",
          isDragging && "border-primary bg-primary/5",
          !isDragging && "border-border hover:border-primary/50 hover:bg-muted/30",
          (disabled || uploading) && "opacity-50 cursor-not-allowed"
        )}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2 w-full">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Enviando...</p>
            <Progress value={progress} className="w-full max-w-xs h-2" />
          </div>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
              <Icon className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">
              Arraste ou clique para enviar
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {typeConfig.extensions.join(', ')} • Máx: {formatFileSize(typeConfig.maxSize)}
            </p>
          </>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
