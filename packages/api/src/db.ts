import mysql from 'mysql2/promise';
import type { ApiConfig } from './config.js';

export function createPool(config: ApiConfig) {
  return mysql.createPool({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
    charset: 'utf8mb4',
  });
}

export type DbPool = ReturnType<typeof createPool>;
