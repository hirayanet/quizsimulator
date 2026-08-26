/**
 * settingsStore.ts
 * -----------------
 * Local storage utilities for storing API Keys, Model Preferences, and Primary API preference.
 */

const GROQ_KEY_PREFIX = "aqs_groq_key_";
const GROQ_MODEL_PREFIX = "aqs_groq_model_";
const OPENROUTER_KEY_PREFIX = "aqs_openrouter_key_";
const OPENROUTER_MODEL_PREFIX = "aqs_openrouter_model_";
const PRIMARY_API_PREFIX = "aqs_primary_api_";

const GEMINI_MODEL_PREFIX = "aqs_gemini_model_";
const COHERE_KEY_PREFIX = "aqs_cohere_key_";
const COHERE_MODEL_PREFIX = "aqs_cohere_model_";

export type PrimaryApi = "gemini" | "groq" | "openrouter" | "cohere" | "none";

/** Save Gemini Model to local storage */
export function saveGeminiModel(userId: string, model: string): void {
  localStorage.setItem(GEMINI_MODEL_PREFIX + userId, model);
}

/** Get Gemini Model from local storage */
export function getGeminiModel(userId: string): string | null {
  return localStorage.getItem(GEMINI_MODEL_PREFIX + userId);
}

/** Save Groq Key to local storage */
export function saveGroqKey(userId: string, key: string): void {
  localStorage.setItem(GROQ_KEY_PREFIX + userId, key.trim());
}

/** Get Groq Key from local storage */
export function getGroqKey(userId: string): string | null {
  return localStorage.getItem(GROQ_KEY_PREFIX + userId);
}

/** Remove Groq Key from local storage */
export function clearGroqKey(userId: string): void {
  localStorage.removeItem(GROQ_KEY_PREFIX + userId);
}

/** Check if user has Groq key */
export function hasGroqKey(userId: string): boolean {
  const key = getGroqKey(userId);
  return key !== null && key.trim().length > 10;
}

/** Save Groq Model to local storage */
export function saveGroqModel(userId: string, model: string): void {
  localStorage.setItem(GROQ_MODEL_PREFIX + userId, model);
}

/** Get Groq Model from local storage */
export function getGroqModel(userId: string): string | null {
  return localStorage.getItem(GROQ_MODEL_PREFIX + userId);
}

/** Save OpenRouter Key to local storage */
export function saveOpenRouterKey(userId: string, key: string): void {
  localStorage.setItem(OPENROUTER_KEY_PREFIX + userId, key.trim());
}

/** Get OpenRouter Key from local storage */
export function getOpenRouterKey(userId: string): string | null {
  return localStorage.getItem(OPENROUTER_KEY_PREFIX + userId);
}

/** Remove OpenRouter Key from local storage */
export function clearOpenRouterKey(userId: string): void {
  localStorage.removeItem(OPENROUTER_KEY_PREFIX + userId);
}

/** Check if user has OpenRouter key */
export function hasOpenRouterKey(userId: string): boolean {
  const key = getOpenRouterKey(userId);
  return key !== null && key.trim().length > 10;
}

/** Save OpenRouter Model to local storage */
export function saveOpenRouterModel(userId: string, model: string): void {
  localStorage.setItem(OPENROUTER_MODEL_PREFIX + userId, model);
}

/** Get OpenRouter Model from local storage */
export function getOpenRouterModel(userId: string): string | null {
  return localStorage.getItem(OPENROUTER_MODEL_PREFIX + userId);
}

/** Save Primary API preference */
export function savePrimaryApi(userId: string, api: PrimaryApi): void {
  localStorage.setItem(PRIMARY_API_PREFIX + userId, api);
}

/** Get Primary API preference, defaults to 'gemini' */
export function getPrimaryApi(userId: string): PrimaryApi {
  const val = localStorage.getItem(PRIMARY_API_PREFIX + userId);
  if (val === "groq") return "groq";
  if (val === "openrouter") return "openrouter";
  if (val === "cohere") return "cohere";
  if (val === "none") return "none";
  return "gemini";
}

/** Save Cohere Key */
export function saveCohereKey(userId: string, key: string): void {
  localStorage.setItem(COHERE_KEY_PREFIX + userId, key.trim());
}

/** Get Cohere Key */
export function getCohereKey(userId: string): string | null {
  return localStorage.getItem(COHERE_KEY_PREFIX + userId);
}

/** Clear Cohere Key */
export function clearCohereKey(userId: string): void {
  localStorage.removeItem(COHERE_KEY_PREFIX + userId);
}

/** Check if user has Cohere key */
export function hasCohereKey(userId: string): boolean {
  const key = getCohereKey(userId);
  return key !== null && key.trim().length > 10;
}

/** Save Cohere Model */
export function saveCohereModel(userId: string, model: string): void {
  localStorage.setItem(COHERE_MODEL_PREFIX + userId, model);
}

/** Get Cohere Model */
export function getCohereModel(userId: string): string | null {
  return localStorage.getItem(COHERE_MODEL_PREFIX + userId);
}
