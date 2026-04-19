import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import FormData from "form-data";
import axios from "axios";
import path from "path";
import fs from "fs";

// Initialize multer for handling file uploads (in-memory)
const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set up JSON parsing for other routes
  app.use(express.json());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Background Removal API Endpoint
  app.post("/api/remove-bg", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image provided" });
      }

      // Check API Key
      const apiKey = process.env.REMOVE_BG_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "REMOVE_BG_API_KEY is not configured" });
      }

      // Prepare form data for remove.bg
      const formData = new FormData();
      formData.append("size", "auto");
      // Use standard naming and append buffer directly.
      formData.append("image_file", req.file.buffer, {
        filename: req.file.originalname || "image.png",
        contentType: req.file.mimetype || "image/png",
      });

      // Provide the bg_color if given
      const bgColor = req.body.bg_color;
      if (bgColor) {
        formData.append("bg_color", bgColor);
      }

      // Execute request to remove.bg
      const response = await axios.post("https://api.remove.bg/v1.0/removebg", formData, {
        headers: {
          ...formData.getHeaders(),
          "X-Api-Key": apiKey,
        },
        responseType: "arraybuffer", // Important to get binary data back
      });

      // Send the resulting image buffer directly to the client as an image/png
      res.setHeader("Content-Type", "image/png");
      res.send(response.data);
    } catch (error: any) {
      console.error("Remove.bg API Error:", error.message);
      if (error.response) {
        console.error("Remove.bg Response:", error.response.data.toString());
      }
      res.status(500).json({ error: "Failed to remove background" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production serving
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
