"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const user_1 = require("./router/user");
const strems_1 = require("./router/strems");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use("/api/v1/auth", user_1.userRouter);
app.use("/api/v1/streams", strems_1.streamRouter);
app.listen(5000, () => {
    console.log("Server is running on port 3000");
});
