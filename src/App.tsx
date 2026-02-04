import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { ThemeProvider } from "@/components/ThemeProvider";
import { BulkDispatchProvider } from "@/contexts/BulkDispatchContext";
import { FloatingDispatchPanel } from "@/components/BulkDispatcher/FloatingDispatchPanel";
import AnimatedBackground from "@/components/AnimatedBackground";

// Lazy load pages for code-splitting
const MainLayout = lazy(() => import("./layouts/MainLayout").then(m => ({ default: m.MainLayout })));
const Auth = lazy(() => import("./pages/Auth"));
const EmailConfirmed = lazy(() => import("./pages/EmailConfirmed"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Settings = lazy(() => import("./pages/Settings"));
const Profile = lazy(() => import("./pages/Profile"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const InboxSettings = lazy(() => import("./pages/InboxSettings"));
const Atendimento = lazy(() => import("./pages/Atendimento"));
  const AttendantAuth = lazy(() => import("./pages/AttendantAuth"));

// Customer chat pages
const CustomerChatInvite = lazy(() => import("./pages/CustomerChatInvite"));
const CustomerChatRoom = lazy(() => import("./pages/CustomerChatRoom"));

const Install = lazy(() => import("./pages/Install"));
const ResellerDashboard = lazy(() => import("./pages/ResellerDashboard"));
const ResellerArea = lazy(() => import("./pages/ResellerArea"));
const Contacts = lazy(() => import("./pages/Contacts"));
const WhatsApp = lazy(() => import("./pages/WhatsApp"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const PaymentHistory = lazy(() => import("./pages/PaymentHistory"));
const FilterNumbers = lazy(() => import("./pages/FilterNumbers"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Engajamento = lazy(() => import("./pages/Engajamento"));
const Wallet = lazy(() => import("./pages/Wallet"));
  const VPNTest = lazy(() => import("./pages/VPNTest"));

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const { isAdmin, isLoading: permsLoading } = useUserPermissions();

  if (authLoading || permsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

const AppRoutes = () => (
  <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/c/:token" element={<CustomerChatInvite />} />
      <Route path="/c/:token/chat" element={<CustomerChatRoom />} />
      <Route path="/auth" element={
        <PublicRoute>
          <Auth />
        </PublicRoute>
      } />
      <Route
        path="/attendant-auth"
        element={
          <PublicRoute>
            <AttendantAuth />
          </PublicRoute>
        }
      />
      <Route path="/email-confirmed" element={<EmailConfirmed />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={
        <ProtectedRoute>
          <MainLayout />
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      } />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/my-dashboard" element={
        <ProtectedRoute>
          <ResellerDashboard />
        </ProtectedRoute>
      } />
      <Route path="/reseller" element={
        <ProtectedRoute>
          <ResellerArea />
        </ProtectedRoute>
      } />
      <Route path="/contacts" element={
        <ProtectedRoute>
          <Contacts />
        </ProtectedRoute>
      } />
      <Route path="/whatsapp" element={
        <ProtectedRoute>
          <WhatsApp />
        </ProtectedRoute>
      } />
      <Route path="/admin" element={
        <ProtectedRoute>
          <AdminPanel />
        </ProtectedRoute>
      } />
      <Route path="/atendimento" element={
        <ProtectedRoute>
          <div className="h-screen">
            <Atendimento />
          </div>
        </ProtectedRoute>
      } />
      <Route path="/inbox-settings" element={
        <ProtectedRoute>
          <InboxSettings />
        </ProtectedRoute>
      } />
      <Route path="/payment-history" element={
        <ProtectedRoute>
          <PaymentHistory />
        </ProtectedRoute>
      } />
      <Route path="/install" element={<Install />} />
      <Route path="/vpn-test" element={
        <ProtectedRoute>
          <VPNTest />
        </ProtectedRoute>
      } />
      <Route path="/filter-numbers" element={
        <ProtectedRoute>
          <FilterNumbers />
        </ProtectedRoute>
      } />
      <Route path="/engajamento" element={
        <ProtectedRoute>
          <Engajamento />
        </ProtectedRoute>
      } />
      <Route path="/carteira" element={
        <AdminRoute>
          <Wallet />
        </AdminRoute>
      } />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </Suspense>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="client-manager-theme">
      <TooltipProvider>
        <AnimatedBackground />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <BulkDispatchProvider>
              <AppRoutes />
              <FloatingDispatchPanel />
            </BulkDispatchProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
