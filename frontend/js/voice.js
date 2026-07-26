/* ============================================================
   RoadSoS NEXUS — Voice Input
   Uses the browser's NATIVE Web Speech API (webkitSpeechRecognition) —
   this is real, free, on-device/cloud browser speech-to-text, not a
   simulation. Language auto-detect after transcription is handled by
   the backend's script-based detector (backend/language.py).

   HONEST LIMITATION: Web Speech API's *recognition* language must be
   selected before listening starts (browsers don't auto-detect which
   of 22 languages you're about to speak). We default to Hindi+English
   candidates and let the user pick a recognition language from a
   dropdown — full offline 22-language ASR needs Whisper (see
   backend/language.py docstring for the upgrade path).
   ============================================================ */

const VoiceModule = (() => {
  let recognition = null;
  let listening = false;

  const LANG_CODES = {
    'English': 'en-IN', 'Hindi': 'hi-IN', 'Tamil': 'ta-IN', 'Telugu': 'te-IN',
    'Kannada': 'kn-IN', 'Malayalam': 'ml-IN', 'Bengali': 'bn-IN', 'Marathi': 'mr-IN',
    'Gujarati': 'gu-IN', 'Punjabi': 'pa-IN', 'Odia': 'or-IN',
  };

  function isSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function start(langLabel, onResult, onEnd, onError) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { onError && onError('Web Speech API not supported in this browser — try Chrome.'); return; }

    recognition = new SR();
    recognition.lang = LANG_CODES[langLabel] || 'en-IN';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      onResult && onResult(transcript, event.results[event.results.length - 1].isFinal);
    };
    recognition.onerror = (e) => { onError && onError(e.error); listening = false; };
    recognition.onend = () => { listening = false; onEnd && onEnd(); };

    recognition.start();
    listening = true;
  }

  function stop() { if (recognition && listening) recognition.stop(); }
  function langOptions() { return Object.keys(LANG_CODES); }

  return { isSupported, start, stop, langOptions };
})();
