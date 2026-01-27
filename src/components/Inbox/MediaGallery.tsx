import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChatMessage } from "@/hooks/useInboxMessages";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MediaItem {
  id: string;
  url: string;
  type: string;
  timestamp: Date;
  senderName?: string;
}

interface MediaGalleryProps {
  messages: ChatMessage[];
  initialMediaId?: string;
  onClose: () => void;
}

export function MediaGallery({ messages, initialMediaId, onClose }: MediaGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Extract all media from messages
  const mediaItems: MediaItem[] = messages
    .filter(msg => msg.media_url && (
      msg.media_type?.startsWith('image/') || 
      msg.media_type?.startsWith('video/')
    ))
    .map(msg => ({
      id: msg.id,
      url: msg.media_url!,
      type: msg.media_type!,
      timestamp: new Date(msg.created_at),
      senderName: msg.sender_type === 'contact' ? 'Cliente' : 
                  msg.sender_type === 'ai' ? 'IA' : 'Atendente'
    }));

  // Find initial index based on initialMediaId
  useEffect(() => {
    if (initialMediaId) {
      const index = mediaItems.findIndex(item => item.id === initialMediaId);
      if (index !== -1) {
        setCurrentIndex(index);
      }
    }
  }, [initialMediaId, mediaItems]);

  const currentMedia = mediaItems[currentIndex];

  // Navigation
  const goToPrevious = useCallback(() => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : mediaItems.length - 1));
    setZoom(1);
  }, [mediaItems.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => (prev < mediaItems.length - 1 ? prev + 1 : 0));
    setZoom(1);
  }, [mediaItems.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case 'Escape':
          onClose();
          break;
        case '+':
        case '=':
          setZoom(z => Math.min(z + 0.25, 3));
          break;
        case '-':
          setZoom(z => Math.max(z - 0.25, 0.5));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrevious, goToNext, onClose]);

  // Toggle fullscreen
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Download media
  const downloadMedia = () => {
    if (!currentMedia) return;
    
    const link = document.createElement('a');
    link.href = currentMedia.url;
    link.download = `media_${currentMedia.id}.${currentMedia.type.split('/')[1]}`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (mediaItems.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 text-white">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
          
          <div className="text-sm">
            <span className="font-medium">{currentIndex + 1}</span>
            <span className="text-white/60"> / {mediaItems.length}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls (only for images) */}
          {currentMedia?.type.startsWith('image/') && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10"
                onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))}
                disabled={zoom <= 0.5}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs text-white/60 w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10"
                onClick={() => setZoom(z => Math.min(z + 0.25, 3))}
                disabled={zoom >= 3}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            onClick={toggleFullscreen}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            onClick={downloadMedia}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {/* Previous button */}
        {mediaItems.length > 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 z-10 text-white hover:bg-white/10 h-12 w-12"
            onClick={goToPrevious}
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>
        )}

        {/* Media display */}
        <div 
          className="max-w-[90vw] max-h-[80vh] flex items-center justify-center"
          style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s' }}
        >
          {currentMedia?.type.startsWith('image/') ? (
            <img
              src={currentMedia.url}
              alt="Media"
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
              draggable={false}
            />
          ) : currentMedia?.type.startsWith('video/') ? (
            <video
              src={currentMedia.url}
              controls
              autoPlay
              className="max-w-full max-h-[80vh] rounded-lg"
            />
          ) : null}
        </div>

        {/* Next button */}
        {mediaItems.length > 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 z-10 text-white hover:bg-white/10 h-12 w-12"
            onClick={goToNext}
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
        )}
      </div>

      {/* Footer - Media info */}
      {currentMedia && (
        <div className="p-4 text-white text-center">
          <p className="text-sm text-white/60">
            {currentMedia.senderName} • {format(currentMedia.timestamp, "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
      )}

      {/* Thumbnail strip */}
      {mediaItems.length > 1 && (
        <div className="p-4 flex justify-center gap-2 overflow-x-auto">
          {mediaItems.map((item, index) => (
            <button
              key={item.id}
              onClick={() => {
                setCurrentIndex(index);
                setZoom(1);
              }}
              className={cn(
                "w-16 h-16 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0",
                index === currentIndex 
                  ? "border-primary ring-2 ring-primary/50" 
                  : "border-transparent opacity-60 hover:opacity-100"
              )}
            >
              {item.type.startsWith('image/') ? (
                <img
                  src={item.url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  src={item.url}
                  className="w-full h-full object-cover"
                  muted
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
