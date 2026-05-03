const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const fetch = require('node-fetch');
const FormData = require('form-data');

const OLLAMA_API = 'http://127.0.0.1:11434';
const VOICEBOX_API = 'http://127.0.0.1:17493';
const UPLOAD_DIR = '/Users/vpsingh/Library/Application Support/sh.voicebox.app/profiles';

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json());

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const clean = (file.originalname.replace(ext, '') || 'voice_sample').replace(/[^a-zA-Z0-9_]/g, '_');
    cb(null, `${clean}_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

app.get('/health', async (_, res) => {
  try {
    const r = await fetch(`${VOICEBOX_API}/health`);
    res.status(r.ok ? 200 : 502).json({
      ok: r.ok,
      bridge: true,
      voicebox: r.ok ? await r.json() : await r.text()
    });
  } catch (e) {
    res.status(502).json({ ok: false, bridge: true, error: 'Voicebox unreachable' });
  }
});

// ── Ollama proxy ─────────────────────────────────────────
app.get('/api/tags', async (_, res) => {
  try {
    const r = await fetch(`${OLLAMA_API}/api/tags`);
    if (!r.ok) return res.status(r.status).json({ error: 'Ollama error' });
    res.json(await r.json());
  } catch (e) {
    res.status(502).json({ error: 'Ollama unreachable' });
  }
});

app.post('/api/speak', async (req, res) => {
  try {
    const r = await fetch(`${OLLAMA_API}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    if (!r.ok) {
      const err = await r.text();
      return res.status(r.status).json({ error: err });
    }
    res.json(await r.json());
  } catch (e) {
    res.status(502).json({ error: 'Ollama unreachable' });
  }
});

// ── Voicebox profile automation ────────────────────────────
app.post('/upload-voice', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    if (path.extname(req.file.originalname).toLowerCase() !== '.mp3') {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Only .mp3 voice samples are supported right now' });
    }

    const requestedName = (req.body.profileName || path.parse(req.file.originalname).name || 'cloned_voice')
      .toString()
      .replace(/[^a-zA-Z0-9 _-]/g, '')
      .trim()
      .slice(0, 72);
    const profileName = `${requestedName || 'cloned_voice'}_${Date.now()}`;
    console.log(`[bridge] creating Voicebox profile: ${profileName}`);

    const createResp = await fetch(`${VOICEBOX_API}/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: profileName,
        description: `Created from Echoes profile upload: ${req.file.originalname}`,
        language: 'en',
        voice_type: 'cloned',
        default_engine: 'chatterbox_turbo'
      })
    });
    if (!createResp.ok) {
      const err = await createResp.text();
      console.error('[bridge] Voicebox profile creation failed:', createResp.status, err);
      return res.status(502).json({ error: 'Failed to create Voicebox profile' });
    }
    const profile = await createResp.json();
    const profileId = profile.id;
    console.log(`[bridge] Voicebox profile created: ${profileId}`);

    const form = new FormData();
    form.append('file', fs.createReadStream(req.file.path));
    form.append('reference_text', 'voice sample');

    console.log('[bridge] uploading sample to Voicebox...');
    let sample = null;
    try {
      const sampleResp = await fetchWithTimeout(`${VOICEBOX_API}/profiles/${profileId}/samples`, {
        method: 'POST',
        body: form,
        headers: form.getHeaders()
      }, 30000);
      if (!sampleResp.ok) {
        const err = await sampleResp.text();
        console.error('[bridge] Voicebox sample upload failed:', sampleResp.status, err);
        return res.status(502).json({ error: 'Failed to add sample' });
      }
      sample = await sampleResp.json();
    } catch (e) {
      console.warn('[bridge] sample upload did not close cleanly; checking Voicebox samples...', e.name || e.message);
      const samplesResp = await fetch(`${VOICEBOX_API}/profiles/${profileId}/samples`);
      if (!samplesResp.ok) return res.status(502).json({ error: 'Failed to confirm sample upload' });
      const samples = await samplesResp.json();
      sample = Array.isArray(samples) && samples.length ? samples[samples.length - 1] : null;
      if (!sample) return res.status(502).json({ error: 'Voicebox profile created but no sample was attached' });
    }

    console.log('[bridge] sample uploaded successfully');
    res.json({ speaker_id: profileId, profileId, profileName, sampleId: sample.id, engine: 'voicebox-chatterbox-turbo' });
  } catch (e) {
    console.error('[bridge] upload-voice error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.delete('/voice-profile/:profileId', async (req, res) => {
  try {
    const profileId = req.params.profileId;
    if (!profileId) return res.status(400).json({ error: 'Missing profile id' });

    console.log(`[bridge] deleting Voicebox profile: ${profileId}`);
    const deleteResp = await fetch(`${VOICEBOX_API}/profiles/${encodeURIComponent(profileId)}`, {
      method: 'DELETE'
    });

    if (deleteResp.status === 404) {
      return res.json({ ok: true, deleted: false, missing: true });
    }

    if (!deleteResp.ok) {
      const err = await deleteResp.text();
      console.error('[bridge] Voicebox profile delete failed:', deleteResp.status, err);
      return res.status(502).json({ error: 'Failed to delete Voicebox profile' });
    }

    res.json({ ok: true, deleted: true });
  } catch (e) {
    console.error('[bridge] delete voice profile error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── TTS generation (polling for completed audio) ─────────
app.post('/speak', async (req, res) => {
  try {
    const { text, voice } = req.body;
    if (!text || !voice) return res.status(400).json({ error: 'Missing text or voice' });

    console.log(`[bridge] generating speech for profile: ${voice}`);

    const genResp = await fetch(`${VOICEBOX_API}/generate/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        profile_id: voice,
        language: 'en',
        engine: 'chatterbox_turbo',
        normalize: true
      })
    });
    if (!genResp.ok) {
      const err = await genResp.text();
      console.error('[bridge] Voicebox generate error:', genResp.status, err);
      return res.status(genResp.status).json({ error: err });
    }
    const audioBuffer = await genResp.arrayBuffer();
    res.set('Content-Type', 'audio/wav');
    res.send(Buffer.from(audioBuffer));
  } catch (e) {
    console.error('[bridge] speak error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.listen(3001, () => console.log('Bridge running on http://localhost:3001'));
