// App shots for periods 2, 4 and 5. Every pixel inside a Frame is a real LUNARIS capture (scripts/capture.js);
// nothing is recoloured or redrawn. Camera moves follow PageCam's flat mode (skill assets/lib/PageCam.tsx):
// a page point (cx, cy) is held at the frame centre and scaled by zoom, eased with bezier(0.33,0,0.15,1).
import React, { useId } from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { BlurLine, Frame, Stage } from '../Common';
import { BODY, C, HEAD } from '../theme';
import { E, ramp } from '../motion';
import p5 from '../generated/p5-layout.json';

type Key = { f: number; cx: number; cy: number; z: number };
const camEase = Easing.bezier(0.33, 0, 0.15, 1);
const cam = (f: number, keys: Key[]) => {
  let a = keys[0], b = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) if (f >= keys[i].f && f <= keys[i + 1].f) { a = keys[i]; b = keys[i + 1]; break; }
  const t = a.f === b.f ? 1 : interpolate(f, [a.f, b.f], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: camEase });
  return { cx: a.cx + (b.cx - a.cx) * t, cy: a.cy + (b.cy - a.cy) * t, z: a.z + (b.z - a.z) * t };
};
/** A page image (CSS size pw x ph, 2x texture) viewed through a w x h window, with (cx, cy) at the centre. */
const PageView: React.FC<{ w: number; h: number; pw: number; ph: number; c: { cx: number; cy: number; z: number }; children: React.ReactNode }> = ({ w, h, pw, ph, c, children }) => (
  <div style={{ position: 'absolute', width: pw, height: ph, transformOrigin: '0 0', transform: `translate(${w / 2 - c.cx * c.z}px, ${h / 2 - c.cy * c.z}px) scale(${c.z})` }}>
    {children}
  </div>
);

// ---------- period 2: /learn/2, days 0..15 (0 % -> 100 %), slow push toward the Moon with % and slider kept in view
const P2_DAYS = 16;
export const P2: React.FC = () => {
  const f = useCurrentFrame();
  const W = 1240, H = 942; // frame; capture crop is 1000 x 760 CSS
  const base = W / 1000;
  const z = ramp(f, 0, 420, base, base * 1.12, E.linear);
  const c = { cx: ramp(f, 0, 420, 500, 445, E.linear), cy: ramp(f, 0, 420, 380, 352, E.linear), z }; // keeps % (y~25) and slider (y~660) in view
  const dayF = (d: number) => 24 + d * 19; // one day every 19 f from 0.8 s; full Moon (index 15) lands at 10.3 s
  const inP = ramp(f, 0, 16, 0, 1, E.outCubic);
  return (
    <AbsoluteFill>
      <Stage seed={11} />
      <div style={{ opacity: inP, transform: `translateY(${(1 - inP) * 30}px)` }}>
        <Frame x={600} y={69} w={W} h={H} turn={-4}>
          <PageView w={W} h={H} pw={1000} ph={760} c={c}>
            {Array.from({ length: P2_DAYS }, (_, d) => {
              const o = d === 0 ? 1 : ramp(f, dayF(d) - 6, dayF(d), 0, 1, E.linear);
              return o > 0 ? <Img key={d} src={staticFile(`captures/p2-day-${String(d).padStart(3, '0')}.png`)} style={{ position: 'absolute', left: 0, top: 0, width: 1000, height: 760, opacity: o }} /> : null;
            })}
          </PageView>
        </Frame>
      </div>
      <p style={{ position: 'absolute', left: 96, top: 210, width: 440, fontFamily: BODY, fontSize: 32, lineHeight: 1.35, color: C.cap }}>ภาพจาก LUNARIS<br />คำนวณจากข้อมูลนาซา</p>
    </AbsoluteFill>
  );
};

// ---------- period 4: real globe orbit (mouse-drag capture from /), then the /learn/4 sky chart
export const P4: React.FC<{ orbitFrames: number }> = ({ orbitFrames }) => {
  const f = useCurrentFrame();
  const ORBIT_END = 170;
  const idx = Math.min(orbitFrames - 1, Math.floor(ramp(f, 10, ORBIT_END, 0, orbitFrames - 1, E.inOutCubic)));
  const globeOut = ramp(f, 172, 190, 1, 0);
  const chartIn = ramp(f, 180, 200, 0, 1, E.outCubic);
  const W = 1560, H = 512; // chart crop is 976 x 320 CSS
  const base = W / 976;
  const c = { cx: ramp(f, 190, 480, 430, 560, E.linear), cy: 160, z: ramp(f, 190, 480, base * 1.0, base * 1.1, E.linear) };
  return (
    <AbsoluteFill>
      <Stage seed={17} glowX={50} glowY={45} />
      <AbsoluteFill style={{ opacity: globeOut }}>
        <Img src={staticFile(`captures/globe-orbit-${String(idx).padStart(3, '0')}.png`)} style={{ position: 'absolute', left: 0, top: 180, width: 1920, height: 720,
          WebkitMaskImage: 'radial-gradient(ellipse 34% 52% at 50% 50%, #000 70%, transparent 100%)', transform: `scale(${ramp(f, 0, 190, 1.0, 1.06, E.linear)})` }} />
      </AbsoluteFill>
      <div style={{ opacity: chartIn }}>
        <p style={{ position: 'absolute', left: 180, top: 196, fontFamily: HEAD, fontWeight: 600, fontSize: 48, color: '#fff' }}>แผนภูมิท้องฟ้า</p>
        <p style={{ position: 'absolute', left: 180, top: 264, fontFamily: BODY, fontSize: 34, color: C.soft }}>จุดยืน: ยอดเขาใกล้แชคเคิลตัน · หนึ่งรอบเดือน</p>
        <Frame x={180} y={336} w={W} h={H}>
          <PageView w={W} h={H} pw={976} ph={320} c={c}>
            <Img src={staticFile('captures/sky-chart.png')} style={{ position: 'absolute', width: 976, height: 320 }} />
          </PageView>
        </Frame>
        <div style={{ position: 'absolute', right: 180, top: 872, display: 'flex', gap: 44, fontFamily: BODY, fontSize: 34, color: C.cap }}>
          {[['ดวงอาทิตย์', C.sun], ['โลก', C.earth], ['ขอบฟ้าจริง (1 เดือน)', '#8b96a3']].map(([t, col]) => (
            <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 14 }}><i style={{ width: 20, height: 20, borderRadius: 10, background: col, display: 'inline-block' }} />{t}</span>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- period 5: /learn/5 full page; tap 88.3 % (speed-ramp-freeze · freeze-annotate), evidence opens
// freeze-annotate (demo FreezeAnnotateReal.tsx): circle 8 f stroke-dashoffset with feTurbulence scale 7, arrow 6 f, 8 f fade.
const TAP = 120; // 106.0 s
export const P5: React.FC = () => {
  const f = useCurrentFrame();
  const roughId = `rough-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const W = 1240, H = 942;
  const t = p5.target; const tx = t.x + t.w / 2, ty = t.y + t.h / 2;
  const evY = p5.evidence.y;
  const keys: Key[] = [
    { f: 0, cx: 1030, cy: p5.table.y + 300, z: 1.1 },
    { f: 100, cx: 1090, cy: p5.table.y + 290, z: 1.2 },
    { f: 150, cx: 1090, cy: p5.table.y + 290, z: 1.2 }, // freeze: camera holds
    { f: 225, cx: 1080, cy: evY - 20, z: 1.26 },
    { f: 360, cx: 1080, cy: evY - 20, z: 1.26 },
    { f: 440, cx: 1080, cy: p5.table.y + 330, z: 1.12 },
  ];
  const c = cam(f, keys);
  const sx = (x: number) => W / 2 + (x - c.cx) * c.z, sy = (y: number) => H / 2 + (y - c.cy) * c.z;
  const after = f >= TAP + 2;
  const cur = ramp(f, 92, TAP - 4, 0, 1, Easing.bezier(0.25, 0.8, 0.25, 1));
  const curX = sx(tx) + (1 - cur) * 260, curY = sy(ty) + (1 - cur) * 220;
  const press = f >= TAP - 2 && f < TAP + 4 ? 0.88 : 1;
  const draw = ramp(f, TAP + 4, TAP + 12, 0, 1, E.linear);
  const arrowDraw = ramp(f, TAP + 12, TAP + 18, 0, 1, E.linear);
  const fade = ramp(f, TAP + 52, TAP + 60, 1, 0, E.linear);
  const curFade = ramp(f, TAP + 30, TAP + 40, 1, 0, E.linear);
  const inP = ramp(f, 0, 16, 0, 1, E.outCubic);
  const Circ = 760;
  return (
    <AbsoluteFill>
      <Stage seed={29} />
      <div style={{ opacity: inP, transform: `translateY(${(1 - inP) * 30}px)` }}>
        <Frame x={600} y={69} w={W} h={H} turn={-4}>
          <PageView w={W} h={H} pw={p5.pageW} ph={p5.pageH} c={c}>
            <Img src={staticFile(after ? 'captures/p5-page-after.png' : 'captures/p5-page-before.png')} style={{ position: 'absolute', width: p5.pageW, height: p5.pageH }} />
          </PageView>
          <svg width={W} height={H} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: fade }}>
            <defs><filter id={roughId}><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves={2} seed={7} result="n" /><feDisplacementMap in="SourceGraphic" in2="n" scale={7} /></filter></defs>
            <ellipse cx={sx(tx)} cy={sy(ty)} rx={95} ry={60} fill="none" stroke={C.rust} strokeWidth={8} strokeLinecap="round"
              strokeDasharray={Circ} strokeDashoffset={Circ * (1 - draw)} transform={`rotate(-6 ${sx(tx)} ${sy(ty)})`} filter={`url(#${roughId})`} />
            <path d={`M ${sx(tx) + 250} ${sy(ty) - 190} Q ${sx(tx) + 170} ${sy(ty) - 150} ${sx(tx) + 105} ${sy(ty) - 70}`} fill="none" stroke={C.rust} strokeWidth={8}
              strokeLinecap="round" strokeDasharray={300} strokeDashoffset={300 * (1 - arrowDraw)} filter={`url(#${roughId})`} />
          </svg>
          {f >= 92 ? (
            <svg width={44} height={56} viewBox="0 0 22 28" style={{ position: 'absolute', left: curX - 4, top: curY - 2, opacity: curFade, transform: `scale(${press})`, transformOrigin: '4px 2px' }}>
              <path d="M2 2 L2 22 L7.5 17 L11 25.5 L14.5 24 L11 15.8 L18.5 15.8 Z" fill="#fff" stroke="#1c1a17" strokeWidth={1.6} strokeLinejoin="round" />
            </svg>
          ) : null}
        </Frame>
      </div>
      <p style={{ position: 'absolute', left: 96, top: 210, width: 440, fontFamily: BODY, fontSize: 32, lineHeight: 1.35, color: C.cap }}>ภาพจาก LUNARIS<br />กดที่ตัวเลขเพื่อดูหลักฐาน</p>
    </AbsoluteFill>
  );
};
