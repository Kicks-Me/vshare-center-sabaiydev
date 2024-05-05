import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pathToPrivateKey = path.join(__dirname, '..', 'key', 'private.key');
const PRIVATE_KEY = fs.readFileSync(pathToPrivateKey, 'utf8');

export const generateAccessToken = (payload) => {
    //for this test case I don't manage expire time
    const accessOptions = {
        expiresIn: process.env.JWT_EXPIRY_ACCESS,
        algorithm: 'RS256',
    };

    return jwt.sign(payload, PRIVATE_KEY, accessOptions);
};
