import os, io, uuid, traceback, threading
from pathlib import Path
import numpy as np
import scipy.io.wavfile as wavfile
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS

BASE_DIR = Path(__file__).resolve().parent
VOICE_DIR = BASE_DIR / "voices"
CACHE_DIR = BASE_DIR / ".cache"
VOICE_DIR.mkdir(exist_ok=True)
CACHE_DIR.mkdir(exist_ok=True)
os.environ.setdefault("MPLCONFIGDIR", str(CACHE_DIR / "matplotlib"))

app = Flask(__name__)
CORS(app)

from TTS.api import TTS

print("Loading XTTS v2 model...")
tts = TTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2", progress_bar=False, gpu=False)
print("Model loaded.")

model_lock = threading.Lock()
ALLOWED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".aac", ".ogg", ".flac", ".webm"}


def speaker_path(speaker_id):
    for candidate in VOICE_DIR.glob(f"{speaker_id}.*"):
        if candidate.suffix.lower() in ALLOWED_AUDIO_EXTENSIONS:
            return candidate
    return None


def saved_voice_ids():
    return [
        path.stem for path in sorted(VOICE_DIR.glob("*"))
        if path.is_file() and path.suffix.lower() in ALLOWED_AUDIO_EXTENSIONS
    ]


@app.route('/health', methods=['GET'])
def health():
    saved_voice_count = len(saved_voice_ids())
    return jsonify({
        "ok": True,
        "engine": "coqui-xtts-v2",
        "port": 5001,
        "saved_voices": saved_voice_count,
    })


@app.route('/voices', methods=['GET'])
def voices():
    return jsonify({"voices": saved_voice_ids()})

@app.route('/upload_voice', methods=['POST'])
def upload_voice():
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    try:
        speaker_id = str(uuid.uuid4())
        ext = Path(file.filename).suffix.lower()
        if ext not in ALLOWED_AUDIO_EXTENSIONS:
            ext = ".wav"
        path = VOICE_DIR / f"{speaker_id}{ext}"
        file.save(path)
        return jsonify({"speaker_id": speaker_id, "engine": "coqui-xtts-v2"})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/tts', methods=['POST'])
def synthesize():
    data = request.get_json(silent=True) or {}
    text = (data.get('text') or '').strip()
    speaker_id = (data.get('speaker_id') or '').strip()
    language = data.get('language', 'en')

    if not text or not speaker_id:
        return jsonify({"error": "Missing text or speaker_id"}), 400

    saved_voice = speaker_path(speaker_id)
    if not saved_voice or not saved_voice.exists():
        return jsonify({"error": "Speaker not found"}), 404

    try:
        with model_lock:
            wav = tts.tts(
                text=text[:700],
                speaker_wav=str(saved_voice),
                language=language,
                split_sentences=True,
            )

        audio_array = np.array(wav, dtype=np.float64)
        audio_array = np.clip(audio_array, -1.0, 1.0)
        audio_int16 = (audio_array * 32767).astype(np.int16)

        out = io.BytesIO()
        sample_rate = tts.synthesizer.output_sample_rate
        wavfile.write(out, sample_rate, audio_int16)
        out.seek(0)
        return send_file(out, mimetype='audio/wav')
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("🚀 XTTS2 TTS server running on http://localhost:5001")
    app.run(host='127.0.0.1', port=5001, debug=False, threaded=True)
