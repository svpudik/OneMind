let thoughts = [];
let currentThoughtIndex = 0;
let currentLang = localStorage.getItem('onemind_lang') || (navigator.language.startsWith('cs') ? 'cs' : 'en');

const circle = document.getElementById('circle');
const phaseLabel = document.getElementById('phase');
const thoughtEl = document.getElementById('thought');

const translations = {
  cs: {
    inhale: "Nádech", exhale: "Výdech", singularity: "Zadržení",
    pace: "Tempo", technique: "Technika", warmup: "Zahřátí", mainCycle: "Hlavní cyklus", cooldown: "Zklidnění",
    simple: "Jednoduchý cyklus", relax: "Uvolnění a soustředění", coherence: "Koherence", tranquility: "Klid",
    simpleDescription: "Tři jednoduché fáze bez zahřátí: nádech, výdech a zadržení po 4 sekundách.",
    relaxDescription: "Krabičkové dýchání 4-4-4-4 pro soustředění a stabilní rytmus.",
    coherenceDescription: "Postupně zpomalí dech na 5 nádechů za minutu bez zadržování.",
    tranquilityDescription: "Klidný rytmus 4-7-8 s delším výdechem a zadržením dechu.",
    pause: "Pozastavit dýchání", resume: "Pokračovat v dýchání", reset: "Restartovat dýchání", start: "Spustit sezení", end: "Sezení dokončeno", restart: "Spustit znovu", phaseLabels: "Popisky fází", sound: "Zvuk", volume: "Hlasitost", off: "Vypnuto",
    frequencies: {
      forest: "Lesní táborák — gong při nádechu",
      bowls: "Tibetské mísy — rytmus dechu",
      bell: "Meditace se zvonkem — rytmus dechu"
    }
  },
  en: {
    inhale: "Inhale", exhale: "Exhale", singularity: "Hold",
    pace: "Pace", technique: "Technique", warmup: "Warm-up", mainCycle: "Main Cycle", cooldown: "Cooldown",
    simple: "Simple Cycle", relax: "Relax and Focus", coherence: "Coherence", tranquility: "Tranquility",
    simpleDescription: "Three simple phases with no warm-up: 4 seconds each for inhale, exhale, and hold.",
    relaxDescription: "4-4-4-4 box breathing for focus and a steady rhythm.",
    coherenceDescription: "Gradually slows breathing to 5 breaths per minute with no holds.",
    tranquilityDescription: "A calm 4-7-8 rhythm with a longer exhale and breath hold.",
    pause: "Pause breathing", resume: "Resume breathing", reset: "Reset breathing", start: "Start session", end: "Session complete", restart: "Restart session", phaseLabels: "Phase labels", sound: "Sound", volume: "Volume", off: "Off",
    frequencies: {
      forest: "Forest Campfire — Gong on Inhale",
      bowls: "Tibetan Bowls — Breath Rhythm",
      bell: "Bell Meditation — Breath Rhythm"
    }
  }
};

let currentPhaseKey = 'inhale';
let sessionStatus = 'ready';
let phaseLabelsVisible = localStorage.getItem('onemind_phase_labels') !== 'false';
let selectedTechnique = localStorage.getItem('onemind_breath_technique') || 'simple';
const techniques = {
  simple: {
    warmup: [],
    main: [{ key: 'inhale', seconds: 4, scale: 1.8 }, { key: 'exhale', seconds: 4, scale: 0.8 }, { key: 'singularity', seconds: 4, scale: 0.8 }],
    mainMinutes: 15,
    cooldown: []
  },
  relax: {
    warmup: [[{ key: 'inhale', seconds: 4 }, { key: 'exhale', seconds: 4 }], 60],
    main: [{ key: 'inhale', seconds: 4, scale: 1.8 }, { key: 'singularity', seconds: 4, scale: 1.8 }, { key: 'exhale', seconds: 4, scale: 0.8 }, { key: 'singularity', seconds: 4, scale: 0.8 }],
    mainMinutes: 13,
    cooldown: [[{ key: 'inhale', seconds: 4 }, { key: 'exhale', seconds: 4 }], 60]
  },
  coherence: {
    warmup: [[{ key: 'inhale', seconds: 4 }, { key: 'exhale', seconds: 4 }], 60, [{ key: 'inhale', seconds: 5 }, { key: 'exhale', seconds: 5 }], 60],
    main: [{ key: 'inhale', seconds: 6 }, { key: 'exhale', seconds: 6 }],
    mainMinutes: 11,
    cooldown: [[{ key: 'inhale', seconds: 5 }, { key: 'exhale', seconds: 5 }], 60, [{ key: 'inhale', seconds: 4 }, { key: 'exhale', seconds: 4 }], 60]
  },
  tranquility: {
    warmup: [[{ key: 'inhale', seconds: 4 }, { key: 'exhale', seconds: 4 }], 60],
    main: [{ key: 'inhale', seconds: 4, scale: 1.8 }, { key: 'singularity', seconds: 7, scale: 1.8 }, { key: 'exhale', seconds: 8, scale: 0.8 }],
    mainMinutes: 9,
    cooldown: [[{ key: 'inhale', seconds: 4 }, { key: 'exhale', seconds: 4 }], 60]
  }
};
if (!techniques[selectedTechnique]) selectedTechnique = 'simple';
let cycleTimeouts = [];
let breathSession;
let wakeLock;
let wakeLockRequest;
let audioSettings = { enabled: false, frequency: 'off', volume: 0.35 };
try {
  audioSettings = { ...audioSettings, ...JSON.parse(localStorage.getItem('onemind_audio_settings') || '{}') };
} catch {
  localStorage.removeItem('onemind_audio_settings');
}
const validFrequencies = ['off', 'forest', 'bowls', 'bell'];
if (!validFrequencies.includes(String(audioSettings.frequency))) audioSettings.frequency = 'off';
audioSettings.frequency = String(audioSettings.frequency);
audioSettings.volume = Math.min(1, Math.max(0, Number(audioSettings.volume) || 0));
audioSettings.enabled = Boolean(audioSettings.enabled) && audioSettings.frequency !== 'off';

let audioContext;
let masterGain;
let toneGain;
let phaseGainSource;
let sourceGain;
let audioSources = [];
let ambientTrack;
let ambientTrackSource;
let rhythmTrack;
let rhythmTrackSource;
let inhaleGong;
let inhaleGongSource;
let inhaleGongGain;
let audioGeneration = 0;
const audioProfiles = {
  forest: { url: './sound/soundreality-ambient-forest-campfire-meditation-452486.mp3', level: 0.22 },
  bowls: { url: './sound/soul_frequencies-tibetan-bowls-for-meditation-498962.mp3', level: 0.35, phraseSeconds: 29, breathCycles: 2 },
  bell: { url: './sound/freesound_community-bell-meditation-75335.mp3', level: 0.35, phraseSeconds: 30, breathCycles: 1 }
};
let currentPhaseSeconds = 4;

function requestWakeLock() {
  if (!('wakeLock' in navigator) || document.visibilityState !== 'visible' || wakeLock || wakeLockRequest) return;
  wakeLockRequest = navigator.wakeLock.request('screen')
    .then(lock => {
      wakeLock = lock;
      lock.addEventListener('release', () => {
        wakeLock = undefined;
      });
    })
    .catch(() => {})
    .finally(() => {
      wakeLockRequest = undefined;
    });
}

function getBreathCycleSeconds() {
  return techniques[selectedTechnique].main.reduce((total, step) => total + step.seconds, 0);
}

function getRhythmPlaybackRate(profile) {
  const cycleSeconds = getBreathCycleSeconds();
  const cycleCount = profile.breathCycles || Math.max(1, Math.round(profile.phraseSeconds / cycleSeconds));
  return profile.phraseSeconds / (cycleCount * cycleSeconds);
}

function getPhaseAudioLevel() {
  return { inhale: 1, exhale: 0.45, singularity: 0.05 }[currentPhaseKey] || 0.05;
}

function updateAudioPhase() {
  if (!audioContext || !phaseGainSource) return;
  const targetLevel = getPhaseAudioLevel();
  phaseGainSource.offset.cancelScheduledValues(audioContext.currentTime);
  phaseGainSource.offset.setValueAtTime(phaseGainSource.offset.value, audioContext.currentTime);
  phaseGainSource.offset.linearRampToValueAtTime(targetLevel, audioContext.currentTime + Math.min(0.35, currentPhaseSeconds * 0.25));
}

function createTrack(url) {
  const track = new Audio(url);
  track.loop = true;
  track.preload = 'auto';
  return track;
}

function playInhaleGong() {
  if (!inhaleGong || !audioContext || audioContext.state !== 'running') return;
  inhaleGong.currentTime = 0;
  inhaleGong.play().catch(() => {});
}

function playRhythmOnInhale() {
  if (!rhythmTrack || !audioContext || audioContext.state !== 'running') return;
  rhythmTrack.currentTime = 0;
  rhythmTrack.play().catch(() => {});
}

function saveAudioSettings() {
  localStorage.setItem('onemind_audio_settings', JSON.stringify(audioSettings));
}

function updateSoundUI() {
  const toggle = document.getElementById('sound-toggle');
  const frequencySelect = document.getElementById('sound-frequency');
  const isPlaying = audioSettings.enabled && audioSettings.frequency !== 'off';
  toggle.innerText = isPlaying ? '🔊' : '🔇';
  toggle.classList.toggle('active', isPlaying);
  toggle.setAttribute('aria-pressed', String(isPlaying));
  frequencySelect.value = audioSettings.frequency;
}

function ensureAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;
    audioContext = new AudioContextClass();
    masterGain = audioContext.createGain();
    masterGain.gain.value = audioSettings.volume;
    masterGain.connect(audioContext.destination);
  }
  return true;
}

function stopSound() {
  if (!audioContext) return;
  const oldToneGain = toneGain;
  const oldPhaseGainSource = phaseGainSource;
  const oldSourceGain = sourceGain;
  audioSources = [];
  toneGain = undefined;
  phaseGainSource = undefined;
  sourceGain = undefined;
  if (oldToneGain && oldPhaseGainSource && oldSourceGain) {
    const stopAt = audioContext.currentTime + 0.25;
    oldToneGain.gain.cancelScheduledValues(audioContext.currentTime);
    oldToneGain.gain.setValueAtTime(oldToneGain.gain.value, audioContext.currentTime);
    oldToneGain.gain.linearRampToValueAtTime(0, stopAt);
    oldPhaseGainSource.stop(stopAt + 0.02);
    oldSourceGain.disconnect();
  }
  [ambientTrack, rhythmTrack, inhaleGong].forEach(track => {
    if (!track) return;
    track.pause();
    track.currentTime = 0;
  });
  ambientTrack = undefined;
  rhythmTrack = undefined;
  inhaleGong = undefined;
  ambientTrackSource = undefined;
  rhythmTrackSource = undefined;
  inhaleGongSource = undefined;
  inhaleGongGain = undefined;
}

function startSound() {
  if (!audioSettings.enabled || audioSettings.frequency === 'off' || !ensureAudioContext()) return;
  const generation = ++audioGeneration;
  audioContext.resume().then(() => {
    if (generation !== audioGeneration || !audioSettings.enabled || audioSettings.frequency === 'off') return;
    stopSound();
    const profile = audioProfiles[audioSettings.frequency];
    toneGain = audioContext.createGain();
    sourceGain = audioContext.createGain();
    phaseGainSource = audioContext.createConstantSource();
    sourceGain.gain.value = profile.level;
    phaseGainSource.offset.value = getPhaseAudioLevel();
    phaseGainSource.connect(toneGain.gain);
    sourceGain.connect(toneGain).connect(masterGain);
    const track = createTrack(profile.url);
    track.playbackRate = profile.phraseSeconds ? getRhythmPlaybackRate(profile) : 1;
    const trackSource = audioContext.createMediaElementSource(track);
    trackSource.connect(sourceGain);
    if (audioSettings.frequency === 'forest') {
      ambientTrack = track;
      ambientTrackSource = trackSource;
      inhaleGong = createTrack('./sound/freesound_community-singing-bowl-gong-69238.mp3');
      inhaleGong.loop = false;
      inhaleGongSource = audioContext.createMediaElementSource(inhaleGong);
      inhaleGongGain = audioContext.createGain();
      inhaleGongGain.gain.value = 0.55;
      inhaleGongSource.connect(inhaleGongGain).connect(masterGain);
    } else {
      rhythmTrack = track;
      rhythmTrackSource = trackSource;
    }
    track.volume = audioSettings.frequency === 'forest' ? 0.5 : 1;
    if (audioSettings.frequency === 'forest') track.play().catch(() => updateSoundUI());
    phaseGainSource.start();
    audioSources.forEach(source => source.start());
    updateAudioPhase();
  }).catch(() => updateSoundUI());
}

function setSoundEnabled(enabled) {
  audioSettings.enabled = enabled;
  if (enabled && audioSettings.frequency === 'off') audioSettings.frequency = 'forest';
  saveAudioSettings();
  updateSoundUI();
  if (enabled) startSound();
  else stopSound();
}

function updateLangUI() {
  document.getElementById('btn-cs').classList.toggle('active', currentLang === 'cs');
  document.getElementById('btn-en').classList.toggle('active', currentLang === 'en');
  document.documentElement.lang = currentLang;
  const language = translations[currentLang];
  document.getElementById('breath-technique-label').innerText = language.technique;
  document.getElementById('phase-label-toggle-label').innerText = language.phaseLabels;
  document.getElementById('sound-label').innerText = language.sound;
  document.getElementById('volume-label').innerText = language.volume;
  document.getElementById('sound-toggle').setAttribute('aria-label', `${language.sound}: ${audioSettings.enabled ? language.off : language.sound}`);
  updateFrequencyOptions();
  updateTechniqueOptions();
  updateBreathControlsUI();
  updateSoundUI();
  phaseLabel.innerText = translations[currentLang][currentPhaseKey];
  showCurrentThought();
}

function updatePhaseLabelUI() {
  phaseLabel.hidden = !phaseLabelsVisible;
  document.getElementById('phase-label-toggle').checked = phaseLabelsVisible;
}

function setPhaseLabelsVisible(visible) {
  phaseLabelsVisible = visible;
  localStorage.setItem('onemind_phase_labels', String(visible));
  updatePhaseLabelUI();
}

function updateFrequencyOptions() {
  const language = translations[currentLang];
  const frequencySelect = document.getElementById('sound-frequency');
  frequencySelect.options[0].text = language.off;
  Object.keys(language.frequencies).forEach((frequency, index) => {
    frequencySelect.options[index + 1].text = language.frequencies[frequency];
  });
}

function updateTechniqueOptions() {
  const language = translations[currentLang];
  const techniqueSelect = document.getElementById('breath-technique');
  techniqueSelect.options[0].text = language.simple;
  techniqueSelect.options[1].text = language.relax;
  techniqueSelect.options[2].text = language.coherence;
  techniqueSelect.options[3].text = language.tranquility;
  document.getElementById('technique-description').innerText = language[`${selectedTechnique}Description`];
}

function updateBreathControlsUI() {
  const language = translations[currentLang];
  const isPaused = breathSession && breathSession.paused;
  const sessionControls = document.getElementById('breath-session-controls');
  const playPause = document.getElementById('breath-play-pause');
  const sessionAction = document.getElementById('breath-session-action');
  sessionControls.hidden = selectedTechnique === 'simple' || sessionStatus !== 'running';
  sessionAction.hidden = selectedTechnique === 'simple' || sessionStatus === 'running';
  sessionAction.innerText = sessionStatus === 'complete' ? language.restart : language.start;
  sessionAction.setAttribute('aria-label', sessionAction.innerText);
  playPause.dataset.state = isPaused ? 'play' : 'pause';
  playPause.setAttribute('aria-pressed', String(Boolean(isPaused)));
  playPause.setAttribute('aria-label', isPaused ? language.resume : language.pause);
  document.getElementById('breath-reset').setAttribute('aria-label', language.reset);
}

function clearBreathCycle() {
  cycleTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
  cycleTimeouts = [];
  if (breathSession) breathSession.paused = true;
  stopSound();
}

function prepareBreathSession() {
  clearBreathCycle();
  breathSession = undefined;
  sessionStatus = 'ready';
  currentPhaseKey = 'inhale';
  phaseLabel.innerText = translations[currentLang].start;
  updateBreathControlsUI();
}

function completeBreathSession() {
  breathSession = undefined;
  sessionStatus = 'complete';
  currentPhaseKey = 'inhale';
  phaseLabel.innerText = translations[currentLang].end;
  circle.style.transform = 'scale(0.8)';
  circle.style.opacity = '0.4';
  stopSound();
  updateBreathControlsUI();
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('onemind_lang', lang);
  updateLangUI();
}

// Načtení JSON
fetch('./data/thoughts.json')
  .then(res => res.json())
  .then(data => {
    thoughts = data;
    shuffleThoughts();
    updateLangUI();
    if (selectedTechnique === 'simple') startBreathCycle();
    else prepareBreathSession();
  });

function shuffleThoughts(previousThoughtId) {
  for (let index = thoughts.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [thoughts[index], thoughts[randomIndex]] = [thoughts[randomIndex], thoughts[index]];
  }

  if (previousThoughtId !== undefined && thoughts.length > 1 && thoughts[0].id === previousThoughtId) {
    [thoughts[0], thoughts[1]] = [thoughts[1], thoughts[0]];
  }
}

function showCurrentThought() {
  if (thoughts.length === 0) return;
  thoughtEl.innerText = thoughts[currentThoughtIndex][currentLang].text;
}

function showNextThought() {
  if (thoughts.length === 0) return;
  thoughtEl.style.opacity = '0';
  setTimeout(() => {
    if (currentThoughtIndex === thoughts.length - 1) {
      const previousThoughtId = thoughts[currentThoughtIndex].id;
      shuffleThoughts(previousThoughtId);
      currentThoughtIndex = 0;
    } else {
      currentThoughtIndex += 1;
    }
    showCurrentThought();
    thoughtEl.style.opacity = '1';
  }, 1000);
}

function vibrateOnTransition() {
  if ('vibrate' in navigator) navigator.vibrate(35);
}

function expandSteps(steps, durationSeconds) {
  const expanded = [];
  const cycleSeconds = steps.reduce((total, step) => total + step.seconds, 0);
  const cycleCount = Math.ceil(durationSeconds / cycleSeconds);
  for (let cycle = 0; cycle < cycleCount; cycle += 1) {
    for (const step of steps) {
      expanded.push(step);
    }
  }
  return expanded;
}

function expandBlocks(blocks) {
  const expanded = [];
  for (let index = 0; index < blocks.length; index += 2) {
    expanded.push(...expandSteps(blocks[index], blocks[index + 1]));
  }
  return expanded;
}

function startBreathCycle() {
  requestWakeLock();
  cycleTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
  cycleTimeouts = [];
  const technique = techniques[selectedTechnique];
  const language = translations[currentLang];
  const warmupSteps = expandBlocks(technique.warmup);
  const warmupDuration = warmupSteps.reduce((total, step) => total + step.seconds, 0);
  const mainDuration = technique.mainMinutes * 60;
  const mainSteps = expandSteps(technique.main, mainDuration);
  const steps = [
    ...warmupSteps,
    ...mainSteps,
    ...expandBlocks(technique.cooldown)
  ];
  breathSession = { steps, stepIndex: 0, sessionElapsed: 0, paused: false };
  sessionStatus = 'running';

  const runStep = () => {
    if (breathSession.paused) return;
    const step = breathSession.steps[breathSession.stepIndex];
    const section = breathSession.sessionElapsed < warmupDuration ? 'warmup' : breathSession.sessionElapsed < warmupDuration + mainDuration ? 'mainCycle' : 'cooldown';
    currentPhaseKey = step.key;
    currentPhaseSeconds = step.seconds;
    updateAudioPhase();
    document.documentElement.style.setProperty('--breath-duration', `${step.seconds}s`);
    circle.style.transform = `scale(${step.scale || (step.key === 'inhale' ? 1.8 : 0.8)})`;
    circle.style.opacity = step.key === 'inhale' ? '1' : step.key === 'exhale' ? '0.4' : '0.7';
    phaseLabel.innerText = selectedTechnique === 'simple' ? language[step.key] : `${language[section]} · ${language[step.key]}`;
    if (breathSession.stepIndex > 0) vibrateOnTransition();
    if (step.key === 'inhale' && audioSettings.frequency === 'forest') playInhaleGong();
    if (step.key === 'inhale' && (audioSettings.frequency === 'bowls' || audioSettings.frequency === 'bell')) playRhythmOnInhale();
    if (step.key === 'singularity') showNextThought();
    breathSession.sessionElapsed += step.seconds;
    breathSession.stepIndex += 1;
    cycleTimeouts.push(setTimeout(() => {
      if (breathSession.stepIndex < breathSession.steps.length) runStep();
      else if (selectedTechnique === 'simple') startBreathCycle();
      else completeBreathSession();
    }, step.seconds * 1000));
  };

  breathSession.runStep = runStep;
  runStep();
  if (audioSettings.enabled) startSound();
  updateBreathControlsUI();
}
// Správa témat
let currentTheme = localStorage.getItem('onemind_theme') || 'auto';
let autoSunrise;
let autoSunset;
let autoCoordinates;
let autoThemeTimer;
let autoLocationRequested = false;

function solarEvent(date, latitude, longitude, sunrise) {
  const day = Math.ceil((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
  const longitudeHour = longitude / 15;
  const approximateTime = day + ((sunrise ? 6 : 18) - longitudeHour) / 24;
  const meanAnomaly = 0.9856 * approximateTime - 3.289;
  const solarLongitude = (meanAnomaly + 1.916 * Math.sin(meanAnomaly * Math.PI / 180) + 0.02 * Math.sin(2 * meanAnomaly * Math.PI / 180) + 282.634 + 360) % 360;
  let rightAscension = Math.atan(0.91764 * Math.tan(solarLongitude * Math.PI / 180)) * 180 / Math.PI;
  rightAscension = (rightAscension + 360) % 360;
  rightAscension += Math.floor(solarLongitude / 90) * 90 - Math.floor(rightAscension / 90) * 90;
  rightAscension /= 15;
  const sineDeclination = 0.39782 * Math.sin(solarLongitude * Math.PI / 180);
  const cosineDeclination = Math.cos(Math.asin(sineDeclination));
  const latitudeRadians = latitude * Math.PI / 180;
  const cosineHourAngle = (Math.cos(90.833 * Math.PI / 180) - sineDeclination * Math.sin(latitudeRadians)) / (cosineDeclination * Math.cos(latitudeRadians));
  if (cosineHourAngle < -1 || cosineHourAngle > 1) return undefined;
  let hourAngle = Math.acos(cosineHourAngle) * 180 / Math.PI;
  if (sunrise) hourAngle = 360 - hourAngle;
  hourAngle /= 15;
  const universalTime = (hourAngle + rightAscension - 0.06571 * approximateTime - 6.622 - longitudeHour + 24) % 24;
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0) + universalTime * 3600000);
}

function normalizeSolarEvent(event, now, sunrise) {
  if (!event) return undefined;
  const day = 86400000;
  if (sunrise && event > now.getTime() + 21600000) return new Date(event.getTime() - day);
  if (!sunrise && event < now.getTime() - 21600000) return new Date(event.getTime() + day);
  return event;
}

function isAutoEvening() {
  const now = new Date();
  if (!autoSunrise || !autoSunset) {
    const hour = now.getHours();
    return hour >= 19 || hour < 7;
  }
  return now >= new Date(autoSunset.getTime() - 3600000) || now < autoSunrise;
}

function requestAutoLocation() {
  if (autoLocationRequested || !navigator.geolocation) return;
  autoLocationRequested = true;
  navigator.geolocation.getCurrentPosition(position => {
    autoCoordinates = position.coords;
    if (currentTheme === 'auto') applyTheme('auto');
  }, () => {}, { maximumAge: 86400000, timeout: 5000 });
}

function applyTheme(theme) {
  if (theme === 'auto' && autoCoordinates) {
    const now = new Date();
    autoSunrise = normalizeSolarEvent(solarEvent(now, autoCoordinates.latitude, autoCoordinates.longitude, true), now, true);
    autoSunset = normalizeSolarEvent(solarEvent(now, autoCoordinates.latitude, autoCoordinates.longitude, false), now, false);
  }
  const effectiveTheme = theme === 'auto' ? (isAutoEvening() ? 'red' : 'blue') : theme;
  document.body.classList.remove('theme-dark', 'theme-light', 'theme-red', 'theme-blue');
  document.documentElement.dataset.theme = effectiveTheme;
  document.body.dataset.theme = effectiveTheme;
  
  if (effectiveTheme === 'dark') {
    document.body.classList.add('theme-dark');
  } else if (effectiveTheme === 'light') {
    document.body.classList.add('theme-light');
  } else if (effectiveTheme === 'red') {
    document.body.classList.add('theme-red');
  } else if (effectiveTheme === 'blue') {
    document.body.classList.add('theme-blue');
  }
  document.getElementById('btn-theme-auto').classList.toggle('active', theme === 'auto');
  document.getElementById('btn-theme-dark').classList.toggle('active', theme === 'dark');
  document.getElementById('btn-theme-light').classList.toggle('active', theme === 'light');
  document.getElementById('btn-theme-blue').classList.toggle('active', theme === 'blue');
  clearTimeout(autoThemeTimer);
  if (theme === 'auto') {
    requestAutoLocation();
    autoThemeTimer = window.setTimeout(() => applyTheme('auto'), 60000);
  }
}

function setTheme(theme) {
  currentTheme = theme;
  localStorage.setItem('onemind_theme', theme);
  applyTheme(theme);
}

const settingsToggle = document.getElementById('settings-toggle');
const settingsPanel = document.getElementById('settings-panel');
function setSettingsOpen(isOpen) {
  settingsPanel.hidden = !isOpen;
  settingsToggle.setAttribute('aria-expanded', String(isOpen));
}
function handleControlActivation(event) {
  const control = event.target.closest('button');
  if (!control || !control.closest('.top-controls')) return;
  if (event.type === 'pointerup' && control.dataset.pointerHandled === 'true') return;
  if (event.type === 'pointerup') control.dataset.pointerHandled = 'true';
  if (control === settingsToggle) setSettingsOpen(settingsPanel.hidden);
  else if (control.id === 'btn-theme-auto') setTheme('auto');
  else if (control.id === 'btn-theme-dark') setTheme('dark');
  else if (control.id === 'btn-theme-light') setTheme('light');
  else if (control.id === 'btn-theme-blue') setTheme('blue');
  else if (control.id === 'btn-cs') setLanguage('cs');
  else if (control.id === 'btn-en') setLanguage('en');
}

document.addEventListener('pointerup', handleControlActivation);
document.addEventListener('click', handleControlActivation);
document.addEventListener('click', event => {
  if (!event.target.closest('.top-controls')) setSettingsOpen(false);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') setSettingsOpen(false);
});
const pullRefreshIndicator = document.getElementById('pull-refresh-indicator');
let pullRefreshStartY;
let pullRefreshStartX;
let pullRefreshDistance = 0;
let pullRefreshTracking = false;
const pullRefreshThreshold = 80;

document.addEventListener('touchstart', event => {
  if (event.touches.length !== 1 || window.scrollY > 0) return;
  pullRefreshStartY = event.touches[0].clientY;
  pullRefreshStartX = event.touches[0].clientX;
  pullRefreshDistance = 0;
  pullRefreshTracking = true;
}, { passive: true });

document.addEventListener('touchmove', event => {
  if (!pullRefreshTracking || event.touches.length !== 1) return;
  const horizontalDistance = Math.abs(event.touches[0].clientX - pullRefreshStartX);
  pullRefreshDistance = Math.max(0, event.touches[0].clientY - pullRefreshStartY);
  if (horizontalDistance > pullRefreshDistance) {
    pullRefreshTracking = false;
    pullRefreshIndicator.classList.remove('active', 'ready');
    pullRefreshIndicator.style.transform = '';
    return;
  }
  if (pullRefreshDistance === 0) return;
  event.preventDefault();
  const progress = Math.min(1, pullRefreshDistance / pullRefreshThreshold);
  pullRefreshIndicator.classList.add('active');
  pullRefreshIndicator.style.transform = `translate(-50%, ${Math.min(52, 12 + progress * 40)}px)`;
  pullRefreshIndicator.classList.toggle('ready', progress === 1);
}, { passive: false });

document.addEventListener('touchend', () => {
  if (!pullRefreshTracking) return;
  const shouldReload = pullRefreshDistance >= pullRefreshThreshold;
  pullRefreshTracking = false;
  pullRefreshDistance = 0;
  pullRefreshIndicator.classList.remove('active', 'ready');
  pullRefreshIndicator.style.transform = '';
  if (shouldReload) window.location.reload();
}, { passive: true });

document.addEventListener('touchcancel', () => {
  pullRefreshTracking = false;
  pullRefreshDistance = 0;
  pullRefreshIndicator.classList.remove('active', 'ready');
  pullRefreshIndicator.style.transform = '';
}, { passive: true });
const breathTechniqueSelect = document.getElementById('breath-technique');
breathTechniqueSelect.value = selectedTechnique;
breathTechniqueSelect.addEventListener('change', event => {
  selectedTechnique = event.target.value;
  localStorage.setItem('onemind_breath_technique', selectedTechnique);
  updateTechniqueOptions();
  if (selectedTechnique === 'simple') startBreathCycle();
  else prepareBreathSession();
});
const phaseLabelToggle = document.getElementById('phase-label-toggle');
phaseLabelToggle.checked = phaseLabelsVisible;
phaseLabelToggle.addEventListener('change', event => setPhaseLabelsVisible(event.target.checked));
document.getElementById('breath-session-action').addEventListener('click', () => startBreathCycle());
document.getElementById('breath-play-pause').addEventListener('click', () => {
  if (!breathSession) return;
  if (breathSession.paused) {
    breathSession.paused = false;
    breathSession.runStep();
  } else {
    breathSession.paused = true;
    const currentStep = breathSession.steps[breathSession.stepIndex - 1];
    breathSession.stepIndex -= 1;
    breathSession.sessionElapsed -= currentStep.seconds;
    cycleTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    cycleTimeouts = [];
  }
  updateBreathControlsUI();
});
document.getElementById('breath-reset').addEventListener('click', () => startBreathCycle());
const soundToggle = document.getElementById('sound-toggle');
const soundFrequencySelect = document.getElementById('sound-frequency');
const soundVolume = document.getElementById('sound-volume');
soundVolume.value = String(Math.round(audioSettings.volume * 100));
soundToggle.addEventListener('click', () => setSoundEnabled(!audioSettings.enabled));
soundFrequencySelect.addEventListener('change', event => {
  audioSettings.frequency = event.target.value;
  audioSettings.enabled = audioSettings.frequency !== 'off';
  saveAudioSettings();
  updateSoundUI();
  if (audioSettings.enabled) startSound();
  else stopSound();
});
soundVolume.addEventListener('input', event => {
  audioSettings.volume = Number(event.target.value) / 100;
  saveAudioSettings();
  if (masterGain && audioContext) {
    masterGain.gain.cancelScheduledValues(audioContext.currentTime);
    masterGain.gain.linearRampToValueAtTime(audioSettings.volume, audioContext.currentTime + 0.1);
  }
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) requestWakeLock();
  if (!audioContext) return;
  if (document.hidden) {
    audioGeneration++;
    stopSound();
    window.setTimeout(() => audioContext.suspend(), 300);
  } else if (audioSettings.enabled) {
    startSound();
  }
});
document.addEventListener('pointerdown', requestWakeLock);
document.addEventListener('keydown', requestWakeLock);

// Spustit nastavení tématu při načtení
applyTheme(currentTheme);
updatePhaseLabelUI();