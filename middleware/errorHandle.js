import {logEvents} from "./logEvent.js";

export const errorHandle = (err, req, res, next) => {
    const errorMessage = err.message || 'Internal Server Error';
    const errorName = err.name || 'Error';

    logEvents(`${errorName}, ${errorMessage}, 'errorLog.log`);
    console.error(err.stack || errorMessage);

    res.status(500).send(errorMessage);
};
