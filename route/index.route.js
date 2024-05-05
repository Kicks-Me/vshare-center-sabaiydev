import Router from "express";
import {
  createFolder,
  deleteFolder,
  getMyFiles_Folders,
  renameFolder
} from "../controller/folder.controller.js";
import { verifyJWT } from "../middleware/jwt.js";
import { deleteFileName, editFileName, uploadFile,downloadFile, previewFile } from "../controller/file.controller.js";
import { removeShare, shareFile_Folder } from "../controller/share.controller.js";

const route = Router();

//Folder CRUD
route.post("/create-folder", verifyJWT, createFolder);
route.put("/rename-folder", verifyJWT, renameFolder);
route.delete("/delete-folder/:id", verifyJWT, deleteFolder);
route.get('/get-files/:parentId', verifyJWT, getMyFiles_Folders);

//File CRUD
route.post("/upload-file/:folderId", verifyJWT, uploadFile);
route.put("/rename-file", verifyJWT, editFileName);
route.delete("/delete-file/:fileId", verifyJWT, deleteFileName);
route.get('/download/:id', verifyJWT, downloadFile);
route.get('/preview/:id',verifyJWT, previewFile);

///Share file
route.post('/share', verifyJWT, shareFile_Folder);
route.post('/unshare', verifyJWT, removeShare);



export default route;
