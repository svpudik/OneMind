let thoughts = [];
let currentThoughtIndex = 0;
let currentLang = localStorage.getItem('onemind_lang') || (navigator.language.startsWith('cs') ? 'cs' : 'en');

const circle = document.getElementById('circle');
const phaseLabel = document.getElementById('phase');
const thoughtEl = document.getElementById('thought');

const translations = {
  cs: { inhale: "Nádech (Plnost)", exhale: "Výdech (Prázdnota)", singularity: "Singularita" },
  en: { inhale: "Inhale (Fullness)", exhale: "Exhale (Emptiness)", singularity: "Singularity" }
};

let currentPhaseKey = 'inhale';

function updateLangUI() {
  document.getElementById('btn-cs').classList.toggle('active', currentLang === 'cs');
  document.getElementById('btn-en').classList.toggle('active', currentLang === 'en');
  document.documentElement.lang = currentLang;
  phaseLabel.innerText = translations[currentLang][currentPhaseKey];
  showCurrentThought();
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
  // 1. Nádech
  currentPhaseKey = 'inhale';
  circle.style.transform = 'scale(1.8)';
  circle.style.opacity = '1';
  phaseLabel.innerText = translations[currentLang].inhale;

  setTimeout(() => {
    // 2. Výdech
    currentPhaseKey = 'exhale';
    circle.style.transform = 'scale(0.8)';
    circle.style.opacity = '0.4';
    phaseLabel.innerText = translations[currentLang].exhale;

    setTimeout(() => {
      // 3. Singularita
      currentPhaseKey = 'singularity';
      phaseLabel.innerText = translations[currentLang].singularity;
      showNextThought();

      setTimeout(() => {
        startBreathCycle();
      }, 2000);

    }, 4000);

  }, 4000);
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

// Spustit nastavení tématu při načtení
applyTheme(currentTheme);