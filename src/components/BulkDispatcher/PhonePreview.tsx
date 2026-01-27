import { motion } from 'framer-motion';
import { generatePreview } from '@/lib/spintaxParser';
import { cn } from '@/lib/utils';
import { Image, Video, FileAudio, FileText, Check, CheckCheck } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  variations?: string[];
  mediaType?: 'none' | 'image' | 'video' | 'audio' | 'document';
  mediaUrl?: string;
  fileName?: string;
}

interface PhonePreviewProps {
  message?: Message;
  contactName?: string;
  className?: string;
}

export function PhonePreview({ message, contactName = "João Silva", className }: PhonePreviewProps) {
  const previewContent = message?.content ? generatePreview(message.content) : '';
  
  // Replace variables with example values
  const processedContent = previewContent
    .replace(/{nome}/g, contactName)
    .replace(/{primeiro_nome}/g, contactName.split(' ')[0])
    .replace(/{telefone}/g, '5511999998888')
    .replace(/{plano}/g, 'Premium')
    .replace(/{vencimento}/g, '15/02/2026')
    .replace(/{dias}/g, '3')
    .replace(/{link}/g, 'https://exemplo.com/pagamento');

  const getMediaIcon = () => {
    switch (message?.mediaType) {
      case 'image':
        return <Image className="w-6 h-6" />;
      case 'video':
        return <Video className="w-6 h-6" />;
      case 'audio':
        return <FileAudio className="w-6 h-6" />;
      case 'document':
        return <FileText className="w-6 h-6" />;
      default:
        return null;
    }
  };

  const currentTime = new Date().toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return (
    <div className={cn("phone-preview-container", className)}>
      {/* Phone Frame */}
      <div className="phone-frame">
        {/* Notch */}
        <div className="phone-notch" />
        
        {/* Screen */}
        <div className="phone-screen">
          {/* WhatsApp Header */}
          <div className="whatsapp-header">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">
                  {contactName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">{contactName}</p>
                <p className="text-xs text-emerald-500">online</p>
              </div>
            </div>
          </div>
          
          {/* Chat Area */}
          <div className="whatsapp-chat-area">
            {/* Background Pattern */}
            <div className="whatsapp-pattern" />
            
            {/* Messages */}
            <div className="relative z-10 p-3 space-y-2">
              {/* Date Badge */}
              <div className="flex justify-center mb-4">
                <span className="px-3 py-1 rounded-full bg-background/80 backdrop-blur-sm text-xs text-muted-foreground shadow-sm">
                  Hoje
                </span>
              </div>
              
              {/* Sent Message */}
              {(message?.content || message?.mediaType !== 'none') && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="flex justify-end"
                >
                  <div className="whatsapp-message sent">
                    {/* Media Preview */}
                    {message?.mediaType && message.mediaType !== 'none' && (
                      <div className="media-preview mb-2">
                        {message.mediaUrl ? (
                          message.mediaType === 'image' ? (
                            <img 
                              src={message.mediaUrl} 
                              alt="Preview" 
                              className="w-full h-32 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-full h-20 bg-white/10 rounded-lg flex items-center justify-center gap-2">
                              {getMediaIcon()}
                              <span className="text-xs opacity-80">
                                {message.fileName || `${message.mediaType}.file`}
                              </span>
                            </div>
                          )
                        ) : (
                          <div className="w-full h-20 bg-white/10 rounded-lg flex items-center justify-center gap-2 border border-dashed border-white/20">
                            {getMediaIcon()}
                            <span className="text-xs opacity-60">
                              {message.mediaType === 'image' && 'Imagem'}
                              {message.mediaType === 'video' && 'Vídeo'}
                              {message.mediaType === 'audio' && 'Áudio'}
                              {message.mediaType === 'document' && 'Documento'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Text Content */}
                    {processedContent && (
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {processedContent}
                      </p>
                    )}
                    
                    {/* Time & Status */}
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[10px] opacity-70">{currentTime}</span>
                      <CheckCheck className="w-4 h-4 text-sky-300" />
                    </div>
                  </div>
                </motion.div>
              )}
              
              {/* Empty State */}
              {!message?.content && (!message?.mediaType || message.mediaType === 'none') && (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-3">
                    <span className="text-2xl">💬</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Digite uma mensagem para ver o preview
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* Input Area */}
          <div className="whatsapp-input-area">
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-background/60 rounded-full px-4 py-2 text-xs text-muted-foreground">
                Mensagem
              </div>
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <svg className="w-5 h-5 text-primary-foreground" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
