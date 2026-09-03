/**
 * Penyimpanan sesi upload yang sedang berjalan (IndexedDB).
 *
 * Masalah: saat layar HP terkunci / tab ditutup di tengah ekstraksi,
 * Chrome Android bisa "membuang" tab (discard) lalu me-reload halaman
 * saat dibuka lagi. Semua state React hilang → proses upload tampak lenyap.
 *
 * Solusi: file + hasil teks per halaman disimpan ke IndexedDB saat
 * berjalan. Jika tab di-reload, halaman CreateQuiz bisa menawarkan
 * "Lanjutkan upload" dari halaman terakhir yang selesai diproses.
 */

const DB_NAME = "freebuff-uploads";
const DB_VERSION = 1;
const STORE = "pending";

const META_KEY = "meta";
const PROGRESS_KEY = "progress";

/** Session dianggap basi jika lebih dari 24 jam — otomatis dibersihkan. */
const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000;

interface PendingMeta {
  file: File;
  startedAt: number;
  kind: string;
  totalPages: number | null;
}

interface PendingProgress {
  savedPages: Record<number, string>;
  scannedPages: number[];
}

export interface PendingUpload extends PendingMeta, PendingProgress {}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function putRecord(key: string, value: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      }),
  );
}

function getRecord<T>(key: string): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => {
          db.close();
          resolve(req.result as T | undefined);
        };
        req.onerror = () => {
          db.close();
          reject(req.error);
        };
      }),
  );
}

function clearStore(): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).clear();
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      }),
  );
}

/** Simpan file + metadata sesi SEBELUM ekstraksi dimulai (IDB mungkin gagal di private mode — abaikan). */
export async function beginPendingUpload(file: File, kind: string): Promise<void> {
  try {
    await putRecord(META_KEY, {
      file,
      startedAt: Date.now(),
      kind,
      totalPages: null,
    } satisfies PendingMeta);
    // Upload baru → buang progres sesi lama agar tidak tercampur
    await putRecord(PROGRESS_KEY, { savedPages: {}, scannedPages: [] } satisfies PendingProgress);
  } catch (err) {
    console.warn("[uploadSession] Gagal menyimpan sesi:", err);
  }
}

/** Perbarui progres per halaman (dipanggil berkala saat ekstraksi berjalan). */
export async function savePendingProgress(
  savedPages: Record<number, string>,
  scannedPages: number[],
  totalPages: number,
): Promise<void> {
  try {
    await putRecord(PROGRESS_KEY, { savedPages, scannedPages } satisfies PendingProgress);
    const meta = await getRecord<PendingMeta>(META_KEY);
    if (meta && meta.totalPages !== totalPages) {
      await putRecord(META_KEY, { ...meta, totalPages });
    }
  } catch (err) {
    console.warn("[uploadSession] Gagal menyimpan progres:", err);
  }
}

/** Ambil sesi yang tertunda; bersihkan otomatis jika sudah basi (> 24 jam). */
export async function getPendingUpload(): Promise<PendingUpload | null> {
  try {
    const meta = await getRecord<PendingMeta>(META_KEY);
    if (!meta) return null;
    if (Date.now() - meta.startedAt > MAX_SESSION_AGE_MS) {
      await clearStore();
      return null;
    }
    const progress = await getRecord<PendingProgress>(PROGRESS_KEY);
    return {
      ...meta,
      savedPages: progress?.savedPages ?? {},
      scannedPages: progress?.scannedPages ?? [],
    };
  } catch {
    return null;
  }
}

/** Hapus sesi (sukses / dibatalkan / gagal). */
export async function clearPendingUpload(): Promise<void> {
  try {
    await clearStore();
  } catch {
    /* abaikan */
  }
}