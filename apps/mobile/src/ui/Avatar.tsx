import { useEffect, useState } from "react";
import { Image, StyleSheet, View, type ImageStyle, type ViewStyle } from "react-native";
import { colors, fonts, radius } from "../theme/tokens";
import { Text } from "./Text";

const initialsOf = (name?: string | null, letters = 1) => {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (letters === 1) return parts[0].charAt(0).toUpperCase();
  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join("")
    .toUpperCase();
};

export const Avatar = ({
  name,
  uri,
  size = 40,
  /** `onBrand` sits on the green sidebar; `brand` sits on a white surface. */
  tone = "brand",
  letters = 1,
  style,
}: {
  name?: string | null;
  uri?: string | null;
  size?: number;
  tone?: "brand" | "onBrand";
  letters?: 1 | 2;
  style?: ViewStyle;
}) => {
  const [failed, setFailed] = useState(false);
  const onBrand = tone === "onBrand";
  const showImage = !!uri && !failed;

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  const frame = {
    width: size,
    height: size,
    borderRadius: radius.full,
    backgroundColor: onBrand ? colors.onBrandActive : colors.brand,
    borderWidth: 2,
    borderColor: onBrand ? "rgba(255,255,255,0.28)" : colors.brandMute,
  } satisfies ViewStyle & ImageStyle;

  if (showImage) {
    return (
      <Image
        source={{ uri }}
        style={[frame, style as ImageStyle]}
        resizeMode="cover"
        onError={() => setFailed(true)}
        accessibilityIgnoresInvertColors
      />
    );
  }

  return (
    <View style={[frame, styles.center, style]}>
      <Text
        color={colors.white}
        style={{ fontSize: Math.round(size * 0.4), fontFamily: fonts.bold }}
      >
        {initialsOf(name, letters)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});
