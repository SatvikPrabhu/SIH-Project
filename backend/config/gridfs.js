const mongoose=require("mongoose");

let gridfsBucket;

const initializeGridFS=()=>{
    gridfsBucket=new mongoose.mongo.GridFSBucket(
        mongoose.connection.db,
        {
            bucketName:"videos"
        }
    );

    console.log("GridFS initialized");
};

const getGridFSBucket=()=>{
    return gridfsBucket;
};

module.exports={
    initializeGridFS,
    getGridFSBucket
};