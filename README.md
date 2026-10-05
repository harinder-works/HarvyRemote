# HarvyRemote 📺

A modern, tactile, universal Smart TV remote web application and Progressive Web App (PWA). Designed with tactile hardware aesthetics, multi-brand Smart TV network control, live channels quick launcher, on-screen TV keyboard, and voice search integration.

## ✨ Features

- **Universal Smart TV Support**:
  - Google TV & Android TV (Sony Bravia, Chromecast with Google TV, TCL, Xiaomi, Philips, Shield TV)
  - Samsung Smart TV (Tizen OS WebSocket Remote API)
  - LG Smart TV (webOS WebSocket Protocol)
  - Roku Streaming Players & Roku TVs (ECP HTTP REST API)
  - Fire TV & Custom Generic Smart TVs
- **Tactile Pebble Remote Design**:
  - Smooth ergonomic casing with side volume rocker (+ / −)
  - Directional D-Pad with central Select button and swipe gesture support
  - Integrated activity LED indicator with custom color accents
  - Dynamic connected TV pill displaying the active TV name and pairing state
  - Tactile physical click sound effects and haptic vibration feedback via Web Audio API
- **Channels & Streaming App Launcher**:
  - Instant channel launcher for top global streaming platforms: Disney+ Hotstar, Netflix, YouTube, Prime Video, JioCinema, Spotify, Apple TV, Max, Sony LIV, ZEE5, Hulu, Paramount+, Peacock, Twitch, Crunchyroll, and Tubi
  - Assignable quick-access Home Keys (Slot 1 & Slot 2) with press-and-hold customization
- **On-Screen Remote Keyboard**:
  - Send typed search queries and text directly to active TV text inputs
- **Voice Assistant**:
  - Integrated speech recognition for direct voice control and recommendations
- **PWA & Offline Ready**:
  - Installable to desktop, iOS, and Android home screens
  - Offline asset caching with service worker support

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- npm or bun

### Installation

```bash
# Clone the repository
git clone https://github.com/harinder-works/HarvyRemote.git
cd HarvyRemote

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be running at `http://localhost:3000`.

### Production Build

```bash
# Build for production
npm run build

# Preview build locally
npm run preview
```

### 📱 Generating Android APK

#### Method 1: Automatically on GitHub (Recommended)
This repository includes a preconfigured GitHub Actions workflow (`.github/workflows/build-apk.yml`):
1. Go to the **Actions** tab in your GitHub repository: [github.com/harinder-works/HarvyRemote/actions](https://github.com/harinder-works/HarvyRemote/actions).
2. Select **Build Android APK** from the left sidebar.
3. Click **Run workflow** -> **Run workflow**.
4. Once completed (approx. 2-3 mins), click on the workflow run.
5. Download the `HarvyRemote-Debug-APK` zip file under the **Artifacts** section at the bottom.
6. Unzip to get `app-debug.apk` and transfer/install it directly on any Android phone or tablet!

#### Method 2: Locally on your computer
```bash
# 1. Install dependencies and build web assets
npm install
npm run build

# 2. Initialize and sync Android platform
npx cap add android
npx cap sync android

# 3. Open in Android Studio to run or generate signed APK
npx cap open android
# OR build directly via Gradle:
cd android && ./gradlew assembleDebug
# The APK will be located at:
# android/app/build/outputs/apk/debug/app-debug.apk
```

## 🛠 Tech Stack

- **Framework**: React 19 + TypeScript
- **Bundler**: Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React + Custom Vector Brand & Hardware SVG Icons
- **Audio**: Web Audio API synthesized tactile acoustic switches & chimes
- **PWA**: vite-plugin-pwa

## 📄 License

MIT License
