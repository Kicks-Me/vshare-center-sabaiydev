import { MulterError } from "multer";
import fs from "fs";
import { dbExecution } from "../config/dbContext.conf.js";
import {
  generateStorage,
  createMulterUpload,
  ensureDirNotExistsBlock,
  getOnlyFilePath,
  renameFile,
  unlinkFile,
  getfullPath,
  getMimeType
} from "../util/multerHelper.js";

const getFileSize = (_byte) => {
  let fileSize;

  if (_byte >= 1024 * 1024 * 1024) {
    fileSize = `${Math.ceil(_byte / (1024 * 1024 * 1024))} GB`;
  } else if (_byte >= 1024 * 1024) {
    fileSize = `${Math.ceil(_byte / (1024 * 1024))} MB`;
  } else if (_byte >= 1024) {
    fileSize = `${Math.ceil(_byte / 1024)} KB`;
  } else {
    fileSize = `${_byte} bytes`;
  }

  return fileSize;
};

export const uploadFile = async (req, res) => {
  const { folderId } = req.params;

  if (!folderId) {
    return res
      .status(422)
      .json({ resultCode: 422, message: "Fields are not supplied." });
  }

  try {
    const folderResult = await dbExecution(
      `SELECT*FROM mfolders a WHERE a.id=? AND a.deleted_at IS NULL`,
      [folderId]
    );

    if (!folderResult || !folderResult[0]?.path) {
      return res.status(403).json({
        resultCode: 403,
        message: "The parent node is missing"
      });
    }

    if (!ensureDirNotExistsBlock(folderResult[0].path)) {
      return res.status(403).json({
        resultCode: 403,
        message: "Directory is missing on server. Please, try again."
      });
    }

    ///upload files or file
    const storage = generateStorage(folderResult[0]?.path);
    const upload = createMulterUpload(storage).array("fileNames");

    upload(req, res, async (err) => {
      if (err instanceof MulterError) {
        return res.status(500).json({
          resultCode: 500,
          message: err?.message ?? "Upload file error."
        });
      } else if (err) {
        return res.status(206).json({
          resultCode: 206,
          message: err?.message ?? "File upload failed."
        });
      }

      const fileInsertions = [];
      for (const file of req.files) {
        const filePath = getOnlyFilePath(folderResult[0]?.path, file?.filename);

        const fileInserted = await dbExecution(
          `INSERT INTO mfiles (folderId, name, fileSize, path, created_by) VALUES (?, ?, ?, ?, ?)`,
          [folderId, file?.filename, file?.size, filePath, req?.Id]
        );

        fileInsertions.push({
          fileId: fileInserted.insertId,
          fileName: file?.filename,
          filePath: filePath,
          fileSize: getFileSize(file?.size)
        });

        ///===========================================
        //if make dir in share directory. A share to B-> B upload new file. Only A should see.
        //Who is A for now? A = parent of this dir.
        const resultShare = await dbExecution(
          `SELECT m.id,m.name,m.parentKey, m.created_by,d.shared_by
          FROM share.mfolders m JOIN dshare d ON m.id = d.folderId WHERE d.folderId=? AND d.deleted_at IS NULL
          ORDER BY d.id LIMIT 1`,
          [folderId]
        );
        console.log('resultShare',resultShare)
        if (
          fileInserted.insertId &&
          resultShare[0]?.shared_by &&
          req?.Id &&
          resultShare[0].shared_by !== req?.Id
        ) {
          //B create new => A see, C not
          //C create new => A see, B not
          const resultGetShare = await dbExecution(`CALL SP_SHARE_FILES_ONE(?,?,?)`, [
            fileInserted.insertId,
            resultShare[0]?.shared_by,
            req?.Id
          ]);

          console.log('resultGetShare',resultGetShare)
        }
        ///========================
      }

      return res.status(200).json({
        resultCode: 200,
        message: "Files uploaded successfully",
        data: fileInsertions
      });
    });
  } catch (error) {
    console.log(`==>>> create file error==>>`, error?.message ?? error);
    return res
      .status(500)
      .json({ resultCode: 500, message: `Internal server error` });
  }
};

export const editFileName = async (req, res) => {
  const { fileId, newFileName } = req?.body;

  if (!fileId || !newFileName) {
    return res
      .status(422)
      .json({ resultCode: 422, message: "Fields are not supplied." });
  }

  try {
    const fileResult = await dbExecution(
      `SELECT*FROM mfiles a WHERE a.id=? AND a.deleted_at IS NULL`,
      [fileId]
    );

    if (!fileResult || !fileResult[0]?.path || !fileResult[0]?.name) {
      return res.status(403).json({
        resultCode: 403,
        message: "The file information is missing"
      });
    }

    if (fileResult[0]?.name === newFileName) {
      return res.status(403).json({
        resultCode: 403,
        message: "You have the same file name."
      });
    }

    const renameResult = renameFile(
      fileResult[0]?.path,
      fileResult[0]?.name,
      newFileName
    );

    if (
      !renameResult ||
      !renameResult?.status ||
      !renameResult?.newfile?.newPath
    ) {
      return res.status(403).json({
        resultCode: 403,
        message: renameResult?.message ?? "Can not rename the file"
      });
    }

    ////Update database
    const result = await dbExecution(
      `UPDATE mfiles SET path=?, name=? WHERE id=?`,
      [renameResult?.newfile?.newPath, renameResult?.newfile?.newName, fileId]
    );

    console.log(result);
    if (!result || result[0]?.affectedRows < 1) {
      return res.status(206).json({
        resultCode: 206,
        message: "Can not rename the file in system"
      });
    }

    return res.status(200).json({
      resultCode: 200,
      message: renameResult?.message ?? "Rename file successfully"
    });
  } catch (error) {
    console.log(`==>>> delete file error==>>`, error?.message ?? error);
    return res
      .status(500)
      .json({ resultCode: 500, message: `Internal server error` });
  }
};

export const deleteFileName = async (req, res) => {
  const { fileId } = req?.params;

  if (!fileId) {
    return res
      .status(422)
      .json({ resultCode: 422, message: "Fields are not supplied." });
  }

  try {
    const fileResult = await dbExecution(
      `SELECT*FROM mfiles a WHERE a.id=? AND a.deleted_at IS NULL`,
      [Number(fileId)]
    );

    console.log("fileResult", fileResult);
    if (!fileResult || !fileResult[0]?.path || !fileResult[0]?.name) {
      return res.status(403).json({
        resultCode: 403,
        message: `Not found file in system`
      });
    }

    const deleteResult = unlinkFile(fileResult[0]?.path);

    if (!deleteResult || !deleteResult?.status) {
      return res.status(403).json({
        resultCode: 403,
        message: deleteResult?.message ?? "Can not delete the file"
      });
    }

    ////Update database
    const result = await dbExecution(
      `UPDATE mfiles SET deleted_at = CURRENT_TIMESTAMP() WHERE id=?`,
      [fileId]
    );

    if (!result || result[0]?.affectedRows < 1) {
      return res.status(206).json({
        resultCode: 206,
        message: "Can not delete file in system"
      });
    }

    return res.status(200).json({
      resultCode: 200,
      message: deleteResult?.message ?? "Delete file successfully"
    });
  } catch (error) {
    console.log(`==>>> delete file error==>>`, error?.message ?? error);
    return res
      .status(500)
      .json({ resultCode: 500, message: `Internal server error` });
  }
};

export const downloadFile = async (req, res) => {
  try {
    if (!req.params.id) {
      return res
        .status(422)
        .json({ resultCode: 422, message: "Field is not supplied" });
    }

    //Downloader = Owner
    const getFile = await dbExecution(
      `SELECT*FROM mfiles WHERE id=? AND created_by=? AND deleted_at IS NULL`,
      [req?.params?.id, req?.Id]
    );

    console.log(getFile)
    if (!getFile || !getFile[0]?.path) {
      ////The file share from someone
      const getFile2 = await dbExecution(
        `SELECT a.id,a.name,a.path,a.created_by,a.created_at,a.updated_at,b.shared_at,b.shared_by,b.accessGuests FROM mfiles a JOIN dshare b ON  a.id = b.fileId WHERE a.id = ? AND b.accessGuests = ?`,
        [req?.params?.id, req?.Id]
      );

      if (!getFile2 || !getFile2[0]?.path) {
        return res
          .status(400)
          .json({ resultCode: 400, message: "File not found" });
      }

      if (ensureDirNotExistsBlock(getFile2[0]?.path)) {
        return res.download(getfullPath(getFile2[0]?.path));
      } else {
        res.status(404).send("File not found");
      }
    }

    // Stream the file to the response
    // const fileStream = fs.createReadStream(getfullPath(getFile[0]?.path));
    // fileStream.pipe(res);
    
    if (ensureDirNotExistsBlock(getFile[0]?.path)) {
      return res.download(getfullPath(getFile[0]?.path));
    } else {
      return res.status(404).send("File not found");
    }
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ resultCode: 500, message: "Can not download the file." });
  }
};

export const previewFile = async (req, res) => {
  try {
    if (!req.params.id) {
      return res
        .status(422)
        .json({ resultCode: 422, message: "Field is not supplied" });
    }

    //Downloader = Owner
    const getFile = await dbExecution(
      `SELECT*FROM mfiles WHERE id=? AND created_by=? AND deleted_at IS NULL`,
      [req?.params?.id, req?.Id]
    );

    if (!getFile || !getFile[0]?.path) {
      ////The file share from someone
      const getFile2 = await dbExecution(
        `SELECT a.id,a.name,a.path,a.created_by,a.created_at,a.updated_at,b.shared_at,b.shared_by,b.accessGuests FROM mfiles a JOIN dshare b ON  a.id = b.fileId WHERE a.id = ? AND b.accessGuests = ?`,
        [req?.params?.id, req?.Id]
      );

      if (!getFile2 || !getFile2[0]?.path) {
        return res
          .status(400)
          .json({ resultCode: 400, message: "File not found" });
      }

      const ext = getMimeType(getFile2[0]?.path);
      res.setHeader("Content-Type", getContentType(ext));
      return res.sendFile(getfullPath(getFile2[0]?.path));
    }

    const ext = getMimeType(getFile[0]?.path);
    res.setHeader("Content-Type", getContentType(ext));
    return res.sendFile(getfullPath(getFile[0]?.path));
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ resultCode: 500, message: "Can not preview the file." });
  }
};

const getContentType = (ext) => {
  let contentType = "application/octet-stream";

  if (ext === ".pdf") {
    contentType = "application/pdf";
  } else if (ext === ".jpg" || ext === ".jpeg") {
    contentType = "image/jpeg";
  } else if (ext === ".png") {
    contentType = "image/png";
  } else if (ext === ".txt") {
    contentType = "text/plain";
  } else if (ext === ".xls") {
    contentType = "application/vnd.ms-excel";
  } else if (ext === ".xlsx") {
    contentType =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  } else if (ext === ".ppt") {
    contentType = "application/vnd.ms-powerpoint";
  } else if (ext === ".pptx") {
    contentType =
      "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  } else if (ext === ".doc") {
    contentType = "application/msword";
  } else if (ext === ".docx") {
    contentType =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.documentn";
  }

  return contentType;
};
