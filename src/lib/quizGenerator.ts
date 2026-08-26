import type { Question, QuizConfig, Difficulty } from "../types";
import { shuffle } from "./utils";
import { generateQuizWithAI } from "./geminiGenerator";
import { generateQuizWithGroq } from "./groqGenerator";
import { generateQuizWithOpenRouter } from "./openRouterGenerator";
import { generateQuizWithCohere } from "./cohereGenerator";
import {
  getPrimaryApi,
  getGroqKey,
  getOpenRouterKey,
  getCohereKey,
  getGroqModel,
  getOpenRouterModel,
  getCohereModel,
  getGeminiModel,
} from "./settingsStore";

export interface GeneratedQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: string;
  sourceReference: string;
  fingerprint: string;
}

export interface GenerationResult {
  questions: GeneratedQuestion[];
  insufficient: boolean;
  maxPossible: number;
  generatedByAI: boolean;
}

const DIFFICULTY_LABELS: Record<string, string> = {
  mudah: "Mudah",
  sedang: "Sedang",
  sulit: "Sulit",
  campuran: "Campuran",
};

export function difficultyLabel(d: string): string {
  return DIFFICULTY_LABELS[d] || d;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function fingerprintQuestion(question: string): string {
  const norm = normalize(question);
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    hash = ((hash << 5) - hash + norm.charCodeAt(i)) | 0;
  }
  return `fp_${hash.toString(36)}`;
}

function sentencesOverlap(s1: string, s2: string): boolean {
  const n1 = normalize(s1);
  const n2 = normalize(s2);
  if (n1 === n2) return true;
  const w1 = n1.split(" ").filter((w) => w.length > 3);
  const w2 = new Set(n2.split(" ").filter((w) => w.length > 3));
  if (w1.length === 0) return false;
  const overlap = w1.filter((w) => w2.has(w)).length;
  return overlap / w1.length > 0.7;
}

interface SentenceInfo {
  text: string;
  words: string[];
  keyTerms: string[];
  index: number;
}

function splitSentences(rawText: string): SentenceInfo[] {
  const cleaned = rawText.replace(/\s+/g, " ").trim();
  const parts = cleaned.split(/(?<=[.!?])\s+/);
  return parts
    .map((s) => s.trim())
    .filter((s) => s.length > 30 && s.length < 500)
    .filter((s) => !isJunkSentence(s))
    .map((s, index) => {
      const words = s.split(/\s+/);
      const keyTerms = words.filter(
        (w) =>
          w.length > 3 &&
          !STOP_WORDS.has(w.toLowerCase()) &&
          /^[A-Za-zÀ-ÿ0-9]/.test(w) &&
          !/^\d+$/.test(w),
      );
      return { text: s, words, keyTerms, index };
    })
    .filter((s) => s.keyTerms.length >= 2);
}

const STOP_WORDS = new Set([
  "yang", "dan", "untuk", "pada", "dengan", "dari", "dalam", "akan", "tidak",
  "ini", "itu", "adalah", "sebuah", "seorang", "oleh", "agar", "juga", "atau",
  "karena", "sebagai", "sehingga", "dapat", "telah", "sudah", "masih", "antara",
  "serta", "namun", "tetapi", "ke", "di", "ya", "the", "and", "for", "with",
  "from", "into", "that", "this", "are", "was", "were", "been", "have", "has",
  "their", "there", "which", "would", "could", "should", "about", "after",
  "before", "between", "through", "during", "above", "below", "upon",
  // kata tanya & instruksi umum
  "menurut", "kalian", "kamu", "berapa", "bagaimana", "apakah", "dimana",
  "kapan", "siapa", "jelaskan", "sebutkan", "tentukan", "perhatikan",
  "amati", "amatilah", "jawab", "jawablah", "kerjakan", "diskusikan",
  "cocokkan", "hubungkan", "bandingkan", "urutkan", "buatlah", "bacalah",
  "berilah", "berikan", "gunakan", "carilah", "tuliskan", "isilah",
  // kata struktur buku/materi
  "bahan", "ajar", "kelas", "soal", "contoh", "latihan", "bab", "halaman",
  "nomor", "tujuan", "aktivitas", "kegiatan", "kompetensi", "pengetahuan",
  "gambar", "tabel", "grafik", "berikut", "berikutnya", "setiap", "banyak",
  // kata kerja umum buku teks (tidak layak jadi topik soal)
  "menunjukkan", "menghasilkan", "dihasilkan", "ditemukan", "terbentuk",
  "membentuk", "diberikan", "memberikan", "digunakan", "digunakannya",
  "ditentukan", "menentukan", "menyatakan", "dinyatakan", "merupakan",
  "terdiri", "terletak", "terdapat", "terjadi", "dijumpai", "memperoleh",
  "diperoleh", "mendapatkan", "mengidentifikasi", "menyelesaikan",
  "menggambarkan", "memuat", "berada", "diawali", "diakhiri", "berturut",
  "berurutan", "disebut",
]);

const INSTRUCTION_STARTS =
  /^(jelaskan|sebutkan|hitunglah|hitung|tentukan|lengkapi|isilah|isi|perhatikan|amatilah|amati|gambarkan|buktikan|sederhanakan|nyatakan|carilah|cari|tuliskan|tulis|diskusikan|kerjakan|jawablah|jawab|cocokkan|hubungkan|berilah|berikan|buatlah|bacalah|baca|analisislah|analisis|bandingkan|urutkan|tandai|beri)\b/i;

function isJunkSentence(s: string): boolean {
  // Kalimat tanya / instruksi tidak cocok jadi soal maupun opsi jawaban
  if (s.endsWith("?")) return true;
  if (INSTRUCTION_STARTS.test(s)) return true;

  // Soal isian dari buku: mengandung titik-titik "............"
  if (/\.{3,}/.test(s)) return true;

  // Fragmen lanjutan: diawali konjungsi/kata hubung
  if (/^(karena|jadi|namun|lalu|maka|sehingga|sedangkan|adapun|selain|meskipun|walaupun|sementara|agar|sementara itu)\b/i.test(s)) {
    return true;
  }

  // Header/footer: mayoritas huruf KAPITAL
  const letters = s.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters.length > 10) {
    const upperRatio =
      letters.replace(/[^A-ZÀ-Þ]/g, "").length / letters.length;
    if (upperRatio > 0.5) return true;
  }

  // Frasa berulang seperti "pola bilangan pola bilangan ..."
  const words = s.toLowerCase().split(/\s+/);
  if (words.length >= 6) {
    for (let i = 0; i + 3 < words.length; i++) {
      if (words[i] === words[i + 2] && words[i + 1] === words[i + 3]) {
        return true;
      }
    }
  }

  // Kalimat yang mengandung penomoran berurutan (indikasi list)
  if (/\d+\)\s*\d+\)/.test(s)) return true;
  if (/\(\d+\)\s*\(\d+\)/.test(s)) return true;

  return false;
}

// ---- Cleaning functions untuk menghapus format yang tidak diinginkan ----

/**
 * Nuclear option: Remove ALL single letters regardless of context
 * This is aggressive but necessary to remove PDF artifacts
 */
function nuclearCleanSingleLetters(text: string): string {
  let cleaned = text.trim();
  
  // Remove any single letter at the end
  cleaned = cleaned.replace(/\s+[a-zA-Z]$/g, "");
  
  // Remove any single letter followed by any punctuation
  cleaned = cleaned.replace(/\s+[a-zA-Z][^\w\s]*$/g, "");
  
  // Remove any single letter standing alone between words
  cleaned = cleaned.replace(/\s+[a-zA-Z]\s+/g, " ");
  
  // Remove any single letter at the beginning
  cleaned = cleaned.replace(/^[a-zA-Z]\s+/g, "");
  
  // Remove any single letter followed by space and then punctuation
  cleaned = cleaned.replace(/\s+[a-zA-Z]\s+[.,;:!?]/g, " ");
  
  // Remove any single letter that appears as a word boundary
  cleaned = cleaned.replace(/\b[a-zA-Z]\b/g, (match, offset, string) => {
    // Check if it's a valid single letter in context (very rare in Indonesian)
    const prevChar = offset > 0 ? string[offset - 1] : ' ';
    const nextChar = offset + 1 < string.length ? string[offset + 1] : ' ';
    
    // Only keep if surrounded by letters (part of a word)
    if (/[a-zA-Z]/.test(prevChar) && /[a-zA-Z]/.test(nextChar)) {
      return match;
    }
    return '';
  });
  
  // Final cleanup of spaces
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  
  // One more pass at the end
  cleaned = cleaned.replace(/\s+[a-zA-Z]$/, "");
  
  return cleaned;
}

// ---- Cleaning functions untuk menghapus format yang tidak diinginkan ----

function cleanOptionText(text: string): string {
  let cleaned = text.trim();
  
  // Hapus penomoran di awal: "1)", "2.", "(3)", "a.", dll
  cleaned = cleaned.replace(/^[\d\w][\)\.\]]\s*/, "");
  cleaned = cleaned.replace(/^\([\d\w]\)\s*/, "");
  
  // Hapus bullet points: "-", "*", "•", "+"
  cleaned = cleaned.replace(/^[-•*+]\s*/, "");
  
  // Hapus penomoran di dalam teks: "(2)", "(3)", dll
  cleaned = cleaned.replace(/\(\d+\)/g, "");
  
  // Hapus multiple penomoran berurutan: "2) 3) 4)"
  cleaned = cleaned.replace(/\d+\)\s*\d+\)\s*\d+\)*/g, "");
  
  // AGGRESSIVE: Hapus semua single letter patterns yang mungkin artifacts
  // Pattern 1: single letter di akhir dengan atau tanpa spasi
  cleaned = cleaned.replace(/\s+[a-zA-Z]$/g, "");
  cleaned = cleaned.replace(/\s+[a-zA-Z]\s*$/g, "");
  cleaned = cleaned.replace(/\s+[a-zA-Z][.,;:!?]$/g, "");
  
  // Pattern 2: single letter di tengah dengan spasi di sekitarnya
  cleaned = cleaned.replace(/\s+[a-zA-Z]\s+/g, " ");
  
  // Pattern 3: single letter diikuti tanda baca
  cleaned = cleaned.replace(/\s+[a-zA-Z]\s*[.,;:!?]/g, " ");
  
  // Pattern 4: single letter di awal setelah penomoran
  cleaned = cleaned.replace(/^\s*[a-zA-Z]\s+/g, "");
  
  // Pattern 5: single letter yang berdiri sendiri di antara kata
  cleaned = cleaned.replace(/\s+[a-zA-Z]\s+(?=\w)/g, " ");
  
  // Hapus karakter aneh di akhir
  cleaned = cleaned.replace(/[^\w\s\.,;:?!-]$/, "");
  
  // Hapus spasi berlebih
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  
  // Jika masih mengandung penomoran berurutan, ambil kalimat pertama saja
  if (/\d+\)/.test(cleaned)) {
    const firstSentence = cleaned.split(/\d+\)/)[0].trim();
    if (firstSentence.length > 10) {
      cleaned = firstSentence;
    }
  }
  
  // Final comprehensive cleanup - hapus semua single letter yang tersisa
  // Kecuali single letter yang valid dalam konteks Indonesia (a, i, u, e, o dalam kata)
  cleaned = cleaned.replace(/\b[a-zA-Z]\b/g, (match) => {
    // Keep single letters that are part of common Indonesian abbreviations or valid
    const validSingleLetters = ['a', 'i', 'u', 'e', 'o']; // vowels in Indonesian
    if (validSingleLetters.includes(match.toLowerCase())) {
      // Only keep if it's surrounded by letters (part of a word)
      return match;
    }
    return ''; // Remove all other single letters
  });
  
  // Cleanup spasi berlebih lagi setelah penghapusan
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  
  // Final pass: remove any remaining single letter at the very end
  cleaned = cleaned.replace(/\s+[a-zA-Z]$/, "");
  
  return cleaned;
}

// ---- Paraphrase ringan: materi jadi basis jawaban, bukan teks mentah ----

const SYNONYM_MAP: Array<[RegExp, string]> = [
  [/\badalah\b/g, "merupakan"],
  [/\bdapat\b/g, "bisa"],
  [/\bjuga\b/g, "pula"],
  [/\bkarena\b/g, "sebab"],
  [/\bmenunjukkan\b/g, "memperlihatkan"],
  [/\bmenjelaskan\b/g, "menguraikan"],
  [/\bmenggunakan\b/g, "memakai"],
  [/\byaitu\b/g, "ialah"],
  [/\bsangat\b/g, "amat"],
  [/\bmemiliki\b/g, "punya"],
  [/\bsehingga\b/g, "hingga"],
  [/\btersebut\b/g, "terkait"],
  [/\btersebut\b/g, "dimaksud"],
  [/\btersebut\b/g, "berikut"],
  [/\bini\b/g, "berikut"],
  [/\bterjadi\b/g, "berlangsung"],
  [/\bterjadi\b/g, "muncul"],
  [/\bterjadi\b/g, "timbul"],
  [/\bmempengaruhi\b/g, "berdampak pada"],
  [/\bmempengaruhi\b/g, "mengubah"],
  [/\bmenentukan\b/g, "menetapkan"],
  [/\bmenentukan\b/g, "memutuskan"],
  [/\bmenentukan\b/g, "mengatur"],
  [/\bmenyebabkan\b/g, "mengakibatkan"],
  [/\bmenyebabkan\b/g, "membuat"],
  [/\bmenyebabkan\b/g, "menghasilkan"],
  [/\bmemerlukan\b/g, "butuh"],
  [/\bmemerlukan\b/g, "perlu"],
  [/\bmemerlukan\b/g, "mengharuskan"],
  [/\bmenghasilkan\b/g, "menciptakan"],
  [/\bmenghasilkan\b/g, "membuat"],
  [/\bmenghasilkan\b/g, "memperoleh"],
  [/\bperlu\b/g, "butuh"],
  [/\bbutuh\b/g, "perlu"],
  [/\btujuan\b/g, "maksud"],
  [/\bmaksud\b/g, "tujuan"],
  [/\bmetode\b/g, "cara"],
  [/\bcara\b/g, "metode"],
  [/\bproses\b/g, "langkah"],
  [/\blangkah\b/g, "proses"],
  [/\bhasil\b/g, "output"],
  [/\boutput\b/g, "hasil"],
];

const OPENERS =
  /^(selain itu|oleh karena itu|dengan demikian|selanjutnya|di sisi lain|namun demikian|dengan kata lain|secara umum|pada dasarnya)[,;]\s*/i;

export function paraphrase(text: string, variant: number): string {
  let out = text.replace(OPENERS, "").trim();

  const applySyn = (s: string) =>
    SYNONYM_MAP.reduce((acc, [re, rep]) => acc.replace(re, rep), s);

  // Berbagai teknik paraphrasing berdasarkan variant - fokus pada makna
  const v = variant % 8;

  if (v === 0) {
    // Inversi predikat: "X adalah Y" -> "Y merupakan X"
    const m = out.match(/^([A-ZÀ-ÿ][^.]{2,70}?)\s+(adalah|merupakan)\s+(.{10,90})$/);
    if (m) {
      const subj = m[1].charAt(0).toLowerCase() + m[1].slice(1);
      const pred = m[3].charAt(0).toUpperCase() + m[3].slice(1);
      out = `${pred} merupakan ${subj}`;
    } else {
      out = applySyn(out);
    }
  } else if (v === 1) {
    // Passive to active: "X dilakukan oleh Y" -> "Y melakukan X"
    const m = out.match(/^([A-ZÀ-ÿ][^.]{2,70}?)\s+(dilakukan|dibuat|dikerjakan|dilaksanakan)\s+(oleh)\s+(.{10,90})$/);
    if (m) {
      const subj = m[4].charAt(0).toUpperCase() + m[4].slice(1);
      const obj = m[1].charAt(0).toLowerCase() + m[1].slice(1);
      const verb = m[2].replace(/di/, "me");
      out = `${subj} ${verb} ${obj}`;
    } else {
      out = applySyn(out);
    }
  } else if (v === 2) {
    // Active to passive: "Y melakukan X" -> "X dilakukan oleh Y"
    const m = out.match(/^([A-ZÀ-ÿ][^.]{2,70}?)\s+(melakukan|membuat|mengerjakan|melaksanakan)\s+(.{10,90})$/);
    if (m) {
      const subj = m[3].charAt(0).toUpperCase() + m[3].slice(1);
      const obj = m[1].charAt(0).toLowerCase() + m[1].slice(1);
      const verb = m[2].replace(/me/, "di");
      out = `${subj} ${verb} oleh ${obj}`;
    } else {
      out = applySyn(out);
    }
  } else if (v === 3) {
    // Change sentence structure: "X dan Y" -> "Y serta X"
    out = out.replace(/\bdan\b/g, "serta");
    out = applySyn(out);
  } else if (v === 4) {
    // Add emphasis: "X" -> "X tersebut" or "X ini"
    const words = out.split(/\s+/);
    if (words.length > 3) {
      const lastWord = words[words.length - 1];
      if (!lastWord.endsWith("nya") && !lastWord.endsWith("ini") && !lastWord.endsWith("tersebut")) {
        words[words.length - 1] = lastWord + " tersebut";
        out = words.join(" ");
      }
    }
    out = applySyn(out);
  } else if (v === 5) {
    // Change connector: "karena" -> "sebabnya adalah", "sehingga" -> "akibatnya"
    out = out.replace(/\bkarena\b/g, "sebabnya adalah");
    out = out.replace(/\bsehingga\b/g, "akibatnya");
    out = applySyn(out);
  } else if (v === 6) {
    // Rephrase with different structure: "X untuk Y" -> "Y menggunakan X"
    const m = out.match(/^([A-ZÀ-ÿ][^.]{2,50}?)\s+(untuk)\s+(.{10,90})$/);
    if (m) {
      const subj = m[3].charAt(0).toUpperCase() + m[3].slice(1);
      const obj = m[1].charAt(0).toLowerCase() + m[1].slice(1);
      out = `${subj} menggunakan ${obj}`;
    } else {
      out = applySyn(out);
    }
  } else {
    // Simple synonym replacement with more aggressive changes
    out = applySyn(out);
    // Additional random synonym replacements for more variety
    out = out.replace(/\bsangat\b/g, "amat");
    out = out.replace(/\bperlu\b/g, "butuh");
  }

  return out.trim();
}

// Topik utama materi: bigram paling sering muncul, fallback kata tunggal
function findTopic(sentences: SentenceInfo[], termFreq: Map<string, number>): string {
  const bigrams = new Map<string, number>();
  for (const s of sentences) {
    const ws = s.text.split(/\s+/);
    for (let i = 0; i + 1 < ws.length; i++) {
      const a = ws[i];
      const b = ws[i + 1];
      if (
        a.length < 4 ||
        b.length < 4 ||
        STOP_WORDS.has(a.toLowerCase()) ||
        STOP_WORDS.has(b.toLowerCase())
      ) {
        continue;
      }
      const key = `${a} ${b}`.toLowerCase();
      bigrams.set(key, (bigrams.get(key) || 0) + 1);
    }
  }
  let best = "";
  let bestN = 0;
  for (const [k, n] of bigrams) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  if (bestN >= 3) return best;

  let top = "";
  let topN = 0;
  for (const [k, c] of termFreq) {
    if (c > topN && k.length > 4) {
      top = k;
      topN = c;
    }
  }
  return top;
}

function pickDifficulty(config: Difficulty, index: number): string {
  if (config === "campuran") {
    const cycle = ["mudah", "sedang", "sulit", "sedang"];
    return cycle[index % cycle.length];
  }
  return config;
}

const QUESTION_TEMPLATES = [
  // Tipe definisi langsung
  (term: string, topic: string) =>
    topic && topic !== term.toLowerCase()
      ? `Dalam pembahasan ${topic}, manakah pernyataan yang paling tepat mengenai "${term}"?`
      : `Berdasarkan materi, manakah pernyataan yang paling tepat mengenai "${term}"?`,
  (term: string, topic: string) =>
    topic && topic !== term.toLowerCase()
      ? `Terkait konsep "${term}" dalam topik ${topic}, pernyataan manakah yang benar?`
      : `Menurut materi, pernyataan manakah yang benar tentang "${term}"?`,
  // Tipe aplikasi
  (term: string) =>
    `Konsep "${term}" dapat diterapkan dalam situasi berikut, KECUALI...`,
  (term: string) =>
    `Dalam konteks praktis, manakah yang merupakan penerapan yang tepat dari "${term}"?`,
  // Tipe analisis
  (term: string) =>
    `Dari pernyataan-pernyataan berikut tentang "${term}", manakah yang menunjukkan pemahaman yang SALAH?`,
  (term: string) =>
    `Manakah pernyataan yang paling sesuai untuk menjelaskan "${term}" sesuai isi materi?`,
  // Tipe situasional
  (term: string) =>
    `Jika menghadapi situasi yang berkaitan dengan "${term}", langkah paling tepat adalah...`,
  (term: string) =>
    `Dalam skenario yang melibatkan "${term}", manakah tindakan yang paling tepat?`,
  // Tipe evaluasi
  (term: string) =>
    `Manakah argumen yang paling kuat untuk mendukung pernyataan tentang "${term}"?`,
  (term: string) =>
    `Berdasarkan materi, manakah yang merupakan implikasi penting dari "${term}"?`,
  // Tipe komparasi
  (term: string) =>
    `Apa perbedaan utama antara "${term}" dengan konsep lain yang dibahas dalam materi?`,
  // Tipe general
  () => `Perhatikan pernyataan-pernyataan berikut. Manakah yang paling sesuai dengan isi materi?`,
];

function generateQuestionFromSentence(
  info: SentenceInfo,
  config: QuizConfig,
  allSentences: SentenceInfo[],
  index: number,
  styleExamples: string,
  termFreq: Map<string, number>,
  topic: string,
): GeneratedQuestion | null {
  const numOptions = config.numberOfOptions;
  const difficulty = pickDifficulty(config.difficulty, index);

  const sentence = info.text.replace(/\s+/g, " ").trim();

  // Pilih istilah paling dominan (sering muncul di seluruh materi) agar
  // soal menyoroti konsep inti, bukan kata penghubung atau kata acak.
  // Kata berpola kata-kerja (men-/mem-/ber-/ter-/di- dst.) diberi penalti.
  const scored = [...new Set(info.keyTerms)]
    .map((t) => {
      const freq = termFreq.get(t.toLowerCase()) || 0;
      const weight = isVerbLike(t) ? 0.15 : 1;
      return {
        term: t,
        score: freq * weight,
        len: t.length,
      };
    })
    .sort((a, b) => b.score - a.score || b.len - a.len);

  const targetTerm = scored[0]?.term;
  if (!targetTerm) return null;

  // Jawaban benar diparafrase dari materi — isi sama, redaksi berbeda.
  const paraphraseVariant = index % 2;

  let question: string;
  let correctAnswer: string;

  if (styleExamples && styleExamples.trim().length > 10) {
    const q = generateStyledQuestion(sentence, targetTerm, styleExamples);
    question = q.question;
    correctAnswer = paraphrase(q.answer, paraphraseVariant);
  } else {
    const templateIdx = index % QUESTION_TEMPLATES.length;
    question = QUESTION_TEMPLATES[templateIdx](targetTerm, topic);
    correctAnswer = paraphrase(sentence, paraphraseVariant);
  }

  const distractors = generateDistractors(
    allSentences,
    info.index,
    correctAnswer,
    numOptions - 1,
    targetTerm,
    paraphraseVariant,
  );

  if (distractors.length < numOptions - 1) return null;

  const options = [correctAnswer, ...distractors.slice(0, numOptions - 1)];
  
  // Clean semua option untuk menghapus format yang tidak diinginkan
  const cleanedOptions = options.map(opt => cleanOptionText(opt));
  
  // FINAL STAGE: Additional aggressive cleaning to remove any remaining single letters
  const finalCleanedOptions = cleanedOptions.map(opt => {
    let final = opt.trim();
    // Apply nuclear cleaning
    final = nuclearCleanSingleLetters(final);
    // Additional manual cleaning
    final = final.replace(/\s+[a-zA-Z]$/, "");
    final = final.replace(/\s+[a-zA-Z][.,;:!?]$/, "");
    final = final.replace(/\s+[a-zA-Z]\s+/g, " ");
    return final.trim();
  });
  
  const shuffled = shuffle(finalCleanedOptions);
  
  // Find correct index using the final cleaned version
  const cleanedCorrectAnswer = cleanOptionText(correctAnswer);
  let finalCleanedCorrect = nuclearCleanSingleLetters(cleanedCorrectAnswer.trim());
  finalCleanedCorrect = finalCleanedCorrect.replace(/\s+[a-zA-Z]$/, "");
  finalCleanedCorrect = finalCleanedCorrect.replace(/\s+[a-zA-Z][.,;:!?]$/, "");
  finalCleanedCorrect = finalCleanedCorrect.replace(/\s+[a-zA-Z]\s+/g, " ");
  finalCleanedCorrect = finalCleanedCorrect.trim();
  
  const correctIndex = shuffled.indexOf(finalCleanedCorrect);

  return {
    question,
    options: shuffled,
    correctIndex,
    explanation: `Berdasarkan materi: "${truncate(sentence, 180)}"`,
    difficulty,
    sourceReference: truncate(sentence, 150),
    fingerprint: fingerprintQuestion(question),
  };
}

function generateStyledQuestion(
  sentence: string,
  term: string,
  styleExamples: string,
): { question: string; answer: string } {
  const style = styleExamples.toLowerCase();
  if (style.includes("manakah yang termasuk")) {
    return {
      question: `Berdasarkan materi, manakah yang termasuk dalam pembahasan "${term}"?`,
      answer: sentence,
    };
  }
  if (style.includes("apa yang dimaksud") || style.includes("apa fungsi")) {
    return {
      question: `Berdasarkan materi, apa yang dimaksud dengan "${term}"?`,
      answer: sentence,
    };
  }
  if (style.includes("mengapa") || style.includes("sebab")) {
    return {
      question: `Berdasarkan materi, manakah penjelasan yang tepat mengenai "${term}"?`,
      answer: sentence,
    };
  }
  return {
    question: `Berdasarkan materi, manakah pernyataan yang benar mengenai "${term}"?`,
    answer: sentence,
  };
}

function generateDistractors(
  allSentences: SentenceInfo[],
  sourceIndex: number,
  correct: string,
  count: number,
  targetTerm: string,
  variant: number,
): string[] {
  const distractors: string[] = [];
  // Pengecoh boleh dipakai ulang antar soal — cukup hindari kalimat sumber
  // agar jawaban benar tidak muncul ganda dalam satu soal.
  const candidates = allSentences.filter((_, i) => i !== sourceIndex);

  // Prioritaskan distractors yang mengandung istilah yang sama atau terkait
  // DAN memiliki minimal relevansi semantik dengan targetTerm
  const scoredCandidates = shuffle(candidates).map(c => {
    const termInSentence = c.text.toLowerCase().includes(targetTerm.toLowerCase());
    const termLower = targetTerm.toLowerCase();
    
    // Cek relevansi semantik: minimal 1 kata kunci yang sama
    const sentenceWords = new Set(c.text.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const termWords = termLower.split(/\s+/).filter(w => w.length > 3);
    const hasSemanticOverlap = termWords.some(w => sentenceWords.has(w));
    
    let score = 0;
    if (termInSentence) score += 3; // Prioritas tinggi: mengandung istilah persis
    else if (hasSemanticOverlap) score += 2; // Prioritas sedang: ada overlap kata kunci
    else score += 1; // Prioritas rendah: kalimat lain
    
    return { sentence: c, score };
  }).sort((a, b) => b.score - a.score);

  for (const { sentence: c } of scoredCandidates) {
    if (distractors.length >= count) break;
    
    // Skip kalimat yang tidak memiliki relevansi semantik sama sekali
    const termLower = targetTerm.toLowerCase();
    const sentenceWords = new Set(c.text.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const termWords = termLower.split(/\s+/).filter(w => w.length > 3);
    const hasSemanticOverlap = termWords.some(w => sentenceWords.has(w));
    
    // Hanya gunakan kalimat yang memiliki minimal overlap semantik
    if (!hasSemanticOverlap && scoredCandidates.find(s => s.sentence === c)?.score === 1) {
      continue; // Skip kalimat yang sama sekali tidak relevan
    }
    
    const candidate = paraphrase(c.text, variant);
    const rawCandidate = c.text;
    if (
      rawCandidate !== correct &&
      candidate !== correct &&
      !distractors.includes(candidate) &&
      !sentencesOverlap(rawCandidate, correct)
    ) {
      distractors.push(candidate);
    }
  }

  // Smart fallback distractors - contextually relevant instead of generic
  let fallbackIdx = 0;
  while (distractors.length < count && fallbackIdx < 20) {
    const fb = smartDistractor(targetTerm, fallbackIdx);
    if (!distractors.includes(fb) && fb !== correct) {
      distractors.push(fb);
    }
    fallbackIdx++;
  }

  return distractors;
}

function smartDistractor(term: string, idx: number): string {
  // Generate distractors that are contextually related but incorrect
  const templates = [
    `Konsep ${term} yang berlawanan dengan materi`,
    `Penerapan ${term} yang tidak sesuai dengan konteks`,
    `Hubungan ${term} yang tidak didukung oleh materi`,
    `Implikasi ${term} yang tidak disebutkan dalam materi`,
    `Perbandingan ${term} yang tidak akurat`,
    `Karakteristik ${term} yang tidak sesuai dengan definisi`,
    `Fungsi ${term} yang berbeda dari yang dijelaskan`,
    `Proses ${term} yang tidak mengikuti materi`,
  ];
  
  const fallbacks = [
    "Informasi ini tidak dibahas dalam materi",
    "Pernyataan yang bertentangan dengan materi",
    "Hal ini tidak disebutkan dalam materi",
  ];

  // Use smart templates first, then fallback to generic
  if (idx < templates.length) {
    return templates[idx];
  }
  return fallbacks[idx % fallbacks.length];
}

// Deteksi kata berpola kata-kerja Indonesia untuk penalti pemilihan istilah
const VERB_PREFIX = /^(me|meng|mem|meny|men|ber|ter|di|peng|pem|pen|per)[a-z]/;

function isVerbLike(w: string): boolean {
  const lw = w.toLowerCase();
  return VERB_PREFIX.test(lw) || lw.endsWith("nya");
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 3);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return base.trim().replace(/[,;:.]$/, "") + "...";
}

export async function generateQuiz(
  materialText: string,
  config: QuizConfig,
  existingQuestions: Question[] = [],
  geminiApiKey?: string,
  userId?: string, // Added userId to fetch settings
): Promise<GenerationResult> {
  const usedFingerprints = new Set(
    existingQuestions.map((q) => q.fingerprint).filter(Boolean),
  );

  let finalQuestions: GeneratedQuestion[] = [];
  let aiUsed = false;
  let lastError: Error | null = null;

  const primaryApi = userId ? getPrimaryApi(userId) : "groq";
  const groqApiKey = userId ? getGroqKey(userId) : null;
  const openRouterApiKey = userId ? getOpenRouterKey(userId) : null;

  const tryGemini = async () => {
    if (!geminiApiKey || geminiApiKey.trim().length < 10) throw new Error("Gemini API key tidak tersedia.");
    console.log("[QuizGen] Attempting Gemini AI generation...");
    const geminiModel = userId ? getGeminiModel(userId) : null;
    return await generateQuizWithAI(materialText, config, geminiApiKey, geminiModel);
  };

  const tryGroq = async () => {
    if (!userId) throw new Error("User ID tidak tersedia.");
    const groqKey = getGroqKey(userId);
    if (!groqKey) throw new Error("Groq API key tidak tersedia.");
    console.log("[QuizGen] Attempting Groq AI generation...");
    const groqModel = getGroqModel(userId);
    return await generateQuizWithGroq(materialText, config, groqKey, groqModel);
  };

  const tryOpenRouter = async () => {
    if (!userId) throw new Error("User ID tidak tersedia.");
    const openRouterKey = getOpenRouterKey(userId);
    if (!openRouterKey) throw new Error("OpenRouter API key tidak tersedia.");
    console.log("[QuizGen] Attempting OpenRouter AI generation...");
    const openRouterModel = getOpenRouterModel(userId);
    return await generateQuizWithOpenRouter(materialText, config, openRouterKey, openRouterModel);
  };

  const tryCohere = async () => {
    if (!userId) throw new Error("User ID tidak tersedia.");
    const cohereKey = getCohereKey(userId);
    if (!cohereKey) throw new Error("Cohere API key tidak tersedia.");
    console.log("[QuizGen] Attempting Cohere AI generation...");
    const cohereModel = getCohereModel(userId);
    return await generateQuizWithCohere(materialText, config, cohereKey, cohereModel);
  };

  const filterAndSlice = (questions: GeneratedQuestion[]) => {
    let filtered = config.quizMode === "baru"
      ? questions.filter((q) => !usedFingerprints.has(q.fingerprint))
      : questions;
    return filtered.slice(0, config.totalQuestions);
  };

  // Tentukan urutan eksekusi berdasarkan preferensi (Hanya jalankan yang dipilih)
  const executionOrder = [];
  if (primaryApi === "groq") {
    executionOrder.push({ name: "Groq", fn: tryGroq });
  } else if (primaryApi === "openrouter") {
    executionOrder.push({ name: "OpenRouter", fn: tryOpenRouter });
  } else if (primaryApi === "cohere") {
    executionOrder.push({ name: "Cohere", fn: tryCohere });
  } else if (primaryApi === "gemini") {
    executionOrder.push({ name: "Gemini", fn: tryGemini });
  }

  for (const api of executionOrder) {
    try {
      const rawQs = await api.fn();
      finalQuestions = filterAndSlice(rawQs);
      if (finalQuestions.length > 0) {
        aiUsed = true;
        console.log(`[QuizGen] Berhasil generate ${finalQuestions.length} soal menggunakan ${api.name}`);
        break; // Sukses, keluar dari loop
      }
    } catch (err: any) {
      console.warn(`[QuizGen] ${api.name} gagal:`, err.message);
      lastError = err;
      // Lanjut ke API cadangan di iterasi berikutnya
    }
  }

  // Jika AI dicoba dan semuanya gagal, lemparkan error
  if (executionOrder.length > 0 && !aiUsed) {
    console.error("[QuizGen] Semua AI gagal.", lastError);
    throw lastError || new Error("Gagal membuat soal menggunakan AI.");
  }

  if (aiUsed) {
    return {
      questions: finalQuestions,
      insufficient: finalQuestions.length < config.totalQuestions,
      maxPossible: finalQuestions.length,
      generatedByAI: true,
    };
  }

  console.log("[QuizGen] No valid API keys, using rule-based fallback");

  // ─── FALLBACK: Rule-based generator (logika lama) ───
  const sentences = splitSentences(materialText);

  // Frekuensi istilah di seluruh materi, dipakai memilih konsep inti per soal
  const termFreq = new Map<string, number>();
  for (const s of sentences) {
    for (const t of s.keyTerms) {
      const k = t.toLowerCase();
      termFreq.set(k, (termFreq.get(k) || 0) + 1);
    }
  }

  const maxPossible = Math.min(sentences.length, 50);

  // Topik utama materi untuk elaborasi pertanyaan
  const topic = findTopic(sentences, termFreq);

  const questions: GeneratedQuestion[] = [];
  const usedSentenceIndices = new Set<number>();

  for (let i = 0; i < config.totalQuestions * 5 && questions.length < config.totalQuestions; i++) {
    const availableIndices = sentences
      .map((_, idx) => idx)
      .filter((idx) => !usedSentenceIndices.has(idx));
    if (availableIndices.length === 0) break;

    const idx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    const info = sentences[idx];

    const q = generateQuestionFromSentence(
      info,
      config,
      sentences,
      questions.length,
      config.styleExamples,
      termFreq,
      topic,
    );

    if (q) {
      // Always mark sentence as used so we don't retry it
      usedSentenceIndices.add(idx);

      // For "soal baru" mode, skip duplicates. For "sama" mode, allow them.
      if (config.quizMode === "baru" && usedFingerprints.has(q.fingerprint)) {
        continue;
      }

      usedFingerprints.add(q.fingerprint);
      questions.push(q);
    }
  }

  const insufficient = questions.length < config.totalQuestions;

  // For "soal sama" mode, pad with existing questions if needed
  if (config.quizMode === "sama" && insufficient) {
    for (const eq of existingQuestions) {
      if (questions.length >= config.totalQuestions) break;
      questions.push({
        question: eq.question,
        options: eq.options,
        correctIndex: eq.correct_index,
        explanation: eq.explanation,
        difficulty: eq.difficulty,
        sourceReference: eq.source_reference,
        fingerprint: eq.fingerprint || fingerprintQuestion(eq.question),
      });
    }
  }

  return {
    questions,
    insufficient: questions.length < config.totalQuestions,
    maxPossible,
    generatedByAI: false,
  };
}

export { difficultyLabel as difficultyLabelFn };
