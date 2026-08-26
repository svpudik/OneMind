let thoughts = [];
let currentThoughtIndex = 0;
let currentLang = localStorage.getItem('onemind_lang') || (navigator.language.startsWith('cs') ? 'cs' : 'en');

const circle = document.getElementById('circle');
const phaseLabel = document.getElementById('phase');
const thoughtEl = document.getElementById('thought');

const translations = {
  cs: {
    inhale: "Nádech (Plnost)", exhale: "Výdech (Prázdnota)", singularity: "Singularita",
    pace: "Tempo", sound: "Zvuk", volume: "Hlasitost", off: "Vypnuto",
    frequencies: {
      brown: "Hnědý šum — Hluboké soustředění",
      432: "432 Hz harmonický — Přirozený klid",
      528: "528 Hz harmonický — Proměna",
      4: "4 Hz binaurální delta — Singularita"
    }
  },
  en: {
    inhale: "Inhale (Fullness)", exhale: "Exhale (Emptiness)", singularity: "Singularity",
    pace: "Pace", sound: "Sound", volume: "Volume", off: "Off",
    frequencies: {
      brown: "Brown Noise — Deep Focus",
      432: "432 Hz Harmonic — Natural Calm",
      528: "528 Hz Harmonic — Transformation",
      4: "4 Hz Delta Binaural — Singularity"
    }
  }
};

let currentPhaseKey = 'inhale';
let breathInterval = Number(localStorage.getItem('onemind_breath_interval')) || 4;
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
  document.getElementById('breath-interval-label').innerText = language.pace;
  document.getElementById('sound-label').innerText = language.sound;
  document.getElementById('volume-label').innerText = language.volume;
  document.getElementById('sound-toggle').setAttribute('aria-label', `${language.sound}: ${audioSettings.enabled ? language.off : language.sound}`);
  updateFrequencyOptions();
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
    updateLangUI();
    startBreathCycle();
  });

function showCurrentThought() {
  if (thoughts.length === 0) return;
  thoughtEl.innerText = thoughts[currentThoughtIndex][currentLang].text;
}

function showNextThought() {
  if (thoughts.length === 0) return;
  thoughtEl.style.opacity = '0';
  setTimeout(() => {
    currentThoughtIndex = (currentThoughtIndex + 1) % thoughts.length;
    showCurrentThought();
    thoughtEl.style.opacity = '1';
  }, 1000);
}

function startBreathCycle() {
  cycleTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
  cycleTimeouts = [];
  const intervalMs = breathInterval * 1000;
  document.documentElement.style.setProperty('--breath-duration', `${breathInterval}s`);

  // 1. Nádech
  currentPhaseKey = 'inhale';
  updateAudioPhase();
  circle.style.transform = 'scale(1.8)';
  circle.style.opacity = '1';
  phaseLabel.innerText = translations[currentLang].inhale;

  cycleTimeouts.push(setTimeout(() => {
    // 2. Výdech
    currentPhaseKey = 'exhale';
    updateAudioPhase();
    circle.style.transform = 'scale(0.8)';
    circle.style.opacity = '0.4';
    phaseLabel.innerText = translations[currentLang].exhale;

    cycleTimeouts.push(setTimeout(() => {
      // 3. Singularita
      currentPhaseKey = 'singularity';
      updateAudioPhase();
      phaseLabel.innerText = translations[currentLang].singularity;
      showNextThought();

      cycleTimeouts.push(setTimeout(() => {
        startBreathCycle();
      }, 2000));

    }, intervalMs));

  }, intervalMs));
}
// Správa témat
let currentTheme = localStorage.getItem('onemind_theme') || 'auto';

function applyTheme(theme) {
  document.body.classList.remove('theme-dark', 'theme-light');
  document.documentElement.dataset.theme = theme;
  
  if (theme === 'dark') {
    document.body.classList.add('theme-dark');
  } else if (theme === 'light') {
    document.body.classList.add('theme-light');
  }
  // Pokud je theme === 'auto', o vše se stará CSS media query @media (prefers-color-scheme: light)

  document.getElementById('btn-theme-auto').classList.toggle('active', theme === 'auto');
  document.getElementById('btn-theme-dark').classList.toggle('active', theme === 'dark');
  document.getElementById('btn-theme-light').classList.toggle('active', theme === 'light');
}

function setTheme(theme) {
  currentTheme = theme;
  localStorage.setItem('onemind_theme', theme);
  applyTheme(theme);
}

document.getElementById('btn-theme-auto').addEventListener('click', () => setTheme('auto'));
document.getElementById('btn-theme-dark').addEventListener('click', () => setTheme('dark'));
document.getElementById('btn-theme-light').addEventListener('click', () => setTheme('light'));
document.getElementById('btn-cs').addEventListener('click', () => setLanguage('cs'));
document.getElementById('btn-en').addEventListener('click', () => setLanguage('en'));
const settingsToggle = document.getElementById('settings-toggle');
const settingsPanel = document.getElementById('settings-panel');
function setSettingsOpen(isOpen) {
  settingsPanel.hidden = !isOpen;
  settingsToggle.setAttribute('aria-expanded', String(isOpen));
}
settingsToggle.addEventListener('click', () => setSettingsOpen(settingsPanel.hidden));
document.addEventListener('click', event => {
  if (!event.target.closest('.top-controls')) setSettingsOpen(false);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') setSettingsOpen(false);
});
const breathIntervalSelect = document.getElementById('breath-interval');
breathIntervalSelect.value = String(breathInterval);
breathIntervalSelect.addEventListener('change', event => {
  breathInterval = Number(event.target.value);
  localStorage.setItem('onemind_breath_interval', String(breathInterval));
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