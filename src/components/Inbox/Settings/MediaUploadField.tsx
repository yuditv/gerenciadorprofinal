import { useState, useCallback, useRef } from "react";
import { Upload, X, Image, Video, Music, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { compressImage, isCompressibleImage } from "@/lib/imageCompression";

export type MediaType = 'image' | 'video' | 'audio' | 'document';

interface MediaUploadFieldProps {
  value: { url: string; type: MediaType; name: string } | null;
  onChange: (media: { url: string; type: MediaType; name: string } | null) => void;
  disabled?: boolean;
}

const ACCEPTED_TYPES: Record<MediaType, { accept: string; maxSize: number; label: string }> = {
  image: { accept: 'image/jpeg,image/png,image/gif,image/webp', maxSize: 10 * 1024 * 1024, label: 'Imagem' },
  video: { accept: 'video/mp4,video/webm,video/quicktime', maxSize: 50 * 1024 * 1024, label: 'Vídeo' },
  audio: { accept: 'audio/mpeg,audio/ogg,audio/wav,audio/webm', maxSize: 20 * 1024 * 1024, label: 'Áudio' },
  document: { accept: 'application/pdf,.doc,.docx,.xls,.xlsx,.txt', maxSize: 20 * 1024 * 1024, label: 'Documento' },
};

const TYPE_ICONS: Record<MediaType, React.ElementType> = {
  image: Image,
  video: Video,
  audio: Music,
  document: FileText,
};

function detectMediaType(file: File): MediaType | null {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.includes('pdf') || file.type.includes('document') || 
      file.type.includes('sheet') || file.type.includes('text') ||
      file.name.match(/\.(pdf|doc|docx|xls|xlsx|txt)$/i)) return 'document';
  return null;
}

export function MediaUploadField({ value, onChange, disabled }: MediaUploadFieldProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = useCallback(async (file: File) => {
    const mediaType = detectMediaType(file);
    
    if (!mediaType) {
      toast({
        title: "Tipo de arquivo não suportado",
        description: "Use imagens, vídeos, áudios ou documentos.",
        variant: "destructive",
      });
      return;
    }

    const config = ACCEPTED_TYPES[mediaType];
    if (file.size > config.maxSize) {
      toast({
        title: "Arquivo muito grande",
        description: `O tamanho máximo para ${config.label.toLowerCase()} é ${config.maxSize / (1024 * 1024)}MB`,
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      let fileToUpload = file;

      // Compress images
      if (isCompressibleImage(file)) {
        try {
          fileToUpload = await compressImage(file, { maxSizeMB: 1, quality: 0.8 });
        } catch (e) {
          console.warn('Compression failed, using original:', e);
        }
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `canned-responses/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('dispatch-media')
        .upload(filePath, fileToUpload);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('dispatch-media')
        .getPublicUrl(filePath);

      onChange({
        url: urlData.publicUrl,
        type: mediaType,
        name: file.name,
      });

      toast({ title: "Arquivo enviado com sucesso" });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Erro ao enviar arquivo",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }, [onChange, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = '';
  };

  const handleRemove = () => {
    onChange(null);
  };

  // Show preview if we have a value
  if (value) {
    const Icon = TYPE_ICONS[value.type];
    
    return (
      <div className="border rounded-lg p-3 bg-muted/30">
        <div className="flex items-center gap-3">
          {/* Preview */}
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
            {value.type === 'image' ? (
              <img src={value.url} alt={value.name} className="w-full h-full object-cover" />
            ) : value.type === 'video' ? (
              <video src={value.url} className="w-full h-full object-cover" />
            ) : (
              <Icon className="h-8 w-8 text-muted-foreground" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{value.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{ACCEPTED_TYPES[value.type].label}</p>
          </div>

          {/* Remove button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={handleRemove}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Upload area
  return (
    <div
      className={`
        border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
        ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      onDrop={disabled ? undefined : handleDrop}
      onDragOver={disabled ? undefined : handleDragOver}
      onDragLeave={disabled ? undefined : handleDragLeave}
      onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
        onChange={handleInputChange}
        disabled={disabled || isUploading}
      />

      {isUploading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Enviando...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-2 text-muted-foreground">
            <Image className="h-5 w-5" />
            <Video className="h-5 w-5" />
            <Music className="h-5 w-5" />
            <FileText className="h-5 w-5" />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Upload className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">
              Arraste ou clique para adicionar mídia
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Imagem, vídeo, áudio ou documento
          </p>
        </div>
      )}
    </div>
  );
}
