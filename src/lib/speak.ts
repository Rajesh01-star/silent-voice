export type SupportedLanguage = "en" | "hi" | "or" | "all";

export interface SpeakOptions {
  textEn?: string;
  textHi?: string;
  textOr?: string;
  phraseKey?: string;
  onStart?: (lang: "en" | "hi" | "or") => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

let activeAudio: HTMLAudioElement | null = null;

export function stopAllSpeech(): void {
  if (typeof window !== "undefined") {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch {
      // ignore
    }
    activeAudio = null;
  }
}

/**
 * Synthesizes English or Hindi speech using native Web Speech API
 */
function speakBrowserTts(text: string, langCode: "en-IN" | "hi-IN"): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      console.warn("SpeechSynthesis is not supported in this browser.");
      return resolve();
    }

    // Cancel prior speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    // Pick best matching voice if available
    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find(
      (v) => v.lang.toLowerCase() === langCode.toLowerCase() || v.lang.toLowerCase().startsWith(langCode.slice(0, 2))
    );
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    utterance.onend = () => resolve();
    utterance.onerror = (e) => {
      console.warn("SpeechSynthesis error:", e);
      resolve();
    };

    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Synthesizes Odia speech using Sarvam AI API or offline pre-recorded fallbacks
 */
async function speakOdia(text: string, phraseKey?: string): Promise<void> {
  return new Promise(async (resolve) => {
    const playAudioUrl = (url: string) => {
      stopAllSpeech();
      const audio = new Audio(url);
      activeAudio = audio;
      audio.onended = () => {
        activeAudio = null;
        resolve();
      };
      audio.onerror = (e) => {
        console.warn("Audio playback failed for URL:", url, e);
        // Fallback to static mp3 if not already tried
        if (phraseKey && !url.includes(`/audio/or/${phraseKey}.mp3`)) {
          const fallback = new Audio(`/audio/or/${phraseKey}.mp3`);
          activeAudio = fallback;
          fallback.onended = () => {
            activeAudio = null;
            resolve();
          };
          fallback.onerror = () => resolve();
          fallback.play().catch(() => resolve());
        } else {
          resolve();
        }
      };
      audio.play().catch((playErr) => {
        console.warn("Audio autoplay blocked or failed:", playErr);
        resolve();
      });
    };

    try {
      const res = await fetch("/api/tts-odia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, phraseKey }),
      });

      if (!res.ok) {
        throw new Error(`TTS API returned ${res.status}`);
      }

      const data = await res.json();
      if (data.audioBase64) {
        const audioDataUri = `data:${data.mimeType || "audio/wav"};base64,${data.audioBase64}`;
        playAudioUrl(audioDataUri);
      } else if (data.fallbackUrl) {
        playAudioUrl(data.fallbackUrl);
      } else {
        const fallbackUrl = phraseKey ? `/audio/or/${phraseKey}.mp3` : "/audio/or/help.mp3";
        playAudioUrl(fallbackUrl);
      }
    } catch (err) {
      console.warn("Error calling /api/tts-odia, utilizing offline static sound fallback:", err);
      const fallbackUrl = phraseKey ? `/audio/or/${phraseKey}.mp3` : "/audio/or/help.mp3";
      playAudioUrl(fallbackUrl);
    }
  });
}

/**
 * Unified speak function handling single language or 'all' sequence
 */
export async function speakPhrase(
  lang: SupportedLanguage,
  options: SpeakOptions
): Promise<void> {
  const { textEn, textHi, textOr, phraseKey, onStart, onEnd, onError } = options;

  stopAllSpeech();

  try {
    if (lang === "en" && textEn) {
      onStart?.("en");
      await speakBrowserTts(textEn, "en-IN");
    } else if (lang === "hi" && textHi) {
      onStart?.("hi");
      await speakBrowserTts(textHi, "hi-IN");
    } else if (lang === "or" && textOr) {
      onStart?.("or");
      await speakOdia(textOr, phraseKey);
    } else if (lang === "all") {
      if (textEn) {
        onStart?.("en");
        await speakBrowserTts(textEn, "en-IN");
      }
      if (textHi) {
        onStart?.("hi");
        await speakBrowserTts(textHi, "hi-IN");
      }
      if (textOr) {
        onStart?.("or");
        await speakOdia(textOr, phraseKey);
      }
    }
    onEnd?.();
  } catch (err) {
    console.error("Speech error:", err);
    onError?.(err);
    onEnd?.();
  }
}

