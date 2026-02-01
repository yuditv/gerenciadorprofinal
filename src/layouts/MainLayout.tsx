import { lazy, Suspense, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { FloatingSidebar, AppSection } from "@/components/FloatingSidebar";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import { NotificationPermissionBanner } from "@/components/NotificationPermissionBanner";
import { usePersistedState } from "@/hooks/usePersistedState";

// Lazy load heavy components
const Index = lazy(() => import("@/pages/Index"));
const WhatsApp = lazy(() => import("@/pages/WhatsApp"));
const FilterNumbers = lazy(() => import("@/pages/FilterNumbers"));
const AIAgent = lazy(() => import("@/pages/AIAgent"));
const WarmChips = lazy(() => import("@/pages/WarmChips"));
const Atendimento = lazy(() => import("@/pages/Atendimento"));
const ContentLoader = () => <div className="flex items-center justify-center h-full min-h-[400px]">
    <div className="relative">
      <div className="h-12 w-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      <div className="absolute inset-0 h-12 w-12 rounded-full border-2 border-transparent border-b-primary/40 animate-spin" style={{
      animationDirection: 'reverse',
      animationDuration: '1.5s'
    }} />
    </div>
  </div>;
export function MainLayout() {
  const [activeSection, setActiveSection] = usePersistedState<AppSection>("app-active-section", "clients");
  const [searchParams] = useSearchParams();
  const {
    toast
  } = useToast();
  const handleSectionChange = (section: AppSection) => {
    setActiveSection(section);
  };
  const {
    shortcuts
  } = useKeyboardShortcuts({
    onSectionChange: section => {
      const shortcut = shortcuts.find(s => s.section === section);
      handleSectionChange(section);
      if (shortcut) {
        toast({
          title: shortcut.label,
          description: `Ctrl+${shortcut.key}`,
          duration: 1500
        });
      }
    }
  });
  useEffect(() => {
    const section = searchParams.get('section') as AppSection;
    if (section && ['clients', 'whatsapp', 'atendimento', 'filter-numbers', 'ai-agent', 'warm-chips'].includes(section)) {
      setActiveSection(section);
    }
  }, [searchParams]);
  const renderContent = () => {
    switch (activeSection) {
      case "clients":
        return <Index />;
      case "whatsapp":
        return <WhatsApp />;
      case "filter-numbers":
        return <FilterNumbers />;
      case "ai-agent":
        return <AIAgent />;
      case "warm-chips":
        return <WarmChips />;
      case "atendimento":
        return <Atendimento />;
      default:
        return <Index />;
    }
  };
  return <div className="min-h-screen flex flex-col w-full relative">
      {/* Notification Permission Banner */}
      <NotificationPermissionBanner />
      
      {/* Subscription Expiration Banner */}
      <SubscriptionBanner />
      
      {/* Top Navigation Bar */}
      <FloatingSidebar activeSection={activeSection} onSectionChange={handleSectionChange} />

      {/* Main Content */}
      <motion.main className="flex-1 p-6 overflow-auto mx-0 my-0 mr-0 pl-0 pt-0 pr-0 pb-0 border-none mb-0 px-0 py-0" initial={{
      opacity: 0,
      y: 20
    }} animate={{
      opacity: 1,
      y: 0
    }} transition={{
      duration: 0.4,
      ease: "easeOut"
    }} key={activeSection}>
        <Suspense fallback={<ContentLoader />}>
          {renderContent()}
        </Suspense>
      </motion.main>
    </div>;
}