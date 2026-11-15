"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera,
  CameraOff,
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  Activity,
} from "lucide-react";
import { speakPhrase, stopAllSpeech, SupportedLanguage } from "@/lib/speak";
import { AnalyzeResult } from "@/app/api/analyze/route";

interface GestureItem {
  key: "water" | "food" | "pain" | "help" | "yes" | "no" | "thank_you" | "doctor";
  gesture: string;
  en: string;
  hi: string;
  or: string;
}

const VOCABULARY: GestureItem[] = [
  {
    key: "water",
    gesture: "Hand near mouth",
    en: "I need water.",
    hi: "मुझे पानी चाहिए।",
    or: "ମୋତେ ପାଣି ଦରକାର।",
  },
  {
    key: "food",
    gesture: "Hand on stomach",
    en: "I am hungry.",
    hi: "मुझे भूख लगी है।",
    or: "ମୋତେ ଭୋକ ଲାଗୁଛି।",
  },
  {
    key: "pain",
    gesture: "Eyes closed / grimace",
    en: "I am in pain.",
    hi: "मुझे दर्द हो रहा है।",
    or: "ମୋତେ କଷ୍ଟ ହେଉଛି।",
  },
  {
    key: "help",
    gesture: "Raised open palm",
    en: "Please help / Emergency.",
    hi: "कृपया मदद करें।",
    or: "ଦୟାକରି ସାହାଯ୍ୟ କରନ୍ତୁ।",
  },
  {
    key: "yes",
    gesture: "Thumbs up / Nod",
    en: "Yes.",
    hi: "हाँ।",
    or: "ହଁ।",
  },
  {
    key: "no",
    gesture: "Index finger raised",
    en: "No.",
    hi: "नहीं।",
    or: "ନା।",
  },
  {
    key: "thank_you",
    gesture: "Hands joined",
    en: "Thank you.",
    hi: "धन्यवाद।",
    or: "ଧନ୍ୟବାଦ।",
  },
  {
    key: "doctor",
    gesture: "Beckoning gesture",
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
  const triggerDemoPhrase = async (item: GestureItem) => {
    stopAllSpeech();
    const demoResult: AnalyzeResult = {
      detected: true,
      cue: item.gesture,
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
      }, 3500);
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
    <div className="flex flex-col min-h-screen bg-[#111113] text-zinc-100 selection:bg-[#c85a32] selection:text-white">
      {/* Top Header */}
      <header className="border-b border-zinc-800/80 px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Identity */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tracking-tight text-zinc-100">Silent Voice</span>
            <span className="text-zinc-600">/</span>
            <span className="text-xs text-zinc-400 font-normal">Assistive Speech Translation</span>
            <div className="flex items-center gap-1.5 ml-2">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  status === "analyzing"
                    ? "bg-amber-400 animate-pulse"
                    : status === "speaking"
                    ? "bg-[#c85a32] animate-pulse"
                    : cameraActive
                    ? "bg-emerald-400"
                    : "bg-zinc-600"
                }`}
              />
              <span className="text-[11px] text-zinc-400 capitalize">
                {status === "analyzing" ? "analyzing" : status === "speaking" ? "speaking" : cameraActive ? "live" : "offline"}
              </span>
            </div>
          </div>

          {/* Controls: Clean Segmented Groups */}
          <div className="flex items-center gap-4">
            {/* Mode */}
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-md p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setMode("manual")}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  mode === "manual" ? "bg-zinc-800 text-zinc-100 font-medium" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Manual
              </button>
              <button
                type="button"
                onClick={() => setMode("auto")}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  mode === "auto" ? "bg-zinc-800 text-zinc-100 font-medium" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Auto (3s)
              </button>
            </div>

            {/* Language Selector */}
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-md p-0.5 text-xs">
              {(
                [
                  { id: "all", label: "All" },
                  { id: "en", label: "EN" },
                  { id: "hi", label: "HI" },
                  { id: "or", label: "OR" },
                ] as const
              ).map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => setSelectedLang(lang.id)}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    selectedLang === lang.id
                      ? "bg-[#c85a32] text-white font-medium"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>

            {/* Stop Speech */}
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

      {/* Main Workspace */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left Column: Camera Viewport (6 Cols) */}
        <section className="md:col-span-6 flex flex-col gap-4">
          <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-center">
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

            {/* Quiet Corner Markers */}
            {cameraActive && (
              <div className="absolute inset-4 pointer-events-none flex flex-col justify-between">
                <div className="flex justify-between">
                  <div className="w-3 h-3 border-t border-l border-zinc-500/40" />
                  <div className="w-3 h-3 border-t border-r border-zinc-500/40" />
                </div>
                <div className="flex justify-between">
                  <div className="w-3 h-3 border-b border-l border-zinc-500/40" />
                  <div className="w-3 h-3 border-b border-r border-zinc-500/40" />
                </div>
              </div>
            )}

            {/* Camera Switcher Icon */}
            {cameraActive && (
              <button
                type="button"
                onClick={stopCamera}
                title="Pause camera"
                className="absolute top-3 right-3 p-1.5 rounded bg-zinc-950/60 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Trigger Action */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={!cameraActive || status === "analyzing" || status === "capturing"}
              onClick={analyzeCurrentFrame}
              className={`flex-1 py-3 px-4 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors ${
                status === "analyzing"
                  ? "bg-zinc-800 text-zinc-400 cursor-wait"
                  : "bg-[#c85a32] hover:bg-[#b44f2b] text-white active:scale-[0.99] cursor-pointer"
              }`}
            >
              {status === "analyzing" ? (
                <>
                  <Activity className="w-3.5 h-3.5 animate-spin" />
                  Analyzing gesture...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Translate Gesture <span className="text-white/60 font-mono text-[10px] ml-1">[Space]</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={startCamera}
              title="Reset camera"
              className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>

        {/* Right Column: Output & Vocabulary (6 Cols) */}
        <section className="md:col-span-6 flex flex-col gap-6">
          {/* Active Translation Output */}
          <div className="flex flex-col gap-3 pb-6 border-b border-zinc-800/80">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span className="uppercase tracking-wider text-[10px] font-medium text-zinc-400">Current Translation</span>
              <span className="font-mono text-[11px] text-zinc-400">{currentResult.cue}</span>
            </div>

            {/* Trilingual Output Rows */}
            <div className="space-y-3 mt-1">
              {/* English */}
              <div
                className={`p-3 rounded-lg border transition-colors flex items-start justify-between gap-3 ${
                  activeSpeechLang === "en"
                    ? "border-[#c85a32]/60 bg-[#c85a32]/10"
                    : "border-zinc-800/80 bg-zinc-900/40"
                }`}
              >
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 block mb-0.5">English</span>
                  <p className="text-base text-zinc-100 font-normal leading-relaxed">{currentResult.en}</p>
                </div>
                <button
                  type="button"
                  onClick={() => replaySingleAudio("en")}
                  title="Speak English"
                  className="p-1.5 text-zinc-400 hover:text-[#c85a32] transition-colors shrink-0 mt-0.5"
                >
                  <Volume2 className={`w-4 h-4 ${activeSpeechLang === "en" ? "text-[#c85a32]" : ""}`} />
                </button>
              </div>

              {/* Hindi */}
              <div
                className={`p-3 rounded-lg border transition-colors flex items-start justify-between gap-3 ${
                  activeSpeechLang === "hi"
                    ? "border-[#c85a32]/60 bg-[#c85a32]/10"
                    : "border-zinc-800/80 bg-zinc-900/40"
                }`}
              >
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 block mb-0.5">हिन्दी</span>
                  <p className="text-base text-zinc-100 font-normal leading-relaxed">{currentResult.hi}</p>
                </div>
                <button
                  type="button"
                  onClick={() => replaySingleAudio("hi")}
                  title="Speak Hindi"
                  className="p-1.5 text-zinc-400 hover:text-[#c85a32] transition-colors shrink-0 mt-0.5"
                >
                  <Volume2 className={`w-4 h-4 ${activeSpeechLang === "hi" ? "text-[#c85a32]" : ""}`} />
                </button>
              </div>

              {/* Odia */}
              <div
                className={`p-3 rounded-lg border transition-colors flex items-start justify-between gap-3 ${
                  activeSpeechLang === "or"
                    ? "border-[#c85a32]/60 bg-[#c85a32]/10"
                    : "border-zinc-800/80 bg-zinc-900/40"
                }`}
              >
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 block mb-0.5">ଓଡ଼ିଆ</span>
                  <p className="text-base text-zinc-100 font-normal leading-relaxed">{currentResult.or}</p>
                </div>
                <button
                  type="button"
                  onClick={() => replaySingleAudio("or")}
                  title="Speak Odia"
                  className="p-1.5 text-zinc-400 hover:text-[#c85a32] transition-colors shrink-0 mt-0.5"
                >
                  <Volume2 className={`w-4 h-4 ${activeSpeechLang === "or" ? "text-[#c85a32]" : ""}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Clean Reference Table / Quick Simulator */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span className="uppercase tracking-wider text-[10px] font-medium text-zinc-400">Supported Vocabulary</span>
              <span className="text-[11px] text-zinc-500">Click to preview audio</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {VOCABULARY.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => triggerDemoPhrase(item)}
                  className="px-3 py-2 rounded border border-zinc-800/70 bg-zinc-900/30 hover:bg-zinc-800/60 hover:border-zinc-700 text-left transition-colors flex items-center justify-between group cursor-pointer"
                >
                  <div className="truncate pr-2">
                    <span className="text-xs text-zinc-200 block truncate group-hover:text-white">{item.gesture}</span>
                    <span className="text-[11px] text-zinc-500 block truncate">{item.en}</span>
                  </div>
                  <Volume2 className="w-3 h-3 text-zinc-600 group-hover:text-[#c85a32] shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          </div>

          {/* Activity Timeline */}
          {history.length > 0 && (
            <div className="pt-2 text-xs">
              <div className="flex items-center justify-between text-zinc-500 mb-2">
                <span className="uppercase tracking-wider text-[10px] font-medium text-zinc-400">Recent History</span>
                <span className="text-[10px] font-mono">{history.length} events</span>
              </div>
              <div className="space-y-1">
                {history.map((h, i) => (
                  <div key={`${h.timestamp}-${i}`} className="flex items-center justify-between py-1 text-zinc-400 text-xs">
                    <span className="truncate pr-4">{h.en}</span>
                    <span className="text-[10px] font-mono text-zinc-600 shrink-0">{h.timestamp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
