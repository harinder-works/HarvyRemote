/**
 * Voice search and command processor for Google TV Remote.
 * Supports Web Speech API (webkitSpeechRecognition) and rich natural language commands.
 */

// Define SpeechRecognition interface for TypeScript
interface ISpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
      isFinal?: boolean;
    };
  };
}

interface ISpeechRecognitionErrorEvent {
  error: string;
}

interface ISpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onerror: ((event: ISpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => ISpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export interface VoiceCommandResult {
  rawTranscript: string;
  action: 'open_app' | 'search_media' | 'volume_change' | 'mute' | 'power' | 'weather' | 'general_answer';
  targetApp?: string;
  searchQuery?: string;
  volumeDelta?: number;
  volumeLevel?: number;
  answerText?: string;
}

export function parseVoiceCommand(transcript: string): VoiceCommandResult {
  const t = transcript.toLowerCase().trim();

  // App Launching
  if (t.includes('youtube')) {
    return { rawTranscript: transcript, action: 'open_app', targetApp: 'youtube' };
  }
  if (t.includes('netflix')) {
    return { rawTranscript: transcript, action: 'open_app', targetApp: 'netflix' };
  }
  if (t.includes('disney')) {
    return { rawTranscript: transcript, action: 'open_app', targetApp: 'disney' };
  }
  if (t.includes('prime') || t.includes('amazon')) {
    return { rawTranscript: transcript, action: 'open_app', targetApp: 'prime' };
  }
  if (t.includes('spotify') || t.includes('music')) {
    return { rawTranscript: transcript, action: 'open_app', targetApp: 'spotify' };
  }
  if (t.includes('twitch')) {
    return { rawTranscript: transcript, action: 'open_app', targetApp: 'twitch' };
  }
  if (t.includes('apple')) {
    return { rawTranscript: transcript, action: 'open_app', targetApp: 'apple' };
  }
  if (t.includes('hulu')) {
    return { rawTranscript: transcript, action: 'open_app', targetApp: 'hulu' };
  }
  if (t.includes('max') || t.includes('hbo')) {
    return { rawTranscript: transcript, action: 'open_app', targetApp: 'max' };
  }
  if (t.includes('crunchyroll') || t.includes('anime')) {
    return { rawTranscript: transcript, action: 'open_app', targetApp: 'crunchyroll' };
  }

  // Volume
  if (t.includes('mute') || t.includes('silence')) {
    return { rawTranscript: transcript, action: 'mute' };
  }
  if (t.includes('volume up') || t.includes('louder') || t.includes('turn it up')) {
    return { rawTranscript: transcript, action: 'volume_change', volumeDelta: +10 };
  }
  if (t.includes('volume down') || t.includes('quieter') || t.includes('turn it down')) {
    return { rawTranscript: transcript, action: 'volume_change', volumeDelta: -10 };
  }
  const volMatch = t.match(/volume (to )?(\d+)/);
  if (volMatch && volMatch[2]) {
    const val = Math.min(100, Math.max(0, parseInt(volMatch[2], 10)));
    return { rawTranscript: transcript, action: 'volume_change', volumeLevel: val };
  }

  // Power
  if (t.includes('turn off') || t.includes('power off') || t.includes('sleep tv')) {
    return { rawTranscript: transcript, action: 'power' };
  }

  // Weather query
  if (t.includes('weather') || t.includes('temperature') || t.includes('rain today') || t.includes('forecast')) {
    return {
      rawTranscript: transcript,
      action: 'weather',
      answerText: "Currently 72°F and sunny in your area with a mild breeze. Ideal for watching your favorite shows!",
    };
  }

  // Media Search
  const searchPrefixes = ['search for ', 'find ', 'look for ', 'watch ', 'play ', 'show me '];
  for (const prefix of searchPrefixes) {
    if (t.startsWith(prefix)) {
      const q = transcript.slice(prefix.length).trim();
      return {
        rawTranscript: transcript,
        action: 'search_media',
        searchQuery: q,
      };
    }
  }

  // General search or recommendation
  return {
    rawTranscript: transcript,
    action: 'search_media',
    searchQuery: transcript,
    answerText: `Showing top Google TV recommendations for "${transcript}"`,
  };
}

export function createSpeechRecognizer(
  onStart: () => void,
  onInterim: (text: string) => void,
  onFinal: (text: string) => void,
  onError: (err: string) => void,
  onEnd: () => void,
) {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    return null;
  }

  try {
    const recognizer = new SpeechRec();
    recognizer.continuous = false;
    recognizer.interimResults = true;
    recognizer.lang = 'en-US';

    recognizer.onstart = () => {
      onStart();
    };

    recognizer.onresult = (event: ISpeechRecognitionEvent) => {
      let interim = '';
      for (let i = 0; i < Object.keys(event.results).length; i++) {
        const item = event.results[i];
        if (item && item[0]) {
          if (item.isFinal) {
            onFinal(item[0].transcript);
            return;
          } else {
            interim += item[0].transcript;
          }
        }
      }
      if (interim) {
        onInterim(interim);
      }
    };

    recognizer.onerror = (e: ISpeechRecognitionErrorEvent) => {
      onError(e.error || 'Speech error');
    };

    recognizer.onend = () => {
      onEnd();
    };

    return recognizer;
  } catch (e) {
    console.warn('Speech recognition init failed', e);
    return null;
  }
}
