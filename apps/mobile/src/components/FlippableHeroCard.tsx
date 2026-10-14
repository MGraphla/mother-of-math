import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Award, BookOpen, Globe, Target } from "lucide-react-native";
import { useLanguage } from "../context/LanguageContext";
import { colors, fonts, radius, shadow } from "../theme/tokens";
import { Text } from "../ui";

const heroImage = require("../../assets/teacher-students.png");

/**
 * Mobile port of the website hero FlippableImageCard.
 * Uses a scaleX flip (not rotateY) — rotateY + backfaceVisibility is unreliable on Android.
 */
export function FlippableHeroCard() {
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const flip = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;

  const cardWidth = Math.min(width - 48, 340);
  const cardHeight = Math.round(cardWidth * 0.78);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2750,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2750,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  const runFlip = () => {
    if (busy) return;
    setBusy(true);
    const next = !flipped;

    // Collapse to edge → swap face → open again (reads as a card flip).
    Animated.timing(flip, {
      toValue: 1,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        setBusy(false);
        return;
      }
      setFlipped(next);
      flip.setValue(1);
      Animated.timing(flip, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setBusy(false));
    });
  };

  const scaleX = flip.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.02],
  });

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          width: cardWidth,
          height: cardHeight,
          transform: [
            {
              translateY: float.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -8],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.glow} pointerEvents="none" />

      <Pressable
        onPress={runFlip}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={flipped ? t("mobile.flipBack") : t("mobile.flipHint")}
        style={[styles.press, { width: cardWidth, height: cardHeight }]}
      >
        <Animated.View
          style={[
            styles.card,
            { width: cardWidth, height: cardHeight, transform: [{ scaleX }] },
          ]}
        >
          {!flipped ? (
            <View style={[styles.face, { width: cardWidth, height: cardHeight }]}>
              <Image source={heroImage} style={styles.image} resizeMode="contain" />
              <View style={styles.hintPill}>
                <Text style={styles.hintText} color={colors.white} weight="semibold">
                  {t("mobile.flipHint")}
                </Text>
              </View>
            </View>
          ) : (
            <LinearGradient
              colors={[colors.brand, colors.brandDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.face, styles.backFace, { width: cardWidth, height: cardHeight }]}
            >
              <View style={styles.backBorder}>
                <View style={styles.backHeader}>
                  <Globe size={18} color={colors.amber} />
                  <Text
                    style={styles.backTitle}
                    color={colors.white}
                    weight="bold"
                    numberOfLines={2}
                  >
                    {t("mobile.flipLessonTitle")}
                  </Text>
                </View>
                <Text
                  style={styles.backDesc}
                  color="rgba(255,255,255,0.88)"
                  numberOfLines={2}
                >
                  {t("mobile.flipLessonDesc")}
                </Text>

                <View style={styles.row}>
                  <BookOpen size={15} color={colors.white} />
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowLabel} color={colors.white} weight="semibold">
                      {t("mobile.flipTopic")}
                    </Text>
                    <Text
                      style={styles.rowBody}
                      color="rgba(255,255,255,0.78)"
                      numberOfLines={1}
                    >
                      {t("mobile.flipTopicBody")}
                    </Text>
                  </View>
                </View>
                <View style={styles.row}>
                  <Target size={15} color={colors.white} />
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowLabel} color={colors.white} weight="semibold">
                      {t("mobile.flipObjective")}
                    </Text>
                    <Text
                      style={styles.rowBody}
                      color="rgba(255,255,255,0.78)"
                      numberOfLines={2}
                    >
                      {t("mobile.flipObjectiveBody")}
                    </Text>
                  </View>
                </View>
                <View style={styles.row}>
                  <Award size={15} color={colors.white} />
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowLabel} color={colors.white} weight="semibold">
                      {t("mobile.flipSkill")}
                    </Text>
                    <Text
                      style={styles.rowBody}
                      color="rgba(255,255,255,0.78)"
                      numberOfLines={2}
                    >
                      {t("mobile.flipSkillBody")}
                    </Text>
                  </View>
                </View>

                <Text style={styles.flipAgain} color={colors.amber} weight="semibold" center>
                  {t("mobile.flipBack")}
                </Text>
              </View>
            </LinearGradient>
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "center",
    marginTop: 18,
  },
  glow: {
    ...StyleSheet.absoluteFill,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.18)",
    transform: [{ scale: 0.92 }],
  },
  press: {
    borderRadius: 22,
  },
  card: {
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: colors.white,
    ...shadow.card,
  },
  face: {
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  backFace: {
    padding: 12,
    alignItems: "stretch",
    justifyContent: "flex-start",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  hintPill: {
    position: "absolute",
    right: 10,
    bottom: 10,
    backgroundColor: "rgba(0,0,0,0.58)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  hintText: {
    fontSize: 11,
  },
  backBorder: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.28)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  backTitle: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
  },
  backDesc: {
    fontSize: 11.5,
    lineHeight: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 6,
  },
  rowCopy: { flex: 1 },
  rowLabel: {
    fontSize: 11.5,
  },
  rowBody: {
    fontSize: 11,
    lineHeight: 15,
  },
  flipAgain: {
    marginTop: 10,
    fontSize: 12,
  },
});
