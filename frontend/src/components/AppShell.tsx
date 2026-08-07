import { useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { Menu } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { loadNotes, saveNotes, loadTheme, saveTheme, setNotesUser } from "@/lib/study-storage";
import type { ChatMessage, Note, Summary } from "@/lib/study-types";
import { useAuth } from "@/lib/auth-context";
import { summarizeContent } from "@/lib/anthropic";

export type StudyState = {
  notes: Note[];
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  isLoading: boolean;
  createNote: (title: string, content: string) => Promise<void>;
  regenerate: () => Promise<void>;
  resummarize: (title: string, content: string) => Promise<void>;
  updateMessages: (msgs: ChatMessage[]) => void;
  updateFlowchart: (code: string | undefined) => void;
  deleteNote: (id: string) => void;
};

interface AppShellProps {
  children: (state: StudyState) => ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { logout, user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Point the storage layer at this account's own bucket before reading
    // anything, so we never load (or later overwrite) another user's notes.
    setNotesUser(user?.email ?? null);
    const loaded = loadNotes();
    setNotes(loaded);
    setActiveId(loaded.length > 0 ? loaded[0].id : null);
    const t = loadTheme();
    setTheme(t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }, [user?.email]);

  useEffect(() => {
    if (notes.length > 0 || (typeof window !== "undefined" && localStorage.getItem("studymate.notes.v1." + (user?.email ?? "guest")))) {
      saveNotes(notes);
    }
  }, [notes, user?.email]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    saveTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  const generateSummary = useCallback(async (content: string): Promise<Summary | null> => {
    setIsLoading(true);
    try {
      const result = await summarizeContent(content);
      return result as Summary;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't reach the AI. Please try again.";
      toast.error(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createNote = useCallback(async (title: string, content: string) => {
    const summary = await generateSummary(content);
    if (!summary) return;
    const newNote: Note = {
      id: crypto.randomUUID(),
      title,
      content,
      summary,
      messages: [],
      createdAt: Date.now(),
    };
    setNotes((p) => [newNote, ...p]);
    setActiveId(newNote.id);
    toast.success("Summary ready!");
  }, [generateSummary]);

  const regenerate = useCallback(async () => {
    const note = notes.find((n) => n.id === activeId);
    if (!note) return;
    const summary = await generateSummary(note.content);
    if (!summary) return;
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, summary } : n)));
    toast.success("Regenerated!");
  }, [notes, activeId, generateSummary]);

  const resummarize = useCallback(async (title: string, content: string) => {
    const note = notes.find((n) => n.id === activeId);
    if (!note) return;
    const summary = await generateSummary(content);
    if (!summary) return;
    setNotes((prev) =>
      prev.map((n) => (n.id === note.id ? { ...n, title, content, summary, messages: [], flowchartCode: undefined } : n)),
    );
    toast.success("Updated summary ready!");
  }, [notes, activeId, generateSummary]);

  const updateMessages = useCallback((msgs: ChatMessage[]) => {
    setNotes((prev) => prev.map((n) => (n.id === activeId ? { ...n, messages: msgs } : n)));
  }, [activeId]);

  const updateFlowchart = useCallback((code: string | undefined) => {
    setNotes((prev) => prev.map((n) => (n.id === activeId ? { ...n, flowchartCode: code } : n)));
  }, [activeId]);

  const deleteNote = (id: string) => {
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id);
      if (activeId === id) setActiveId(next[0]?.id ?? null);
      return next;
    });
    toast.success("Note deleted");
  };

  const state: StudyState = useMemo(
    () => ({
      notes, activeId, setActiveId, isLoading,
      createNote, regenerate, resummarize,
      updateMessages, updateFlowchart, deleteNote,
    }),
    [notes, activeId, isLoading, createNote, regenerate, resummarize, updateMessages, updateFlowchart],
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Toaster richColors position="top-right" closeButton />
      <div className="hidden md:flex w-72 shrink-0">
        <AppSidebar
          notes={notes}
          activeNoteId={activeId}
          onSelectNote={(id) => setActiveId(id)}
          onNewNote={() => setActiveId(null)}
          onDeleteNote={deleteNote}
          theme={theme}
          onToggleTheme={toggleTheme}
          onLogout={logout}
        />
      </div>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 w-72">
          <AppSidebar
            notes={notes}
            activeNoteId={activeId}
            onSelectNote={(id) => { setActiveId(id); setSidebarOpen(false); }}
            onNewNote={() => { setActiveId(null); setSidebarOpen(false); }}
            onDeleteNote={deleteNote}
            theme={theme}
            onToggleTheme={toggleTheme}
            onLogout={logout}
          />
        </SheetContent>
      </Sheet>
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="md:hidden flex items-center justify-between border-b border-border px-3 py-2.5 bg-card/50 backdrop-blur">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
          </Sheet>
          <Link to="/" className="font-display text-sm font-bold">StudyMate</Link>
          <span className="w-9" />
        </header>
        <div className="flex-1 min-h-0 overflow-hidden">{children(state)}</div>
      </main>
    </div>
  );
}
