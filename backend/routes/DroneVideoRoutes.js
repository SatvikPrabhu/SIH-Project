const express=require("express");
const mongoose=require("mongoose");
const multer=require("multer");

const DroneVideo=require("../models/DroneVideo");

const router=express.Router();

const upload=multer({
    storage:multer.memoryStorage()
});

router.post("/upload",upload.single("video"),async(req,res)=>{

    try{

        if(!req.file){
            return res.status(400).json({
                message:"No video uploaded"
            });
        }

        // Create GridFS bucket from the active MongoDB connection
        const bucket=new mongoose.mongo.GridFSBucket(
            mongoose.connection.db,
            {
                bucketName:"videos"
            }
        );

        console.log("Video received:",req.file.originalname);

        const uploadStream=bucket.openUploadStream(
            req.file.originalname,
            {
                contentType:req.file.mimetype
            }
        );

        uploadStream.end(req.file.buffer);

        uploadStream.on("finish",async()=>{

            try{

                const video=await DroneVideo.create({
                    filename:uploadStream.filename,
                    originalName:req.file.originalname,
                    contentType:req.file.mimetype,
                    fileId:uploadStream.id
                });

                console.log("Video saved to MongoDB");

                res.status(201).json({
                    message:"Drone video uploaded successfully",
                    video:video
                });

            }
            catch(error){

                console.error("Schema save error:",error);

                res.status(500).json({
                    message:"Video information could not be saved"
                });

            }

        });

        uploadStream.on("error",(error)=>{

            console.error("GridFS error:",error);

            res.status(500).json({
                message:"Video could not be saved to GridFS"
            });

        });

    }
    catch(error){

        console.error("Upload error:",error);

        res.status(500).json({
            message:"Video upload failed"
        });

    }

});

module.exports=router;