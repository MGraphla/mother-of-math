import { useEffect, useMemo } from "react";
import { StyleSheet, type TextStyle, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { fonts } from "../theme/tokens";

interface FlipTextProps {
  children: string;
  duration?: number;
  delay?: number;
  loop?: boolean;
  separator?: string;
  together?: boolean;
  fontSize?: number;
  colors?: readonly [string, string, string];
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const DEFAULT_COLORS = ["#009E3F", "#1DB954", "#F4B400"] as const;
const FLIP_EASE = Easing.bezier(0.4, 0.0, 0.2, 1);

const mixHex = (from: string, to: string, t: number) => {
  const a = parseInt(from.slice(1), 16);
  const b = parseInt(to.slice(1), 16);
  const ch = (shift: number) => {
    const av = (a >> shift) & 255;
    const bv = (b >> shift) & 255;
    return Math.round(av + (bv - av) * t);
  };
  const r = ch(16);
  const g = ch(8);
  const bl = ch(0);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
};

const colorAt = (t: number, stops: readonly [string, string, string]) => {
  if (t <= 0.46) return mixHex(stops[0], stops[1], t / 0.46);
  return mixHex(stops[1], stops[2], (t - 0.46) / 0.54);
};

const FlipChar = ({
  char,
  delay,
  duration,
  loop,
  fontSize,
  color,
  textStyle,
}: {
  char: string;
  delay: number;
  duration: number;
  loop: boolean;
  fontSize: number;
  color: string;
  textStyle?: TextStyle;
}) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    const totalMs = Math.max(900, duration * 1000);
    const flipMs = Math.round(totalMs * 0.38);
    const restMs = totalMs - flipMs;
    const startDelay = Math.max(0, delay * 1000);

    const cycle = withSequence(
      withTiming(1, { duration: flipMs, easing: FLIP_EASE }),
      withDelay(restMs, withTiming(0, { duration: 0 })),
    );

    progress.value = withDelay(startDelay, loop ? withRepeat(cycle, -1, false) : cycle);
  }, [progress, delay, duration, loop]);

  const animStyle = useAnimatedStyle(() => {
    const deg = interpolate(progress.value, [0, 0.12, 0.5, 0.88, 1], [0, 8, 180, 352, 360]);
    return {
      transform: [{ perspective: 1400 }, { rotateX: `${deg}deg` }],
    };
  });

  return (
    <Animated.View style={animStyle}>
      <Animated.Text
        style={[
          styles.char,
          textStyle,
          { fontSize, lineHeight: fontSize * 1.08, color },
        ]}
      >
        {char}
      </Animated.Text>
    </Animated.View>
  );
};

/**
 * Smooth character flip — same stagger as Vengeance FlipText:
 * delay = sin(i/n * π/2) * duration * 0.25
 */
export function FlipText({
  children,
  duration = 2.2,
  delay = 0,
  loop = true,
  separator = " ",
  together = false,
  fontSize = 42,
  colors: gradient = DEFAULT_COLORS,
  style,
  textStyle,
}: FlipTextProps) {
  const words = useMemo(() => children.split(separator), [children, separator]);
  const totalChars = Math.max(children.length, 1);

  const getCharIndex = (wordIndex: number, charIndex: number) => {
    let index = 0;
    for (let i = 0; i < wordIndex; i++) {
      index += words[i].length + (separator === " " ? 1 : separator.length);
    }
    return index + charIndex;
  };

  return (
    <Animated.View
      style={[styles.wrapper, style]}
      accessibilityRole="text"
      accessibilityLabel={children}
    >
      {words.map((word, wordIndex) => (
        <Animated.View key={`${word}-${wordIndex}`} style={styles.word}>
          {word.split("").map((char, charIndex) => {
            const currentGlobalIndex = getCharIndex(wordIndex, charIndex);
            const calculatedDelay = together
              ? delay
              : Math.sin((currentGlobalIndex / totalChars) * (Math.PI / 2)) * (duration * 0.25) + delay;
            const t = totalChars <= 1 ? 0 : currentGlobalIndex / (totalChars - 1);

            return (
              <FlipChar
                key={`${char}-${charIndex}`}
                char={char}
                delay={calculatedDelay}
                duration={duration}
                loop={loop}
                fontSize={fontSize}
                color={colorAt(t, gradient)}
                textStyle={textStyle}
              />
            );
          })}
        </Animated.View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 4,
  },
  word: {
    flexDirection: "row",
    alignItems: "center",
  },
  char: {
    fontFamily: fonts.black,
    letterSpacing: -1.6,
    includeFontPadding: false,
    textAlign: "center",
  },
});
