"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Pause, Play, Square, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Progress } from "@/components/ui/primitives";
import { useUpload, type UploadedAttachment } from "./useUpload";
import { formatDuration } from "@/lib/utils";
import { useHydrated } from "@/lib/hooks/useHydrated";

/**
 * In-browser voice note. Uses MediaRecorder, which is supported by Chrome,
 * Edge, Firefox and iOS Safari 14.5+ — no app install, no paid service.
 *
 * If a student cannot record (permission denied, unsupported browser), they can
 * still pick an existing audio file instead.
 */
export function AudioRecorder({
  value,
  onChange,
  maxSeconds = 120,
}: {
  value: UploadedAttachment | null;
  onChange: (next: UploadedAttachment | null) => void;
  maxSeconds?: number;
}) {
  const { uploading, progress, error, upload, clearError } = useUpload("audio");

  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [permissionError, setPermissionError] = useState("");
  const [levels, setLevels] = useState<number[]>([]);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Assumed supported until hydration so the server and the first client render
  // agree; the real capability check can only run in the browser.
  const hydrated = useHydrated();
  const supported =
    !hydrated ||
    (typeof navigator.mediaDevices?.getUserMedia === "function" &&
      typeof window.MediaRecorder !== "undefined");

  useEffect(() => cleanup, []);

  function cleanup() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void audioCtxRef.current?.close().catch(() => undefined);
    streamRef.current = null;
    audioCtxRef.current = null;
    analyserRef.current = null;
  }

  const pickMimeType = () => {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
  };

  const startRecording = async () => {
    setPermissionError("");
    clearError();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      // Live level meter so the student can see it is actually listening.
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const average = data.reduce((sum, v) => sum + v, 0) / data.length;
        setLevels((prev) => [...prev.slice(-59), Math.min(100, (average / 140) * 100)]);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const recorded = new Blob(chunksRef.current, {
          type: mimeType || "audio/webm",
        });
        setBlob(recorded);
        setPreviewUrl(URL.createObjectURL(recorded));
        cleanup();
      };

      recorder.start(250);
      recorderRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      setLevels([]);

      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= maxSeconds) {
            stopRecording();
            return maxSeconds;
          }
          return s + 1;
        });
      }, 1000);
    } catch (caught) {
      const name = (caught as DOMException)?.name;
      setPermissionError(
        name === "NotAllowedError"
          ? "Microphone access was blocked. Allow it in your browser settings, or upload an audio file instead."
          : "Could not start recording on this device. You can upload an audio file instead.",
      );
      cleanup();
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setRecording(false);
  };

  const discard = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setBlob(null);
    setSeconds(0);
    setLevels([]);
    onChange(null);
    clearError();
  };

  const save = async () => {
    if (!blob) return;
    const extension = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
    const result = await upload(blob, `voice-note.${extension}`);
    if (result) {
      onChange({ ...result, duration: result.duration ?? seconds });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setBlob(null);
    }
  };

  const handleFilePick = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const result = await upload(file);
    if (result) onChange(result);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* ---- Already uploaded ---- */
  if (value) {
    return (
      <div className="space-y-2.5">
        <span className="text-sm font-medium">Voice note</span>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success/14 text-success">
            <Mic className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            { }
            <audio controls src={value.url} className="w-full" preload="metadata" />
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={discard} aria-label="Remove the voice note">
            <Trash2 />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">Voice note</span>
        <span className="text-xs text-muted-foreground">Optional · up to {maxSeconds / 60} min</span>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        {recording && (
          <div className="mb-3">
            <div className="flex h-12 items-end gap-0.5" aria-hidden="true">
              {levels.length === 0 && (
                <span className="text-xs text-muted-foreground">Listening…</span>
              )}
              {levels.map((level, i) => (
                <span
                  key={i}
                  className="w-1 flex-1 rounded-full bg-primary transition-all"
                  style={{ height: `${Math.max(6, level)}%` }}
                />
              ))}
            </div>
            <p className="mt-2 flex items-center gap-2 text-sm font-medium text-destructive">
              <span className="size-2 animate-pulse rounded-full bg-destructive" />
              Recording · {formatDuration(seconds)} / {formatDuration(maxSeconds)}
            </p>
          </div>
        )}

        {previewUrl && !recording && (
          <div className="mb-3">
            { }
            <audio controls src={previewUrl} className="w-full" preload="metadata" />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Recorded {formatDuration(seconds)}. Listen back, then save it or record again.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!recording && !previewUrl && supported && (
            <Button type="button" variant="outline" onClick={() => void startRecording()}>
              <Mic />
              Record a voice note
            </Button>
          )}

          {recording && (
            <Button type="button" variant="destructive" onClick={stopRecording}>
              <Square />
              Stop recording
            </Button>
          )}

          {previewUrl && !recording && (
            <>
              <Button type="button" onClick={() => void save()} disabled={uploading}>
                {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
                {uploading ? "Saving…" : "Save this recording"}
              </Button>
              <Button type="button" variant="ghost" onClick={discard} disabled={uploading}>
                <Trash2 />
                Discard
              </Button>
            </>
          )}

          {!recording && !previewUrl && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => void handleFilePick(e.target.files)}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
                Upload an audio file
              </Button>
            </>
          )}
        </div>

        {uploading && (
          <div className="mt-3 space-y-1">
            <Progress value={progress} />
            <p className="text-xs text-muted-foreground">Uploading… {progress}%</p>
          </div>
        )}
      </div>

      {(permissionError || error) && <Alert tone="warning">{permissionError || error}</Alert>}
      {!permissionError && !error && (
        <p className="text-xs text-muted-foreground">
          Easier than typing? Explain the problem out loud in any language — staff can play it back.
        </p>
      )}
    </div>
  );
}

/** Small play/pause control used on the complaint detail page. */
export function AudioPlayer({ url, duration }: { url: string; duration?: number }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => {
          const el = ref.current;
          if (!el) return;
          if (el.paused) void el.play();
          else el.pause();
        }}
        aria-label={playing ? "Pause the voice note" : "Play the voice note"}
      >
        {playing ? <Pause /> : <Play />}
      </Button>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Voice note from the student</p>
        <p className="text-xs text-muted-foreground">
          {duration ? formatDuration(duration) : "Tap play to listen"}
        </p>
      </div>
      { }
      <audio
        ref={ref}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        className="hidden"
      />
    </div>
  );
}
