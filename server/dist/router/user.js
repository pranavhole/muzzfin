"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRouter = void 0;
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const zod_1 = __importDefault(require("zod"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
const userSchema = zod_1.default.object({
    email: zod_1.default.string().email(),
    name: zod_1.default.string().optional(),
    image: zod_1.default.string().url().optional(),
    id: zod_1.default.string().optional(),
});
const JWT_SECRET = 'hello';
router.route("/").post((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(req);
    const result = userSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ error: "Invalid request data", details: result.error.errors });
        return;
    }
    const { email, name, image } = result.data;
    try {
        const user = yield prisma.user.upsert({
            where: { email },
            create: {
                email,
                image: image || '',
                name: name || ''
            },
            update: {
                image: image || '',
                name: name || ''
            }
        });
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email }, JWT_SECRET, {
            expiresIn: "7d",
        });
        console.log(token);
        res.status(200).json({
            message: user ? "Signed in" : "Signed up",
            user,
            token,
        });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create/update user" });
    }
}));
router.route("/").get((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password } = req.body;
}));
exports.userRouter = router;
