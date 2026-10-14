import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { G, Line, Rect, Text as SvgText } from "react-native-svg";
import { useLanguage } from "../../context/LanguageContext";
import { colors, fonts, radius, space } from "../../theme/tokens";
import { Text } from "../Text";

export interface BarDatum {
  label: string;
  value: number;
}

/**
 * Vertical bar chart matching the web's recharts config: dashed horizontal grid,
 * axis labels without axis lines, rounded bar tops, and a 0-100 percent domain.
 * Tapping a bar reveals its value, standing in for the web hover tooltip.
 */
export const BarChart = ({
  data,
  height = 220,
  max = 100,
  suffix = "%",
  color = colors.chartBar,
  ticks = [0, 25, 50, 75, 100],
}: {
  data: BarDatum[];
  height?: number;
  max?: number;
  suffix?: string;
  color?: string;
  ticks?: number[];
}) => {
  const { t } = useLanguage();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  const padLeft = 34;
  const padRight = 6;
  const padTop = 10;
  const padBottom = 24;
  const plotW = Math.max(0, width - padLeft - padRight);
  const plotH = Math.max(0, height - padTop - padBottom);

  const slot = data.length > 0 ? plotW / data.length : 0;
  const barW = Math.min(44, Math.max(10, slot * 0.55));
  const yOf = (v: number) => padTop + plotH - (Math.max(0, Math.min(max, v)) / max) * plotH;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <View style={{ height }}>
          <Svg width={width} height={height}>
            {ticks.map((tick) => {
              const y = yOf(tick);
              return (
                <G key={tick}>
                  <Line
                    x1={padLeft}
                    y1={y}
                    x2={width - padRight}
                    y2={y}
                    stroke={colors.border}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                  <SvgText
                    x={padLeft - 7}
                    y={y + 4}
                    fill={colors.textFaint}
                    fontSize={10}
                    fontFamily={fonts.medium}
                    textAnchor="end"
                  >
                    {`${tick}${suffix}`}
                  </SvgText>
                </G>
              );
            })}

            {data.map((d, i) => {
              const cx = padLeft + slot * i + slot / 2;
              const y = yOf(d.value);
              const h = Math.max(d.value > 0 ? 3 : 0, padTop + plotH - y);
              return (
                <G key={`${d.label}-${i}`}>
                  {active === i ? (
                    <Rect
                      x={padLeft + slot * i}
                      y={padTop}
                      width={slot}
                      height={plotH}
                      fill="rgba(34,197,94,0.10)"
                    />
                  ) : null}
                  <Rect
                    x={cx - barW / 2}
                    y={y}
                    width={barW}
                    height={h}
                    rx={4}
                    ry={4}
                    fill={color}
                    opacity={active === null || active === i ? 1 : 0.45}
                  />
                  <SvgText
                    x={cx}
                    y={height - 7}
                    fill={colors.textMuted}
                    fontSize={10}
                    fontFamily={fonts.medium}
                    textAnchor="middle"
                  >
                    {d.label}
                  </SvgText>
                </G>
              );
            })}
          </Svg>

          {/* Transparent hit targets sit above the SVG so taps map to a column. */}
          <View style={[styles.hitLayer, { left: padLeft, right: padRight, bottom: padBottom }]}>
            {data.map((d, i) => (
              <Pressable
                key={`hit-${d.label}-${i}`}
                style={styles.hit}
                onPress={() => setActive((cur) => (cur === i ? null : i))}
                accessibilityRole="button"
                accessibilityLabel={`${d.label}: ${d.value}${suffix}`}
              />
            ))}
          </View>
        </View>
      ) : (
        <View style={{ height }} />
      )}

      {active !== null && data[active] ? (
        <View style={styles.tooltip}>
          <Text variant="micro" weight="semibold" color={colors.white}>
            {`${data[active].label} · ${data[active].value}${suffix}`}
          </Text>
        </View>
      ) : (
        <Text variant="micro" color={colors.textFaint} center style={{ marginTop: space.sm }}>
          {t("chart.tapBar")}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  hitLayer: { position: "absolute", top: 0, flexDirection: "row" },
  hit: { flex: 1 },
  tooltip: {
    alignSelf: "center",
    marginTop: space.sm,
    backgroundColor: colors.gray900,
    paddingHorizontal: space.md,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
});
