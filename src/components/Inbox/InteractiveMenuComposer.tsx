import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  SquareStack, 
  List, 
  BarChart3, 
  Layers, 
  Plus, 
  Trash2,
  Link,
  Phone,
  Copy,
  MessageSquare,
  Send,
  Image
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useInteractiveMessage, MenuType } from "@/hooks/useInteractiveMessage";

export interface InteractiveMenuData {
  menuType: MenuType;
  text: string;
  choices: string[];
  footerText?: string;
  listButton?: string;
  selectableCount?: number;
  imageButton?: string;
}

interface InteractiveMenuComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone?: string;
  instanceKey?: string;
  onSent?: () => void;
  /** Modo compositor - retorna os dados ao invés de enviar */
  composeMode?: boolean;
  onCompose?: (data: InteractiveMenuData) => void;
}

interface MenuChoice {
  id: string;
  label: string;
  value: string;
  type: "response" | "url" | "call" | "copy";
}

const MENU_TYPES = [
  { type: "button" as MenuType, icon: SquareStack, label: "Botões", maxChoices: 3 },
  { type: "list" as MenuType, icon: List, label: "Lista", maxChoices: 10 },
  { type: "poll" as MenuType, icon: BarChart3, label: "Enquete", maxChoices: 12 },
  { type: "carousel" as MenuType, icon: Layers, label: "Carrossel", maxChoices: 10 },
];

const CHOICE_TYPES = [
  { type: "response" as const, icon: MessageSquare, label: "Resposta" },
  { type: "url" as const, icon: Link, label: "URL" },
  { type: "call" as const, icon: Phone, label: "Ligação" },
  { type: "copy" as const, icon: Copy, label: "Copiar" },
];

export function InteractiveMenuComposer({
  open,
  onOpenChange,
  phone = "",
  instanceKey = "",
  onSent,
  composeMode = false,
  onCompose
}: InteractiveMenuComposerProps) {
  const { sendInteractiveMenu, isSending } = useInteractiveMessage();
  
  const [menuType, setMenuType] = useState<MenuType>("button");
  const [mainText, setMainText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [listButton, setListButton] = useState("Ver opções");
  const [selectableCount, setSelectableCount] = useState(1);
  const [imageUrl, setImageUrl] = useState("");
  const [choices, setChoices] = useState<MenuChoice[]>([
    { id: crypto.randomUUID(), label: "", value: "", type: "response" }
  ]);

  const currentMenuConfig = MENU_TYPES.find(m => m.type === menuType);
  const maxChoices = currentMenuConfig?.maxChoices || 3;

  const addChoice = () => {
    if (choices.length >= maxChoices) return;
    setChoices([
      ...choices,
      { id: crypto.randomUUID(), label: "", value: "", type: "response" }
    ]);
  };

  const removeChoice = (id: string) => {
    if (choices.length <= 1) return;
    setChoices(choices.filter(c => c.id !== id));
  };

  const updateChoice = (id: string, field: keyof MenuChoice, value: string) => {
    setChoices(choices.map(c => 
      c.id === id ? { ...c, [field]: value } : c
    ));
  };

  const formatChoices = (): string[] => {
    return choices
      .filter(c => c.label.trim())
      .map(c => {
        const label = c.label.trim();
        const value = c.value.trim() || label.toLowerCase().replace(/\s+/g, "_");
        
        switch (c.type) {
          case "url":
            return `${label}|${value.startsWith("http") ? value : `https://${value}`}`;
          case "call":
            return `${label}|call:${value.replace(/\D/g, "")}`;
          case "copy":
            return `${label}|copy:${value}`;
          default:
            return `${label}|${value}`;
        }
      });
  };

  const handleSend = async () => {
    if (!mainText.trim() || choices.filter(c => c.label.trim()).length === 0) return;

    const menuData: InteractiveMenuData = {
      menuType,
      text: mainText.trim(),
      choices: formatChoices(),
      footerText: footerText.trim() || undefined,
      listButton: menuType === "list" ? listButton : undefined,
      selectableCount: menuType === "poll" ? selectableCount : undefined,
      imageButton: imageUrl.trim() || undefined
    };

    // Modo compositor - apenas retorna os dados
    if (composeMode) {
      onCompose?.(menuData);
      // Reset form
      setMainText("");
      setFooterText("");
      setChoices([{ id: crypto.randomUUID(), label: "", value: "", type: "response" }]);
      setImageUrl("");
      onOpenChange(false);
      return;
    }

    // Modo envio direto
    const success = await sendInteractiveMenu({
      phone,
      instanceKey,
      ...menuData
    });

    if (success) {
      // Reset form
      setMainText("");
      setFooterText("");
      setChoices([{ id: crypto.randomUUID(), label: "", value: "", type: "response" }]);
      setImageUrl("");
      onOpenChange(false);
      onSent?.();
    }
  };

  const isValid = mainText.trim() && choices.filter(c => c.label.trim()).length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SquareStack className="h-5 w-5 text-primary" />
            Enviar Menu Interativo
          </DialogTitle>
          <DialogDescription>
            Crie botões, listas, enquetes ou carrosséis interativos para o WhatsApp
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* Menu Type Selection */}
          <Tabs value={menuType} onValueChange={(v) => setMenuType(v as MenuType)}>
            <TabsList className="grid grid-cols-4 w-full">
              {MENU_TYPES.map(({ type, icon: Icon, label }) => (
                <TabsTrigger key={type} value={type} className="gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Type-specific hints */}
            <div className="mt-3 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              {menuType === "button" && (
                <p>📌 Até 3 botões para ações rápidas. Suporta resposta, URL, ligação ou cópia.</p>
              )}
              {menuType === "list" && (
                <p>📋 Menu com até 10 itens organizados. Ideal para catálogos ou opções extensas.</p>
              )}
              {menuType === "poll" && (
                <p>📊 Enquete com até 12 opções. Defina quantas podem ser selecionadas.</p>
              )}
              {menuType === "carousel" && (
                <p>🎠 Lista horizontal com imagens. Cada item pode ter botões de ação.</p>
              )}
            </div>
          </Tabs>

          {/* Main Text */}
          <div className="space-y-2">
            <Label>Texto Principal *</Label>
            <Textarea
              value={mainText}
              onChange={(e) => setMainText(e.target.value)}
              placeholder="Como posso ajudar você hoje?"
              className="min-h-[80px]"
            />
          </div>

          {/* Image URL (for buttons) */}
          {menuType === "button" && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Image className="h-4 w-4" />
                Imagem do Cabeçalho (opcional)
              </Label>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://exemplo.com/imagem.jpg"
              />
            </div>
          )}

          {/* Poll-specific: Selectable Count */}
          {menuType === "poll" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Opções selecionáveis</Label>
                <Badge variant="secondary">{selectableCount}</Badge>
              </div>
              <Slider
                value={[selectableCount]}
                onValueChange={([v]) => setSelectableCount(v)}
                min={1}
                max={Math.min(choices.length, 10)}
                step={1}
              />
              <p className="text-xs text-muted-foreground">
                Quantas opções o usuário pode selecionar na enquete
              </p>
            </div>
          )}

          {/* List-specific: Button Text */}
          {menuType === "list" && (
            <div className="space-y-2">
              <Label>Texto do Botão</Label>
              <Input
                value={listButton}
                onChange={(e) => setListButton(e.target.value)}
                placeholder="Ver opções"
              />
            </div>
          )}

          {/* Choices */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Opções ({choices.length}/{maxChoices})</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addChoice}
                disabled={choices.length >= maxChoices}
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>

            <AnimatePresence mode="popLayout">
              {choices.map((choice, index) => (
                <motion.div
                  key={choice.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-3 rounded-lg border bg-card space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Opção {index + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      {/* Choice Type Selector */}
                      <div className="flex gap-1">
                        {CHOICE_TYPES.map(({ type, icon: Icon, label }) => (
                          <Button
                            key={type}
                            type="button"
                            variant={choice.type === type ? "default" : "ghost"}
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateChoice(choice.id, "type", type)}
                            title={label}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </Button>
                        ))}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removeChoice(choice.id)}
                        disabled={choices.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Texto do botão *</Label>
                      <Input
                        value={choice.label}
                        onChange={(e) => updateChoice(choice.id, "label", e.target.value)}
                        placeholder="Ex: Ver produtos"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">
                        {choice.type === "url" && "URL"}
                        {choice.type === "call" && "Telefone"}
                        {choice.type === "copy" && "Texto para copiar"}
                        {choice.type === "response" && "ID da resposta (opcional)"}
                      </Label>
                      <Input
                        value={choice.value}
                        onChange={(e) => updateChoice(choice.id, "value", e.target.value)}
                        placeholder={
                          choice.type === "url" ? "https://..." :
                          choice.type === "call" ? "+5511999999999" :
                          choice.type === "copy" ? "Código ou texto" :
                          "produto_1"
                        }
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Footer Text */}
          <div className="space-y-2">
            <Label>Rodapé (opcional)</Label>
            <Input
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder="Escolha uma das opções acima"
            />
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={!isValid || (!composeMode && isSending)}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            {composeMode ? "Usar Menu" : (isSending ? "Enviando..." : "Enviar Menu")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
