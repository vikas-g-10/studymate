import { useState } from "react";
import {
  BookOpen,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
  Brain,
  Zap,
} from "lucide-react";

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
    // -----------------------------
    // Basic validation
    // -----------------------------
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password.trim()) {
      toast.error("Please enter your email and password.");
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

    try {
      // =========================================================
      // SIGN UP
      // =========================================================
      if (mode === "signup") {
        console.log("SIGN UP: starting request...");

        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: {
              full_name: name.trim(),
            },
          },
        });

        console.log("SIGN UP: response received", {
          data,
          error,
        });

        if (error) {
          const message = error.message?.toLowerCase() || "";

          if (
            message.includes("already registered") ||
            message.includes("already exists")
          ) {
            toast.error(
              "An account with this email already exists. Please sign in."
            );
          } else if (message.includes("password")) {
            toast.error(error.message);
          } else if (message.includes("email")) {
            toast.error(error.message);
          } else {
            toast.error(
              error.message || "Unable to create account. Please try again."
            );
          }

          return;
        }

        // Email confirmation enabled
        if (data.user && !data.session) {
          toast.success(
            "Account created! Please check your email and confirm your account."
          );

          setMode("login");
          setPassword("");

          return;
        }

        // Account created and session available
        toast.success("Account created successfully!");

        const displayName =
          (data.user?.user_metadata?.full_name as string | undefined) ||
          trimmedEmail.split("@")[0] ||
          "Student";

        onAuth({
          name: displayName,
          email: data.user?.email ?? trimmedEmail,
        });

        return;
      }

      // =========================================================
      // SIGN IN
      // =========================================================
      console.log("SIGN IN: starting request...");
      console.log("Supabase URL:", import.meta.env.VITE_SUPABASE_URL);
      console.log(
        "Supabase key exists:",
        Boolean(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
      );

      const signInPromise = supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      // Prevent the UI from buffering forever
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("SIGNIN_TIMEOUT"));
        }, 15000);
      });

      const result = await Promise.race([
        signInPromise,
        timeoutPromise,
      ]);

      const { data, error } = result;

      console.log("SIGN IN: response received");
      console.log("SIGN IN DATA:", data);
      console.log("SIGN IN ERROR:", error);

      if (error) {
        const message = error.message?.toLowerCase() || "";

        // Wrong email/password
        if (
          message.includes("invalid login credentials") ||
          message.includes("invalid_credentials")
        ) {
          toast.error(
            "Incorrect email or password. Please check your details and try again."
          );
          return;
        }

        // Email confirmation
        if (
          message.includes("email not confirmed") ||
          message.includes("email_not_confirmed")
        ) {
          toast.error(
            "Your email is not confirmed. Please check your inbox and confirm your email first."
          );
          return;
        }

        // Invalid API key
        if (
          message.includes("invalid api key") ||
          message.includes("apikey")
        ) {
          toast.error(
            "Supabase API key is invalid. Please check your Supabase configuration."
          );
          return;
        }

        // Network error
        if (
          message.includes("network") ||
          message.includes("failed to fetch")
        ) {
          toast.error(
            "Unable to connect to Supabase. Please check your internet connection."
          );
          return;
        }

        toast.error(
          error.message || "Unable to sign in. Please try again."
        );

        return;
      }

      // =========================================================
      // SUCCESSFUL LOGIN
      // =========================================================

      if (!data.user) {
        toast.error("Login failed. No user was returned.");
        return;
      }

      const displayName =
        (data.user.user_metadata?.full_name as string | undefined) ||
        data.user.email?.split("@")[0] ||
        "Student";

      console.log("SIGN IN: successful");
      console.log("User:", data.user);

      toast.success("Welcome back!");

      onAuth({
        name: displayName,
        email: data.user.email ?? trimmedEmail,
      });
    } catch (err) {
      // =========================================================
      // TIMEOUT / UNEXPECTED ERROR
      // =========================================================

      console.error("AUTH REQUEST FAILED:", err);

      if (err instanceof Error && err.message === "SIGNIN_TIMEOUT") {
        toast.error(
          "Supabase is not responding. Please check your Supabase URL, API key, and internet connection."
        );
      } else if (err instanceof Error) {
        toast.error(
          err.message || "Unable to complete authentication."
        );
      } else {
        toast.error("Unable to complete authentication. Please try again.");
      }
    } finally {
      // ALWAYS stop the loading spinner
      setIsLoading(false);
    }
  };

  // =========================================================
  // FEATURES
  // =========================================================

  const features = [
    {
      icon: Brain,
      label: "AI-Powered Summaries",
    },
    {
      icon: Zap,
      label: "Last-Minute Revision",
    },
    {
      icon: Sparkles,
      label: "Smart Quiz Generator",
    },
  ];

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="min-h-screen flex bg-background">
      {/* =====================================================
          LEFT PANEL
      ====================================================== */}

      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-primary/90 via-primary to-primary/70 flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Background circles */}
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
          {/* Logo */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur mb-6">
            <BookOpen className="h-8 w-8 text-white" />
          </div>

          <h1 className="text-4xl font-bold font-display mb-3">
            StudyMate AI
          </h1>

          <p className="text-primary-foreground/80 text-base leading-relaxed mb-10">
            Your intelligent study companion. Upload notes, generate quizzes,
            revise faster, and understand medical reports — all in one place.
          </p>

          {/* Features */}
          <div className="space-y-3">
            {features.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 text-left bg-white/10 rounded-xl px-4 py-3 backdrop-blur-sm"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-white" />
                </div>

                <span className="text-sm font-medium text-white">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* =====================================================
          RIGHT PANEL
      ====================================================== */}

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8 animate-fade-in-up">

          {/* Mobile logo */}
          <div className="lg:hidden text-center">
            <div className="inline-flex items-center gap-2">
              <BookOpen className="h-7 w-7 text-primary" />

              <span className="text-2xl font-bold font-display">
                StudyMate AI
              </span>
            </div>
          </div>

          {/* Heading */}
          <div>
            <h2 className="text-3xl font-bold font-display tracking-tight">
              {mode === "login"
                ? "Welcome back"
                : "Create your account"}
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "login"
                ? "Sign in to continue your learning journey."
                : "Join thousands of students studying smarter."}
            </p>
          </div>

          {/* =================================================
              LOGIN / SIGNUP SWITCH
          ================================================== */}

          <div className="flex rounded-xl bg-muted/60 p-1">
            {(["login", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  if (!isLoading) {
                    setMode(m);
                  }
                }}
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

          {/* =================================================
              FORM
          ================================================== */}

          <div className="space-y-4">

            {/* Full name */}
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
                  disabled={isLoading}
                />
              </div>
            )}

            {/* Email */}
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
                disabled={isLoading}
                autoComplete="email"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isLoading) {
                    handleSubmit();
                  }
                }}
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Password
                </label>

                {mode === "login" && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() =>
                      toast.info(
                        "Password reset is not configured yet."
                      )
                    }
                  >
                    Forgot password?
                  </button>
                )}
              </div>

              <div className="relative">
                <Input
                  type={showPass ? "text" : "password"}
                  placeholder={
                    mode === "signup"
                      ? "At least 6 characters"
                      : "Your password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-xl border-border bg-background/60 pr-11"
                  disabled={isLoading}
                  autoComplete={
                    mode === "login"
                      ? "current-password"
                      : "new-password"
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isLoading) {
                      handleSubmit();
                    }
                  }}
                />

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  {showPass ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Signup terms */}
            {mode === "signup" && (
              <p className="text-xs text-muted-foreground">
                By signing up, you agree to our{" "}
                <span className="text-primary cursor-pointer hover:underline">
                  Terms of Service
                </span>{" "}
                and{" "}
                <span className="text-primary cursor-pointer hover:underline">
                  Privacy Policy
                </span>
                .
              </p>
            )}

            {/* =================================================
                SUBMIT BUTTON
            ================================================== */}

            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading}
              size="lg"
              className="w-full rounded-xl bg-gradient-hero text-primary-foreground shadow-glow hover:shadow-lift transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />

                  {mode === "login"
                    ? "Signing in..."
                    : "Creating account..."}
                </>
              ) : (
                <>
                  {mode === "login"
                    ? "Sign In"
                    : "Create Account"}
                </>
              )}
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>

              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  or
                </span>
              </div>
            </div>

            {/* Guest */}
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full rounded-xl"
              disabled={isLoading}
              onClick={() => {
                toast.info(
                  "Continuing as guest — data stays local only."
                );

                onAuth({
                  name: "Guest",
                  email: "guest@studymate.app",
                });
              }}
            >
              Continue as Guest
            </Button>
          </div>

          {/* Bottom switch */}
          <p className="text-center text-sm text-muted-foreground">
            {mode === "login"
              ? "Don't have an account? "
              : "Already have an account? "}

            <button
              type="button"
              disabled={isLoading}
              onClick={() => {
                if (!isLoading) {
                  setMode(
                    mode === "login"
                      ? "signup"
                      : "login"
                  );
                }
              }}
              className="text-primary font-semibold hover:underline disabled:opacity-50"
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}