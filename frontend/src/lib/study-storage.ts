import type { Note } from "./study-types";

const THEME_KEY = "studymate.theme";
const TTS_LANG_KEY = "studymate.tts.lang";
const TTS_RATE_KEY = "studymate.tts.rate";

// Every note read/write goes through notesKey(), which is namespaced by the
// currently signed-in user. Without this, all accounts shared one global
// localStorage bucket ("studymate.notes.v1"), so every user saw the same
// notes/history regardless of who was logged in.
let currentUserKey: string | null = null;

/** Call this on login/logout (with the user's id or email, or null for signed-out/guest). */
export const setNotesUser = (key: string | null) => {
  currentUserKey = key;
};

const notesKey = (): string =>
  currentUserKey ? `studymate.notes.v1.${currentUserKey}` : "studymate.notes.v1.guest";

export const loadNotes = (): Note[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(notesKey());
    if (!raw) return [];
    return JSON.parse(raw) as Note[];
  } catch {
    return [];
  }
};

export const saveNotes = (notes: Note[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(notesKey(), JSON.stringify(notes));
};

export const addNote = (note: Note) => {
  if (typeof window === "undefined") return;
  const existing = loadNotes();
  if (existing.some((n) => n.content === note.content)) return;
  const next = [note, ...existing];
  localStorage.setItem(notesKey(), JSON.stringify(next));
};

export const loadTheme = (): "light" | "dark" => {
  if (typeof window === "undefined") return "light";
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === "dark" || raw === "light") return raw;
  } catch {
    /* noop */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export const saveTheme = (t: "light" | "dark") => {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_KEY, t);
};

export type TtsLang = "en-US" | "hi-IN";

export const loadTtsLang = (): TtsLang => {
  if (typeof window === "undefined") return "en-US";
  try {
    const raw = localStorage.getItem(TTS_LANG_KEY);
    if (raw === "en-US" || raw === "hi-IN") return raw;
  } catch {
    /* noop */
  }
  return "en-US";
};

export const saveTtsLang = (l: TtsLang) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(TTS_LANG_KEY, l);
};

const VALID_RATES = [0.75, 1, 1.25, 1.5, 2];

export const loadTtsRate = (): number => {
  if (typeof window === "undefined") return 1;
  try {
    const raw = localStorage.getItem(TTS_RATE_KEY);
    const n = raw ? Number(raw) : 1;
    return VALID_RATES.includes(n) ? n : 1;
  } catch {
    return 1;
  }
};

export const saveTtsRate = (r: number) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(TTS_RATE_KEY, String(r));
};
