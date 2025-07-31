import express from "express";
import cors from "cors";
import { userRouter } from "./router/user";
import { streamRouter } from "./router/strems";
const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/v1/auth", userRouter);
app.use("/api/v1/streams", streamRouter);
app.listen(5000, () => {
    console.log("Server is running on port 3000");
});