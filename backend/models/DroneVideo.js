const mongoose = require("mongoose");

const droneVideoSchema = new mongoose.Schema({
    filename: {
        type: String,
        required: true
    },
    originalName: {
        type: String,
        required: true
    },
    contentType: {
        type: String,
        required: true
    },
    fileId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    status: {
        type: String,
        enum: ["UPLOADED", "PROCESSING", "COMPLETED", "FAILED"],
        default: "PROCESSING"
    },
    modelPath: {
        type: String,
        default: null
    },
    modelGlbUrl: {
        type: String,
        default: null
    },
    error: {
        type: String,
        default: null
    },
    localVideoPath: {
        type: String,
        default: null
    },
    localSrtPath: {
        type: String,
        default: null
    },
    outputDir: {
        type: String,
        default: null
    },
    progress: {
        type: Number,
        default: 0
    },
    stage: {
        type: String,
        default: "Extracting frames & telemetry"
    },
    uploadDate: {
        type: Date,
        default: Date.now
    },
    completedAt: {
        type: Date,
        default: null
    },
    totalDuration: {
        type: String,
        default: null
    },
    durationSeconds: {
        type: Number,
        default: null
    }
});

module.exports = mongoose.model("DroneVideo", droneVideoSchema);