import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type MenuType = "button" | "list" | "poll" | "carousel";
export type ButtonType = "REPLY" | "URL" | "COPY" | "CALL";

export interface InteractiveMenuOptions {
  phone: string;
  instanceKey: string;
  menuType: MenuType;
  text: string;
  choices: string[];
  footerText?: string;
  listButton?: string;
  selectableCount?: number;
  imageButton?: string;
}

export interface CarouselButton {
  id: string;
  text: string;
  type: ButtonType;
}

export interface CarouselCard {
  text: string;
  image?: string;
  video?: string;
  document?: string;
  filename?: string;
  buttons: CarouselButton[];
}

export interface MediaCarouselOptions {
  phone: string;
  instanceKey: string;
  text: string;
  carousel: CarouselCard[];
  delay?: number;
}

export function useInteractiveMessage() {
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);

  const sendInteractiveMenu = async (options: InteractiveMenuOptions): Promise<boolean> => {
    setIsSending(true);
    
    // Validate required fields
    if (!options.phone || !options.instanceKey) {
      console.error("[useInteractiveMessage] Missing phone or instanceKey", { 
        phone: !!options.phone, 
        instanceKey: !!options.instanceKey 
      });
      toast({
        title: "Erro ao enviar menu",
        description: "Telefone ou instância não configurados",
        variant: "destructive"
      });
      setIsSending(false);
      return false;
    }

    try {
      console.log("[useInteractiveMessage] Sending menu:", {
        phone: options.phone,
        menuType: options.menuType,
        choicesCount: options.choices?.length || 0
      });

      const { data, error } = await supabase.functions.invoke("whatsapp-instances", {
        body: { 
          action: "send_menu", 
          phone: options.phone,
          instanceKey: options.instanceKey,
          menuType: options.menuType,
          text: options.text,
          choices: options.choices,
          footerText: options.footerText,
          listButton: options.listButton,
          selectableCount: options.selectableCount,
          imageButton: options.imageButton
        }
      });

      if (error) {
        console.error("[useInteractiveMessage] Function error:", error);
        throw error;
      }

      if (!data?.success) {
        const errorMsg = data?.error || "Erro ao enviar menu interativo";
        console.error("[useInteractiveMessage] API error:", errorMsg, data);
        throw new Error(errorMsg);
      }

      console.log("[useInteractiveMessage] Menu sent successfully:", data);
      toast({
        title: "Menu enviado!",
        description: `Menu ${getMenuTypeLabel(options.menuType)} enviado com sucesso`,
      });

      return true;
    } catch (error) {
      console.error("[useInteractiveMessage] Error sending interactive menu:", error);
      toast({
        title: "Erro ao enviar menu",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsSending(false);
    }
  };

  const sendMediaCarousel = async (options: MediaCarouselOptions): Promise<boolean> => {
    setIsSending(true);
    
    // Validate required fields
    if (!options.phone || !options.instanceKey) {
      console.error("[useInteractiveMessage] Missing phone or instanceKey for carousel", { 
        phone: !!options.phone, 
        instanceKey: !!options.instanceKey 
      });
      toast({
        title: "Erro ao enviar carrossel",
        description: "Telefone ou instância não configurados",
        variant: "destructive"
      });
      setIsSending(false);
      return false;
    }

    try {
      console.log("[useInteractiveMessage] Sending carousel:", {
        phone: options.phone,
        cardsCount: options.carousel?.length || 0
      });

      const { data, error } = await supabase.functions.invoke("whatsapp-instances", {
        body: { 
          action: "send_carousel", 
          phone: options.phone,
          instanceKey: options.instanceKey,
          text: options.text,
          carousel: options.carousel,
          delay: options.delay
        }
      });

      if (error) {
        console.error("[useInteractiveMessage] Function error:", error);
        throw error;
      }

      if (!data?.success) {
        const errorMsg = data?.error || "Erro ao enviar carrossel de mídia";
        console.error("[useInteractiveMessage] API error:", errorMsg, data);
        throw new Error(errorMsg);
      }

      console.log("[useInteractiveMessage] Carousel sent successfully:", data);
      toast({
        title: "Carrossel enviado!",
        description: `Carrossel com ${options.carousel.length} cards enviado com sucesso`,
      });

      return true;
    } catch (error) {
      console.error("[useInteractiveMessage] Error sending media carousel:", error);
      toast({
        title: "Erro ao enviar carrossel",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsSending(false);
    }
  };

  return { sendInteractiveMenu, sendMediaCarousel, isSending };
}

function getMenuTypeLabel(type: MenuType): string {
  switch (type) {
    case "button": return "de botões";
    case "list": return "de lista";
    case "poll": return "de enquete";
    case "carousel": return "carrossel";
    default: return "";
  }
}
