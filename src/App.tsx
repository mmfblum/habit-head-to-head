import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { BottomNav } from "./components/BottomNav";
import Index from "./pages/Index";
import Tasks from "./pages/Tasks";
import League from "./pages/League";
import Matchup from "./pages/Matchup";
import Profile from "./pages/Profile";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";
import CheckinDemo from "./pages/CheckinDemo";
import { useUserLeagues } from "./hooks/useLeagues";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}

function LeagueGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { data: leagues, isLoading } = useUserLeagues();
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }
  
  // If user has no leagues, show onboarding
  if (!leagues || leagues.length === 0) {
    return <Onboarding />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();
  
  return (
    <div className="min-h-screen bg-background">
      <Routes>
        <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <LeagueGate>
                <Index />
              </LeagueGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tasks"
          element={
            <ProtectedRoute>
              <LeagueGate>
                <Tasks />
              </LeagueGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/league"
          element={
            <ProtectedRoute>
              <LeagueGate>
                <League />
              </LeagueGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/matchup"
          element={
            <ProtectedRoute>
              <LeagueGate>
                <Matchup />
              </LeagueGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/checkin-demo"
          element={
            <ProtectedRoute>
              <CheckinDemo />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {user && <BottomNav />}
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
