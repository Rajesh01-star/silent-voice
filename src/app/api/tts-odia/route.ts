import { NextResponse } from "next/server";

interface TtsRequest {
  text?: string;
  phraseKey?: string;
}

const PHRASE_FALLBACK_MAP: Record<string, string> = {
  "ପାଣି": "water",
  "water": "water",
  "ଭୋକ": "food",
  "food": "food",
  "ଖାଇବା": "food",
  "କଷ୍ଟ": "pain",
  "ଯନ୍ତ୍ରଣା": "pain",
  "pain": "pain",
  "ସାହାଯ୍ୟ": "help",
  "help": "help",
  "ହଁ": "yes",
  "yes": "yes",
  "ନା": "no",
  "ନାଇଁ": "no",
  "no": "no",
  "ଧନ୍ୟବାଦ": "thank_you",
  "thanks": "thank_you",
  "ଡାକ୍ତର": "doctor",
  "doctor": "doctor",
};

function getFallbackFile(text: string, phraseKey?: string): string {
  if (phraseKey && ["water", "food", "pain", "help", "yes", "no", "thank_you", "doctor"].includes(phraseKey)) {
    return `/audio/or/${phraseKey}.mp3`;
  }
  for (const [cue, key] of Object.entries(PHRASE_FALLBACK_MAP)) {
    if (text.includes(cue)) {
      return `/audio/or/${key}.mp3`;
    }
  }
  return `/audio/or/help.mp3`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TtsRequest;
    const text = body.text?.trim() || "";
    const phraseKey = body.phraseKey?.trim();

    if (!text) {
      return NextResponse.json({ error: "Missing text to synthesize" }, { status: 400 });
    }

    const sarvamApiKey = process.env.SARVAM_API_KEY;
    const isKeyConfigured = sarvamApiKey && sarvamApiKey !== "your_sarvam_api_key" && sarvamApiKey.length > 5;

    if (isKeyConfigured) {
      try {
        const response = await fetch("https://api.sarvam.ai/text-to-speech", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-subscription-key": sarvamApiKey,
          },
          body: JSON.stringify({
            inputs: [text],
            target_language_code: "od-IN",
            speaker: "priya",
            pitch: 0,
            pace: 1.0,
            loudness: 1.5,
            speech_sample_rate: 8000,
            enable_preprocessing: true,
            model: "bulbul:v3",
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data?.audios && data.audios.length > 0) {
            return NextResponse.json({
              audioBase64: data.audios[0],
              mimeType: "audio/wav",
              source: "sarvam",
            });
          }
        } else {
          const errorText = await response.text();
          console.warn("Sarvam AI TTS API responded with error:", response.status, errorText);
        }
      } catch (sarvamErr) {
        console.warn("Sarvam AI TTS request failed, falling back to static audio:", sarvamErr);
      }
    }

    // Fallback to pre-recorded static audio for zero-connectivity exhibition reliability
    const fallbackUrl = getFallbackFile(text, phraseKey);
    return NextResponse.json({
      fallbackUrl,
      source: "fallback",
      notice: isKeyConfigured ? "Sarvam fallback used" : "SARVAM_API_KEY not configured, using offline fallback",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

