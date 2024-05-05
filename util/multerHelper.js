import multer from "multer";
import path from "path";
import fs, { ensureDir } from "fs-extra";
import { execSync, exec } from "child_process";
import { fileURLToPath } from "url";
import { dbExecution } from "../config/dbContext.conf.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const __basePath = path.join("..", "upload");

export const generateStorage = (basePath) => {
  return multer.diskStorage({
      destination: (req, file, cb) => {
          const folderPath = path.join(__dirname, basePath);
          cb(null, folderPath);
      },
      filename: (req, file, cb) => {
          cb(null, file.originalname);
      }
  });
};

export const createMulterUpload = (storage) => {
  return multer({ storage: storage });
};

export const ensureDirNotExistsBlock = (p_dir) => {
  const existPath = path.join(__dirname,p_dir);
  return fs.pathExists(existPath);
}

export const getOnlyFilePath = (parentPath, fileName) => {
  return path.join(parentPath, fileName);
}

export const getfullPath = (filePath) => {
  return path.join(__dirname, filePath)
}

export const getFileName = (filePath) => {
  return path.basename(path.join(__dirname, filePath));
}

export const getMimeType = (filePath) => {
  return path.extname(filePath);
}

export const checkUserProfile = (profile)=>{
  return fs.pathExistsSync(path.join(__dirname, __basePath,profile));
}

export const makeUserProfile = (userProfile) => {
  try {
    const parentFullDir = path.join(__dirname, __basePath);
    const userRootProfile = path.join(parentFullDir, userProfile);

    if (fs.existsSync(userRootProfile)) {
      return {
        status: false,
        message: `This profile ${userProfile} is already in used.`
      };
    }

    fs.ensureDirSync(userRootProfile);

    return {
      status: true,
      message: `User profile ${userProfile} is created successfully.`
    };
  } catch (error) {
    console.error(`Error user root profile: ${error}`);
    return {
      status: false,
      message: `Error user root profile: ${error?.message}`
    };
  }
}

export const mkFolder = async (parentPath, folderName) => {
  try {
    const parentFullDir = path.join(__dirname, parentPath);
    const newChildDir = path.join(parentFullDir, folderName);

    ////The user profile must be created unless will not be able to use VSHARE
    ///In GUI need to popup to sync user profile if not any.
    if (!fs.existsSync(parentFullDir)) {
      return {
        status: false,
        message: "Not found parent directory"
      };
    }

    if (fs.existsSync(newChildDir)) {
      return {
        status: false,
        message: `Folder ${folderName} is already exists`
      };
    }

    await fs.ensureDir(newChildDir);

    return {
      status: true,
      message: path.join(parentPath, folderName)
    };
  } catch (error) {
    console.error(`Error creating folder: ${error}`);
    return {
      status: false,
      message: `Error creating folder: ${error?.message}`
    };
  }
};

export const rmDir = (pthDir) => {
  //Delete folder sometime will keep as policy but in this project delete anyway.
  try {
    const dirPath = path.join(__dirname, pthDir);

    if (!fs.pathExistsSync(dirPath)) {
      return { status: false, message: `${pthDir} does not exist` };
    }

    fs.removeSync(dirPath);

    if (fs.pathExistsSync(dirPath)) {
      return { status: false, message: `Failed to delete folder ${pthDir}` };
    }

    return { status: true, message: `Deleted folder ${pthDir} successfully` };
  } catch (error) {
    console.error("deleteDir error:", error);
    return { status: false, message: error?.message ?? error };
  }
};

export const renameDir = (oldPath, oldDirName, newDirName) => {
  try {
    if (!fs.existsSync(path.join(__dirname, oldPath))) {
      return { status: false, message: `${oldDirName} is not exists` };
    }

    if (oldDirName === newDirName) {
      return { status: false, message: 'Seem there is nothing changed' };
    }

    const newPath = path.join(
      oldPath.replace(/\//g, "\\").split("\\").slice(0, -1).join("\\"),
      newDirName
    );

    //Rename directory if error -> use copy instead
    //a bit bad code here because I stuff on some os permission EPERM -> if have more time I can handle later

    try {
      const l = fs.moveSync(
        path.join(__dirname, oldPath),
        path.join(__dirname, newPath),
        { overwrite: true, recursive: true }
      );

    } catch {
      fs.copySync(
        path.join(__dirname, oldPath),
        path.join(__dirname, newPath),
        { overwrite: true, recursive: true }
      );
    }

    console.log(`Moved contents of ${oldPath} to ${newPath}`);


    //remove old path
    if(fs.pathExistsSync(path.join(__dirname, newPath)))
    {
      if(fs.pathExistsSync(path.join(__dirname, oldPath)))
        {
          fs.rmSync(path.join(__dirname, oldPath), { recursive: true });
        }
    }

    return { status: true, message: newPath };
  } catch (error) {
    console.error(`Error moving contents: ${error}`);
    return {
      status: false,
      message: "Error on rename folder" + error?.message
    };
  }
};


export const renameFile = (oldfilePath,oldFileName, newFileName) => {
  try {
    if(!fs.pathExistsSync(path.join(__dirname, oldfilePath)))
    {
      return {
        status: false,
        message: `${oldfilePath} is not exists in the system`
      };
    }


    const directoryPath = path.dirname(oldfilePath);
    const extension = path.extname(oldfilePath);
    const newFilePath = path.join(directoryPath, `${newFileName}${extension}`);

    fs.renameSync((path.join(__dirname,oldfilePath)), (path.join(__dirname,newFilePath)));

    return {
        status: true,
        message: `Rename the file successfully from ${oldFileName} to ${newFileName}${extension}`,
        newfile: {
            newName:`${newFileName}${extension}`,
            newPath: newFilePath
        }
    };

  } catch (error) {
    console.error(`Error rename file: ${error}`);
    return {
      status: false,
      message: "Error on rename file" + error?.message.substring(0,41)+'...' ?? error
    };
  }
}

export const unlinkFile = (filePath) => {
  try {
    
    const fileFullPath = path.join(__dirname, filePath);

    if(!fs.pathExistsSync(fileFullPath))
    {
      return {
        status: false,
        message: `${path.basename(fileFullPath)} is not exists in the system`
      };
    }

    fs.unlinkSync(fileFullPath);

    return {
      status: true,
      message: `Delete file ${path.basename(fileFullPath)} successfully`
    };

  } catch (error) {
    console.error(`Error delete file: ${error}`);
    return {
      status: false,
      message: "Error on delete file" + error?.message.substring(0,41)+'...' ?? error
    };
  }
}
