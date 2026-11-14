"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera,
  CameraOff,
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  Sparkles,
  Activity,
  CheckCircle2,
  Clock,
  Hand,
  Keyboard,
  Info,
} from "lucide-react";
import { speakPhrase, stopAllSpeech, SupportedLanguage } from "@/lib/speak";
import { AnalyzeResult } from "@/app/api/analyze/route";

interface GestureGuideItem {
  key: "water" | "food" | "pain" | "help" | "yes" | "no" | "thank_you" | "doctor";
  icon: string;
  gesture: string;
  en: string;
  hi: string;
  or: string;
}

const GESTURE_VOCABULARY: GestureGuideItem[] = [
  {
    key: "water",
    icon: "💧",
    gesture: "Hand near mouth",
    en: "I need water.",
    hi: "मुझे पानी चाहिए।",
    or: "ମୋତେ ପାଣି ଦରକାର।",
  },
  {
    key: "food",
    icon: "🍲",
    gesture: "Hand on stomach",
    en: "I am hungry.",
    hi: "मुझे भूख लगी है।",
    or: "ମୋତେ ଭୋକ ଲାଗୁଛି।",
  },
  {
    key: "pain",
    icon: "⚡",
    gesture: "Eyes tightly shut / frown",
    en: "I am in pain.",
    hi: "मुझे दर्द हो रहा है।",
    or: "ମୋତେ କଷ୍ଟ ହେଉଛି।",
  },
  {
    key: "help",
    icon: "🚨",
    gesture: "Raised open palm",
    en: "Please help / Emergency.",
    hi: "कृपया मदद करें।",
    or: "ଦୟାକରି ସାହାଯ୍ୟ କରନ୍ତୁ।",
  },
  {
    key: "yes",
    icon: "👍",
    gesture: "Thumbs up / Nod",
    en: "Yes.",
    hi: "हाँ।",
    or: "ହଁ।",
  },
  {
    key: "no",
    icon: "☝️",
    gesture: "Index finger raised / Shake",
    en: "No.",
    hi: "नहीं।",
    or: "ନା।",
  },
  {
    key: "thank_you",
    icon: "🙏",
    gesture: "Hands joined (Namaste)",
    en: "Thank you.",
    hi: "धन्यवाद।",
    or: "ଧନ୍ୟବାଦ।",
  },
  {
    key: "doctor",
    icon: "🩺",
    gesture: "Pointing / calling gesture",
    en: "Call the doctor.",
    hi: "डॉक्टर को बुलाइए।",
    or: "ଡାକ୍ତରଙ୍କୁ ଡାକନ୍ତୁ।",
  },
];

export default function SilentVoiceApp() {
  const [selectedLang, setSelectedLang] = useState<SupportedLanguage>("all");
  const [mode, setMode] = useState<"manual" | "auto">("manual");
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [status, setStatus] = useState<"ready" | "capturing" | "analyzing" | "speaking">("ready");
  const [activeSpeechLang, setActiveSpeechLang] = useState<"en" | "hi" | "or" | null>(null);

  const [currentResult, setCurrentResult] = useState<AnalyzeResult>({
    detected: true,
    cue: "System initialized. Ready for gesture input.",
    en: "Ready to assist. Perform any gesture or blink.",
    hi: "मदद के लिए तैयार। कोई भी संकेत या इशारा करें।",
    or: "ସାହାଯ୍ୟ ପାଇଁ ପ୍ରସ୍ତୁତ। କୌଣସି ସଙ୍କେତ କରନ୍ତୁ।",
    phraseKey: "help",
    confidence: 1.0,
  });

  const [history, setHistory] = useState<Array<AnalyzeResult & { timestamp: string }>>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const autoScanTimerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  // Capture frame from video feed
  const captureFrameBase64 = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current || !cameraActive) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Flip horizontally to match the mirrored video feed
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    return canvas.toDataURL("image/jpeg", 0.85);
  }, [cameraActive]);

  // Execute frame analysis
  const analyzeCurrentFrame = useCallback(async () => {
    if (status === "analyzing" || status === "capturing") return;

    setStatus("capturing");
    const frameBase64 = captureFrameBase64();

    if (!frameBase64) {
      setStatus("ready");
      return;
    }

    setStatus("analyzing");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: frameBase64 }),
      });

      const data: AnalyzeResult = await res.json();
      setCurrentResult(data);

      if (data.detected) {
        const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        setHistory((prev) => [{ ...data, timestamp: timeStr }, ...prev.slice(0, 4)]);

        // Voice output
        setStatus("speaking");
        await speakPhrase(selectedLang, {
          textEn: data.en,
          textHi: data.hi,
          textOr: data.or,
          phraseKey: data.phraseKey,
          onStart: (lang) => setActiveSpeechLang(lang),
          onEnd: () => {
            setActiveSpeechLang(null);
            setStatus("ready");
          },
        });
      } else {
        setStatus("ready");
      }
    } catch (err) {
      console.error("Frame analysis error:", err);
      setStatus("ready");
    }
  }, [captureFrameBase64, selectedLang, status]);

  // Quick test demo trigger
  const triggerDemoPhrase = async (item: GestureGuideItem) => {
    stopAllSpeech();
    const demoResult: AnalyzeResult = {
      detected: true,
      cue: `Demonstration: ${item.gesture}`,
      en: item.en,
      hi: item.hi,
      or: item.or,
      phraseKey: item.key,
      confidence: 1.0,
    };
    setCurrentResult(demoResult);
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setHistory((prev) => [{ ...demoResult, timestamp: timeStr }, ...prev.slice(0, 4)]);

    setStatus("speaking");
    await speakPhrase(selectedLang, {
      textEn: item.en,
      textHi: item.hi,
      textOr: item.or,
      phraseKey: item.key,
      onStart: (lang) => setActiveSpeechLang(lang),
      onEnd: () => {
        setActiveSpeechLang(null);
        setStatus("ready");
      },
    });
  };

  // Replay a specific card's language
  const replaySingleAudio = async (lang: "en" | "hi" | "or") => {
    stopAllSpeech();
    setStatus("speaking");
    setActiveSpeechLang(lang);
    await speakPhrase(lang, {
      textEn: currentResult.en,
      textHi: currentResult.hi,
      textOr: currentResult.or,
      phraseKey: currentResult.phraseKey,
      onStart: (l) => setActiveSpeechLang(l),
      onEnd: () => {
        setActiveSpeechLang(null);
        setStatus("ready");
      },
    });
  };

  // Auto-scan cycle
  useEffect(() => {
    if (mode === "auto" && cameraActive) {
      autoScanTimerRef.current = setInterval(() => {
        if (status === "ready") {
          analyzeCurrentFrame();
        }
      }, 3200);
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

  // Spacebar keyboard listener for instant manual trigger
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        if (cameraActive && status === "ready") {
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
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      {/* Top Header / Control Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30 px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Logo & Theme Title */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shadow-sm shadow-teal-500/10">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">Silent Voice</h1>
                <span className="text-[11px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/30">
                  AI for Better Life
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Assistive Vision & Multilingual Speech Translator (English · हिन्दी · ଓଡ଼ିଆ)
              </p>
            </div>
          </div>

          {/* Controls: Mode Switcher & Language Selector */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Mode Switcher */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setMode("manual")}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  mode === "manual"
                    ? "bg-teal-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Manual Trigger
              </button>
              <button
                type="button"
                onClick={() => setMode("auto")}
                className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors ${
                  mode === "auto"
                    ? "bg-teal-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                Auto-Scan (3s)
              </button>
            </div>

            {/* Language Selector */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
              <span className="px-2 text-slate-400 text-[11px] hidden sm:inline">Voice:</span>
              {(
                [
                  { id: "all", label: "Speak All" },
                  { id: "en", label: "English" },
                  { id: "hi", label: "हिन्दी" },
                  { id: "or", label: "ଓଡ଼ିଆ" },
                ] as const
              ).map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => setSelectedLang(lang.id)}
                  className={`px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                    selectedLang === lang.id
                      ? "bg-slate-700 text-teal-300 font-semibold shadow-xs"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>

            {/* Emergency Stop Audio */}
            <button
              type="button"
              onClick={stopAllSpeech}
              title="Stop active speech"
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
            >
              <VolumeX className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / Center: Camera Feed & Trigger Zone (7 Cols) */}
        <section className="lg:col-span-7 flex flex-col gap-4">
          {/* Camera Viewport Container */}
          <div className="relative aspect-4/3 w-full rounded-2xl overflow-hidden bg-slate-900/90 border border-slate-800 shadow-2xl flex items-center justify-center">
            {cameraActive ? (
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-cover transform -scale-x-100"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400 gap-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-500">
                  <CameraOff className="w-7 h-7" />
                </div>
                <div>
                  <p className="font-semibold text-slate-200">Camera is Inactive</p>
                  <p className="text-xs text-slate-400 max-w-xs mt-1">
                    {cameraError || "Grant camera permissions in your browser to start tracking gestures."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={startCamera}
                  className="mt-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  Enable Camera
                </button>
              </div>
            )}

            {/* Hidden snapshot canvas */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Mirrored Framing Reticle (Quiet Target Overlay) */}
            {cameraActive && (
              <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6">
                <div className="flex justify-between items-start">
                  {/* Status Badge */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/80 border border-slate-700/60 backdrop-blur-md text-xs font-medium">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        status === "analyzing"
                          ? "bg-amber-400 animate-ping"
                          : status === "speaking"
                          ? "bg-teal-400 animate-pulse"
                          : status === "capturing"
                          ? "bg-blue-400"
                          : "bg-emerald-400"
                      }`}
                    />
                    <span className="capitalize text-slate-200">
                      {status === "analyzing"
                        ? "Gemini Analyzing..."
                        : status === "speaking"
                        ? "Synthesizing Speech..."
                        : status === "capturing"
                        ? "Capturing Frame..."
                        : "Ready for Gesture"}
                    </span>
                  </div>

                  {/* Camera Toggle */}
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="pointer-events-auto p-2 rounded-lg bg-slate-950/70 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Turn off camera"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>

                {/* Subtle Target Focus Reticle */}
                <div className="self-center w-56 h-64 border-2 border-dashed border-teal-500/30 rounded-3xl relative flex items-center justify-center">
                  <span className="text-[10px] text-teal-400/60 tracking-wider uppercase font-semibold">
                    Position Face & Hand Here
                  </span>
                  <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-teal-400" />
                  <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-teal-400" />
                  <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-teal-400" />
                  <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-teal-400" />
                </div>

                {/* Bottom hint badge */}
                <div className="self-center px-3 py-1 rounded-full bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Keyboard className="w-3.5 h-3.5 text-teal-400" />
                  <span>Press Spacebar or button below to capture</span>
                </div>
              </div>
            )}
          </div>

          {/* Action Button Bar */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!cameraActive || status === "analyzing" || status === "capturing"}
              onClick={analyzeCurrentFrame}
              className={`flex-1 py-3.5 px-6 rounded-xl font-semibold text-sm flex items-center justify-center gap-2.5 transition-all shadow-lg ${
                status === "analyzing"
                  ? "bg-slate-800 text-slate-400 cursor-wait border border-slate-700"
                  : "bg-teal-500 hover:bg-teal-400 text-slate-950 hover:shadow-teal-500/25 cursor-pointer active:scale-[0.99]"
              }`}
            >
              {status === "analyzing" ? (
                <>
                  <Activity className="w-4 h-4 animate-spin text-teal-400" />
                  Analyzing Gesture & Blink...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Capture & Translate Gesture
                </>
              )}
            </button>

            <button
              type="button"
              onClick={startCamera}
              title="Restart camera stream"
              className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Explanation / How it Works Card */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 text-xs text-slate-400 flex items-start gap-3">
            <Info className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-slate-300 font-medium">How Silent Voice Operates:</p>
              <p>
                The camera captures intentional physical signals (a hand to the mouth, eyes shut in pain, or thumbs up) and streams them to Gemini 2.5 Flash. The interpreted patient requirement is immediately voiced in Hindi, Odia, and English.
              </p>
            </div>
          </div>
        </section>

        {/* Right: Translation Output Cards & Gesture Reference Guide (5 Cols) */}
        <section className="lg:col-span-5 flex flex-col gap-5">
          {/* Detected Cue & Status Banner */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-teal-400 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Live Translation Output
              </span>
              <span className="text-xs text-slate-400">
                Confidence: <strong className="text-slate-200">{(currentResult.confidence * 100).toFixed(0)}%</strong>
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300">
              <span className="text-slate-400 font-mono text-[11px] block">Observed Cue:</span>
              <span className="font-semibold text-slate-100">{currentResult.cue}</span>
            </div>

            {/* Trilingual Output Display Cards */}
            <div className="space-y-2.5">
              {/* English Card */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  activeSpeechLang === "en"
                    ? "bg-teal-950/30 border-teal-500 shadow-md shadow-teal-500/10"
                    : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-teal-400 uppercase tracking-wide">
                    English
                  </span>
                  <button
                    type="button"
                    onClick={() => replaySingleAudio("en")}
                    className="p-1 rounded text-slate-400 hover:text-teal-300 transition-colors"
                    title="Replay English speech"
                  >
                    <Volume2
                      className={`w-4 h-4 ${activeSpeechLang === "en" ? "animate-pulse text-teal-400" : ""}`}
                    />
                  </button>
                </div>
                <p className="text-base font-semibold text-white tracking-wide">{currentResult.en}</p>
              </div>

              {/* Hindi Card */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  activeSpeechLang === "hi"
                    ? "bg-teal-950/30 border-teal-500 shadow-md shadow-teal-500/10"
                    : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-teal-400 uppercase tracking-wide">
                    हिन्दी (Hindi)
                  </span>
                  <button
                    type="button"
                    onClick={() => replaySingleAudio("hi")}
                    className="p-1 rounded text-slate-400 hover:text-teal-300 transition-colors"
                    title="Replay Hindi speech"
                  >
                    <Volume2
                      className={`w-4 h-4 ${activeSpeechLang === "hi" ? "animate-pulse text-teal-400" : ""}`}
                    />
                  </button>
                </div>
                <p className="text-base font-medium text-slate-100">{currentResult.hi}</p>
              </div>

              {/* Odia Card */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  activeSpeechLang === "or"
                    ? "bg-teal-950/30 border-teal-500 shadow-md shadow-teal-500/10"
                    : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-teal-400 uppercase tracking-wide">
                    ଓଡ଼ିଆ (Odia)
                  </span>
                  <button
                    type="button"
                    onClick={() => replaySingleAudio("or")}
                    className="p-1 rounded text-slate-400 hover:text-teal-300 transition-colors"
                    title="Replay Odia speech"
                  >
                    <Volume2
                      className={`w-4 h-4 ${activeSpeechLang === "or" ? "animate-pulse text-teal-400" : ""}`}
                    />
                  </button>
                </div>
                <p className="text-base font-medium text-slate-100">{currentResult.or}</p>
              </div>
            </div>
          </div>

          {/* Quick Gesture Reference Guide & Interactive Simulator */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Hand className="w-3.5 h-3.5 text-teal-400" />
                Supported Gestures & Simulator
              </h2>
              <span className="text-[10px] text-slate-500">Click any item to test</span>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
              {GESTURE_VOCABULARY.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => triggerDemoPhrase(item)}
                  className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-teal-500/50 hover:bg-slate-900 text-left transition-all group flex flex-col gap-1 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">{item.icon}</span>
                    <Volume2 className="w-3 h-3 text-slate-600 group-hover:text-teal-400 transition-colors" />
                  </div>
                  <span className="text-xs font-semibold text-slate-200 group-hover:text-teal-300 leading-tight">
                    {item.gesture}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate">{item.en}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Gesture History */}
          {history.length > 0 && (
            <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800/70 text-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Recent Activity
                </span>
                <span className="text-[10px] text-slate-500">Last {history.length}</span>
              </div>
              <div className="space-y-1.5">
                {history.map((h, i) => (
                  <div
                    key={`${h.timestamp}-${i}`}
                    className="flex items-center justify-between py-1 border-b border-slate-800/40 last:border-0 text-slate-300"
                  >
                    <span className="truncate pr-2">{h.en}</span>
                    <span className="text-[10px] text-slate-500 shrink-0 font-mono">{h.timestamp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Footer / Metadata */}
      <footer className="border-t border-slate-800/60 py-3 px-6 text-center text-xs text-slate-500">
        <p>
          Silent Voice · Viksit Bharat AI Project · Science, Technology, and Innovation for Sustainable Healthcare
        </p>
      </footer>
    </div>
  );
}
