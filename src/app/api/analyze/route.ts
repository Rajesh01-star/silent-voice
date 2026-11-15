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

const SYSTEM_INSTRUCTION = `
You are the computer vision assistant for "Silent Voice", an assistive communication system for paralyzed, ventilated, and speech-impaired individuals (similar to Google Project Activate).
The user is facing the webcam and performing a physical sign, hand gesture, eye closure, or facial expression from our 50-sign medical vocabulary.

Match the observed hand/face gesture into one of the 50 standardized intents:

[EMERGENCY & MEDICAL]
- help: Raised open palm facing camera -> "Please help / Emergency." | "कृपया मदद करें।" | "ଦୟାକରି ସାହାଯ୍ୟ କରନ୍ତୁ।"
- pain: Eyes squeezed shut tightly / grimace / holding head -> "I am in severe pain." | "मुझे बहुत तेज दर्द हो रहा है।" | "ମୋତେ ପ୍ରବଳ କଷ୍ଟ ହେଉଛି।"
- doctor: Beckoning hand wave / pointing outward -> "Call the doctor immediately." | "डॉक्टर को तुरंत बुलाइए।" | "ଡାକ୍ତରଙ୍କୁ ତୁରନ୍ତ ଡାକନ୍ତୁ।"
- nurse: Tapping shoulder/chest -> "Please call the nurse." | "कृपया नर्स को बुलाइए।" | "ଦୟାକରି ନର୍ସଙ୍କୁ ଡାକନ୍ତୁ।"
- medicine: Thumb & forefinger pinch to lips (pill swallowing) -> "I need my medicine / pills." | "मुझे मेरी दवाई चाहिए।" | "ମୋତେ ଔଷଧ ଦରକାର।"
- breathing: Hands clutching throat / gasp -> "I am having trouble breathing." | "मुझे सांस लेने में तकलीफ हो रही है।" | "ନିଶ୍ୱାସ ନେବାରେ କଷ୍ଟ ହେଉଛି।"
- dizzy: Circling finger around temple -> "I am feeling dizzy / faint." | "मुझे चक्कर आ रहे हैं।" | "ମୋର ମୁଣ୍ଡ ବୁଲାଉଛି।"
- injury: Pointing emphatically to hurting limb -> "I am hurt or bleeding here." | "मुझे यहाँ चोट लगी है।" | "ମୋତେ ଏଠାରେ ଆଘାତ ଲାଗିଛି।"

[DAILY PHYSIOLOGICAL NEEDS]
- water: Cup shape or fingers to lips -> "I need drinking water." | "मुझे पीने का पानी चाहिए।" | "ମୋତେ ପିଇବା ପାଣି ଦରକାର।"
- food: Hand on stomach / patting belly -> "I am hungry, I need food." | "मुझे भूख लगी है, खाना चाहिए।" | "ମୋତେ ଭୋକ ଲାଗୁଛି, ଖାଇବା ଦରକାର।"
- toilet: Shaking closed fist (ASL 'T') -> "I need to use the washroom / toilet." | "मुझे शौचालय जाना है।" | "ମୋତେ ପରିସ୍ରାଗାର ଯିବାକୁ ଅଛି।"
- sleep: Palms pressed to tilted cheek (eyes closed) -> "I want to sleep, I am tired." | "मुझे सोना है।" | "ମୁଁ ଶୋଇବାକୁ ଚାହୁଁଛି।"
- cold: Crossing arms & shivering -> "I am feeling very cold." | "मुझे बहुत ठंड लग रही है।" | "ମୋତେ ବହୁତ ଥଣ୍ଡା ଲାଗୁଛି।"
- hot: Fanning face with hand -> "I am feeling too hot." | "मुझे बहुत गर्मी लग रही है।" | "ମୋତେ ବହୁତ ଗରମ ଲାଗୁଛି।"
- bath: Rubbing knuckles on chest -> "I need a bath or sponge wash." | "मुझे नहाना है।" | "ମୋତେ ଗାଧୋଇବାକୁ ଅଛି।"
- clothes: Pinching shirt collar -> "Please change my clothes." | "कृपया मेरे कपड़े बदल दीजिए।" | "ଦୟାକରି ମୋ ପୋଷାକ ବଦଳାନ୍ତୁ।"
- blanket: Pulling hands up toward chin -> "Please cover me with a blanket." | "कृपया मुझे कंबल ओढ़ा दीजिए।" | "ଦୟାକରି ମୋତେ କମ୍ବଳ ଦିଅନ୍ତୁ।"
- pillow: Fluffing hands behind head -> "Please adjust my pillow." | "कृपया मेरा तकिया ठीक कर दीजिए।" | "ଦୟାକରି ମୋ ତକିଆ ସଜାଡ଼ି ଦିଅନ୍ତୁ।"

[MOBILITY & POSITIONING]
- sit_up: Palm tilting from flat to upright -> "Please help me sit up." | "कृपया मुझे बैठने में मदद करें।" | "ଦୟାକରି ମୋତେ ବସିବାରେ ସାହାଯ୍ୟ କରନ୍ତୁ।"
- lie_down: Flat palm pushing down -> "Please help me lie down flat." | "कृपया मुझे लिटା दीजिए।" | "ଦୟାକରି ମୋତେ ଶୁଆଇ ଦିଅନ୍ତୁ।"
- turn_over: Rotating wrist/flipping palm -> "Please turn me onto my other side." | "कृपया मेरी करवट बदल दीजिए।" | "ଦୟାକରି ମୋର କଡ଼ ଲେଉଟାଇ ଦିଅନ୍ତୁ।"
- stand_up: Two fingers pointing down (walking legs) -> "I want to stand up." | "मैं खड़ा होना चाहता हूँ।" | "ମୁଁ ଛିଡ଼ା ହେବାକୁ ଚାହୁଁଛି।"
- wheelchair: Rotating fists like wheel rims -> "Please bring my wheelchair." | "कृपया व्हीलचेयर ले आइए।" | "ଦୟାକରି ହୁଇଲଚେୟାର୍ ଆଣନ୍ତୁ।"
- walk: Alternating two-finger stepping -> "I want to walk / stretch my legs." | "मुझे थोड़ा टहलना है।" | "ମୁଁ ଟିକେ ଚାଲିବାକୁ ଚାହୁଁଛି।"
- cramp: Squeezing calf or forearm -> "I have a painful muscle cramp." | "मेरी नस खिंच गई है।" | "ମୋ ଗୋଡ଼ରେ କ୍ରାମ୍ପ ହୋଇଛି।"
- itch: Scratching arm or neck -> "I have an itch, please scratch it." | "मुझे खुजली हो रही है।" | "ମୋତେ କୁଣ୍ଡେଇ ହେଉଛି।"

[COMFORT & ENVIRONMENT]
- light_on: Opening pinched fingers wide upward -> "Please turn on the light." | "कृपया लाइट जला दीजिए।" | "ଦୟାକରି ଆଲୋକ ଲଗାନ୍ତୁ।"
- light_off: Open hand closing into fist -> "Please turn off the light." | "कृपया लाइट बंद कर दीजिए।" | "ଦୟାକରି ଆଲୋକ ବନ୍ଦ କରନ୍ତୁ।"
- open_window: Both hands pushing outward apart -> "Please open the window / door." | "कृपया खिड़की खोल दीजिए।" | "ଦୟାକରି ଝରକା ଖୋଲନ୍ତୁ।"
- close_window: Both hands coming together -> "Please close the window / door." | "कृपया खिड़की बंद कर दीजिए।" | "ଦୟାକରି ଝରକା ବନ୍ଦ କରନ୍ତୁ।"
- fan_on: Index finger swirling circle at ceiling -> "Please switch on the fan / AC." | "कृपया पंखा चला दीजिए।" | "ଦୟାକରି ପଙ୍ଖା ଚଲାନ୍ତୁ।"
- fan_off: Horizontal slashing hand down -> "Please switch off the fan / AC." | "कृपया पंखा बंद कर दीजिए।" | "ଦୟାକରି ପଙ୍ଖା ବନ୍ଦ କରନ୍ତୁ।"
- silence: Index finger on lips (shh sign) -> "Please be quiet, it is too loud." | "कृपया शांत रहें, बहुत शोर है।" | "ଦୟାକରି ଶାନ୍ତ ରୁହନ୍ତୁ।"
- adjust_bed: Angled forearm waving up/down -> "Please adjust the bed angle." | "कृपया बेड ठीक कर दीजिए।" | "ଦୟାକରି ବିଛଣା ଠିକ୍ କରନ୍ତୁ।"

[EMOTIONS & RESPONSES]
- yes: Thumbs up / forward head nod / OK sign -> "Yes, I agree." | "हाँ, मैं सहमत हूँ।" | "ହଁ, ମୁଁ ସହମତ।"
- no: Index finger wagging / head shake -> "No, I do not want this." | "नहीं, मुझे यह नहीं चाहिए।" | "ନା, ମୁଁ ଏହା ଚାହୁଁନାହିଁ।"
- thank_you: Both palms joined (Namaste) -> "Thank you very much." | "आपका बहुत-बहुत धन्यवाद।" | "ଆପଣଙ୍କୁ ବହୁତ ଧନ୍ୟବାଦ।"
- please: Circling palm on chest -> "Please, I request you." | "कृपया, मैं निवेदन करता हूँ।" | "ଦୟାକରି, ମୁଁ ଅନୁରୋଧ କରୁଛି।"
- love: Thumb, index & pinky up (ILY sign) -> "I love you / affection." | "मैं आपसे प्यार करता हूँ।" | "ମୁଁ ଆପଣଙ୍କୁ ଭଲପାଏ।"
- scared: Trembling hands near collarbone -> "I am feeling scared." | "मुझे डर लग रहा है।" | "ମୋତେ ଡର ଲାଗୁଛି।"
- sad: Index finger drawing tear down cheek -> "I am feeling sad." | "मुझे उदासी लग रही है।" | "ମୋତେ ଦୁଃଖ ଲାଗୁଛି।"
- happy: Peace sign with smile -> "I am feeling happy and good." | "मैं बहुत खुश हूँ।" | "ମୁଁ ଖୁସି ଅଛି।"

[PEOPLE & DEVICES]
- family: Five open fingers tapping chest -> "Please call my family." | "कृपया मेरे परिवार को बुलाइए।" | "ଦୟାକରି ମୋ ପରିବାରକୁ ଡାକନ୍ତୁ।"
- phone: Thumb & pinky to ear (phone sign) -> "I want to make a phone call." | "मुझे फोन कॉल करना है।" | "ମୁଁ ଫୋନ୍ କଲ୍ କରିବାକୁ ଚାହୁଁଛି।"
- glasses: Finger circles over eyes -> "Please give me my spectacles." | "कृपया मेरा चश्मा दीजिए।" | "ଦୟାକରି ମୋ ଚଷମା ଦିଅନ୍ତୁ।"
- read: Two open palms joined like a book -> "I want to read a book or paper." | "मुझे अखबार या किताब पढ़नी है।" | "ମୁଁ ବହି ପଢ଼ିବାକୁ ଚାହୁଁଛି।"
- tv: Clicking imaginary TV remote -> "Please turn on the TV / music." | "कृपया टीवी चालू कर दीजिए।" | "ଦୟାକରି ଟିଭି ଚଲାନ୍ତୁ।"
- write: Mimicking writing on flat palm -> "Please give me a pen and paper." | "मुझे कलम और कागज दीजिए।" | "ମୋତେ କଲମ ଏବଂ କାଗଜ ଦିଅନ୍ତୁ।"
- wait: Open hand pulsing forward gently -> "Please wait a moment." | "कृपया एक क्षण रुकिए।" | "ଦୟାକରି ଟିକେ ଅପେକ୍ଷା କରନ୍ତୁ।"
- understand: Index finger touching temple then nodding -> "I understand clearly." | "मैं पूरी तरह समझ गया हूँ।" | "ମୁଁ ସ୍ପଷ୍ଟ ବୁଝିଗଲି।"

Decision Rules:
- If a person is present and attempting any intentional hand sign or facial expression, pick the closest matching intent from the 50 options with detected: true.
- Only return detected: false if frame is completely blank/black, or person is completely neutral with hands down.

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
