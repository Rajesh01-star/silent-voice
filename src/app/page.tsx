"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Camera,
  CameraOff,
  Volume2,
  Play,
  RotateCcw,
  Loader2,
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
  const [activeEngine, setActiveEngine] = useState<"mediapipe" | "cloud">("mediapipe");
  const [backendStatus, setBackendStatus] = useState<"checking" | "waking" | "online" | "offline">("checking");

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
      let data: AnalyzeResult;
      try {
        const timeoutMs = backendStatus === "online" ? 7000 : 3500;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const backendEndpoint = process.env.NEXT_PUBLIC_BACKEND_URL
          ? `${process.env.NEXT_PUBLIC_BACKEND_URL.replace(/\/$/, "")}/analyze`
          : "http://localhost:8000/analyze";
        const res = await fetch(backendEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: frameBase64 }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error("Local engine unavailable");
        data = await res.json();
        setActiveEngine("mediapipe");
        setBackendStatus("online");
      } catch {
        // Smooth fallback to Next.js API route if Python backend is offline or still waking
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: frameBase64 }),
        });
        data = await res.json();
        setActiveEngine("cloud");
      }

      setCurrentResult(data);
      setSelectedLegendKey(null);

      if (data.detected) {
        setStatus("detected");
        const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        setHistory((prev) => [{ ...data, timestamp: timeStr }, ...prev.slice(0, 4)]);

        // Automatically speak English only (Hindi & Odia remain manual on-click)
        stopAllSpeech();
        speakPhrase("en", {
          textEn: data.en,
          onStart: (lang) => setActiveSpeechLang(lang),
          onEnd: () => setActiveSpeechLang(null),
        });
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

    // Auto-speaks English only; Hindi and Odia remain on explicit click
    stopAllSpeech();
    speakPhrase("en", {
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

  // Warm-up & Keep-alive ping for Render backend (prevents Render cold sleep while tab is open)
  useEffect(() => {
    const rawUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!rawUrl) {
      setBackendStatus("offline");
      setActiveEngine("cloud");
      return;
    }

    const healthUrl = `${rawUrl.replace(/\/$/, "")}/health`;
    let isMounted = true;
    let retryTimer: NodeJS.Timeout | null = null;

    const pingBackend = async (isInitial = false) => {
      if (isInitial) setBackendStatus("waking");
      try {
        const controller = new AbortController();
        // Give Render up to 45s on initial wake-up, or 10s on routine checks
        const timeoutId = setTimeout(() => controller.abort(), isInitial ? 45000 : 10000);
        const res = await fetch(healthUrl, {
          method: "GET",
          signal: controller.signal,
          cache: "no-store",
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          if (isMounted) {
            setBackendStatus("online");
            setActiveEngine("mediapipe");
          }
        } else {
          throw new Error("Health check non-200");
        }
      } catch {
        if (isMounted) {
          if (isInitial) {
            // Still booting up - retry once in 5s
            setBackendStatus("waking");
            retryTimer = setTimeout(() => pingBackend(false), 5000);
          } else {
            setBackendStatus("offline");
            setActiveEngine("cloud");
          }
        }
      }
    };

    // 1. Initial warm-up ping immediately when user opens page
    pingBackend(true);

    // 2. Keep-alive ping every 8 minutes so Render free-tier stays awake
    const keepAliveInterval = setInterval(() => {
      pingBackend(false);
    }, 8 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(keepAliveInterval);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-[#fbfbfa] text-zinc-900 selection:bg-yellow-300 selection:text-zinc-950 font-sans">
      {/* Top Header */}
      <header className="border-b border-zinc-200/90 bg-white/80 backdrop-blur-md px-6 py-3.5 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tracking-tight text-zinc-950">Silent Voice</span>
            <span className="text-zinc-300">/</span>
            <span className="text-xs text-zinc-500 font-normal">AI Gesture & Speech Assistive Translator</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/sheet"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-yellow-50/60 hover:border-yellow-300 text-xs text-zinc-700 hover:text-zinc-950 transition-colors font-medium shadow-2xs"
            >
              <FileText className="w-3.5 h-3.5 text-yellow-600" />
              <span>Sign Chit Sheet</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-50" />
            </Link>

            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono">
              {backendStatus === "waking" ? (
                <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50/80 px-2 py-0.5 rounded border border-amber-200/80">
                  <Loader2 className="w-3 h-3 text-amber-500 animate-spin" />
                  <span>Waking Render Engine...</span>
                </div>
              ) : activeEngine === "mediapipe" && backendStatus === "online" ? (
                <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/70">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                  <span>MediaPipe Vision</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Cloud Vision</span>
                </div>
              )}
            </div>

            <div className="flex items-center bg-zinc-100 border border-zinc-200/90 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setMode("manual")}
                className={`px-3 py-1 rounded-md text-xs transition-all ${
                  mode === "manual" ? "bg-white text-zinc-950 font-semibold shadow-xs" : "text-zinc-600 hover:text-zinc-950"
                }`}
              >
                Manual [Space]
              </button>
              <button
                type="button"
                onClick={() => setMode("auto")}
                className={`px-3 py-1 rounded-md text-xs transition-all ${
                  mode === "auto" ? "bg-white text-zinc-950 font-semibold shadow-xs" : "text-zinc-600 hover:text-zinc-950"
                }`}
              >
                Auto (4s)
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Split-Screen Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Mirrored Webcam Feed with Status Indicator (6 Cols) */}
          <section className="lg:col-span-6 flex flex-col gap-3">
            <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-200 shadow-sm flex items-center justify-center">
              {cameraActive ? (
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className="w-full h-full object-cover transform -scale-x-100"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center text-zinc-400 gap-2">
                  <CameraOff className="w-6 h-6 stroke-1 text-zinc-400" />
                  <p className="text-xs text-zinc-500 mt-1">
                    {cameraError || "Camera inactive. Click below to enable."}
                  </p>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="mt-2 px-3.5 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-zinc-950 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
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
                      ? "bg-yellow-400/90 border-yellow-300 text-zinc-950 shadow-sm"
                      : status === "detected"
                      ? "bg-emerald-600/90 border-emerald-400 text-white shadow-sm"
                      : "bg-zinc-900/80 border-zinc-700/60 text-zinc-200"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      status === "scanning"
                        ? "bg-zinc-950 animate-ping"
                        : status === "detected"
                        ? "bg-white"
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
                    <div className="w-5 h-5 border-t-2 border-l-2 border-yellow-400/70 rounded-tl-lg" />
                    <div className="w-5 h-5 border-t-2 border-r-2 border-yellow-400/70 rounded-tr-lg" />
                  </div>
                  <div className="flex justify-between">
                    <div className="w-5 h-5 border-b-2 border-l-2 border-yellow-400/70 rounded-bl-lg" />
                    <div className="w-5 h-5 border-b-2 border-r-2 border-yellow-400/70 rounded-br-lg" />
                  </div>
                </div>
              )}

              {/* Reset Stream Icon */}
              {cameraActive && (
                <button
                  type="button"
                  onClick={stopCamera}
                  title="Pause camera"
                  className="absolute top-4 right-4 p-2 rounded-lg bg-zinc-900/70 border border-zinc-700 text-zinc-300 hover:text-white transition-colors z-10 cursor-pointer"
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
                className={`flex-1 py-3.5 px-5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2.5 transition-all shadow-sm ${
                  status === "scanning"
                    ? "bg-zinc-200 text-zinc-500 cursor-wait border border-zinc-300"
                    : "bg-yellow-400 hover:bg-yellow-300 active:bg-yellow-500 text-zinc-950 border border-yellow-500/40 active:scale-[0.99] cursor-pointer font-semibold shadow-xs"
                }`}
              >
                {status === "scanning" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-600" />
                    Scanning & Interpreting Gesture...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current text-zinc-950" />
                    Capture & Translate Gesture <span className="opacity-60 font-mono text-[11px] ml-1">[Space]</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={startCamera}
                title="Restart camera stream"
                className="p-3.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-zinc-950 transition-colors shadow-2xs cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </section>

          {/* Right Column: High-Contrast Trilingual Output Cards (6 Cols) */}
          <section className="lg:col-span-6 flex flex-col gap-3">
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={speakCurrentResultAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-yellow-50 hover:border-yellow-300 text-zinc-800 hover:text-yellow-950 text-xs font-medium transition-colors shadow-2xs cursor-pointer"
                title="Play English and Hindi together"
              >
                <Volume2 className="w-3.5 h-3.5 text-yellow-600" />
                <span>Play All (EN + HI)</span>
              </button>
            </div>

            {/* High-Contrast Trilingual Output Cards */}
            <div className="space-y-3.5">
              {/* English Card */}
              <div
                className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                  activeSpeechLang === "en"
                    ? "border-yellow-500 bg-yellow-50/80 shadow-md shadow-yellow-500/10"
                    : "border-zinc-200 bg-white hover:border-zinc-300 shadow-2xs"
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 font-semibold">
                      English
                    </span>
                    <span className="text-[9px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      Auto-Spoken
                    </span>
                  </div>
                  <p className="text-xl font-medium text-zinc-950 tracking-tight leading-snug">
                    {currentResult.en}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => replaySingleAudio("en")}
                  title="Replay English Audio"
                  className={`p-3 rounded-xl border transition-all shrink-0 cursor-pointer ${
                    activeSpeechLang === "en"
                      ? "bg-yellow-400 text-zinc-950 border-yellow-500 animate-pulse shadow-xs"
                      : "bg-zinc-50 hover:bg-yellow-50 border-zinc-200 hover:border-yellow-300 text-zinc-700 hover:text-zinc-950"
                  }`}
                >
                  <Volume2 className="w-5 h-5" />
                </button>
              </div>

              {/* Hindi Card */}
              <div
                className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                  activeSpeechLang === "hi"
                    ? "border-yellow-500 bg-yellow-50/80 shadow-md shadow-yellow-500/10"
                    : "border-zinc-200 bg-white hover:border-zinc-300 shadow-2xs"
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 font-semibold">
                      हिन्दी (Hindi)
                    </span>
                    <span className="text-[9px] font-mono text-yellow-800 bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-200">
                      Click Button to Speak
                    </span>
                  </div>
                  <p className="text-xl font-normal text-zinc-950 tracking-tight leading-snug">
                    {currentResult.hi}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => replaySingleAudio("hi")}
                  title="Replay Hindi Audio"
                  className={`p-3 rounded-xl border transition-all shrink-0 cursor-pointer ${
                    activeSpeechLang === "hi"
                      ? "bg-yellow-400 text-zinc-950 border-yellow-500 animate-pulse shadow-xs"
                      : "bg-zinc-50 hover:bg-yellow-50 border-zinc-200 hover:border-yellow-300 text-zinc-700 hover:text-zinc-950"
                  }`}
                >
                  <Volume2 className="w-5 h-5" />
                </button>
              </div>

              {/* Odia Card */}
              <div
                className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                  activeSpeechLang === "or"
                    ? "border-yellow-500 bg-yellow-50/80 shadow-md shadow-yellow-500/10"
                    : "border-zinc-200 bg-white hover:border-zinc-300 shadow-2xs"
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 font-semibold">
                      ଓଡ଼ିଆ (Odia)
                    </span>
                    <span className="text-[9px] font-mono text-yellow-800 bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-200">
                      Click Button to Speak
                    </span>
                    {quotaExhausted ? (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700">
                        0 tries left · Fallback Audio
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={setManualCredits}
                        title="Click to calibrate remaining tries with Sarvam dashboard"
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-emerald-700 inline-flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>{sarvamCredits} tries left</span>
                      </button>
                    )}
                  </div>
                  <p className="text-xl font-normal text-zinc-950 tracking-tight leading-snug">
                    {currentResult.or}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => replaySingleAudio("or")}
                  title="Click to Speak Odia (Sarvam AI bulbul:v3)"
                  className={`p-3 rounded-xl border transition-all shrink-0 cursor-pointer ${
                    activeSpeechLang === "or"
                      ? "bg-yellow-400 text-zinc-950 border-yellow-500 animate-pulse shadow-xs"
                      : "bg-yellow-50 hover:bg-yellow-100 border-yellow-200 text-yellow-900 shadow-2xs"
                  }`}
                >
                  <Volume2 className="w-5 h-5 text-yellow-800" />
                </button>
              </div>
            </div>

            {/* Recent Detection History */}
            {history.length > 0 && (
              <div className="pt-2 text-xs">
                <div className="flex items-center justify-between text-zinc-500 mb-1.5">
                  <span className="uppercase tracking-wider text-[10px] font-semibold text-zinc-600">Activity Log</span>
                  <span className="text-[10px] font-mono text-zinc-500">{history.length} logged</span>
                </div>
                <div className="space-y-1">
                  {history.map((h, i) => (
                    <div key={`${h.timestamp}-${i}`} className="flex items-center justify-between py-1.5 border-b border-zinc-200/60 last:border-0 text-zinc-700 text-xs">
                      <span className="truncate pr-4 font-medium text-zinc-800">{h.en}</span>
                      <span className="text-[10px] font-mono text-zinc-400 shrink-0">{h.timestamp}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Bottom Section: Visual Cue Legend Strip (Project Activate Style) */}
        <section className="pt-5 border-t border-zinc-200 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-600 font-semibold">
                Visual Cue Legend · Core Quick Signs
              </span>
              <span className="text-xs text-zinc-400">· 50 calibrated signs supported · Tap to test</span>
            </div>
            <Link href="/sheet" className="text-xs text-yellow-700 hover:text-yellow-800 hover:underline font-mono font-medium">
              View All 50 Signs in Chit ↗
            </Link>
          </div>

          {/* Horizontal Legend Strip (Top 8 Vital Quick Access) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 items-stretch">
            {GESTURES.slice(0, 8).map((item) => {
              const Icon = item.icon;
              const isSelected = selectedLegendKey === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => triggerLegendItem(item)}
                  className={`h-full min-h-[110px] p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                    isSelected
                      ? "border-yellow-500 bg-yellow-50/90 shadow-xs ring-1 ring-yellow-400/50"
                      : "border-zinc-200 bg-white hover:bg-yellow-50/40 hover:border-yellow-300 shadow-2xs"
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5 mb-1.5">
                    <div className={`mt-0.5 shrink-0 ${isSelected ? "text-yellow-700" : "text-zinc-500"}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono font-semibold text-zinc-800 text-right leading-tight">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex-1 flex flex-col justify-between gap-1">
                    <p className="text-[11px] font-medium text-zinc-900 leading-snug break-words">
                      {item.cue}
                    </p>
                    <p className="text-[10px] text-zinc-500 leading-tight pt-1 border-t border-zinc-100 break-words">
                      {item.en}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
