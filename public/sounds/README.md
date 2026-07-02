# Queue pass sound

Place your clip here as **`queue-pass.mp3`**.

The extension plays this file when a queue pass is detected (if **Queue pass sound** is enabled). If the file is missing or fails to load, it falls back to a short 880 Hz beep.

## Adding audio from a YouTube Short

The extension cannot stream from YouTube URLs. For personal use:

1. Export or download the clip you want (e.g. with a desktop tool you trust).
2. Trim to the part you want (often a few seconds is enough).
3. Save as `public/sounds/queue-pass.mp3`.
4. Run `npm run build` and reload the extension.

**Note:** Only use audio you have the right to use. Do not commit copyrighted clips to a public repo unless you have permission.
