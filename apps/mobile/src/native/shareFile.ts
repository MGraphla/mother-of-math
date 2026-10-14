import { saveBase64ToDevice, saveLocalUriToDevice, saveUtf8ToDevice } from "./saveFile";

const sanitizeFileName = (name: string) =>
  name.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_").slice(0, 120) || "export";

/**
 * Expo Sharing (SDK 57) only accepts `file://` URLs — not `content://`.
 * Print / Android sometimes emit broken URIs like `file: ///…/Print /x.pdf`.
 */
export const normalizeLocalFileUri = (uri: string): string => {
  let u = (uri || "").trim();
  if (!u) return u;

  // `file: ///path` or `file:/path` → `file:///path`
  u = u.replace(/^file:\s*\/+/i, "file:///");

  if (u.startsWith("/") && !u.startsWith("file://")) {
    u = `file://${u}`;
  }

  if (!u.startsWith("file://")) return u;

  // Encode spaces / unsafe chars in each path segment (keeps `/` separators).
  const withoutScheme = u.slice("file://".length);
  const encoded = withoutScheme
    .split("/")
    .map((segment) => {
      if (!segment) return "";
      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch {
        return encodeURIComponent(segment);
      }
    })
    .join("/");

  return `file://${encoded}`;
};

/**
 * Save a local file into the phone's Files / Downloads folder (not the share sheet).
 */
export const shareLocalFile = async (
  sourceUri: string,
  fileName: string,
  mimeType: string,
) => {
  const safeName = sanitizeFileName(fileName);
  return saveLocalUriToDevice(sourceUri, safeName, mimeType);
};

/** Write UTF-8 text and save it to the phone. */
export const shareUtf8File = async (
  fileName: string,
  body: string,
  mimeType: string,
) => {
  const safeName = sanitizeFileName(fileName);
  return saveUtf8ToDevice(body, safeName, mimeType);
};

/** Write base64 bytes and save them to the phone. */
export const shareBase64File = async (
  base64: string,
  fileName: string,
  mimeType: string,
) => {
  const safeName = sanitizeFileName(fileName);
  return saveBase64ToDevice(base64, safeName, mimeType);
};
