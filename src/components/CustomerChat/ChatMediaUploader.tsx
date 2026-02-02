import { useRef, useState } from "react";
import { ImagePlus, FileVideo, Mic, Paperclip, X, Loader2 } from "lucide-react";
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
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const isDark = variant === "dark";

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
          {/* Hidden inputs */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
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
            title="Foto"
          >
            <ImagePlus className="h-5 w-5" />
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
            title="Vídeo"
          >
            <FileVideo className="h-5 w-5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => audioInputRef.current?.click()}
            className={cn(
              "h-10 w-10",
              isDark 
                ? "text-orange-400 hover:bg-orange-500/20" 
                : "text-orange-600 hover:bg-orange-50"
            )}
            title="Áudio"
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
      {!previewUrl && (
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
          {file.name}
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