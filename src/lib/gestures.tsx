import React from "react";

export interface GestureDefinition {
  key: "water" | "food" | "pain" | "help" | "yes" | "no" | "thank_you" | "doctor";
  name: string;
  cue: string;
  howTo: string;
  en: string;
  hi: string;
  or: string;
  icon: (props: { className?: string }) => React.JSX.Element;
}

export const GESTURES: GestureDefinition[] = [
  {
    key: "water",
    name: "Water",
    cue: "Hand near mouth",
    howTo: "Bring fingertips or cup shape to your lips as if drinking water.",
    en: "I need water.",
    hi: "मुझे पानी चाहिए।",
    or: "ମୋତେ ପାଣି ଦରକାର।",
    icon: ({ className = "w-5 h-5" }) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
        <path d="M7 14.5c1.5 1 3.5 1 5 0s3.5-1 5 0" />
      </svg>
    ),
  },
  {
    key: "food",
    name: "Food / Hunger",
    cue: "Hand on stomach",
    howTo: "Place flat open hand over your stomach/chest area.",
    en: "I am hungry.",
    hi: "मुझे भूख लगी है।",
    or: "ମୋତେ ଭୋକ ଲାଗୁଛି।",
    icon: ({ className = "w-5 h-5" }) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 14c1.2 1.3 2.6 2 4 2s2.8-.7 4-2" />
        <path d="M12 7v3" />
      </svg>
    ),
  },
  {
    key: "pain",
    name: "Pain Alert",
    cue: "Eyes shut tightly / frown",
    howTo: "Squeeze both eyes shut firmly or make a distressed frown for 1-2 sec.",
    en: "I am in pain.",
    hi: "मुझे दर्द हो रहा है।",
    or: "ମୋତେ କଷ୍ଟ ହେଉଛି।",
    icon: ({ className = "w-5 h-5" }) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M2 12s3-6 10-6 10 6 10 6-3 6-10 6-10-6-10-6z" />
        <line x1="4" y1="4" x2="20" y2="20" />
      </svg>
    ),
  },
  {
    key: "help",
    name: "Emergency / Help",
    cue: "Raised open palm",
    howTo: "Hold open hand upright facing camera with fingers spread.",
    en: "Please help / Emergency.",
    hi: "कृपया मदद करें।",
    or: "ଦୟାକରି ସାହାଯ୍ୟ କରନ୍ତୁ।",
    icon: ({ className = "w-5 h-5" }) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M18 11V6a2 2 0 0 0-4 0v5" />
        <path d="M14 10V4a2 2 0 0 0-4 0v7" />
        <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
        <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-16 0v-2" />
      </svg>
    ),
  },
  {
    key: "yes",
    name: "Affirmative (Yes)",
    cue: "Thumbs up / head nod",
    howTo: "Give a clear thumbs-up gesture facing the webcam or nod forward.",
    en: "Yes.",
    hi: "हाँ।",
    or: "ହଁ।",
    icon: ({ className = "w-5 h-5" }) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M7 10v12" />
        <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h3l3.29-6.58a1.5 1.5 0 0 1 2.68.79l.03.67z" />
      </svg>
    ),
  },
  {
    key: "no",
    name: "Negative (No)",
    cue: "Index finger raised",
    howTo: "Raise single index finger upright, or shake head side to side.",
    en: "No.",
    hi: "नहीं।",
    or: "ନା।",
    icon: ({ className = "w-5 h-5" }) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 2v10" />
        <path d="M12 12a5 5 0 0 1 5 5v5H7v-5a5 5 0 0 1 5-5z" />
        <circle cx="12" cy="2" r="1" />
      </svg>
    ),
  },
  {
    key: "thank_you",
    name: "Gratitude",
    cue: "Hands joined (Namaste)",
    howTo: "Press both palms together in front of chest in a Namaste gesture.",
    en: "Thank you.",
    hi: "धन्यवाद।",
    or: "ଧନ୍ୟବାଦ।",
    icon: ({ className = "w-5 h-5" }) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 3v18" />
        <path d="M8 8l4-4 4 4" />
        <path d="M6 13c0 4 2.5 7 6 7s6-3 6-7" />
      </svg>
    ),
  },
  {
    key: "doctor",
    name: "Call Doctor",
    cue: "Beckoning gesture",
    howTo: "Wave hand toward camera beckoning or point toward the door.",
    en: "Call the doctor.",
    hi: "डॉक्टर को बुलाइए।",
    or: "ଡାକ୍ତରଙ୍କୁ ଡାକନ୍ତୁ।",
    icon: ({ className = "w-5 h-5" }) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 6v12" />
        <path d="M6 12h12" />
        <rect x="3" y="3" width="18" height="18" rx="4" />
      </svg>
    ),
  },
];
