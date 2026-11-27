"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, Search, Filter } from "lucide-react";
import { GESTURES, GestureCategory } from "@/lib/gestures";

const CATEGORIES: Array<"All" | GestureCategory> = [
  "All",
  "Emergency",
  "Daily Needs",
  "Mobility",
  "Comfort & Environment",
  "Emotions & Responses",
  "People & Devices",
];

export default function SheetPage() {
  const [selectedCategory, setSelectedCategory] = useState<"All" | GestureCategory>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const filteredGestures = useMemo(() => {
    return GESTURES.filter((g) => {
      const matchesCategory = selectedCategory === "All" || g.category === selectedCategory;
      const query = searchQuery.toLowerCase().trim();
      if (!query) return matchesCategory;

      const matchesQuery =
        g.name.toLowerCase().includes(query) ||
        g.cue.toLowerCase().includes(query) ||
        g.howTo.toLowerCase().includes(query) ||
        g.en.toLowerCase().includes(query) ||
        g.hi.toLowerCase().includes(query) ||
        g.or.includes(query) ||
        String(g.id).includes(query);

      return matchesCategory && matchesQuery;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-[#fbfbfa] text-zinc-900 p-6 md:p-10 font-sans print:bg-white print:text-black print:p-0">
      {/* Top Bar (Hidden in Print) */}
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 mb-8 border-b border-zinc-200 print:hidden">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-600 hover:text-zinc-950 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Live Camera
        </Link>

        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 font-mono">
            {filteredGestures.length} of {GESTURES.length} signs shown
          </span>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-zinc-950 text-xs font-semibold border border-yellow-500/40 transition-colors shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Full 50-Sign Chit / PDF
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto print:max-w-none print:w-full">
        {/* Header Block */}
        <header className="mb-6 border-b border-zinc-200 pb-6 print:border-black/30 print:mb-4">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-widest text-yellow-700 print:text-black font-semibold block mb-1">
                Official Assistive Communication Vocabulary · 50 Calibrated Signs
              </span>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950 print:text-black">
                Silent Voice — 50 Sign Gesture Chit
              </h1>
              <p className="text-xs text-zinc-600 print:text-zinc-700 mt-1 max-w-2xl leading-relaxed">
                Standardized visual cue reference designed for paralyzed, ventilated, and speech-impaired patients.
                Each sign translates instantly into English, हिन्दी, and ଓଡ଼ିଆ.
              </p>
            </div>
            <div className="text-left md:text-right text-[11px] text-zinc-500 print:text-zinc-600 font-mono shrink-0">
              <span>Theme: Viksit Bharat</span>
              <br />
              <span>AI for Better Life</span>
              <br />
              <span className="text-zinc-800 print:text-black font-semibold">50 Verified Signs</span>
            </div>
          </div>

          {/* Search & Category Filter Controls (Hidden in Print) */}
          <div className="mt-6 flex flex-col md:flex-row items-stretch md:items-center gap-3 print:hidden">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by keyword, sign, or translation (e.g. water, blanket, pain, ଡାକ୍ତର)..."
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-white border border-zinc-200 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-yellow-500 transition-colors shadow-2xs"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              <Filter className="w-3.5 h-3.5 text-zinc-400 shrink-0 hidden lg:inline" />
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? "bg-yellow-400 text-zinc-950 border border-yellow-500/40 shadow-xs"
                      : "bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-50"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* 50 Signs Responsive Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 print:grid-cols-2 print:gap-2.5">
          {filteredGestures.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.key}
                className="p-3.5 rounded-xl border border-zinc-200 bg-white print:bg-white print:border-zinc-300 print:p-2.5 flex flex-col justify-between gap-2.5 break-inside-avoid hover:border-yellow-400/70 hover:shadow-2xs transition-all shadow-2xs"
              >
                <div>
                  {/* Top Header: ID, Category & Icon */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-100 print:border-zinc-200">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-zinc-100 print:bg-zinc-100 text-[10px] font-mono text-zinc-700 print:text-zinc-800 flex items-center justify-center font-bold">
                        {String(item.id).padStart(2, "0")}
                      </span>
                      <div>
                        <span className="text-xs font-semibold text-zinc-900 print:text-black block leading-tight">
                          {item.name}
                        </span>
                        <span className="text-[9px] uppercase font-mono text-zinc-500 print:text-zinc-600 block">
                          {item.category}
                        </span>
                      </div>
                    </div>
                    <div className="text-yellow-700 print:text-black p-1 bg-yellow-50 print:bg-transparent rounded">
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Physical Action Cue & How to Sign */}
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-1 text-[11px]">
                      <span className="text-[9px] font-mono uppercase text-zinc-500 print:text-zinc-600 shrink-0 font-semibold">
                        Cue:
                      </span>
                      <span className="font-medium text-zinc-800 print:text-zinc-800 truncate">
                        {item.cue}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-600 print:text-zinc-700 leading-snug">
                      {item.howTo}
                    </p>
                  </div>
                </div>

                {/* Trilingual Translations Table */}
                <div className="pt-2 border-t border-zinc-100 print:border-zinc-200 space-y-1 text-xs">
                  <div className="flex items-baseline justify-between text-zinc-900 print:text-black">
                    <span className="text-[9px] font-mono uppercase text-zinc-500 print:text-zinc-600 font-semibold">EN:</span>
                    <span className="font-semibold text-right truncate pl-2">{item.en}</span>
                  </div>
                  <div className="flex items-baseline justify-between text-zinc-800 print:text-black">
                    <span className="text-[9px] font-mono uppercase text-zinc-500 print:text-zinc-600 font-semibold">HI:</span>
                    <span className="text-right truncate pl-2">{item.hi}</span>
                  </div>
                  <div className="flex items-baseline justify-between text-zinc-800 print:text-black">
                    <span className="text-[9px] font-mono uppercase text-zinc-500 print:text-zinc-600 font-semibold">OD:</span>
                    <span className="text-right truncate pl-2">{item.or}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {filteredGestures.length === 0 && (
          <div className="py-16 text-center text-zinc-500 text-xs">
            No signs found matching &quot;{searchQuery}&quot;. Clear search to view all 50 signs.
          </div>
        )}

        {/* Operator Instructions & Exhibition Manual */}
        <section className="mt-8 p-4 rounded-xl border border-zinc-200 bg-white print:bg-white print:border-zinc-300 print:p-3 text-xs text-zinc-600 print:text-zinc-800 shadow-2xs">
          <h2 className="text-xs font-semibold text-zinc-900 print:text-black uppercase tracking-wider mb-2">
            Exhibition Guidelines & Booth Presentation Tips:
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:grid-cols-3 text-[11px] leading-relaxed">
            <div>
              <strong className="text-zinc-900 print:text-black block mb-0.5">1. Framing & Positioning:</strong>
              Position the patient 2 to 3 feet from the webcam so the face, hands, and chest are unobstructed.
            </div>
            <div>
              <strong className="text-zinc-900 print:text-black block mb-0.5">2. Hold & Capture:</strong>
              Hold the gesture steady for 1 second before pressing Spacebar to avoid camera motion blur.
            </div>
            <div>
              <strong className="text-zinc-900 print:text-black block mb-0.5">3. Trilingual Audio:</strong>
              English and Hindi speak via zero-latency Web Speech API. Odia speaks via Sarvam AI API with pre-loaded offline sound fallbacks.
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-6 pt-4 border-t border-zinc-200 print:border-zinc-300 text-center text-[10px] text-zinc-500 print:text-zinc-500 font-mono">
          Silent Voice · Complete 50-Sign Assistive Communication Manual · Print or laminate for patient bed / demo booth
        </footer>
      </div>
    </div>
  );
}
