# Aelith · Motion Studio

**Turn hand gestures into light trails, sigils, and cybernetic visuals — directly in your browser.**

Aelith is a camera-based visual instrument for music performances and short videos. Open a hand to release a field of light, pinch and drag to pull visual elements through space, or use both hands to shape a connected effect.

## Why I built it

I wanted to sing along to my own music and use movement to make it look as though I were creating the visuals in the air. That became Aelith: an experiment in combining live performance, computer vision, and a visual language somewhere between magic and code.

## What it does

- Tracks up to two hands and individual fingertips.
- Offers four visual modes: flowing light trails, sigils, prisms, and a cybernetic HUD.
- Responds to gestures including thumb–index pinches, dragging, and opening a charged fist.
- Includes three color palettes and adjustable glow, trail length, and intensity.
- Records camera footage and effects together, with optional microphone audio and audio-reactive effects.
- Supports landscape, square, and a 4:5 composition that preserves the wide performance view against a blurred background.
- Includes a pointer-controlled demo for exploring the visuals without a camera.

## My contribution

I developed the concept, visual direction, gesture interactions, and performance use case. I tested the instrument on camera and guided successive revisions of its appearance, responsiveness, and recording behavior.

The implementation was built collaboratively with OpenAI's ChatGPT/Codex. This is an AI-assisted creative technology project: I directed and evaluated the experience; AI assisted with code generation, debugging, and technical implementation.

**Created by Ida Kaukonen / Anomalyda.**

## How it works

MediaPipe Hand Landmarker identifies 21 landmarks per hand. JavaScript interprets their positions and recent history as gestures; Canvas 2D draws the corresponding effects. MediaRecorder captures the final canvas, preferring MP4 when supported and falling back to WebM.

The cyber mode's code fragments and matrices are gesture-driven visualizations, not a display of the tracking model's internal activations.

Camera and microphone processing happens locally in the browser. This project contains no video-upload backend or analytics. MediaPipe assets are bundled locally; optional Google Fonts requests remain in the stylesheet.

## Run locally

This is a static HTML/CSS/JavaScript project. No application build or npm installation is required.

With **Python 3** installed, open a terminal in the project folder and run:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Then open **http://localhost:8000/dist/** in your browser. Allow camera access to use hand tracking, or try the pointer demo first.

Use a current desktop browser with camera and MediaRecorder support. Camera access requires **localhost or HTTPS**; opening `index.html` directly as a local file is not the supported route. A hosted copy can serve the contents of `dist/` over HTTPS.

## Interaction and recording

- Move your hands with fingertips visible to the camera.
- Pinch the thumb and index finger together and move to draw or pull an effect.
- Hold a fist briefly, then open it to release the mode's effect.
- Select the aspect ratio and video size before recording.
- Stop recording and use **Lataa video** to download the take.
- Keep the tab visible during recording and save each take before starting another or closing the page.

The interface is currently in Finnish. **Avaa kamera** opens the camera; **Tallenna video** starts recording. `F` toggles performance mode, `C` clears the trails, and `Escape` exits performance mode.

## Development notes

A major challenge was balancing visual density, gesture responsiveness, and recording performance. Iterations explored separate tracking execution and additional smoothing; device testing revealed delayed gestures. The current version uses direct tracking on a compact 640-pixel-wide camera copy, while keeping the recording resolution separate. The persistent light-trail layer also uses a smaller drawing surface to reduce processing cost.

This remains an experimental demo. Performance and gesture reliability depend on the device, browser, lighting, and hand visibility. Recording targets 30 FPS but does not guarantee it. MP4 support varies by browser; recordings are capped at approximately 250 MB. Tracking covers hands and wrists, not full-body pose.

## Project files

| Path | Purpose |
| --- | --- |
| `dist/index.html` | Interface and controls |
| `dist/app.js` | Camera, rendering, gesture state, and recording |
| `dist/cyber-hud.mjs` | Cybernetic visuals and gesture-driven matrices |
| `dist/gestures.mjs` | Hand classification and coordinate mapping |
| `dist/trail-decay.mjs` | Light-trail fade cleanup |
| `dist/vendor/` | MediaPipe runtime, model, and third-party notices |
| `tests/` | Gesture, effect, and mocked runtime checks |

With Node.js installed, run the checks from the project root:

```sh
node tests/gestures.test.mjs
node tests/trail-decay.test.mjs
node tests/cyber-hud.test.mjs
node tests/runtime.test.mjs
```

The runtime tests simulate browser APIs; they do not replace real camera and browser testing.

## License and third-party components

No open-source license is currently granted for the original application code. It is published as a portfolio source sample; contact the repository owner about reuse.

Third-party components retain their own terms. MediaPipe Tasks Vision is distributed under Apache License 2.0. See [`dist/vendor/ATTRIBUTION.md`](dist/vendor/ATTRIBUTION.md) and [`dist/vendor/LICENSE`](dist/vendor/LICENSE) for the bundled notices and upstream references.
