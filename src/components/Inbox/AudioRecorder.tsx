import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Square, Send, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AudioRecorderProps {
  onAudioReady: (url: string, type: string, fileName: string) => void;
  disabled?: boolean;
  onRecordingStart?: () => void;
  onRecordingEnd?: () => void;
}

export function AudioRecorder({ onAudioReady, disabled, onRecordingStart, onRecordingEnd }: AudioRecorderProps) {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw waveform
  const drawWaveform = useCallback(() => {
    if (!analyserRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteTimeDomainData(dataArray);

    // Clear canvas
     // Use a higher-contrast fill so waveform is visible on both themes
     ctx.fillStyle = 'hsl(var(--background))';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw waveform
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'hsl(var(--primary))';
    ctx.beginPath();

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    // Store waveform data for static display
    const samples = 40;
    const sampleSize = Math.floor(bufferLength / samples);
    const newWaveform: number[] = [];
    for (let i = 0; i < samples; i++) {
      let sum = 0;
      for (let j = 0; j < sampleSize; j++) {
        sum += Math.abs(dataArray[i * sampleSize + j] - 128);
      }
      newWaveform.push(sum / sampleSize);
    }
    setWaveformData(newWaveform);

    if (isRecording && !isPaused) {
      animationRef.current = requestAnimationFrame(drawWaveform);
    }
  }, [isRecording, isPaused]);

  // Start recording
  const startRecording = async () => {
    try {
      // Notify parent about recording start
      onRecordingStart?.();
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Setup audio context for visualization
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      // Setup media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setDuration(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);

      // Start visualization
      drawWaveform();

    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: 'Erro ao acessar microfone',
        description: 'Verifique se você permitiu o acesso ao microfone',
        variant: 'destructive'
      });
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    setIsRecording(false);
    setIsPaused(false);
  };

  // Cancel recording
  const cancelRecording = () => {
    stopRecording();
    setAudioBlob(null);
    setWaveformData([]);
    setDuration(0);
    // Notify parent about recording end
    onRecordingEnd?.();
  };

  // Upload and send audio
  const sendAudio = async () => {
    if (!audioBlob) return;

    setIsUploading(true);
    try {
      const fileName = `audio_${Date.now()}.webm`;
      const filePath = `inbox-audio/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('dispatch-media')
        .upload(filePath, audioBlob, {
          contentType: 'audio/webm',
          cacheControl: '3600'
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('dispatch-media')
        .getPublicUrl(filePath);

      onAudioReady(publicUrl, 'audio/webm', fileName);
      // Notify parent about recording end
      onRecordingEnd?.();
      // Reset state without calling onRecordingEnd again
      stopRecording();
      setAudioBlob(null);
      setWaveformData([]);
      setDuration(0);

    } catch (error) {
      console.error('Error uploading audio:', error);
      toast({
        title: 'Erro ao enviar áudio',
        description: 'Tente novamente',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // If we have a recorded audio, show the preview
  if (audioBlob) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card/80 backdrop-blur px-3 py-2 shadow-sm">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive/80"
          onClick={cancelRecording}
          disabled={isUploading}
        >
          <X className="h-4 w-4" />
        </Button>

        {/* Waveform visualization (static) */}
        <div className="flex-1 flex items-center justify-center gap-0.5 h-8 px-2">
          {waveformData.map((value, i) => (
            <div
              key={i}
              className="bg-primary/60 rounded-full w-1"
              style={{ 
                height: `${Math.max(4, Math.min(32, value * 1.5))}px`,
                opacity: 0.6 + (value / 128) * 0.4
              }}
            />
          ))}
        </div>

        <span className="text-xs text-muted-foreground font-mono min-w-[40px]">
          {formatDuration(duration)}
        </span>

        <Button
          size="icon"
          className="h-8 w-8"
          onClick={sendAudio}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
  }

  // If recording, show waveform
  if (isRecording) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card/80 backdrop-blur px-3 py-2 shadow-sm">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive/80"
          onClick={cancelRecording}
        >
          <X className="h-4 w-4" />
        </Button>

        {/* Live waveform canvas */}
        <div className="flex-1 relative h-8 overflow-hidden rounded bg-background/40">
          <canvas 
            ref={canvasRef}
            width={200}
            height={32}
            className="w-full h-full"
          />
          {/* Recording indicator */}
          <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          </div>
        </div>

        <span className="text-xs text-muted-foreground font-mono min-w-[40px]">
          {formatDuration(duration)}
        </span>

        <Button
          size="icon"
          className="h-8 w-8"
          onClick={stopRecording}
        >
          <Square className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Default: microphone button
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "h-7 w-7 transition-colors",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      onClick={startRecording}
      disabled={disabled}
    >
      <Mic className="h-4 w-4" />
    </Button>
  );
}
