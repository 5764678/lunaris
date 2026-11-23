// §1 cold open, 0:00-0:15 (450 f). Shots 1a-1c in timeline.json.
// The diagram is DIAGRAM_SVG, copied verbatim from poster.html (sha256 checked by scripts/extract-diagram.js).
// 1b adapts overhead-camera-moves · tilt-reveal (demo TiltReveal.tsx): same 43 f out-cubic move and the
// demo's <=3 deg overshoot pattern, run toward the tilt instead of away from it (the page lifts off).
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { DIAGRAM_SVG } from '../generated/diagram';
import { BlurLine, Stage } from '../Common';
import { C, HEAD } from '../theme';
import { E, ramp } from '../motion';

const TILT = 165; // 5.5 s
const MOVE = 43; // demo MOVE
const ov = { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };

export const ColdOpen: React.FC = () => {
  const f = useCurrentFrame();
  const inP = ramp(f, 0, 18, 0, 1, E.outCubic);
  const rotX = interpolate(f, [TILT, TILT + MOVE, TILT + MOVE + 4, TILT + MOVE + 8], [0, 30.6, 27.1, 28], ov);
  const rotY = interpolate(f, [TILT, TILT + MOVE, TILT + MOVE + 4, TILT + MOVE + 8], [0, -17.4, -15.6, -16], ov);
  const p = interpolate(f, [TILT, TILT + MOVE], [0, 1], ov);
  const z = 40 * p;
  const drift = ramp(f, TILT + MOVE, 450, 0, -18, E.linear); // slow recede after the lift
  const globe = ramp(f, 225, 300, 0, 1, E.outCubic);
  const globeZ = ramp(f, 225, 450, 0.94, 1.03, E.linear);
  const arrow = ramp(f, 262, 290, 0, 1, E.outCubic);
  const out = ramp(f, 438, 450, 1, 0, E.linear);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Stage seed={7} />
      <Img src={staticFile('globe.png')} style={{ position: 'absolute', left: 1010, top: 150, width: 760, height: 760, opacity: 0.88 * globe,
        transform: `translateY(${(1 - globe) * 60}px) scale(${globeZ})`, WebkitMaskImage: 'radial-gradient(circle at 50% 50%, #000 60%, transparent 72%)' }} />
      <div style={{ position: 'absolute', left: 150, top: 110, width: 780, height: 860, perspective: 1800, opacity: inP }}>
        <div style={{ width: 780, height: 850, background: C.paper, borderRadius: 16, padding: '26px 40px',
          transformOrigin: '50% 70%', transform: `translateY(${drift}px) rotateX(${rotX}deg) rotateY(${rotY}deg) rotateZ(-3deg) translateZ(${z}px)`,
          boxShadow: `0 ${30 + 30 * p}px ${60 + 30 * p}px rgba(0,0,0,.6), 0 0 0 1px rgba(0,0,0,.08)` }}>
          <p style={{ fontFamily: HEAD, fontWeight: 600, fontSize: 44, lineHeight: 1.1, color: '#2a2622', margin: '0 0 6px' }}>ในหนังสือเรียน · ภาพแบน 2 มิติ</p>
          {/* the verbatim string is injected unchanged; display size comes from a wrapper scale (790 -> 700) */}
          <div style={{ width: 700, height: 700, overflow: 'hidden' }}>
            <div style={{ width: 790, height: 790, transform: `scale(${700 / 790})`, transformOrigin: '0 0' }} dangerouslySetInnerHTML={{ __html: DIAGRAM_SVG }} />
          </div>
        </div>
      </div>
      <svg width={220} height={140} viewBox="0 0 300 170" style={{ position: 'absolute', left: 860, top: 520 }}>
        <path d="M 10 140 C 110 170, 220 130, 280 46" fill="none" stroke={C.sun} strokeWidth={10} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - arrow} />
        <path d="M 240 44 L 284 40 L 282 86" fill="none" stroke={C.sun} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" opacity={arrow > 0.95 ? 1 : 0} />
      </svg>
      <div style={{ position: 'absolute', left: 1000, top: 790, width: 860, fontFamily: HEAD, fontWeight: 600, color: '#fff', lineHeight: 1.12 }}>
        <BlurLine words={['หนังสือ', 'สอนระบบ ', <span style={{ color: C.sun }}>3 มิติ</span>]} from={30} size={66} />
        <BlurLine words={['ด้วยภาพแบน ', '2 มิติ']} from={52} size={66} />
      </div>
    </AbsoluteFill>
  );
};
