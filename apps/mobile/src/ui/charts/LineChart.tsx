import { useState } from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";
import { colors, fonts } from "../../theme/tokens";

export interface LinePoint {
  label: string;
  value: number;
}

const buildPath = (pts: { x: number; y: number }[]) =>
  pts.reduce((acc, p, i) => `${acc}${i === 0 ? "M" : "L"}${p.x} ${p.y} `, "").trim();

/** Area + line trend chart for score history, with a soft brand-green fill. */
export const LineChart = ({
  data,
  height = 200,
  max = 100,
  suffix = "%",
  color = colors.brand,
  ticks = [0, 50, 100],
}: {
  data: LinePoint[];
  height?: number;
  max?: number;
  suffix?: string;
  color?: string;
  ticks?: number[];
}) => {
  const [width, setWidth] = useState(0);

  const padLeft = 34;
  const padRight = 10;
  const padTop = 12;
  const padBottom = 24;
  const plotW = Math.max(0, width - padLeft - padRight);
  const plotH = Math.max(0, height - padTop - padBottom);

  const yOf = (v: number) => padTop + plotH - (Math.max(0, Math.min(max, v)) / max) * plotH;
  const xOf = (i: number) =>
    data.length <= 1 ? padLeft + plotW / 2 : padLeft + (plotW / (data.length - 1)) * i;

  const points = data.map((d, i) => ({ x: xOf(i), y: yOf(d.value) }));
  const linePath = buildPath(points);
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${padTop + plotH} L ${points[0].x} ${padTop + plotH} Z`
      : "";

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.22} />
              <Stop offset="1" stopColor={color} stopOpacity={0.02} />
            </LinearGradient>
          </Defs>

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

          {areaPath ? <Path d={areaPath} fill="url(#lineFill)" /> : null}
          {linePath ? (
            <Path
              d={linePath}
              stroke={color}
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {points.map((p, i) => (
            <G key={`pt-${i}`}>
              <Circle cx={p.x} cy={p.y} r={4} fill={colors.white} stroke={color} strokeWidth={2.5} />
              <SvgText
                x={p.x}
                y={height - 7}
                fill={colors.textMuted}
                fontSize={10}
                fontFamily={fonts.medium}
                textAnchor="middle"
              >
                {data[i].label}
              </SvgText>
            </G>
          ))}
        </Svg>
      ) : null}
    </View>
  );
};
