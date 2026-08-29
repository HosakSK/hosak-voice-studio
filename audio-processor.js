/**
 * AudioProcessor - Studio Audio Engine for Piper Voice-Over Studio
 * Handles PCM manipulation, WAV creation, MP3 encoding via lamejs,
 * Web Audio post-processing (gain, normalization), and waveform visualization.
 */

class AudioProcessor {
  constructor() {
    this.audioCtx = null;
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
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
   * Normalize and apply master gain to Float32Array PCM
   */
  processAudioEffects(pcmData, { gain = 1.0, normalize = true } = {}) {
    if (!pcmData || pcmData.length === 0) return pcmData;

    let processed = new Float32Array(pcmData);

    // Find peak for normalization
    let maxPeak = 0;
    for (let i = 0; i < processed.length; i++) {
      const abs = Math.abs(processed[i]);
      if (abs > maxPeak) maxPeak = abs;
    }

    let normFactor = 1.0;
    if (normalize && maxPeak > 0) {
      // Normalize to -0.2 dB ceiling (0.977)
      normFactor = 0.977 / maxPeak;
    }

    // Apply combined gain
    const totalGain = gain * normFactor;
    for (let i = 0; i < processed.length; i++) {
      let val = processed[i] * totalGain;
      // Soft clipper to prevent harsh digital distortion
      if (val > 0.99) val = 0.99 + (val - 0.99) * 0.1;
      else if (val < -0.99) val = -0.99 + (val + 0.99) * 0.1;
      processed[i] = Math.max(-1.0, Math.min(1.0, val));
    }

    return processed;
  }

  /**
   * Concatenate multiple PCM chunks with silence gaps (in seconds)
   */
  concatenatePcmChunks(chunks, sampleRate, gapDurationSeconds = 0.25) {
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
    const tenths = Math.floor((seconds % 1) * 10);
    const mStr = mins.toString().padStart(2, '0');
    const sStr = secs.toString().padStart(2, '0');
    return `${mStr}:${sStr}.${tenths}`;
  }
}

window.AudioProcessor = AudioProcessor;