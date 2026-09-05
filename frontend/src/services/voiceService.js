import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

// Language mapping: app language -> speech recognition locale.
export const VOICE_LANG_MAP = Object.freeze({
  en: 'en-IN',
  hi: 'hi-IN',
  mr: 'mr-IN',
});

export const VOICE_TIMEOUT_MS = 15000;

// Technical platform error codes -> friendly, UI-safe app error keys.
const ERROR_CODE_MAP = Object.freeze({
  'no-speech': 'noSpeech',
  'audio-capture': 'audioCapture',
  audio: 'audioCapture',
  network: 'network',
  'not-allowed': 'permission',
  'service-not-allowed': 'serviceNotAllowed',
  'recognizer-busy': 'recognizerBusy',
  'language-not-supported': 'languageNotSupported',
  license: 'license',
  server: 'server',
  client: 'client',
  aborted: 'aborted',
  timeout: 'timeout',
});

export function mapLanguage(lang) {
  return VOICE_LANG_MAP[lang] || 'en-IN';
}

export function isRecognitionAvailable() {
  try {
    return Boolean(ExpoSpeechRecognitionModule.isRecognitionAvailable());
  } catch (_) {
    return false;
  }
}

export async function requestPermissionsAsync() {
  try {
    return await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  } catch (e) {
    return { granted: false, status: 'error', canAskAgain: false, error: e };
  }
}

let activeSession = null;

function safeStop() {
  try {
    ExpoSpeechRecognitionModule.stop();
  } catch (_) {
    // Best-effort stop; the destroy path below still cleans up.
  }
}

/**
 * Start one-shot speech recognition for the given app language.
 *
 * Lifecycle contract:
 * - Does NOT auto-stop on the first final result. With continuous:false the
 *   platform naturally ends recognition after a pause -> "end" event.
 * - Only the FIRST final transcript is surfaced (finalized guard): stop() when
 *   the user explicitly taps stop / Done, or when the timeout fires.
 * - The natural "end" event always terminates the session and is the normal
 *   close path for the recognition UI.
 * - Every session tears down listeners on end/error/timeout. Re-creating a
 *   session first destroys any stale one to avoid conflicting native events.
 *
 * @returns {{ stop: () => void, destroy: () => void, locale: string }}
 *   stop() requests the platform to stop (fires "end" naturally).
 *   destroy() detaches listeners and aborts without signalling the UI.
 */
export function startRecognition({ lang, onInterim, onFinal, onEnd, onError }) {
  const locale = mapLanguage(lang);

  if (activeSession) {
    activeSession.destroy();
  }

  let destroyed = false;
  let finalized = false;
  let finalTranscript = '';
  let timeoutId = null;
  const listeners = [];

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    listeners.forEach((listener) => {
      try {
        listener.remove();
      } catch (_) {
        // Remove is best-effort.
      }
    });
    listeners.length = 0;
    if (activeSession === session) activeSession = null;
  };

  const fail = (code) => {
    if (destroyed) return;
    const friendly = ERROR_CODE_MAP[code] || 'generic';
    destroy();
    if (onError) onError(friendly);
  };

  const session = {
    locale,
    stop: () => {
      if (destroyed) return;
      safeStop();
    },
    destroy,
  };
  activeSession = session;

  listeners.push(
    ExpoSpeechRecognitionModule.addListener('result', (event) => {
      if (destroyed) return;
      const result = event && event.results && event.results[0];
      const transcript = result && result.transcript ? result.transcript : '';
      if (event.isFinal) {
        if (!finalized) {
          finalized = true;
          finalTranscript = transcript;
          if (onFinal) onFinal(transcript);
        }
      } else if (onInterim) {
        onInterim(transcript);
      }
    })
  );

  listeners.push(
    ExpoSpeechRecognitionModule.addListener('end', () => {
      if (destroyed) return;
      const transcript = finalized ? finalTranscript : '';
      destroy();
      if (onEnd) onEnd(transcript);
    })
  );

  listeners.push(
    ExpoSpeechRecognitionModule.addListener('error', (event) => {
      if (destroyed) return;
      // Once a final result has been produced it wins: platform errors that
      // arrive afterwards (e.g. a flaky network during upload) must not undo
      // the recognised command. The natural "end" event still cleans up.
      if (finalized) return;
      const code = event && (event.error || event.message);
      fail(String(code || 'generic'));
    })
  );

  // Timeout recovery: only used as a safety net, never to "auto-stop after
  // result". When it fires, stop recognition and fail with a friendly key.
  timeoutId = setTimeout(() => {
    if (destroyed) return;
    safeStop();
    fail('timeout');
  }, VOICE_TIMEOUT_MS);

  try {
    ExpoSpeechRecognitionModule.start({
      lang: locale,
      interimResults: true,
      maxAlternatives: 1,
      continuous: false,
      requiresOnDeviceRecognition: false,
      addsPunctuation: false,
      androidIntentOptions: { EXTRA_LANGUAGE_MODEL: 'web_search' },
    });
  } catch (e) {
    if (!destroyed) {
      destroy();
      if (onError) onError('generic');
    }
    return session;
  }

  return session;
}

export function stopRecognition() {
  const session = activeSession;
  if (session) {
    session.stop();
  } else {
    safeStop();
  }
}

export function cleanup() {
  if (activeSession) {
    activeSession.destroy();
  }
}