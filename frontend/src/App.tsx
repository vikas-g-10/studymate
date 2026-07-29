import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import QuizPage from "./pages/Quiz.tsx";
import RevisionPage from "./pages/Revision.tsx";
import MedicalReportPage from "./pages/MedicalReport.tsx";
import AuthPage from "./pages/Auth.tsx";
import NotFound from "./pages/NotFound.tsx";
import { AuthContext } from "./lib/auth-context.ts";
import { supabase } from "@/integrations/supabase/client";

const queryClient = new QueryClient();

type User = { name: string; email: string } | null;

// Guest mode is a deliberate local-only escape hatch (no Supabase session).
// It's tracked separately from `user` so it can never be confused with a
// real, verified Supabase session.
const GUEST_USER: User = { name: "Guest", email: "guest@studymate.app" };

const App = () => {
  const [user, setUser] = useState<User>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // Restore an existing Supabase session (e.g. on page refresh).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          name:
            (session.user.user_metadata?.full_name as string | undefined) ||
            session.user.email?.split("@")[0] ||
            "Student",
          email: session.user.email ?? "",
        });
      }
      setInitializing(false);
    });

    // Keep local state in sync with Supabase's own auth state (login,
    // logout, token refresh, session expiry) instead of trusting a
    // self-reported localStorage value.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setIsGuest(false);
        setUser({
          name:
            (session.user.user_metadata?.full_name as string | undefined) ||
            session.user.email?.split("@")[0] ||
            "Student",
          email: session.user.email ?? "",
        });
      } else {
        setUser((prev) => (isGuest ? prev : null));
      }
    });

    return () => listener.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAuth = (u: { name: string; email: string }) => {
    // Only the explicit guest button should ever produce a userless session.
    if (u.email === GUEST_USER.email) {
      setIsGuest(true);
    }
    setUser(u);
  };

  const handleLogout = async () => {
    setIsGuest(false);
    setUser(null);
    await supabase.auth.signOut();
  };

  if (initializing) {
    return null;
  }

  if (!user) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AuthPage onAuth={handleAuth} />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthContext.Provider value={{ user, logout: handleLogout }}>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/quiz" element={<QuizPage />} />
              <Route path="/revision" element={<RevisionPage />} />
              <Route path="/medical-report" element={<MedicalReportPage />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthContext.Provider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
