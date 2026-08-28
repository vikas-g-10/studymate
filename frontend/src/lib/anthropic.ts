import { getUserApiKey } from "@/hooks/use-api-key";

// ─── Provider detection ───────────────────────────────────────────────────────

type Provider = "anthropic" | "openrouter" | "local";

type AIMode = "cloud" | "local";

const LOCAL_OLLAMA_URL = "http://localhost:11434";
const LOCAL_MODEL = "qwen2.5:7b";
const LOCAL_VISION_MODEL = "qwen2.5vl:3b";

export function getAIMode(): AIMode {
  return (localStorage.getItem("studymate-ai-mode") as AIMode) || "cloud";
}

export function setAIMode(mode: AIMode) {
  localStorage.setItem("studymate-ai-mode", mode);
}

function detectProvider(key: string): Provider {
  if (key.startsWith("sk-ant-")) return "anthropic";
  return "openrouter"; // sk-or-v1-... or anything else → OpenRouter
}

// Model mapping: what to use on each provider
const MODELS: Record<Provider, { default: string; vision: string }> = {
  anthropic: {
    default: "claude-haiku-4-5",
    vision: "claude-sonnet-4-6",
  },
  openrouter: {
    default: "anthropic/claude-haiku-4-5",
    vision: "anthropic/claude-sonnet-4-6",
  },
};

// ─── Core fetch ───────────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = getUserApiKey();
  if (!key) {
    throw new Error(
      "No API key set. Open Settings and paste your Anthropic or OpenRouter key."
    );
  }
  return key;
}

async function callLocalAI(opts: {
  system: string;
  messages: Array<{
  role: "user" | "assistant";
  content: unknown;
  images?: string[];
}>;
  max_tokens: number;
}): Promise<string> {
  const ollamaMessages = opts.messages.map((message) => {
    // Normal text message
    if (typeof message.content === "string") {
      return {
        role: message.role,
        content: message.content,
      };
    }

    // Vision message
    if (Array.isArray(message.content)) {
      let text = "";
      const images: string[] = [];

      for (const part of message.content as Array<Record<string, any>>) {
        // Text part
        if (part.type === "text" && typeof part.text === "string") {
          text += part.text;
        }

        // Anthropic image format
        if (
          part.type === "image" &&
          part.source?.type === "base64" &&
          typeof part.source.data === "string"
        ) {
          images.push(part.source.data);
        }

        // OpenAI / OpenRouter image format
        if (
          part.type === "image_url" &&
          typeof part.image_url?.url === "string"
        ) {
          const dataUrl = part.image_url.url;

          // Ollama wants only the base64 data, not:
          // data:image/jpeg;base64,...
          const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);

          if (match) {
            images.push(match[1]);
          } else {
            images.push(dataUrl);
          }
        }
      }

      return {
        role: message.role,
        content: text,
        ...(images.length > 0 ? { images } : {}),
      };
    }

    // Fallback
    return {
      role: message.role,
      content: String(message.content ?? ""),
    };
  });

  const response = await fetch(`${LOCAL_OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LOCAL_MODEL,
      stream: false,
      messages: [
        {
          role: "system",
          content: opts.system,
        },
        ...ollamaMessages,
      ],
      options: {
        num_predict: opts.max_tokens,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");

    throw new Error(
      `Local AI error ${response.status}: ${
        text || "Could not connect to Ollama."
      }`
    );
  }

  const data = await response.json();

  const content = data.message?.content;

  if (!content || typeof content !== "string") {
    console.error("Unexpected Ollama response:", data);
    throw new Error(
      "Ollama returned an empty response. Check the browser console."
    );
  }

  return content;
}

async function callAI(opts: {
  useVision?: boolean;
  system: string;
  messages: Array<{
  role: "user" | "assistant";
  content: unknown;
  images?: string[];
}>;
  max_tokens: number;
}): Promise<string> {
 const mode = getAIMode();

if (mode === "local") {
  return callLocalAI(opts);
}

const key = getApiKey();
const provider = detectProvider(key);
const model = opts.useVision ? MODELS[provider].vision : MODELS[provider].default;

  let url: string;
  let headers: Record<string, string>;
  let body: Record<string, unknown>;

  if (provider === "anthropic") {
    url = "https://api.anthropic.com/v1/messages";
    headers = {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "Content-Type": "application/json",
    };
    body = {
      model,
      max_tokens: opts.max_tokens,
      system: opts.system,
      messages: opts.messages,
    };
  } else {
    // OpenRouter uses OpenAI-compatible format
    url = "https://openrouter.ai/api/v1/chat/completions";
    headers = {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-Title": "StudyMate",
    };
    body = {
      model,
      max_tokens: opts.max_tokens,
      messages: [
        { role: "system", content: opts.system },
        ...opts.messages,
      ],
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (response.status === 401) {
    throw new Error("Invalid API key. Please check your key in Settings.");
  }
  if (response.status === 429) {
    throw new Error("Rate limit reached. Please wait a moment and try again.");
  }
  if (response.status === 402) {
    throw new Error(
      provider === "anthropic"
        ? "Insufficient credits. Add credits at console.anthropic.com/settings/billing."
        : "Insufficient credits. Add credits at openrouter.ai/credits."
    );
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`AI API error ${response.status}: ${text}`);
  }

  const data = await response.json();

  // Different response shapes
  if (provider === "anthropic") {
    return (data.content?.[0]?.text as string) ?? "";
  } else {
    return (data.choices?.[0]?.message?.content as string) ?? "";
  }
}

function parseJson<T>(raw: string): T {
  const clean = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  return JSON.parse(clean) as T;
}

// ─── Summarize ───────────────────────────────────────────────────────────────

const SUMMARIZE_SYSTEM = `You are StudyMate, a friendly study assistant for students.
Given a piece of study material, return a JSON object with these fields:
- summary: 2-3 short paragraphs in plain student-friendly language explaining the material.
- keyPoints: array of 5-8 short bullet strings (most important takeaways).
- keywords: array of 5-10 single-word or short-phrase technical terms.
- revisionBullets: array of 4-6 ultra-short revision flashcards (single sentences a student can quickly read before an exam).
- difficultWords: array of objects {word, meaning} for 3-6 hard or technical words a student might not know (meaning <= 15 words, plain language).
Return ONLY valid JSON matching this structure, no markdown fences, no extra text. Be accurate to the source material — do NOT invent facts.`;

export async function summarizeContent(content: string) {
  if (!content || content.trim().length < 20) {
    throw new Error("Please provide at least 20 characters of study material.");
  }
  const trimmed = content.length > 16000 ? content.slice(0, 16000) : content;
  const raw = await callAI({
    system: SUMMARIZE_SYSTEM,
    messages: [{ role: "user", content: `Study material:\n\n${trimmed}` }],
    max_tokens: 2048,
  });
  return parseJson(raw);
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export async function chatWithNotes(
  sourceContent: string,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  if (!messages.length) throw new Error("No messages provided.");

  const systemPrompt = `You are StudyMate, a helpful study assistant. Answer the user's questions using ONLY the study material provided below. If the answer isn't in the material, say so honestly. Keep answers concise and student-friendly. Use markdown formatting.

Study material:
${(sourceContent || "").slice(0, 12000)}`;

  const aiMessages = messages.map((m) => ({
    role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
    content: m.content,
  }));

  return callAI({
    system: systemPrompt,
    messages: aiMessages,
    max_tokens: 1024,
  });
}

// ─── Quiz ─────────────────────────────────────────────────────────────────────

const DIFFICULTY_GUIDE: Record<string, string> = {
  easy: "Easy: focus on recall — definitions, names, simple facts. Plain language. Distractors should be obviously different. Explanations are 1 sentence.",
  medium:
    "Medium: focus on understanding — applying concepts, simple comparisons, cause-and-effect. Distractors should be plausible. Explanations are 1-2 sentences.",
  hard: "Hard: focus on analysis and synthesis — multi-step reasoning, edge cases, subtle distinctions, scenario application. Distractors should be tempting and similar. Explanations are 2-3 sentences and include the underlying principle.",
};

export async function generateQuiz(
  topic: string,
  difficulty: string,
  numQuestions: number
) {
  if (!topic || topic.trim().length < 3) {
    throw new Error("Please provide a topic or some study text (at least 3 characters).");
  }
  const diffKey = difficulty.toLowerCase();
  if (!DIFFICULTY_GUIDE[diffKey]) {
    throw new Error("difficulty must be easy | medium | hard");
  }
  const n = Math.max(3, Math.min(20, numQuestions || 5));
  const trimmed = topic.length > 14000 ? topic.slice(0, 14000) : topic;

  const systemPrompt = `You are an expert quiz writer for students. Generate exactly ${n} multiple-choice questions about the user's topic or text.

Difficulty rules:
${DIFFICULTY_GUIDE[diffKey]}

Hard requirements:
- Each question has EXACTLY 4 options.
- Exactly ONE correct option. Set "correctIndex" to the 0-based index of the correct option.
- Options must be distinct and not contain the letters A) B) C) D) — they're plain strings.
- Provide a brief "explanation" describing why the correct option is right.
- Stay accurate. Don't invent facts about a specific text — only ask about what's in it.
- Return ONLY valid JSON in this exact shape, no markdown fences:
{"title":"...","questions":[{"question":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"..."}]}`;

  const raw = await callAI({
    system: systemPrompt,
    messages: [{ role: "user", content: `Topic / source text:\n\n${trimmed}` }],
    max_tokens: 4096,
  });
  const parsed = parseJson<{ title: string; questions: unknown[] }>(raw);
  return { ...parsed, difficulty: diffKey };
}

// ─── Revision ─────────────────────────────────────────────────────────────────

const REVISION_SYSTEM = `You are StudyMate's Last Minute Revision coach for students who must revise quickly before an exam.
Given study material, return a structured revision in THREE progressively detailed time-boxed formats.

Return ONLY valid JSON (no markdown fences) in this exact shape:
{
  "thirtySecond": ["bullet1","bullet2",...],
  "twoMinute": ["bullet1","bullet2",...],
  "fiveMinute": [{"heading":"...","bullets":["...","..."]},...],
  "memoryHooks": ["Concept = catchy hook",...],
  "keywords": ["term1","term2",...],
  "definitions": [{"term":"...","definition":"..."},...]
}

Rules:
- thirtySecond: 3-5 ultra-short bullets, absolute must-know facts only.
- twoMinute: 5-8 bullets, each a short concept + 1-line plain explanation.
- fiveMinute: 4-6 mini-sections with heading + 2-4 bullets covering all major ideas.
- memoryHooks: 4-7 punchy exam shortcuts/mnemonics. Format like "Concept = catchy hook".
- keywords: 6-12 short technical terms students must recognise.
- definitions: 3-6 objects for the most important named concepts (definition <= 20 words).
- Be FAITHFUL to the source material. Do not invent facts.
- Use plain student-friendly language. Keep every bullet short and skimmable.`;

export async function generateRevision(content: string) {
  if (!content || content.trim().length < 20) {
    throw new Error("Please provide at least 20 characters of study material.");
  }
  const trimmed = content.length > 16000 ? content.slice(0, 16000) : content;
  const raw = await callAI({
    system: REVISION_SYSTEM,
    messages: [{ role: "user", content: `Study material:\n\n${trimmed}` }],
    max_tokens: 3000,
  });
  return parseJson(raw);
}

// ─── Medical Report ───────────────────────────────────────────────────────────

const MEDICAL_SYSTEM = `You are a medical-report interpreter for laypeople.
You are given the contents (text or image) of a medical report. Produce a structured, easy-to-understand summary.

Rules:
- Use plain English, no medical jargon (or define jargon in parentheses).
- Be cautious. Never diagnose. Never recommend specific treatments. Suggest seeing a doctor.
- For each finding/test value, classify status as one of: "normal" | "borderline" | "abnormal".
- "abnormalFlags" should list values clearly out-of-range with a 1-2 sentence plain-English explanation.
- "nextSteps" is general guidance only. NEVER prescribe medication or doses.
- If the input does not look like a medical report, explain that and leave other arrays empty.

Return ONLY valid JSON (no markdown fences) in this exact shape:
{
  "reportType": "...",
  "about": "...",
  "keyFindings": ["..."],
  "values": [{"name":"...","value":"...","referenceRange":"...","status":"normal|borderline|abnormal","plainExplanation":"..."}],
  "abnormalFlags": [{"label":"...","explanation":"..."}],
  "nextSteps": ["..."]
}`;

export async function interpretMedicalReport(opts: {
  text?: string;
  imageDataUrl?: string;
}) {
  if (!opts.text && !opts.imageDataUrl) {
    throw new Error(
      "Provide either text or an imageDataUrl from a medical report."
    );
  }

  if (opts.text && opts.text.length > 30000) {
    throw new Error(
      "Text is too long. Please paste up to 30,000 characters."
    );
  }

  const mode = getAIMode();

  // ─────────────────────────────────────────────
  // Local AI — Ollama
  // ─────────────────────────────────────────────
  if (mode === "local") {
  let messages: Array<{
    role: "user" | "assistant";
    content: unknown;
    images?: string[];
  }>;

  if (opts.imageDataUrl) {
    const matches = opts.imageDataUrl.match(
      /^data:([^;]+);base64,(.+)$/
    );

    if (!matches) {
      throw new Error("Invalid image data URL.");
    }

    const base64Image = matches[2];

    messages = [
      {
        role: "user",
        content: `Here is an image of a medical report.

Carefully read the image, including handwritten or printed text.

Extract only information that is actually visible in the report.

Follow the system instructions exactly.

IMPORTANT:
Return ONLY a valid JSON object.
Do not use markdown.
Do not add explanations before or after the JSON.

The JSON must contain exactly these fields:
reportType, about, keyFindings, values, abnormalFlags, nextSteps.`,
        images: [base64Image],
      },
    ];
  } else {
    messages = [
      {
        role: "user",
        content: `Medical report text:\n\n${opts.text}`,
      },
    ];
  }

  const raw = await callAI({
    useVision: !!opts.imageDataUrl,
    system: MEDICAL_SYSTEM,
    messages,
    max_tokens: 3000,
  });

  return parseJson(raw);
}

  // ─────────────────────────────────────────────
  // Cloud AI — Anthropic / OpenRouter
  // ─────────────────────────────────────────────
  const key = getApiKey();
  const provider = detectProvider(key);

  if (opts.imageDataUrl) {
    const matches = opts.imageDataUrl.match(
      /^data:([^;]+);base64,(.+)$/
    );

    if (!matches) {
      throw new Error("Invalid image data URL.");
    }

    let userContent: unknown;

    if (provider === "anthropic") {
      userContent = [
        {
          type: "text",
          text: "Here is an image of a medical report. Please read its contents and interpret.",
        },
        {
          type: "image",
          source: {
            type: "base64",
            media_type: matches[1],
            data: matches[2],
          },
        },
      ];
    } else {
      // OpenRouter / OpenAI vision format
      userContent = [
        {
          type: "text",
          text: "Here is an image of a medical report. Please read its contents and interpret.",
        },
        {
          type: "image_url",
          image_url: {
            url: opts.imageDataUrl,
          },
        },
      ];
    }

    const raw = await callAI({
      useVision: true,
      system: MEDICAL_SYSTEM,
      messages: [
        {
          role: "user",
          content: userContent,
        },
      ],
      max_tokens: 3000,
    });

    return parseJson(raw);
  }

  // Text-only medical report
  const raw = await callAI({
    system: MEDICAL_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Medical report text:\n\n${opts.text}`,
      },
    ],
    max_tokens: 3000,
  });

  return parseJson(raw);
}


// ─── Flowchart ────────────────────────────────────────────────────────────────

const FLOWCHART_SYSTEM = `You are a diagram generator. Given study material key points, return ONLY valid Mermaid.js flowchart code — nothing else. No markdown fences, no explanation. Start directly with 'flowchart TD'. Use concise node labels (max 6 words each). Connect ideas logically showing how concepts relate, cause each other, or flow into each other. Use these node shapes: rectangles for main concepts [Label], rounded rectangles for processes (Label), diamonds for decisions {Label?}, and stadium shapes for outcomes([Label]). Add subgraphs to group related concepts when there are 6 or more nodes. Max 12 nodes total. Make the diagram genuinely useful for understanding the topic, not just a list.`;

export async function generateFlowchart(opts: {
  content?: string;
  keyPoints: string[];
  title?: string;
}): Promise<string> {
  if (!opts.keyPoints || opts.keyPoints.length === 0) {
    throw new Error("Missing keyPoints — generate a summary first.");
  }

  const userPrompt = [
    opts.title ? `Topic: ${opts.title}` : "",
    `Key points:\n${opts.keyPoints.map((k, i) => `${i + 1}. ${k}`).join("\n")}`,
    opts.content ? `\nContext summary:\n${String(opts.content).slice(0, 2000)}` : "",
  ].filter(Boolean).join("\n\n");

  const raw = await callAI({
    system: FLOWCHART_SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
    max_tokens: 1024,
  });

  // Strip any accidental markdown fences
  const clean = raw
    .trim()
    .replace(/^```(?:mermaid)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  if (!clean) throw new Error("AI didn't return a diagram.");
  return clean;
}
