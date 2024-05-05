CREATE DATABASE `share`;


CREATE TABLE `musers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` varchar(25) NOT NULL,
  `userName` varchar(45) NOT NULL,
  `userPassword` varchar(255) NOT NULL,
  `userEmail` varchar(75) NOT NULL,
  `userFlag` int(11) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`),
  UNIQUE KEY `userId_UNIQUE` (`userId`)
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;


CREATE TABLE `mfolders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `path` varchar(200) NOT NULL,
  `parentKey` int(11) NOT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`),
  KEY `idx_id` (`id`),
  KEY `idx_parentkey` (`parentKey`)
) ENGINE=InnoDB AUTO_INCREMENT=110 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

CREATE TABLE `mfiles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `folderId` int(11) DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `fileSize` bigint(20) DEFAULT NULL,
  `path` varchar(200) NOT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`),
  KEY `idx_id_` (`id`),
  KEY `idx_folderId` (`folderId`),
  KEY `idx_created_by` (`created_by`)
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;


CREATE TABLE `dshare` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `folderId` int(11) DEFAULT NULL,
  `fileId` int(11) DEFAULT NULL,
  `accessGuests` int(11) DEFAULT NULL,
  `shared_by` int(11) DEFAULT NULL,
  `shared_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=784 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;


DELIMITER $$
CREATE PROCEDURE `SP_CHECK_USER_PROFILE`(IN userId INT, IN folderId INT)
BEGIN
    DECLARE hasData INT;

    SELECT COUNT(*) INTO hasData
    FROM musers a
    JOIN mfolders b ON CONCAT(a.userId, a.id) = b.name
    WHERE a.id = userId OR a.userId = folderId;
    
    IF hasData > 0 THEN
        SELECT a.*,b.id AS profileId, b.name AS userProfile 
        FROM musers a 
        JOIN mfolders b ON CONCAT(a.userId, a.id) = b.name 
        WHERE a.id = userId OR a.userId = folderId;
    ELSE
        SELECT a.* 
        FROM musers a 
        WHERE a.id = userId OR a.userId = folderId;
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE PROCEDURE `SP_GET_MY_FILE_ON_SHARE`(IN fileId INT, IN userId INT)
BEGIN
	SELECT id, created_by,path, 1 AS fileType FROM mfiles WHERE id = fileId AND created_by = userId AND deleted_at IS NULL
	UNION
	SELECT id, created_by,path, 0 AS fileType FROM mfolders WHERE id = fileId AND created_by = userId AND deleted_at IS NULL
	UNION
	SELECT 
		CASE WHEN fd.id IS NOT NULL THEN fd.id WHEN fl.id IS NOT NULL THEN fl.id ELSE z.id END AS id,
		CASE WHEN fd.id IS NOT NULL THEN fd.created_by WHEN fl.id IS NOT NULL THEN fl.created_by ELSE z.shared_by END AS created_by,
		CASE WHEN fd.id IS NOT NULL THEN fd.path WHEN fl.id IS NOT NULL THEN fl.path ELSE '' END AS `path`,
        2 AS fileType
	FROM dshare z LEFT JOIN mfiles fl ON z.fileId = fl.id 
			LEFT JOIN mfolders fd ON z.folderId = fd.id WHERE z.accessGuests = userId AND z.deleted_at IS NULL AND (fl.id = fileId OR fd.id = fileId);
END$$
DELIMITER ;

DELIMITER $$
CREATE PROCEDURE `SP_GET_MY_FILES_FOLDERS`(IN parentId INT, IN userId INT)
BEGIN
	WITH mData AS (
		SELECT 
			a.id, a.name, 0 AS fileSize,a.path,a.parentKey,a.created_by,
			CASE WHEN a.created_by = userId THEN 'Me' ELSE 'Other' END AS Owner,
			b.userEmail,a.created_at,a.updated_at, 0 as fileType
		FROM mfolders a JOIN musers b ON a.created_by = b.id AND b.userFlag=1
		 WHERE a.parentKey = parentId AND a.id != a.parentKey AND a.deleted_at IS NULL AND b.deleted_at IS NULL
		UNION
		SELECT 
			a.id,a.name, a.fileSize,a.path,a.folderId AS parentKey,a.created_by,
			CASE WHEN a.created_by = userId THEN 'Me' ELSE 'Other' END AS Owner,
			c.userEmail,a.created_at,a.updated_at, 1 AS fileType
		FROM mfiles a 
		JOIN mfolders b ON a.folderId = b.id AND b.deleted_at IS NULL
		JOIN musers c ON a.created_by = c.id AND c.userFlag=1 AND c.deleted_at IS NULL
		WHERE a.folderId = parentId AND a.deleted_at IS NULL
	)
	SELECT*FROM (
		SELECT m.*, '' AS shared_by FROM mData m WHERE m.Owner = 'Me'
		UNION 
		SELECT m1.*,d.shared_by FROM mData m1 JOIN dshare d ON (m1.id = d.folderId OR m1.id = d.fileId) WHERE m1.Owner = 'Other' AND d.accessGuests = userId AND d.deleted_at IS NULL
    ) z ORDER BY z.fileType, z.updated_at DESC;
END$$
DELIMITER ;

DELIMITER $$
CREATE  PROCEDURE `SP_GET_ROLE_ON_DELETE_SHARE`(
    IN p_typeId INT
)
BEGIN
	DECLARE v_parentKey INT;
    
    SELECT z.parentKey INTO v_parentKey FROM(
		SELECT a.id, a.folderId AS parentKey,a.deleted_at FROM mfiles a WHERE a.id = p_typeId
		UNION
		SELECT b.id,b.parentKey,b.deleted_at FROM mfolders b WHERE b.id = p_typeId
	)z WHERE z.deleted_at IS NULL;
    
    IF v_parentKey > 0 AND v_parentKey !='' THEN
    
	   WITH fileTemp AS (
		SELECT  
			fl.id,
			fl.name,
			fl.path,
			fl.created_by,
			d.id AS shareId,
			d.fileId AS typeId,
			d.shared_by,
			d.accessGuests,
			1 AS fileType,
			fl.folderId AS parentKey
		FROM 
			share.dshare d  
		JOIN 
			mfiles fl ON d.fileId = fl.id  
		WHERE 
			fl.id = p_typeId
		UNION 
		SELECT  
			fd.id, 
			fd.name, 
			fd.path, 
			fd.created_by, 
			d.id AS shareId, 
			d.folderId AS typeId, 
			d.shared_by, 
			d.accessGuests, 
			0 AS fileType, 
			fd.parentKey
		FROM 
			share.dshare d  
		JOIN 
			mfolders fd ON d.folderId = fd.id  
		WHERE  
			fd.id = p_typeId
	)
	SELECT  
		a.*, 
		owner.created_by AS parentOwner 
	FROM  
		fileTemp a 
	LEFT JOIN   
		mfolders owner ON a.parentKey = owner.id  
	WHERE  
		a.parentKey = v_parentKey;
        
	END IF;

END$$
DELIMITER ;

DELIMITER $$
CREATE PROCEDURE `SP_GET_SHARETO_USERS`(IN fileId INT, IN userId INT)
BEGIN
	SELECT*FROM (
    SELECT 
		b.id,b.userId,b.userName,b.userEmail,a.shared_at 
	FROM dshare a
		JOIN musers b ON a.accessGuests = b.id AND b.deleted_at IS NULL AND a.deleted_at IS NULL
	WHERE a.shared_by = userId AND a.folderId = fileId
	UNION
	SELECT 
		b.id,b.userId,b.userName,b.userEmail,a.shared_at 
	FROM dshare a 
		JOIN musers b ON a.accessGuests = b.id AND b.deleted_at IS NULL 
	WHERE a.shared_by = userId AND a.fileId = fileId
    )z ORDER BY z.shared_at DESC;
END$$
DELIMITER ;

DELIMITER $$
CREATE PROCEDURE `SP_SHARE_FILES_ONE`(
    IN p_fileId INT,
    IN p_accessGuests INT,
    IN p_shared_by INT
)
BEGIN
    UPDATE dshare
		SET deleted_at = CURRENT_TIMESTAMP()
    WHERE fileId = p_fileId
		AND accessGuests = p_accessGuests
    AND deleted_at IS NULL;

    INSERT INTO dshare (fileId, accessGuests, shared_by)
		VALUES(p_fileId, p_accessGuests,p_shared_by);
END$$
DELIMITER ;

DELIMITER $$
CREATE PROCEDURE `SP_SHARE_FOLDER_ONE`(
    IN p_folderId INT,
    IN p_accessGuests INT,
    IN p_shared_by INT
)
BEGIN
    UPDATE dshare
		SET deleted_at = CURRENT_TIMESTAMP()
    WHERE folderId = p_folderId
		AND accessGuests = p_accessGuests
    AND deleted_at IS NULL;

    INSERT INTO dshare (folderId, accessGuests, shared_by)
		VALUES(p_folderId, p_accessGuests,p_shared_by);
END$$
DELIMITER ;


DELIMITER //

CREATE TRIGGER trg_make_root_folder AFTER INSERT ON musers
FOR EACH ROW
BEGIN
    DECLARE last_folder_id INT;
    
    SELECT AUTO_INCREMENT INTO last_folder_id
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'share'
    AND TABLE_NAME = 'mfolders';
    
    INSERT INTO mfolders (name, path, created_by, parentKey, created_at)
    VALUES (CONCAT(NEW.userId, NEW.id), CONCAT('../upload/', CONCAT(NEW.userId, NEW.id)), NEW.id, last_folder_id, NOW());
END;
//

DELIMITER ;
