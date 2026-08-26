export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function scoreCategory(pct: number): { label: string; color: string } {
  if (pct >= 90) return { label: "Sangat Baik", color: "text-success-600" };
  if (pct >= 75) return { label: "Baik", color: "text-primary-600" };
  if (pct >= 60) return { label: "Cukup", color: "text-warning-600" };
  return { label: "Perlu Belajar Lagi", color: "text-error-600" };
}

export function getScoreColor(pct: number): string {
  if (pct >= 75) return "text-success-600";
  if (pct >= 60) return "text-warning-600";
  return "text-error-600";
}

export function getFileKind(file: File): "pdf" | "doc" | "docx" | "audio" | "video" | "unknown" {
  const name = file.name.toLowerCase();
  const type = file.type;
  if (name.endsWith(".pdf") || type === "application/pdf") return "pdf";
  if (name.endsWith(".doc") || type === "application/msword") return "doc";
  if (name.endsWith(".docx") || type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    return "docx";
  if (type.startsWith("audio/") || name.match(/\.(mp3|wav|m4a|aac|ogg|flac)$/)) return "audio";
  if (type.startsWith("video/") || name.match(/\.(mp4|mov|avi|mkv|webm)$/)) return "video";
  return "unknown";
}

export function isSupportedFile(file: File): boolean {
  return getFileKind(file) !== "unknown";
}
