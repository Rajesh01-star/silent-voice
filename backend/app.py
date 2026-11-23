import os
os.environ["MPLCONFIGDIR"] = "/tmp/matplotlib"

import json
import base64
from pathlib import Path
from typing import Optional, Dict, Any, List

import cv2
import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from google import genai

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env.local")
load_dotenv(ROOT_DIR / ".env")

app = FastAPI(title="Silent Voice Vision Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load gestures dataset
GESTURES_PATH = ROOT_DIR / "src" / "data" / "gestures.json"
if not GESTURES_PATH.exists():
    GESTURES_PATH = Path(__file__).resolve().parent / "gestures.json"

try:
    with open(GESTURES_PATH, "r", encoding="utf-8") as f:
        GESTURES_DATA = json.load(f)
except Exception as e:
    print(f"Warning: Could not load gestures.json: {e}")
    GESTURES_DATA = []

# Initialize MediaPipe Gesture Recognizer & Hand Landmarker
MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_PATH = MODEL_DIR / "gesture_recognizer.task"

if not MODEL_PATH.exists():
    import urllib.request
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    print("Downloading MediaPipe task model...")
    urllib.request.urlretrieve(
        "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
        MODEL_PATH
    )

base_options = python.BaseOptions(model_asset_path=str(MODEL_PATH))
options = vision.GestureRecognizerOptions(
    base_options=base_options,
    num_hands=2,
    min_hand_detection_confidence=0.4,
    min_hand_presence_confidence=0.4,
    min_tracking_confidence=0.4,
)
recognizer = vision.GestureRecognizer.create_from_options(options)

class AnalyzeRequest(BaseModel):
    image: str

class AnalyzeResponse(BaseModel):
    detected: bool
    cue: str
    en: str
    hi: str
    or_: str = Field("", alias="or")
    phraseKey: str
    confidence: float
    landmarks_detected: bool = False
    vision_notes: Optional[str] = None

def build_system_instruction() -> str:
    categories = [
        "Emergency",
        "Daily Needs",
        "Mobility",
        "Comfort & Environment",
        "Emotions & Responses",
        "People & Devices",
    ]
    vocab = ""
    for cat in categories:
        items = [g for g in GESTURES_DATA if g.get("category") == cat]
        if items:
            vocab += f"\n[{cat.upper()}]\n"
            for item in items:
                vocab += f"- {item['key']}: {item['cue']} -> \"{item['en']}\" | \"{item['hi']}\" | \"{item['or']}\"\n"

    return f"""
You are the computer vision assistant for "Silent Voice", an assistive communication system for paralyzed, ventilated, and speech-impaired individuals.
You receive both a zoomed, pre-processed image of the patient's hand/face AND computer vision landmark measurements from MediaPipe.

OPERATING MODE: HYBRID INTENT RECOGNITION & NATURAL TRANSLATION

1. PRIMARY STANDARDIZED CLINICAL VOCABULARY:
If the user's action matches one of our standardized clinical medical gestures below, prioritize mapping it directly to that standardized intent:
{vocab}

2. OPEN-ENDED NATURAL GESTURE TRANSLATION:
If the user performs ANY other deliberate gesture, sign, facial expression, or body movement NOT in the 50 standard list:
- Translate their natural intended meaning into clear, polite phrases in English, Hindi (Devanagari), and Odia (Odia script).
- Set "phraseKey" to a descriptive snake_case key (e.g. "tea", "door", "scratch_nose", "custom").
- Set "confidence" between 0.85 and 1.0.

3. CRITICAL GEOMETRIC DISTRESS CUE:
* Universal SOS Hand Sign (Signal for Help):
  - Palm facing camera with thumb tucked into palm, OR fingers folded down trapping the thumb inside a fist.
  - If landmark analysis notes "Trapped Thumb" or "Universal SOS Hand Sign detected", IMMEDIATELY classify as help ("Please help / Emergency.") with confidence 1.0. Set cue to: "Universal SOS hand sign (thumb tucked & trapped by fingers)".

Return strictly valid JSON:
{{
  "detected": boolean,
  "cue": string (concise description of physical movement observed),
  "en": string,
  "hi": string,
  "or": string,
  "phraseKey": string,
  "confidence": number
}}
"""

SYSTEM_INSTRUCTION = build_system_instruction()

def analyze_hand_geometry(landmarks, w: int, h: int) -> Dict[str, Any]:
    pts = [(int(lm.x * w), int(lm.y * h)) for lm in landmarks]
    wrist = pts[0]
    thumb_cmc, thumb_mcp, thumb_ip, thumb_tip = pts[1], pts[2], pts[3], pts[4]
    index_mcp, index_pip, index_dip, index_tip = pts[5], pts[6], pts[7], pts[8]
    mid_mcp, mid_pip, mid_dip, mid_tip = pts[9], pts[10], pts[11], pts[12]
    ring_mcp, ring_pip, ring_dip, ring_tip = pts[13], pts[14], pts[15], pts[16]
    pinky_mcp, pinky_pip, pinky_dip, pinky_tip = pts[17], pts[18], pts[19], pts[20]

    palm_width = np.linalg.norm(np.array(index_mcp) - np.array(pinky_mcp)) or 1.0

    # 1. Thumb tucked across palm
    thumb_to_mid_base = np.linalg.norm(np.array(thumb_tip) - np.array(mid_mcp))
    thumb_tucked = thumb_to_mid_base < (palm_width * 0.95)

    # 2. Are fingers curled?
    index_curled = index_tip[1] > index_pip[1]
    mid_curled = mid_tip[1] > mid_pip[1]
    ring_curled = ring_tip[1] > ring_pip[1]
    pinky_curled = pinky_tip[1] > pinky_pip[1]
    fingers_curled_count = sum([index_curled, mid_curled, ring_curled, pinky_curled])

    # 3. Specific Distress Detection
    is_trapped_thumb = thumb_tucked and (fingers_curled_count >= 3)
    is_open_palm = (fingers_curled_count == 0) and not thumb_tucked
    is_thumbs_up = (fingers_curled_count >= 3) and (thumb_tip[1] < thumb_mcp[1] - 15)

    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    xmin, xmax = max(0, min(xs)), min(w, max(xs))
    ymin, ymax = max(0, min(ys)), min(h, max(ys))

    notes = []
    if is_trapped_thumb:
        notes.append("CRITICAL: Universal SOS Hand Sign detected (Trapped Thumb inside fingers into fist).")
    elif thumb_tucked and fingers_curled_count == 0:
        notes.append("SOS Sign Stage 2: Palm open facing camera with thumb tucked across palm.")
    elif is_open_palm:
        notes.append("Open raised palm facing camera (Emergency Help).")
    elif is_thumbs_up:
        notes.append("Thumbs Up gesture (Yes/Agree).")
    else:
        notes.append(f"Hand detected with {4 - fingers_curled_count} fingers extended.")

    return {
        "bbox": (xmin, ymin, xmax, ymax),
        "thumb_tucked": thumb_tucked,
        "fingers_curled_count": fingers_curled_count,
        "is_trapped_thumb": is_trapped_thumb,
        "notes": " ".join(notes),
    }

def process_and_crop_image(image_bgr: np.ndarray) -> tuple[np.ndarray, str, bool]:
    h, w, _ = image_bgr.shape
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)

    recognition_result = recognizer.recognize(mp_image)

    notes = []
    has_landmarks = False
    crop_box = None

    if recognition_result.gestures:
        top_gesture = recognition_result.gestures[0][0]
        notes.append(f"MediaPipe Classification: {top_gesture.category_name} ({top_gesture.score:.2f})")

    if recognition_result.hand_landmarks:
        has_landmarks = True
        for hand_lms in recognition_result.hand_landmarks:
            analysis = analyze_hand_geometry(hand_lms, w, h)
            notes.append(analysis["notes"])
            crop_box = analysis["bbox"]

    if crop_box:
        xmin, ymin, xmax, ymax = crop_box
        margin_x = int((xmax - xmin) * 0.4)
        margin_y = int((ymax - ymin) * 0.4)
        c_xmin = max(0, xmin - margin_x)
        c_ymin = max(0, ymin - margin_y)
        c_xmax = min(w, xmax + margin_x)
        c_ymax = min(h, ymax + margin_y)

        cropped = image_bgr[c_ymin:c_ymax, c_xmin:c_xmax]
        if cropped.size > 0:
            enhanced = cv2.convertScaleAbs(cropped, alpha=1.1, beta=10)
            return enhanced, " | ".join(notes), has_landmarks

    # Fallback to enhanced full image
    enhanced = cv2.convertScaleAbs(image_bgr, alpha=1.05, beta=5)
    return enhanced, " | ".join(notes) if notes else "Full camera view.", has_landmarks

@app.get("/")
def root():
    return {
        "service": "Silent Voice Vision Engine",
        "status": "online",
        "engine": "MediaPipe Tasks + OpenCV + Gemini Flash",
        "endpoints": {
            "health": "/health",
            "docs": "/docs",
            "analyze": "/analyze"
        }
    }

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "Silent Voice Vision Engine",
        "engine": "MediaPipe Tasks + OpenCV + Gemini Flash",
    }

@app.post("/analyze")
async def analyze_frame(req: AnalyzeRequest):
    raw_b64 = req.image.strip()
    if not raw_b64:
        raise HTTPException(status_code=400, detail="Missing image")

    if "base64," in raw_b64:
        raw_b64 = raw_b64.split("base64,")[1]

    try:
        img_bytes = base64.b64decode(raw_b64)
        np_arr = np.frombuffer(img_bytes, np.uint8)
        img_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if img_bgr is None:
            raise HTTPException(status_code=400, detail="Invalid image payload")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Decode error: {e}")

    # 1. High-speed Computer Vision pre-processing & landmark analysis
    processed_bgr, vision_notes, has_landmarks = process_and_crop_image(img_bgr)

    # Re-encode cropped ROI
    _, enc_buf = cv2.imencode(".jpg", processed_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
    clean_processed_b64 = base64.b64encode(enc_buf).decode("utf-8")

    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key or len(api_key) < 10:
        return {
            "detected": False,
            "cue": "GEMINI_API_KEY missing in environment",
            "en": "Please configure GEMINI_API_KEY to enable AI translation.",
            "hi": "कृपया .env.local में GEMINI_API_KEY दर्ज करें।",
            "or": "ଦୟାକରି GEMINI_API_KEY ଯୋଡନ୍ତୁ।",
            "phraseKey": "none",
            "confidence": 0.0,
            "landmarks_detected": has_landmarks,
            "vision_notes": vision_notes,
        }

    ai = genai.Client(api_key=api_key, http_options={"api_version": "v1beta"})
    fast_models = [
        "gemini-2.5-flash",
        "gemini-flash-lite-latest",
        "gemini-3.8-flash",
    ]

    prompt_text = f"""
Computer Vision Landmark Analysis (MediaPipe):
{vision_notes}

Task:
You are looking at the zoomed, contrast-enhanced region of interest of the patient.
Use BOTH the image and the Computer Vision Landmark measurements above to identify the patient's intended gesture or request.
- If Landmark Analysis states "CRITICAL: Universal SOS Hand Sign detected" or "Trapped Thumb", IMMEDIATELY classify as help ("Please help / Emergency.") with confidence 1.0.
- If a clear gesture is visible, BE DECISIVE and map to the intended request. Do NOT say "No gesture" if a hand or facial expression is deliberately raised.
Return structured JSON.
"""

    response_text = ""
    for model_name in fast_models:
        try:
            resp = ai.models.generate_content(
                model=model_name,
                contents=[
                    {
                        "role": "user",
                        "parts": [
                            {"inline_data": {"mime_type": "image/jpeg", "data": clean_processed_b64}},
                            {"text": prompt_text},
                        ],
                    }
                ],
                config={
                    "system_instruction": SYSTEM_INSTRUCTION,
                    "response_mime_type": "application/json",
                    "temperature": 0.1,
                },
            )
            if resp and resp.text:
                response_text = resp.text.strip()
                break
        except Exception as err:
            print(f"Model {model_name} failed: {err}")
            continue

    if not response_text:
        return {
            "detected": False,
            "cue": "Could not classify gesture. Please hold hand clearly facing camera.",
            "en": "No clear gesture recognized. Please hold sign steady.",
            "hi": "स्पष्ट इशारा नहीं दिखा। कृपया हाथ कैमरे के सामने रखें।",
            "or": "ସ୍ପଷ୍ଟ ସଙ୍କେତ ମିଳିଲା ନାହିଁ। ଦୟାକରି ହାତ ସ୍ଥିର ରଖନ୍ତୁ।",
            "phraseKey": "none",
            "confidence": 0.0,
            "landmarks_detected": has_landmarks,
            "vision_notes": vision_notes,
        }

    try:
        clean_json_str = response_text
        if "```json" in clean_json_str:
            clean_json_str = clean_json_str.split("```json")[1].split("```")[0].strip()
        elif "```" in clean_json_str:
            clean_json_str = clean_json_str.split("```")[1].split("```")[0].strip()

        data = json.loads(clean_json_str)
        odia_text = str(data.get("or", data.get("or_", data.get("odia", ""))))
        return {
            "detected": bool(data.get("detected", False)),
            "cue": str(data.get("cue", "")),
            "en": str(data.get("en", "")),
            "hi": str(data.get("hi", "")),
            "or": odia_text,
            "or_": odia_text,
            "phraseKey": str(data.get("phraseKey", "none")),
            "confidence": float(data.get("confidence", 0.9)),
            "landmarks_detected": has_landmarks,
            "vision_notes": vision_notes,
        }
    except Exception as e:
        print(f"JSON parsing error: {e}, raw was: {response_text}")
        return {
            "detected": False,
            "cue": "Error parsing model output",
            "en": "Analysis error. Please try again.",
            "hi": "विश्लेषण त्रुटि। पुनः प्रयास करें।",
            "or": "ବିଶ୍ଳେଷଣ ତ୍ରୁଟି। ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।",
            "phraseKey": "none",
            "confidence": 0.0,
            "landmarks_detected": has_landmarks,
            "vision_notes": vision_notes,
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
