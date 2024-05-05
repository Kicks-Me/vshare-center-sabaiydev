import bcrypt from "bcrypt";
import moment from "moment";
import { customDate } from "../util/customDateFormats.js";
import { dbExecution } from "../config/dbContext.conf.js";
import { genUserId } from "../util/helper.js";
import { checkUserProfile, makeUserProfile } from "../util/multerHelper.js";
import { generateAccessToken } from "../util/jwtHelper.js";

export const createUser = (req, res) => {
  const { userName, userPassword, passwordConfirm, userEmail } = req?.body;

  if (!userName || !userPassword || !userEmail) {
    return res.status(422).json({
      resultCode: 422,
      message: "Field is not supplied"
    });
  }

  if (!passwordConfirm) {
    return res.status(422).json({
      resultCode: 422,
      message: "Confirm password is required"
    });
  }

  if (passwordConfirm !== userPassword) {
    return res.status(206).json({
      resultCode: 206,
      message: "Password not match"
    });
  }

  try {
    bcrypt?.genSalt(10, (err, salt) => {
      if (err) {
        console.log("Register failed ==> ", err);
        return res
          .status(400)
          .json({ resultCode: 400, message: `Authentication went wrong` });
      }

      bcrypt.hash(userPassword, salt, async (_err, hashCode) => {
        if (_err) {
          console.log("Password failed on hashing ==>> ", _err);
          return res
            .status(400)
            .json({ resultCode: 400, message: `Authentication went wrong` });
        }

        ///Gen Special Code
        const SPECIAL_CODE = await genUserId(9);

        //verify user information for unique
        const checkUserInfo = await dbExecution(
          `SELECT*FROM musers a WHERE userEmail = ?`,
          [userEmail]
        );

        if (checkUserInfo && checkUserInfo?.length > 0) {
          console.log("verify user ", [req?.body, checkUserInfo]);
          return res.status(400).json({
            resultCode: 400,
            message: `This email (${userEmail}) was taken.`
          });
        }

        const insertUser = await dbExecution(
          `INSERT INTO musers (userId,userName,userPassword, userEmail) VALUES(?,?,?,?)`,
          [SPECIAL_CODE, userName, hashCode, userEmail]
        );

        if (!insertUser || insertUser?.rowCount < 1) {
          console.log("Can not register user ", insertUser);
          return res
            .status(400)
            .json({ resultCode: 400, message: "Can not register user" });
        }

        //Generate userRoot Path
        if (insertUser?.insertId && insertUser?.insertId > 0) {
          makeUserProfile(SPECIAL_CODE + insertUser?.insertId);
        }

        //Login
        const users = await dbExecution(
          "SELECT a.*,b.id AS profileId,b.name AS userProfile FROM musers a JOIN mfolders b ON CONCAT(a.userId,a.id) = b.name WHERE a.userEmail=? AND a.userFlag=?",
          [userEmail, 1]
        );

        if (!users || users?.length === 0) {
          console.log(
            `=> ${
              customDate(new Date())?.formating
                ?.yyyy_dash_MM_dash_dd_space_h24_mm_ss
            }\tNo user found for`,
            req.body
          );

          ////Success but can not login automatically
          return res
            .status(201)
            .json({ resultCode: 201, message: "Register user successfully!" });
        }

        for (const user of users) {
          if (
            user.userEmail === userEmail &&
            bcrypt.compareSync(userPassword, user.userPassword)
          ) {
            const accessToken = generateAccessToken({
              Id: user.id,
              userId: user.userId,
              userName: user.userName,
              userEmail: user.userEmail,
              Status: user.userFlag === 1 ? "Active" : "Inactive",
              tokenDate: moment(new Date()).format(`DD/MM/YYYY HH:mm:ss`)
            });

            return res.status(200).json({
              resultCode: 200,
              message: "Register successfully!",
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
      });
    });
  } catch (error) {
    console.error("==>> ", error);
    return res.status(500).send("Internal Server Error");
  }
};

export const generateUserProfile = async (req, res) => {
  if (!req?.userId || !req?.Id) {
    return res.status(403).json({
      resultCode: 403,
      message: `Sorry, you lost your information. Contact your administrator`
    });
  }

  try {
    const checkProfile = await dbExecution("CALL SP_CHECK_USER_PROFILE(?, ?)", [
      req?.Id,
      req?.userId
    ]);

    if (!checkProfile || checkProfile?.length === 0) {
      console.log(
        `=> ${
          customDate(new Date())?.formating
            ?.yyyy_dash_MM_dash_dd_space_h24_mm_ss
        }\tNo user found for`,
        req.body
      );

      return res.status(403).json({
        resultCode: 403,
        message: `Can not sync profile because user information is missing.`
      });
    }

    const profile = makeUserProfile(req?.userId + req?.Id);

    if (profile && profile?.status) {
      return res.status(200).json({
        resultCode: 200,
        message: profile?.message ?? `Your profile is created`
      });
    } else {
      return res.status(403).json({
        resultCode: 403,
        message: profile?.message ?? `Sorry, can not create user profile. Contact your administrator`
      });
    }
  } catch (error) {
    console.log("Error on make user profile ===> ", error?.message ?? error);
    return res.status(500).json({
      resultCode: 500,
      message: `Can not create user profile. Contact your administrator`
    });
  }
};
