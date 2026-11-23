import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { BODY, C, HEAD } from './theme';
import { E, lerp, mulberry32, ramp, seg } from './motion';

/** The dark stage of direction A: near-black with a faint navy glow and a fixed star field. */
export const Stage: React.FC<{ seed?: number; glowX?: number; glowY?: number; children?: React.ReactNode }> = ({ seed = 7, glowX = 62, glowY = 40, children }) => {
  const r = mulberry32(seed);
  const stars = Array.from({ length: 220 }, () => ({ x: r() * 1920, y: r() * 1080, s: 0.5 + r() * 1.3, o: 0.15 + r() * 0.5 }));
  return (
    <AbsoluteFill style={{ background: `radial-gradient(1200px 800px at ${glowX}% ${glowY}%, ${C.navy} 0%, ${C.space} 70%)` }}>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#fff" opacity={s.o} />)}
      </svg>
      {children}
    </AbsoluteFill>
  );
};

/**
 * blur-slide (skill card typography/blur-slide, demo BlurSlide.tsx): words enter with y, blur and
 * opacity bound to ONE progress p on outCubic. Demo values are in its 480x270 design space;
 * dy and blur scale with font size here (dy = 1.18 em, blur = 0.29 em, the demo's 40/34 and 10/34).
 * Thai has no spaces between words, so callers pass the words pre-split (card: split by meaning, 3-5 spans).
 */
export const BlurLine: React.FC<{
  words: React.ReactNode[]; from: number; span?: number; gap?: number; size: number; style?: React.CSSProperties; sub?: boolean;
}> = ({ words, from, span = 64, gap, size, style, sub }) => {
  const f = useCurrentFrame();
  const tLine = seg(f, from, from + span);
  const g = gap ?? (sub ? 0.04 : words.length > 8 ? 0.035 : 0.055);
  const dy = (sub ? 0.93 : 40 / 34) * size; // sub: demo 26/14 em halved, it reads as a slide at 1080p
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 0, whiteSpace: 'pre', fontSize: size, ...style }}>
      {words.map((w, i) => {
        const p = seg(tLine, i * g, i * g + 0.32, E.outCubic);
        return (
          <span key={i} style={{ display: 'inline-block', opacity: p, transform: `translateY(${lerp(p, dy, 0)}px)`, filter: `blur(${(1 - p) * 0.29 * size}px)` }}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

/** Floating frame for a real, unaltered app capture on the dark stage. */
export const Frame: React.FC<{ x: number; y: number; w: number; h: number; turn?: number; children: React.ReactNode }> = ({ x, y, w, h, turn = 0, children }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, perspective: 2400 }}>
    <div style={{ width: w, height: h, borderRadius: 22, overflow: 'hidden', background: '#f5f2eb', transform: `rotateY(${turn}deg)`,
      boxShadow: '0 50px 100px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.10)' }}>
      {children}
    </div>
  </div>
);

/** Period number in the poster's style (.num: sun disc, dark numeral, glow ring) with the app's own tab text. */
export const PeriodTag: React.FC<{ n: number; label: string; title?: string; from?: number }> = ({ n, label, title, from = 0 }) => {
  const f = useCurrentFrame();
  const p = ramp(f, from, from + 14, 0, 1, E.outCubic);
  const labelOut = title ? 1 : ramp(f, from + 150, from + 165, 1, 0);
  return (
    <div style={{ position: 'absolute', left: 96, top: 64, display: 'flex', alignItems: 'center', gap: 26 }}>
      <div style={{ width: 96, height: 96, borderRadius: '50%', background: C.sun, color: '#1d1405', fontFamily: HEAD, fontWeight: 700,
        fontSize: 64, lineHeight: '96px', textAlign: 'center', boxShadow: '0 0 0 9px rgba(242,180,58,.22), 0 10px 30px rgba(0,0,0,.45)',
        transform: `scale(${lerp(p, 0.6, 1)})`, opacity: p }}>{n}</div>
      <div style={{ opacity: labelOut, textShadow: '0 2px 12px rgba(0,0,0,.6)' }}>
        <BlurLine words={label.split(/(?<= )/)} from={from + 6} span={40} size={34} style={{ fontFamily: HEAD, fontWeight: 500, color: C.sun, lineHeight: 1.15 }} />
        {title ? title.split('|').map((t, i) => <BlurLine key={i} words={[t]} from={from + 16 + i * 6} span={40} size={40} style={{ fontFamily: HEAD, fontWeight: 600, color: '#fff', lineHeight: 1.2 }} />) : null}
      </div>
    </div>
  );
};

/** Grey labelled placeholder for a team recording (no faces, no stock). */
export const Slate: React.FC<{ file: string; section: string; lines: string[] }> = ({ file, section, lines }) => (
  <AbsoluteFill style={{ background: '#2b2f35', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ position: 'absolute', inset: 40, border: '3px dashed rgba(255,255,255,.18)', borderRadius: 24 }} />
    <div style={{ textAlign: 'center', color: C.slateText, fontFamily: BODY }}>
      <div style={{ fontFamily: HEAD, fontWeight: 600, fontSize: 40, color: '#e2e6ea' }}>ช่องวิดีโอของทีม · {section}</div>
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 64, color: '#fff', margin: '18px 0 26px' }}>{file}</div>
      {lines.map((l, i) => <div key={i} style={{ fontSize: 34, lineHeight: 1.4 }}>{l}</div>)}
    </div>
  </AbsoluteFill>
);

/** Fullscreen still with a slow push (a flat PageCam move on an image that already fills the frame). */
export const Push: React.FC<{ src: string; from?: number; to: number; z0?: number; z1?: number; ox?: number; oy?: number; style?: React.CSSProperties }> = ({ src, from = 0, to, z0 = 1, z1 = 1.06, ox = 50, oy = 50, style }) => {
  const f = useCurrentFrame();
  const z = ramp(f, from, to, z0, z1, E.linear);
  return <Img src={staticFile(src)} style={{ position: 'absolute', inset: 0, width: 1920, height: 1080, objectFit: 'cover', transform: `scale(${z})`, transformOrigin: `${ox}% ${oy}%`, ...style }} />;
};
