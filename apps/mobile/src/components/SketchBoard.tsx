import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { colors, radius } from "../theme/tokens";

type Point = { x: number; y: number };
type Stroke = { color: string; points: Point[] };

const toPath = (points: Point[]) => {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  return `M ${first.x} ${first.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(" ")}`;
};

export type SketchBoardHandle = {
  hasStrokes: () => boolean;
  capturePng: () => Promise<string | null>;
};

/**
 * Lightweight freehand board matching the web Generate Images sketch canvas.
 * Captures a PNG of the drawing so generation follows the sketch, not a made-up scene.
 */
export const SketchBoard = forwardRef<
  SketchBoardHandle,
  { color: string; height?: number }
>(function SketchBoard({ color, height = 220 }, ref) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const strokesRef = useRef<Stroke[]>([]);
  const drawing = useRef(false);
  const colorRef = useRef(color);
  const svgRef = useRef<Svg>(null);
  colorRef.current = color;

  const setStrokesBoth = useCallback((updater: (prev: Stroke[]) => Stroke[]) => {
    setStrokes((prev) => {
      const next = updater(prev);
      strokesRef.current = next;
      return next;
    });
  }, []);

  const appendPoint = useCallback((x: number, y: number) => {
    setStrokesBoth((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const last = { ...next[next.length - 1], points: [...next[next.length - 1].points, { x, y }] };
      next[next.length - 1] = last;
      return next;
    });
  }, [setStrokesBoth]);

  useImperativeHandle(ref, () => ({
    hasStrokes: () =>
      strokesRef.current.some((s) => s.color !== "#ffffff" && s.points.length > 1),
    capturePng: () =>
      new Promise((resolve) => {
        const svg = svgRef.current as (Svg & { toDataURL?: (cb: (data: string) => void) => void }) | null;
        if (!svg?.toDataURL) {
          resolve(null);
          return;
        }
        svg.toDataURL((data: string) => {
          if (!data) {
            resolve(null);
            return;
          }
          resolve(data.startsWith("data:") ? data : `data:image/png;base64,${data}`);
        });
      }),
  }));

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        drawing.current = true;
        const { locationX: x, locationY: y } = e.nativeEvent;
        setStrokesBoth((prev) => [...prev, { color: colorRef.current, points: [{ x, y }] }]);
      },
      onPanResponderMove: (e) => {
        if (!drawing.current) return;
        const { locationX: x, locationY: y } = e.nativeEvent;
        appendPoint(x, y);
      },
      onPanResponderRelease: () => {
        drawing.current = false;
      },
      onPanResponderTerminate: () => {
        drawing.current = false;
      },
    }),
  ).current;

  const [size, setSize] = useState({ width: 1, height });

  return (
    <View
      style={[styles.board, { height }]}
      onLayout={(e) => {
        const { width, height: h } = e.nativeEvent.layout;
        if (width > 0 && h > 0) setSize({ width, height: h });
      }}
      {...pan.panHandlers}
    >
      <Svg ref={svgRef} width={size.width} height={size.height}>
        <Rect x={0} y={0} width={size.width} height={size.height} fill={colors.white} />
        {strokes.map((stroke, i) => (
          <Path
            key={i}
            d={toPath(stroke.points)}
            stroke={stroke.color}
            strokeWidth={stroke.color === "#ffffff" ? 16 : 3}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  board: {
    width: "100%",
    backgroundColor: colors.white,
    borderRadius: radius.md,
    overflow: "hidden",
  },
});
