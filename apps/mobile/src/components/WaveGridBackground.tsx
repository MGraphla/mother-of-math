import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import { colors } from "../theme/tokens";

/**
 * White liquid swell for auth screens.
 */
const VERT = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uResolution;
uniform vec4 uR0;
uniform vec4 uR1;
uniform vec4 uR2;
uniform vec4 uR3;
uniform vec4 uR4;
uniform vec4 uR5;
uniform vec3 uPaper;
uniform vec3 uMist;
uniform vec3 uFold;
uniform vec3 uCrest;
uniform float uWaveMix;
uniform float uAmp;
uniform float uSpeed;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  v += a * noise(p); p = p * 2.07 + 1.7; a *= 0.5;
  v += a * noise(p); p = p * 2.03 + 3.1; a *= 0.5;
  v += a * noise(p); p = p * 2.11 + 5.9; a *= 0.5;
  v += a * noise(p);
  return v;
}

float swell(vec2 p, float t) {
  float h = 0.0;
  h += 0.52 * sin(dot(p, vec2( 0.92,  0.28)) * 3.55 + t * 0.86);
  h += 0.38 * sin(dot(p, vec2(-0.55,  0.82)) * 2.85 - t * 0.70);
  h += 0.28 * sin(dot(p, vec2( 0.22, -0.97)) * 4.70 + t * 1.12);
  h += 0.18 * sin(dot(p, vec2(-0.88, -0.40)) * 6.10 - t * 1.28);
  h += 0.12 * sin(dot(p, vec2( 0.70,  0.70)) * 7.40 + t * 0.52);
  return h;
}

float ripple(vec2 p, vec4 r) {
  if (r.w < 0.008) return 0.0;
  float dist = length(p - r.xy);
  float age = r.z;
  float radius = 0.24 * age;
  float width = 0.046 + age * 0.018;
  float rel = dist - radius;
  float envelope = exp(-(rel * rel) / (width * width));
  float fade = exp(-age / 3.6);
  float atten = 1.0 / (1.0 + dist * 1.15);
  return fade * envelope * atten * r.w * cos(9.5 * rel);
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.42);
  float t = uTime * uSpeed;

  vec2 flow = vec2(t * 0.062, t * 0.040);
  float n1 = fbm(p * 1.85 + flow);
  float n2 = fbm(p * 2.20 - flow.yx + n1 * 2.15);
  vec2 warp = (vec2(n1, n2) - 0.5) * (0.38 * uAmp);
  vec2 wp = p + warp;

  float h = swell(wp, t) * uAmp;
  h += (n2 - 0.48) * 0.42 * uAmp;
  h += ripple(uv, uR0) * uAmp;
  h += ripple(uv, uR1) * uAmp;
  h += ripple(uv, uR2) * uAmp;
  h += ripple(uv, uR3) * uAmp;
  h += ripple(uv, uR4) * uAmp;
  h += ripple(uv, uR5) * uAmp;

  float e = 0.016;
  float hx = swell(wp + vec2(e, 0.0), t) - swell(wp - vec2(e, 0.0), t);
  float hy = swell(wp + vec2(0.0, e), t) - swell(wp - vec2(0.0, e), t);
  vec3 N = normalize(vec3(-hx * 10.0 * uAmp, 1.0, -hy * 10.0 * uAmp));
  vec3 L = normalize(vec3(-0.32, 0.88, 0.38));
  vec3 V = vec3(0.0, 1.0, 0.0);
  float ndl = clamp(dot(N, L), 0.0, 1.0);
  float spec = pow(clamp(dot(N, normalize(L + V)), 0.0, 1.0), 40.0);
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.2);

  float trough = smoothstep(0.06, -0.30, h);

  vec3 col = uPaper;
  float shade = trough * 0.08 + (1.0 - ndl) * 0.055;
  col -= vec3(shade);
  col += vec3(1.0) * spec * 0.42;
  col += vec3(1.0) * fres * 0.10;

  gl_FragColor = vec4(col, 1.0);
}
`;

type Ripple = { x: number; y: number; age: number; amp: number };

const PALETTES = {
  paper: {
    paper: [1, 1, 1] as [number, number, number],
    mist: [1, 1, 1] as [number, number, number],
    fold: [1, 1, 1] as [number, number, number],
    crest: [1, 1, 1] as [number, number, number],
    waveMix: 0,
    amp: 1.85,
    speed: 1.45,
  },
  brand: {
    paper: [1, 1, 1] as [number, number, number],
    mist: [1, 1, 1] as [number, number, number],
    fold: [1, 1, 1] as [number, number, number],
    crest: [1, 1, 1] as [number, number, number],
    waveMix: 0,
    amp: 1.85,
    speed: 1.45,
  },
};

const compile = (gl: ExpoWebGLRenderingContext, type: number, src: string) => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create shader");
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(log || "Shader compile failed");
  }
  return shader;
};

export function WaveGridBackground({
  style,
  tone = "paper",
}: {
  style?: ViewStyle;
  tone?: "paper" | "brand";
}) {
  const raf = useRef<number | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, []);

  const onContextCreate = useCallback(
    (gl: ExpoWebGLRenderingContext) => {
      let program: WebGLProgram | null = null;
      try {
        const vert = compile(gl, gl.VERTEX_SHADER, VERT);
        const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG);
        program = gl.createProgram();
        if (!program) return;
        gl.attachShader(program, vert);
        gl.attachShader(program, frag);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
      } catch {
        return;
      }
      if (!program) return;
      gl.useProgram(program);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(program, "aPosition");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      const uTime = gl.getUniformLocation(program, "uTime");
      const uRes = gl.getUniformLocation(program, "uResolution");
      const uPaper = gl.getUniformLocation(program, "uPaper");
      const uMist = gl.getUniformLocation(program, "uMist");
      const uFold = gl.getUniformLocation(program, "uFold");
      const uCrest = gl.getUniformLocation(program, "uCrest");
      const uWaveMix = gl.getUniformLocation(program, "uWaveMix");
      const uAmp = gl.getUniformLocation(program, "uAmp");
      const uSpeed = gl.getUniformLocation(program, "uSpeed");
      const uR = [
        gl.getUniformLocation(program, "uR0"),
        gl.getUniformLocation(program, "uR1"),
        gl.getUniformLocation(program, "uR2"),
        gl.getUniformLocation(program, "uR3"),
        gl.getUniformLocation(program, "uR4"),
        gl.getUniformLocation(program, "uR5"),
      ];

      const palette = PALETTES[tone];
      gl.uniform3f(uPaper, ...palette.paper);
      gl.uniform3f(uMist, ...palette.mist);
      gl.uniform3f(uFold, ...palette.fold);
      gl.uniform3f(uCrest, ...palette.crest);
      gl.uniform1f(uWaveMix, palette.waveMix);
      gl.uniform1f(uAmp, palette.amp);
      gl.uniform1f(uSpeed, palette.speed);

      const ripples: Ripple[] = [
        { x: 0.22, y: 0.68, age: 0.2, amp: 1.0 },
        { x: 0.78, y: 0.34, age: 1.0, amp: 0.88 },
        { x: 0.46, y: 0.18, age: 1.9, amp: 0.76 },
        { x: 0.62, y: 0.82, age: 0.7, amp: 0.92 },
        { x: 0.14, y: 0.42, age: 2.6, amp: 0.7 },
        { x: 0.88, y: 0.58, age: 1.5, amp: 0.8 },
      ];
      let spawn = 0.4;
      const start = Date.now();
      let last = start;

      const draw = () => {
        if (!alive.current) return;
        const now = Date.now();
        const dt = Math.min(0.033, (now - last) / 1000);
        last = now;
        const t = (now - start) / 1000;

        spawn += dt;
        if (spawn >= 0.52) {
          spawn = 0;
          const oldest = ripples.reduce((a, b) => (a.age > b.age ? a : b));
          oldest.x = 0.08 + Math.random() * 0.84;
          oldest.y = 0.10 + Math.random() * 0.80;
          oldest.age = 0;
          oldest.amp = 1.05 + Math.random() * 0.55;
        }
        for (const r of ripples) r.age += dt;

        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.uniform1f(uTime, t);
        gl.uniform2f(uRes, gl.drawingBufferWidth, gl.drawingBufferHeight);
        ripples.forEach((r, i) => gl.uniform4f(uR[i], r.x, r.y, r.age, r.amp));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.endFrameEXP();
        raf.current = requestAnimationFrame(draw);
      };

      draw();
    },
    [tone],
  );

  return (
    <View style={[styles.wrap, style]} pointerEvents="none">
      <View style={styles.fallback} />
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} msaaSamples={4} />
    </View>
  );
}

const fill = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

const styles = StyleSheet.create({
  wrap: {
    ...fill,
    overflow: "hidden",
    backgroundColor: colors.white,
  },
  fallback: {
    ...fill,
    backgroundColor: colors.white,
  },
});
