#!/usr/bin/env bash
set -e

echo "🔊 Setting up OpenVoice TTS server..."

# Remove old tts-server and create fresh
rm -rf tts-server
mkdir -p tts-server
cd tts-server

# Create virtual environment (try Python 3.11 first, fallback to default)
python3.11 -m venv venv 2>/dev/null || python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install openvoice flask

# Pre-download model components (optional but recommended)
python -c "from openvoice import se_extractor; from openvoice.api import BaseSpeakerTTS; print('OpenVoice preload OK')" || true

# Write the server script
cat > server.py << 'EOF'
from flask import Flask, request, send_file, jsonify
import io, os, uuid, tempfile
from openvoice import se_extractor
from openvoice.api import BaseSpeakerTTS

app = Flask(__name__)

# Load base TTS model (CPU, will download on first run)
print("Loading OpenVoice base TTS model...")
tts = BaseSpeakerTTS('en', device='cpu')
print("Model loaded.")

speakers = {}  # speaker_id -> embedding tensor

@app.route('/upload_voice', methods=['POST'])
def upload_voice():
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    tmp_path = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4()}.wav")
    file.save(tmp_path)

    try:
        embed = se_extractor.get_se(tmp_path, tts, vad=False)
        sid = str(uuid.uuid4())
        speakers[sid] = embed
        os.remove(tmp_path)
        return jsonify({"speaker_id": sid})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/tts', methods=['POST'])
def synthesize():
    data = request.get_json()
    text = data.get('text')
    speaker_id = data.get('speaker_id')
    language = data.get('language', 'en')

    if not text or not speaker_id:
        return jsonify({"error": "Missing text or speaker_id"}), 400
    if speaker_id not in speakers:
        return jsonify({"error": "Speaker not found"}), 404

    embed = speakers[speaker_id]
    wav = tts.synthesize(text, embed, style='default', speed=1.0)

    out = io.BytesIO()
    tts.save_wav(wav, out)
    out.seek(0)
    return send_file(out, mimetype='audio/wav')

if __name__ == '__main__':
    print("🚀 OpenVoice TTS server running on http://localhost:5001")
    app.run(host='0.0.0.0', port=5001, debug=False)
EOF

echo ""
echo "✅ OpenVoice TTS server ready."
echo "   Start it with:  cd tts-server && source venv/bin/activate && python server.py"
