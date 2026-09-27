const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const crypto = require("crypto");

const DroneVideo = require("../models/DroneVideo");

const router = express.Router();

// In-memory job registry for resilience when MongoDB is offline
const inMemoryJobs = new Map();

// Base directories
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const STORAGE_INPUTS_DIR = path.join(PROJECT_ROOT, "storage", "inputs");
const STORAGE_OUTPUTS_DIR = path.join(PROJECT_ROOT, "storage", "outputs");
const FRONTEND_MODELS_DIR = path.join(PROJECT_ROOT, "frontend", "public", "models");

// Ensure required working directories exist
[STORAGE_INPUTS_DIR, STORAGE_OUTPUTS_DIR, FRONTEND_MODELS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[STORAGE INIT] 📁 Created directory: ${dir}`);
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

    console.log(`\n------------------------------------------------------------`);
    console.log(`[PIPELINE START] 🚀 Spawning 3D Reconstruction for Job: [${jobId}]`);
    console.log(`[PIPELINE EXEC] 🐍 Python Executable: ${pythonExe}`);
    console.log(`[PIPELINE SCRIPT] 📜 Script: ${scriptPath}`);
    console.log(`[PIPELINE ARGS] ⚙️ Arguments: ${args.join(" ")}`);
    console.log(`[PIPELINE CWD] 📂 Working Directory: ${PROJECT_ROOT}`);
    console.log(`------------------------------------------------------------\n`);

    const pythonProcess = spawn(pythonExe, args, {
        cwd: PROJECT_ROOT,
        env: { ...process.env, PYTHONUNBUFFERED: "1" }
    });

    let stdoutBuffer = "";
    let stderrBuffer = "";

    pythonProcess.stdout.on("data", (data) => {
        process.stdout.write(data);
        stdoutBuffer += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
        process.stderr.write(data);
        stderrBuffer += data.toString();
    });

    pythonProcess.on("error", async (err) => {
        console.error(`[PIPELINE ERROR] ❌ Failed to spawn Python process for Job [${jobId}]:`, err.message);
        
        // Update in-memory fallback
        if (inMemoryJobs.has(jobId)) {
            const memJob = inMemoryJobs.get(jobId);
            memJob.status = "FAILED";
            memJob.error = `Failed to spawn Python process: ${err.message}`;
        }

        // Update MongoDB if connected
        if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(jobId)) {
            try {
                await DroneVideo.findByIdAndUpdate(jobId, {
                    status: "FAILED",
                    error: `Failed to spawn Python process: ${err.message}`
                });
            } catch (dbErr) {
                console.error(`[DB ERROR] Could not update failed status for ${jobId}:`, dbErr.message);
            }
        }
    });

    pythonProcess.on("close", async (code) => {
        console.log(`\n------------------------------------------------------------`);
        console.log(`[PIPELINE FINISH] 🏁 Job [${jobId}] process exited with code ${code}`);

        if (code === 0) {
            try {
                // Locate generated 3D Model GLB
                const candidates = [
                    path.join(outputDir, "model.glb"),
                    path.join(outputDir, "dust3r", "model.glb"),
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
                    const fileSize = fs.statSync(foundGlb).size;
                    console.log(`[FILE TRANSFER] 🎯 Found generated GLB model at: ${foundGlb} (${(fileSize / (1024 * 1024)).toFixed(2)} MB)`);
                    
                    fs.copyFileSync(foundGlb, targetGlbPath);
                    console.log(`[FILE TRANSFER] ✅ Copied GLB model to frontend asset path: ${targetGlbPath}`);

                    fs.copyFileSync(foundGlb, defaultGlbPath);
                    console.log(`[FILE TRANSFER] ✅ Updated default fallback model: ${defaultGlbPath}`);
                } else {
                    console.warn(`[FILE TRANSFER] ⚠️ No specific GLB found in output directories, using default model at: ${defaultGlbPath}`);
                }

                const modelUrl = `/models/${targetFilename}`;

                // Update in-memory job
                if (inMemoryJobs.has(jobId)) {
                    const memJob = inMemoryJobs.get(jobId);
                    memJob.status = "COMPLETED";
                    memJob.progress = 100;
                    memJob.modelPath = targetGlbPath;
                    memJob.modelGlbUrl = modelUrl;
                    memJob.completedAt = new Date();
                    console.log(`[JOB STATE] ✅ Updated in-memory job [${jobId}] -> COMPLETED`);
                }

                // Update MongoDB if connected
                if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(jobId)) {
                    await DroneVideo.findByIdAndUpdate(jobId, {
                        status: "COMPLETED",
                        progress: 100,
                        modelPath: targetGlbPath,
                        modelGlbUrl: modelUrl,
                        completedAt: new Date()
                    });
                    console.log(`[DATABASE] ✅ Updated MongoDB document [${jobId}] -> COMPLETED`);
                }
            } catch (err) {
                console.error(`[POST-PROCESSING ERROR] Job [${jobId}]:`, err);
                if (inMemoryJobs.has(jobId)) {
                    const memJob = inMemoryJobs.get(jobId);
                    memJob.status = "COMPLETED";
                    memJob.progress = 100;
                    memJob.modelGlbUrl = `/models/${jobId}.glb`;
                }
            }
        } else {
            const errorSummary = stderrBuffer.slice(-500) || `Process exited with code ${code}`;
            console.error(`[PIPELINE FAILED] ❌ Job [${jobId}] failed:`, errorSummary);

            if (inMemoryJobs.has(jobId)) {
                const memJob = inMemoryJobs.get(jobId);
                memJob.status = "FAILED";
                memJob.error = errorSummary;
            }

            if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(jobId)) {
                await DroneVideo.findByIdAndUpdate(jobId, {
                    status: "FAILED",
                    error: errorSummary
                });
            }
        }
        console.log(`------------------------------------------------------------\n`);
    });
}

/**
 * POST /api/drone/upload & /api/drone-videos/upload
 * Handles video file upload, saves to disk, triggers Python pipeline, and responds immediately
 */
router.post(
    "/upload",
    upload.fields([
        { name: "video", maxCount: 1 },
        { name: "srt", maxCount: 1 }
    ]),
    async (req, res) => {
        try {
            console.log(`\n============================================================`);
            console.log(`[HTTP UPLOAD] 📥 Incoming POST /api/drone/upload request received`);

            const videoFile = req.files?.video?.[0] || (req.file ? req.file : null);

            if (!videoFile) {
                console.warn(`[HTTP UPLOAD] ❌ No video file provided in multipart payload`);
                return res.status(400).json({
                    success: false,
                    message: "No video file provided. Please attach a video file with field name 'video'."
                });
            }

            const srtFile = req.files?.srt?.[0] || null;
            const videoSizeMB = (videoFile.buffer.length / (1024 * 1024)).toFixed(2);
            console.log(`[FILE TRANSFER] 📹 Video received: "${videoFile.originalname}" | Size: ${videoSizeMB} MB | MIME: ${videoFile.mimetype}`);
            if (srtFile) {
                console.log(`[FILE TRANSFER] 🛰️ Telemetry SRT received: "${srtFile.originalname}" | Size: ${srtFile.buffer.length} bytes`);
            }

            // Generate unique Job ID (UUID or Mongo ObjectId)
            let jobId;
            const isMongoConnected = mongoose.connection.readyState === 1;

            if (isMongoConnected) {
                jobId = new mongoose.Types.ObjectId().toString();
            } else {
                jobId = `job_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
                console.log(`[IN-MEMORY] ℹ️ MongoDB offline. Generated in-memory Job ID: ${jobId}`);
            }

            const sanitizedName = videoFile.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
            const localVideoFilename = `${jobId}_${sanitizedName}`;
            const localVideoPath = path.join(STORAGE_INPUTS_DIR, localVideoFilename);
            const outputJobDir = path.join(STORAGE_OUTPUTS_DIR, jobId);

            // Ensure output directory for this job exists
            if (!fs.existsSync(outputJobDir)) {
                fs.mkdirSync(outputJobDir, { recursive: true });
            }

            // 1. Save video file to storage/inputs/
            fs.writeFileSync(localVideoPath, videoFile.buffer);
            const writtenStat = fs.statSync(localVideoPath);
            console.log(`[FILE TRANSFER] ✅ Video successfully saved to disk!`);
            console.log(`  Path: ${localVideoPath}`);
            console.log(`  Disk Size: ${(writtenStat.size / (1024 * 1024)).toFixed(2)} MB`);

            // 2. Save optional SRT telemetry file
            let localSrtPath = null;
            if (srtFile) {
                const srtExt = path.extname(srtFile.originalname) || ".srt";
                const baseName = path.parse(sanitizedName).name;
                localSrtPath = path.join(STORAGE_INPUTS_DIR, `${jobId}_${baseName}${srtExt}`);
                fs.writeFileSync(localSrtPath, srtFile.buffer);
                console.log(`[FILE TRANSFER] ✅ SRT telemetry saved to disk: ${localSrtPath} (${fs.statSync(localSrtPath).size} bytes)`);
            }

            // 3. Register in-memory job state
            const jobData = {
                _id: jobId,
                id: jobId,
                filename: localVideoFilename,
                originalName: videoFile.originalname,
                contentType: videoFile.mimetype,
                status: "PROCESSING",
                progress: 15,
                localVideoPath: localVideoPath,
                localSrtPath: localSrtPath,
                outputDir: outputJobDir,
                modelPath: null,
                modelGlbUrl: `/models/${jobId}.glb`,
                error: null,
                uploadDate: new Date()
            };
            inMemoryJobs.set(jobId, jobData);
            console.log(`[JOB REGISTRY] 📋 Job [${jobId}] registered with status: PROCESSING`);

            // 4. If MongoDB is connected, also persist to Mongo and GridFS
            if (isMongoConnected) {
                try {
                    const videoDoc = await DroneVideo.create({
                        _id: new mongoose.Types.ObjectId(jobId),
                        filename: localVideoFilename,
                        originalName: videoFile.originalname,
                        contentType: videoFile.mimetype,
                        fileId: new mongoose.Types.ObjectId(jobId),
                        status: "PROCESSING",
                        progress: 15,
                        localVideoPath: localVideoPath,
                        localSrtPath: localSrtPath,
                        outputDir: outputJobDir
                    });
                    console.log(`[DATABASE] 💾 Persisted DroneVideo record to MongoDB (ID: ${jobId})`);
                } catch (dbErr) {
                    console.warn(`[DATABASE WARNING] Could not write to MongoDB, continuing in-memory:`, dbErr.message);
                }
            }

            // 5. Trigger Python 3D reconstruction pipeline asynchronously
            triggerPythonPipeline(jobId, localVideoPath, outputJobDir, localSrtPath);

            console.log(`[HTTP RESPONSE] 📤 Responding to client with videoId: ${jobId} (status: PROCESSING)`);
            console.log(`============================================================\n`);

            // 6. Respond immediately with 201 Created and Job ID
            return res.status(201).json({
                success: true,
                message: "Drone video uploaded and written to disk successfully. 3D reconstruction pipeline triggered.",
                videoId: jobId,
                jobId: jobId,
                status: "PROCESSING",
                localVideoPath: localVideoPath
            });

        } catch (error) {
            console.error(`[UPLOAD ERROR] ❌ Video upload handling failed:`, error);
            return res.status(500).json({
                success: false,
                message: "Video upload failed on server",
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

        // Check in-memory registry first
        if (inMemoryJobs.has(id)) {
            const job = inMemoryJobs.get(id);
            console.log(`[STATUS POLL] 🔍 Status check for Job [${id}] -> Status: ${job.status}, Progress: ${job.progress}%`);
            return res.status(200).json({
                success: true,
                jobId: job.id,
                id: job.id,
                filename: job.originalName,
                status: job.status,
                progress: job.progress,
                modelPath: job.modelPath,
                modelGlbUrl: job.modelGlbUrl,
                error: job.error,
                uploadDate: job.uploadDate,
                completedAt: job.completedAt
            });
        }

        // Otherwise check MongoDB if connected
        if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
            const video = await DroneVideo.findById(id);
            if (video) {
                console.log(`[STATUS POLL] 🔍 Status check (DB) for Job [${id}] -> Status: ${video.status}, Progress: ${video.progress}%`);
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
            }
        }

        console.warn(`[STATUS POLL] ⚠️ Job ID [${id}] not found in memory or database`);
        return res.status(404).json({
            success: false,
            message: "Drone video job not found"
        });
    } catch (error) {
        console.error(`[STATUS POLL ERROR] Error checking status for [${req.params.id}]:`, error);
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
        const memList = Array.from(inMemoryJobs.values());
        if (mongoose.connection.readyState === 1) {
            const dbVideos = await DroneVideo.find().sort({ uploadDate: -1 });
            return res.status(200).json({
                success: true,
                count: dbVideos.length,
                videos: dbVideos
            });
        }
        return res.status(200).json({
            success: true,
            count: memList.length,
            videos: memList
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve videos",
            error: error.message
        });
    }
});

module.exports = router;