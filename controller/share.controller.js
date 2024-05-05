import { dbExecution } from "../config/dbContext.conf.js";
import { ensureDirNotExistsBlock } from "../util/multerHelper.js";

export const shareFile_Folder = async (req, res) => {
  const { fileType, typeId, shareTo } = req?.body;

  if (!typeId || !shareTo) {
    return res
      .status(422)
      .json({ resultCode: 422, message: "Fields are not supplied." });
  }

  if (!["0", "1", 1, 0].includes(fileType)) {
    return res
      .status(422)
      .json({ resultCode: 422, message: "File type is not allowed." });
  }

  try {
    let query = `SELECT*FROM mfiles WHERE id =? AND deleted_at IS NULL`;
    if (fileType == 0) {
      query = `SELECT*FROM mfolders WHERE id =? AND deleted_at IS NULL`;
    }

    const resultCheck = await dbExecution(query, [typeId]);

    if (!resultCheck || !resultCheck[0]?.path) {
      return res.status(403).json({
        resultCode: 403,
        message: `Not found the sharing file in system`
      });
    }

    if (resultCheck[0]?.created_by === req?.Id && req?.Id === shareTo) {
      return res
        .status(403)
        .json({ resultCode: 403, message: `You can not share to yourself` });
    }

    if (typeId === req?.userProfileId || !req?.userProfileId) {
      console.log([typeId, req?.userProfileId]);
      return res.status(403).json({
        resultCode: 403,
        message: `Omg! your root directory will not be shared.`
      });
    }

    ///double check file still exists in server
    if (!ensureDirNotExistsBlock(resultCheck[0]?.path)) {
      return res
        .status(403)
        .json({ resultCode: 403, message: `File is missing in server` });
    }

    ///Check if allow to share
    const getOnShare = await dbExecution(`CALL SP_GET_MY_FILE_ON_SHARE(?,?)`, [
      typeId,
      req?.Id
    ]);

    if (!getOnShare || !getOnShare[0][0]?.path) {
      return res.status(403).json({
        resultCode: 403,
        message: `You are not allowed to share this file`
      });
    }

    ///share, if typeid=folder => only share the folder. not include files
    ///if typeid=fileid => share it now.
    let insertShare_;

    if (fileType == 0) {
      insertShare_ = await dbExecution(`CALL SP_SHARE_FOLDER_ONE(?,?,?)`, [
        typeId,
        shareTo,
        req?.Id
      ]);
    } else {
      insertShare_ = await dbExecution(`CALL SP_SHARE_FILES_ONE(?,?,?)`, [
        typeId,
        shareTo,
        req?.Id
      ]);
    }

    if (!insertShare_ || !insertShare_ || !insertShare_?.affectedRows) {
      return res
        .status(403)
        .json({ resultCode: 403, message: `Can not share this file` });
    }

    //Share children created by me
    if (fileType === 0) {
      //share any without checking success result
      await shareChildrenWithinFolder(typeId, shareTo, req?.Id);
    }

    return res
      .status(200)
      .json({ resultCode: 200, message: `Share successfully` });
  } catch (error) {
    console.log(`==>>> share file_folder error==>>`, error?.message ?? error);
    return res
      .status(500)
      .json({ resultCode: 500, message: `Internal server error` });
  }
};

const shareChildrenWithinFolder = async (parendId, shareTo, shared_by) => {

  try {
    
    //Share all file of current folder fist
    await shareChildFiles(parendId, shareTo, shared_by);

    //get all sub folder
    const resultFetch = await dbExecution(
      `WITH RECURSIVE FolderHierarchy AS (
                SELECT id, name, path, parentkey,created_by
                FROM mfolders
                WHERE id = ?
                UNION
                SELECT mf.id, mf.name, mf.path, mf.parentkey,mf.created_by
                FROM mfolders mf
                JOIN FolderHierarchy fh ON mf.parentkey = fh.id
            )
            SELECT * FROM FolderHierarchy a  where a.id != ? AND a.created_by = ?`,
      [parendId, parendId, shared_by]
    );

    if (!resultFetch || resultFetch.length < 1) {
      return false;
    }

    for (const child of resultFetch) {
      ///share all folder under parent node
      await dbExecution(`CALL SP_SHARE_FOLDER_ONE(?,?,?)`, [
        child?.id,
        shareTo,
        shared_by
      ]);
      
      ///share all files current node
      await shareChildFiles(child?.id, shareTo);
    }

    return true;
  } catch (error) {
    console.log(`==>>> check child folder error==>>`, error?.message ?? error);
    return false;
  }
};

const shareChildFiles = async (folderId, shareTo, shared_by) => {
  try {
    //share the folder
    //share all files of the folder
    const resultFiles = await dbExecution(
      `SELECT * FROM mfiles f WHERE f.folderId = ? AND f.created_by = ?  AND f.deleted_at IS NULL`,
      [folderId, shared_by]
    );

    if (!resultFiles || !resultFiles[0]) {
      return false;
    }

    for (const file of resultFiles) {
      await dbExecution(`CALL SP_SHARE_FILES_ONE(?,?,?);`, [
        file?.id,
        shareTo,
        shared_by
      ]);
    }

    return true;
  } catch (error) {
    console.log(`==>>> share child file error==>>`, error?.message ?? error);
    return false;
  }
};


export const removeShare = async(req, res) => {
  const { fileType, typeId } = req?.body;

  if (!typeId) {
    return res
      .status(422)
      .json({ resultCode: 422, message: "Fields are not supplied." });
  }

  if (!["0", "1", 1, 0].includes(fileType)) {
    return res
      .status(422)
      .json({ resultCode: 422, message: "File type is not allowed." });
  }

  try 
  {
    const checkOwners = await dbExecution(
      `CALL SP_GET_ROLE_ON_DELETE_SHARE(?)`,
      [typeId]
    );

    if(!checkOwners[0] || checkOwners[0]?.length < 1)
    {
      return res
      .status(403)
      .json({ resultCode: 403, message: "This file is not sharing" });
    }


    let permitte = false;
    let exactFileName = '';

    for(const owner of checkOwners[0])
    {
      //need consider on workshop, what the exactly permitte to unshare
      if(req?.Id === owner?.shared_by || req?.Id === owner.created_by || req?.Id === owner.parentKey || req?.Id === parentOwner)
      {
        exactFileName = owner?.name;
        permitte = true;
        break;
      }
    }

    if(!permitte)
    {
      return res
        .status(403)
        .json({ resultCode: 403, message: "Sorry, you are not permitte to unshare this file" });
    }


    let resultUnshare = false;

    if(fileType === 0)
    {
       resultUnshare = await stopSharingDirectory(typeId);
    }
    else
    {
      resultUnshare = await dbExecution(
        `UPDATE dshare SET deleted_at = CURRENT_TIMESTAMP() WHERE fileId = ?`,
        [typeId]
      );
    }

    if(!resultUnshare)
    {
      return res
        .status(403)
        .json({ resultCode: 403, message: `Sorry, we can stop sharing this file  ${exactFileName}`});
    }

    return res
        .status(200)
        .json({ resultCode: 200, message: `File ${exactFileName} is unshared now.`});


  } 
  catch (error) 
  {
    console.log(`==>>> remove share file_folder error==>>`, error?.message ?? error);
    return res
      .status(500)
      .json({ resultCode: 500, message: `Internal server error` });
  }
}

const stopSharingDirectory = async(typeId) => {
  try {
    const allDirs = await dbExecution(
      `WITH RECURSIVE FolderHierarchy AS (

        SELECT id, name, path, parentkey, created_by
        FROM mfolders
        WHERE id = ?
        UNION
        SELECT mf.id, mf.name, mf.path, mf.parentkey, mf.created_by
        FROM mfolders mf
        JOIN FolderHierarchy fh ON mf.parentkey = fh.id
    )
    SELECT a.id, a.parentKey,a.name,a.path,a.created_by,d.shared_by
    FROM FolderHierarchy a JOIN dshare d ON a.id = d.folderId WHERE d.deleted_at IS NULL`,
    [typeId]
    );

    if(!allDirs[0])
    {
      return false;
    }

    let uniqueValues = [];
    for(const dir of allDirs)
    {
     uniqueValues.push(dir?.id)
    }

    await dbExecution(
      `UPDATE dshare SET deleted_at = CURRENT_TIMESTAMP() WHERE folderId IN (?)`,
      [uniqueValues]
    )

    await dbExecution(
      `UPDATE dshare AS d
      JOIN mfiles AS m ON m.id = d.fileId
      SET d.deleted_at = CURRENT_TIMESTAMP() 
      WHERE m.folderId IN (?)`,
      [uniqueValues]
    )

    return true;
  } catch (error) {
    console.log(`==>>> unshare folder error==>>`, error?.message ?? error);
   return false;
  }
}