import jwt from "jsonwebtoken";
import fs from 'fs';
import path from "path";
import { fileURLToPath } from "url";
import dotenv from 'dotenv';
import mysql from 'mysql';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToPublicKey = path.join(__dirname, '..', 'key', 'public.key');

const PUBLIC_KEY = fs.readFileSync(pathToPublicKey, 'utf8');

const pool = mysql.createPool({
    host: process.env.DBHOST,
    user: process.env.DBUSER,
    password: process.env.DBPWD,
    database: process.env.DBNAME
});

export const verifyJWT = (req, res, next) => {
    const authKey = req.headers?.authorization;

    if (!authKey || !authKey.startsWith("Bearer ")) {
        console.log('Unauthorized => ', req.headers);
        return res.status(401).json({ resultCode: 401, message: "Unauthorized" });
    }

    const token = authKey.split(" ")[1];

    jwt.verify(token, PUBLIC_KEY, {
        algorithms: "RS256",
    }, (err, decodedToken) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                console.log(`Token is expired`);
                return res.status(401).json({ resultCode: 401, message: "Session is expired" });
            } else {
                console.log(`${req.headers}\t Forbidden on JWT decode error`);
                return res.status(403).json({ resultCode: 403, message: "Forbidden" });
            }
        }
        
        const { Id, userId, userProfileId } = decodedToken;

        req.Id = Id;
        req.userId = userId;
        req.userProfileId = userProfileId

         next();
    });
};
