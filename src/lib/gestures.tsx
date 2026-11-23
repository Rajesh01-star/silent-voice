import React from "react";
import gesturesData from "@/data/gestures.json";
import * as LucideIcons from "lucide-react";

export type GestureCategory =
  | "Emergency"
  | "Daily Needs"
  | "Mobility"
  | "Comfort & Environment"
  | "Emotions & Responses"
  | "People & Devices";

export interface GestureRawData {
  id: number;
  key: string;
  category: GestureCategory;
  name: string;
  cue: string;
  howTo: string;
  en: string;
  hi: string;
  or: string;
  icon: string;
}

export interface GestureDefinition extends Omit<GestureRawData, "icon"> {
  icon: (props: { className?: string }) => React.JSX.Element;
}

// Dynamically resolve icon from standard Lucide library with safe fallback
function resolveIcon(iconName: string): (props: { className?: string }) => React.JSX.Element {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const IconComponent = (LucideIcons as Record<string, any>)[iconName] || LucideIcons.Hand;
  return function GestureIcon({ className = "w-4 h-4" }: { className?: string }) {
    return <IconComponent className={className} />;
  };
}

export const GESTURES: GestureDefinition[] = (gesturesData as GestureRawData[]).map((item) => ({
  ...item,
  icon: resolveIcon(item.icon),
}));

export function getGestureByKey(key: string): GestureDefinition | undefined {
  return GESTURES.find((g) => g.key === key);
}
