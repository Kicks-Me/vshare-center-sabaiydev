import { format } from "date-fns";
import fs from "fs";
import fsPromises from "fs/promises";
import path, { dirname } from 'path';
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const logEvents = async (message, logName) => {
    const stamp = `${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`
    const logDetail = `${stamp}\t${message}\n`;

    try {
        if (!fs.existsSync(path.join(__dirname, "..", "logs"))) {
            await fsPromises.mkdir(path.join(__dirname, "..", "logs"));
        }

        const logFilePath = path.join(__dirname, "..", "logs", logName);
        const maxSizeGB = 1;
        
        const stats = await fsPromises.stat(logFilePath).catch(() => null);

        if (stats && stats.size >= maxSizeGB * 1024 * 1024 * 1024) {
            let counter = 1;
            let newLogFilePath = `${logFilePath}.${counter}`;

            while (await fsPromises.stat(newLogFilePath).catch(() => null)) {
                counter++;
                newLogFilePath = `${logFilePath}.${counter}`;
            }

            await fsPromises.rename(logFilePath, newLogFilePath);
        }

        await fsPromises.appendFile(logFilePath, logDetail);
    } catch (error) {
        console.error(`${stamp}\t ==> \t${error}`);
    }
}

export const logger = (req, res, next) => {
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const msg = `Method: ${req.method}\nURL: ${req.url}\nHeaders: ${JSON.stringify(req.headers)}\n${clientIP}\nQuery Parameters: ${JSON.stringify(req.query)}\nRequest Body: ${JSON.stringify(req.body)}`;
    logEvents(msg, `reqLog.log`);
    console.log(`${req?.method}\t${req?.url}`);

    next();
}