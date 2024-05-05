import moment from "moment"
import { dbExecution } from "../config/dbContext.conf.js";

export const genUserId = async(length = 10) => {
    let SPECIAL_CODE = moment(new Date()).format('yyhhmmss');
    try {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

        let result = '';
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }

        if(!result)
        {
            SPECIAL_CODE = result;
        }

        const verify = await dbExecution(
            `SELECT*FROM musers WHERE userId = ?`,
            [SPECIAL_CODE]
        );


        if(verify && verify?.length > 0)
        {
            for(const child of verify)
            {
                if(child?.userId === SPECIAL_CODE)
                {
                    genUserId(length + 1);
                }
            }
        }


    } catch (error) {
        
    }

    return `VSHARE${SPECIAL_CODE}`;
}