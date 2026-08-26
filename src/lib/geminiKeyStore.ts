/**
 * geminiKeyStore.ts
 * -----------------
 * Mengambil Gemini API Key dari user profile di database (sumber utama).
 * localStorage dipakai sebagai cache agar tidak fetch DB setiap saat.
 *
 * Setelah login Google, key otomatis tersedia di semua device.
 */

const CACHE_PREFIX = "aqs_gemini_cache_";

/** Simpan key ke cache localStorage */
function writeCache(userId: string, key: string): void {
  localStorage.setItem(CACHE_PREFIX + userId, key);
}

/** Baca key dari cache localStorage */
function readCache(userId: string): string | null {
  return localStorage.getItem(CACHE_PREFIX + userId);
}

/** Hapus cache localStorage */
export function clearLocalCache(userId: string): void {
  localStorage.removeItem(CACHE_PREFIX + userId);
}

/**
 * Ambil Gemini API key user.
 * Prioritas: cache localStorage → nilai dari user object (sudah di-load dari DB).
 */
export function getGeminiKey(userId: string, dbKey?: string): string | null {
  // Cek cache dulu (lebih cepat)
  const cached = readCache(userId);
  if (cached && cached.trim().length > 10) return cached;

  // Fallback ke nilai dari DB (sudah di-load di UserContext)
  if (dbKey && dbKey.trim().length > 10) {
    writeCache(userId, dbKey); // simpan ke cache
    return dbKey;
  }

  return null;
}

/**
 * Simpan key ke cache localStorage (DB disimpan via db.ts saveGeminiKeyToDB).
 * Dipanggil setelah DB berhasil disimpan.
 */
export function cacheGeminiKey(userId: string, apiKey: string): void {
  writeCache(userId, apiKey.trim());
}

/** Hapus key dari cache localStorage */
export function clearGeminiKey(userId: string): void {
  clearLocalCache(userId);
}

/** Cek apakah user punya API key (dari cache atau DB value) */
export function hasGeminiKey(userId: string, dbKey?: string): boolean {
  const key = getGeminiKey(userId, dbKey);
  return key !== null && key.trim().length > 10;
}
