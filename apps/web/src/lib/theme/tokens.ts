/**
 * Reads a colour token from globals.css at run time, for code that cannot use a Tailwind class
 * (Plotly layouts and WebGL materials). All colour lives in the tokens; this is the only way
 * those libraries get it.
 *
 * `el` is the element whose cascade decides the value: pass a chart's own container so a chart
 * on the light page gets the light values and one inside a `.space` window gets the dark ones.
 * Without it the first `.space` window is used (the 3D scenes live in one), then the page.
 */
export function readToken(name: string, el?: Element | null): string {
  if (typeof document === "undefined") return "";
  const host = el ?? document.querySelector(".space") ?? document.documentElement;
  return getComputedStyle(host).getPropertyValue(`--${name}`).trim();
}
