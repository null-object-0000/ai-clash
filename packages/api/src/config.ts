import { URL } from 'node:url';

export type ApiConfig = {
  port: number;
  publicSiteUrl: string;
  corsOrigins: string[];
  maxShareBytes: number;
  shareDefaultTtlDays: number;
  mysql: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
};

function readInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : fallback;
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function normalizeBaseUrl(value: string) {
  const url = new URL(value);
  url.pathname = url.pathname.replace(/\/+$/, '');
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/+$/, '');
}

export function loadConfig(): ApiConfig {
  const publicSiteUrl = normalizeBaseUrl(required('PUBLIC_SITE_URL'));
  const corsOrigins = (process.env.CORS_ORIGINS || publicSiteUrl)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    port: readInt('PORT', 8080),
    publicSiteUrl,
    corsOrigins,
    maxShareBytes: readInt('MAX_SHARE_BYTES', 512 * 1024),
    shareDefaultTtlDays: readInt('SHARE_DEFAULT_TTL_DAYS', 0),
    mysql: {
      host: required('MYSQL_HOST'),
      port: readInt('MYSQL_PORT', 3306),
      user: required('MYSQL_USER'),
      password: required('MYSQL_PASSWORD'),
      database: required('MYSQL_DATABASE'),
    },
  };
}
