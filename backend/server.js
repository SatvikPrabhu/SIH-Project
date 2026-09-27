const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

require("dotenv").config({ path: path.resolve(__dirname, ".env") });
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const app = express();

app.use(cors());
app.use(express.json());

// Serve frontend public models and storage outputs statically
const FRONTEND_MODELS_DIR = path.join(__dirname, "..", "frontend", "public", "models");
const STORAGE_DIR = path.join(__dirname, "..", "storage");

if (fs.existsSync(FRONTEND_MODELS_DIR)) {
    app.use("/models", express.static(FRONTEND_MODELS_DIR));
}
if (fs.existsSync(STORAGE_DIR)) {
    app.use("/storage", express.static(STORAGE_DIR));
}

app.get("/", (req, res) => {
    res.json({
        name: "Geo3D Vision Drone 3D Reconstruction API",
        status: "online",
        mongoConnected: mongoose.connection.readyState === 1,
        endpoints: {
            upload: "POST /api/drone/upload",
            status: "GET /api/drone/status/:id",
            videos: "GET /api/drone/all",
            health: "GET /api/v1/health"
        }
    });
});

app.get("/api/v1/health", (req, res) => {
    res.json({
        status: "ok",
        uptime: process.uptime(),
        mongoState: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
    });
});

app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

const droneVideoRoutes = require("./routes/DroneVideoRoutes");
app.use("/api/drone", droneVideoRoutes);
app.use("/api/drone-videos", droneVideoRoutes);

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/geo3d_drone_db";

// Start Express server immediately so endpoints are always available
app.listen(PORT, () => {
    console.log(`\n=============================================================`);
    console.log(`🚀 [BACKEND] Geo3D Server listening on http://localhost:${PORT}`);
    console.log(`📡 [BACKEND] Upload endpoint: http://localhost:${PORT}/api/drone/upload`);
    console.log(`=============================================================\n`);
});

// Attempt MongoDB connection non-blockingly
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log("✅ [DATABASE] MongoDB connected successfully to:", MONGO_URI);
    })
    .catch((error) => {
        console.warn("⚠️ [DATABASE] MongoDB connection failed (server running in fallback in-memory mode):", error.message);
    });