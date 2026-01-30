import { useState } from "react";
import { 
  GalleryHorizontal, 
  Plus, 
  Trash2, 
  Image, 
  Video, 
  FileText,
  Reply,
  Link,
  Phone,
  Copy,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInteractiveMessage, CarouselCard, ButtonType } from "@/hooks/useInteractiveMessage";
import { cn } from "@/lib/utils";

export interface MediaCarouselData {
  text: string;
  carousel: CarouselCard[];
  delay?: number;
}

interface MediaCarouselComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone?: string;
  instanceKey?: string;
  onSent?: () => void;
  /** Modo compositor - retorna os dados ao invés de enviar */
  composeMode?: boolean;
  onCompose?: (data: MediaCarouselData) => void;
}

const BUTTON_TYPES = [
  { type: "REPLY" as ButtonType, icon: Reply, label: "Resposta" },
  { type: "URL" as ButtonType, icon: Link, label: "Link" },
  { type: "CALL" as ButtonType, icon: Phone, label: "Ligar" },
  { type: "COPY" as ButtonType, icon: Copy, label: "Copiar" },
];

const MEDIA_TYPES = [
  { type: "image", icon: Image, label: "Imagem" },
  { type: "video", icon: Video, label: "Vídeo" },
  { type: "document", icon: FileText, label: "Documento" },
];

interface CardState {
  id: string;
  text: string;
  mediaType: "image" | "video" | "document";
  mediaUrl: string;
  filename?: string;
  buttons: Array<{
    id: string;
    text: string;
    value: string;
    type: ButtonType;
  }>;
}

const createEmptyCard = (): CardState => ({
  id: crypto.randomUUID(),
  text: "",
  mediaType: "image",
  mediaUrl: "",
  buttons: [{
    id: crypto.randomUUID(),
    text: "",
    value: "",
    type: "REPLY"
  }]
});

export function MediaCarouselComposer({
  open,
  onOpenChange,
  phone = "",
  instanceKey = "",
  onSent,
  composeMode = false,
  onCompose
}: MediaCarouselComposerProps) {
  const { sendMediaCarousel, isSending } = useInteractiveMessage();
  const [headerText, setHeaderText] = useState("");
  const [cards, setCards] = useState<CardState[]>([createEmptyCard()]);
  const [activeCardIndex, setActiveCardIndex] = useState(0);

  const addCard = () => {
    if (cards.length < 10) {
      setCards([...cards, createEmptyCard()]);
      setActiveCardIndex(cards.length);
    }
  };

  const removeCard = (index: number) => {
    if (cards.length > 1) {
      const newCards = cards.filter((_, i) => i !== index);
      setCards(newCards);
      if (activeCardIndex >= newCards.length) {
        setActiveCardIndex(newCards.length - 1);
      }
    }
  };

  const updateCard = (index: number, updates: Partial<CardState>) => {
    setCards(cards.map((card, i) => 
      i === index ? { ...card, ...updates } : card
    ));
  };

  const addButton = (cardIndex: number) => {
    const card = cards[cardIndex];
    if (card.buttons.length < 3) {
      updateCard(cardIndex, {
        buttons: [...card.buttons, {
          id: crypto.randomUUID(),
          text: "",
          value: "",
          type: "REPLY"
        }]
      });
    }
  };

  const removeButton = (cardIndex: number, buttonIndex: number) => {
    const card = cards[cardIndex];
    if (card.buttons.length > 1) {
      updateCard(cardIndex, {
        buttons: card.buttons.filter((_, i) => i !== buttonIndex)
      });
    }
  };

  const updateButton = (cardIndex: number, buttonIndex: number, updates: Partial<CardState["buttons"][0]>) => {
    const card = cards[cardIndex];
    updateCard(cardIndex, {
      buttons: card.buttons.map((btn, i) => 
        i === buttonIndex ? { ...btn, ...updates } : btn
      )
    });
  };

  const formatCarouselForSend = (): CarouselCard[] => {
    return cards.map(card => {
      const formattedCard: CarouselCard = {
        text: card.text,
        buttons: card.buttons.map(btn => ({
          id: btn.type === "URL" ? btn.value : 
              btn.type === "CALL" ? btn.value : 
              btn.type === "COPY" ? btn.value : 
              btn.value || btn.text,
          text: btn.text,
          type: btn.type
        }))
      };

      if (card.mediaUrl) {
        if (card.mediaType === "image") {
          formattedCard.image = card.mediaUrl;
        } else if (card.mediaType === "video") {
          formattedCard.video = card.mediaUrl;
        } else if (card.mediaType === "document") {
          formattedCard.document = card.mediaUrl;
          if (card.filename) {
            formattedCard.filename = card.filename;
          }
        }
      }

      return formattedCard;
    });
  };

  const isValid = () => {
    if (!headerText.trim()) return false;
    return cards.every(card => 
      card.text.trim() && 
      card.buttons.length > 0 && 
      card.buttons.every(btn => btn.text.trim())
    );
  };

  const handleSend = async () => {
    if (!isValid()) return;

    const carouselData: MediaCarouselData = {
      text: headerText,
      carousel: formatCarouselForSend()
    };

    // Modo compositor - apenas retorna os dados
    if (composeMode) {
      onCompose?.(carouselData);
      // Reset form
      setHeaderText("");
      setCards([createEmptyCard()]);
      setActiveCardIndex(0);
      onOpenChange(false);
      return;
    }

    // Modo envio direto
    const success = await sendMediaCarousel({
      phone,
      instanceKey,
      ...carouselData
    });

    if (success) {
      // Reset form
      setHeaderText("");
      setCards([createEmptyCard()]);
      setActiveCardIndex(0);
      onOpenChange(false);
      onSent?.();
    }
  };

  const activeCard = cards[activeCardIndex];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[90vh] max-h-[90vh] flex flex-col min-h-0 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GalleryHorizontal className="h-5 w-5 text-primary" />
            Carrossel de Mídia
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 min-h-0">
          {/* Header Text */}
          <div className="space-y-2">
            <Label>Texto Principal</Label>
            <Textarea
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
              placeholder="Digite o título do carrossel..."
              className="resize-none"
              rows={2}
            />
          </div>

          {/* Cards Navigation */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {cards.map((card, index) => (
              <Button
                key={card.id}
                variant={activeCardIndex === index ? "default" : "outline"}
                size="sm"
                className="shrink-0"
                onClick={() => setActiveCardIndex(index)}
              >
                Card {index + 1}
              </Button>
            ))}
            {cards.length < 10 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={addCard}
                className="shrink-0"
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            )}
          </div>

          {/* Active Card Editor */}
          <ScrollArea className="flex-1 pr-4 min-h-0">
            <div className="space-y-4">
              {/* Card Header */}
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Card {activeCardIndex + 1}</h4>
                {cards.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCard(activeCardIndex)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Media Type */}
              <div className="space-y-2">
                <Label>Tipo de Mídia</Label>
                <div className="flex gap-2">
                  {MEDIA_TYPES.map(({ type, icon: Icon, label }) => (
                    <Button
                      key={type}
                      variant={activeCard.mediaType === type ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateCard(activeCardIndex, { mediaType: type as CardState["mediaType"] })}
                    >
                      <Icon className="h-4 w-4 mr-1" />
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Media URL */}
              <div className="space-y-2">
                <Label>URL da Mídia (opcional)</Label>
                <Input
                  value={activeCard.mediaUrl}
                  onChange={(e) => updateCard(activeCardIndex, { mediaUrl: e.target.value })}
                  placeholder={`https://exemplo.com/${activeCard.mediaType === "image" ? "imagem.jpg" : activeCard.mediaType === "video" ? "video.mp4" : "documento.pdf"}`}
                />
              </div>

              {/* Filename for documents */}
              {activeCard.mediaType === "document" && activeCard.mediaUrl && (
                <div className="space-y-2">
                  <Label>Nome do Arquivo (opcional)</Label>
                  <Input
                    value={activeCard.filename || ""}
                    onChange={(e) => updateCard(activeCardIndex, { filename: e.target.value })}
                    placeholder="documento.pdf"
                  />
                </div>
              )}

              {/* Card Text */}
              <div className="space-y-2">
                <Label>Texto do Card</Label>
                <Textarea
                  value={activeCard.text}
                  onChange={(e) => updateCard(activeCardIndex, { text: e.target.value })}
                  placeholder="Descrição do produto ou serviço..."
                  className="resize-none"
                  rows={3}
                />
              </div>

              {/* Buttons */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Botões ({activeCard.buttons.length}/3)</Label>
                  {activeCard.buttons.length < 3 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => addButton(activeCardIndex)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Botão
                    </Button>
                  )}
                </div>

                {activeCard.buttons.map((button, btnIndex) => (
                  <div 
                    key={button.id}
                    className="flex gap-2 items-start p-3 rounded-lg border bg-muted/30"
                  >
                    <Select
                      value={button.type}
                      onValueChange={(value) => updateButton(activeCardIndex, btnIndex, { type: value as ButtonType })}
                    >
                      <SelectTrigger className="w-32 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BUTTON_TYPES.map(({ type, icon: Icon, label }) => (
                          <SelectItem key={type} value={type}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex-1 space-y-2">
                      <Input
                        value={button.text}
                        onChange={(e) => updateButton(activeCardIndex, btnIndex, { text: e.target.value })}
                        placeholder="Texto do botão"
                      />
                      <Input
                        value={button.value}
                        onChange={(e) => updateButton(activeCardIndex, btnIndex, { value: e.target.value })}
                        placeholder={
                          button.type === "URL" ? "https://..." :
                          button.type === "CALL" ? "+5511999999999" :
                          button.type === "COPY" ? "Texto a copiar" :
                          "ID da resposta"
                        }
                      />
                    </div>

                    {activeCard.buttons.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeButton(activeCardIndex, btnIndex)}
                        className="shrink-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={!isValid() || (!composeMode && isSending)}
          >
            {!composeMode && isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <GalleryHorizontal className="h-4 w-4 mr-2" />
                {composeMode ? "Usar Carrossel" : "Enviar Carrossel"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}