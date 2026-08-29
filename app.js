/**
 * Piper Voice-Over Studio - Application Controller (Clean English & SVGs)
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Core instances
  const audioProcessor = new window.AudioProcessor();
  const piperEngine = new window.PiperEngine(audioProcessor);

  // 2. DOM Elements
  const scriptInput = document.getElementById('scriptInput');
  const charCountEl = document.getElementById('charCount');
  const wordCountEl = document.getElementById('wordCount');
  const estDurationEl = document.getElementById('estDuration');
  const btnInsertPause = document.getElementById('btnInsertPause');
  const btnClearText = document.getElementById('btnClearText');
  const samplePills = document.querySelectorAll('.pill-btn[data-sample]');

  // Voice Selection Elements
  const langFilterSelect = document.getElementById('langFilterSelect');
  const voiceSelect = document.getElementById('voiceSelect');
  const voiceCountBadge = document.getElementById('voiceCountBadge');
  const voiceFlagEl = document.getElementById('voiceFlag');
  const voiceNameDisplay = document.getElementById('voiceNameDisplay');
  const voiceQualityBadge = document.getElementById('voiceQualityBadge');
  const voiceLangMeta = document.getElementById('voiceLangMeta');
  const voiceSizeMeta = document.getElementById('voiceSizeMeta');
  const voiceCacheStatus = document.getElementById('voiceCacheStatus');
  const btnTestVoice = document.getElementById('btnTestVoice');
  const speakerRow = document.getElementById('speakerRow');
  const speakerSelect = document.getElementById('speakerSelect');

  // Sliders Elements
  const speedRange = document.getElementById('speedRange');
  const speedVal = document.getElementById('speedVal');
  const noiseScaleRange = document.getElementById('noiseScaleRange');
  const noiseScaleVal = document.getElementById('noiseScaleVal');
  const noiseWRange = document.getElementById('noiseWRange');
  const noiseWVal = document.getElementById('noiseWVal');
  const volumeRange = document.getElementById('volumeRange');
  const volumeVal = document.getElementById('volumeVal');
  const btnResetSliders = document.getElementById('btnResetSliders');
  const presetButtons = document.querySelectorAll('.btn-preset');

  // Generation Elements
  const btnGenerate = document.getElementById('btnGenerate');
  const btnGenerateText = document.getElementById('btnGenerateText');
  const btnCancel = document.getElementById('btnCancel');
  const progressContainer = document.getElementById('progressContainer');
  const progressFill = document.getElementById('progressFill');
  const progressMessage = document.getElementById('progressMessage');
  const progressPercent = document.getElementById('progressPercent');

  // Audio Player Elements
  const waveformCanvas = document.getElementById('waveformCanvas');
  const waveformWrapper = document.getElementById('waveformWrapper');
  const btnPlayPause = document.getElementById('btnPlayPause');
  const playIcon = document.getElementById('playIcon');
  const btnStop = document.getElementById('btnStop');
  const btnLoop = document.getElementById('btnLoop');
  const currTimeEl = document.getElementById('currTime');
  const totalTimeEl = document.getElementById('totalTime');
  const playbackRateSelect = document.getElementById('playbackRateSelect');

  // Export Elements
  const exportGroup = document.getElementById('exportGroup');
  const mp3BitrateSelect = document.getElementById('mp3BitrateSelect');
  const btnDownloadMp3 = document.getElementById('btnDownloadMp3');
  const btnDownloadWav = document.getElementById('btnDownloadWav');

  // History & Modal Elements
  const historyList = document.getElementById('historyList');
  const btnClearHistory = document.getElementById('btnClearHistory');
  const btnHelp = document.getElementById('btnHelp');
  const btnClearCache = document.getElementById('btnClearCache');
  const helpModal = document.getElementById('helpModal');
  const btnCloseModal = document.getElementById('btnCloseModal');

  // 3. Application State
  let currentVoiceId = 'en_US-ryan-high';
  let currentAudio = new Audio();
  let currentPcmData = null;
  let currentSampleRate = 22050;
  let currentWavBlob = null;
  let currentMp3Blob = null;
  let isGenerating = false;
  let isLooping = false;
  let isDraggingWaveform = false;
  let historyItems = JSON.parse(localStorage.getItem('piper_studio_history') || '[]');

  // Presets Definition
  const PRESETS = {
    natural: { speed: 1.00, noiseScale: 0.667, noiseW: 0.800, volume: 1.00 },
    fast: { speed: 1.25, noiseScale: 0.667, noiseW: 0.750, volume: 1.10 },
    trailer: { speed: 0.85, noiseScale: 0.850, noiseW: 0.900, volume: 1.25 },
    podcast: { speed: 1.05, noiseScale: 0.620, noiseW: 0.800, volume: 1.00 },
    calm: { speed: 0.90, noiseScale: 0.550, noiseW: 0.850, volume: 0.95 }
  };

  // Sample Texts
  const SAMPLES = {
    en_us: 'Welcome to the Piper Voice-Over Studio! High quality neural text-to-speech running completely offline and locally in your browser.',
    en_gb: 'Good day! Piper TTS delivers remarkably clear, expressive and natural British English voice-overs with zero cloud latency.',
    sk: 'Vitajte v modernom štúdiu hlasových nahrávok! Piper TTS vytvára prirodzenú reč s vysokou vernosťou priamo vo vašom prehliadači.',
    cs: 'Vítejte v moderním studiu hlasových nahrávek! Piper TTS vytváří přirozenou řeč s vysokou věrností přímo ve vašem prohlížeči.'
  };

  // SVG Icons
  const ICONS = {
    play: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
    pause: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
    check: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    download: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>'
  };

  function getCountryCode(voice) {
    if (!voice || !voice.langCode) return 'US';
    const parts = voice.langCode.split('_');
    return (parts[1] || parts[0] || 'US').toUpperCase();
  }

  // 4. Initialize Voice Selection Dropdowns
  function initVoices() {
    const voices = window.PIPER_VOICES || {};
    const voiceCount = Object.keys(voices).length;
    if (voiceCountBadge) voiceCountBadge.textContent = `${voiceCount} voices`;

    if (!voices[currentVoiceId]) {
      currentVoiceId = Object.keys(voices)[0] || 'en_US-ryan-high';
    }

    populateVoiceDropdown(langFilterSelect.value || 'en', currentVoiceId);
    renderHistory();
    updateTextStats();
  }

  function populateVoiceDropdown(selectedLang = 'en', targetVoiceId = null) {
    const voices = window.PIPER_VOICES || {};
    const voiceList = Object.values(voices);
    
    // Filter voices according to language
    const filtered = voiceList.filter((v) => {
      if (selectedLang === 'all') return true;
      const prefix = v.langCode.split('_')[0].toLowerCase();
      return prefix === selectedLang.toLowerCase();
    });

    voiceSelect.innerHTML = '';

    if (filtered.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No voices found';
      voiceSelect.appendChild(opt);
      return;
    }

    // Group by language if 'all' is selected
    if (selectedLang === 'all') {
      const groups = {};
      filtered.forEach((v) => {
        const langTitle = `${v.langEnglish || v.langNative} (${v.langCode})`;
        if (!groups[langTitle]) groups[langTitle] = [];
        groups[langTitle].push(v);
      });

      for (const [langTitle, groupVoices] of Object.entries(groups)) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = langTitle;
        groupVoices.forEach((v) => {
          const opt = document.createElement('option');
          opt.value = v.id;
          const qualityTag = v.quality === 'high' ? 'HD' : v.quality === 'medium' ? 'MED' : 'FAST';
          opt.textContent = `${capitalize(v.name)} [${qualityTag}]`;
          optgroup.appendChild(opt);
        });
        voiceSelect.appendChild(optgroup);
      }
    } else {
      filtered.forEach((v) => {
        const opt = document.createElement('option');
        opt.value = v.id;
        const qualityTag = v.quality === 'high' ? 'High HD (22kHz)' : v.quality === 'medium' ? 'Medium (22kHz)' : 'Fast (16kHz)';
        opt.textContent = `${capitalize(v.name)} — ${qualityTag}`;
        voiceSelect.appendChild(opt);
      });
    }

    // Set active selected value
    if (targetVoiceId && voices[targetVoiceId]) {
      voiceSelect.value = targetVoiceId;
      currentVoiceId = targetVoiceId;
    } else if (filtered.some(v => v.id === currentVoiceId)) {
      voiceSelect.value = currentVoiceId;
    } else {
      voiceSelect.value = filtered[0].id;
      currentVoiceId = filtered[0].id;
    }

    updateActiveVoiceCard(voiceSelect.value);
  }

  function updateActiveVoiceCard(voiceId) {
    const voice = window.PIPER_VOICES?.[voiceId];
    if (!voice) return;

    currentVoiceId = voiceId;
    voiceFlagEl.textContent = getCountryCode(voice);
    
    // Voice Name & Quality
    const qualityLabel = voice.quality === 'high' ? 'High HD (22kHz)' : voice.quality === 'medium' ? 'Medium (22kHz)' : 'Fast (16kHz)';
    voiceNameDisplay.innerHTML = `${capitalize(voice.name)} <span class="badge-quality ${voice.quality}" id="voiceQualityBadge">${qualityLabel}</span>`;
    
    // Metadata
    const sizeMB = voice.sizeBytes ? (voice.sizeBytes / (1024 * 1024)).toFixed(1) + ' MB' : '~35 MB';
    voiceLangMeta.textContent = `${voice.langEnglish || voice.langNative} (${voice.langCode})`;
    voiceSizeMeta.textContent = sizeMB;

    // Check cache status
    piperEngine.isVoiceCached(voiceId).then((isCached) => {
      if (isCached) {
        voiceCacheStatus.innerHTML = `${ICONS.check} Cached in storage`;
        voiceCacheStatus.className = 'cache-pill cached';
      } else {
        voiceCacheStatus.innerHTML = `${ICONS.download} Will be downloaded`;
        voiceCacheStatus.className = 'cache-pill download';
      }
    });

    // Multi-speaker handling
    const numSpeakers = voice.numSpeakers || 1;
    const speakerMap = voice.speakerIdMap || {};
    const speakerKeys = Object.keys(speakerMap);

    if (numSpeakers > 1 || speakerKeys.length > 0) {
      speakerRow.style.display = 'flex';
      speakerSelect.innerHTML = '';
      if (speakerKeys.length > 0) {
        speakerKeys.forEach((name) => {
          const opt = document.createElement('option');
          opt.value = speakerMap[name];
          opt.textContent = `${name} (ID ${speakerMap[name]})`;
          speakerSelect.appendChild(opt);
        });
      } else {
        for (let i = 0; i < numSpeakers; i++) {
          const opt = document.createElement('option');
          opt.value = i;
          opt.textContent = `Speaker #${i + 1}`;
          speakerSelect.appendChild(opt);
        }
      }
    } else {
      speakerRow.style.display = 'none';
      speakerSelect.innerHTML = '<option value="0">0</option>';
    }
  }

  // Voice Dropdown Listeners
  voiceSelect.addEventListener('change', () => {
    if (voiceSelect.value) {
      updateActiveVoiceCard(voiceSelect.value);
    }
  });

  langFilterSelect.addEventListener('change', () => {
    populateVoiceDropdown(langFilterSelect.value);
  });

  // 5. Sliders and Presets Binding
  function updateSliderDisplay() {
    speedVal.textContent = parseFloat(speedRange.value).toFixed(2) + 'x';
    noiseScaleVal.textContent = parseFloat(noiseScaleRange.value).toFixed(3);
    noiseWVal.textContent = parseFloat(noiseWRange.value).toFixed(3);
    volumeVal.textContent = Math.round(parseFloat(volumeRange.value) * 100) + '%';
  }

  speedRange.addEventListener('input', updateSliderDisplay);
  noiseScaleRange.addEventListener('input', updateSliderDisplay);
  noiseWRange.addEventListener('input', updateSliderDisplay);
  volumeRange.addEventListener('input', updateSliderDisplay);

  btnResetSliders.addEventListener('click', () => {
    applyPreset('natural');
  });

  function applyPreset(presetKey) {
    const preset = PRESETS[presetKey];
    if (!preset) return;

    speedRange.value = preset.speed;
    noiseScaleRange.value = preset.noiseScale;
    noiseWRange.value = preset.noiseW;
    volumeRange.value = preset.volume;
    updateSliderDisplay();

    presetButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.preset === presetKey);
    });
  }

  presetButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      applyPreset(btn.dataset.preset);
    });
  });

  // 6. Text Editor Tools & Stats
  function updateTextStats() {
    const text = scriptInput.value || '';
    const charCount = text.length;
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    const wordCount = text.trim().length === 0 ? 0 : words.length;
    
    const speed = parseFloat(speedRange.value) || 1.0;
    const estSeconds = wordCount === 0 ? 0 : Math.round((wordCount / (150 * speed)) * 60);

    charCountEl.textContent = charCount;
    wordCountEl.textContent = wordCount;
    estDurationEl.textContent = estSeconds < 60 ? `~${estSeconds}s` : `~${Math.floor(estSeconds / 60)}m ${estSeconds % 60}s`;
  }

  scriptInput.addEventListener('input', updateTextStats);
  speedRange.addEventListener('change', updateTextStats);

  btnInsertPause.addEventListener('click', () => {
    const pauseTag = '... [pause 500ms] ';
    const start = scriptInput.selectionStart;
    const end = scriptInput.selectionEnd;
    const text = scriptInput.value;
    scriptInput.value = text.substring(0, start) + pauseTag + text.substring(end);
    scriptInput.selectionStart = scriptInput.selectionEnd = start + pauseTag.length;
    scriptInput.focus();
    updateTextStats();
  });

  btnClearText.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear the entire script text?')) {
      scriptInput.value = '';
      updateTextStats();
      scriptInput.focus();
    }
  });

  samplePills.forEach((pill) => {
    pill.addEventListener('click', () => {
      const sampleKey = pill.dataset.sample;
      if (SAMPLES[sampleKey]) {
        scriptInput.value = SAMPLES[sampleKey];
        updateTextStats();
        
        if (sampleKey === 'en_us') {
          langFilterSelect.value = 'en';
          populateVoiceDropdown('en', 'en_US-ryan-high');
        } else if (sampleKey === 'en_gb') {
          langFilterSelect.value = 'en';
          populateVoiceDropdown('en', 'en_GB-alan-medium');
        } else if (sampleKey === 'sk') {
          langFilterSelect.value = 'sk';
          populateVoiceDropdown('sk', 'sk_SK-lili-medium');
        } else if (sampleKey === 'cs') {
          langFilterSelect.value = 'cs';
          populateVoiceDropdown('cs', 'cs_CZ-kasandra-medium');
        }
      }
    });
  });

  // 7. Quick Voice Test Button
  btnTestVoice.addEventListener('click', async () => {
    if (isGenerating) return;
    const voice = window.PIPER_VOICES?.[currentVoiceId];
    const testText = voice?.langCode.startsWith('sk') ? 'Dobrý deň, toto je ukážka slovenského neurónového hlasu.' :
                     voice?.langCode.startsWith('cs') ? 'Dobrý den, toto je ukázka českého neuronového hlasu.' :
                     'Hello, this is a quick preview of this neural Piper voice.';

    await runSynthesis(testText, true);
  });

  // 8. Main Generation Trigger
  btnGenerate.addEventListener('click', () => {
    const text = scriptInput.value.trim();
    if (!text) {
      alert('Please enter text to generate a voice-over.');
      scriptInput.focus();
      return;
    }
    runSynthesis(text, false);
  });

  async function runSynthesis(text, isShortPreview = false) {
    if (isGenerating) return;

    try {
      isGenerating = true;
      btnGenerate.classList.add('loading');
      btnGenerate.disabled = true;
      btnGenerateText.textContent = isShortPreview ? 'Generating preview...' : 'Generating audio...';
      progressContainer.classList.add('active');
      progressFill.style.width = '5%';
      progressPercent.textContent = '5%';
      progressMessage.textContent = 'Preparing neural model...';

      const speed = parseFloat(speedRange.value) || 1.0;
      const noiseScale = parseFloat(noiseScaleRange.value) || 0.667;
      const noiseW = parseFloat(noiseWRange.value) || 0.800;
      const volume = parseFloat(volumeRange.value) || 1.0;
      const speakerId = parseInt(speakerSelect.value, 10) || 0;
      const mp3Bitrate = parseInt(mp3BitrateSelect.value, 10) || 192;

      const result = await piperEngine.synthesize({
        text,
        voiceId: currentVoiceId,
        speed,
        noiseScale,
        noiseW,
        speakerId,
        volume,
        mp3Bitrate,
        onProgress: (prog) => {
          if (prog.percent) {
            progressFill.style.width = `${prog.percent}%`;
            progressPercent.textContent = `${prog.percent}%`;
          }
          if (prog.message) {
            progressMessage.textContent = prog.message;
          }
        }
      });

      // Synthesis Completed Successfully
      currentPcmData = result.pcmData;
      currentSampleRate = result.sampleRate;
      currentWavBlob = result.wavBlob;
      currentMp3Blob = result.mp3Blob;

      // Load Audio into player
      currentAudio.src = result.mp3Url;
      currentAudio.load();

      // Enable exports
      exportGroup.style.opacity = '1';
      exportGroup.style.pointerEvents = 'auto';

      // Update Waveform Canvas
      audioProcessor.drawWaveform(waveformCanvas, currentPcmData, 0);

      // Auto-play preview
      currentAudio.play().then(() => {
        playIcon.innerHTML = ICONS.pause;
      }).catch((e) => console.log('Autoplay handled:', e));

      // Save to History (if not short sample)
      if (!isShortPreview) {
        saveToHistory({
          text,
          voiceId: currentVoiceId,
          voiceName: result.voiceName,
          duration: result.duration,
          date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          mp3Url: result.mp3Url,
          wavUrl: result.wavUrl
        });
      }

      // Update Voice Cache Status Pill
      voiceCacheStatus.innerHTML = `${ICONS.check} Cached in storage`;
      voiceCacheStatus.className = 'cache-pill cached';

    } catch (err) {
      console.error('Synthesis error:', err);
      alert(`Synthesis Error: ${err.message}`);
      progressMessage.textContent = `Error: ${err.message}`;
    } finally {
      isGenerating = false;
      btnGenerate.classList.remove('loading');
      btnGenerate.disabled = false;
      btnGenerateText.textContent = 'Generate Voice-Over';
      setTimeout(() => {
        progressContainer.classList.remove('active');
      }, 2500);
    }
  }

  // 9. Audio Player Interactivity & Waveform Scrubbing
  btnPlayPause.addEventListener('click', () => {
    if (!currentAudio.src) return;
    if (currentAudio.paused) {
      currentAudio.play();
      playIcon.innerHTML = ICONS.pause;
    } else {
      currentAudio.pause();
      playIcon.innerHTML = ICONS.play;
    }
  });

  btnStop.addEventListener('click', () => {
    if (!currentAudio.src) return;
    currentAudio.pause();
    currentAudio.currentTime = 0;
    playIcon.innerHTML = ICONS.play;
    audioProcessor.drawWaveform(waveformCanvas, currentPcmData, 0);
  });

  btnLoop.addEventListener('click', () => {
    isLooping = !isLooping;
    currentAudio.loop = isLooping;
    btnLoop.classList.toggle('active', isLooping);
  });

  playbackRateSelect.addEventListener('change', () => {
    currentAudio.playbackRate = parseFloat(playbackRateSelect.value) || 1.0;
  });

  currentAudio.addEventListener('timeupdate', () => {
    const dur = currentAudio.duration || 0;
    const cur = currentAudio.currentTime || 0;
    currTimeEl.textContent = audioProcessor.formatDuration(cur);
    totalTimeEl.textContent = audioProcessor.formatDuration(dur);

    const progressRatio = dur > 0 ? cur / dur : 0;
    audioProcessor.drawWaveform(waveformCanvas, currentPcmData, progressRatio);
  });

  currentAudio.addEventListener('ended', () => {
    if (!isLooping) {
      playIcon.innerHTML = ICONS.play;
      audioProcessor.drawWaveform(waveformCanvas, currentPcmData, 0);
    }
  });

  // Waveform Scrubbing
  function seekWaveform(e) {
    if (!currentAudio.src || !currentAudio.duration) return;
    const rect = waveformCanvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = x / rect.width;
    currentAudio.currentTime = ratio * currentAudio.duration;
    audioProcessor.drawWaveform(waveformCanvas, currentPcmData, ratio);
  }

  waveformWrapper.addEventListener('mousedown', (e) => {
    isDraggingWaveform = true;
    seekWaveform(e);
  });

  window.addEventListener('mousemove', (e) => {
    if (isDraggingWaveform) seekWaveform(e);
  });

  window.addEventListener('mouseup', () => {
    isDraggingWaveform = false;
  });

  // 10. Downloads (MP3 & WAV)
  btnDownloadMp3.addEventListener('click', () => {
    if (!currentPcmData) return;
    const bitrate = parseInt(mp3BitrateSelect.value, 10) || 192;
    const mp3Blob = audioProcessor.pcmToMp3Blob(currentPcmData, currentSampleRate, bitrate);
    downloadBlob(mp3Blob, `voiceover_${currentVoiceId}_${getTimestamp()}.mp3`);
  });

  btnDownloadWav.addEventListener('click', () => {
    if (!currentWavBlob) return;
    downloadBlob(currentWavBlob, `voiceover_${currentVoiceId}_${getTimestamp()}.wav`);
  });

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function getTimestamp() {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
  }

  // 11. History Management
  function saveToHistory(item) {
    historyItems.unshift(item);
    if (historyItems.length > 20) historyItems.pop();
    localStorage.setItem('piper_studio_history', JSON.stringify(historyItems));
    renderHistory();
  }

  function renderHistory() {
    if (!historyList) return;
    if (historyItems.length === 0) {
      historyList.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #64748b; font-size: 0.85rem;">
          No voice-overs generated in this session yet.
        </div>`;
      return;
    }

    historyList.innerHTML = '';
    historyItems.forEach((item, idx) => {
      const el = document.createElement('div');
      el.className = 'history-item';
      el.innerHTML = `
        <div class="history-info">
          <div class="history-text" title="${escapeHtml(item.text)}">"${escapeHtml(item.text)}"</div>
          <div class="history-meta">
            <span>${capitalize(item.voiceName || item.voiceId)}</span>
            <span>&bull;</span>
            <span>${audioProcessor.formatDuration(item.duration)}</span>
            <span>&bull;</span>
            <span>${item.date || ''}</span>
          </div>
        </div>
        <div class="history-actions">
          <button class="pill-btn btn-history-play" data-idx="${idx}">${ICONS.play} Play</button>
          <a class="pill-btn" href="${item.mp3Url}" download="voiceover_${item.voiceId}_${idx}.mp3">${ICONS.download} MP3</a>
        </div>
      `;
      historyList.appendChild(el);
    });

    // Bind Play from history
    document.querySelectorAll('.btn-history-play').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const item = historyItems[idx];
        if (item && item.mp3Url) {
          currentAudio.src = item.mp3Url;
          currentAudio.play();
          playIcon.innerHTML = ICONS.pause;
        }
      });
    });
  }

  btnClearHistory.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear the entire voice-over history?')) {
      historyItems = [];
      localStorage.removeItem('piper_studio_history');
      renderHistory();
    }
  });

  // 12. Modal & Cache Clean
  btnHelp.addEventListener('click', () => helpModal.classList.add('open'));
  btnCloseModal.addEventListener('click', () => helpModal.classList.remove('open'));
  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) helpModal.classList.remove('open');
  });

  btnClearCache.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear downloaded neural voice models from browser storage?')) {
      await piperEngine.clearAllModelCache();
      alert('Voice model cache cleared successfully.');
      updateActiveVoiceCard(currentVoiceId);
    }
  });

  // 13. Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      btnGenerate.click();
    } else if (e.code === 'Space' && document.activeElement !== scriptInput && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      btnPlayPause.click();
    }
  });

  // Helpers
  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Run initial setup
  initVoices();
  audioProcessor.drawWaveform(waveformCanvas, null, 0);
});