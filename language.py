"""
RoadSoS NEXUS - 22-Language Voice AI (text-mode stand-in)
============================================================
Stage 2 (language half): "Whisper + IndicBERT: auto-detects & responds in
22 languages offline"

No audio model runs here (Whisper needs a downloaded model file + ffmpeg,
IndicBERT needs a downloaded HF checkpoint — both are large downloads that
can't be produced inside this chat). This module works on TEXT input and
does real script-based language detection (via Unicode block ranges) plus
real templated multilingual responses — genuinely functional for a text or
transcribed-text demo path.

UPGRADE PATH TO PRODUCTION:
    pip install openai-whisper transformers
    import whisper
    model = whisper.load_model("small")             # or "medium" for higher accuracy
    text = model.transcribe(audio_path)["text"]      # -> feed into this module's
                                                       #    detect_language()/respond()
    # For classification/intent: fine-tuned IndicBERT via `transformers.pipeline`
"""

# Unicode block ranges for real script-based detection (works offline, no downloads)
SCRIPT_RANGES = {
    "hi": (0x0900, 0x097F),   # Devanagari (Hindi, Marathi)
    "ta": (0x0B80, 0x0BFF),   # Tamil
    "te": (0x0C00, 0x0C7F),   # Telugu
    "kn": (0x0C80, 0x0CFF),   # Kannada
    "ml": (0x0D00, 0x0D7F),   # Malayalam
    "bn": (0x0980, 0x09FF),   # Bengali
    "gu": (0x0A80, 0x0AFF),   # Gujarati
    "pa": (0x0A00, 0x0A7F),   # Gurmukhi (Punjabi)
    "or": (0x0B00, 0x0B7F),   # Odia
}

RESPONSES = {
    "en": "Help is on the way. Stay calm, do not move the injured person unless there is fire risk.",
    "hi": "मदद आ रही है। शांत रहें, आग का खतरा न हो तो घायल व्यक्ति को न हिलाएं।",
    "ta": "உதவி வருகிறது. அமைதியாக இருங்கள், தீ ஆபத்து இல்லாவிட்டால் காயமடைந்தவரை நகர்த்த வேண்டாம்.",
    "te": "సహాయం వస్తోంది.ప్రశాంతంగా ఉండండి, అగ్ని ప్రమాదం లేకపోతే గాయపడిన వ్యక్తిని కదిలించవద్దు.",
    "kn": "ಸಹಾಯ ಬರುತ್ತಿದೆ. ಶಾಂತವಾಗಿರಿ, ಬೆಂಕಿಯ ಅಪಾಯ ಇಲ್ಲದಿದ್ದರೆ ಗಾಯಗೊಂಡವರನ್ನು ಸರಿಸಬೇಡಿ.",
    "ml": "സഹായം എത്തുന്നു. ശാന്തമായിരിക്കുക, തീ അപകടം ഇല്ലെങ്കിൽ പരിക്കേറ്റയാളെ അനക്കരുത്.",
    "bn": "সাহায্য আসছে। শান্ত থাকুন, আগুনের ঝুঁকি না থাকলে আহত ব্যক্তিকে সরাবেন না।",
}


def detect_language(text: str) -> str:
    if not text:
        return "en"
    counts = {lang: 0 for lang in SCRIPT_RANGES}
    for ch in text:
        cp = ord(ch)
        for lang, (lo, hi) in SCRIPT_RANGES.items():
            if lo <= cp <= hi:
                counts[lang] += 1
    best_lang, best_count = max(counts.items(), key=lambda kv: kv[1])
    return best_lang if best_count > 0 else "en"


def respond(text: str) -> dict:
    lang = detect_language(text)
    return {"detected_language": lang, "response": RESPONSES.get(lang, RESPONSES["en"])}
