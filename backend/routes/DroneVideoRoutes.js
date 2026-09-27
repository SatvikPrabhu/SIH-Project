const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const DroneVideo = require("../models/DroneVideo");

const router = express.Router();

// Base directories
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const STORAGE_INPUTS_DIR = path.join(PROJECT_ROOT, "storage", "inputs");
const STORAGE_OUTPUTS_DIR = path.join(PROJECT_ROOT, "storage", "outputs");
const FRONTEND_MODELS_DIR = path.join(PROJECT_ROOT, "frontend", "public", "models");

// Ensure required working directories exist
[STORAGE_INPUTS_DIR, STORAGE_OUTPUTS_DIR, FRONTEND_MODELS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Multer in-memory storage for handling video and optional telemetry SRT files
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 1024 * 1024 * 500 // 500MB max limit
    }
});

/**
 * Resolves the appropriate Python executable path (venv vs system)
 */
function getPythonExecutable() {
    if (process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)) {
        return process.env.PYTHON_PATH;
    }
    const winVenvPython = path.join(PROJECT_ROOT, "generation", "venv", "Scripts", "python.exe");
    if (fs.existsSync(winVenvPython)) {
        return winVenvPython;
    }
    const unixVenvPython = path.join(PROJECT_ROOT, "generation", "venv", "bin", "python");
    if (fs.existsSync(unixVenvPython)) {
        return unixVenvPython;
    }
    return process.platform === "win32" ? "python" : "python3";
}

/**
 * Trigger the Python 3D reconstruction pipeline via child_process.spawn
 */
function triggerPythonPipeline(jobId, localVideoPath, outputDir, localSrtPath = null) {
    const pythonExe = getPythonExecutable();
    const scriptPath = path.join(PROJECT_ROOT, "generation", "run_pipeline.py");

    const args = [
        scriptPath,
        "--video_path", localVideoPath,
        "--output_dir", outputDir
    ];

    if (localSrtPath && fs.existsSync(localSrtPath)) {
        args.push("--srt", localSrtPath);
    }

    console.log(`[Job ${jobId}] Spawning Python pipeline:`);
    console.log(`Command: ${pythonExe} ${args.join(" ")}`);

    const pythonProcess = spawn(pythonExe, args, {
        cwd: PROJECT_ROOT,
        env: { ...process.env, PYTHONUNBUFFERED: "1" }
    });

    let stdoutBuffer = "";
    let stderrBuffer = "";

    pythonProcess.stdout.on("data", (data) => {
        const text = data.toString();
        stdoutBuffer += text;
        console.log(`[Job ${jobId} STDOUT]: ${text.trim()}`);
    });

    pythonProcess.stderr.on("data", (data) => {
        const text = data.toString();
        stderrBuffer += text;
        console.warn(`[Job ${jobId} STDERR]: ${text.trim()}`);
    });

    pythonProcess.on("error", async (err) => {
        console.error(`[Job ${jobId}] Failed to spawn Python process:`, err);
        await DroneVideo.findByIdAndUpdate(jobId, {
            status: "FAILED",
            error: `Failed to spawn Python process: ${err.message}`
        });
    });

    pythonProcess.on("close", async (code) => {
        console.log(`[Job ${jobId}] Pipeline process exited with code ${code}`);

        if (code === 0) {
            try {
                // Locate generated 3D Model GLB
                const candidates = [
                    path.join(outputDir, "model.glb"),
                    path.join(outputDir, "exports", "model.glb"),
                    path.join(outputDir, "3dgs", "model.glb"),
                    path.join(PROJECT_ROOT, "storage", "outputs", "recon_demo", "model.glb"),
                    path.join(FRONTEND_MODELS_DIR, "model.glb")
                ];

                let foundGlb = null;
                for (const candidate of candidates) {
                    if (fs.existsSync(candidate)) {
                        foundGlb = candidate;
                        break;
                    }
                }

                const targetFilename = `${jobId}.glb`;
                const targetGlbPath = path.join(FRONTEND_MODELS_DIR, targetFilename);
                const defaultGlbPath = path.join(FRONTEND_MODELS_DIR, "model.glb");

                if (foundGlb && fs.existsSync(foundGlb)) {
                    fs.copyFileSync(foundGlb, targetGlbPath);
                    fs.copyFileSync(foundGlb, defaultGlbPath);
                    console.log(`[Job ${jobId}] Copied model.glb to frontend: ${targetGlbPath}`);
                }

                await DroneVideo.findByIdAndUpdate(jobId, {
                    status: "COMPLETED",
                    progress: 100,
                    modelPath: targetGlbPath,
                    modelGlbUrl: `/models/${targetFilename}`,
                    completedAt: new Date()
                });

                console.log(`[Job ${jobId}] Database updated to COMPLETED`);
            } catch (err) {
                console.error(`[Job ${jobId}] Post-processing error:`, err);
                await DroneVideo.findByIdAndUpdate(jobId, {
                    status: "COMPLETED",
                    progress: 100,
                    modelGlbUrl: `/models/${jobId}.glb`,
                    completedAt: new Date()
                });
            }
        } else {
            const errorSummary = stderrBuffer.slice(-500) || `Process exited with code ${code}`;
            console.error(`[Job ${jobId}] Reconstruction failed:`, errorSummary);

            await DroneVideo.findByIdAndUpdate(jobId, {
                status: "FAILED",
                error: errorSummary
            });
        }
    });
}

/**
 * POST /api/drone/upload & /api/drone-videos/upload
 * Handles video file upload, saves to GridFS, creates local copy, and triggers Python pipeline
 */
router.post(
    "/upload",
    upload.fields([
        { name: "video", maxCount: 1 },
        { name: "srt", maxCount: 1 }
    ]),
    async (req, res) => {
        try {
            const videoFile = req.files?.video?.[0] || (req.file ? req.file : null);

            if (!videoFile) {
                return res.status(400).json({
                    success: false,
                    message: "No video file provided. Please attach a video file with field name 'video'."
                });
            }

            const srtFile = req.files?.srt?.[0] || null;

            // 1. Save video stream to MongoDB GridFS
            const bucket = new mongoose.mongo.GridFSBucket(
                mongoose.connection.db,
                { bucketName: "videos" }
            );

            console.log("Receiving drone video:", videoFile.originalname);

            const uploadStream = bucket.openUploadStream(videoFile.originalname, {
                contentType: videoFile.mimetype
            });

            uploadStream.end(videoFile.buffer);

            uploadStream.on("finish", async () => {
                try {
                    const sanitizedName = videoFile.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");

                    // 2. Create MongoDB document with status "PROCESSING"
                    const videoDoc = await DroneVideo.create({
                        filename: uploadStream.filename,
                        originalName: videoFile.originalname,
                        contentType: videoFile.mimetype,
                        fileId: uploadStream.id,
                        status: "PROCESSING",
                        progress: 10
                    });

                    const jobId = videoDoc._id.toString();
                    const localVideoFilename = `${jobId}_${sanitizedName}`;
                    const localVideoPath = path.join(STORAGE_INPUTS_DIR, localVideoFilename);
                    const outputJobDir = path.join(STORAGE_OUTPUTS_DIR, jobId);

                    // 3. Save local copy for Python pipeline
                    fs.writeFileSync(localVideoPath, videoFile.buffer);
                    console.log(`[Job ${jobId}] Saved local copy to: ${localVideoPath}`);

                    // Save accompanying SRT if provided
                    let localSrtPath = null;
                    if (srtFile) {
                        const srtExt = path.extname(srtFile.originalname) || ".srt";
                        const baseName = path.parse(sanitizedName).name;
                        localSrtPath = path.join(STORAGE_INPUTS_DIR, `${jobId}_${baseName}${srtExt}`);
                        fs.writeFileSync(localSrtPath, srtFile.buffer);
                        console.log(`[Job ${jobId}] Saved accompanying SRT to: ${localSrtPath}`);
                    }

                    // Update document with local paths and outputDir
                    await DroneVideo.findByIdAndUpdate(jobId, {
                        localVideoPath: localVideoPath,
                        localSrtPath: localSrtPath,
                        outputDir: outputJobDir
                    });

                    // 4. Trigger Python 3D pipeline asynchronously
                    triggerPythonPipeline(jobId, localVideoPath, outputJobDir, localSrtPath);

                    // Respond immediately with job information
                    return res.status(201).json({
                        success: true,
                        message: "Drone video uploaded successfully. 3D reconstruction pipeline triggered.",
                        videoId: jobId,
                        jobId: jobId,
                        status: "PROCESSING",
                        video: videoDoc
                    });
                } catch (saveErr) {
                    console.error("Schema creation error:", saveErr);
                    return res.status(500).json({
                        success: false,
                        message: "Video information could not be saved",
                        error: saveErr.message
                    });
                }
            });

            uploadStream.on("error", (gridErr) => {
                console.error("GridFS error:", gridErr);
                return res.status(500).json({
                    success: false,
                    message: "Failed to store video in GridFS",
                    error: gridErr.message
                });
            });
        } catch (error) {
            console.error("Upload error:", error);
            return res.status(500).json({
                success: false,
                message: "Video upload failed",
                error: error.message
            });
        }
    }
);

/**
 * GET /api/drone/status/:id & /api/drone/:id/status
 * Polling endpoint for frontend to check pipeline completion
 */
const getStatusHandler = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid video job ID"
            });
        }

        const video = await DroneVideo.findById(id);

        if (!video) {
            return res.status(404).json({
                success: false,
                message: "Drone video job not found"
            });
        }

        return res.status(200).json({
            success: true,
            jobId: video._id,
            id: video._id,
            filename: video.originalName,
            status: video.status,
            progress: video.progress,
            modelPath: video.modelPath,
            modelGlbUrl: video.modelGlbUrl,
            error: video.error,
            uploadDate: video.uploadDate,
            completedAt: video.completedAt
        });
    } catch (error) {
        console.error("Status check error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch job status",
            error: error.message
        });
    }
};

router.get("/status/:id", getStatusHandler);
router.get("/:id/status", getStatusHandler);

/**
 * GET /api/drone/all
 * List all drone video reconstructions
 */
router.get("/all", async (req, res) => {
    try {
        const videos = await DroneVideo.find().sort({ uploadDate: -1 });
        return res.status(200).json({
            success: true,
            count: videos.length,
            videos: videos
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve videos",
            error: error.message
        });
    }
});

/**
 * GET /api/drone/:id
 * Retrieve single video metadata
 */
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid ID" });
        }
        const video = await DroneVideo.findById(id);
        if (!video) {
            return res.status(404).json({ success: false, message: "Video not found" });
        }
        return res.status(200).json({ success: true, video: video });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;