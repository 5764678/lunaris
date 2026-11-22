// §3 hook and title, 0:40-0:58 (540 f). Shots 3a-3b. Terrain = poster/img/terrain.jpg (LUNARIS "Pole terrain", NASA LRO LOLA).
// Text: chip and headline as on the poster (#hook); source line per the claims list (NARIT, 24 Aug 2026 = 24 ส.ค. 2569).
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { BlurLine, Push } from '../Common';
import { BODY, C, HEAD } from '../theme';
import { E, ramp } from '../motion';

const TITLE = 315; // 50.5 s
const WORD = 444; // 54.8 s, on "LUNARIS" in A's line

export const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const inP = ramp(f, 0, 14, 0, 1, E.outCubic);
  const chip = ramp(f, 6, 20, 0, 1, E.outCubic);
  const hookOut = ramp(f, TITLE, TITLE + 15, 1, 0);
  const dim = ramp(f, TITLE, TITLE + 30, 1, 0.38);
  const out = ramp(f, 528, 540, 1, 0, E.linear);
  return (
    <AbsoluteFill style={{ background: C.space, opacity: out }}>
      <AbsoluteFill style={{ opacity: inP * dim }}>
        <Push src="terrain.jpg" to={540} z0={1.0} z1={1.08} ox={60} oy={40} />
        <AbsoluteFill style={{ background: 'linear-gradient(90deg, rgba(6,8,11,.88) 0%, rgba(6,8,11,.55) 48%, rgba(6,8,11,0) 75%)' }} />
        <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(6,8,11,.7) 0%, rgba(6,8,11,0) 30%)' }} />
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 120, top: 250, width: 1300, opacity: hookOut }}>
        <span style={{ display: 'inline-block', fontFamily: HEAD, fontWeight: 500, fontSize: 38, lineHeight: 1, padding: '12px 26px 14px', borderRadius: 40,
          background: C.sun, color: '#201505', opacity: chip, transform: `translateY(${(1 - chip) * 20}px)` }}>โจทย์จริงจากอวกาศ</span>
        <BlurLine words={['ฉางเอ๋อ 7']} from={14} span={40} size={124} style={{ fontFamily: HEAD, fontWeight: 600, color: '#fff', lineHeight: 1.1, marginTop: 26 }} />
        <BlurLine words={['เลื่อนไป', 'ปี 2570']} from={30} span={44} size={124} style={{ fontFamily: HEAD, fontWeight: 600, color: C.sun, lineHeight: 1.1, columnGap: '0.2em' }} />
        <BlurLine sub words={['อุปกรณ์ชิ้นแรกของไทย', 'ที่จะไปดวงจันทร์', 'ต้องรอ']} from={60} span={50} size={42} style={{ fontFamily: BODY, color: C.soft, lineHeight: 1.4, marginTop: 30 }} />
        <BlurLine sub words={['เพราะเงื่อนไขแสงอาทิตย์', 'ที่จุดลงจอด', 'ไม่เป็นไปตามที่กำหนด']} from={74} span={50} size={42} style={{ fontFamily: BODY, color: C.soft, lineHeight: 1.4 }} />
        <BlurLine sub words={['ที่มา: สดร. 24 ส.ค. 2569']} from={100} span={30} size={34} style={{ fontFamily: BODY, color: C.cap, marginTop: 22 }} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 360, textAlign: 'center' }}>
        <BlurLine words={['L', 'U', 'N', 'A', 'R', <span style={{ color: C.rustOnDark }}>I</span>, <span style={{ color: C.rustOnDark }}>S</span>]} from={WORD} span={40}
          size={230} style={{ fontFamily: HEAD, fontWeight: 700, color: '#fff', justifyContent: 'center', columnGap: 0, letterSpacing: 4, lineHeight: 1 }} />
        <BlurLine sub words={['ห้องเรียน', 'ภารกิจ', 'ดวงจันทร์']} from={WORD + 14} span={44} size={76}
          style={{ fontFamily: HEAD, fontWeight: 600, color: '#fff', justifyContent: 'center', columnGap: 0, marginTop: 34 }} />
      </div>
    </AbsoluteFill>
  );
};
