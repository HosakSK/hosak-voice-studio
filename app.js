/**
 * Piper Voice-Over Studio - Application Controller
 * Handles complete Piper TTS Voice Catalog (175 Models, 2,711 Personas),
 * Studio DSP Effects (Pitch Shift, 3-Band EQ, Reverb, Echo, Radio/Robot FX, Compressor),
 * Live Waveform Visualizer, and Lossless Export.
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
  const voiceTagsList = document.getElementById('voiceTagsList');
  const btnTestVoice = document.getElementById('btnTestVoice');
  const speakerRow = document.getElementById('speakerRow');
  const speakerSelect = document.getElementById('speakerSelect');
  const filterTagPills = document.querySelectorAll('.filter-tag-pill[data-tag]');

  // Tab Elements
  const settingsTabButtons = document.querySelectorAll('.settings-tab-btn');
  const tabVoice = document.getElementById('tabVoice');
  const tabFx = document.getElementById('tabFx');

  // Core Sliders Elements
  const speedRange = document.getElementById('speedRange');
  const speedVal = document.getElementById('speedVal');
  const pitchRange = document.getElementById('pitchRange');
  const pitchVal = document.getElementById('pitchVal');
  const noiseScaleRange = document.getElementById('noiseScaleRange');
  const noiseScaleVal = document.getElementById('noiseScaleVal');
  const noiseWRange = document.getElementById('noiseWRange');
  const noiseWVal = document.getElementById('noiseWVal');
  const gapRange = document.getElementById('gapRange');
  const gapVal = document.getElementById('gapVal');
  const volumeRange = document.getElementById('volumeRange');
  const volumeVal = document.getElementById('volumeVal');
  const btnResetSliders = document.getElementById('btnResetSliders');
  const presetButtons = document.querySelectorAll('.btn-preset');

  // Studio DSP FX Elements
  const eqBassRange = document.getElementById('eqBassRange');
  const eqBassVal = document.getElementById('eqBassVal');
  const eqMidRange = document.getElementById('eqMidRange');
  const eqMidVal = document.getElementById('eqMidVal');
  const eqTrebleRange = document.getElementById('eqTrebleRange');
  const eqTrebleVal = document.getElementById('eqTrebleVal');

  const reverbPresetSelect = document.getElementById('reverbPresetSelect');
  const reverbMixRange = document.getElementById('reverbMixRange');
  const reverbMixVal = document.getElementById('reverbMixVal');

  const echoEnabledCheckbox = document.getElementById('echoEnabledCheckbox');
  const echoControlsBox = document.getElementById('echoControlsBox');
  const echoTimeRange = document.getElementById('echoTimeRange');
  const echoTimeVal = document.getElementById('echoTimeVal');
  const echoFeedbackRange = document.getElementById('echoFeedbackRange');
  const echoFeedbackVal = document.getElementById('echoFeedbackVal');

  const specialFxSelect = document.getElementById('specialFxSelect');
  const compressorCheckbox = document.getElementById('compressorCheckbox');

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
  let activeTagFilter = 'all';
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
    kevan: {
      voiceId: 'en_GB-alan-medium',
      lang: 'en',
      speed: 0.98,       // Faster, crisp and natural theatrical tempo
      pitch: 0,          // Native pitch without granular phase artifacts
      noiseScale: 0.333, // Low noise for crystal-clear, smooth, noise-free delivery
      noiseW: 0.750,     // Crisp consonants without harsh hiss
      gap: 0.25,         // Natural, clean sentence spacing
      volume: 1.05,
      eqBass: 2,         // Subtle warmth at 120Hz
      eqMid: 1,          // Vocal clarity at 2.5kHz
      eqTreble: 0,       // Neutral treble (no noise boost)
      reverb: 'none',    // 100% Dry in-ear studio presence (zero echo/reverb)
      reverbMix: 0.00,
      echo: false,
      specialFx: 'none',
      compressor: true
    },
    natural: { speed: 1.00, pitch: 0, noiseScale: 0.667, noiseW: 0.800, volume: 1.00, gap: 0.22, eqBass: 0, eqMid: 0, eqTreble: 0, reverb: 'none', echo: false, specialFx: 'none', compressor: true },
    fast: { speed: 1.25, pitch: 0, noiseScale: 0.667, noiseW: 0.750, volume: 1.10, gap: 0.15, eqBass: 1, eqMid: 2, eqTreble: 1, reverb: 'none', echo: false, specialFx: 'none', compressor: true },
    trailer: { speed: 0.85, pitch: -3, noiseScale: 0.850, noiseW: 0.900, volume: 1.25, gap: 0.35, eqBass: 5, eqMid: 2, eqTreble: 3, reverb: 'hall', reverbMix: 0.30, echo: false, specialFx: 'none', compressor: true },
    podcast: { speed: 1.05, pitch: 0, noiseScale: 0.620, noiseW: 0.800, volume: 1.05, gap: 0.20, eqBass: 3, eqMid: 1, eqTreble: 2, reverb: 'booth', reverbMix: 0.18, echo: false, specialFx: 'none', compressor: true },
    calm: { speed: 0.90, pitch: 0, noiseScale: 0.550, noiseW: 0.850, volume: 0.95, gap: 0.30, eqBass: 0, eqMid: -1, eqTreble: 1, reverb: 'studio', reverbMix: 0.20, echo: false, specialFx: 'none', compressor: true }
  };

  // Sample Texts
  const SAMPLES = {
    kevan: 'When Stanley came to a set of two open doors, he entered the door on his left. ... [pause 450ms] This was not, in fact, the correct path, but Stanley was nothing if not persistent. ... [pause 600ms] Ah, yes. The sweet, delirious heat of a fever dream.',
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

  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
  }

  function getCountryCode(voice) {
    if (!voice || !voice.langCode) return 'US';
    const parts = voice.langCode.split('_');
    return (parts[1] || parts[0] || 'US').toUpperCase();
  }

  // 4. Tab Switching
  settingsTabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      settingsTabButtons.forEach(b => b.classList.toggle('active', b === btn));
      if (tab === 'voice') {
        tabVoice.style.display = 'block';
        tabFx.style.display = 'none';
      } else {
        tabVoice.style.display = 'none';
        tabFx.style.display = 'block';
      }
    });
  });

  // 5. Initialize Voice Selection Dropdowns & Tags
  function initVoices() {
    const voices = window.PIPER_VOICES || {};
    const voiceCount = Object.keys(voices).length;
    if (voiceCountBadge) voiceCountBadge.textContent = `${voiceCount} models • 2,711 personas`;

    if (!voices[currentVoiceId]) {
      currentVoiceId = Object.keys(voices)[0] || 'en_US-ryan-high';
    }

    populateVoiceDropdown(langFilterSelect.value || 'en', activeTagFilter, currentVoiceId);
    renderHistory();
    updateTextStats();
  }

  function populateVoiceDropdown(selectedLang = 'en', tagFilter = 'all', targetVoiceId = null) {
    const voices = window.PIPER_VOICES || {};
    const voiceList = Object.values(voices);
    
    // Filter voices according to language & tag
    const filtered = voiceList.filter((v) => {
      if (selectedLang !== 'all') {
        const prefix = v.langCode.split('_')[0].toLowerCase();
        if (prefix !== selectedLang.toLowerCase()) return false;
      }

      if (tagFilter === 'high' && v.quality !== 'high') return false;
      if (tagFilter === 'medium' && v.quality !== 'medium') return false;
      if (tagFilter === 'female' && v.gender !== 'Female') return false;
      if (tagFilter === 'male' && v.gender !== 'Male') return false;
      if (tagFilter === 'multi' && (v.numSpeakers || 1) <= 1) return false;

      return true;
    });

    voiceSelect.innerHTML = '';

    if (filtered.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No voices found matching filters';
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
          const genderTag = v.gender ? ` • ${v.gender}` : '';
          const spkTag = v.numSpeakers > 1 ? ` • ${v.numSpeakers} Personas` : '';
          opt.textContent = `${capitalize(v.name)} [${qualityTag}${genderTag}${spkTag}]`;
          optgroup.appendChild(opt);
        });
        voiceSelect.appendChild(optgroup);
      }
    } else {
      filtered.forEach((v) => {
        const opt = document.createElement('option');
        opt.value = v.id;
        const qualityTag = v.quality === 'high' ? 'High HD (22kHz)' : v.quality === 'medium' ? 'Medium (22kHz)' : 'Fast (16kHz)';
        const genderTag = v.gender && v.gender !== 'Neutral' ? ` • ${v.gender}` : '';
        const spkTag = v.numSpeakers > 1 ? ` • ${v.numSpeakers} Personas` : '';
        opt.textContent = `${capitalize(v.name)} — ${qualityTag}${genderTag}${spkTag}`;
        voiceSelect.appendChild(opt);
      });
    }

    // Set active selected value
    if (targetVoiceId && voices[targetVoiceId] && filtered.some(v => v.id === targetVoiceId)) {
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

    // Mini Tags
    if (voiceTagsList) {
      voiceTagsList.innerHTML = '';
      const tags = voice.tags || [];
      tags.forEach(t => {
        const span = document.createElement('span');
        span.className = 'voice-mini-tag';
        span.textContent = t;
        voiceTagsList.appendChild(span);
      });
    }

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
          opt.textContent = `${name} (Speaker ID ${speakerMap[name]})`;
          speakerSelect.appendChild(opt);
        });
      } else {
        for (let i = 0; i < numSpeakers; i++) {
          const opt = document.createElement('option');
          opt.value = i;
          opt.textContent = `Speaker / Persona #${i + 1}`;
          speakerSelect.appendChild(opt);
        }
      }
    } else {
      speakerRow.style.display = 'none';
      speakerSelect.innerHTML = '<option value="0">Default Speaker (0)</option>';
    }
  }

  // Tag filter pills click
  filterTagPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterTagPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeTagFilter = pill.dataset.tag;
      populateVoiceDropdown(langFilterSelect.value, activeTagFilter);
    });
  });

  // Voice Dropdown Listeners
  voiceSelect.addEventListener('change', () => {
    if (voiceSelect.value) {
      updateActiveVoiceCard(voiceSelect.value);
    }
  });

  langFilterSelect.addEventListener('change', () => {
    populateVoiceDropdown(langFilterSelect.value, activeTagFilter);
  });

  // 6. Sliders and FX Display Binding
  function updateSliderDisplay() {
    speedVal.textContent = parseFloat(speedRange.value).toFixed(2) + 'x';
    const pitch = parseInt(pitchRange.value, 10);
    pitchVal.textContent = pitch > 0 ? `+${pitch} st` : `${pitch} st`;
    noiseScaleVal.textContent = parseFloat(noiseScaleRange.value).toFixed(3);
    noiseWVal.textContent = parseFloat(noiseWRange.value).toFixed(3);
    gapVal.textContent = parseFloat(gapRange.value).toFixed(2) + 's';
    volumeVal.textContent = Math.round(parseFloat(volumeRange.value) * 100) + '%';

    // EQ
    const b = parseInt(eqBassRange.value, 10);
    const m = parseInt(eqMidRange.value, 10);
    const t = parseInt(eqTrebleRange.value, 10);
    eqBassVal.textContent = b > 0 ? `+${b} dB` : `${b} dB`;
    eqMidVal.textContent = m > 0 ? `+${m} dB` : `${m} dB`;
    eqTrebleVal.textContent = t > 0 ? `+${t} dB` : `${t} dB`;

    // Reverb & Echo
    reverbMixVal.textContent = Math.round(parseFloat(reverbMixRange.value) * 100) + '%';
    echoTimeVal.textContent = echoTimeRange.value + 'ms';
    echoFeedbackVal.textContent = Math.round(parseFloat(echoFeedbackRange.value) * 100) + '%';

    // Echo controls box state
    if (echoEnabledCheckbox.checked) {
      echoControlsBox.style.opacity = '1';
      echoControlsBox.style.pointerEvents = 'auto';
    } else {
      echoControlsBox.style.opacity = '0.4';
      echoControlsBox.style.pointerEvents = 'none';
    }
  }

  [speedRange, pitchRange, noiseScaleRange, noiseWRange, gapRange, volumeRange,
   eqBassRange, eqMidRange, eqTrebleRange, reverbMixRange, echoTimeRange, echoFeedbackRange].forEach(input => {
    input.addEventListener('input', updateSliderDisplay);
  });

  echoEnabledCheckbox.addEventListener('change', updateSliderDisplay);

  btnResetSliders.addEventListener('click', () => {
    applyPreset('natural');
  });

  function applyPreset(presetKey) {
    const preset = PRESETS[presetKey];
    if (!preset) return;

    if (preset.voiceId) {
      langFilterSelect.value = preset.lang || 'en';
      populateVoiceDropdown(preset.lang || 'en', activeTagFilter, preset.voiceId);
    }

    speedRange.value = preset.speed ?? 1.0;
    pitchRange.value = preset.pitch ?? 0;
    noiseScaleRange.value = preset.noiseScale ?? 0.667;
    noiseWRange.value = preset.noiseW ?? 0.800;
    volumeRange.value = preset.volume ?? 1.0;
    gapRange.value = preset.gap ?? 0.22;

    eqBassRange.value = preset.eqBass ?? 0;
    eqMidRange.value = preset.eqMid ?? 0;
    eqTrebleRange.value = preset.eqTreble ?? 0;

    reverbPresetSelect.value = preset.reverb ?? 'none';
    reverbMixRange.value = preset.reverbMix ?? 0.20;
    echoEnabledCheckbox.checked = !!preset.echo;
    specialFxSelect.value = preset.specialFx ?? 'none';
    compressorCheckbox.checked = preset.compressor !== undefined ? preset.compressor : true;

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

  // 7. Text Editor Tools & Stats
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
        
        if (sampleKey === 'kevan') {
          applyPreset('kevan');
        } else if (sampleKey === 'en_us') {
          langFilterSelect.value = 'en';
          populateVoiceDropdown('en', activeTagFilter, 'en_US-ryan-high');
        } else if (sampleKey === 'en_gb') {
          langFilterSelect.value = 'en';
          populateVoiceDropdown('en', activeTagFilter, 'en_GB-alan-medium');
        } else if (sampleKey === 'sk') {
          langFilterSelect.value = 'sk';
          populateVoiceDropdown('sk', activeTagFilter, 'sk_SK-lili-medium');
        } else if (sampleKey === 'cs') {
          langFilterSelect.value = 'cs';
          populateVoiceDropdown('cs', activeTagFilter, 'cs_CZ-kasandra-medium');
        }
      }
    });
  });

  // 8. Quick Voice Test Button
  btnTestVoice.addEventListener('click', async () => {
    if (isGenerating) return;
    const voice = window.PIPER_VOICES?.[currentVoiceId];
    const testText = voice?.langCode.startsWith('sk') ? 'Dobrý deň, toto je ukážka slovenského neurónového hlasu.' :
                     voice?.langCode.startsWith('cs') ? 'Dobrý den, toto je ukázka českého neuronového hlasu.' :
                     'Hello, this is a quick preview of this neural Piper voice.';

    await runSynthesis(testText, true);
  });

  // 9. Main Generation Trigger
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

      // Read all Core & DSP Parameters
      const speed = parseFloat(speedRange.value) || 1.0;
      const pitchShift = parseInt(pitchRange.value, 10) || 0;
      const noiseScale = parseFloat(noiseScaleRange.value) || 0.667;
      const noiseW = parseFloat(noiseWRange.value) || 0.800;
      const sentenceGap = parseFloat(gapRange.value) || 0.22;
      const volume = parseFloat(volumeRange.value) || 1.0;
      const speakerId = parseInt(speakerSelect.value, 10) || 0;

      const eqBass = parseInt(eqBassRange.value, 10) || 0;
      const eqMid = parseInt(eqMidRange.value, 10) || 0;
      const eqTreble = parseInt(eqTrebleRange.value, 10) || 0;

      const reverb = reverbPresetSelect.value || 'none';
      const reverbMix = parseFloat(reverbMixRange.value) || 0.20;

      const echoEnabled = echoEnabledCheckbox.checked;
      const echoTimeMs = parseInt(echoTimeRange.value, 10) || 250;
      const echoFeedback = parseFloat(echoFeedbackRange.value) || 0.35;

      const specialFx = specialFxSelect.value || 'none';
      const compressor = compressorCheckbox.checked;
      const mp3Bitrate = parseInt(mp3BitrateSelect.value, 10) || 192;

      const result = await piperEngine.synthesize({
        text,
        voiceId: currentVoiceId,
        speed,
        pitchShift,
        noiseScale,
        noiseW,
        speakerId,
        sentenceGap,
        volume,
        eqBass,
        eqMid,
        eqTreble,
        reverb,
        reverbMix,
        echoEnabled,
        echoTimeMs,
        echoFeedback,
        echoMix: 0.30,
        specialFx,
        compressor,
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

  // 10. Audio Player Interactivity & Waveform Scrubbing
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
    currTimeEl.textContent = '00:00.0';
    if (currentPcmData) {
      audioProcessor.drawWaveform(waveformCanvas, currentPcmData, 0);
    }
  });

  btnLoop.addEventListener('click', () => {
    isLooping = !isLooping;
    btnLoop.classList.toggle('active', isLooping);
    currentAudio.loop = isLooping;
  });

  playbackRateSelect.addEventListener('change', () => {
    currentAudio.playbackRate = parseFloat(playbackRateSelect.value) || 1.0;
  });

  currentAudio.addEventListener('timeupdate', () => {
    if (!currentAudio.duration) return;
    currTimeEl.textContent = audioProcessor.formatDuration(currentAudio.currentTime);
    totalTimeEl.textContent = audioProcessor.formatDuration(currentAudio.duration);

    const ratio = currentAudio.currentTime / currentAudio.duration;
    if (currentPcmData) {
      audioProcessor.drawWaveform(waveformCanvas, currentPcmData, ratio);
    }
  });

  currentAudio.addEventListener('ended', () => {
    if (!isLooping) {
      playIcon.innerHTML = ICONS.play;
      if (currentPcmData) {
        audioProcessor.drawWaveform(waveformCanvas, currentPcmData, 0);
      }
    }
  });

  // Waveform interactive scrubbing
  waveformCanvas.addEventListener('mousedown', (e) => {
    if (!currentAudio.duration) return;
    isDraggingWaveform = true;
    seekFromMouse(e);
  });

  window.addEventListener('mousemove', (e) => {
    if (isDraggingWaveform && currentAudio.duration) {
      seekFromMouse(e);
    }
  });

  window.addEventListener('mouseup', () => {
    isDraggingWaveform = false;
  });

  function seekFromMouse(e) {
    const rect = waveformCanvas.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = clickX / rect.width;
    currentAudio.currentTime = ratio * currentAudio.duration;
    if (currentPcmData) {
      audioProcessor.drawWaveform(waveformCanvas, currentPcmData, ratio);
    }
  }

  // 11. Audio Exports
  btnDownloadMp3.addEventListener('click', () => {
    if (!currentMp3Blob) return;
    const voice = window.PIPER_VOICES?.[currentVoiceId];
    const filename = `voiceover-${voice?.name || 'piper'}-${Date.now()}.mp3`;
    downloadBlob(currentMp3Blob, filename);
  });

  btnDownloadWav.addEventListener('click', () => {
    if (!currentWavBlob) return;
    const voice = window.PIPER_VOICES?.[currentVoiceId];
    const filename = `voiceover-${voice?.name || 'piper'}-${Date.now()}.wav`;
    downloadBlob(currentWavBlob, filename);
  });

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  // 12. History Drawer
  function saveToHistory(item) {
    historyItems.unshift(item);
    if (historyItems.length > 20) historyItems.pop();
    localStorage.setItem('piper_studio_history', JSON.stringify(historyItems));
    renderHistory();
  }

  function renderHistory() {
    if (!historyList) return;
    historyList.innerHTML = '';

    if (historyItems.length === 0) {
      historyList.innerHTML = '<div class="history-empty">No generated voice-overs yet. Your studio sessions will appear here.</div>';
      return;
    }

    historyItems.forEach((item, idx) => {
      const el = document.createElement('div');
      el.className = 'history-item';
      el.innerHTML = `
        <div class="history-item-top">
          <span class="history-voice">${capitalize(item.voiceName || item.voiceId)}</span>
          <span class="history-time">${item.date} • ${item.duration ? item.duration.toFixed(1) + 's' : ''}</span>
        </div>
        <div class="history-text">${item.text}</div>
        <div class="history-actions">
          <button class="btn-hist-action btn-hist-play" data-idx="${idx}">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Play
          </button>
          <a class="btn-hist-action" href="${item.mp3Url}" download="voiceover-${idx + 1}.mp3">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/></svg>
            MP3
          </a>
        </div>
      `;
      historyList.appendChild(el);
    });

    document.querySelectorAll('.btn-hist-play').forEach((btn) => {
      btn.addEventListener('click', (e) => {
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
    if (confirm('Clear all recording history?')) {
      historyItems = [];
      localStorage.removeItem('piper_studio_history');
      renderHistory();
    }
  });

  // 13. Help Modal & Cache Clear
  btnHelp.addEventListener('click', () => {
    helpModal.classList.add('active');
  });

  btnCloseModal.addEventListener('click', () => {
    helpModal.classList.remove('active');
  });

  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) helpModal.classList.remove('active');
  });

  btnClearCache.addEventListener('click', async () => {
    if (confirm('Clear all downloaded offline voice models from browser cache?')) {
      await piperEngine.clearAllModelCache();
      alert('Voice models cache cleared successfully!');
      updateActiveVoiceCard(currentVoiceId);
    }
  });

  // Start initialization
  initVoices();
  updateSliderDisplay();
});