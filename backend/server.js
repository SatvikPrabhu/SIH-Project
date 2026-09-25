const express=require("express");
const mongoose=require("mongoose");
const cors=require("cors");
require("dotenv").config();

const app=express();

app.use(cors());
app.use(express.json());

app.get("/",(req,res)=>{
    res.send("Backend is running");
});

const droneVideoRoutes=require("./routes/DroneVideoRoutes");

app.use("/api/drone",droneVideoRoutes);

mongoose.connect(process.env.MONGO_URI)
    .then(()=>{

        console.log("MongoDB connected");

        app.listen(5000,()=>{
            console.log("Server running on port 5000");
        });

    })
    .catch((error)=>{

        console.log("MongoDB connection error:",error);

    });