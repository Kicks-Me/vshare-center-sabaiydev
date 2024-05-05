import express from 'express';
import bodyParser from 'body-parser';
import { cors } from './config/corsOption.conf.js';
import { errorHandle } from './middleware/errorHandle.js';
import { logger } from './middleware/logEvent.js';
import routeAuth from './route/auth.route.js';
import routeMain from './route/index.route.js';

const app = express();
app.use(cors);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(logger);

//route
app.use('/api', routeAuth);
//Main
app.use('/api', routeMain);

app.use(errorHandle);

const APPPORT = Number(process.env.APPPORT);

app.listen(APPPORT,()=>{
    console.log(`App is running on port ${APPPORT}`);
})