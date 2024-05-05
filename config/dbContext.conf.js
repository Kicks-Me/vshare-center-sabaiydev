import dotenv from "dotenv";
import { logEvents } from "../middleware/logEvent.js";
import mysql from "mysql";

dotenv.config();

const dbPool = mysql.createPool({
  host: process.env.DBHOST,
  user: process.env.DBUSER,
  password: process.env.DBPWD,
  database: process.env.DBNAME,
  port: process.env.DBPORT ? parseInt(process.env.DBPORT) : 3306,
  connectionLimit: 100,
  connectTimeout: 90000,
  acquireTimeout: 30000,
  waitForConnections: true
});

export const dbExecution = async (query, params = []) => {
  const getConnection = () => {
    return new Promise((resolve, reject) => {
      dbPool.getConnection((err, connection) => {
        if (err) {
          reject(err);
        } else {
          resolve(connection);
        }
      });
    });
  };

  const releaseConnection = (connection) => {
    return new Promise((resolve) => {
      connection.release();
      resolve();
    });
  };

  const connection = await getConnection();

  try {
    const result = await new Promise((resolve, reject) => {
      connection.query(query, params, (error, results) => {
        if (error) {
          reject(error);
        } else {
          resolve(results);
        }
      });
    });

    return result;
  } catch (error) {
    await logEvents(`Query: ${query}\n\nParam:${params}`);
    console.error("Error executing database query:", error);
    return false;
  } finally {
    await releaseConnection(connection);
  }
};
