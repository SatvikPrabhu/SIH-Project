const mongoose=require("mongoose");

const droneVideoSchema=new mongoose.Schema({
    filename:{
        type:String,
        required:true
    },

    originalName:{
        type:String,
        required:true
    },

    contentType:{
        type:String,
        required:true
    },

    fileId:{
        type:mongoose.Schema.Types.ObjectId,
        required:true
    },

    uploadDate:{
        type:Date,
        default:Date.now
    }
});

module.exports=mongoose.model("DroneVideo",droneVideoSchema);