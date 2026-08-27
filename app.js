let thoughts = [];
let currentThoughtIndex = 0;
let currentLang = localStorage.getItem('onemind_lang') || (navigator.language.startsWith('cs') ? 'cs' : 'en');

const circle = document.getElementById('circle');
const phaseLabel = document.getElementById('phase');
const thoughtEl = document.getElementById('thought');

const translations = {
  cs: {
    inhale: "Nádech (Plnost)", exhale: "Výdech (Prázdnota)", singularity: "Zadržení (Singularita)",
    pace: "Tempo", technique: "Technika", warmup: "Zahřátí", mainCycle: "Hlavní cyklus", cooldown: "Zklidnění",
    relax: "Uvolnění a soustředění", coherence: "Koherence", tranquility: "Klid", sound: "Zvuk", volume: "Hlasitost", off: "Vypnuto",
    frequencies: {
      brown: "Hnědý šum — Hluboké soustředění",
      432: "432 Hz harmonický — Přirozený klid",
      528: "528 Hz harmonický — Proměna",
      4: "4 Hz binaurální delta — Singularita"
    }
  },
  en: {
    inhale: "Inhale (Fullness)", exhale: "Exhale (Emptiness)", singularity: "Hold (Singularity)",
    pace: "Pace", technique: "Technique", warmup: "Warm-up", mainCycle: "Main Cycle", cooldown: "Cooldown",
    relax: "Relax and Focus", coherence: "Coherence", tranquility: "Tranquility", sound: "Sound", volume: "Volume", off: "Off",
    frequencies: {
      brown: "Brown Noise — Deep Focus",
      432: "432 Hz Harmonic — Natural Calm",
      528: "528 Hz Harmonic — Transformation",
      4: "4 Hz Delta Binaural — Singularity"
    }
  }
};

let currentPhaseKey = 'inhale';
let selectedTechnique = localStorage.getItem('onemind_breath_technique') || 'relax';
const techniques = {
  relax: {
    warmup: [[{ key: 'inhale', seconds: 4 }, { key: 'exhale', seconds: 4 }], 60],
    main: [{ key: 'inhale', seconds: 4, scale: 1.8 }, { key: 'singularity', seconds: 4, scale: 1.8 }, { key: 'exhale', seconds: 4, scale: 0.8 }, { key: 'singularity', seconds: 4, scale: 0.8 }],
    mainMinutes: 13,
    cooldown: [[{ key: 'inhale', seconds: 4 }, { key: 'exhale', seconds: 4 }], 60]
  },
  coherence: {
    warmup: [[[{ key: 'inhale', seconds: 4 }, { key: 'exhale', seconds: 4 }], 60], [[{ key: 'inhale', seconds: 5 }, { key: 'exhale', seconds: 5 }], 60]],
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
if (!techniques[selectedTechnique]) selectedTechnique = 'relax';
let cycleTimeouts = [];
let audioSettings = { enabled: false, frequency: 'off', volume: 0.35 };
try {
  audioSettings = { ...audioSettings, ...JSON.parse(localStorage.getItem('onemind_audio_settings') || '{}') };
} catch {
  localStorage.removeItem('onemind_audio_settings');
}
const validFrequencies = ['off', 'brown', '432', '528', '4'];
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
let audioGeneration = 0;
const audioProfiles = {
  brown: { level: 0.42 },
  '432': { level: 0.32 },
  '528': { level: 0.3 },
  '4': { level: 0.26 }
};

function getPhaseAudioLevel() {
  return { inhale: 1, exhale: 0.45, singularity: 0.05 }[currentPhaseKey] || 0.05;
}

function updateAudioPhase() {
  if (!audioContext || !phaseGainSource) return;
  const targetLevel = getPhaseAudioLevel();
  phaseGainSource.offset.cancelScheduledValues(audioContext.currentTime);
  phaseGainSource.offset.setValueAtTime(phaseGainSource.offset.value, audioContext.currentTime);
  phaseGainSource.offset.linearRampToValueAtTime(targetLevel, audioContext.currentTime + 0.35);
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
  if (!audioContext || !phaseGainSource) return;
  const oldSources = audioSources;
  const oldToneGain = toneGain;
  const oldPhaseGainSource = phaseGainSource;
  const oldSourceGain = sourceGain;
  audioSources = [];
  toneGain = undefined;
  phaseGainSource = undefined;
  sourceGain = undefined;
  const stopAt = audioContext.currentTime + 0.25;
  oldToneGain.gain.cancelScheduledValues(audioContext.currentTime);
  oldToneGain.gain.setValueAtTime(oldToneGain.gain.value, audioContext.currentTime);
  oldToneGain.gain.linearRampToValueAtTime(0, stopAt);
  oldSources.forEach(source => source.stop(stopAt + 0.02));
  oldPhaseGainSource.stop(stopAt + 0.02);
  oldSourceGain.disconnect();
}

function createNoiseBuffer(type = 'brown') {
  const bufferLength = audioContext.sampleRate * 2;
  const buffer = audioContext.createBuffer(1, bufferLength, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  let brownValue = 0;
  let pinkB0 = 0;
  let pinkB1 = 0;
  let pinkB2 = 0;
  let pinkB3 = 0;
  let pinkB4 = 0;
  let pinkB5 = 0;
  for (let index = 0; index < bufferLength; index += 1) {
    const whiteValue = Math.random() * 2 - 1;
    if (type === 'pink') {
      pinkB0 = 0.99886 * pinkB0 + whiteValue * 0.0555179;
      pinkB1 = 0.99332 * pinkB1 + whiteValue * 0.0750759;
      pinkB2 = 0.96900 * pinkB2 + whiteValue * 0.1538520;
      pinkB3 = 0.86650 * pinkB3 + whiteValue * 0.3104856;
      pinkB4 = 0.55000 * pinkB4 + whiteValue * 0.5329522;
      pinkB5 = -0.7616 * pinkB5 - whiteValue * 0.0168980;
      data[index] = (pinkB0 + pinkB1 + pinkB2 + pinkB3 + pinkB4 + pinkB5 + whiteValue * 0.5362) * 0.11;
    } else {
      brownValue = (brownValue + whiteValue * 0.02) / 1.02;
      data[index] = brownValue * 3.5;
    }
  }
  return buffer;
}

function createHarmonicOscillators(frequency) {
  return [frequency, frequency / 2, frequency * 1.5].map((value, index) => {
    const harmonic = audioContext.createOscillator();
    harmonic.type = index === 1 ? 'sine' : 'triangle';
    harmonic.frequency.value = value;
    return harmonic;
  });
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
    phaseGainSource.offset.value = 0;
    phaseGainSource.connect(toneGain.gain);
    sourceGain.connect(toneGain).connect(masterGain);
    if (audioSettings.frequency === 'brown') {
      const noiseSource = audioContext.createBufferSource();
      const lowPass = audioContext.createBiquadFilter();
      noiseSource.buffer = createNoiseBuffer();
      noiseSource.loop = true;
      lowPass.type = 'lowpass';
      lowPass.frequency.value = 400;
      lowPass.Q.value = 0.7;
      noiseSource.connect(lowPass).connect(sourceGain);
      audioSources.push(noiseSource);
    } else if (audioSettings.frequency === '4') {
      const merger = audioContext.createChannelMerger(2);
      const left = audioContext.createOscillator();
      const right = audioContext.createOscillator();
      left.type = 'sine';
      right.type = 'sine';
      left.frequency.value = 174;
      right.frequency.value = 178;
      left.connect(merger, 0, 0);
      right.connect(merger, 0, 1);
      merger.connect(sourceGain);
      audioSources.push(left, right);
    } else {
      const harmonics = createHarmonicOscillators(Number(audioSettings.frequency));
      harmonics.forEach(harmonic => harmonic.connect(sourceGain));
      audioSources.push(...harmonics);
    }
    phaseGainSource.start();
    audioSources.forEach(source => source.start());
    updateAudioPhase();
  }).catch(() => updateSoundUI());
}

function setSoundEnabled(enabled) {
  audioSettings.enabled = enabled;
  if (enabled && audioSettings.frequency === 'off') audioSettings.frequency = '432';
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
  document.getElementById('sound-label').innerText = language.sound;
  document.getElementById('volume-label').innerText = language.volume;
  document.getElementById('sound-toggle').setAttribute('aria-label', `${language.sound}: ${audioSettings.enabled ? language.off : language.sound}`);
  updateFrequencyOptions();
  updateTechniqueOptions();
  updateSoundUI();
  phaseLabel.innerText = translations[currentLang][currentPhaseKey];
  showCurrentThought();
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
  techniqueSelect.options[0].text = language.relax;
  techniqueSelect.options[1].text = language.coherence;
  techniqueSelect.options[2].text = language.tranquility;
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
    startBreathCycle();
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
  let elapsed = 0;
  while (elapsed < durationSeconds) {
    for (const step of steps) {
      if (elapsed >= durationSeconds) break;
      expanded.push(step);
      elapsed += step.seconds;
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
  cycleTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
  cycleTimeouts = [];
  const technique = techniques[selectedTechnique];
  const language = translations[currentLang];
  const warmupDuration = 60;
  const mainDuration = technique.mainMinutes * 60;
  const steps = [
    ...expandBlocks(technique.warmup),
    ...expandSteps(technique.main, mainDuration),
    ...expandBlocks(technique.cooldown)
  ];
  let stepIndex = 0;
  let sessionElapsed = 0;

  const runStep = () => {
    const step = steps[stepIndex];
    const section = sessionElapsed < warmupDuration ? 'warmup' : sessionElapsed < warmupDuration + mainDuration ? 'mainCycle' : 'cooldown';
    currentPhaseKey = step.key;
    updateAudioPhase();
    document.documentElement.style.setProperty('--breath-duration', `${step.seconds}s`);
    circle.style.transform = `scale(${step.scale || (step.key === 'inhale' ? 1.8 : 0.8)})`;
    circle.style.opacity = step.key === 'inhale' ? '1' : step.key === 'exhale' ? '0.4' : '0.7';
    phaseLabel.innerText = `${language[section]} · ${language[step.key]}`;
    if (stepIndex > 0) vibrateOnTransition();
    if (step.key === 'singularity') showNextThought();
    sessionElapsed += step.seconds;
    stepIndex += 1;
    cycleTimeouts.push(setTimeout(() => {
      if (stepIndex < steps.length) runStep();
      else startBreathCycle();
    }, step.seconds * 1000));
  };

  runStep();
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
  startBreathCycle();
});
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
  if (!audioContext) return;
  if (document.hidden) {
    audioGeneration++;
    stopSound();
    window.setTimeout(() => audioContext.suspend(), 300);
  } else if (audioSettings.enabled) {
    startSound();
  }
});

// Spustit nastavení tématu při načtení
applyTheme(currentTheme);