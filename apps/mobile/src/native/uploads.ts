import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Alert, Linking, Platform } from "react-native";

export type PickedFile = {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number | null;
};

export const pickDocumentForUpload = async (): Promise<PickedFile | null> => {
  const result = await DocumentPicker.getDocumentAsync({
    multiple: false,
    copyToCacheDirectory: true,
    type: ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"],
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.name || `file-${Date.now()}`,
    mimeType: asset.mimeType,
    size: asset.size,
  };
};

export const pickImageForUpload = async (): Promise<PickedFile | null> => {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  let granted = current.granted;
  if (!granted) {
    const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
    granted = requested.granted;
  }
  if (!granted) {
    Alert.alert("Permission needed", "Allow photo library access to upload student work.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Open settings",
        onPress: () => (Platform.OS === "ios" ? Linking.openURL("app-settings:") : Linking.openSettings()),
      },
    ]);
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.85,
    allowsMultipleSelection: false,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const ext = asset.uri.split(".").pop()?.split("?")[0] || "jpg";
  return {
    uri: asset.uri,
    name: `photo-${Date.now()}.${ext}`,
    mimeType: asset.mimeType || `image/${ext === "jpg" ? "jpeg" : ext}`,
    size: asset.fileSize,
  };
};

export const takePhotoForUpload = async (): Promise<PickedFile | null> => {
  const current = await ImagePicker.getCameraPermissionsAsync();
  let granted = current.granted;
  if (!granted) {
    const requested = await ImagePicker.requestCameraPermissionsAsync();
    granted = requested.granted;
  }
  if (!granted) {
    Alert.alert("Permission needed", "Allow camera access to photograph student work.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Open settings",
        onPress: () => (Platform.OS === "ios" ? Linking.openURL("app-settings:") : Linking.openSettings()),
      },
    ]);
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    quality: 0.85,
    allowsEditing: false,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: `camera-${Date.now()}.jpg`,
    mimeType: asset.mimeType || "image/jpeg",
    size: asset.fileSize,
  };
};

export const chooseUploadSource = (): Promise<"camera" | "gallery" | "document" | null> =>
  new Promise((resolve) => {
    Alert.alert("Upload", "Choose a source", [
      { text: "Camera", onPress: () => resolve("camera") },
      { text: "Photo library", onPress: () => resolve("gallery") },
      { text: "Document", onPress: () => resolve("document") },
      { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
    ]);
  });

export const pickAnyForUpload = async (): Promise<PickedFile | null> => {
  const source = await chooseUploadSource();
  if (!source) return null;
  if (source === "camera") return takePhotoForUpload();
  if (source === "gallery") return pickImageForUpload();
  return pickDocumentForUpload();
};
