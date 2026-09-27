const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, ".env") });
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        name: "Geo3D Vision Drone 3D Reconstruction API",
        status: "online",
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
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log("MongoDB connected successfully");
        app.listen(PORT, () => {
            console.log(`Geo3D Backend server running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error("MongoDB connection error:", error);
    });