import bcrypt from "bcrypt";
import moment from "moment";
import { generateAccessToken } from "../util/jwtHelper.js";
import { dbExecution } from "../config/dbContext.conf.js";
import { customDate } from "../util/customDateFormats.js";
import {checkUserProfile} from '../util/multerHelper.js';

export const Login = async (req, res) => {
  const { userEmail, Password } = req.body;

  try {
    const users = await dbExecution(
      "SELECT a.*,b.id AS profileId, b.name AS userProfile FROM musers a JOIN mfolders b ON CONCAT(a.userId,a.id) = b.name WHERE a.userEmail=? AND a.userFlag=?",
      [userEmail, 1]
    );

    if (!users || users.length === 0) {
      console.log(
        `=> ${
          customDate(new Date())?.formating
            ?.yyyy_dash_MM_dash_dd_space_h24_mm_ss
        }\tNo user found for`,
        req.body
      );

      return res
        .status(200)
        .json({ resultCode: 404, message: "No user found" });
    }

    for (const user of users) {
      if (
        user.userEmail === userEmail &&
        bcrypt.compareSync(Password, user.userPassword)
      ) {
        const accessToken = generateAccessToken({
          Id: user.id,
          userId: user.userId,
          userName: user.userName,
          userEmail: userEmail,
          userProfileId: user.profileId,
          Status: user.userFlag === 1 ? "Active" : "Inactive",
          tokenDate: moment(new Date()).format(`DD/MM/YYYY HH:mm:ss`)
        });

        return res.status(200).json({
          resultCode: 200,
          message: "Login successfully!",
          accessToken: accessToken,
          detail: {
            Id: user.id,
            userId: user.userId,
            userName: user.userName,
            userEmail: user.userEmail,
            userProfileId: checkUserProfile(user.userProfile) ? user.profileId : null,
            userProfile: checkUserProfile(user.userProfile) ? user.userProfile : null,
            Status: user.userFlag === 1 ? "Active" : "Inactive",
            Created_at: user.created_at,
            Updated_at: user.updated_at,
            Deleted_at: user.deleted_at
          }
        });
      }
    }

    return res.status(206).json({
      resultCode: 404,
      message: "Username or password is incorrect"
    });
  } catch (error) {
    console.error("==>> ", error);
    return res.status(500).send("Internal Server Error");
  }
};
