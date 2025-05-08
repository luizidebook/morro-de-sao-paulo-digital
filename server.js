// server.js
const express = require("express");
const textToSpeech = require("@google-cloud/text-to-speech");
const fs = require("fs");
const util = require("util");
const bodyParser = require("body-parser");
const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Instantiates a client
const client = new textToSpeech.TextToSpeechClient();

app.post("/synthesize", async (req, res) => {
  const { text, lang } = req.body;

  const request = {
    input: { text: text },
    voice: {
      languageCode: lang,
      ssmlGender: "FEMALE",
    },
    audioConfig: {
      audioEncoding: "MP3",
    },
  };

  try {
    const [response] = await client.synthesizeSpeech(request);
    const writeFile = util.promisify(fs.writeFile);
    const fileName = `output-${Date.now()}.mp3`;
    await writeFile(`./public/${fileName}`, response.audioContent, "binary");
    res.send({ fileName });
  } catch (error) {
    console.error("ERROR:", error);
    res.status(500).send(error);
  }
});

app.get("/api/tts-proxy", async (req, res) => {
  try {
    const text = req.query.text;
    const lang = req.query.lang || "he";

    if (!text) {
      return res.status(400).send("Texto não fornecido");
    }

    // Requisição para Google TTS (ou outro serviço)
    const response = await fetch(
      `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
        text
      )}&tl=${lang}&client=tw-ob`
    );

    if (!response.ok) {
      throw new Error(`Erro na resposta: ${response.status}`);
    }

    // Obter os dados de áudio
    const audioBuffer = await response.arrayBuffer();

    // Enviar para o cliente
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(Buffer.from(audioBuffer));
  } catch (error) {
    console.error("Erro no serviço TTS:", error);
    res.status(500).send("Erro ao sintetizar voz");
  }
});

app.use(express.static("public"));

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
