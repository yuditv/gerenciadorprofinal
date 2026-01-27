import { useRef, useState } from 'react';
import { Paperclip, Image, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { compressImage, isCompressibleImage } from '@/lib/imageCompression';

interface FileUploadButtonProps {
  onFileUploaded: (url: string, type: string, fileName: string) => void;
  disabled?: boolean;
}

interface UploadState {
  isUploading: boolean;
  progress: number;
  fileName: string | null;
  isCompressing: boolean;
}

const ALLOWED_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function FileUploadButton({ onFileUploaded, disabled }: FileUploadButtonProps) {
  const { toast } = useToast();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    fileName: null,
    isCompressing: false
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Process all selected files
    for (let i = 0; i < files.length; i++) {
      await processFile(files[i]);
    }
    
    // Reset inputs
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (documentInputRef.current) documentInputRef.current.value = '';
  };

  const processFile = async (file: File) => {

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O tamanho máximo é 50MB',
        variant: 'destructive'
      });
      return;
    }

    // Validate file type
    const allAllowed = [...ALLOWED_TYPES.image, ...ALLOWED_TYPES.video, ...ALLOWED_TYPES.document];
    if (!allAllowed.includes(file.type)) {
      toast({
        title: 'Tipo de arquivo não suportado',
        description: 'Use imagens, vídeos ou documentos PDF/Word',
        variant: 'destructive'
      });
      return;
    }

    setUploadState({
      isUploading: true,
      progress: 0,
      fileName: file.name,
      isCompressing: false
    });

    try {
      let fileToUpload = file;
      
      // Compress image if applicable
      if (isCompressibleImage(file)) {
        setUploadState(prev => ({ ...prev, isCompressing: true }));
        try {
          fileToUpload = await compressImage(file, {
            maxWidth: 1920,
            maxHeight: 1920,
            quality: 0.8,
            maxSizeMB: 2
          });
        } catch (compressError) {
          console.warn('Compression failed, using original:', compressError);
        }
        setUploadState(prev => ({ ...prev, isCompressing: false }));
      }

      const fileExt = fileToUpload.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `inbox-attachments/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('dispatch-media')
        .upload(filePath, fileToUpload, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('dispatch-media')
        .getPublicUrl(filePath);

      onFileUploaded(publicUrl, fileToUpload.type, file.name);

      toast({
        title: 'Arquivo anexado',
        description: file.name
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Erro ao enviar arquivo',
        description: 'Tente novamente',
        variant: 'destructive'
      });
    } finally {
      setUploadState({ isUploading: false, progress: 0, fileName: null, isCompressing: false });
    }
  };

  if (uploadState.isUploading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="truncate max-w-[100px]">
          {uploadState.isCompressing ? 'Comprimindo...' : uploadState.fileName}
        </span>
      </div>
    );
  }

  return (
    <>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileSelect}
        multiple
      />
      <input
        ref={documentInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={handleFileSelect}
        multiple
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={disabled}
          >
            <Paperclip className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top">
          <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
            <Image className="h-4 w-4 mr-2" />
            Imagem ou Vídeo
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => documentInputRef.current?.click()}>
            <FileText className="h-4 w-4 mr-2" />
            Documento
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
