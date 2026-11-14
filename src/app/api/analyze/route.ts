import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60;

interface AnalyzeRequestBody {
  image?: string; // base64 data url or raw base64 string
}

export interface AnalyzeResult {
  detected: boolean;
  cue: string;
  en: string;
  hi: string;
  or: string;
  phraseKey: "water" | "food" | "pain" | "help" | "yes" | "no" | "thank_you" | "doctor" | "none";
  confidence: number;
}

const SYSTEM_INSTRUCTION = `
You are the computer vision and communication engine of "Silent Voice", an assistive technology system designed for speech-impaired and paralyzed individuals.
Your task is to analyze webcam frames capturing patient hand gestures, closed eyes/blinks, or facial expressions, and translate them into vital daily and emergency needs.

Recognize these specific gestures and cues:
1. Hand near mouth / fingers touching lips -> phraseKey: "water", English: "I need water.", Hindi: "मुझे पानी चाहिए।", Odia: "ମୋତେ ପାଣି ଦରକାର।"
2. Hand resting on stomach / belly -> phraseKey: "food", English: "I am hungry.", Hindi: "मुझे भूख लगी है।", Odia: "ମୋତେ ଭୋକ ଲାଗୁଛି।"
3. Eyes tightly shut / grimace / frown / pain expression -> phraseKey: "pain", English: "I am in pain.", Hindi: "मुझे दर्द हो रहा है।", Odia: "ମୋତେ କଷ୍ଟ ହେଉଛି।"
4. Raised open palm / waving palm -> phraseKey: "help", English: "Please help / Emergency.", Hindi: "कृपया मदद करें।", Odia: "ଦୟାକରି ସାହାଯ୍ୟ କରନ୍ତୁ।"
5. Thumbs up / clear affirmative head nod -> phraseKey: "yes", English: "Yes.", Hindi: "हाँ।", Odia: "ହଁ।"
6. Index finger raised / finger wag / head shake -> phraseKey: "no", English: "No.", Hindi: "नहीं।", Odia: "ନା।"
7. Hands joined together (Namaste / Anjali Mudra) -> phraseKey: "thank_you", English: "Thank you.", Hindi: "धन्यवाद।", Odia: "ଧନ୍ୟବାଦ।"
8. Pointing outwards / hand beckoning -> phraseKey: "doctor", English: "Call the doctor.", Hindi: "डॉक्टर को बुलाइए।", Odia: "ଡାକ୍ତରଙ୍କୁ ଡାକନ୍ତୁ।"

If none of these intentional cues are visible (e.g. relaxed neutral face, hands out of frame, blurred frame), set detected: false with phraseKey: "none".

You must respond with strictly valid JSON matching this schema:
{
  "detected": boolean,
  "cue": string,
  "en": string,
  "hi": string,
  "or": string,
  "phraseKey": "water" | "food" | "pain" | "help" | "yes" | "no" | "thank_you" | "doctor" | "none",
  "confidence": number
}
`;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AnalyzeRequestBody;
    const rawImage = body.image?.trim();

    if (!rawImage) {
      return NextResponse.json({ error: "Missing image in request body" }, { status: 400 });
    }

    // Strip data URL header if present (e.g., data:image/jpeg;base64,...)
    const cleanBase64 = rawImage.replace(/^data:image\/[a-zA-Z]+;base64,/, "");

    const apiKey = process.env.GEMINI_API_KEY;
    const isKeyConfigured = apiKey && apiKey !== "your_google_ai_studio_key" && apiKey.length > 10;

    if (!isKeyConfigured) {
      // In development / demo when key isn't provided yet, return helpful guidance without failing
      return NextResponse.json({
        detected: false,
        cue: "GEMINI_API_KEY is not configured",
        en: "Please provide a valid GEMINI_API_KEY in .env.local to enable real-time vision detection.",
        hi: "कृपया .env.local में वैध GEMINI_API_KEY दर्ज करें।",
        or: "ଦୟାକରି .env.local ରେ ବୈଧ GEMINI_API_KEY ଯୋଡନ୍ତୁ।",
        phraseKey: "none",
        confidence: 0,
        warning: "API_KEY_MISSING",
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: cleanBase64,
              },
            },
            {
              text: "Examine the webcam frame. Identify any hand gesture, eye blink/closure, or facial cue, and return the structured JSON translation.",
            },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
      },
    });

    const responseText = response.text?.trim() || "{}";
    let parsed: AnalyzeResult;

    try {
      parsed = JSON.parse(responseText);
    } catch {
      // Clean potential markdown wrap
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Invalid JSON response from vision model");
      }
    }

    return NextResponse.json(parsed);
  } catch (err: unknown) {
    console.error("Error analyzing frame:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      {
        error: message,
        detected: false,
        cue: "Analysis error",
        en: "Failed to analyze gesture. Please try again.",
        hi: "इशारे का विश्लेषण करने में विफल। कृपया पुनः प्रयास करें।",
        or: "ସଙ୍କେତ ବିଶ୍ଳେଷଣ ବିଫଳ ହେଲା। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।",
        phraseKey: "none",
        confidence: 0,
      },
      { status: 500 }
    );
  }
}
