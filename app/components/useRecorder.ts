"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Safari only records mp4; Chrome/Firefox prefer webm/opus.
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function pickMimeType(): string | undefined {
  return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t));
}

export function extensionFor(mimeType: string): string {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

interface Options {
  maxSeconds: number;
  onComplete: (blob: Blob) => void;
  onError: (message: string) => void;
}

export function useRecorder({ maxSeconds, onComplete, onError }: Options) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);

  // Keep the latest callbacks without restarting the recorder
  const callbacks = useRef({ onComplete, onError });
  useEffect(() => {
    callbacks.current = { onComplete, onError };
  });

  const clearTimer = () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  const start = useCallback(async () => {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      callbacks.current.onError(
        "Votre navigateur ne permet pas d'enregistrer. Utilisez « Écrire plutôt »."
      );
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (err) {
      callbacks.current.onError(
        (err as DOMException)?.name === "NotAllowedError"
          ? "Autorisez l'accès au micro pour enregistrer votre devis."
          : "Aucun micro disponible sur cet appareil."
      );
      return;
    }

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      clearTimer();
      setRecording(false);
      recorderRef.current = null;
      const blob = new Blob(chunks, {
        type: recorder.mimeType || mimeType || "audio/webm",
      });
      if (blob.size === 0) {
        callbacks.current.onError("L'enregistrement est vide. Réessayez.");
      } else {
        callbacks.current.onComplete(blob);
      }
    };

    recorder.start(1000);
    recorderRef.current = recorder;
    const startedAt = Date.now();
    setSeconds(0);
    setRecording(true);
    timerRef.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setSeconds(elapsed);
      if (elapsed >= maxSeconds) stop();
    }, 250);
  }, [maxSeconds, stop]);

  // Release the microphone if the page unmounts mid-recording
  useEffect(
    () => () => {
      clearTimer();
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    },
    []
  );

  return { recording, seconds, start, stop };
}
