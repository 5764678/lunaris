// §5 proof cards (paper-title-card) and §6 end card + QR tile.
// paper-title-card (demo PaperTitleCard.tsx): words press in at delay 4 + 4i over 9 f, bezier(0.2,0.75,0.3,1),
// scale 1.28 -> 1, blur 7 -> 0; one accent; underline scaleX 16-34 f; 8 f fade-out. Deviations, recorded in the spec:
// Kanit has no italic and slanted Thai reads badly, so the accent is colour only; the card holds 5 s (not 1.8 s)
// because the voice runs over it and muted viewers need the reading time (R3).
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { BlurLine, Stage } from '../Common';
import { BODY, C, HEAD } from '../theme';
import { E, ramp } from '../motion';

type W = { text: string; accent?: boolean };
const Press: React.FC<{ words: W[]; start: number; size: number }> = ({ words, start, size }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: '0.26em', fontFamily: HEAD, fontWeight: 600, fontSize: size, lineHeight: 1.14, color: C.ink }}>
      {words.map((w, i) => {
        const d = start + 4 + i * 4;
        const t = interpolate(f, [d, d + 9], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.2, 0.75, 0.3, 1) });
        return <span key={i} style={{ display: 'inline-block', opacity: t, transform: `scale(${1.28 - 0.28 * t})`, filter: `blur(${(1 - t) * 7}px)`, color: w.accent ? C.rust : undefined }}>{w.text}</span>;
      })}
    </div>
  );
};

const DigitRoll: React.FC<{ value: string; delay: number; size: number }> = ({ value, delay, size }) => {
  const f = useCurrentFrame();
  const lh = size * 1.15;
  return (
    <span style={{ display: 'inline-flex', overflow: 'hidden', height: lh, verticalAlign: 'bottom' }}>
      {value.split('').map((ch, i) => {
        const tgt = Number(ch);
        const t = interpolate(f, [delay + i * 4, delay + i * 4 + 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.25, 0.8, 0.25, 1) });
        return (
          <span key={i} style={{ display: 'inline-block', height: lh }}>
            <span style={{ display: 'block', transform: `translateY(${-(10 + tgt) * t * lh}px)` }}>
              {'01234567890123456789'.split('').map((d, j) => <span key={j} style={{ display: 'block', lineHeight: `${lh}px`, fontVariantNumeric: 'tabular-nums' }}>{d}</span>)}
            </span>
          </span>
        );
      })}
    </span>
  );
};

export const ProofCard: React.FC<{ kind: 'horizons' | 'limits' }> = ({ kind }) => {
  const f = useCurrentFrame();
  const dur = 150;
  const fade = ramp(f, dur - 8, dur, 1, 0, E.linear);
  const fadeIn = ramp(f, 0, 6, 0, 1, E.linear);
  const underline = ramp(f, 16, 34, 0, 1, Easing.bezier(0.3, 0, 0.2, 1));
  const subT = ramp(f, 12, 24, 0, 1, E.linear);
  return (
    <AbsoluteFill style={{ backgroundColor: C.paper, opacity: fade * fadeIn, justifyContent: 'center', alignItems: 'center',
      backgroundImage: 'radial-gradient(1100px 750px at 50% 42%, rgba(255,252,244,.85), transparent 65%)' }}>
      <div style={{ textAlign: 'center', maxWidth: 1600 }}>
        {kind === 'horizons' ? (
          <>
            <Press start={0} size={70} words={[{ text: 'เวลาข้างขึ้นข้างแรม' }, { text: 'ต่างจาก' }, { text: 'JPL Horizons ของนาซา' }]} />
            <Press start={8} size={150} words={[{ text: 'ไม่เกิน' }, { text: '2 วินาที', accent: true }]} />
          </>
        ) : (
          <>
            <Press start={0} size={96} words={[{ text: 'ยังไม่จำลอง' }, { text: 'น้ำขึ้นน้ำลง' }]} />
            <Press start={10} size={96} words={[{ text: 'ยังไม่ได้ทดลอง' }, { text: 'กับนักเรียน' }]} />
          </>
        )}
        <div style={{ height: 8, width: 240, margin: '40px auto 0', borderRadius: 4, background: C.rust, transform: `scaleX(${underline})` }} />
        <div style={{ fontFamily: BODY, fontSize: 40, color: C.ink2, marginTop: 34, opacity: subT, display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: '0.35em' }}>
          {kind === 'horizons' ? (<>
            <span>ตรวจเทียบเวลาข้างขึ้นข้างแรมหลัก</span>
            <span style={{ fontFamily: HEAD, fontWeight: 600, color: C.rust }}><DigitRoll value="49" delay={14} size={40} /></span>
            <span>ครั้ง</span>
          </>) : <span>ซึ่งเป็นขั้นต่อไปของเรา</span>}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const EndCard: React.FC = () => {
  const f = useCurrentFrame();
  const qr = ramp(f, 8, 26, 0, 1, E.outCubic);
  const slots = ramp(f, 40, 56, 0, 1, E.outCubic);
  const logo = ramp(f, 50, 66, 0, 1, E.outCubic);
  const fine = ramp(f, 60, 76, 0, 1, E.outCubic);
  const out = ramp(f, 162, 180, 1, 0, E.linear);
  const slot = (t: string) => <div style={{ height: 60, padding: '0 28px', borderRadius: 12, background: C.slate, color: C.slateText, fontSize: 30, lineHeight: '60px', fontFamily: BODY }}>{t}</div>;
  return (
    <AbsoluteFill style={{ opacity: out, background: '#000' }}>
      <Stage seed={23} />
      <div style={{ position: 'absolute', left: 120, top: 150 }}>
        <BlurLine words={['L', 'U', 'N', 'A', 'R', <span style={{ color: C.rustOnDark }}>I</span>, <span style={{ color: C.rustOnDark }}>S</span>]} from={0} span={36} size={200}
          style={{ fontFamily: HEAD, fontWeight: 700, color: '#fff', columnGap: 0, letterSpacing: 4, lineHeight: 0.95 }} />
        <BlurLine sub words={['ห้องเรียน', 'ภารกิจ', 'ดวงจันทร์']} from={12} span={40} size={64} style={{ fontFamily: HEAD, fontWeight: 600, color: '#fff', columnGap: 0, marginTop: 20 }} />
        <BlurLine sub words={['ใช้ฟรีผ่านเว็บ']} from={22} span={30} size={36} style={{ fontFamily: BODY, color: C.soft, marginTop: 8 }} />
        <div style={{ display: 'flex', gap: 20, marginTop: 40, opacity: slots }}>{slot('[ชื่อ ผู้ประดิษฐ์ 1]')}{slot('[ชื่อ ผู้ประดิษฐ์ 2]')}</div>
        <div style={{ display: 'flex', gap: 20, marginTop: 16, opacity: slots }}>{slot('[ครูที่ปรึกษา]')}</div>
        <div style={{ marginTop: 34, display: 'inline-block', background: '#fff', borderRadius: 16, padding: '14px 24px', opacity: logo }}>
          <Img src={staticFile('school-logo.png')} style={{ height: 88, display: 'block' }} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: 1300, top: 190, width: 500, background: C.cream, borderRadius: 28, padding: 34, textAlign: 'center', opacity: qr, transform: `scale(${0.94 + 0.06 * qr})` }}>
        <Img src={staticFile('qr.png')} style={{ width: 432, height: 432, display: 'block' }} />
        <p style={{ fontFamily: HEAD, fontWeight: 600, fontSize: 46, color: C.rust, margin: '14px 0 0' }}>ลองใช้ได้เลย</p>
      </div>
      <p style={{ position: 'absolute', left: 120, top: 940, width: 1680, fontFamily: BODY, fontSize: 32, lineHeight: 1.3, color: C.cap, opacity: fine, margin: 0 }}>
        พัฒนาโดยใช้ปัญญาประดิษฐ์ช่วยเขียนโปรแกรม ภายใต้การกำกับและตรวจสอบของคณะผู้ประดิษฐ์<br />ภาพทั้งหมดจับจากแอป LUNARIS · พื้นผิวดวงจันทร์: NASA SVS · ภูมิประเทศ: NASA LRO LOLA
      </p>
    </AbsoluteFill>
  );
};

/** Bottom-right QR tile over 06-close.mp4 (155-159 s), matching the end card's tile. */
export const QrTile: React.FC = () => {
  const f = useCurrentFrame();
  const p = ramp(f, 0, 16, 0, 1, E.outCubic);
  return (
    <div style={{ position: 'absolute', right: 96, bottom: 84, width: 300, background: C.cream, borderRadius: 22, padding: 22, textAlign: 'center',
      opacity: p, transform: `translateY(${(1 - p) * 40}px)`, boxShadow: '0 20px 50px rgba(0,0,0,.45)' }}>
      <Img src={staticFile('qr.png')} style={{ width: 256, height: 256, display: 'block' }} />
      <p style={{ fontFamily: HEAD, fontWeight: 600, fontSize: 34, color: C.rust, margin: '10px 0 0' }}>ลองใช้ได้เลย</p>
    </div>
  );
};
