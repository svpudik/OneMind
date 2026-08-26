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
      432: "432 Hz — Přírodní klid",
      528: "528 Hz — Přítomnost a proměna",
      639: "639 Hz — Spojení a soucit (Mettá)",
      174: "174 Hz — Základ a úleva od stresu",
      4: "4 Hz — Hluboké ticho a singularita"
    }
  },
  en: {
    inhale: "Inhale (Fullness)", exhale: "Exhale (Emptiness)", singularity: "Singularity",
    pace: "Pace", sound: "Sound", volume: "Volume", off: "Off",
    frequencies: {
      432: "432 Hz — Natural Clarity & Harmony",
      528: "528 Hz — Presence & Transformation",
      639: "639 Hz — Connection & Compassion (Mettá)",
      174: "174 Hz — Foundation & Stress Relief",
      4: "4 Hz — Deep Silence & Singularity"
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
const validFrequencies = ['off', '432', '528', '639', '174', '4'];
if (!validFrequencies.includes(String(audioSettings.frequency))) audioSettings.frequency = 'off';
audioSettings.frequency = String(audioSettings.frequency);
audioSettings.volume = Math.min(1, Math.max(0, Number(audioSettings.volume) || 0));
audioSettings.enabled = Boolean(audioSettings.enabled) && audioSettings.frequency !== 'off';

let audioContext;
let masterGain;
let oscillator;
let toneGain;
let audioGeneration = 0;

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
  if (!audioContext || !oscillator) return;
  const oldOscillator = oscillator;
  const oldToneGain = toneGain;
  oscillator = undefined;
  toneGain = undefined;
  const stopAt = audioContext.currentTime + 0.25;
  oldToneGain.gain.cancelScheduledValues(audioContext.currentTime);
  oldToneGain.gain.setValueAtTime(oldToneGain.gain.value, audioContext.currentTime);
  oldToneGain.gain.linearRampToValueAtTime(0, stopAt);
  oldOscillator.stop(stopAt + 0.02);
}

function startSound() {
  if (!audioSettings.enabled || audioSettings.frequency === 'off' || !ensureAudioContext()) return;
  const generation = ++audioGeneration;
  audioContext.resume().then(() => {
    if (generation !== audioGeneration || !audioSettings.enabled || audioSettings.frequency === 'off') return;
    stopSound();
    oscillator = audioContext.createOscillator();
    toneGain = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = Number(audioSettings.frequency);
    toneGain.gain.setValueAtTime(0, audioContext.currentTime);
    toneGain.gain.linearRampToValueAtTime(1, audioContext.currentTime + 0.35);
    oscillator.connect(toneGain).connect(masterGain);
    oscillator.start();
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
  circle.style.transform = 'scale(1.8)';
  circle.style.opacity = '1';
  phaseLabel.innerText = translations[currentLang].inhale;

  cycleTimeouts.push(setTimeout(() => {
    // 2. Výdech
    currentPhaseKey = 'exhale';
    circle.style.transform = 'scale(0.8)';
    circle.style.opacity = '0.4';
    phaseLabel.innerText = translations[currentLang].exhale;

    cycleTimeouts.push(setTimeout(() => {
      // 3. Singularita
      currentPhaseKey = 'singularity';
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