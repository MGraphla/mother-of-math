import * as FileSystem from "expo-file-system/legacy";
import { saveLocalUriToDevice } from "./saveFile";

const sanitizeFileName = (name: string) =>
  name.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_").slice(0, 120) || "download.bin";

/**
 * Download a remote file into the app cache, then save it to Files / Downloads.
 */
export const downloadAndShare = async (url: string, fileName: string) => {
  if (!url?.trim()) throw new Error("No download URL provided.");
  if (!FileSystem.cacheDirectory) throw new Error("File cache is unavailable on this device.");

  const safeName = sanitizeFileName(fileName);
  const destination = `${FileSystem.cacheDirectory}${Date.now()}_${safeName}`;
  const result = await FileSystem.downloadAsync(url, destination);

  if (!result.uri) throw new Error("Download failed. Please try again.");

  await saveLocalUriToDevice(result.uri, safeName, guessMime(safeName));
  return result.uri;
};

const guessMime = (fileName: string) => {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "txt":
      return "text/plain";
    case "json":
      return "application/json";
    case "ppt":
    case "pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "doc":
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xls":
    case "xlsx":
      return "application/vnd.ms-excel";
    default:
      return "application/octet-stream";
  }
};
