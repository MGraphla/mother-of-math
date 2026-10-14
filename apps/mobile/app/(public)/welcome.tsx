import { useEffect, useRef } from "react";
import { router } from "expo-router";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlipText } from "../../src/components/FlipText";
import { useLanguage } from "../../src/context/LanguageContext";
import { colors, fonts, layout, shadow } from "../../src/theme/tokens";

const mamaPortrait = require("../../assets/mama-math.png");

export default function WelcomeScreen() {
  const { t, language, setLanguage } = useLanguage();
  const { width, height } = useWindowDimensions();

  const hero = useRef(new Animated.Value(0)).current;
  const panel = useRef(new Animated.Value(0)).current;

  const mothersFor = t("home.heroTitle").toUpperCase();
  const mathematics = t("home.heroMath").toUpperCase();
  const compact = height < 720;
  const mathSize = Math.min(
    compact ? 38 : 46,
    Math.max(28, (width - 40) / Math.max(mathematics.length * 0.58, 8)),
  );
  const portraitW = width * 0.92;
  const portraitH = Math.min(height * 0.4, width * 0.92);

  useEffect(() => {
    Animated.stagger(80, [
      Animated.timing(hero, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(panel, {
        toValue: 1,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [hero, panel]);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.topBar}>
          <View />
          <View style={styles.langTrack}>
            {(["en", "fr"] as const).map((code) => {
              const active = language === code;
              return (
                <Pressable
                  key={code}
                  onPress={() => setLanguage(code)}
                  hitSlop={layout.hitSlop}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[styles.langChip, active && styles.langChipActive]}
                >
                  <RNText style={[styles.langText, active && styles.langTextActive]}>
                    {code.toUpperCase()}
                  </RNText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Animated.View
          style={[
            styles.hero,
            {
              opacity: hero,
              transform: [
                { translateY: hero.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
              ],
            },
          ]}
        >
          <View style={styles.portrait}>
            <Image
              source={mamaPortrait}
              style={{ width: portraitW, height: portraitH }}
              resizeMode="contain"
              accessibilityLabel="Mama Math"
            />
          </View>

          <RNText style={styles.mothersFor} numberOfLines={1} adjustsFontSizeToFit>
            {mothersFor}
          </RNText>
          <FlipText key={mathematics} fontSize={mathSize} duration={2.4} loop>
            {mathematics}
          </FlipText>
          <RNText style={styles.subtitle}>{t("home.heroSubtitle")}</RNText>
        </Animated.View>

        <Animated.View
          style={[
            styles.actionPanel,
            {
              opacity: panel,
              transform: [
                { translateY: panel.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
              ],
            },
          ]}
        >
          <View style={styles.ctaRow}>
            <Pressable
              onPress={() => router.push("/(auth)/sign-in")}
              style={({ pressed }) => [styles.ctaBtn, styles.ctaFill, pressed && styles.ctaPressed]}
              accessibilityRole="button"
            >
              <RNText style={styles.ctaFillLabel}>{t("nav.signIn")}</RNText>
            </Pressable>
            <Pressable
              onPress={() => router.push("/(auth)/sign-up")}
              style={({ pressed }) => [styles.ctaBtn, styles.ctaOutline, pressed && styles.ctaPressed]}
              accessibilityRole="button"
            >
              <RNText style={styles.ctaOutlineLabel}>{t("auth.signUp")}</RNText>
            </Pressable>
          </View>

          <Pressable
            onPress={() => router.push("/(auth)/student-login")}
            hitSlop={layout.hitSlop}
            style={({ pressed }) => [styles.studentLink, pressed && { opacity: 0.7 }]}
            accessibilityRole="link"
          >
            <RNText style={styles.studentLinkText}>{t("mobile.studentEmailLogin")}</RNText>
          </Pressable>
        </Animated.View>

        <View style={styles.spacer} />
      </SafeAreaView>

      <View style={styles.bottomBar}>
        <SafeAreaView edges={["bottom"]} style={styles.bottomBarInset} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  safe: {
    flex: 1,
    paddingHorizontal: 20,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 2,
    paddingBottom: 4,
  },
  langTrack: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    padding: 3,
    gap: 2,
  },
  langChip: {
    minWidth: 42,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  langChipActive: {
    backgroundColor: colors.white,
    ...shadow.xs,
  },
  langText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 0.6,
    color: colors.textMuted,
  },
  langTextActive: {
    color: colors.brandDark,
  },
  hero: {
    alignItems: "center",
    paddingTop: 4,
  },
  portrait: {
    width: "100%",
    alignItems: "center",
    marginBottom: 8,
  },
  mothersFor: {
    fontFamily: fonts.black,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: 1,
    color: colors.brand,
    textAlign: "center",
    marginBottom: 2,
    includeFontPadding: false,
    width: "100%",
  },
  subtitle: {
    marginTop: 14,
    paddingHorizontal: 8,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: "#111827",
    textAlign: "center",
    maxWidth: 340,
  },
  actionPanel: {
    alignSelf: "center",
    width: "100%",
    marginTop: 18,
    backgroundColor: colors.brand,
    borderRadius: 32,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 16,
  },
  ctaRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  ctaBtn: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaFill: {
    backgroundColor: colors.white,
  },
  ctaOutline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  ctaFillLabel: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.brandDeep,
  },
  ctaOutlineLabel: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.white,
  },
  ctaPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  studentLink: {
    marginTop: 14,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  studentLinkText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.white,
  },
  spacer: {
    flex: 1,
    minHeight: 16,
  },
  bottomBar: {
    backgroundColor: colors.brand,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
  },
  bottomBarInset: {
    minHeight: 16,
  },
});
