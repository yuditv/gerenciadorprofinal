import { FileText, Download, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  mediaUrl: string;
  mediaType: string | null;
  fileName: string | null;
  mine?: boolean;
};

export function MediaMessage({ mediaUrl, mediaType, fileName, mine }: Props) {
  const type = mediaType?.toLowerCase() || 'document';

  if (type === 'image' || type.startsWith('image')) {
    return (
      <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="block">
        <img 
          src={mediaUrl} 
          alt={fileName || 'Imagem'} 
          className="max-w-full rounded-lg max-h-60 object-cover hover:opacity-90 transition-opacity"
        />
      </a>
    );
  }

  if (type === 'video' || type.startsWith('video')) {
    return (
      <video 
        src={mediaUrl} 
        controls 
        className="max-w-full rounded-lg max-h-60"
        preload="metadata"
      >
        <track kind="captions" />
      </video>
    );
  }

  if (type === 'audio' || type.startsWith('audio')) {
    return (
      <div className="flex items-center gap-2">
        <Play className={cn("h-4 w-4", mine ? "text-white/70" : "text-muted-foreground")} />
        <audio src={mediaUrl} controls className="max-w-[200px] h-8" preload="metadata" />
      </div>
    );
  }

  // Document / other file types
  return (
    <a 
      href={mediaUrl} 
      target="_blank" 
      rel="noopener noreferrer"
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
        mine 
          ? "bg-white/10 border-white/20 hover:bg-white/20" 
          : "bg-card/50 border-border/30 hover:bg-card/70"
      )}
    >
      <FileText className={cn("h-5 w-5", mine ? "text-white/70" : "text-muted-foreground")} />
      <span className={cn("text-sm truncate max-w-[150px]", mine ? "text-white" : "text-foreground")}>
        {fileName || 'Arquivo'}
      </span>
      <Download className={cn("h-4 w-4 ml-auto", mine ? "text-white/50" : "text-muted-foreground")} />
    </a>
  );
}