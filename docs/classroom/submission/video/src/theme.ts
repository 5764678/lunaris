// Tokens from poster/poster.html (design spec part 2). #c75a2a is the TD-approved rust for dark backgrounds only.
export const FPS = 30;
export const C = {
  space: '#06080b', navy: '#0d1626', sun: '#f2b43a', rust: '#a0461e', rustOnDark: '#c75a2a',
  earth: '#7db3ff', paper: '#f4eddd', cream: '#f6f1e7', ink: '#1c1a17', ink2: '#4a443d',
  text: '#e9edf2', soft: '#dde3e9', cap: '#aab4bf', slate: '#3a3f46', slateText: '#c9ced4',
};
export const HEAD = 'Kanit, NotoThai, sans-serif';
export const BODY = 'NotoThai, Kanit, sans-serif';
export const sec = (s: number) => Math.round(s * FPS);
