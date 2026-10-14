import { shareUtf8File } from "./shareFile";

const sanitizeFileName = (name: string) =>
  name.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_").slice(0, 120) || "export.txt";

export const shareTextFile = async (fileName: string, body: string) => {
  const lower = fileName.toLowerCase();
  const hasExt =
    lower.endsWith(".txt") ||
    lower.endsWith(".json") ||
    lower.endsWith(".csv") ||
    lower.endsWith(".md");
  const safeName = sanitizeFileName(hasExt ? fileName : `${fileName}.txt`);
  const mimeType = safeName.endsWith(".json")
    ? "application/json"
    : safeName.endsWith(".csv")
      ? "text/csv"
      : safeName.endsWith(".md")
        ? "text/markdown"
        : "text/plain";

  return shareUtf8File(safeName, body, mimeType);
};
