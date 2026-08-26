import type { QuizConfig } from "../types";
import type { GeneratedQuestion } from "./quizGenerator";

interface RawQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: string;
}

const COHERE_API_URL = "https://api.cohere.ai/v1/chat";
const COHERE_MODELS_URL = "https://api.cohere.ai/v1/models";

let cachedCohereModels: string[] | null = null;

export async function getCohereModelsList(apiKey?: string): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(COHERE_MODELS_URL, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) return [];
    const data = await res.json();
    const models = data.models as Array<{ name: string; endpoints: string[] }>;
    // Ambil model chat yang relevan
    return models
      .filter(m => m.endpoints?.includes("chat") && m.name.includes("command"))
      .map(m => m.name)
      .sort();
  } catch (err) {
    console.error("Failed to fetch Cohere models list:", err);
    return [];
  }
}

async function getAvailableCohereModel(apiKey: string): Promise<string> {
  if (cachedCohereModels) return cachedCohereModels[0];
  
  try {
    const models = await getCohereModelsList(apiKey);
    if (models.length > 0) {
      // Prioritaskan command-r-plus atau command-r
      const best = models.find(m => m.includes("command-r-plus")) || 
                   models.find(m => m.includes("command-r")) || 
                   models[0];
      cachedCohereModels = [best];
      return best;
    }
    return "command-r-plus"; // Fallback
  } catch (error) {
    return "command-r-plus";
  }
}

function buildPrompt(materialText: string, config: QuizConfig, targetCount: number): string {
  const numOptions = config.numberOfOptions || 4;
  const difficulty = config.difficulty || "sedang";

  return `Kamu adalah ahli pembuat soal ujian pilihan ganda.
Tugasmu adalah membuat EXACTLY ${targetCount} soal pilihan ganda berdasarkan ringkasan materi yang diberikan.

KETENTUAN TEKNIS:
1. Buat EXACTLY ${targetCount} soal.
2. Setiap soal punya ${numOptions} pilihan jawaban.
3. JANGAN tulis A, B, C, D di teks pilihan. Tulis TEKS JAWABAN SAJA.
4. Hanya 1 jawaban benar yang jelas.
5. Tingkat kesulitan: ${difficulty}
6. Penjelasan 1-2 kalimat yang jelas.
7. JANGAN gunakan penomoran seperti (1), (2), 2), 3. dalam pilihan jawaban.
8. DILARANG KERAS menggunakan tanda kutip ganda (") di dalam teks soal, opsi, atau penjelasan. Gunakan kutip tunggal (') jika perlu, agar format JSON tidak rusak!

OUTPUT FORMAT (Wajib JSON object valid, TANPA format markdown tambahan):
{
  "questions": [
    {
      "question": "Pertanyaan yang menarik dan variatif?",
      "options": ["Pilihan A", "Pilihan B", "Pilihan C", "Pilihan D"],
      "correctIndex": 0,
      "explanation": "Penjelasan singkat dan jelas.",
      "difficulty": "mudah"
    }
  ]
}

MATERI:
---
${materialText}
---

Buat ${targetCount} soal sekarang dan HANYA kembalikan JSON object valid dengan key "questions":`;
}

function cleanGeneratedText(text: string, isOption: boolean = false): string {
  if (!text) return "";
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^[A-Ea-e][.)]\s*/, "");
  cleaned = cleaned.replace(/^[-•*·○]\s*/, "");
  
  if (!isOption) {
    if (!/[.!?]$/.test(cleaned) && cleaned.length > 5) {
      cleaned += ".";
    }
  } else {
    // Untuk opsi, hapus titik di akhir jika ada, supaya seragam
    cleaned = cleaned.replace(/[.]$/, "");
  }
  
  return cleaned;
}

export async function summarizeMaterialCohere(
  materialText: string,
  apiKey: string,
  userModel?: string | null
): Promise<string> {
  if (materialText.length < 5000) {
    return materialText;
  }

  const MAX_MATERIAL_CHARS = 12000;
  const trimmedMaterial =
    materialText.length > MAX_MATERIAL_CHARS
      ? materialText.slice(0, MAX_MATERIAL_CHARS) + "\n\n[...materi dipotong...]"
      : materialText;

  console.log("[Cohere] Starting summarization process...");
  const summaryPrompt = `Rangkum materi di bawah menjadi 15-20 poin-poin penting menggunakan bahasa Indonesia yang jelas. Jangan sertakan teks lain selain rangkuman.

MATERI:
---
${trimmedMaterial}
---

Rangkuman:`;

  try {
    const rawText = await callCohereAPI(summaryPrompt, apiKey, 800, userModel, false);
    return cleanGeneratedText(rawText);
  } catch (err) {
    return trimmedMaterial;
  }
}

async function callCohereAPI(
  prompt: string,
  apiKey: string,
  maxTokens: number = 2000,
  userModel?: string | null,
  requireJson: boolean = false
): Promise<string> {
  console.log("[Cohere] Calling API...");
  
  const modelToUse = userModel || await getAvailableCohereModel(apiKey);
  console.log("[Cohere] Using model:", modelToUse);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  const requestBody: any = {
    model: modelToUse,
    message: prompt,
    temperature: 0.7,
  };

  if (requireJson) {
    requestBody.response_format = { type: "json_object" };
  }

  let response;
  try {
    response = await fetch(COHERE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new Error("Cohere API request timed out after 60 seconds.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const errMsg = errData?.message || `HTTP ${response.status}`;
    throw new Error(`Cohere API error: ${errMsg}`);
  }

  const data = await response.json();
  const text = data.text;
  if (!text) {
    throw new Error("Cohere tidak mengembalikan konten.");
  }
  return text;
}

function parseCohereResponse(text: string): RawQuestion[] {
  let clean = text.trim();
  
  clean = clean.replace(/^```json\s*/i, "");
  clean = clean.replace(/^```\s*/, "");
  clean = clean.replace(/```\s*$/, "");
  
  if (clean.trim().startsWith('[')) {
    const arrayMatch = clean.match(/\[[\s\S]*\]/);
    if (arrayMatch) clean = arrayMatch[0];
  } else if (clean.trim().startsWith('{')) {
    const objectMatch = clean.match(/\{[\s\S]*\}/);
    if (objectMatch) clean = objectMatch[0];
  }

  if (clean.trim().startsWith('{')) {
    if (!clean.endsWith('}')) {
      if (!clean.endsWith(']')) { clean += '"}'; }
      clean += ']}';
    }
  } else if (clean.trim().startsWith('[')) {
    if (!clean.endsWith(']')) {
      if (!clean.endsWith('}')) { clean += '"}'; }
      clean += ']';
    }
  }

  const parsed = JSON.parse(clean) as any;
  const questionsArray = parsed.questions || parsed;

  if (!Array.isArray(questionsArray)) {
    throw new Error("Format respons Cohere tidak valid (tidak ada array 'questions').");
  }

  return questionsArray.map((item: unknown, idx: number) => {
    const q = item as Record<string, unknown>;
    if (
      typeof q.question !== "string" ||
      !Array.isArray(q.options) ||
      typeof q.correctIndex !== "number"
    ) {
      throw new Error(`Soal #${idx + 1} memiliki format yang tidak valid.`);
    }
    return {
      question: cleanGeneratedText(q.question as string),
      options: (q.options as string[]).map((o) => cleanGeneratedText(String(o), true)),
      correctIndex: q.correctIndex as number,
      explanation: typeof q.explanation === "string" ? cleanGeneratedText(q.explanation as string) : "Berdasarkan materi yang diberikan.",
      difficulty: typeof q.difficulty === "string" ? (q.difficulty as string).trim() : "sedang",
    };
  });
}

export async function generateQuizWithCohere(
  materialText: string,
  config: QuizConfig,
  apiKey: string,
  userModel?: string | null
): Promise<GeneratedQuestion[]> {
  const targetCount = config.totalQuestions || 10;
  
  const summary = await summarizeMaterialCohere(materialText, apiKey, userModel);
  const prompt = buildPrompt(summary, config, targetCount);
  const rawText = await callCohereAPI(prompt, apiKey, 3000, userModel, true);
  
  const rawQuestions = parseCohereResponse(rawText);

  if (rawQuestions.length === 0) {
    throw new Error("Cohere tidak menghasilkan soal.");
  }

  return rawQuestions.map((q: RawQuestion) => {
    const cleanOptions = q.options.map(opt => {
      let text = opt.trim();
      text = text.replace(/^[A-Ea-e][.)]\s*/, "");
      text = text.replace(/^[-•*·○]\s*/, "");
      return text.trim();
    });

    const safeIdx = Math.min(Math.max(0, q.correctIndex), cleanOptions.length - 1);

    return {
      question: q.question.trim(),
      options: cleanOptions,
      correctIndex: safeIdx,
      explanation: q.explanation.trim(),
      difficulty: q.difficulty || "sedang",
      sourceReference: "AI Generated (Cohere)",
      fingerprint: "",
    };
  });
}
