import { StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors, radius, space } from "../../theme/tokens";
import { Text } from "../Text";

export const ProgressBar = ({
  value,
  max = 100,
  color = colors.brand,
  track = colors.gray200,
  height = 8,
  label,
  valueLabel,
}: {
  value: number;
  max?: number;
  color?: string;
  track?: string;
  height?: number;
  label?: string;
  valueLabel?: string;
}) => {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <View>
      {label || valueLabel ? (
        <View style={styles.labelRow}>
          {label ? (
            <Text variant="caption" weight="medium" color={colors.textSecondary} style={{ flex: 1 }}>
              {label}
            </Text>
          ) : null}
          {valueLabel ? (
            <Text variant="caption" weight="semibold" tabular>
              {valueLabel}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View style={[styles.track, { height, backgroundColor: track }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};

/** Ring gauge used for completion rate and average score summaries. */
export const ProgressRing = ({
  value,
  max = 100,
  size = 96,
  thickness = 9,
  color = colors.brand,
  caption,
}: {
  value: number;
  max?: number;
  size?: number;
  thickness?: number;
  color?: string;
  caption?: string;
}) => {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.gray200}
          strokeWidth={thickness}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text variant="h2" weight="bold" tabular>
          {Math.round(pct * 100)}%
        </Text>
        {caption ? (
          <Text variant="micro" color={colors.textMuted} center>
            {caption}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  labelRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  track: { borderRadius: radius.full, overflow: "hidden", width: "100%" },
  fill: { height: "100%", borderRadius: radius.full },
  ringCenter: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.sm,
  },
});
