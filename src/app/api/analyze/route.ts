import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 15;

interface AnalyzeRequestBody {
  image?: string;
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
You are the computer vision assistant for "Silent Voice", an assistive communication system for speech-impaired individuals (similar to Google Project Activate).
The user is facing the webcam and intentionally performing a physical sign, hand gesture, eye closure, or facial expression to communicate an urgent need.

Look closely at the person's hands, fingers, and face. Match what you see to the closest intended category:

1. Water / Thirst ("water"):
   - Visual Cues: Hand/fingers brought to or near mouth/chin, mimicking a cup/bottle, pointing to lips/throat.
   - English: "I need water.", Hindi: "मुझे पानी चाहिए।", Odia: "ମୋତେ ପାଣି ଦରକାର।"

2. Food / Hunger ("food"):
   - Visual Cues: Hand placed over stomach/belly, or fingertips touching mouth in eating motion.
   - English: "I am hungry.", Hindi: "मुझे भूख लगी है।", Odia: "ମୋତେ ଭୋକ ଲାଗୁଛି।"

3. Pain / Distress ("pain"):
   - Visual Cues: Both eyes squeezed shut tightly, grimacing/frowning, or hand clutching forehead/head/chest.
   - English: "I am in pain.", Hindi: "मुझे दर्द हो रहा है।", Odia: "ମୋତେ କଷ୍ଟ ହେଉଛି।"

4. Emergency / Help ("help"):
   - Visual Cues: Open palm raised facing camera (stop sign), waving hand, spread fingers upright.
   - English: "Please help / Emergency.", Hindi: "कृपया मदद करें।", Odia: "ଦୟାକରି ସାହାଯ୍ୟ କରନ୍ତୁ।"

5. Yes / Affirmation ("yes"):
   - Visual Cues: Thumbs up, peace/V sign, clear forward head nod, or OK sign.
   - English: "Yes.", Hindi: "हाँ।", Odia: "ହଁ।"

6. No / Negative ("no"):
   - Visual Cues: Single index finger pointing up, finger wagging, or palm pushing outward.
   - English: "No.", Hindi: "नहीं।", Odia: "ନା।"

7. Thank You ("thank_you"):
   - Visual Cues: Hands joined together in front of chest (Namaste / prayer posture) or hand over heart.
   - English: "Thank you.", Hindi: "धन्यवाद।", Odia: "ଧନ୍ୟବାଦ।"

8. Call Doctor ("doctor"):
   - Visual Cues: Beckoning hand gesture toward camera, pointing index finger outward/toward door.
   - English: "Call the doctor.", Hindi: "डॉक्टर को बुलाइए।", Odia: "ଡାକ୍ତରଙ୍କୁ ଡାକନ୍ତୁ।"

Decision Rules:
- If a person is present and showing any hand near face/body or closing eyes, classify into the closest intent above with detected: true.
- Only return detected: false if the frame is completely empty, completely black/blurry, or the person is resting completely neutrally with arms resting down.

Return strictly valid JSON:
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

// Ultra-fast responsive flash models with standard high-quota tier
const FAST_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest"
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
        cue: "GEMINI_API_KEY missing",
        en: "Configure GEMINI_API_KEY in .env.local to enable real-time detection.",
        hi: "कृपया .env.local में वैध GEMINI_API_KEY दर्ज करें।",
        or: "ଦୟାକରି .env.local ରେ ବୈଧ GEMINI_API_KEY ଯୋଡନ୍ତୁ।",
        phraseKey: "none",
        confidence: 0,
      });
    }

    const ai = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });
    let responseText = "";

    // Fast execution with 4.5s timeout per model
    for (const modelName of FAST_MODELS) {
      try {
        const generatePromise = ai.models.generateContent({
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
                  text: "Analyze the patient's gesture or facial cue and return structured JSON translation.",
                },
              ],
            },
          ],
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("MODEL_TIMEOUT")), 4500)
        );

        const response = await Promise.race([generatePromise, timeoutPromise]);
        if (response && response.text) {
          responseText = response.text.trim();
          break;
        }
      } catch {
        console.warn(`Model ${modelName} did not respond in time, falling back...`);
      }
    }

    if (!responseText) {
      return NextResponse.json({
        detected: false,
        cue: "Could not classify gesture. Please hold hand clearly facing camera.",
        en: "No clear gesture recognized. Please hold sign steady.",
        hi: "स्पष्ट इशारा नहीं दिखा। कृपया हाथ कैमरे के सामने रखें।",
        or: "ସ୍ପଷ୍ଟ ସଙ୍କେତ ମିଳିଲା ନାହିଁ। ଦୟାକରି ହାତ ସ୍ଥିର ରଖନ୍ତୁ।",
        phraseKey: "none",
        confidence: 0,
      });
    }

    let parsed: AnalyzeResult;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error("Invalid model JSON format");
      }
    }

    return NextResponse.json(parsed);
  } catch (err: unknown) {
    console.error("Frame analysis error:", err);
    return NextResponse.json({
      detected: false,
      cue: "Analysis error. Please try again.",
      en: "Analysis error. Please try again.",
      hi: "विश्लेषण त्रुटि। पुनः प्रयास करें।",
      or: "ବିଶ୍ଳେଷଣ ତ୍ରୁଟି। ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।",
      phraseKey: "none",
      confidence: 0,
    });
  }
}
