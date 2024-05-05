import Router from "express";
import { Login } from "../controller/auth.controller.js";
import {
  createUser,
  generateUserProfile
} from "../controller/user.controller.js";
import { verifyJWT } from "../middleware/jwt.js";

const route = Router();

route.post("/login", Login);
route.post("/register", createUser);
route.get("/sync-profile", verifyJWT, generateUserProfile);

export default route;
