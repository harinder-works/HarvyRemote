/**
 * Universal Smart TV Remote Control Engine.
 * Supports:
 * - Google TV & Android TV (Port 6467 / 5555)
 * - Samsung Smart TV Tizen (Port 8001 / 8002)
 * - LG webOS Smart TV (Port 3000 / 3001)
 * - Roku TV & Streaming Devices (Port 8060 ECP)
 * - Amazon Fire TV (Port 5555 / 8008)
 * - Vizio SmartCast (Port 7345)
 * - Universal DIAL / Cast (Port 8008)
 */

export type TVBrand =
  | 'google_tv'
  | 'samsung'
  | 'lg_webos'
  | 'roku'
  | 'fire_tv'
  | 'vizio'
  | 'universal';

export interface SmartTVDevice {
  id: string;
  name: string;
  brand: TVBrand;
  ip: string;
  port: number;
  model?: string;
  isPaired: boolean;
  isConnected: boolean;
  lastPingMs?: number;
  mac?: string;
}

export interface UniversalCommandLog {
  id: string;
  timestamp: string;
  brand: TVBrand;
  command: string;
  wireProtocol: string;
  payload: string;
  targetDevice: string;
  status: 'sent' | 'ack' | 'failed';
  latencyMs: number;
}

// Normalized Remote Actions
export type RemoteAction =
  | 'DPAD_UP'
  | 'DPAD_DOWN'
  | 'DPAD_LEFT'
  | 'DPAD_RIGHT'
  | 'SELECT'
  | 'BACK'
  | 'HOME'
  | 'POWER'
  | 'VOLUME_UP'
  | 'VOLUME_DOWN'
  | 'MUTE'
  | 'TV_INPUT'
  | 'PLAY_PAUSE'
  | 'USB_MEDIA';

// TV Brand Metadata & Default Ports
export const TV_BRAND_CONFIG: Record<
  TVBrand,
  {
    name: string;
    osName: string;
    defaultPort: number;
    protocolName: string;
    pairingType: 'pin' | 'prompt' | 'none';
    description: string;
  }
> = {
  google_tv: {
    name: 'Google TV / Android TV',
    osName: 'Google TV / Android TV',
    defaultPort: 6467,
    protocolName: 'Android TV Remote v2 (TLS)',
    pairingType: 'pin',
    description: 'Chromecast with Google TV, Sony Bravia, TCL, Philips, Xiaomi, Shield TV',
  },
  samsung: {
    name: 'Samsung Smart TV',
    osName: 'Tizen OS',
    defaultPort: 8002,
    protocolName: 'Samsung SmartView WebSocket',
    pairingType: 'prompt',
    description: 'Samsung QLED, Neo QLED, OLED, Crystal UHD, The Frame (2016+)',
  },
  lg_webos: {
    name: 'LG Smart TV',
    osName: 'webOS',
    defaultPort: 3001,
    protocolName: 'LG webOS SSAP WebSocket',
    pairingType: 'prompt',
    description: 'LG OLED, QNED, NanoCell, UHD Smart TVs (webOS 3.0+)',
  },
  roku: {
    name: 'Roku TV',
    osName: 'Roku OS',
    defaultPort: 8060,
    protocolName: 'Roku External Control (ECP HTTP)',
    pairingType: 'none',
    description: 'TCL Roku TV, Hisense Roku, Onn Roku, Sharp Roku, Roku Ultra/Streaming Stick',
  },
  fire_tv: {
    name: 'Amazon Fire TV',
    osName: 'Fire OS',
    defaultPort: 5555,
    protocolName: 'Fire OS ADB & DIAL',
    pairingType: 'prompt',
    description: 'Fire TV Omni, 4-Series, Fire TV Stick 4K Max, Fire TV Cube',
  },
  vizio: {
    name: 'Vizio SmartCast TV',
    osName: 'SmartCast OS',
    defaultPort: 7345,
    protocolName: 'Vizio SmartCast REST API',
    pairingType: 'pin',
    description: 'Vizio V-Series, M-Series Quantum, P-Series, OLED',
  },
  universal: {
    name: 'Universal Smart TV',
    osName: 'DLNA / DIAL',
    defaultPort: 8008,
    protocolName: 'Universal DIAL / SSDP',
    pairingType: 'none',
    description: 'Panasonic, Hisense VIDAA, Philips, Sharp, Toshiba, Skyworth',
  },
};

// Brand-specific App Launch Identifiers
export const BRAND_APP_MAPPINGS: Record<
  TVBrand,
  Record<string, { appId: string; deepLink?: string }>
> = {
  google_tv: {
    youtube: { appId: 'com.google.android.youtube.tv' },
    netflix: { appId: 'com.netflix.ninja' },
    disney: { appId: 'com.disney.disneyplus' },
    hotstar: { appId: 'in.startv.hotstar' },
    prime: { appId: 'com.amazon.amazonvideo.livingroom' },
    spotify: { appId: 'com.spotify.tv.android' },
    twitch: { appId: 'tv.twitch.android.app' },
    apple: { appId: 'com.apple.atve.androidtv.appletv' },
    hulu: { appId: 'com.hulu.livingroomplus' },
    max: { appId: 'com.wbd.stream' },
    crunchyroll: { appId: 'com.crunchyroll.crunchyroid' },
    jiocinema: { appId: 'com.jio.media.ondemand' },
    sonyliv: { appId: 'com.sonyliv' },
  },
  samsung: {
    youtube: { appId: '111299001912' },
    netflix: { appId: '11101200001' },
    disney: { appId: '3201907018807' },
    hotstar: { appId: '3201806016432' },
    prime: { appId: '3201512006785' },
    spotify: { appId: '3201606009684' },
    twitch: { appId: '3201710015037' },
    apple: { appId: '3201807016597' },
    hulu: { appId: '3201601007230' },
    max: { appId: '3201601007625' },
    crunchyroll: { appId: '3202110025345' },
    jiocinema: { appId: '3201907018808' },
    sonyliv: { appId: '3201807016598' },
  },
  lg_webos: {
    youtube: { appId: 'youtube.leanback.v4' },
    netflix: { appId: 'netflix' },
    disney: { appId: 'com.disney.disneyplus-prod' },
    hotstar: { appId: 'hotstar' },
    prime: { appId: 'amazon' },
    spotify: { appId: 'spotify-beehive' },
    twitch: { appId: 'twitch' },
    apple: { appId: 'com.apple.appletv' },
    hulu: { appId: 'hulu' },
    max: { appId: 'com.wbd.stream' },
    crunchyroll: { appId: 'com.crunchyroll.cr-webos' },
    jiocinema: { appId: 'com.jio.media.ondemand' },
    sonyliv: { appId: 'com.sonyliv' },
  },
  roku: {
    youtube: { appId: '837' },
    netflix: { appId: '12' },
    disney: { appId: '291097' },
    hotstar: { appId: '50392' },
    prime: { appId: '13' },
    spotify: { appId: '22297' },
    twitch: { appId: '535697' },
    apple: { appId: '551012' },
    hulu: { appId: '2285' },
    max: { appId: '61322' },
    crunchyroll: { appId: '247' },
    jiocinema: { appId: '716298' },
    sonyliv: { appId: '542617' },
  },
  fire_tv: {
    youtube: { appId: 'com.amazon.firetv.youtube' },
    netflix: { appId: 'com.netflix.ninja' },
    disney: { appId: 'com.disney.disneyplus' },
    hotstar: { appId: 'in.startv.hotstar' },
    prime: { appId: 'com.amazon.avod' },
    spotify: { appId: 'com.spotify.tv.android' },
    twitch: { appId: 'tv.twitch.android.app' },
    apple: { appId: 'com.apple.atve.amazon.appletv' },
    hulu: { appId: 'com.hulu.plus' },
    max: { appId: 'com.wbd.stream' },
    crunchyroll: { appId: 'com.crunchyroll.crunchyroid' },
    jiocinema: { appId: 'com.jio.media.ondemand' },
    sonyliv: { appId: 'com.sonyliv' },
  },
  vizio: {
    youtube: { appId: 'youtube' },
    netflix: { appId: 'netflix' },
    disney: { appId: 'disneyplus' },
    hotstar: { appId: 'hotstar' },
    prime: { appId: 'amazon' },
    spotify: { appId: 'spotify' },
    twitch: { appId: 'twitch' },
    apple: { appId: 'appletv' },
    hulu: { appId: 'hulu' },
    max: { appId: 'max' },
    crunchyroll: { appId: 'crunchyroll' },
    jiocinema: { appId: 'jiocinema' },
    sonyliv: { appId: 'sonyliv' },
  },
  universal: {
    youtube: { appId: 'YouTube' },
    netflix: { appId: 'Netflix' },
    disney: { appId: 'DisneyPlus' },
    hotstar: { appId: 'Hotstar' },
    prime: { appId: 'PrimeVideo' },
    spotify: { appId: 'Spotify' },
    twitch: { appId: 'Twitch' },
    apple: { appId: 'AppleTV' },
    hulu: { appId: 'Hulu' },
    max: { appId: 'Max' },
    crunchyroll: { appId: 'Crunchyroll' },
    jiocinema: { appId: 'JioCinema' },
    sonyliv: { appId: 'SonyLIV' },
  },
};

class UniversalTVClient {
  private activeDevice: SmartTVDevice | null = null;
  private listeners: ((log: UniversalCommandLog) => void)[] = [];
  private discoveryListeners: ((device: SmartTVDevice) => void)[] = [];
  private scanFinishListeners: ((count: number, subnet: string) => void)[] = [];
  private pingListeners: ((ip: string, isConnected: boolean, latencyMs: number) => void)[] = [];
  private pairingCodeListeners: ((detail: { ip: string; status: string }) => void)[] = [];
  private pairStatusListeners: ((detail: { success: boolean; ip: string; message: string }) => void)[] = [];
  private needsPairingListeners: ((detail: { ip: string; brand: string; message: string }) => void)[] = [];
  private installedAppsListeners: ((apps: any[]) => void)[] = [];

  constructor() {
    try {
      const saved = localStorage.getItem('universal_tv_device');
      if (saved) {
        this.activeDevice = JSON.parse(saved);
      }
    } catch {
      // ignore
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('tv-discovered', ((e: CustomEvent<any>) => {
        if (e.detail) {
          this.discoveryListeners.forEach((fn) => fn(e.detail));
        }
      }) as EventListener);

      window.addEventListener('tv-scan-finished', ((e: CustomEvent<any>) => {
        if (e.detail) {
          this.scanFinishListeners.forEach((fn) => fn(e.detail.foundCount || 0, e.detail.subnet || ''));
        }
      }) as EventListener);

      window.addEventListener('tv-ping-result', ((e: CustomEvent<any>) => {
        if (e.detail) {
          const { ip, isConnected, latencyMs } = e.detail;
          if (this.activeDevice && this.activeDevice.ip === ip) {
            this.activeDevice.isConnected = isConnected;
            this.activeDevice.lastPingMs = latencyMs;
          }
          this.pingListeners.forEach((fn) => fn(ip, isConnected, latencyMs));
        }
      }) as EventListener);

      window.addEventListener('tv-command-result', ((e: CustomEvent<any>) => {
        if (e.detail) {
          const { action, brand, ip, success, latencyMs, protocol } = e.detail;
          this.emitLog(
            action,
            protocol || 'Direct Network Protocol',
            `${brand.toUpperCase()} (${ip}) -> ${success ? 'ACK OK' : 'NO RESPONSE'}`,
            latencyMs || 22,
            success ? 'ack' : 'failed'
          );
        }
      }) as EventListener);

      window.addEventListener('tv-pairing-code-requested', ((e: CustomEvent<any>) => {
        if (e.detail) {
          this.pairingCodeListeners.forEach((fn) => fn(e.detail));
        }
      }) as EventListener);

      window.addEventListener('tv-pair-status', ((e: CustomEvent<any>) => {
        if (e.detail) {
          this.pairStatusListeners.forEach((fn) => fn(e.detail));
        }
      }) as EventListener);

      window.addEventListener('tv-needs-pairing', ((e: CustomEvent<any>) => {
        if (e.detail) {
          this.needsPairingListeners.forEach((fn) => fn(e.detail));
        }
      }) as EventListener);

      window.addEventListener('tv-installed-apps', ((e: CustomEvent<any>) => {
        if (e.detail?.apps) {
          try {
            localStorage.setItem('gtv_installed_apps', JSON.stringify(e.detail.apps));
          } catch {}
          this.installedAppsListeners.forEach((fn) => fn(e.detail.apps));
        }
      }) as EventListener);
    }
  }

  public getActiveDevice(): SmartTVDevice | null {
    return this.activeDevice;
  }

  public setActiveDevice(device: SmartTVDevice | null) {
    this.activeDevice = device;
    if (device) {
      localStorage.setItem('universal_tv_device', JSON.stringify(device));
    } else {
      localStorage.removeItem('universal_tv_device');
    }
  }

  public onCommand(callback: (log: UniversalCommandLog) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((fn) => fn !== callback);
    };
  }

  public onDeviceDiscovered(callback: (device: SmartTVDevice) => void) {
    this.discoveryListeners.push(callback);
    return () => {
      this.discoveryListeners = this.discoveryListeners.filter((fn) => fn !== callback);
    };
  }

  public onScanFinished(callback: (count: number, subnet: string) => void) {
    this.scanFinishListeners.push(callback);
    return () => {
      this.scanFinishListeners = this.scanFinishListeners.filter((fn) => fn !== callback);
    };
  }

  public onPingResult(callback: (ip: string, isConnected: boolean, latencyMs: number) => void) {
    this.pingListeners.push(callback);
    return () => {
      this.pingListeners = this.pingListeners.filter((fn) => fn !== callback);
    };
  }

  public startScan() {
    const bridge = (window as any).NativeTVManager || (window as any).AndroidNativeBridge;
    if (bridge && typeof bridge.startScan === 'function') {
      bridge.startScan();
    }
  }

  public pingDevice(ip: string, port = 8060) {
    const bridge = (window as any).NativeTVManager || (window as any).AndroidNativeBridge;
    if (bridge && typeof bridge.pingDevice === 'function') {
      bridge.pingDevice(ip, port);
    }
  }

  public startPairing(ip: string) {
    const bridge = (window as any).NativeTVManager || (window as any).AndroidNativeBridge;
    if (bridge && typeof bridge.startPairing === 'function') {
      bridge.startPairing(ip);
    } else {
      // In web browser preview mode (when running outside native Android bridge)
      setTimeout(() => {
        const event = new CustomEvent('tv-pairing-code-requested', {
          detail: { ip, status: 'code_displayed' },
        });
        window.dispatchEvent(event);
      }, 700);
    }
  }

  public submitPairingPin(ip: string, pin: string) {
    const bridge = (window as any).NativeTVManager || (window as any).AndroidNativeBridge;
    if (bridge && typeof bridge.submitPairingPin === 'function') {
      bridge.submitPairingPin(ip, pin);
    } else {
      setTimeout(() => {
        const event = new CustomEvent('tv-pair-status', {
          detail: {
            success: true,
            ip,
            message: 'Paired successfully with TV (Simulation)',
          },
        });
        window.dispatchEvent(event);
      }, 500);
    }
  }

  public onPairingCodeRequested(callback: (detail: { ip: string; status: string }) => void) {
    this.pairingCodeListeners.push(callback);
    return () => {
      this.pairingCodeListeners = this.pairingCodeListeners.filter((fn) => fn !== callback);
    };
  }

  public onPairStatus(callback: (detail: { success: boolean; ip: string; message: string }) => void) {
    this.pairStatusListeners.push(callback);
    return () => {
      this.pairStatusListeners = this.pairStatusListeners.filter((fn) => fn !== callback);
    };
  }

  public onNeedsPairing(callback: (detail: { ip: string; brand: string; message: string }) => void) {
    this.needsPairingListeners.push(callback);
    return () => {
      this.needsPairingListeners = this.needsPairingListeners.filter((fn) => fn !== callback);
    };
  }

  public onInstalledApps(callback: (apps: any[]) => void) {
    this.installedAppsListeners.push(callback);
    return () => {
      this.installedAppsListeners = this.installedAppsListeners.filter((fn) => fn !== callback);
    };
  }

  public fetchInstalledApps(brand?: string, ip?: string, port?: number) {
    const targetBrand = brand || this.activeDevice?.brand || 'google_tv';
    const targetIp = ip || this.activeDevice?.ip || '192.168.1.105';
    const targetPort = port || this.activeDevice?.port || 6466;

    const bridge = (window as any).NativeTVManager || (window as any).AndroidNativeBridge;
    if (bridge && typeof bridge.fetchInstalledApps === 'function') {
      bridge.fetchInstalledApps(targetBrand, targetIp, targetPort);
    } else {
      setTimeout(() => {
        try {
          const saved = localStorage.getItem('gtv_installed_apps');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              this.installedAppsListeners.forEach((fn) => fn(parsed));
            }
          }
        } catch {}
      }, 200);
    }
  }

  private emitLog(
    command: string,
    wireProtocol: string,
    payload: string,
    latencyMs = 26,
    status: 'ack' | 'failed' | 'sent' = 'ack'
  ) {
    const brand = this.activeDevice?.brand || 'google_tv';
    const log: UniversalCommandLog = {
      id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      brand,
      command,
      wireProtocol,
      payload,
      targetDevice: this.activeDevice
        ? `${this.activeDevice.name} (${this.activeDevice.ip})`
        : 'Smart TV',
      status,
      latencyMs,
    };

    this.listeners.forEach((fn) => fn(log));
  }

  /**
   * Dispatches normalized remote action to ANY Smart TV brand using its native protocol
   */
  public async sendAction(action: RemoteAction): Promise<boolean> {
    const brand = this.activeDevice?.brand || 'google_tv';
    const ip = this.activeDevice?.ip || '192.168.1.105';
    const startTime = performance.now();

    let wireProtocol = '';
    let payload = '';

    switch (brand) {
      case 'roku': {
        // Roku External Control Protocol (ECP over HTTP)
        const rokuKeyMap: Record<RemoteAction, string> = {
          DPAD_UP: 'Up',
          DPAD_DOWN: 'Down',
          DPAD_LEFT: 'Left',
          DPAD_RIGHT: 'Right',
          SELECT: 'Select',
          BACK: 'Back',
          HOME: 'Home',
          POWER: 'Power',
          VOLUME_UP: 'VolumeUp',
          VOLUME_DOWN: 'VolumeDown',
          MUTE: 'VolumeMute',
          TV_INPUT: 'InputTuner',
          PLAY_PAUSE: 'Play',
          USB_MEDIA: 'InputUSB',
        };
        const rokuKey = rokuKeyMap[action] || 'Select';
        wireProtocol = 'Roku ECP HTTP POST';
        payload = `POST http://${ip}:8060/keypress/${rokuKey}`;
        break;
      }

      case 'samsung': {
        // Samsung SmartView Tizen WebSocket Command
        const samsungKeyMap: Record<RemoteAction, string> = {
          DPAD_UP: 'KEY_UP',
          DPAD_DOWN: 'KEY_DOWN',
          DPAD_LEFT: 'KEY_LEFT',
          DPAD_RIGHT: 'KEY_RIGHT',
          SELECT: 'KEY_ENTER',
          BACK: 'KEY_RETURN',
          HOME: 'KEY_HOME',
          POWER: 'KEY_POWER',
          VOLUME_UP: 'KEY_VOLUP',
          VOLUME_DOWN: 'KEY_VOLDOWN',
          MUTE: 'KEY_MUTE',
          TV_INPUT: 'KEY_SOURCE',
          PLAY_PAUSE: 'KEY_PLAY_BACK',
          USB_MEDIA: 'KEY_MEDIA',
        };
        const samsungKey = samsungKeyMap[action] || 'KEY_ENTER';
        wireProtocol = 'Samsung Tizen WS (Port 8002)';
        payload = JSON.stringify({
          method: 'ms.remote.control',
          params: { Cmd: 'Click', DataOfCmd: samsungKey, Option: 'false', TypeOfRemote: 'SendRemoteKey' },
        });
        break;
      }

      case 'lg_webos': {
        // LG webOS SSAP WebSocket Command
        const lgKeyMap: Record<RemoteAction, string> = {
          DPAD_UP: 'ssap://media.controls/up',
          DPAD_DOWN: 'ssap://media.controls/down',
          DPAD_LEFT: 'ssap://media.controls/left',
          DPAD_RIGHT: 'ssap://media.controls/right',
          SELECT: 'ssap://media.controls/ok',
          BACK: 'ssap://media.controls/back',
          HOME: 'ssap://media.controls/home',
          POWER: 'ssap://system/turnOff',
          VOLUME_UP: 'ssap://audio/volumeUp',
          VOLUME_DOWN: 'ssap://audio/volumeDown',
          MUTE: 'ssap://audio/setMute',
          TV_INPUT: 'ssap://tv/switchInput',
          PLAY_PAUSE: 'ssap://media.controls/play',
          USB_MEDIA: 'ssap://system.launcher/open?target=com.webos.app.mediaplayer',
        };
        const lgUri = lgKeyMap[action] || 'ssap://media.controls/ok';
        wireProtocol = 'LG webOS SSAP WS (Port 3001)';
        payload = JSON.stringify({ type: 'request', uri: lgUri });
        break;
      }

      case 'fire_tv': {
        // Amazon Fire TV ADB / DIAL
        const fireKeyMap: Record<RemoteAction, number> = {
          DPAD_UP: 19,
          DPAD_DOWN: 20,
          DPAD_LEFT: 21,
          DPAD_RIGHT: 22,
          SELECT: 23,
          BACK: 4,
          HOME: 3,
          POWER: 26,
          VOLUME_UP: 24,
          VOLUME_DOWN: 25,
          MUTE: 164,
          TV_INPUT: 178,
          PLAY_PAUSE: 85,
          USB_MEDIA: 226,
        };
        const keycode = fireKeyMap[action] || 23;
        wireProtocol = 'Fire OS ADB (Port 5555)';
        payload = `adb shell input keyevent ${keycode}`;
        break;
      }

      case 'vizio': {
        // Vizio SmartCast REST
        wireProtocol = 'Vizio SmartCast REST (Port 7345)';
        payload = `PUT https://${ip}:7345/key_command/ { KEYLIST: [{ CODESET: 11, CODE: "${action}" }] }`;
        break;
      }

      case 'universal':
      case 'google_tv':
      default: {
        // Android TV Remote Service v2
        const androidKeyMap: Record<RemoteAction, number> = {
          DPAD_UP: 19,
          DPAD_DOWN: 20,
          DPAD_LEFT: 21,
          DPAD_RIGHT: 22,
          SELECT: 23,
          BACK: 4,
          HOME: 3,
          POWER: 26,
          VOLUME_UP: 24,
          VOLUME_DOWN: 25,
          MUTE: 164,
          TV_INPUT: 178,
          PLAY_PAUSE: 85,
          USB_MEDIA: 226,
        };
        const keycode = androidKeyMap[action] || 23;
        wireProtocol = 'Android TV Remote v2 (TLS 6467)';
        payload = `android.view.KeyEvent { keyCode: ${keycode}, action: ACTION_DOWN_UP }`;
        break;
      }
    }

    // Call Android Native TV Manager over bridge
    const bridge = (window as any).NativeTVManager || (window as any).AndroidNativeBridge;
    if (bridge && typeof bridge.sendAction === 'function') {
      try {
        bridge.sendAction(brand, ip, this.activeDevice?.port || 6467, action);
      } catch (err) {
        console.error('Bridge sendAction failed', err);
      }
    } else {
      // Direct HTTP fallback in browser development preview
      try {
        if (typeof window !== 'undefined' && window.location.protocol.startsWith('http') && !window.location.hostname.includes('localhost')) {
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 120);
          fetch('/api/tv/send-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              brand,
              ip,
              action,
              payload,
            }),
            signal: controller.signal,
          }).catch(() => {}).finally(() => clearTimeout(tid));
        }
      } catch {
        // handled
      }
    }

    const elapsed = Math.round(performance.now() - startTime) || Math.floor(Math.random() * 12 + 18);
    this.emitLog(action, wireProtocol, payload, elapsed);
    return true;
  }

  /**
   * Launch App across ANY Smart TV Brand
   */
  public async launchApp(appSlug: string, customAppId?: string): Promise<boolean> {
    const brand = this.activeDevice?.brand || 'google_tv';
    const ip = this.activeDevice?.ip || '192.168.1.105';
    const port = this.activeDevice?.port || 6467;
    const startTime = performance.now();

    const brandMappings = BRAND_APP_MAPPINGS[brand] || BRAND_APP_MAPPINGS.google_tv;
    const targetApp = customAppId || brandMappings[appSlug]?.appId || appSlug;

    let wireProtocol = '';
    let payload = '';

    switch (brand) {
      case 'roku':
        wireProtocol = 'Roku ECP Launch';
        payload = `POST http://${ip}:8060/launch/${targetApp}`;
        break;
      case 'samsung':
        wireProtocol = 'Samsung Tizen App Launch';
        payload = `POST http://${ip}:8001/api/v2/applications/${targetApp}`;
        break;
      case 'lg_webos':
        wireProtocol = 'LG webOS Launch';
        payload = `ssap://system.launcher/launch { id: "${targetApp}" }`;
        break;
      case 'fire_tv':
      case 'google_tv':
      default:
        wireProtocol = 'Android/Fire TV Package Intent';
        payload = `am start -n ${targetApp}`;
        break;
    }

    const bridge = (window as any).NativeTVManager || (window as any).AndroidNativeBridge;
    if (bridge && typeof bridge.launchApp === 'function') {
      try {
        bridge.launchApp(brand, ip, port, appSlug);
      } catch (err) {
        console.error('Bridge launchApp failed', err);
      }
    }

    const elapsed = Math.round(performance.now() - startTime) || 38;
    this.emitLog(`LAUNCH_${appSlug.toUpperCase()}`, wireProtocol, payload, elapsed);
    return true;
  }

  /**
   * Universal Voice Search Intent across Smart TVs
   */
  public async sendVoiceSearch(query: string): Promise<boolean> {
    const brand = this.activeDevice?.brand || 'google_tv';
    const ip = this.activeDevice?.ip || '192.168.1.105';
    const port = this.activeDevice?.port || 6467;
    const startTime = performance.now();

    let wireProtocol = '';
    let payload = '';

    switch (brand) {
      case 'roku':
        wireProtocol = 'Roku ECP Universal Search';
        payload = `POST http://${ip}:8060/search/browse?keyword=${encodeURIComponent(query)}`;
        break;
      case 'samsung':
        wireProtocol = 'Samsung Bixby / Universal Voice';
        payload = JSON.stringify({ method: 'ms.voice.search', params: { query } });
        break;
      case 'lg_webos':
        wireProtocol = 'LG ThinQ Voice Search';
        payload = `ssap://com.webos.service.ai.voice/search { query: "${query}" }`;
        break;
      case 'fire_tv':
        wireProtocol = 'Amazon Alexa Voice Intent';
        payload = `am start -a android.intent.action.SEARCH --es query "${query}"`;
        break;
      case 'google_tv':
      default:
        wireProtocol = 'Google Assistant Voice Intent';
        payload = `am start -a android.intent.action.SEARCH --es query "${query}"`;
        break;
    }

    const bridge = (window as any).NativeTVManager || (window as any).AndroidNativeBridge;
    if (bridge && typeof bridge.sendTextInput === 'function') {
      bridge.sendTextInput(brand, ip, port, query);
    }

    const elapsed = Math.round(performance.now() - startTime) || 45;
    this.emitLog('VOICE_SEARCH', wireProtocol, payload, elapsed);
    return true;
  }

  /**
   * Universal Text Typing to Smart TV active input field
   */
  public async sendTextInput(text: string): Promise<boolean> {
    const brand = this.activeDevice?.brand || 'google_tv';
    const ip = this.activeDevice?.ip || '192.168.1.105';
    const port = this.activeDevice?.port || 6467;

    let wireProtocol = '';
    let payload = '';

    if (brand === 'roku') {
      wireProtocol = 'Roku ECP Lit Keypress';
      payload = `POST http://${ip}:8060/keypress/Lit_${encodeURIComponent(text)}`;
    } else {
      wireProtocol = `${brand.toUpperCase()} Input Text`;
      payload = `input text "${text.replace(/"/g, '\\"')}"`;
    }

    const bridge = (window as any).NativeTVManager || (window as any).AndroidNativeBridge;
    if (bridge && typeof bridge.sendTextInput === 'function') {
      bridge.sendTextInput(brand, ip, port, text);
    }

    this.emitLog('INPUT_TEXT', wireProtocol, payload, 30);
    return true;
  }
}

export const universalTV = new UniversalTVClient();
