// The whole 2:45 graphics timeline, driven by timeline.json. Team slots render a grey labelled slate;
// overlays (period numbers, QR tile) sit on top. `captions` burns the Thai lines in (animatic only).
import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import tl from '../timeline.json';
import { PeriodTag, Slate } from './Common';
import { BODY, sec } from './theme';
import { ColdOpen } from './shots/ColdOpen';
import { Hook } from './shots/Hook';
import { P2, P4, P5 } from './shots/AppShots';
import { EndCard, ProofCard, QrTile } from './shots/Cards';
import orbit from './generated/orbit.json';

type Seg = (typeof tl.segments)[number];

const graphicsFor: Record<string, React.ReactNode> = {
  's1-cold-open': <ColdOpen />,
  's3-hook': <Hook />,
  'p2-app': <P2 />,
  'p4-app': <P4 orbitFrames={orbit.frames} />,
  'p5-app': <P5 />,
  's5-card-horizons': <ProofCard kind="horizons" />,
  's5-card-limits': <ProofCard kind="limits" />,
  's6-end-card': <EndCard />,
};

const slateLines = (s: Seg) => {
  const caps = tl.captions.filter((c) => c.start >= s.start && c.start < s.end);
  const out = [`${(s as { picture: string }).picture}`, `${s.start.toFixed(1)}–${s.end.toFixed(1)} วินาที · ${(s.end - s.start).toFixed(1)} วินาที`];
  if (caps.length) out.push(`เสียง: ${caps.map((c) => c.who).join(', ')}`);
  return out;
};

const PERIOD_TITLES: Record<string, string | undefined> = {
  'period-2': 'ข้างขึ้นข้างแรม|หนึ่งรอบเดือน',
  'period-4': 'ยืนที่ขั้วใต้|ของดวงจันทร์',
  'period-5': 'เปรียบเทียบ|สามจุดลงจอด',
};

const Captions: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  const c = tl.captions.find((x) => t >= x.start && t < x.end);
  if (!c) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 56, display: 'flex', justifyContent: 'center' }}>
      <div style={{ maxWidth: 1500, padding: '10px 28px 14px', borderRadius: 12, background: 'rgba(0,0,0,.62)', color: '#fff', fontFamily: BODY, fontWeight: 500,
        fontSize: 54, lineHeight: 1.32, textAlign: 'center', whiteSpace: 'pre-line' }}>{c.text}</div>
    </div>
  );
};

export const Main: React.FC<{ captions?: boolean; overlaysOnly?: boolean }> = ({ captions = false, overlaysOnly = false }) => (
  <AbsoluteFill style={{ background: overlaysOnly ? 'transparent' : '#000' }}>
    {!overlaysOnly && tl.segments.map((s) => (
      <Sequence key={s.id} from={sec(s.start)} durationInFrames={sec(s.end) - sec(s.start)} name={s.id}>
        {s.type === 'graphics' ? graphicsFor[s.id] : <Slate file={(s as { file: string }).file} section={`ส่วน ${s.section}${'period' in s ? ` · คาบ ${s.period}` : ''}`} lines={slateLines(s)} />}
      </Sequence>
    ))}
    {tl.overlays.map((o) => (
      <Sequence key={o.id} from={sec(o.start)} durationInFrames={sec(o.end) - sec(o.start)} name={o.id}>
        {o.id === 'qr-tile' ? <QrTile /> : <PeriodTag n={Number(o.id.slice(-1))} label={o.label} title={PERIOD_TITLES[o.id]} />}
      </Sequence>
    ))}
    {captions ? <Captions /> : null}
  </AbsoluteFill>
);
