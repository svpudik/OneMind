let thoughts = [];
let currentThoughtIndex = 0;
let currentLang = localStorage.getItem('onemind_lang') || (navigator.language.startsWith('cs') ? 'cs' : 'en');

const circle = document.getElementById('circle');
const phaseLabel = document.getElementById('phase');
const thoughtEl = document.getElementById('thought');

const translations = {
  cs: {
    inhale: "Nádech (Plnost)", exhale: "Výdech (Prázdnota)", singularity: "Zadržení (Singularita)",
    pace: "Tempo", sound: "Zvuk", volume: "Hlasitost", off: "Vypnuto", calmReminder: "Připomenout klid po 30 min", dismiss: "Zavřít",
    frequencies: {
      brown: "Hnědý šum — Hluboké soustředění",
      432: "432 Hz harmonický — Přirozený klid",
      528: "528 Hz harmonický — Proměna",
      4: "4 Hz binaurální delta — Singularita"
    }
  },
  en: {
    inhale: "Inhale (Fullness)", exhale: "Exhale (Emptiness)", singularity: "Hold (Singularity)",
    pace: "Pace", sound: "Sound", volume: "Volume", off: "Off", calmReminder: "30 min device reminder", dismiss: "Dismiss",
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
let calmReminderEnabled = localStorage.getItem('onemind_calm_reminder') === 'true';
let calmReminderTimer;
let calmReminderElapsed = 0;
let calmReminderStartedAt;
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
  updateCalmReminderUI();
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

function scheduleCalmReminder() {
  clearTimeout(calmReminderTimer);
  if (!calmReminderEnabled) return;
  calmReminderStartedAt = Date.now();
  calmReminderTimer = window.setTimeout(showCalmReminder, Math.max(0, 1800000 - calmReminderElapsed));
}

function showCalmReminder() {
  calmReminderElapsed = 0;
  calmReminderStartedAt = undefined;
  const message = currentLang === 'cs'
    ? 'Jste u obrazovky již 30 minut. Zastavte se na chvíli, nadechněte se a vraťte se ke klidu.'
    : 'You have been using a screen for 30 minutes. Take a moment to breathe and return to calm.';
  if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification('OneMind', { body: message, tag: 'onemind-calm-reminder' });
    notification.onclick = () => window.focus();
  }
  if (!document.hidden) {
    document.getElementById('calm-reminder-notification').hidden = false;
  }
}

function updateCalmReminderUI() {
  const language = translations[currentLang];
  document.getElementById('calm-reminder').checked = calmReminderEnabled;
  document.getElementById('calm-reminder-label').innerText = language.calmReminder;
  document.getElementById('calm-reminder-message').innerText = currentLang === 'cs'
    ? 'Jste u obrazovky již 30 minut. Zastavte se na chvíli, nadechněte se a vraťte se ke klidu.'
    : 'You have been using a screen for 30 minutes. Take a moment to breathe and return to calm.';
  document.getElementById('calm-reminder-dismiss').innerText = language.dismiss;
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
  
  if (effectiveTheme === 'dark') {
    document.body.classList.add('theme-dark');
  } else if (effectiveTheme === 'light') {
    document.body.classList.add('theme-light');
  } else if (effectiveTheme === 'red') {
    document.body.classList.add('theme-red');
  } else if (effectiveTheme === 'blue') {
    document.body.classList.add('theme-blue');
  }
  // Pokud je theme === 'auto', o vše se stará CSS media query @media (prefers-color-scheme: light)

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

document.getElementById('btn-theme-auto').addEventListener('click', () => setTheme('auto'));
document.getElementById('btn-theme-dark').addEventListener('click', () => setTheme('dark'));
document.getElementById('btn-theme-light').addEventListener('click', () => setTheme('light'));
document.getElementById('btn-theme-blue').addEventListener('click', () => setTheme('blue'));
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
const calmReminder = document.getElementById('calm-reminder');
calmReminder.checked = calmReminderEnabled;
calmReminder.addEventListener('change', event => {
  calmReminderEnabled = event.target.checked;
  calmReminderElapsed = 0;
  localStorage.setItem('onemind_calm_reminder', String(calmReminderEnabled));
  if (calmReminderEnabled && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
  if (!calmReminderEnabled) {
    document.getElementById('calm-reminder-notification').hidden = true;
  }
  scheduleCalmReminder();
});
document.getElementById('calm-reminder-dismiss').addEventListener('click', () => {
  document.getElementById('calm-reminder-notification').hidden = true;
  scheduleCalmReminder();
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
scheduleCalmReminder();