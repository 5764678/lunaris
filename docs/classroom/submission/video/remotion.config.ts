import { Config } from '@remotion/cli/config';
// Use the machine's Chromium headless shell when set (no download); see README.
if (process.env.REMOTION_BROWSER) Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
Config.setVideoImageFormat('jpeg');
