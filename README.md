# ??? Piper Voice-Over Studio

A modern, standalone, zero-backend neural voice-over generator based on **Piper TTS**. The app runs **100% client-side in the browser** using WebAssembly and ONNX Runtime Web without requiring backend servers, GPU clusters, or paid external APIs.

---

## ? Key Features

- **Modern Glassmorphic Single-Window Design**: Clean, ergonomic audio studio interface designed for creators.
- **Complete Library of 175+ Neural Voices**:
  - ????/???? **English**: 38 voices (Ryan HD, Lessac HD, LJSpeech, Amy, Cori, Alan, VCTK 100+ personas...)
  - ???? **Slovak**: `sk_SK-lili-medium`
  - ???? **Czech**: `cs_CZ-kasandra-medium`, `cs_CZ-jirka-medium`, `cs_CZ-jirka-low`
  - ???? **German**, ???? **Polish**, ???? **Spanish**, ???? **French**, ???? **Ukrainian**, ???? **Italian**, and 35+ other languages.
- **Synthesis Tuning Sliders (Piper & Audio Settings)**:
  - **Speaking Speed (Tempo / Length Scale)**: 0.50x to 2.00x without altering vocal pitch.
  - **Tone Variability / Expression (Noise Scale)**: 0.10 to 1.50 (controls intonation, emotional dynamics, and expressiveness).
  - **Phoneme Cadence & Rhythm (Noise W)**: 0.10 to 1.50 (controls individual vowel/consonant duration variability).
  - **Volume & Master Gain**: 20% to 200% with soft-clipping protection.
- **Quick Studio Presets**:
  - ??? *Natural Narrator*
  - ? *TikTok / Reels (1.25x fast)*
  - ?? *Movie Trailer (Deep & dramatic)*
  - ?? *Podcast & Radio*
  - ?? *Calm Audiobook*
- **Direct MP3 & WAV Export**:
  - Export to **MP3** (selectable bitrate: 128 kbps, 192 kbps HQ, 320 kbps HD) via built-in pure JavaScript LAME encoder.
  - Export to lossless **WAV**.
- **Interactive Waveform Player**:
  - Clickable and draggable audio waveform scrubber.
  - Loop playback and custom playback speed controls (0.75x to 2.0x).
- **Session History**: Easily re-play and re-download previously generated voice-overs.
- **Persistent Model Caching**: Voices (~35 MB) are downloaded once and cached locally in browser storage (CacheStorage/OPFS), enabling instant generation and offline capability.

---

## ?? How to Run Locally

### Method 1: 1-Click Windows Launcher (Recommended)
Double-click:
```
Start-Studio.bat
```
This automatically launches a lightweight local HTTP server and opens the studio in your browser at `http://localhost:3000`.

### Method 2: Via Python
Open your terminal in the project directory and run:
```bash
python serve.py
```

### Method 3: Direct File Open
You can also directly double-click `index.html` to open it in any modern browser (Chrome, Edge, Firefox, Brave, Safari).

---

## ?? Deploy to Vercel (100% Free)

The project is fully static and pre-configured with `vercel.json` for instant deployment with optimal `COOP/COEP` headers for WebAssembly.

### Option A: Via Vercel CLI
1. Open a terminal in the project directory.
2. Run:
   ```bash
   npx vercel
   ```
3. Follow the prompts. Your studio will be live at `https://your-project.vercel.app` in under a minute!

### Option B: Via GitHub & Vercel Dashboard
1. Push this folder to a GitHub repository.
2. Go to [Vercel.com](https://vercel.com) and click **Add New Project**.
3. Select your repository and click **Deploy**.

---

## ?? Keyboard Shortcuts

- <kbd>Ctrl + Enter</kbd> (or <kbd>Cmd + Enter</kbd>): Generate voice-over immediately
- <kbd>Spacebar</kbd>: Play / Pause audio (when not typing in the text editor)

---

## ?? Project Structure

```
piper-voiceover-studio/
??? index.html          # Studio UI and layout
??? style.css           # Glassmorphic dark styling & responsive grid
??? app.js              # Application logic, audio player, state, history
??? piper-engine.js     # WebAssembly & ONNX Runtime Web synthesis engine
??? audio-processor.js  # PCM audio handling, WAV/MP3 encoding & waveform
??? voices-data.js      # Complete catalog of 175+ Piper neural voices
??? lame.min.js         # Built-in client-side LAME MP3 encoder
??? serve.py            # Local Python server with COOP/COEP headers
??? Start-Studio.bat    # Windows 1-click launcher
??? vercel.json         # Vercel deployment configuration
??? package.json        # NPM metadata
```