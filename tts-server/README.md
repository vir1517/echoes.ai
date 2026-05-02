# Local Voice Cloning Server

This app uses a local Coqui XTTS v2 server for voice cloning. It runs on `http://127.0.0.1:5001` and stores uploaded reference voices in `tts-server/voices`.

Start it from the project root:

```bash
tts-server/venv/bin/python tts-server/server.py
```

Useful checks:

```bash
curl -s http://127.0.0.1:5001/health
```

The browser app uploads audio to `/upload_voice`, saves the returned `speaker_id` on the profile, then sends chat responses to `/tts` with that `speaker_id`. Because voice samples are stored in `tts-server/voices`, the cloned voice still works after refreshing the app or restarting the TTS server.
