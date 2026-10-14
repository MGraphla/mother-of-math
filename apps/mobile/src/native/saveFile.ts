import { Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

const FOLDER_KEY = "mama_download_folder_uri";
const IOS_HINT_KEY = "mama_download_ios_hint_seen";

const sanitizeFileName = (name: string) =>
  name.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_").slice(0, 120) || "export";

const stemAndExt = (fileName: string) => {
  const safe = sanitizeFileName(fileName);
  const dot = safe.lastIndexOf(".");
  if (dot <= 0) return { stem: safe, ext: "" };
  return { stem: safe.slice(0, dot), ext: safe.slice(dot) };
};

const confirmIosSave = () =>
  new Promise<boolean>((resolve) => {
    Alert.alert(
      "Download to this phone",
      "The file will be saved in the Files app → On My iPhone → Mother of Math Mobile → Downloads. You can open it there without sharing.",
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "Download", onPress: () => resolve(true) },
      ],
    );
  });

const ensureIosDownloadNotice = async () => {
  const seen = await AsyncStorage.getItem(IOS_HINT_KEY);
  if (seen) return;
  const proceed = await confirmIosSave();
  if (!proceed) {
    throw new Error("Download cancelled.");
  }
  await AsyncStorage.setItem(IOS_HINT_KEY, "1");
};

const iosDownloadsDir = () => {
  const root = FileSystem.documentDirectory;
  if (!root) throw new Error("File storage is unavailable on this device.");
  return root.endsWith("/") ? `${root}Downloads/` : `${root}/Downloads/`;
};

const confirmAndroidFolderPick = () =>
  new Promise<boolean>((resolve) => {
    Alert.alert(
      "Allow file access",
      "Mama Math needs permission to save this file on your phone. Choose a folder such as Downloads. The file is downloaded there — it is not shared.",
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "Allow access", onPress: () => resolve(true) },
      ],
    );
  });

const getAndroidDirectoryUri = async (): Promise<string> => {
  const { StorageAccessFramework } = FileSystem;
  const stored = await AsyncStorage.getItem(FOLDER_KEY);
  if (stored) return stored;

  const proceed = await confirmAndroidFolderPick();
  if (!proceed) {
    throw new Error("Choose a folder so Mama Math can save the file to your phone.");
  }

  const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permissions.granted || !permissions.directoryUri) {
    throw new Error("Folder access is needed to save the file to your phone.");
  }

  await AsyncStorage.setItem(FOLDER_KEY, permissions.directoryUri);
  return permissions.directoryUri;
};

const writeAndroidFile = async (fileName: string, contents: string, mimeType: string, encoding: FileSystem.EncodingType) => {
  const { StorageAccessFramework } = FileSystem;
  const { stem } = stemAndExt(fileName);
  const uniqueStem = `${stem}_${Date.now()}`;

  const writeTo = async (directoryUri: string) => {
    const fileUri = await StorageAccessFramework.createFileAsync(directoryUri, uniqueStem, mimeType);
    await FileSystem.writeAsStringAsync(fileUri, contents, { encoding });
    return fileUri;
  };

  try {
    const directoryUri = await getAndroidDirectoryUri();
    return await writeTo(directoryUri);
  } catch (first) {
    const message = first instanceof Error ? first.message : String(first);
    if (message.includes("Choose a folder") || message.includes("Folder access")) throw first;
    await AsyncStorage.removeItem(FOLDER_KEY);
    const directoryUri = await getAndroidDirectoryUri();
    return await writeTo(directoryUri);
  }
};

const writeIosFile = async (fileName: string, contents: string, encoding: FileSystem.EncodingType) => {
  await ensureIosDownloadNotice();
  const dir = iosDownloadsDir();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  const dest = `${dir}${sanitizeFileName(fileName)}`;
  await FileSystem.writeAsStringAsync(dest, contents, { encoding });
  return dest;
};

/** Save base64 bytes into the user's chosen folder (Android) or Files app (iOS). */
export const saveBase64ToDevice = async (base64: string, fileName: string, mimeType: string) => {
  const clean = base64.replace(/^data:[^;]+;base64,/, "");
  if (Platform.OS === "android") {
    return writeAndroidFile(fileName, clean, mimeType, FileSystem.EncodingType.Base64);
  }
  return writeIosFile(fileName, clean, FileSystem.EncodingType.Base64);
};

/** Save UTF-8 text into the user's Files / Downloads folder. */
export const saveUtf8ToDevice = async (body: string, fileName: string, mimeType: string) => {
  if (Platform.OS === "android") {
    return writeAndroidFile(fileName, body, mimeType, FileSystem.EncodingType.UTF8);
  }
  return writeIosFile(fileName, body, FileSystem.EncodingType.UTF8);
};

/** Copy a local file into the user's Files / Downloads folder. */
export const saveLocalUriToDevice = async (sourceUri: string, fileName: string, mimeType: string) => {
  let from = (sourceUri || "").trim().replace(/^file:\s*\/+/i, "file:///");
  if (from.startsWith("/") && !from.startsWith("file://")) from = `file://${from}`;
  const base64 = await FileSystem.readAsStringAsync(from, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return saveBase64ToDevice(base64, fileName, mimeType);
};

export const savedFileHint = (fileName: string) =>
  Platform.OS === "ios"
    ? `Saved as ${fileName}. Open the Files app → On My iPhone → Mother of Math Mobile → Downloads.`
    : `Saved as ${fileName}. Open Files or Downloads on your phone to find it.`;
