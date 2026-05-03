const express = require("express");
const cors = require("cors");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

const app = express();

// ✅ CORS FIX
app.use(cors({
  origin: "http://localhost:9002",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

const upload = multer({ dest: "uploads/" });

const VOICEBOX_URL = "http://localhost:17493";


// ✅ UPLOAD MP3 + CREATE PROFILE
app.post("/upload-voice", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
    }

    // ✅ Only allow MP3
    if (path.extname(req.file.originalname).toLowerCase() !== ".mp3") {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: "Only .mp3 files allowed"
      });
    }

    // 1. Create profile
    const profileRes = await axios.post(VOICEBOX_URL + "/profiles", {
      name: "user-voice-" + Date.now()
    });

    const profileId = profileRes.data.id;

    // 2. Upload sample
    const form = new FormData();
    form.append("file", fs.createReadStream(req.file.path));
    form.append("reference_text", "sample voice");

    const sampleRes = await axios.post(
      VOICEBOX_URL + "/profiles/" + profileId + "/samples",
      form,
      { headers: form.getHeaders() }
    );

    res.json({
      success: true,
      profileId,
      sampleId: sampleRes.data.id,
      fileStoredAt: req.file.path,
      message: "MP3 uploaded and voice cloned successfully"
    });

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({
      success: false,
      error: err.response?.data || err.message
    });
  }
});


// ✅ SPEAK ROUTE
app.post("/speak", async (req, res) => {
  try {
    const { text, profileId } = req.body;

    const speakRes = await axios.post(VOICEBOX_URL + "/speak", {
      text,
      profile: profileId,
      engine: "chatterbox_turbo"
    });

    res.json(speakRes.data);

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "TTS failed" });
  }
});


// ✅ START SERVER
app.listen(3001, () => {
  console.log("Voice server running on http://localhost:3001");
});
