import { Bell, BellRing, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSystemNotifications } from "@/hooks/useSystemNotifications";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function NotificationPermissionBanner() {
  const { permission, isSupported, requestPermission } = useSystemNotifications();
  const [dismissed, setDismissed] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    const wasDismissed = localStorage.getItem('notification-banner-dismissed');
    if (wasDismissed === 'true') {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('notification-banner-dismissed', 'true');
  };

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    await requestPermission();
    setIsRequesting(false);
  };

  // Don't show if not supported, already granted, or dismissed
  if (!isSupported || permission === 'granted' || dismissed) {
    return null;
  }

  // Don't show if explicitly denied (can't ask again)
  if (permission === 'denied') {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full mx-4"
      >
        <div className="bg-primary/95 backdrop-blur-sm text-primary-foreground rounded-lg shadow-xl p-4 flex items-center gap-3">
          <div className="flex-shrink-0">
            <BellRing className="h-6 w-6 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">Ativar Notificações</p>
            <p className="text-xs opacity-90 mt-0.5">
              Receba alertas sonoros e notificações na barra do Windows
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleRequestPermission}
              disabled={isRequesting}
              className="whitespace-nowrap"
            >
              {isRequesting ? (
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Aguarde
                </span>
              ) : (
                <>
                  <Bell className="h-4 w-4 mr-1" />
                  Ativar
                </>
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleDismiss}
              className="h-8 w-8 hover:bg-primary-foreground/20"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
