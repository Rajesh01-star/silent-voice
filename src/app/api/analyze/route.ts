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
Your task is to analyze webcam frames capturing patient hand gestures, sign language signs (ASL/ISL/intuitive gestures), closed eyes/blinks, or facial expressions, and translate them into vital daily and emergency needs.

Be generous, flexible, and context-aware. Recognize these intents even if the angle, lighting, or hand form is slightly imperfect:

1. Water / Thirst (phraseKey: "water"):
   - Hand near mouth / cup shape / thumb pointing to mouth / finger to lips / drinking motion.
   - English: "I need water.", Hindi: "मुझे पानी चाहिए।", Odia: "ମୋତେ ପାଣି ଦରକାର।"

2. Food / Hunger (phraseKey: "food"):
   - Hand on stomach / belly, fingers touching mouth in eating motion, or flat hand over chest/abdomen.
   - English: "I am hungry.", Hindi: "मुझे भूख लगी है।", Odia: "ମୋତେ ଭୋକ ଲାଗୁଛି।"

3. Pain / Distress (phraseKey: "pain"):
   - Eyes tightly closed / squinting / grimacing / hand on forehead / head holding.
   - English: "I am in pain.", Hindi: "मुझे दर्द हो रहा है।", Odia: "ମୋତେ କଷ୍ଟ ହେଉଛି।"

4. Emergency / Help / Stop (phraseKey: "help"):
   - Raised open palm / waving hand / stop hand facing camera / urgent spread fingers.
   - English: "Please help / Emergency.", Hindi: "कृपया मदद करें।", Odia: "ଦୟାକରି ସାହାଯ୍ୟ କରନ୍ତୁ।"

5. Affirmation / Agreement (phraseKey: "yes"):
   - Thumbs up / peace sign / clear head nod forward / OK sign (pinch thumb and index).
   - English: "Yes.", Hindi: "हाँ।", Odia: "ହଁ।"

6. Negation / Refusal (phraseKey: "no"):
   - Index finger raised / finger wagging / palm pushing away / head shake.
   - English: "No.", Hindi: "नहीं।", Odia: "ନା।"

7. Gratitude / Respect (phraseKey: "thank_you"):
   - Both hands folded (Namaste) / hand over heart / slight bow.
   - English: "Thank you.", Hindi: "धन्यवाद।", Odia: "ଧନ୍ୟବାଦ।"

8. Doctor / Medical Assistance (phraseKey: "doctor"):
   - Pointing outwards / beckoning wave / finger pointing toward door or arm.
   - English: "Call the doctor.", Hindi: "डॉक्टर को बुलाइए।", Odia: "ଡାକ୍ତରଙ୍କୁ ଡାକନ୍ତୁ।"

If a person is visible and attempting an intentional sign or expression, do your best to classify their intent into the closest category above.
Only set detected: false with phraseKey: "none" if the frame is completely empty, pitch dark, completely blurry, or the person is resting completely neutrally with hands completely down.

Respond strictly with valid JSON:
{
  "detected": boolean,
  "cue": string (concise description of what hand gesture or facial cue you observed),
  "en": string,
  "hi": string,
  "or": string,
  "phraseKey": "water" | "food" | "pain" | "help" | "yes" | "no" | "thank_you" | "doctor" | "none",
  "confidence": number
}
`;

const CANDIDATE_MODELS = [
  "gemini-3.8-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash",
];

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AnalyzeRequestBody;
    const rawImage = body.image?.trim();

    if (!rawImage) {
      return NextResponse.json({ error: "Missing image in request body" }, { status: 400 });
    }

    const cleanBase64 = rawImage.replace(/^data:image\/[a-zA-Z]+;base64,/, "");
    const apiKey = process.env.GEMINI_API_KEY;
    const isKeyConfigured = apiKey && apiKey !== "your_google_ai_studio_key" && apiKey.length > 10;

    if (!isKeyConfigured) {
      return NextResponse.json({
        detected: false,
        cue: "GEMINI_API_KEY is not configured",
        en: "Please provide a valid GEMINI_API_KEY in .env.local.",
        hi: "कृपया .env.local में वैध GEMINI_API_KEY दर्ज करें।",
        or: "ଦୟାକରି .env.local ରେ ବୈଧ GEMINI_API_KEY ଯୋଡନ୍ତୁ।",
        phraseKey: "none",
        confidence: 0,
        warning: "API_KEY_MISSING",
      });
    }

    const ai = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });

    let responseText = "";
    let lastError: Error | null = null;

    // Model fallback chain: try gemini-3.8-flash -> gemini-flash-latest -> gemini-3.5-flash
    for (const modelName of CANDIDATE_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
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
                  text: "Examine the webcam frame. Identify any hand gesture, sign language sign, eye closure, or facial cue, and return the structured JSON translation.",
                },
              ],
            },
          ],
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
          },
        });

        if (response.text) {
          responseText = response.text.trim();
          break;
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`Model ${modelName} call failed, trying next candidate:`, lastError.message);
      }
    }

    if (!responseText) {
      console.error("All vision model candidates failed. Last error:", lastError?.message);
      return NextResponse.json({
        detected: false,
        cue: "Recognition service busy. Please try again in a few seconds.",
        en: "Recognition service busy. Please try again.",
        hi: "सेवा व्यस्त है। कृपया पुनः प्रयास करें।",
        or: "ସେବା ବ୍ୟସ୍ତ ଅଛି। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।",
        phraseKey: "none",
        confidence: 0,
      });
    }

    let parsed: AnalyzeResult;
    try {
      parsed = JSON.parse(responseText);
    } catch {
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
    return NextResponse.json({
      detected: false,
      cue: "Unable to process frame. Please hold gesture clearly in camera.",
      en: "Unable to detect gesture. Please hold your hand clearly facing the camera.",
      hi: "इशारा समझ नहीं आया। कृपया हाथ कैमरे के सामने स्पष्ट रखें।",
      or: "ସଙ୍କେତ ଚିହ୍ନଟ ହୋଇପାରିଲା ନାହିଁ। ଦୟାକରି ହାତ ସ୍ପଷ୍ଟ ଦେଖାନ୍ତୁ।",
      phraseKey: "none",
      confidence: 0,
    });
  }
}
