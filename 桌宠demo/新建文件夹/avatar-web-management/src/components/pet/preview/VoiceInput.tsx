// TODO: BEM-migrate
'use client';

import { useEffect, useRef, useCallback } from 'react';

interface VoiceInputProps {
  onResult: (text: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onStateChange: (active: boolean) => void;
  active: boolean;
  lang?: string;
  messages?: {
    notSupported: string;
    micDenied: string;
    startFailed: string;
  };
  /** Enable VAD (Voice Activity Detection) — auto-stop on silence */
  vadEnabled?: boolean;
  /** RMS threshold below which audio is considered silence (default 0.01) */
  silenceThreshold?: number;
  /** Duration of silence in ms before auto-stopping (default 2000) */
  silenceTimeout?: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export function useVoiceInput({
  onResult,
  onError,
  onStateChange,
  active,
  lang = 'zh-CN',
  messages,
  vadEnabled = true,
  silenceThreshold = 0.01,
  silenceTimeout = 2000,
}: VoiceInputProps) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const supportedRef = useRef(false);
  const vadRef = useRef<{
    audioCtx: AudioContext;
    analyser: AnalyserNode;
    source: MediaStreamAudioSourceNode;
    stream: MediaStream;
    frameId: number;
    silenceStart: number | null;
  } | null>(null);

  const msg = messages || {
    notSupported: 'Your browser does not support speech recognition. Please use Chrome or Edge.',
    micDenied: 'Microphone access denied.',
    startFailed: 'Failed to start speech recognition',
  };

  useEffect(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    supportedRef.current = !!SpeechRecognitionAPI;
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    cleanupVad();
    onStateChange(false);
  }, [onStateChange]);

  const cleanupVad = useCallback(() => {
    const vad = vadRef.current;
    if (!vad) return;
    cancelAnimationFrame(vad.frameId);
    vad.source.disconnect();
    vad.analyser.disconnect();
    vad.audioCtx.close();
    vad.stream.getTracks().forEach((t) => t.stop());
    vadRef.current = null;
  }, []);

  const startVad = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let silenceStart: number | null = null;
      let frameId = 0;

      const detect = () => {
        analyser.getByteTimeDomainData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / dataArray.length);

        if (rms < silenceThreshold) {
          if (silenceStart === null) {
            silenceStart = performance.now();
          } else if (performance.now() - silenceStart >= silenceTimeout) {
            recognitionRef.current?.stop();
            cleanupVad();
            return;
          }
        } else {
          silenceStart = null;
        }

        frameId = requestAnimationFrame(detect);
      };

      vadRef.current = { audioCtx, analyser, source, stream, frameId, silenceStart: null };
      frameId = requestAnimationFrame(detect);
      vadRef.current.frameId = frameId;
    } catch {
      // VAD is optional — speech recognition still works without it
      console.warn('[VoiceInput] VAD microphone access denied, continuing without VAD');
    }
  }, [silenceThreshold, silenceTimeout, cleanupVad]);

  const start = useCallback(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      onError(msg.notSupported);
      return;
    }

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = lang;
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let transcript = '';
        let isFinal = false;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          transcript += result[0].transcript;
          if (result.isFinal) isFinal = true;
        }

        onResult(transcript, isFinal);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        switch (event.error) {
          case 'not-allowed':
            onError(msg.micDenied);
            break;
          case 'no-speech':
            break;
          case 'aborted':
            break;
          default:
            onError(`Speech recognition error: ${event.error}`);
        }
        cleanupVad();
        onStateChange(false);
      };

      recognition.onend = () => {
        cleanupVad();
        onStateChange(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      onStateChange(true);

      if (vadEnabled) {
        startVad();
      }
    } catch {
      onError(msg.startFailed);
      onStateChange(false);
    }
  }, [lang, onResult, onError, onStateChange, msg, vadEnabled, startVad]);

  useEffect(() => {
    if (!active) {
      recognitionRef.current?.stop();
      cleanupVad();
    }
  }, [active]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      cleanupVad();
    };
  }, []);

  return {
    start,
    stop,
    supported: supportedRef.current,
  };
}