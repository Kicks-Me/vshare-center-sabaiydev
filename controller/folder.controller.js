import { dbExecution } from "../config/dbContext.conf.js";
import { rmDir, mkFolder, renameDir } from "../util/multerHelper.js";
import path from "path";

export const createFolder = async (req, res) => {
  if (!req?.body.parentKey || !req?.body?.folderName) {
    return res.status(422).json({
      resultCode: 422,
      message: "Field is not supplied"
    });
  }

  try {
    ///check parent dir
    const parentInfo = await dbExecution(
      "SELECT*FROM mfolders a WHERE a.id=? AND a.deleted_at IS NULL",
      [req?.body?.parentKey]
    );

    if (
      !parentInfo ||
      !parentInfo[0]?.name ||
      !parentInfo[0]?.path ||
      parentInfo?.length < 1
    ) {
      return res.status(404).json({
        resultCode: 404,
        message: "Folder is not exists!"
      });
    }

    //mkDir
    const filePath = await mkFolder(parentInfo[0]?.path, req?.body?.folderName);

    if (!filePath || !filePath.status) {
      return res.status(403).json({
        resultCode: 403,
        message: filePath.message || "Something went wrong"
      });
    }

    //Record new dir into db
    const users = await dbExecution(
      "INSERT INTO mfolders (name, path, created_by, parentKey) VALUES (?, ?, ?, ?)",
      [req?.body?.folderName, filePath.message, req?.Id, req?.body?.parentKey]
    );

    if (!users || users[0]?.affectedRows < 1) {
      return res.status(403).json({
        resultCode: 403,
        message: "Something error on creating folding"
      });
    }

    //if make dir in share directory. A share to B-> B upload new file. Only A should see.
    //Who is A for now? A = parent of this dir.
    const resultShare = await dbExecution(
      `SELECT m.id,m.name,m.parentKey, m.created_by,d.shared_by
      FROM share.mfolders m JOIN dshare d ON m.id = d.folderId WHERE d.folderId=? AND d.deleted_at IS NULL
      ORDER BY d.id LIMIT 1`,
      [req?.body?.parentKey]
    );

    if(users?.insertId && resultShare[0]?.shared_by && req?.Id && resultShare[0].shared_by !== req?.Id)
    {
      //B create new => A see, C not
      //C create new => A see, B not
      await dbExecution(
        `CALL SP_SHARE_FOLDER_ONE(?,?,?)`,
        [users?.insertId, resultShare[0]?.shared_by, req?.Id]
      );
    }

    return res.status(201).json({
      resultCode: 201,
      message: "Create folder successfully!"
    });
  } catch (error) {
    console.error("==>> ", error);
    return res.status(500).send("Internal Server Error");
  }
};

export const renameFolder = async (req, res) => {
  if ((!req?.body?.folderId, !req?.body?.folderNewName)) {
    return res.status(422).json({
      resultCode: 422,
      message: "Field is not supplied"
    });
  }

  try {
    const resultFetch = await dbExecution(
      "SELECT*FROM mfolders WHERE id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1",
      [req?.body?.folderId]
    );

    if (
      !resultFetch ||
      !resultFetch[0]?.name ||
      !resultFetch[0]?.path ||
      resultFetch?.length < 1
    ) {
      return res.status(404).json({
        resultCode: 404,
        message: "Folder is not exists!"
      });
    }

    // const renameDirResult = moveDirContents (
    //   resultFetch[0]?.path,
    //   resultFetch[0]?.name,
    //   req?.body?.folderNewName
    // );

    //Change info on server
    const renameDirResult = renameDir(
      resultFetch[0]?.path,
      resultFetch[0]?.name,
      req?.body?.folderNewName
    );

    if (!renameDirResult || !renameDirResult?.status) {
      return res.status(403).json({
        resultCode: 403,
        message: renameDirResult?.message || "Something went wrong"
      });
    }

    //Change info on db
    const resultRenameInDB = await dbExecution(
      `UPDATE mfolders SET name=?, path=? WHERE id=? AND deleted_at IS NULL`,
      [req?.body?.folderNewName, renameDirResult?.message, req?.body?.folderId]
    );

    if (!resultRenameInDB || resultRenameInDB[0]?.affectedRows < 1) {
      return res.status(403).json({
        resultCode: 403,
        message: "Can not rename the folder in db."
      });
    }

    //If has subfolders & files
    await hasSubfolders(
      req?.body?.folderId,
      resultFetch[0]?.path,
      renameDirResult?.message
    );

    return res.status(200).json({
      resultCode: 200,
      message: "Rename folder successfully!"
    });
  } catch (error) {
    console.error("==>> ", error);
    return res.status(500).send("Internal Server Error");
  }
};

const hasSubfolders = async (parendId, oldParentPath, newParentPath) => {
  try {
    const resultFetch = await dbExecution(
      `WITH RECURSIVE FolderHierarchy AS (
          SELECT id, name, path, parentkey
          FROM mfolders
          WHERE id = ? AND deleted_at IS NULL
          UNION
          SELECT mf.id, mf.name, mf.path, mf.parentkey
          FROM mfolders mf
          JOIN FolderHierarchy fh ON mf.parentkey = fh.id WHERE mf.deleted_at IS NULL
      )
      SELECT * FROM FolderHierarchy a  where a.id != ?`,
      [parendId, parendId]
    );

    if (!resultFetch || resultFetch.length < 1) {
      await RenamePathAllFiles(parendId, oldParentPath, newParentPath);

      return false;
    }

    const oldPath = oldParentPath.replace(/\//g, "\\").split("\\");
    const newPath = newParentPath.replace(/\//g, "\\").split("\\");

    for (const children of resultFetch) {
      const child = path.join(
        newPath.join("\\"),
        ...children?.path.replace(/\//g, "\\").split("\\").slice(oldPath.length)
      );

      await dbExecution(`UPDATE mfolders SET path=? WHERE id=?`, [
        child,
        children.id
      ]);

      //Rename path all file
      await RenamePathAllFiles(children?.id, oldParentPath, newParentPath);
    }

    await RenamePathAllFiles(parendId, oldParentPath, newParentPath);

    return true;
  } catch (error) {
    console.error("==>> ", error);
    return false;
  }
};

export const deleteFolder = async (req, res) => {
  const { id } = req?.params;

  if (!id) {
    return res.status(422).json({
      resultCode: 422,
      message: "Folder Id is missing. Please, provide your folder id."
    });
  }

  try {
    const resultFetch = await dbExecution(
      "SELECT*FROM mfolders WHERE id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1",
      [id]
    );

    if (!resultFetch || !resultFetch[0]?.name || resultFetch?.length < 1) {
      return res.status(404).json({
        resultCode: 404,
        message: "Folder is not exists!"
      });
    }

    //delete dir including all children in server upon policy
    const filePath = rmDir(resultFetch[0]?.path);

    if (!filePath || !filePath?.status) {
      return res.status(403).json({
        resultCode: 403,
        message: filePath?.message || "Something went wrong on removing dir"
      });
    }

    ///Delete in database is a must
    const resultInDB = await dbExecution(
      `UPDATE mfolders SET deleted_at = CURRENT_TIMESTAMP() WHERE id=? AND deleted_at IS NULL`,
      [id]
    );

    if (!resultInDB || resultInDB[0]?.affectedRows < 1) {
      return res.status(403).json({
        resultCode: 403,
        message: "Can not delete the folder in db."
      });
    }

    //delete sub dir only in db
    await hasChildren(id);

    return res.status(200).json({
      resultCode: 200,
      message: "Delete folder successfully!"
    });
  } catch (error) {
    console.error("==>> ", error);
    return res.status(500).send("Internal Server Error");
  }
};

const hasChildren = async (parendId) => {
  try {
    const resultFetch = await dbExecution(
      `WITH RECURSIVE FolderHierarchy AS (
          SELECT id, name, path, parentkey,deleted_at
          FROM mfolders
          WHERE id = ? AND deleted_at IS NULL
          UNION
          SELECT mf.id, mf.name, mf.path, mf.parentkey,mf.deleted_at
          FROM mfolders mf
          JOIN FolderHierarchy fh ON mf.parentkey = fh.id WHERE mf.deleted_at IS NULL
      )
      SELECT * FROM FolderHierarchy a  where a.id != ?`,
      [parendId, parendId]
    );

    if (!resultFetch || resultFetch.length < 1) {
      return false;
    }

    for (const children of resultFetch) {
      await deleteChildren(children?.id);
    }

    return true;
  } catch (error) {
    console.error("==>> ", error);
    return false;
  }
};

const deleteChildren = async (id) => {
  try {
    const resultInDB = await dbExecution(
      `UPDATE mfolders SET deleted_at =CURRENT_TIMESTAMP() WHERE id=?`,
      [id]
    );

    if (!resultInDB || resultInDB[0]?.affectedRows < 1) {
      return false;
    }

    await deleteAllFiles(id);

    return true;
  } catch (error) {
    return false;
  }
};

const deleteAllFiles = async (dirId) => {
  //Remove files under directory base on policy
  //delete mfiles where dirID= dirId
  try {
    const result = await dbExecution(
      `UPDATE mfiles SET deleted_at = CURRENT_TIMESTAMP() WHERE folderId=?`,
      [dirId]
    );

    if (!result) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
};
const RenamePathAllFiles = async (dirId, oldParentPath, newParentPath) => {
  //Change path for all files under directory
  try {
    const listFiles = await dbExecution(
      `SELECT*FROM mfiles a WHERE a.folderID=? AND a.deleted_at IS NULL`,
      [dirId]
    );

    if (!listFiles || listFiles?.length < 1) {
      return false;
    }

    const oldPath = oldParentPath.replace(/\//g, "\\").split("\\");
    const newPath = newParentPath.replace(/\//g, "\\").split("\\");

    for (const children of listFiles) {
      const child = path.join(
        newPath.join("\\"),
        ...children?.path.replace(/\//g, "\\").split("\\").slice(oldPath.length)
      );

      await dbExecution(`UPDATE mfiles SET path=? WHERE id=?`, [
        child,
        children.id
      ]);
    }

    return true;
  } catch (error) {
    console.error("==>> ", error);
    return false;
  }
};

export const getMyFiles_Folders = async (req, res) => {
  const { parentId } = req?.params;

  if (!parentId) {
    return res.status(422).json({
      resultCode: 422,
      message: "Folder Id is missing. Please, provide the folder id."
    });
  }

  try {
    const result = await dbExecution(`CALL SP_GET_MY_FILES_FOLDERS(?,?)`, [
      parentId,
      req?.Id
    ]);

    if (!result || result[0]?.length < 1) {

      return res
        .status(403)
        .json({ resultCode: 403, message: "Not found any file or folder" });
    }

    let datas = [];
    for (const data of result[0]) {
      if (data && data?.created_by === req?.Id) {
        const getShareTo = await dbExecution(`CALL SP_GET_SHARETO_USERS(?,?)`, [
          data?.id,
          req?.Id
        ]);
        data.sharedTo = null

        if (getShareTo && getShareTo[0].length > 0) {
          data.sharedTo = getShareTo[0];
        }
        
        datas.push({ ...data });
      }
      else
      {
        datas.push({...data})
      }
    }

    return res
      ?.status(200)
      .json({ resultCode: 200, message: "Success", data: datas });
  } catch (error) {
    console.log("get my file or folder error = ", error?.message ?? error);

    return res
      ?.status(500)
      .json({ resultCode: 500, message: error?.message ?? error });
  }
};
