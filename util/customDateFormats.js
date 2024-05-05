import moment from "moment";

export const customDate = (date) => {
    return { 
        formating: {
            ddMMyyyy: moment(date).format(`DDMMYYYY`),
            dd_slash_MM_slash_yyyy: moment(date).format(`DD/MM/YYYY`),
            dd_slash_MM_slash_yyyy_space_H24_colon_Mi_colon_sec: moment(date).format(`DD/MM/YYYY HH:mm:ss`),
            yyyyMMdd: moment(date).format(`YYYYMMDD`),
            yyyyMMddHHmmss: moment(date).format(`YYYYMMDDHHmmss`),
            yyyy_dash_MM_dash_dd: moment(date).format(`YYYY-MM-DD`),
            yyyy_dash_MM_dash_dd_space_h24_mm_ss: moment(date).format(`YYYYMMDD HH:mm:ss`)
        }
    }
}