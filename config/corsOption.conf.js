import corsMiddleware from 'cors';
import { whiteOrigins } from "./allowOrigin.conf.js"

const corsOptions = {
    origin: (origin, callback) => 
    {
        if(whiteOrigins.indexOf(String(origin)) !== -1 || !origin)
        {
            callback(null, true);
        }
        else
        {
            callback(new Error('No origin allowed by CORS'));
        }
    },

    credentials: true,
}

export const cors = corsMiddleware(corsOptions);