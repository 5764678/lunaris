import React from 'react';
import { Composition, Still } from 'remotion';
import { Main } from './Main';
import { loadFonts } from './fonts';
import tl from '../timeline.json';

loadFonts();
const D = Math.round(tl.duration_s * tl.fps);

export const RemotionRoot: React.FC = () => (
  <>
    {/* graphics-1080p.mp4: no captions, grey slates in team slots */}
    <Composition id="Graphics" component={Main} durationInFrames={D} fps={tl.fps} width={1920} height={1080} defaultProps={{ captions: false }} />
    {/* animatic: captions burned in; rendered at --scale 0.6667 to 1280x720 */}
    <Composition id="Animatic" component={Main} durationInFrames={D} fps={tl.fps} width={1920} height={1080} defaultProps={{ captions: true }} />
    {/* overlay layer only (period numbers, QR tile) on transparency, for compositing over the team's footage */}
    <Composition id="Overlays" component={Main} durationInFrames={D} fps={tl.fps} width={1920} height={1080} defaultProps={{ overlaysOnly: true }} />
  </>
);
