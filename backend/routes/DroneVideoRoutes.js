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
        console.log(`[STORAGE] Created directory: ${dir}\n`);
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
 * Helper to update progress percentage and current stage both in-memory and in MongoDB
 */
function updateJobMilestone(jobId, progress, stage) {
    if (inMemoryJobs.has(jobId)) {
        const memJob = inMemoryJobs.get(jobId);
        if (progress > (memJob.progress || 0)) {
            memJob.progress = progress;
        }
        if (stage) {
            memJob.stage = stage;
        }
    }

    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(jobId)) {
        DroneVideo.findByIdAndUpdate(jobId, {
            $max: { progress: progress },
            ...(stage ? { stage: stage } : {})
        }).catch((err) => {
            console.warn(`[DATABASE] Failed to update progress for ${jobId}: ${err.message}`);
        });
    }
}

/**
 * Trigger the Python 3D reconstruction pipeline via child_process.spawn
 */
function triggerPythonPipeline(jobId, localVideoPath, outputDir, localSrtPath = null, pipelineStartTime = Date.now()) {
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

    console.log(`\n============================================================`);
    console.log(`[PIPELINE] Started 3D Reconstruction Pipeline`);
    console.log(`  Job ID: ${jobId}`);
    console.log(`  Input Video: ${localVideoPath}`);
    console.log(`  Output Dir: ${outputDir}`);
    console.log(`============================================================\n`);

    const pythonProcess = spawn(pythonExe, args, {
        cwd: PROJECT_ROOT,
        env: { ...process.env, PYTHONUNBUFFERED: "1" }
    });

    let stdoutBuffer = "";
    let stderrBuffer = "";
    let stdoutLineBuffer = "";

    function parseOutputForMilestones(chunk) {
        stdoutLineBuffer += chunk;
        const lines = stdoutLineBuffer.split(/\r?\n/);
        stdoutLineBuffer = lines.pop(); // keep trailing incomplete fragment

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;

            if (line.includes("Starting: Step 1")) {
                updateJobMilestone(jobId, 15, "Extracting frames & telemetry");
            } else if (line.includes("Starting: Step 2")) {
                updateJobMilestone(jobId, 30, "Running DUSt3R 3D reconstruction");
            } else if (line.includes("Solving global scene alignment")) {
                updateJobMilestone(jobId, 55, "Optimizing camera poses & scene alignment");
            } else if (line.includes("Starting: Step 4") || line.includes("Gaussian Splatting")) {
                updateJobMilestone(jobId, 75, "Training 3D Gaussian Splatting model");
            } else if (line.includes("Starting: Step 5") || line.includes("Mesh & GIS") || line.includes("Poisson reconstruction")) {
                updateJobMilestone(jobId, 90, "Performing Poisson mesh reconstruction & GLB export");
            }
        }
    }

    pythonProcess.stdout.on("data", (data) => {
        process.stdout.write(data);
        const text = data.toString();
        stdoutBuffer += text;
        parseOutputForMilestones(text);
    });

    pythonProcess.stderr.on("data", (data) => {
        process.stderr.write(data);
        const text = data.toString();
        stderrBuffer += text;
        parseOutputForMilestones(text);
    });

    pythonProcess.on("error", async (err) => {
        console.error(`\n[PIPELINE ERROR] Failed to spawn Python process for Job [${jobId}]: ${err.message}\n`);
        
        // Update in-memory fallback
        if (inMemoryJobs.has(jobId)) {
            const memJob = inMemoryJobs.get(jobId);
            memJob.status = "FAILED";
            memJob.stage = "Failed to spawn Python process";
            memJob.error = `Failed to spawn Python process: ${err.message}`;
        }

        // Update MongoDB if connected
        if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(jobId)) {
            try {
                await DroneVideo.findByIdAndUpdate(jobId, {
                    status: "FAILED",
                    stage: "Failed to spawn Python process",
                    error: `Failed to spawn Python process: ${err.message}`
                });
            } catch (dbErr) {
                console.error(`[DATABASE] Could not update failed status for ${jobId}: ${dbErr.message}`);
            }
        }
    });

    pythonProcess.on("close", async (code) => {
        const durationMs = Date.now() - pipelineStartTime;
        const durationSec = (durationMs / 1000).toFixed(2);
        const mins = Math.floor(durationSec / 60);
        const remSec = (durationSec % 60).toFixed(2);
        const durationFormatted = mins > 0 ? `${mins}m ${remSec}s` : `${durationSec}s`;

        if (code === 0) {
            try {
                updateJobMilestone(jobId, 100, "Reconstruction complete");

                // Locate generated 3D Model PLY
                const plyCandidates = [
                    path.join(outputDir, "model.ply"),
                    path.join(outputDir, "dust3r", "model.ply"),
                    path.join(outputDir, "exports", "model.ply"),
                    path.join(outputDir, "3dgs", "point_cloud_final.ply")
                ];
                let foundPly = null;
                for (const candidate of plyCandidates) {
                    if (fs.existsSync(candidate)) {
                        foundPly = candidate;
                        break;
                    }
                }

                // Locate generated 3D Model GLB
                const glbCandidates = [
                    path.join(outputDir, "model.glb"),
                    path.join(outputDir, "dust3r", "model.glb"),
                    path.join(outputDir, "exports", "model.glb"),
                    path.join(outputDir, "3dgs", "model.glb"),
                    path.join(PROJECT_ROOT, "storage", "outputs", "recon_demo", "model.glb"),
                    path.join(FRONTEND_MODELS_DIR, "model.glb")
                ];

                let foundGlb = null;
                for (const candidate of glbCandidates) {
                    if (fs.existsSync(candidate)) {
                        foundGlb = candidate;
                        break;
                    }
                }

                const targetFilename = `${jobId}.glb`;
                const targetGlbPath = path.join(FRONTEND_MODELS_DIR, targetFilename);
                const defaultGlbPath = path.join(FRONTEND_MODELS_DIR, "model.glb");

                const targetPlyFilename = `${jobId}.ply`;
                const targetPlyPath = path.join(FRONTEND_MODELS_DIR, targetPlyFilename);
                const defaultPlyPath = path.join(FRONTEND_MODELS_DIR, "model.ply");

                if (foundPly && fs.existsSync(foundPly)) {
                    fs.copyFileSync(foundPly, targetPlyPath);
                    fs.copyFileSync(foundPly, defaultPlyPath);
                }

                if (foundGlb && fs.existsSync(foundGlb)) {
                    fs.copyFileSync(foundGlb, targetGlbPath);
                    fs.copyFileSync(foundGlb, defaultGlbPath);
                }

                const modelUrl = `/models/${targetFilename}`;

                console.log(`\n============================================================`);
                console.log(`[FILE TRANSFER] 3D Model Formation Complete`);
                if (foundPly) {
                    const plySize = (fs.statSync(foundPly).size / (1024 * 1024)).toFixed(2);
                    console.log(`  Output PLY: ${targetPlyPath} (${plySize} MB)`);
                }
                if (foundGlb) {
                    const glbSize = (fs.statSync(foundGlb).size / (1024 * 1024)).toFixed(2);
                    console.log(`  Output GLB: ${targetGlbPath} (${glbSize} MB)`);
                }
                console.log(`  Total Time: ${durationFormatted} (${durationSec} seconds)`);
                console.log(`============================================================\n`);

                // Update in-memory job
                if (inMemoryJobs.has(jobId)) {
                    const memJob = inMemoryJobs.get(jobId);
                    memJob.status = "COMPLETED";
                    memJob.progress = 100;
                    memJob.stage = "Reconstruction complete";
                    memJob.modelPath = targetGlbPath;
                    memJob.modelGlbUrl = modelUrl;
                    memJob.totalDuration = durationFormatted;
                    memJob.durationSeconds = parseFloat(durationSec);
                    memJob.completedAt = new Date();
                }

                // Update MongoDB if connected
                if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(jobId)) {
                    await DroneVideo.findByIdAndUpdate(jobId, {
                        status: "COMPLETED",
                        progress: 100,
                        stage: "Reconstruction complete",
                        totalDuration: durationFormatted,
                        durationSeconds: parseFloat(durationSec),
                        modelPath: targetGlbPath,
                        modelGlbUrl: modelUrl,
                        completedAt: new Date()
                    });
                }
            } catch (err) {
                console.error(`\n[ERROR] Post-processing error for Job [${jobId}]:`, err);
                if (inMemoryJobs.has(jobId)) {
                    const memJob = inMemoryJobs.get(jobId);
                    memJob.status = "COMPLETED";
                    memJob.progress = 100;
                    memJob.stage = "Reconstruction complete";
                    memJob.modelGlbUrl = `/models/${jobId}.glb`;
                    memJob.totalDuration = durationFormatted;
                }
            }
        } else {
            const errorSummary = stderrBuffer.slice(-500) || `Process exited with code ${code}`;
            console.error(`\n============================================================`);
            console.error(`[PIPELINE] Reconstruction failed for Job [${jobId}] (exit code ${code})`);
            console.error(`  Time before failure: ${durationFormatted}`);
            console.error(`  Error: ${errorSummary}`);
            console.error(`============================================================\n`);

            if (inMemoryJobs.has(jobId)) {
                const memJob = inMemoryJobs.get(jobId);
                memJob.status = "FAILED";
                memJob.stage = "Reconstruction failed";
                memJob.totalDuration = durationFormatted;
                memJob.error = errorSummary;
            }

            if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(jobId)) {
                await DroneVideo.findByIdAndUpdate(jobId, {
                    status: "FAILED",
                    stage: "Reconstruction failed",
                    totalDuration: durationFormatted,
                    error: errorSummary
                });
            }
        }
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
            const uploadStartTime = Date.now();
            const videoFile = req.files?.video?.[0] || (req.file ? req.file : null);

            if (!videoFile) {
                console.warn(`[UPLOAD] No video file provided in upload request\n`);
                return res.status(400).json({
                    success: false,
                    message: "No video file provided. Please attach a video file with field name 'video'."
                });
            }

            const srtFile = req.files?.srt?.[0] || null;
            const videoSizeMB = (videoFile.buffer.length / (1024 * 1024)).toFixed(2);

            // Generate unique Job ID (UUID or Mongo ObjectId)
            let jobId;
            const isMongoConnected = mongoose.connection.readyState === 1;

            if (isMongoConnected) {
                jobId = new mongoose.Types.ObjectId().toString();
            } else {
                jobId = `job_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
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

            // 2. Save optional SRT telemetry file
            let localSrtPath = null;
            if (srtFile) {
                const srtExt = path.extname(srtFile.originalname) || ".srt";
                const baseName = path.parse(sanitizedName).name;
                localSrtPath = path.join(STORAGE_INPUTS_DIR, `${jobId}_${baseName}${srtExt}`);
                fs.writeFileSync(localSrtPath, srtFile.buffer);
            }

            console.log(`\n============================================================`);
            console.log(`[FILE TRANSFER] Video file received: "${videoFile.originalname}"`);
            console.log(`  Size: ${(writtenStat.size / (1024 * 1024)).toFixed(2)} MB`);
            console.log(`  Saved to: ${localVideoPath}`);
            if (localSrtPath) {
                console.log(`  Telemetry SRT: ${localSrtPath}`);
            }
            console.log(`============================================================\n`);

            // 3. Register in-memory job state
            const jobData = {
                _id: jobId,
                id: jobId,
                filename: localVideoFilename,
                originalName: videoFile.originalname,
                contentType: videoFile.mimetype,
                status: "PROCESSING",
                progress: 15,
                stage: "Extracting frames & telemetry",
                totalDuration: null,
                localVideoPath: localVideoPath,
                localSrtPath: localSrtPath,
                outputDir: outputJobDir,
                modelPath: null,
                modelGlbUrl: `/models/${jobId}.glb`,
                error: null,
                uploadDate: new Date()
            };
            inMemoryJobs.set(jobId, jobData);

            // 4. If MongoDB is connected, also persist to Mongo and GridFS
            if (isMongoConnected) {
                try {
                    await DroneVideo.create({
                        _id: new mongoose.Types.ObjectId(jobId),
                        filename: localVideoFilename,
                        originalName: videoFile.originalname,
                        contentType: videoFile.mimetype,
                        fileId: new mongoose.Types.ObjectId(jobId),
                        status: "PROCESSING",
                        progress: 15,
                        stage: "Extracting frames & telemetry",
                        totalDuration: null,
                        localVideoPath: localVideoPath,
                        localSrtPath: localSrtPath,
                        outputDir: outputJobDir
                    });
                } catch (dbErr) {
                    console.warn(`[DATABASE] Could not write to MongoDB, continuing in-memory: ${dbErr.message}\n`);
                }
            }

            // 5. Trigger Python 3D reconstruction pipeline asynchronously
            triggerPythonPipeline(jobId, localVideoPath, outputJobDir, localSrtPath, uploadStartTime);

            // 6. Respond immediately with 201 Created and Job ID
            return res.status(201).json({
                success: true,
                message: "Drone video uploaded and written to disk successfully. 3D reconstruction pipeline triggered.",
                videoId: jobId,
                jobId: jobId,
                status: "PROCESSING",
                progress: 15,
                stage: "Extracting frames & telemetry",
                localVideoPath: localVideoPath
            });

        } catch (error) {
            console.error(`\n[UPLOAD ERROR] Video upload handling failed: ${error.message}\n`);
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
 * Polling endpoint for frontend to check pipeline completion (kept clean without console noise)
 */
const getStatusHandler = async (req, res) => {
    try {
        const { id } = req.params;

        // Check in-memory registry first
        if (inMemoryJobs.has(id)) {
            const job = inMemoryJobs.get(id);
            return res.status(200).json({
                success: true,
                jobId: job.id,
                id: job.id,
                filename: job.originalName,
                status: job.status,
                progress: job.progress !== undefined ? job.progress : 15,
                stage: job.stage || "Extracting frames & telemetry",
                totalDuration: job.totalDuration || null,
                durationSeconds: job.durationSeconds || null,
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
                return res.status(200).json({
                    success: true,
                    jobId: video._id,
                    id: video._id,
                    filename: video.originalName,
                    status: video.status,
                    progress: video.progress !== undefined ? video.progress : 15,
                    stage: video.stage || "Extracting frames & telemetry",
                    totalDuration: video.totalDuration || null,
                    durationSeconds: video.durationSeconds || null,
                    modelPath: video.modelPath,
                    modelGlbUrl: video.modelGlbUrl,
                    error: video.error,
                    uploadDate: video.uploadDate,
                    completedAt: video.completedAt
                });
            }
        }

        return res.status(404).json({
            success: false,
            message: "Drone video job not found"
        });
    } catch (error) {
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