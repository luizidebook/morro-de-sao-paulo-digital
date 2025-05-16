import express from "express";
import cors from "cors";
import fetch from "node-fetch"; // You might need to install this: npm install node-fetch

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());

// Create the proxy route
app.get("/tfhub-proxy/*", async (req, res) => {
  try {
    const url = req.params[0];
    console.log(`[Proxy] Fetching: https://tfhub.dev/${url}`);

    const response = await fetch(`https://tfhub.dev/${url}`);
    console.log(`[Proxy] Response status: ${response.status}`);

    const data = await response.buffer();
    res.set("Content-Type", response.headers.get("content-type"));
    res.send(data);
  } catch (error) {
    console.error(`[Proxy] Error fetching from TF Hub: ${error.message}`);
    res.status(500).send("Error fetching from TF Hub: " + error.message);
  }
});

// Add a status endpoint
app.get("/status", (req, res) => {
  res.json({
    status: "ok",
    message: "TensorFlow.js model proxy server is running",
    timestamp: new Date().toISOString(),
  });
});

// Add basic error handling and logging
app.use((err, req, res, next) => {
  console.error("Proxy server error:", err);
  res.status(500).send("Proxy server error: " + err.message);
});

// Start the server
app.listen(port, () => {
  console.log(`Proxy server running on port ${port}`);
});
