import { useRef, useState, useCallback } from "react";
import { Camera, FileVideo, Mic, Paperclip, X, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Props = {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  variant?: "light" | "dark";
};

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export function ChatMediaUploader({ onFileSelect, disabled, variant = "light" }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        alert('Arquivo muito grande. Máximo 25MB.');
        return;
      }
      onFileSelect(file);
      setIsOpen(false);
    }
    // Reset input
    e.target.value = '';
  };

  const startRecording = useCallback(async () => {
    try {
      // CRITICAL: getUserMedia must be called directly in click handler for browser security
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      
      // Check supported mimeType
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/wav';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'm4a' : 'wav';
        const audioFile = new File([audioBlob], `audio-${Date.now()}.${ext}`, { type: mimeType });
        
        if (audioFile.size > MAX_FILE_SIZE) {
          alert('Áudio muito grande. Máximo 25MB.');
        } else {
          onFileSelect(audioFile);
        }
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setRecordingTime(0);
      setIsOpen(false); // Close popover when recording starts
      
      // Update recording time every second
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error: unknown) {
      console.error('Error starting recording:', error);
      const errorName = error instanceof Error ? (error as DOMException).name : '';
      if (errorName === 'NotAllowedError') {
        alert('Acesso ao microfone negado. Verifique as permissões do navegador.');
      } else {
        alert('Não foi possível acessar o microfone. Verifique as permissões.');
      }
    }
  }, [onFileSelect]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isDark = variant === "dark";

  // If recording, show the recording UI
  if (isRecording) {
    return (
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg",
        isDark 
          ? "bg-red-500/20 border border-red-500/50" 
          : "bg-red-50 border border-red-200"
      )}>
        <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
        <span className={cn(
          "text-sm font-mono",
          isDark ? "text-red-400" : "text-red-600"
        )}>
          {formatTime(recordingTime)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={stopRecording}
          className={cn(
            "h-8 w-8",
            isDark 
              ? "text-red-400 hover:bg-red-500/20" 
              : "text-red-600 hover:bg-red-100"
          )}
          title="Parar gravação"
        >
          <Square className="h-4 w-4 fill-current" />
        </Button>
      </div>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className={cn(
            "h-10 w-10 shrink-0",
            isDark 
              ? "text-cyan-400 hover:bg-cyan-500/20" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Paperclip className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        align="start" 
        className={cn(
          "w-auto p-2",
          isDark && "bg-black/80 backdrop-blur-md border-cyan-500/30"
        )}
      >
        <div className="flex gap-1">
          {/* Hidden inputs with camera capture */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="*/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => imageInputRef.current?.click()}
            className={cn(
              "h-10 w-10",
              isDark 
                ? "text-green-400 hover:bg-green-500/20" 
                : "text-green-600 hover:bg-green-50"
            )}
            title="Tirar Foto"
          >
            <Camera className="h-5 w-5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => videoInputRef.current?.click()}
            className={cn(
              "h-10 w-10",
              isDark 
                ? "text-purple-400 hover:bg-purple-500/20" 
                : "text-purple-600 hover:bg-purple-50"
            )}
            title="Gravar Vídeo"
          >
            <FileVideo className="h-5 w-5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={startRecording}
            className={cn(
              "h-10 w-10",
              isDark 
                ? "text-orange-400 hover:bg-orange-500/20" 
                : "text-orange-600 hover:bg-orange-50"
            )}
            title="Gravar Áudio"
          >
            <Mic className="h-5 w-5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "h-10 w-10",
              isDark 
                ? "text-blue-400 hover:bg-blue-500/20" 
                : "text-blue-600 hover:bg-blue-50"
            )}
            title="Arquivo"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

type PreviewProps = {
  file: File;
  onRemove: () => void;
  variant?: "light" | "dark";
};

export function MediaPreview({ file, onRemove, variant = "light" }: PreviewProps) {
  const [previewUrl] = useState(() => {
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      return URL.createObjectURL(file);
    }
    return null;
  });

  const isDark = variant === "dark";
  const isAudio = file.type.startsWith('audio/');

  return (
    <div className={cn(
      "relative inline-flex items-center gap-2 p-2 rounded-lg border mb-2",
      isDark 
        ? "bg-black/40 border-cyan-500/30" 
        : "bg-muted/50 border-border/50"
    )}>
      {file.type.startsWith('image/') && previewUrl && (
        <img src={previewUrl} alt="Preview" className="h-16 w-16 object-cover rounded" />
      )}
      {file.type.startsWith('video/') && previewUrl && (
        <video src={previewUrl} className="h-16 w-16 object-cover rounded" muted />
      )}
      {isAudio && (
        <div className={cn(
          "h-12 w-12 rounded flex items-center justify-center",
          isDark ? "bg-orange-500/20" : "bg-orange-100"
        )}>
          <Mic className={cn("h-5 w-5", isDark ? "text-orange-400" : "text-orange-600")} />
        </div>
      )}
      {!previewUrl && !isAudio && (
        <div className={cn(
          "h-12 w-12 rounded flex items-center justify-center",
          isDark ? "bg-cyan-500/20" : "bg-primary/10"
        )}>
          <Paperclip className={cn("h-5 w-5", isDark ? "text-cyan-400" : "text-primary")} />
        </div>
      )}
      <div className="flex flex-col min-w-0">
        <span className={cn(
          "text-xs font-medium truncate max-w-[120px]",
          isDark ? "text-white" : "text-foreground"
        )}>
          {isAudio ? '🎙️ Áudio gravado' : file.name}
        </span>
        <span className={cn("text-[10px]", isDark ? "text-cyan-400/70" : "text-muted-foreground")}>
          {(file.size / 1024 / 1024).toFixed(2)} MB
        </span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className={cn(
          "h-6 w-6 absolute -top-2 -right-2",
          isDark 
            ? "bg-red-500/80 hover:bg-red-500 text-white" 
            : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
        )}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
