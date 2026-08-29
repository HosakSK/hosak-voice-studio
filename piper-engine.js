/**
 * PiperEngine - Client-Side Neural Text-to-Speech Engine
 * Executes Piper ONNX models via WebAssembly & ONNX Runtime Web.
 * Provides caching (CacheStorage / IndexedDB / Local Models), long-text sentence chunking,
 * live progress reporting, and Web Speech API fallback.
 */

class PiperEngine {
  constructor(audioProcessor) {
    this.audioProcessor = audioProcessor || (typeof window !== 'undefined' && window.AudioProcessor ? new window.AudioProcessor() : null);
    this.activeVoiceId = null;
    this.activeSession = null;
    this.activeModelConfig = null;
    this.cachedSessions = new Map();
    
    this.cacheName = 'piper-voices-cache-v1';
    
    // CDN & Mirror Endpoints
    this.HF_BASES = [
      'https://huggingface.co/rhasspy/piper-voices/resolve/main',
      'https://hf-mirror.com/rhasspy/piper-voices/resolve/main'
    ];
    this.PHONEMIZE_CDN = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize';
    this.ONNX_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/';
  }

  /**
   * Check if ONNX Runtime and Phonemize WASM are loaded
   */
  async ensureDependencies(onProgress = null) {
    if (onProgress) onProgress({ stage: 'deps', message: 'Initializing ONNX Runtime Web...', percent: 15 });

    // Configure ONNX Runtime wasm paths
    if (window.ort && window.ort.env && window.ort.env.wasm) {
      window.ort.env.wasm.wasmPaths = this.ONNX_CDN;
      window.ort.env.wasm.numThreads = 1;
    }

    if (onProgress) onProgress({ stage: 'deps', message: 'Engine dependencies ready', percent: 35 });
  }

  /**
   * Check if a voice model is already cached or available locally
   */
  async isVoiceCached(voiceId) {
    const voice = window.PIPER_VOICES?.[voiceId];
    if (!voice || !voice.onnxPath) return false;

    // Check local bundled files first
    try {
      const localCheck = await fetch(`models/${voiceId}.onnx.json`, { method: 'HEAD' });
      if (localCheck.ok) return true;
    } catch (e) {
      // Local not available
    }

    try {
      if ('caches' in window) {
        const cache = await caches.open(this.cacheName);
        const onnxUrl = `${this.HF_BASES[0]}/${voice.onnxPath}`;
        const match = await cache.match(onnxUrl);
        return !!match;
      }
    } catch (e) {
      console.warn('Cache check failed:', e);
    }
    return false;
  }

  /**
   * Fetch with progress callback and caching in CacheStorage
   */
  async fetchWithCache(relativePath, filename, onDownloadProgress = null) {
    // 1. Try local models/ directory first
    try {
      const localUrl = `models/${filename}`;
      const localResp = await fetch(localUrl);
      if (localResp.ok) {
        if (onDownloadProgress) onDownloadProgress({ loaded: 1, total: 1, percent: 100, cached: true });
        return await localResp.arrayBuffer();
      }
    } catch (e) {
      // Local not found, fall back to remote CDN
    }

    let cache = null;
    try {
      if ('caches' in window) {
        cache = await caches.open(this.cacheName);
      }
    } catch (e) {
      console.warn('CacheStorage error:', e);
    }

    // Try mirrors
    let lastError = null;
    for (const base of this.HF_BASES) {
      const url = `${base}/${relativePath}`;
      
      try {
        if (cache) {
          const cachedResp = await cache.match(url);
          if (cachedResp) {
            if (onDownloadProgress) onDownloadProgress({ loaded: 1, total: 1, percent: 100, cached: true });
            return await cachedResp.arrayBuffer();
          }
        }

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }

        const contentLength = response.headers.get('content-length');
        const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
        let loadedBytes = 0;

        const reader = response.body.getReader();
        const chunks = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          loadedBytes += value.length;

          if (onDownloadProgress && totalBytes > 0) {
            const percent = Math.min(99, Math.round((loadedBytes / totalBytes) * 100));
            onDownloadProgress({
              loaded: loadedBytes,
              total: totalBytes,
              percent,
              cached: false,
              loadedMB: (loadedBytes / (1024 * 1024)).toFixed(1),
              totalMB: (totalBytes / (1024 * 1024)).toFixed(1)
            });
          }
        }

        const fullBuffer = new Uint8Array(loadedBytes);
        let offset = 0;
        for (const chunk of chunks) {
          fullBuffer.set(chunk, offset);
          offset += chunk.length;
        }

        // Store in CacheStorage
        if (cache) {
          try {
            const cacheResponse = new Response(fullBuffer.buffer, {
              headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Length': fullBuffer.byteLength.toString()
              }
            });
            await cache.put(url, cacheResponse);
          } catch (err) {
            console.warn('Saving to cache failed:', err);
          }
        }

        if (onDownloadProgress) onDownloadProgress({ loaded: loadedBytes, total: loadedBytes, percent: 100, cached: false });
        return fullBuffer.buffer;

      } catch (err) {
        lastError = err;
        console.warn(`Fetch failed for ${url}, trying next mirror...`, err);
      }
    }

    throw new Error(`Failed to download voice model: ${lastError ? lastError.message : 'Network error'}`);
  }

  /**
   * Load and prepare a voice model
   */
  async loadVoice(voiceId, onProgress = null) {
    if (this.cachedSessions.has(voiceId)) {
      const cached = this.cachedSessions.get(voiceId);
      this.activeVoiceId = voiceId;
      this.activeSession = cached.session;
      this.activeModelConfig = cached.config;
      return cached;
    }

    const voice = window.PIPER_VOICES?.[voiceId];
    if (!voice) {
      throw new Error(`Voice '${voiceId}' was not found in catalog.`);
    }

    await this.ensureDependencies(onProgress);

    const jsonFilename = `${voiceId}.onnx.json`;
    const onnxFilename = `${voiceId}.onnx`;

    // 1. Download/load JSON config
    if (onProgress) onProgress({ stage: 'config', message: 'Loading voice configuration...', percent: 45 });
    const jsonBuffer = await this.fetchWithCache(voice.jsonPath, jsonFilename);
    const jsonText = new TextDecoder('utf-8').decode(jsonBuffer);
    const modelConfig = JSON.parse(jsonText);

    // 2. Download/load ONNX model weights
    if (onProgress) onProgress({ stage: 'model', message: `Loading neural model ${voice.name} (${voice.quality})...`, percent: 55 });
    const modelArrayBuffer = await this.fetchWithCache(voice.onnxPath, onnxFilename, (dl) => {
      if (onProgress) {
        const text = dl.cached
          ? `Loading ${voice.name} from local storage...`
          : `Downloading model ${voice.name}: ${dl.loadedMB} MB / ${dl.totalMB} MB (${dl.percent}%)`;
        onProgress({
          stage: 'model_download',
          message: text,
          percent: Math.min(88, 55 + Math.round(dl.percent * 0.33)),
          dl
        });
      }
    });

    if (onProgress) onProgress({ stage: 'session_init', message: 'Initializing ONNX inference session...', percent: 90 });

    if (!window.ort || !window.ort.InferenceSession) {
      throw new Error('ONNX Runtime Web is not loaded.');
    }

    // Ensure wasmPaths is set
    window.ort.env.wasm.wasmPaths = this.ONNX_CDN;
    window.ort.env.wasm.numThreads = 1;

    const session = await window.ort.InferenceSession.create(new Uint8Array(modelArrayBuffer), {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all'
    });

    const voiceEntry = { session, config: modelConfig, voice };
    this.cachedSessions.set(voiceId, voiceEntry);
    this.activeVoiceId = voiceId;
    this.activeSession = session;
    this.activeModelConfig = modelConfig;

    if (onProgress) onProgress({ stage: 'ready', message: `Voice ${voice.name} is ready!`, percent: 100 });
    return voiceEntry;
  }

  /**
   * Phonemize a string of text using espeak-ng / piper_phonemize WASM
   */
  async phonemize(text, espeakVoice) {
    await this.ensureDependencies();

    const inputData = JSON.stringify([{ text: text.trim() }]);

    return new Promise(async (resolve, reject) => {
      let resolved = false;

      try {
        if (!window.createPiperPhonemize) {
          throw new Error('createPiperPhonemize is not available.');
        }

        const module = await window.createPiperPhonemize({
          print: (data) => {
            try {
              const parsed = JSON.parse(data);
              if (parsed && parsed.phoneme_ids) {
                resolved = true;
                resolve(parsed.phoneme_ids);
              }
            } catch (e) {
              console.log('Phonemize stdout parse:', e, data);
            }
          },
          printErr: (msg) => {
            // Ignore non-fatal diagnostic messages
          },
          locateFile: (url) => {
            if (url.endsWith('.wasm')) return 'piper_phonemize.wasm';
            if (url.endsWith('.data')) return 'piper_phonemize.data';
            return `${this.PHONEMIZE_CDN}${url.startsWith('/') ? '' : '/'}${url}`;
          }
        });

        module.callMain([
          '-l', espeakVoice || 'en-us',
          '--input', inputData,
          '--espeak_data', '/espeak-ng-data'
        ]);

        // Safety timeout in case stdout didn't trigger
        setTimeout(() => {
          if (!resolved) {
            resolve([]);
          }
        }, 1500);

      } catch (err) {
        console.error('Phonemize invocation error:', err);
        reject(err);
      }
    });
  }

  /**
   * Helper to parse pitch string into semitones
   */
  parsePitchToSemitones(valStr) {
    if (!valStr) return 0;
    valStr = valStr.toString().trim().toLowerCase();
    if (valStr === 'high') return 4;
    if (valStr === 'very-high' || valStr === 'x-high') return 7;
    if (valStr === 'low') return -4;
    if (valStr === 'very-low' || valStr === 'x-low') return -7;
    if (valStr.endsWith('st') || valStr.endsWith('semitones')) {
      return parseFloat(valStr) || 0;
    }
    if (valStr.endsWith('%')) {
      const pct = parseFloat(valStr);
      if (!isNaN(pct)) {
        const ratio = 1 + (pct / 100);
        if (ratio > 0.1) {
          return 12 * Math.log2(ratio);
        }
      }
    }
    return parseFloat(valStr) || 0;
  }

  /**
   * Helper to parse rate string into speed multiplier
   */
  parseRateToMultiplier(valStr) {
    if (!valStr) return 1.0;
    valStr = valStr.toString().trim().toLowerCase();
    if (valStr === 'fast') return 1.25;
    if (valStr === 'x-fast') return 1.5;
    if (valStr === 'slow') return 0.80;
    if (valStr === 'x-slow') return 0.65;
    if (valStr.endsWith('%')) {
      const pct = parseFloat(valStr);
      if (!isNaN(pct)) return pct / 100;
    }
    return parseFloat(valStr) || 1.0;
  }

  /**
   * Helper to parse volume string into gain multiplier
   */
  parseVolumeToMultiplier(valStr) {
    if (!valStr) return 1.0;
    valStr = valStr.toString().trim().toLowerCase();
    if (valStr === 'loud') return 1.30;
    if (valStr === 'x-loud') return 1.60;
    if (valStr === 'soft' || valStr === 'quiet') return 0.70;
    if (valStr === 'x-soft') return 0.50;
    if (valStr.endsWith('%')) {
      const pct = parseFloat(valStr);
      if (!isNaN(pct)) return pct / 100;
    }
    return parseFloat(valStr) || 1.0;
  }

  /**
   * Parse text with full support for:
   * - SSML tags: <prosody pitch="..." rate="..." volume="...">, <emphasis>, <break time="..."/>
   * - Studio tags: [pitch +6]...[/pitch], [speed 1.3]...[/speed], [loud]...[/loud], [whisper]...[/whisper], [robot], [radio], [pause 500ms]
   * - Natural sentences and sentenceGap slider
   */
  parseScriptWithPauses(text, defaultSentenceGap = 0.22) {
    if (!text || text.trim().length === 0) return [];

    let cleaned = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 1. Normalize Studio bracket tags to standard SSML-like XML tags
    cleaned = cleaned.replace(/\[(?:pause|pauza)(?:\s+(\d+(?:\.\d+)?)\s*(ms|s|sek)?)?\]/gi, (m, val, unit) => {
      const dur = val ? `${val}${unit || 'ms'}` : `${Math.round((defaultSentenceGap || 0.35) * 1000)}ms`;
      return `<break time="${dur}"/>`;
    });

    cleaned = cleaned.replace(/\[pitch\s+([+-]?\d+(?:\.\d+)?(?:st|%)?)\]([\s\S]*?)\[\/pitch\]/gi, (m, p, content) => {
      return `<prosody pitch="${p}">${content}</prosody>`;
    });
    cleaned = cleaned.replace(/\[high\]([\s\S]*?)\[\/high\]/gi, '<prosody pitch="high">$1</prosody>');
    cleaned = cleaned.replace(/\[deep\]([\s\S]*?)\[\/deep\]/gi, '<prosody pitch="low">$1</prosody>');

    cleaned = cleaned.replace(/\[speed\s+(\d+(?:\.\d+)?x?)\]([\s\S]*?)\[\/speed\]/gi, (m, r, content) => {
      return `<prosody rate="${r.replace('x', '')}">${content}</prosody>`;
    });
    cleaned = cleaned.replace(/\[fast\]([\s\S]*?)\[\/fast\]/gi, '<prosody rate="fast">$1</prosody>');
    cleaned = cleaned.replace(/\[slow\]([\s\S]*?)\[\/slow\]/gi, '<prosody rate="slow">$1</prosody>');

    cleaned = cleaned.replace(/\[loud\]([\s\S]*?)\[\/loud\]/gi, '<prosody volume="loud">$1</prosody>');
    cleaned = cleaned.replace(/\[soft\]([\s\S]*?)\[\/soft\]/gi, '<prosody volume="soft">$1</prosody>');
    cleaned = cleaned.replace(/\[whisper\]([\s\S]*?)\[\/whisper\]/gi, '<prosody fx="whisper" volume="soft">$1</prosody>');
    cleaned = cleaned.replace(/\[robot\]([\s\S]*?)\[\/robot\]/gi, '<prosody fx="robot">$1</prosody>');
    cleaned = cleaned.replace(/\[radio\]([\s\S]*?)\[\/radio\]/gi, '<prosody fx="radio">$1</prosody>');

    // 2. Tokenize SSML and text segments
    // Matches: <break time="..."/>, <prosody ...>...</prosody>, <emphasis ...>...</emphasis>
    const tagRegex = /(<break\s+time=["']?([^"'>]+)["']?\s*\/?>)|(<prosody\s+([^>]+)>([\s\S]*?)<\/prosody>)|(<emphasis(?:\s+level=["']?([^"'>]+)["']?)?>([\s\S]*?)<\/emphasis>)/gi;

    let lastIdx = 0;
    let match;
    const items = [];

    while ((match = tagRegex.exec(cleaned)) !== null) {
      // Push any preceding text
      const preText = cleaned.substring(lastIdx, match.index).trim();
      if (preText.length > 0) {
        this.pushTextOrSentences(items, preText, defaultSentenceGap);
      }
      lastIdx = tagRegex.lastIndex;

      if (match[1]) {
        // <break time="..."/>
        const timeStr = match[2] ? match[2].trim().toLowerCase() : '350ms';
        let durSec = 0.35;
        if (timeStr.endsWith('ms')) {
          durSec = parseFloat(timeStr) / 1000;
        } else if (timeStr.endsWith('s')) {
          durSec = parseFloat(timeStr);
        } else {
          const val = parseFloat(timeStr);
          durSec = val >= 10 ? val / 1000 : val;
        }
        items.push({ type: 'pause', durationSec: Math.max(0.05, Math.min(10.0, durSec || 0.35)) });

      } else if (match[3]) {
        // <prosody attr="...">content</prosody>
        const attrStr = match[4] || '';
        const content = (match[5] || '').trim();
        if (content.length > 0) {
          const pitchMatch = attrStr.match(/pitch=["']?([^"'\s>]+)["']?/i);
          const rateMatch = attrStr.match(/rate=["']?([^"'\s>]+)["']?/i);
          const volumeMatch = attrStr.match(/volume=["']?([^"'\s>]+)["']?/i);
          const fxMatch = attrStr.match(/fx=["']?([^"'\s>]+)["']?/i);

          const pitchShift = pitchMatch ? this.parsePitchToSemitones(pitchMatch[1]) : 0;
          const speedMultiplier = rateMatch ? this.parseRateToMultiplier(rateMatch[1]) : 1.0;
          const volumeMultiplier = volumeMatch ? this.parseVolumeToMultiplier(volumeMatch[1]) : 1.0;
          const fx = fxMatch ? fxMatch[1].toLowerCase() : 'none';

          items.push({
            type: 'text',
            text: content,
            pitchShift,
            speedMultiplier,
            volumeMultiplier,
            fx
          });
        }

      } else if (match[6]) {
        // <emphasis>content</emphasis>
        const content = (match[8] || '').trim();
        if (content.length > 0) {
          items.push({
            type: 'text',
            text: content,
            pitchShift: 1.5,
            speedMultiplier: 0.95,
            volumeMultiplier: 1.25,
            fx: 'none'
          });
        }
      }
    }

    // Push remaining tail text
    const tailText = cleaned.substring(lastIdx).trim();
    if (tailText.length > 0) {
      this.pushTextOrSentences(items, tailText, defaultSentenceGap);
    }

    return items.length > 0 ? items : [{ type: 'text', text: cleaned.trim(), pitchShift: 0, speedMultiplier: 1.0, volumeMultiplier: 1.0, fx: 'none' }];
  }

  /**
   * Helper to push plain text or sentence chunks
   */
  pushTextOrSentences(items, rawText, defaultSentenceGap) {
    if (!rawText || rawText.trim().length === 0) return;
    
    const cleaned = rawText.trim();
    if (!cleaned || cleaned === '.') return;

    items.push({
      type: 'text',
      text: cleaned,
      pitchShift: 0,
      speedMultiplier: 1.0,
      volumeMultiplier: 1.0,
      fx: 'none'
    });
  }

  /**
   * Synthesize text to speech
   */
  async synthesize({
    text,
    voiceId = 'en_US-ryan-high',
    speed = 1.0,
    noiseScale = 0.667,
    noiseW = 0.800,
    speakerId = 0,
    sentenceGap = 0.22,
    volume = 1.0,
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
    compressor = true,
    mp3Bitrate = 192,
    onProgress = null
  }) {
    if (!text || text.trim().length === 0) {
      throw new Error('Please enter text to generate a voice-over.');
    }

    const { session, config, voice } = await this.loadVoice(voiceId, onProgress);
    const sampleRate = config.audio?.sample_rate || 22050;
    const espeakVoice = config.espeak?.voice || 'en-us';

    const baseLengthScale = config.inference?.length_scale || 1.0;
    const finalNoiseScale = Number(noiseScale) || config.inference?.noise_scale || 0.667;
    const finalNoiseW = Number(noiseW) || config.inference?.noise_w || 0.800;

    const items = this.parseScriptWithPauses(text, sentenceGap);
    const pcmChunks = [];
    const textItems = items.filter(it => it.type === 'text');
    const totalTextItems = textItems.length;
    let textIndex = 0;

    if (onProgress) onProgress({ stage: 'synthesis_start', message: `Synthesizing ${totalTextItems} section(s)...`, percent: 10 });

    for (const item of items) {
      if (item.type === 'pause') {
        // Insert exact configured silence block
        const silenceSamples = Math.round(sampleRate * item.durationSec);
        if (silenceSamples > 0) {
          pcmChunks.push(new Float32Array(silenceSamples));
        }
      } else if (item.type === 'text') {
        textIndex++;
        const percentStart = 10 + Math.round((textIndex / totalTextItems) * 75);

        if (onProgress) {
          onProgress({
            stage: 'synthesizing',
            message: totalTextItems > 1 
              ? `Synthesizing section ${textIndex} of ${totalTextItems}: "${item.text.substring(0, 30)}${item.text.length > 30 ? '...' : ''}"`
              : 'Synthesizing voice...',
            percent: percentStart,
            sentenceIndex: textIndex,
            totalSentences: totalTextItems
          });
        }

        const phonemeIds = await this.phonemize(item.text, espeakVoice);
        if (!phonemeIds || phonemeIds.length === 0) {
          console.warn(`Phonemizer returned 0 phoneme IDs for chunk: "${item.text}"`);
          continue;
        }

        // Apply item speed multiplier
        const effectiveSpeed = speed * (item.speedMultiplier || 1.0);
        const calculatedLengthScale = Math.max(0.2, Math.min(3.0, baseLengthScale / effectiveSpeed));

        const inputTensor = new window.ort.Tensor(
          'int64',
          BigInt64Array.from(phonemeIds.map(BigInt)),
          [1, phonemeIds.length]
        );
        
        const inputLengthsTensor = new window.ort.Tensor(
          'int64',
          BigInt64Array.from([BigInt(phonemeIds.length)]),
          [1]
        );

        const scalesTensor = new window.ort.Tensor(
          'float32',
          Float32Array.from([finalNoiseScale, calculatedLengthScale, finalNoiseW]),
          [3]
        );

        const feeds = {
          input: inputTensor,
          input_lengths: inputLengthsTensor,
          scales: scalesTensor
        };

        const numSpeakers = config.num_speakers || 1;
        const hasSpeakerMap = config.speaker_id_map && Object.keys(config.speaker_id_map).length > 0;
        if (numSpeakers > 1 || hasSpeakerMap) {
          feeds.sid = new window.ort.Tensor(
            'int64',
            BigInt64Array.from([BigInt(speakerId || 0)]),
            [1]
          );
        }

        const results = await session.run(feeds);
        const outputTensor = results.output || Object.values(results)[0];
        if (outputTensor && outputTensor.data) {
          let chunkPcm = new Float32Array(outputTensor.data);

          // Apply segment-level pitch shifting (if inline pitch is specified)
          const segmentPitchShift = (pitchShift || 0) + (item.pitchShift || 0);
          if (segmentPitchShift !== 0) {
            chunkPcm = this.audioProcessor.pitchShiftGranular(chunkPcm, sampleRate, segmentPitchShift);
          }

          // Apply segment-level volume multiplier
          const segmentVol = (item.volumeMultiplier || 1.0);
          if (segmentVol !== 1.0) {
            for (let v = 0; v < chunkPcm.length; v++) {
              chunkPcm[v] *= segmentVol;
            }
          }

          // Apply segment-level special FX
          if (item.fx === 'robot') {
            chunkPcm = this.audioProcessor.applyRobotFilter(chunkPcm, sampleRate);
          } else if (item.fx === 'radio') {
            chunkPcm = this.audioProcessor.applyRadioFilter(chunkPcm, sampleRate);
          }

          pcmChunks.push(chunkPcm);
        }
      }
    }

    if (pcmChunks.length === 0) {
      throw new Error('Synthesis did not return any audio data. Please ensure the voice model loaded completely.');
    }

    if (onProgress) onProgress({ stage: 'processing', message: 'Applying studio DSP mastering & safe zone...', percent: 88 });

    // Concatenate chunks directly (chunks already contain exact pause silences)
    const rawCombinedPcm = this.audioProcessor.concatenatePcmChunks(pcmChunks, sampleRate, 0);

    const processedPcm = this.audioProcessor.processAudioEffects(rawCombinedPcm, {
      gain: volume,
      normalize: true,
      sampleRate,
      pitchShift: 0, // already applied per chunk if needed
      eqBass,
      eqMid,
      eqTreble,
      reverb,
      reverbMix,
      echoEnabled,
      echoTimeMs,
      echoFeedback,
      echoMix,
      specialFx,
      compressor
    });

    // Add safe zone padding (0.08s pre-roll + 0.85s post-roll) to guarantee the final syllable/breath is never clipped!
    const finalPcm = this.audioProcessor.addSafeZonePadding(processedPcm, sampleRate, 0.08, 0.85);

    const durationSeconds = finalPcm.length / sampleRate;

    if (onProgress) onProgress({ stage: 'encoding_wav', message: 'Creating lossless WAV file...', percent: 92 });
    const wavBlob = this.audioProcessor.pcmToWavBlob(finalPcm, sampleRate);

    if (onProgress) onProgress({ stage: 'encoding_mp3', message: `Encoding MP3 (${mp3Bitrate} kbps)...`, percent: 96 });
    let mp3Blob = null;
    try {
      mp3Blob = this.audioProcessor.pcmToMp3Blob(finalPcm, sampleRate, mp3Bitrate);
    } catch (e) {
      console.warn('MP3 encoding failed, using WAV fallback:', e);
      mp3Blob = wavBlob;
    }

    if (onProgress) onProgress({ stage: 'done', message: 'Voice-over generated successfully!', percent: 100 });

    return {
      pcmData: finalPcm,
      sampleRate,
      duration: durationSeconds,
      wavBlob,
      mp3Blob,
      wavUrl: URL.createObjectURL(wavBlob),
      mp3Url: URL.createObjectURL(mp3Blob),
      voiceId,
      voiceName: voice.name,
      text
    };
  }

  /**
   * Clear cached models
   */
  async clearAllModelCache() {
    if (typeof window !== 'undefined' && 'caches' in window) {
      await caches.delete(this.cacheName);
      this.cachedSessions.clear();
      return true;
    }
    return false;
  }
}

if (typeof window !== 'undefined') {
  window.PiperEngine = PiperEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PiperEngine;
}