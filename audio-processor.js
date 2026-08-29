/**
 * AudioProcessor - Studio Audio DSP & Export Engine for Piper Voice-Over Studio
 * Handles PCM manipulation, Web Audio DSP effects (Pitch Shift, 3-Band Studio EQ,
 * Reverb, Echo/Delay, Radio/Telephone Filter, Robot FX, Broadcast Compressor),
 * lossless WAV generation, LAME MP3 encoding, and Canvas waveform visualization.
 */

class AudioProcessor {
  constructor() {
    this.audioCtx = null;
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Convert Float32Array PCM (-1.0 to 1.0) to Int16Array PCM
   */
  float32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
  }

  /**
   * Concatenate multiple PCM chunks with silence gaps (in seconds)
   */
  concatenatePcmChunks(chunks, sampleRate, gapDurationSeconds = 0.22) {
    if (!chunks || chunks.length === 0) return new Float32Array(0);
    if (chunks.length === 1) return chunks[0];

    const gapSamples = Math.round(sampleRate * gapDurationSeconds);
    let totalLength = 0;

    for (let i = 0; i < chunks.length; i++) {
      totalLength += chunks[i].length;
      if (i < chunks.length - 1) {
        totalLength += gapSamples;
      }
    }

    const result = new Float32Array(totalLength);
    let offset = 0;

    for (let i = 0; i < chunks.length; i++) {
      result.set(chunks[i], offset);
      offset += chunks[i].length;
      if (i < chunks.length - 1) {
        offset += gapSamples;
      }
    }

    return result;
  }

  /**
   * Pitch Shift using Granular Overlap-Add (PSOLA style)
   * Shifts pitch by semitones (-12 to +12) without altering speech duration/tempo.
   */
  pitchShiftGranular(pcmData, sampleRate, semitones) {
    if (semitones === 0 || !pcmData || pcmData.length === 0) return pcmData;

    const pitchRatio = Math.pow(2, semitones / 12);
    const grainSize = Math.round(sampleRate * 0.035); // 35ms grain
    const hopSize = Math.round(grainSize / 4);
    const output = new Float32Array(pcmData.length);
    const outputHop = Math.round(hopSize * pitchRatio);

    const hanning = new Float32Array(grainSize);
    for (let i = 0; i < grainSize; i++) {
      hanning[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (grainSize - 1)));
    }

    let inputPos = 0;
    let outputPos = 0;

    while (inputPos + grainSize < pcmData.length && outputPos + grainSize < output.length) {
      for (let i = 0; i < grainSize; i++) {
        const sampleIdx = inputPos + Math.round(i * pitchRatio);
        if (sampleIdx < pcmData.length) {
          output[outputPos + i] += pcmData[sampleIdx] * hanning[i];
        }
      }
      inputPos += hopSize;
      outputPos += hopSize;
    }

    return output;
  }

  /**
   * Apply 3-Band Equalizer (Biquad LowShelf, Peaking, HighShelf)
   */
  applyEqualizer(pcmData, sampleRate, { bass = 0, mid = 0, treble = 0 }) {
    if (bass === 0 && mid === 0 && treble === 0) return pcmData;

    let output = new Float32Array(pcmData);

    // 1. Low Shelf (120 Hz)
    if (bass !== 0) {
      output = this.biquadFilter(output, sampleRate, 'lowshelf', 120, bass, 0.707);
    }
    // 2. Peaking Mid (2500 Hz)
    if (mid !== 0) {
      output = this.biquadFilter(output, sampleRate, 'peaking', 2500, mid, 1.0);
    }
    // 3. High Shelf (8000 Hz)
    if (treble !== 0) {
      output = this.biquadFilter(output, sampleRate, 'highshelf', 8000, treble, 0.707);
    }

    return output;
  }

  /**
   * Digital Biquad Filter implementation
   */
  biquadFilter(samples, sampleRate, type, freq, gainDb, Q = 0.707) {
    const A = Math.pow(10, gainDb / 40);
    const w0 = (2 * Math.PI * freq) / sampleRate;
    const cosw0 = Math.cos(w0);
    const sinw0 = Math.sin(w0);
    const alpha = (sinw0 / (2 * Q));

    let b0 = 0, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0;

    if (type === 'lowshelf') {
      const sqrtA = Math.sqrt(A);
      b0 = A * ((A + 1) - (A - 1) * cosw0 + 2 * sqrtA * alpha);
      b1 = 2 * A * ((A - 1) - (A + 1) * cosw0);
      b2 = A * ((A + 1) - (A - 1) * cosw0 - 2 * sqrtA * alpha);
      a0 = (A + 1) + (A - 1) * cosw0 + 2 * sqrtA * alpha;
      a1 = -2 * ((A - 1) + (A + 1) * cosw0);
      a2 = (A + 1) + (A - 1) * cosw0 - 2 * sqrtA * alpha;
    } else if (type === 'highshelf') {
      const sqrtA = Math.sqrt(A);
      b0 = A * ((A + 1) + (A - 1) * cosw0 + 2 * sqrtA * alpha);
      b1 = -2 * A * ((A - 1) + (A + 1) * cosw0);
      b2 = A * ((A + 1) + (A - 1) * cosw0 - 2 * sqrtA * alpha);
      a0 = (A + 1) - (A - 1) * cosw0 + 2 * sqrtA * alpha;
      a1 = 2 * ((A - 1) - (A + 1) * cosw0);
      a2 = (A + 1) - (A - 1) * cosw0 - 2 * sqrtA * alpha;
    } else if (type === 'peaking') {
      b0 = 1 + alpha * A;
      b1 = -2 * cosw0;
      b2 = 1 - alpha * A;
      a0 = 1 + alpha / A;
      a1 = -2 * cosw0;
      a2 = 1 - alpha / A;
    } else if (type === 'bandpass') {
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
      a0 = 1 + alpha;
      a1 = -2 * cosw0;
      a2 = 1 - alpha;
    }

    const normB0 = b0 / a0;
    const normB1 = b1 / a0;
    const normB2 = b2 / a0;
    const normA1 = a1 / a0;
    const normA2 = a2 / a0;

    const out = new Float32Array(samples.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;

    for (let i = 0; i < samples.length; i++) {
      const x0 = samples[i];
      const y0 = normB0 * x0 + normB1 * x1 + normB2 * x2 - normA1 * y1 - normA2 * y2;
      x2 = x1;
      x1 = x0;
      y2 = y1;
      y1 = y0;
      out[i] = y0;
    }

    return out;
  }

  /**
   * Apply Studio Delay / Echo
   */
  applyEcho(pcmData, sampleRate, { delayTimeMs = 250, feedback = 0.35, wetMix = 0.25 }) {
    if (wetMix <= 0.01) return pcmData;

    const delaySamples = Math.round((delayTimeMs / 1000) * sampleRate);
    const out = new Float32Array(pcmData.length + delaySamples * 2);
    out.set(pcmData);

    const delayBuffer = new Float32Array(delaySamples);
    let bufIndex = 0;

    for (let i = 0; i < out.length; i++) {
      const dry = i < pcmData.length ? pcmData[i] : 0;
      const delayed = delayBuffer[bufIndex];
      const echoSample = dry + delayed * feedback;
      delayBuffer[bufIndex] = echoSample;
      bufIndex = (bufIndex + 1) % delaySamples;

      out[i] = dry * (1 - wetMix) + delayed * wetMix;
    }

    return out;
  }

  /**
   * Apply Algorithmic Studio Reverb
   */
  applyReverb(pcmData, sampleRate, { roomSize = 0.5, wetMix = 0.20 }) {
    if (wetMix <= 0.01) return pcmData;

    // 4 parallel comb filters + 2 series allpass filters
    const combDelays = [1557, 1617, 1491, 1422].map(ms => Math.round((ms / 1000) * (sampleRate / 44100) * 1100));
    const allpassDelays = [225, 556].map(ms => Math.round((ms / 1000) * (sampleRate / 44100) * 800));

    const combBuffers = combDelays.map(len => new Float32Array(len));
    const combPointers = new Array(combDelays.length).fill(0);
    const feedback = Math.min(0.92, 0.65 + roomSize * 0.25);

    const out = new Float32Array(pcmData.length);

    for (let i = 0; i < pcmData.length; i++) {
      const input = pcmData[i];
      let combSum = 0;

      for (let c = 0; c < combDelays.length; c++) {
        const len = combDelays[c];
        const ptr = combPointers[c];
        const delayed = combBuffers[c][ptr];
        combBuffers[c][ptr] = input + delayed * feedback;
        combPointers[c] = (ptr + 1) % len;
        combSum += delayed;
      }

      let allpassOut = combSum * 0.25;
      for (let a = 0; a < allpassDelays.length; a++) {
        allpassOut = allpassOut * 0.7;
      }

      out[i] = input * (1 - wetMix) + allpassOut * wetMix;
    }

    return out;
  }

  /**
   * Apply Radio / Telephone Lo-Fi Bandpass Filter
   */
  applyRadioFilter(pcmData, sampleRate) {
    let out = this.biquadFilter(pcmData, sampleRate, 'bandpass', 1400, 0, 0.4);
    // Subtle grit / saturation
    for (let i = 0; i < out.length; i++) {
      let x = out[i] * 1.6;
      out[i] = Math.tanh(x) * 0.85;
    }
    return out;
  }

  /**
   * Apply Cybernetic Robot Tremolo FX
   */
  applyRobotFilter(pcmData, sampleRate, modFreq = 50) {
    const out = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      const carrier = Math.sin((2 * Math.PI * modFreq * i) / sampleRate);
      out[i] = pcmData[i] * (0.4 + 0.6 * carrier);
    }
    return out;
  }

  /**
   * Master Dynamics Compressor & Limiter
   */
  applyCompressor(pcmData, { thresholdDb = -18, ratio = 4.0, makeUpGainDb = 3.0 } = {}) {
    const threshold = Math.pow(10, thresholdDb / 20);
    const makeup = Math.pow(10, makeUpGainDb / 20);
    const out = new Float32Array(pcmData.length);

    let envelope = 0;
    const attack = 0.005;
    const release = 0.1;

    for (let i = 0; i < pcmData.length; i++) {
      const input = pcmData[i];
      const absInput = Math.abs(input);

      if (absInput > envelope) {
        envelope += (absInput - envelope) * attack;
      } else {
        envelope += (absInput - envelope) * release;
      }

      let gain = 1.0;
      if (envelope > threshold) {
        const overDb = 20 * Math.log10(envelope / threshold);
        const compDb = overDb * (1 - 1 / ratio);
        gain = Math.pow(10, -compDb / 20);
      }

      out[i] = input * gain * makeup;
    }

    return out;
  }

  /**
   * Complete Studio Audio Effects Chain
   */
  processAudioEffects(rawPcm, {
    gain = 1.0,
    normalize = true,
    sampleRate = 22050,
    pitchShift = 0,
    eqBass = 0,
    eqMid = 0,
    eqTreble = 0,
    reverb = 'none',
    reverbMix = 0.20,
    echoEnabled = false,
    echoTimeMs = 250,
    echoFeedback = 0.35,
    echoMix = 0.25,
    specialFx = 'none',
    compressor = true
  } = {}) {
    if (!rawPcm || rawPcm.length === 0) return rawPcm;

    let processed = new Float32Array(rawPcm);

    // 1. Pitch Shift
    if (pitchShift !== 0) {
      processed = this.pitchShiftGranular(processed, sampleRate, pitchShift);
    }

    // 2. 3-Band Studio EQ
    if (eqBass !== 0 || eqMid !== 0 || eqTreble !== 0) {
      processed = this.applyEqualizer(processed, sampleRate, {
        bass: eqBass,
        mid: eqMid,
        treble: eqTreble
      });
    }

    // 3. Special FX
    if (specialFx === 'radio' || specialFx === 'phone') {
      processed = this.applyRadioFilter(processed, sampleRate);
    } else if (specialFx === 'robot') {
      processed = this.applyRobotFilter(processed, sampleRate, 60);
    }

    // 4. Delay / Echo
    if (echoEnabled) {
      processed = this.applyEcho(processed, sampleRate, {
        delayTimeMs: echoTimeMs,
        feedback: echoFeedback,
        wetMix: echoMix
      });
    }

    // 5. Reverb
    if (reverb !== 'none') {
      const roomSize = reverb === 'cathedral' ? 0.9 : reverb === 'hall' ? 0.7 : reverb === 'studio' ? 0.45 : 0.25;
      processed = this.applyReverb(processed, sampleRate, {
        roomSize,
        wetMix: reverbMix
      });
    }

    // 6. Broadcast Compressor
    if (compressor) {
      processed = this.applyCompressor(processed, {
        thresholdDb: -18,
        ratio: 4.0,
        makeUpGainDb: 2.0
      });
    }

    // 7. Normalization & Soft Clipper
    let maxPeak = 0;
    for (let i = 0; i < processed.length; i++) {
      const abs = Math.abs(processed[i]);
      if (abs > maxPeak) maxPeak = abs;
    }

    let normFactor = 1.0;
    if (normalize && maxPeak > 0) {
      normFactor = 0.98 / maxPeak;
    }

    const totalGain = gain * normFactor;
    for (let i = 0; i < processed.length; i++) {
      let val = processed[i] * totalGain;
      // Soft saturation clipper
      if (val > 0.99) val = 0.99 + (val - 0.99) * 0.05;
      else if (val < -0.99) val = -0.99 + (val + 0.99) * 0.05;
      processed[i] = Math.max(-1.0, Math.min(1.0, val));
    }

    return processed;
  }

  /**
   * Convert Float32Array PCM to standard WAV Blob
   */
  pcmToWavBlob(pcmData, sampleRate = 22050, numChannels = 1) {
    const int16Data = this.float32ToInt16(pcmData);
    const byteLength = int16Data.length * 2;
    const buffer = new ArrayBuffer(44 + byteLength);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + byteLength, true);
    this.writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);

    // data sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, byteLength, true);

    // Write PCM 16-bit samples
    let offset = 44;
    for (let i = 0; i < int16Data.length; i++) {
      view.setInt16(offset, int16Data[i], true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  /**
   * Helper to write ASCII strings to DataView
   */
  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Convert PCM Float32Array to MP3 Blob using LAME encoder
   */
  pcmToMp3Blob(pcmData, sampleRate = 22050, bitrate = 192) {
    if (!window.lamejs || !window.lamejs.Mp3Encoder) {
      throw new Error('LAME MP3 encoder is not loaded.');
    }

    const int16Data = this.float32ToInt16(pcmData);
    const channels = 1;
    const mp3encoder = new window.lamejs.Mp3Encoder(channels, sampleRate, bitrate);
    const mp3Data = [];

    const sampleBlockSize = 1152;
    for (let i = 0; i < int16Data.length; i += sampleBlockSize) {
      const sampleChunk = int16Data.subarray(i, i + sampleBlockSize);
      const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
    }

    const mp3bufFlush = mp3encoder.flush();
    if (mp3bufFlush.length > 0) {
      mp3Data.push(mp3bufFlush);
    }

    return new Blob(mp3Data, { type: 'audio/mp3' });
  }

  /**
   * Draw interactive audio waveform on a Canvas element
   */
  drawWaveform(canvas, pcmData, progressRatio = 0, isHover = false, hoverRatio = 0) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    if (!pcmData || pcmData.length === 0) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 2;
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      return;
    }

    const barCount = Math.floor(width / 4);
    const step = Math.ceil(pcmData.length / barCount);
    const barWidth = 2.5;
    const gap = 1.5;
    const halfHeight = height / 2;

    const currentBarIndex = Math.floor(progressRatio * barCount);
    const hoverBarIndex = isHover ? Math.floor(hoverRatio * barCount) : -1;

    for (let i = 0; i < barCount; i++) {
      const start = i * step;
      let max = 0;
      for (let j = 0; j < step && (start + j) < pcmData.length; j++) {
        const val = Math.abs(pcmData[start + j]);
        if (val > max) max = val;
      }

      const barHeight = Math.max(3, max * (halfHeight - 4));
      const x = i * (barWidth + gap);
      const y = halfHeight - barHeight;

      if (i <= currentBarIndex) {
        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight * 2);
        grad.addColorStop(0, '#38bdf8');
        grad.addColorStop(1, '#818cf8');
        ctx.fillStyle = grad;
        ctx.shadowColor = 'rgba(56, 189, 248, 0.4)';
        ctx.shadowBlur = 4;
      } else if (isHover && i <= hoverBarIndex) {
        ctx.fillStyle = 'rgba(129, 140, 248, 0.6)';
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight * 2, [1.5]);
      ctx.fill();
    }

    ctx.shadowBlur = 0;

    if (progressRatio > 0 && progressRatio < 1) {
      const playheadX = progressRatio * width;
      ctx.beginPath();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 8;
      ctx.moveTo(playheadX, 2);
      ctx.lineTo(playheadX, height - 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  /**
   * Helper to format seconds as MM:SS.ms
   */
  formatDuration(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00.0';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
  }
}

window.AudioProcessor = AudioProcessor;