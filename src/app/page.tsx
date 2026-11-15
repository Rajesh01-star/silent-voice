"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Camera,
  CameraOff,
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  Activity,
  FileText,
  ExternalLink,
} from "lucide-react";
import { speakPhrase, stopAllSpeech } from "@/lib/speak";
import { AnalyzeResult } from "@/app/api/analyze/route";
import { GESTURES, GestureDefinition } from "@/lib/gestures";

export default function SilentVoiceApp() {
  const [mode, setMode] = useState<"manual" | "auto">("manual");
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [status, setStatus] = useState<"ready" | "scanning" | "detected">("ready");
  const [activeSpeechLang, setActiveSpeechLang] = useState<"en" | "hi" | "or" | null>(null);
  const [selectedLegendKey, setSelectedLegendKey] = useState<string | null>(null);

  const [sarvamCredits, setSarvamCredits] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sarvam_credits_remaining");
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed)) return parsed;
      }
    }
    return 500;
  });

  const [quotaExhausted, setQuotaExhausted] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sarvam_credits_remaining");
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed)) return parsed <= 0;
      }
    }
    return false;
  });

  const [currentResult, setCurrentResult] = useState<AnalyzeResult>({
    detected: true,
    cue: "Ready for gesture",
    en: "Ready to assist. Perform a gesture or blink.",
    hi: "मदद के लिए तैयार। कोई संकेत या इशारा करें।",
    or: "ସାହାଯ୍ୟ ପାଇଁ ପ୍ରସ୍ତୁତ। କୌଣସି ସଙ୍କେତ କରନ୍ତୁ।",
    phraseKey: "help",
    confidence: 1.0,
  });

  const [history, setHistory] = useState<Array<AnalyzeResult & { timestamp: string }>>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const autoScanTimerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleOdiaResponse = useCallback((source: "sarvam" | "fallback", exhausted?: boolean) => {
    if (exhausted) {
      setQuotaExhausted(true);
      setSarvamCredits(0);
      if (typeof window !== "undefined") {
        localStorage.setItem("sarvam_credits_remaining", "0");
      }
    } else if (source === "sarvam") {
      setSarvamCredits((prev) => {
        const next = Math.max(0, prev - 1);
        if (typeof window !== "undefined") {
          localStorage.setItem("sarvam_credits_remaining", String(next));
        }
        return next;
      });
    }
  }, []);

  const setManualCredits = () => {
    const input = window.prompt("Enter your remaining Sarvam AI tries/credits from dashboard:", String(sarvamCredits));
    if (input !== null) {
      const parsed = parseInt(input.trim(), 10);
      if (!isNaN(parsed) && parsed >= 0) {
        setSarvamCredits(parsed);
        setQuotaExhausted(parsed === 0);
        if (typeof window !== "undefined") {
          localStorage.setItem("sarvam_credits_remaining", String(parsed));
        }
      }
    }
  };

  // Initialize camera
  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraError(null);
      setCameraActive(true);
    } catch (err: unknown) {
      console.error("Camera access error:", err);
      const msg = err instanceof Error ? err.message : "Unable to access webcam";
      setCameraError(msg);
      setCameraActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  // Capture frame from video
  const captureFrameBase64 = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current || !cameraActive) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    return canvas.toDataURL("image/jpeg", 0.85);
  }, [cameraActive]);

  // Execute frame analysis
  const analyzeCurrentFrame = useCallback(async () => {
    if (status === "scanning") return;

    setStatus("scanning");
    const frameBase64 = captureFrameBase64();

    if (!frameBase64) {
      setStatus("ready");
      return;
    }

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: frameBase64 }),
      });

      const data: AnalyzeResult = await res.json();
      setCurrentResult(data);
      setSelectedLegendKey(null);

      if (data.detected) {
        setStatus("detected");
        const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        setHistory((prev) => [{ ...data, timestamp: timeStr }, ...prev.slice(0, 4)]);
      } else {
        setStatus("ready");
      }
    } catch (err) {
      console.error("Frame analysis error:", err);
      setStatus("ready");
    }
  }, [captureFrameBase64, status]);

  // Speak results (English & Hindi; Odia on explicit click)
  const speakCurrentResultAll = async () => {
    stopAllSpeech();
    await speakPhrase("all", {
      textEn: currentResult.en,
      textHi: currentResult.hi,
      onStart: (lang) => setActiveSpeechLang(lang),
      onEnd: () => setActiveSpeechLang(null),
    });
  };

  // Replay a specific card's language
  const replaySingleAudio = async (lang: "en" | "hi" | "or") => {
    stopAllSpeech();
    setActiveSpeechLang(lang);
    await speakPhrase(lang, {
      textEn: currentResult.en,
      textHi: currentResult.hi,
      textOr: currentResult.or,
      phraseKey: currentResult.phraseKey,
      onStart: (l) => setActiveSpeechLang(l),
      onEnd: () => setActiveSpeechLang(null),
      onOdiaResponse: handleOdiaResponse,
    });
  };

  // Quick test from bottom legend strip
  const triggerLegendItem = async (item: GestureDefinition) => {
    stopAllSpeech();
    setSelectedLegendKey(item.key);
    const demoResult: AnalyzeResult = {
      detected: true,
      cue: `${item.name} (${item.cue})`,
      en: item.en,
      hi: item.hi,
      or: item.or,
      phraseKey: item.key,
      confidence: 1.0,
    };
    setCurrentResult(demoResult);
    setStatus("detected");
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setHistory((prev) => [{ ...demoResult, timestamp: timeStr }, ...prev.slice(0, 4)]);

    await speakPhrase("en", {
      textEn: item.en,
      onStart: (lang) => setActiveSpeechLang(lang),
      onEnd: () => setActiveSpeechLang(null),
    });
  };

  // Auto-scan cycle
  useEffect(() => {
    if (mode === "auto" && cameraActive) {
      autoScanTimerRef.current = setInterval(() => {
        if (status === "ready" || status === "detected") {
          analyzeCurrentFrame();
        }
      }, 4000);
    } else {
      if (autoScanTimerRef.current) {
        clearInterval(autoScanTimerRef.current);
        autoScanTimerRef.current = null;
      }
    }
    return () => {
      if (autoScanTimerRef.current) {
        clearInterval(autoScanTimerRef.current);
      }
    };
  }, [mode, cameraActive, status, analyzeCurrentFrame]);

  // Spacebar keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        if (cameraActive && status !== "scanning") {
          analyzeCurrentFrame();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cameraActive, status, analyzeCurrentFrame]);

  // Start camera on initial mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    startCamera();
    return () => {
      stopCamera();
      stopAllSpeech();
    };
  }, [startCamera, stopCamera]);

  return (
    <div className="flex flex-col min-h-screen bg-[#111113] text-zinc-100 selection:bg-[#c85a32] selection:text-white">
      {/* Top Header */}
      <header className="border-b border-zinc-800/80 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tracking-tight text-zinc-100">Silent Voice</span>
            <span className="text-zinc-600">/</span>
            <span className="text-xs text-zinc-400 font-normal">AI Gesture & Speech Assistive Translator</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/sheet"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-xs text-zinc-300 hover:text-white transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-[#c85a32]" />
              <span>Sign Chit Sheet</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </Link>

            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-md p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setMode("manual")}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  mode === "manual" ? "bg-zinc-800 text-zinc-100 font-medium" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Manual [Space]
              </button>
              <button
                type="button"
                onClick={() => setMode("auto")}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  mode === "auto" ? "bg-zinc-800 text-zinc-100 font-medium" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Auto (4s)
              </button>
            </div>

            <button
              type="button"
              onClick={stopAllSpeech}
              title="Stop audio"
              className="p-1.5 text-zinc-500 hover:text-zinc-200 transition-colors"
            >
              <VolumeX className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Split-Screen Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Mirrored Webcam Feed with Status Indicator (6 Cols) */}
          <section className="lg:col-span-6 flex flex-col gap-3">
            <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-zinc-900/80 border border-zinc-800 flex items-center justify-center shadow-lg">
              {cameraActive ? (
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className="w-full h-full object-cover transform -scale-x-100"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center text-zinc-500 gap-2">
                  <CameraOff className="w-6 h-6 stroke-1 text-zinc-500" />
                  <p className="text-xs text-zinc-400 mt-1">
                    {cameraError || "Camera inactive. Click below to enable."}
                  </p>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="mt-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded transition-colors"
                  >
                    Enable Camera
                  </button>
                </div>
              )}

              <canvas ref={canvasRef} className="hidden" />

              {/* Status Pill Badge inside Viewfinder */}
              <div className="absolute top-4 left-4 z-10">
                <div
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-medium transition-all ${
                    status === "scanning"
                      ? "bg-amber-950/80 border-amber-500/60 text-amber-300 animate-pulse"
                      : status === "detected"
                      ? "bg-emerald-950/80 border-emerald-500/60 text-emerald-300"
                      : "bg-zinc-950/80 border-zinc-700/60 text-zinc-300"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      status === "scanning"
                        ? "bg-amber-400 animate-ping"
                        : status === "detected"
                        ? "bg-emerald-400"
                        : "bg-zinc-400"
                    }`}
                  />
                  <span>
                    {status === "scanning"
                      ? "Scanning Gesture..."
                      : status === "detected"
                      ? "Gesture Detected"
                      : "Ready for Gesture"}
                  </span>
                </div>
              </div>

              {/* Camera Corner Bounding Frame */}
              {cameraActive && (
                <div className="absolute inset-5 pointer-events-none flex flex-col justify-between">
                  <div className="flex justify-between">
                    <div className="w-5 h-5 border-t-2 border-l-2 border-white/30 rounded-tl-lg" />
                    <div className="w-5 h-5 border-t-2 border-r-2 border-white/30 rounded-tr-lg" />
                  </div>
                  <div className="flex justify-between">
                    <div className="w-5 h-5 border-b-2 border-l-2 border-white/30 rounded-bl-lg" />
                    <div className="w-5 h-5 border-b-2 border-r-2 border-white/30 rounded-br-lg" />
                  </div>
                </div>
              )}

              {/* Reset Stream Icon */}
              {cameraActive && (
                <button
                  type="button"
                  onClick={stopCamera}
                  title="Pause camera"
                  className="absolute top-4 right-4 p-2 rounded-lg bg-zinc-950/70 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors z-10"
                >
                  <Camera className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Action Trigger Bar */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={!cameraActive || status === "scanning"}
                onClick={analyzeCurrentFrame}
                className={`flex-1 py-3.5 px-5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2.5 transition-all shadow-md ${
                  status === "scanning"
                    ? "bg-zinc-800 text-zinc-400 cursor-wait border border-zinc-700"
                    : "bg-[#c85a32] hover:bg-[#b44f2b] text-white active:scale-[0.99] cursor-pointer"
                }`}
              >
                {status === "scanning" ? (
                  <>
                    <Activity className="w-4 h-4 animate-spin" />
                    Scanning & Interpreting Gesture...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    Capture & Translate Gesture <span className="opacity-60 font-mono text-[11px] ml-1">[Space]</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={startCamera}
                title="Restart camera stream"
                className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </section>

          {/* Right Column: High-Contrast Trilingual Output Cards with Prominent One-Tap Replay (6 Cols) */}
          <section className="lg:col-span-6 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-1 border-b border-zinc-800/80">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Recognized Translation</span>
                <span className="text-[11px] font-mono text-[#c85a32]">({currentResult.cue})</span>
              </div>
              <button
                type="button"
                onClick={speakCurrentResultAll}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
                title="Play English and Hindi together"
              >
                <Volume2 className="w-3.5 h-3.5 text-[#c85a32]" />
                <span>Play All (EN + HI)</span>
              </button>
            </div>

            {/* High-Contrast Trilingual Output Cards */}
            <div className="space-y-3.5">
              {/* English Card */}
              <div
                className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                  activeSpeechLang === "en"
                    ? "border-[#c85a32] bg-[#c85a32]/10 shadow-md shadow-[#c85a32]/10"
                    : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                }`}
              >
                <div className="flex-1">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 block mb-1">
                    English
                  </span>
                  <p className="text-xl font-medium text-white tracking-tight leading-snug">
                    {currentResult.en}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => replaySingleAudio("en")}
                  title="One-Tap English Audio Replay"
                  className={`p-3 rounded-xl border transition-all shrink-0 cursor-pointer ${
                    activeSpeechLang === "en"
                      ? "bg-[#c85a32] text-white border-[#c85a32] animate-pulse"
                      : "bg-zinc-800/80 hover:bg-zinc-700 border-zinc-700 text-zinc-200 hover:text-white"
                  }`}
                >
                  <Volume2 className="w-5 h-5" />
                </button>
              </div>

              {/* Hindi Card */}
              <div
                className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                  activeSpeechLang === "hi"
                    ? "border-[#c85a32] bg-[#c85a32]/10 shadow-md shadow-[#c85a32]/10"
                    : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                }`}
              >
                <div className="flex-1">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 block mb-1">
                    हिन्दी (Hindi)
                  </span>
                  <p className="text-xl font-normal text-white tracking-tight leading-snug">
                    {currentResult.hi}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => replaySingleAudio("hi")}
                  title="One-Tap Hindi Audio Replay"
                  className={`p-3 rounded-xl border transition-all shrink-0 cursor-pointer ${
                    activeSpeechLang === "hi"
                      ? "bg-[#c85a32] text-white border-[#c85a32] animate-pulse"
                      : "bg-zinc-800/80 hover:bg-zinc-700 border-zinc-700 text-zinc-200 hover:text-white"
                  }`}
                >
                  <Volume2 className="w-5 h-5" />
                </button>
              </div>

              {/* Odia Card */}
              <div
                className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                  activeSpeechLang === "or"
                    ? "border-[#c85a32] bg-[#c85a32]/10 shadow-md shadow-[#c85a32]/10"
                    : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">
                      ଓଡ଼ିଆ (Odia)
                    </span>
                    {quotaExhausted ? (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-950/70 border border-rose-800 text-rose-300">
                        0 tries left · Fallback Audio
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={setManualCredits}
                        title="Click to calibrate remaining tries with Sarvam dashboard"
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-emerald-400 inline-flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>{sarvamCredits} tries left</span>
                      </button>
                    )}
                  </div>
                  <p className="text-xl font-normal text-white tracking-tight leading-snug">
                    {currentResult.or}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => replaySingleAudio("or")}
                  title="One-Tap Odia Audio Replay (Sarvam AI bulbul:v3)"
                  className={`p-3 rounded-xl border transition-all shrink-0 cursor-pointer ${
                    activeSpeechLang === "or"
                      ? "bg-[#c85a32] text-white border-[#c85a32] animate-pulse"
                      : "bg-zinc-800/80 hover:bg-zinc-700 border-zinc-700 text-zinc-200 hover:text-white"
                  }`}
                >
                  <Volume2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Recent Detection History */}
            {history.length > 0 && (
              <div className="pt-2 text-xs">
                <div className="flex items-center justify-between text-zinc-500 mb-1.5">
                  <span className="uppercase tracking-wider text-[10px] font-medium text-zinc-400">Activity Log</span>
                  <span className="text-[10px] font-mono">{history.length} logged</span>
                </div>
                <div className="space-y-1">
                  {history.map((h, i) => (
                    <div key={`${h.timestamp}-${i}`} className="flex items-center justify-between py-1 border-b border-zinc-800/40 last:border-0 text-zinc-400 text-xs">
                      <span className="truncate pr-4">{h.en}</span>
                      <span className="text-[10px] font-mono text-zinc-600 shrink-0">{h.timestamp}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Bottom Section: Visual Cue Legend Strip (Project Activate Style) */}
        <section className="pt-4 border-t border-zinc-800/80 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                Visual Cue Legend (Project Activate Style)
              </span>
              <span className="text-xs text-zinc-600">· Tap any sign below to test</span>
            </div>
            <Link href="/sheet" className="text-xs text-[#c85a32] hover:underline font-mono">
              View Printable Chit ↗
            </Link>
          </div>

          {/* Horizontal Legend Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {GESTURES.map((item) => {
              const Icon = item.icon;
              const isSelected = selectedLegendKey === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => triggerLegendItem(item)}
                  className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1.5 cursor-pointer ${
                    isSelected
                      ? "border-[#c85a32] bg-[#c85a32]/15 shadow-sm"
                      : "border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/60 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className={isSelected ? "text-[#c85a32]" : "text-zinc-400"}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono font-semibold text-zinc-400">
                      {item.name}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-zinc-200 truncate leading-tight">
                    {item.cue}
                  </span>
                  <span className="text-[10px] text-zinc-500 truncate">
                    {item.en}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
