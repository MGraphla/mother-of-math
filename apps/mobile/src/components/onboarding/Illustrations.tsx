import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { colors, fonts } from "../../theme/tokens";

export interface IllustrationProps {
  size: number;
}

const Backdrop = () => (
  <>
    <Defs>
      <LinearGradient id="bd" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={colors.brandMute} stopOpacity={0.85} />
        <Stop offset="1" stopColor={colors.brandSoft} stopOpacity={0.35} />
      </LinearGradient>
    </Defs>
    <Circle cx={110} cy={100} r={92} fill="url(#bd)" />
    <Circle cx={188} cy={44} r={14} fill={colors.brand} opacity={0.18} />
    <Circle cx={26} cy={158} r={9} fill={colors.brand} opacity={0.22} />
  </>
);

/** Lesson-plan sheet with an AI spark, for the "AI co-pilot" slide. */
export const LessonPlanArt = ({ size }: IllustrationProps) => (
  <Svg width={size} height={size} viewBox="0 0 220 200">
    <Backdrop />
    <G>
      <Rect x={54} y={30} width={112} height={140} rx={14} fill={colors.white} opacity={0.6} />
      <Rect x={62} y={22} width={112} height={140} rx={14} fill={colors.white} />
      <Rect x={62} y={22} width={112} height={34} rx={14} fill={colors.brand} />
      <SvgText
        x={78}
        y={44}
        fill={colors.white}
        fontSize={13}
        fontFamily={fonts.bold}
      >
        Lesson plan
      </SvgText>
      {[72, 90, 108, 126].map((y, i) => (
        <Rect
          key={y}
          x={78}
          y={y}
          width={i % 2 === 0 ? 80 : 58}
          height={7}
          rx={3.5}
          fill={colors.gray200}
        />
      ))}
      <Rect x={78} y={140} width={44} height={12} rx={6} fill={colors.brandMute} />
    </G>
    <G>
      <Circle cx={168} cy={144} r={26} fill={colors.brand} />
      <Path
        d="M168 130l3.6 8.4 8.4 3.6-8.4 3.6-3.6 8.4-3.6-8.4-8.4-3.6 8.4-3.6z"
        fill={colors.white}
      />
    </G>
  </Svg>
);

/** Stacked submissions with a graded tick, for the "assign and grade" slide. */
export const GradingArt = ({ size }: IllustrationProps) => (
  <Svg width={size} height={size} viewBox="0 0 220 200">
    <Backdrop />
    <G>
      <Rect x={40} y={62} width={110} height={78} rx={14} fill={colors.white} opacity={0.55} />
      <Rect x={50} y={50} width={110} height={78} rx={14} fill={colors.white} opacity={0.8} />
      <Rect x={60} y={38} width={110} height={78} rx={14} fill={colors.white} />
      <SvgText x={76} y={64} fill={colors.text} fontSize={13} fontFamily={fonts.bold}>
        7 × 8 = 56
      </SvgText>
      <Rect x={76} y={76} width={62} height={7} rx={3.5} fill={colors.gray200} />
      <Rect x={76} y={90} width={40} height={7} rx={3.5} fill={colors.gray200} />
    </G>
    <G>
      <Circle cx={152} cy={132} r={30} fill={colors.brand} />
      <Path
        d="M138 132l9 9 18-19"
        stroke={colors.white}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </G>
    <SvgText x={44} y={176} fill={colors.brandDeep} fontSize={12} fontFamily={fonts.semibold}>
      Graded automatically
    </SvgText>
  </Svg>
);

/** Rising bars plus a trend line, for the "see every learner" slide. */
export const InsightsArt = ({ size }: IllustrationProps) => (
  <Svg width={size} height={size} viewBox="0 0 220 200">
    <Backdrop />
    <Rect x={44} y={40} width={140} height={124} rx={16} fill={colors.white} />
    {[
      { x: 62, h: 34 },
      { x: 88, h: 54 },
      { x: 114, h: 44 },
      { x: 140, h: 72 },
    ].map((bar) => (
      <Rect
        key={bar.x}
        x={bar.x}
        y={140 - bar.h}
        width={16}
        height={bar.h}
        rx={5}
        fill={colors.chartBar}
        opacity={0.9}
      />
    ))}
    <Path
      d="M70 100 L96 82 L122 90 L148 62"
      stroke={colors.brandDeep}
      strokeWidth={3}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray="5 5"
    />
    <Circle cx={148} cy={62} r={6} fill={colors.white} stroke={colors.brandDeep} strokeWidth={3} />
    <Rect x={62} y={148} width={54} height={7} rx={3.5} fill={colors.gray200} />
    <G>
      <Circle cx={176} cy={150} r={22} fill={colors.brand} />
      <Path
        d="M176 140v20M166 150h20"
        stroke={colors.white}
        strokeWidth={4}
        strokeLinecap="round"
      />
    </G>
  </Svg>
);
