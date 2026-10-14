import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, space, typography } from "../theme/tokens";

/** Lightweight placeholder shell (prefer ScreenShell for real feature screens). */
export const FeatureScreen = ({ title, description }: { title: string; description: string }) => {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, padding: space.xl }} edges={["top", "bottom", "left", "right"]}>
      <Text style={{ ...typography.title, color: colors.text }}>{title}</Text>
      <View style={{ height: space.md }} />
      <Text style={{ color: colors.textMuted, lineHeight: 22 }}>{description}</Text>
    </SafeAreaView>
  );
};
