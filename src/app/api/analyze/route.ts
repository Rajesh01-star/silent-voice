import gesturesData from "@/data/gestures.json";
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
  phraseKey: string;
  confidence: number;
}

function buildSystemInstruction(): string {
  const categories = [
    "Emergency",
    "Daily Needs",
    "Mobility",
    "Comfort & Environment",
    "Emotions & Responses",
    "People & Devices",
  ];

  let vocab = "";
  for (const cat of categories) {
    const items = gesturesData.filter((g) => g.category === cat);
    if (items.length > 0) {
      vocab += `\n[${cat.toUpperCase()}]\n`;
      for (const item of items) {
        vocab += `- ${item.key}: ${item.cue} -> "${item.en}" | "${item.hi}" | "${item.or}"\n`;
      }
    }
  }

  return `
You are the computer vision assistant for "Silent Voice", an assistive communication system for paralyzed, ventilated, and speech-impaired individuals (similar to Google Project Activate).
The user is facing the webcam and performing a physical sign, hand gesture, eye closure, or facial expression.

OPERATING MODE: HYBRID INTENT RECOGNITION & NATURAL TRANSLATION

1. PRIMARY STANDARDIZED CLINICAL VOCABULARY:
If the user's action matches one of our standardized clinical medical gestures below, prioritize mapping it directly to that standardized intent:
${vocab}

2. OPEN-ENDED NATURAL GESTURE TRANSLATION (EXPANDED CAPABILITY):
If the user performs ANY other deliberate gesture, sign, facial expression, or body movement NOT listed in the standard 50 vocabulary above (e.g., miming drinking tea, pointing to spectacles, pointing to a clock or door, scratching a spot, crossed fingers, heart hands, peace sign, yawning, frowning in confusion, head resting in palm, etc.):
- DO NOT reject or force-fit it into an unrelated category.
- Accurately describe the observed physical action in "cue".
- Translate the patient's natural intent into clear, polite, natural phrases in all three languages:
  * "en": Natural, polite English statement (e.g., "I would like some tea.", "Please check the door.")
  * "hi": Accurate Hindi translation in Devanagari script.
  * "or": Accurate Odia translation in Odia script.
- Set "phraseKey" to a descriptive snake_case key (e.g. "tea", "door", "confused", "itch_nose", or "custom").
- Set "confidence": number between 0.85 and 1.0 depending on clarity.

Decision Rules & Real-World Tolerance:
- The user is using a live webcam and may perform signs from Indian Sign Language (ISL), American Sign Language (ASL), or natural physical/facial gestures.
- BE HIGHLY RESILIENT & PERMISSIVE: Patients and users rarely make textbook-perfect studio signs. If a hand is raised, angled, or making any deliberate posture, interpret their intent with detected: true.
- Key common internet & physical cues to recognize immediately:
  * Universal SOS Hand Sign / Signal for Help (CRITICAL DISTRESS SIGNAL):
    - Palm facing camera with thumb tucked across palm, OR four fingers closed/folded down trapping the thumb inside a fist, OR repeating opening and closing fingers over the tucked thumb.
    - If ANY stage of this SOS hand sign is detected (especially thumb tucked into palm or fingers trapping thumb), IMMEDIATELY MAP TO help ("Please help / Emergency.") with confidence 1.0. Set cue to: "Universal SOS hand sign (thumb tucked & trapped by fingers)".
  * Hand near mouth, cup shape, thumb tilted to lips, fingers touching mouth -> water ("I need drinking water.")
  * Hand on stomach, belly pat, or flat palm over torso -> food ("I am hungry, I need food.")
  * Open palm facing camera, raised arm, waving hand -> help ("Please help / Emergency.")
  * Eyes squeezed shut, grimacing, holding head/temples -> pain ("I am in severe pain.")
  * Thumbs up, nodding head, OK circle gesture, peace sign -> yes ("Yes, I agree.")
  * Index finger wagging, head shake, hand pushing away -> no ("No, I do not want this.")
  * Palms joined together (Namaste) or hand from chin outward -> thank_you ("Thank you very much.")
  * Beckoning wave or tapping chest/shoulder -> doctor / nurse
  * Thumb & pinky to ear (phone sign) -> phone ("I want to make a phone call.")
  * Pinching fingers to lips (pill swallowing) -> medicine ("I need my medicine / pills.")
  * Palms pressed to tilted cheek (eyes closed) -> sleep ("I want to sleep, I am tired.")
- Only set detected: false if the frame is completely empty, completely dark, or the person is sitting entirely still with hands completely down and neutral resting expression.

Return strictly valid JSON:
{
  "detected": boolean,
  "cue": string (concise description of physical movement observed),
  "en": string,
  "hi": string,
  "or": string,
  "phraseKey": string,
  "confidence": number
}
`;
}

const SYSTEM_INSTRUCTION = buildSystemInstruction();

const FAST_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite"
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
