"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { GESTURES } from "@/lib/gestures";

export default function SheetPage() {
  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="min-h-screen bg-[#111113] text-zinc-100 p-6 md:p-10 print:bg-white print:text-black print:p-0">
      {/* Top Bar (Hidden in Print) */}
      <div className="max-w-5xl mx-auto flex items-center justify-between pb-6 mb-8 border-b border-zinc-800 print:hidden">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Live Camera
        </Link>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-[#c85a32] hover:bg-[#b44f2b] text-white text-xs font-medium transition-colors shadow-sm cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Chit / Save PDF
          </button>
        </div>
      </div>

      {/* Printable Sheet Container */}
      <div className="max-w-5xl mx-auto print:max-w-none print:w-full">
        {/* Header Block */}
        <header className="mb-8 border-b border-zinc-800/80 pb-6 print:border-black/30 print:mb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-widest text-[#c85a32] print:text-black font-semibold block mb-1">
                Pocket Cheat-Sheet & Sign Reference Guide
              </span>
              <h1 className="text-2xl font-semibold tracking-tight text-white print:text-black">
                Silent Voice — Gesture Vocabulary Chit
              </h1>
              <p className="text-xs text-zinc-400 print:text-zinc-700 mt-1">
                Accessible AI Speech & Vision Translator · English · हिन्दी · ଓଡ଼ିଆ
              </p>
            </div>
            <div className="text-right text-[11px] text-zinc-500 print:text-zinc-600 font-mono">
              <span>Theme: Viksit Bharat</span>
              <br />
              <span>AI for Better Life</span>
            </div>
          </div>
        </header>

        {/* 8 Gesture Cards Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-2 print:gap-3">
          {GESTURES.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={item.key}
                className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 print:bg-white print:border-zinc-300 print:p-3 flex flex-col justify-between gap-3"
              >
                <div>
                  {/* Top Bar with Number & Icon */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/60 print:border-zinc-200">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-zinc-800 print:bg-zinc-100 text-[10px] font-mono text-zinc-400 print:text-zinc-800 flex items-center justify-center font-bold">
                        0{idx + 1}
                      </span>
                      <span className="text-xs font-semibold text-zinc-100 print:text-black">{item.name}</span>
                    </div>
                    <div className="text-[#c85a32] print:text-black">
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Physical Action / Cue */}
                  <div className="mb-3">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 print:text-zinc-600 block mb-0.5">
                      How to Sign:
                    </span>
                    <p className="text-xs font-medium text-zinc-300 print:text-zinc-900 leading-snug">
                      {item.howTo}
                    </p>
                  </div>
                </div>

                {/* Trilingual Translations */}
                <div className="space-y-1.5 pt-2 border-t border-zinc-800/50 print:border-zinc-200 text-xs">
                  <div className="flex items-baseline justify-between text-zinc-300 print:text-black">
                    <span className="text-[9px] font-mono uppercase text-zinc-500 print:text-zinc-600">EN:</span>
                    <span className="font-semibold text-right">{item.en}</span>
                  </div>
                  <div className="flex items-baseline justify-between text-zinc-300 print:text-black">
                    <span className="text-[9px] font-mono uppercase text-zinc-500 print:text-zinc-600">HI:</span>
                    <span className="text-right">{item.hi}</span>
                  </div>
                  <div className="flex items-baseline justify-between text-zinc-300 print:text-black">
                    <span className="text-[9px] font-mono uppercase text-zinc-500 print:text-zinc-600">OD:</span>
                    <span className="text-right">{item.or}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* Exhibition Quick Reference & Operator Instructions */}
        <section className="mt-8 p-4 rounded-xl border border-zinc-800 bg-zinc-900/30 print:bg-white print:border-zinc-300 print:p-3 text-xs text-zinc-400 print:text-zinc-800">
          <h2 className="text-xs font-semibold text-zinc-200 print:text-black uppercase tracking-wider mb-2">
            Demo & Presentation Tips for Booth Judges:
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:grid-cols-3 text-[11px] leading-relaxed">
            <div>
              <strong className="text-zinc-300 print:text-black block mb-0.5">1. Framing & Distance:</strong>
              Position the patient/presenter 2 to 3 feet from the webcam so hands, head, and facial expression are visible together.
            </div>
            <div>
              <strong className="text-zinc-300 print:text-black block mb-0.5">2. Hold & Capture:</strong>
              Hold the sign or closed-eye expression steady for 1 second, then tap the Spacebar or &quot;Translate Gesture&quot;.
            </div>
            <div>
              <strong className="text-zinc-300 print:text-black block mb-0.5">3. Audio & Fallback:</strong>
              English and Hindi speak via browser Web Speech; Odia speaks via Sarvam AI API with offline local sound fallbacks.
            </div>
          </div>
        </section>

        {/* Footer Note */}
        <footer className="mt-6 pt-4 border-t border-zinc-800 print:border-zinc-300 text-center text-[10px] text-zinc-600 print:text-zinc-500 font-mono">
          Silent Voice · Single-Page Assistive Communication System · Print or display at exhibition demo booth
        </footer>
      </div>
    </div>
  );
}
