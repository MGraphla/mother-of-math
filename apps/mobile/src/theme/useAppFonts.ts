// Per-weight subpaths, so Metro only bundles these .ttf files instead of
// every variant the package ships (the barrel import pulls in all 18, ~6MB).
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { Inter_800ExtraBold } from "@expo-google-fonts/inter/800ExtraBold";
import { Inter_900Black } from "@expo-google-fonts/inter/900Black";
import { useFonts } from "expo-font";

/**
 * The web app renders in Inter; loading the same weights keeps type identical.
 * Returns true once text can be rendered without a fallback-font flash.
 */
export const useAppFonts = (): boolean => {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  // Never block the app forever if a font asset fails to resolve.
  return loaded || !!error;
};
