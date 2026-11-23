// Graphics that replace the team's live-action slots (TD, 23 Nov): P1 lamp-ball model, P3 worksheet, P6 CER + poster.
// Made only from the project's own material: the poster's period-1 drawing style and colours, the kit's worksheet-1.md,
// the poster's C/E/R list and the poster preview.
import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { BlurLine, Frame, Stage } from '../Common';
import { BODY, C, HEAD } from '../theme';
import { E, mulberry32, ramp } from '../motion';
import ws from '../generated/worksheet-layout.json';

// ---------- P1: lamp-ball model (8 s). Top view in the poster's period-1 style, plus the observer's view.
// Geometry: the ball's lit hemisphere faces the lamp (vector ball -> lamp, finite distance). The observer's view uses the
// phase angle alpha between (ball -> lamp) and (ball -> head): lit fraction (1 + cos alpha) / 2; the lit limb is on the
// observer's right when the lamp lies to the right of the line of sight.
const S = 2.2; // poster svg units -> px
const HEAD_X = 1000, HEAD_Y = 490;
const LAMP_X = HEAD_X - 330 * S, LAMP_Y = HEAD_Y;
const ORBIT = 110 * S, BALL = 30 * S;
const MOON_LIT = '#e9edf2', MOON_DARK = '#2b313a', HEAD_COL = '#cfe0ff', ORBIT_COL = '#8b96a3';

/** Lit region of a disc of radius r seen by the observer: limb on side s (+1 right, -1 left), terminator x = -s cos(alpha) w(y). */
const phasePath = (r: number, cosA: number, s: number) => {
  const N = 48, pts: string[] = [];
  for (let i = 0; i <= N; i++) { const y = -r + (2 * r * i) / N; const w = Math.sqrt(Math.max(0, r * r - y * y)); pts.push(`${(s * w).toFixed(2)},${y.toFixed(2)}`); }
  for (let i = N; i >= 0; i--) { const y = -r + (2 * r * i) / N; const w = Math.sqrt(Math.max(0, r * r - y * y)); pts.push(`${(-s * cosA * w).toFixed(2)},${y.toFixed(2)}`); }
  return `M ${pts.join(' L ')} Z`;
};

export const LampBall: React.FC = () => {
  const f = useCurrentFrame();
  const inP = ramp(f, 0, 15, 0, 1, E.outCubic);
  // one orbit, counter-clockwise on screen, starting between lamp and head (new moon)
  const theta = (ramp(f, 15, 228, 180, -180, E.linear) * Math.PI) / 180;
  const mx = HEAD_X + ORBIT * Math.cos(theta), my = HEAD_Y + ORBIT * Math.sin(theta);
  const toLamp = { x: LAMP_X - mx, y: LAMP_Y - my }, toHead = { x: HEAD_X - mx, y: HEAD_Y - my };
  const n = (v: { x: number; y: number }) => { const l = Math.hypot(v.x, v.y); return { x: v.x / l, y: v.y / l }; };
  const L = n(toLamp), H = n(toHead);
  const litAngle = (Math.atan2(L.y, L.x) * 180) / Math.PI; // top view: lit half toward the lamp
  const cosA = L.x * H.x + L.y * H.y;
  // observer looks along d = head -> ball; in y-up coordinates the observer's right is (d_y, -d_x)
  const d = { x: -H.x, y: H.y }; // y-up
  const right = { x: d.y, y: -d.x };
  const side = right.x * L.x + right.y * -L.y >= 0 ? 1 : -1;
  const face = (Math.atan2(my - HEAD_Y, mx - HEAD_X) * 180) / Math.PI;
  return (
    <AbsoluteFill style={{ opacity: inP }}>
      <Stage seed={41} glowX={45} glowY={55} />
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        {/* lamp (poster bulb) */}
        <g stroke={C.sun} strokeWidth={5 * S / 2} strokeLinecap="round">
          {[[0, -60, 0, -90], [0, 60, 0, 90], [-60, 0, -40, 0], [-42, -42, -30, -30], [-42, 42, -30, 30]].map(([x1, y1, x2, y2], i) =>
            <line key={i} x1={LAMP_X + x1 * S / 1.6} y1={LAMP_Y + y1 * S / 1.6} x2={LAMP_X + x2 * S / 1.6} y2={LAMP_Y + y2 * S / 1.6} />)}
        </g>
        <path d={`M ${LAMP_X + 40 * S} ${LAMP_Y - 20 * S} L ${HEAD_X - 100} ${HEAD_Y - 55 * S} L ${HEAD_X - 100} ${HEAD_Y + 55 * S} L ${LAMP_X + 40 * S} ${LAMP_Y + 20 * S} Z`} fill={C.sun} opacity={0.12} />
        <circle cx={LAMP_X} cy={LAMP_Y} r={38 * S / 1.6} fill={C.sun} />
        <rect x={LAMP_X - 14 * S / 1.6} y={LAMP_Y + 35 * S / 1.6} width={28 * S / 1.6} height={22 * S / 1.6} rx={4} fill={ORBIT_COL} />
        {/* orbit */}
        <circle cx={HEAD_X} cy={HEAD_Y} r={ORBIT} fill="none" stroke={ORBIT_COL} strokeWidth={3} strokeDasharray="8 10" />
        {/* sight line */}
        <line x1={HEAD_X} y1={HEAD_Y} x2={mx} y2={my} stroke={HEAD_COL} strokeWidth={2} strokeDasharray="4 8" opacity={0.5} />
        {/* head = observer, facing the ball */}
        <g transform={`translate(${HEAD_X},${HEAD_Y}) rotate(${face})`}>
          <path d="M -30 -70 Q -82 0 -30 70" fill="none" stroke={HEAD_COL} strokeWidth={5} />
          <circle r={42} fill="none" stroke={HEAD_COL} strokeWidth={5} />
          <circle cx={22} cy={0} r={6} fill={HEAD_COL} />
        </g>
        {/* ball: lit hemisphere toward the lamp */}
        <g transform={`translate(${mx},${my}) rotate(${litAngle})`}>
          <circle r={BALL} fill={MOON_DARK} />
          <path d={`M 0 ${-BALL} A ${BALL} ${BALL} 0 0 1 0 ${BALL} Z`} fill={MOON_LIT} />
        </g>
        <g fontFamily="NotoThai, Kanit" fontSize={34} fill={C.soft} textAnchor="middle">
          <text x={LAMP_X} y={HEAD_Y + 350}>หลอดไฟ = ดวงอาทิตย์</text>
          <text x={HEAD_X - 60} y={HEAD_Y + 350}>ศีรษะ = ผู้สังเกตบนโลก</text>
        </g>
        <text x={HEAD_X + ORBIT + 40} y={HEAD_Y + 350} fontFamily="NotoThai, Kanit" fontSize={34} fill={C.soft} textAnchor="middle">ลูกบอล = ดวงจันทร์</text>
        {/* observer's view */}
        <g transform="translate(1610,470)">
          <circle r={150} fill={MOON_DARK} />
          <path d={phasePath(150, cosA, side)} fill={MOON_LIT} />
          <circle r={150} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth={2} />
        </g>
        <g fontFamily="Kanit, NotoThai" textAnchor="middle">
          <text x={1610} y={250} fontSize={36} fontWeight={500} fill={C.sun}>ผู้สังเกตเห็นแบบนี้</text>
          <text x={1610} y={690} fontSize={34} fill={C.soft} fontFamily="NotoThai, Kanit">ครึ่งสว่างหันมาหาเรามากหรือน้อย</text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};

// ---------- P3: the kit's worksheet 1 as a printed A4 page; slow push; abstract scribbles in three answer cells.
const scribble = (x: number, y: number, w: number, h: number, seed: number) => {
  const r = mulberry32(seed);
  const n = 7 + Math.floor(r() * 4), pts: string[] = [];
  for (let i = 0; i <= n; i++) pts.push(`${(x + 8 + ((w - 16) * i) / n).toFixed(1)},${(y + h * (0.45 + (i % 2 ? -0.18 : 0.18) * (0.6 + r() * 0.6))).toFixed(1)}`);
  return `M ${pts.join(' L ')}`;
};
export const Worksheet: React.FC = () => {
  const f = useCurrentFrame();
  const inP = ramp(f, 0, 14, 0, 1, E.outCubic);
  const PW = 900, scale = PW / ws.pageW; // page shown 900 px wide
  const z = ramp(f, 0, 180, 1.0, 1.14, E.linear);
  const cells = [ws.cells[0], ws.cells[3], ws.cells[4]]; // row1 %, row2 phase, row3 %
  return (
    <AbsoluteFill style={{ opacity: inP }}>
      <Stage seed={53} />
      <div style={{ position: 'absolute', left: 760, top: 70, width: PW, height: 940, overflow: 'hidden', borderRadius: 6,
        boxShadow: '0 50px 100px rgba(0,0,0,.6)', transform: 'rotate(-1.5deg)' }}>
        <div style={{ width: PW, transformOrigin: '40% 55%', transform: `scale(${z})` }}>
          <Img src={staticFile('worksheet-1.png')} style={{ width: PW, display: 'block' }} />
          <svg width={PW} height={ws.pageH * scale} style={{ position: 'absolute', left: 0, top: 0 }}>
            {cells.map((c, i) => {
              const p = ramp(f, 40 + i * 28, 62 + i * 28, 0, 1, E.inOutCubic);
              return <path key={i} d={scribble(c.x * scale, c.y * scale, c.w * scale, c.h * scale, 11 + i)} fill="none" stroke="#2a4a8a"
                strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />;
            })}
          </svg>
        </div>
      </div>
      <p style={{ position: 'absolute', left: 96, top: 230, width: 560, fontFamily: BODY, fontSize: 32, lineHeight: 1.4, color: C.cap }}>
        ใบงานที่ 1 จากชุดกิจกรรม LUNARIS
      </p>
    </AbsoluteFill>
  );
};

// ---------- P6: C -> E -> R cards (poster .cer), then a slow pan over the poster preview, cropped above its footer.
const POSTER_W = 1700, POSTER_CROP_H = 2150; // footer with placeholders starts at y ~ 2160
export const CerPoster: React.FC = () => {
  const f = useCurrentFrame();
  const inP = ramp(f, 0, 14, 0, 1, E.outCubic);
  const cerOut = ramp(f, 140, 158, 1, 0);
  const posterIn = ramp(f, 146, 166, 0, 1, E.outCubic);
  const FW = 1300, FH = 1000, s = FW / POSTER_W;
  const panY = ramp(f, 160, 300, 0, POSTER_CROP_H * s - FH, E.linear);
  const rows: [string, string][] = [['C', 'ข้อกล่าวอ้าง'], ['E', 'หลักฐาน'], ['R', 'เหตุผล']];
  return (
    <AbsoluteFill style={{ opacity: inP }}>
      <Stage seed={61} />
      <div style={{ position: 'absolute', left: 560, top: 250, width: 800, opacity: cerOut }}>
        <BlurLine words={['นำเสนอข้อเสนอของทีม']} from={6} span={36} size={54} style={{ fontFamily: HEAD, fontWeight: 600, color: '#fff', marginBottom: 34 }} />
        {rows.map(([k, t], i) => {
          const p = ramp(f, 22 + i * 22, 40 + i * 22, 0, 1, E.outCubic);
          return (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 30, marginBottom: 20, padding: '10px 30px', borderRadius: 18,
              border: '3px solid rgba(242,180,58,.6)', opacity: p, transform: `translateY(${(1 - p) * 30}px)` }}>
              <b style={{ fontFamily: HEAD, fontWeight: 700, fontSize: 92, color: C.sun, width: 80, textAlign: 'center', lineHeight: 1.05 }}>{k}</b>
              <span style={{ fontFamily: BODY, fontSize: 56, color: '#fff' }}>{t}</span>
            </div>
          );
        })}
      </div>
      <div style={{ opacity: posterIn }}>
        <Frame x={480} y={40} w={FW} h={FH}>
          <div style={{ position: 'absolute', width: FW, height: POSTER_CROP_H * s, overflow: 'hidden', transform: `translateY(${-panY}px)` }}>
            <Img src={staticFile('poster-preview.jpg')} style={{ width: FW, display: 'block' }} />
          </div>
        </Frame>
        <p style={{ position: 'absolute', left: 96, top: 230, width: 360, fontFamily: BODY, fontSize: 32, lineHeight: 1.4, color: C.cap }}>โปสเตอร์ของโครงงาน</p>
      </div>
    </AbsoluteFill>
  );
};

/** Two labelled grey slots side by side for the 2-up close (06-close-AB). */
export const SplitSlate: React.FC<{ file: string; lines: string[] }> = ({ file, lines }) => (
  <AbsoluteFill style={{ background: '#2b2f35', flexDirection: 'row', gap: 8, padding: 40 }}>
    {['A', 'B'].map((who) => (
      <div key={who} style={{ flex: 1, border: '3px dashed rgba(255,255,255,.18)', borderRadius: 24, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', color: C.slateText, fontFamily: BODY }}>
        <div style={{ fontFamily: HEAD, fontWeight: 600, fontSize: 40, color: '#e2e6ea' }}>ผู้พูด {who}</div>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 48, color: '#fff', margin: '14px 0 20px' }}>{file}</div>
        {lines.map((l, i) => <div key={i} style={{ fontSize: 30, lineHeight: 1.4 }}>{l}</div>)}
      </div>
    ))}
  </AbsoluteFill>
);
