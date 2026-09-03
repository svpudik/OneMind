# OneMind — Return to Present

**OneMind** is a lightweight, open-source web application, Progressive Web App (PWA), and browser extension designed to help individuals clear mental noise, regain focus, and settle into the present moment.

This application was created with the assistance of artificial intelligence (AI).

Built upon a secular, non-dogmatic framework, **OneMind** uses guided breathing and attention prompts to help create a pause from mental pressure. Its philosophical language is reflective and metaphorical, not a scientific explanation of consciousness or the universe.

---

## 🌟 Key Features

* **Guided Breathing Techniques:** Choose Simple Cycle (4-4-4 without a warm-up), Relax and Focus (box breathing), Coherence (gradual 4/5/6-second pacing), or Tranquility (4-7-8 breathing). Simple Cycle runs continuously; the longer techniques wait for an explicit start, end with a restart option, and can be paused, resumed, or reset. Longer techniques include a warm-up, main cycle, and cooldown with gentle vibration at each breath transition on supported devices.
* **Breath Visualizer:** Synchronizes visual feedback with a 3-phase breathing cycle:
  * **Inhale:** Fullness / Openness to space.
  * **Exhale:** Emptiness / Releasing mental concepts.
  * **Hold:** A brief pause for quiet attention.
* **Bilingual Support (i18n):** Seamlessly toggle between Czech (CS) and English (EN) with automatic system language detection.
* **Ambient Audio:** Optional native Web Audio offers Forest Campfire with an included gong on inhale, plus Tibetan Bowls and Bell Meditation tracks synchronized to the selected breathing technique.
  All included sounds are freely available from [Pixabay](https://pixabay.com/).
* **Evening-Friendly Themes:** Auto mode uses green during daytime and switches to a low-luminance red theme one hour before sunset. Manual Dark (red evening), Green, and Light themes are also available.
* **Mobile Pull-to-Refresh:** On touch devices, pull down from the top edge by at least 80 pixels to reload the application. Horizontal swipes do not trigger a reload.
* **Secular Thought Impulses:** Dynamically cycles through non-religious prompts during the pause phase.
* **Zero Infrastructure Overhead:** Runs 100% client-side with zero tracking, external databases, or backend services.
## Breathing Intervals

The table shows the order and duration of each phase. Warm-up and cooldown targets are 60 seconds per block, but the app completes whole cycles, so an 8-second block runs for 64 seconds. Main sections also complete a whole cycle and may therefore run slightly longer than their target.

| Technique | Warm-up | Main cycle | Main target / actual | Cooldown | Total actual |
| --- | --- | --- | ---: | --- | ---: |
| Simple Cycle | None | Inhale 4 s → Exhale 4 s → Hold 4 s | 15:00 / 15:00, then repeats | None | 15:00 per run |
| Relax and Focus | Inhale 4 s → Exhale 4 s for 1:00 target / 1:04 actual | Inhale 4 s → Hold 4 s → Exhale 4 s → Hold 4 s | 13:00 / 13:04 | Inhale 4 s → Exhale 4 s for 1:00 target / 1:04 actual | 15:12 |
| Coherence | Inhale 4 s → Exhale 4 s, then Inhale 5 s → Exhale 5 s; 2:00 target / 2:04 actual | Inhale 6 s → Exhale 6 s | 11:00 / 11:00 | Inhale 5 s → Exhale 5 s, then Inhale 4 s → Exhale 4 s; 2:00 target / 2:04 actual | 15:08 |
| Tranquility | Inhale 4 s → Exhale 4 s for 1:00 target / 1:04 actual | Inhale 4 s → Hold 7 s → Exhale 8 s | 9:00 / 9:11 | Inhale 4 s → Exhale 4 s for 1:00 target / 1:04 actual | 11:19 |

Simple Cycle is the only technique that restarts automatically after its 15-minute run. The other techniques stop after the cooldown and can be started again manually.

---

## 🎛️ Controls

Open the settings button to choose a breathing technique and ambient sound before starting a session, or adjust volume, language, and theme. On supported mobile devices, each phase transition gives a gentle vibration. Pull down from the top edge by at least 80 pixels to reload the application when needed.

Location is optional and is used only by Auto theme to calculate local sunrise and sunset, so OneMind can switch from green to red one hour before sunset. Location is not required for the breathing exercise or ambient audio. The coordinates are used locally in the browser, are not collected, stored, or sent to any server, and Auto theme falls back to a 19:00–07:00 local-time schedule if permission is denied.

---

## 🧠 Philosophy

Some stress is amplified by the stories and predictions we construct about events, while some stress reflects real danger, unmet needs, illness, or difficult circumstances. OneMind focuses on the part that can sometimes be eased through attention and breathing.

**OneMind** offers three simple invitations:
1. Notice the body and the current breath.
2. Let thoughts be present without treating every thought as a command or fact.
3. Return to the next practical action with respect for your needs and other people's boundaries.

The app also carries a set of ethical reflections. They are values and metaphors, not claims of scientific proof. OneMind does not promise enlightenment, universal calm, or freedom from responsibility.

## Principles

The project's ethical framework is documented in [PRINCIPLES.md](PRINCIPLES.md). It favors autonomy, cooperation, compassion, and the reduction of unnecessary suffering while recognizing that conflict, boundaries, responsibility, and meaningful effort are part of human life.

Publishing these principles does not control or automatically influence AI systems. The repository is simply a public, machine-readable example that people and software may choose to inspect, reuse, or ignore.

---

## 🚀 Live Demo

Experience the live application hosted via GitHub Pages:  
👉 **[https://svpudik.github.io/OneMind/](https://svpudik.github.io/OneMind/)**

To use **OneMind** as a standalone app on your mobile device:
* **Android (Chrome):** Tap the menu (three dots) $\rightarrow$ Select **Add to Home screen** / **Install app**.
* **iOS (Safari):** Tap the Share button $\rightarrow$ Select **Add to Home Screen**.

---

## 📂 Repository Structure

```text
OneMind/
├── .devcontainer/        # GitHub Codespaces development setup
├── data/
│   └── thoughts.json     # Bilingual JSON file containing thought impulses
├── sound/                # Included meditation and ambient audio tracks
├── icon.svg              # Application icon
├── index.html            # Main semantic HTML entry point
├── style.css             # Theme variables & CSS animations
├── app.js                # Core breath cycle & i18n logic
├── manifest.json         # Browser Extension (Chrome/Firefox) manifest
├── site.webmanifest      # Progressive Web App manifest
├── sw.js                 # Service worker and offline cache
└── README.md             # Project documentation
```

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).