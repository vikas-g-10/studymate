import { useState } from "react";
import { BookOpen, Eye, EyeOff, Loader2, Sparkles, Brain, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AuthPageProps {
  onAuth: (user: { name: string; email: string }) => void;
}

type Mode = "login" | "signup";

export default function AuthPage({ onAuth }: AuthPageProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      toast.error("Please fill in all fields.");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: name.trim() },
        },
      });

      setIsLoading(false);

      if (error) {
        toast.error(error.message);
        return;
      }

      // If email confirmation is required, Supabase returns a user but no session.
      if (data.user && !data.session) {
        toast.success("Account created! Check your email to confirm before signing in.");
        setMode("login");
        return;
      }

      toast.success("Account created!");
      onAuth({ name: name.trim(), email: email.trim() });
      return;
    }

    // mode === "login"
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setIsLoading(false);

    if (error) {
      // Supabase returns a generic message for bad credentials on purpose,
      // so we don't leak whether the email exists.
      toast.error(
        error.message === "Invalid login credentials"
          ? "Incorrect email or password."
          : error.message
      );
      return;
    }

    const displayName =
      (data.user?.user_metadata?.full_name as string | undefined) ||
      data.user?.email?.split("@")[0] ||
      "Student";

    toast.success("Welcome back!");
    onAuth({ name: displayName, email: data.user?.email ?? email.trim() });
  };

  const features = [
    { icon: Brain, label: "AI-Powered Summaries" },
    { icon: Zap, label: "Last-Minute Revision" },
    { icon: Sparkles, label: "Smart Quiz Generator" },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-primary/90 via-primary to-primary/70 flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                width: `${80 + i * 40}px`,
                height: `${80 + i * 40}px`,
                top: `${10 + i * 13}%`,
                left: `${5 + i * 15}%`,
                opacity: 0.3 - i * 0.03,
              }}
            />
          ))}
        </div>
        <div className="relative z-10 text-center text-white max-w-sm">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur mb-6">
            <BookOpen className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold font-display mb-3">StudyMate AI</h1>
          <p className="text-primary-foreground/80 text-base leading-relaxed mb-10">
            Your intelligent study companion. Upload notes, generate quizzes, revise faster, and understand medical reports — all in one place.
          </p>
          <div className="space-y-3">
            {features.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 text-left bg-white/10 rounded-xl px-4 py-3 backdrop-blur-sm">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-medium text-white">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8 animate-fade-in-up">
          {/* Mobile logo */}
          <div className="lg:hidden text-center">
            <div className="inline-flex items-center gap-2">
              <BookOpen className="h-7 w-7 text-primary" />
              <span className="text-2xl font-bold font-display">StudyMate AI</span>
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-bold font-display tracking-tight">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "login"
                ? "Sign in to continue your learning journey."
                : "Join thousands of students studying smarter."}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex rounded-xl bg-muted/60 p-1">
            {(["login", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                  mode === m
                    ? "bg-background text-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Full Name
                </label>
                <Input
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 rounded-xl border-border bg-background/60"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Email address
              </label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-xl border-border bg-background/60"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Password
                </label>
                {mode === "login" && (
                  <button className="text-xs text-primary hover:underline">
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Input
                  type={showPass ? "text" : "password"}
                  placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-xl border-border bg-background/60 pr-11"
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {mode === "signup" && (
              <p className="text-xs text-muted-foreground">
                By signing up, you agree to our{" "}
                <span className="text-primary cursor-pointer hover:underline">Terms of Service</span>{" "}
                and{" "}
                <span className="text-primary cursor-pointer hover:underline">Privacy Policy</span>.
              </p>
            )}

            <Button
              onClick={handleSubmit}
              disabled={isLoading}
              size="lg"
              className="w-full rounded-xl bg-gradient-hero text-primary-foreground shadow-glow hover:shadow-lift transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {mode === "login" ? "Signing in…" : "Creating account…"}
                </>
              ) : (
                <>{mode === "login" ? "Sign In" : "Create Account"}</>
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <Button
              variant="outline"
              size="lg"
              className="w-full rounded-xl"
              onClick={() => {
                toast.info("Continuing as guest — data stays local only.");
                onAuth({ name: "Guest", email: "guest@studymate.app" });
              }}
            >
              Continue as Guest
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-primary font-semibold hover:underline"
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
