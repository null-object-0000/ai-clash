import type { ProviderStats, ShareProvider, ShareSnapshot, ShareSummary } from './types.js';

type ValidationResult =
  | { ok: true; value: ShareSnapshot }
  | { ok: false; errors: string[] };

const MAX_TEXT_LENGTH = 80_000;
const MAX_PROVIDERS = 12;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function optionalString(value: unknown, maxLength: number) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return '';
  return value.slice(0, maxLength);
}

function readStats(value: unknown): ProviderStats | null {
  if (!isRecord(value)) return null;
  const ttff = Number(value.ttff);
  const totalTime = Number(value.totalTime);
  const charCount = Number(value.charCount);
  const charsPerSec = Number(value.charsPerSec);
  if (![ttff, totalTime, charCount, charsPerSec].every(Number.isFinite)) return null;
  return { ttff, totalTime, charCount, charsPerSec };
}

function readProvider(value: unknown, index: number, errors: string[]): ShareProvider | null {
  if (!isRecord(value)) {
    errors.push(`providers[${index}] must be an object`);
    return null;
  }

  const providerId = optionalString(value.providerId, 64);
  const providerName = optionalString(value.providerName, 128);
  const status = value.status === 'error' ? 'error' : 'completed';
  const response = optionalString(value.response, MAX_TEXT_LENGTH);
  const thinkResponse = optionalString(value.thinkResponse, MAX_TEXT_LENGTH);

  if (!providerId) errors.push(`providers[${index}].providerId is required`);
  if (!providerName) errors.push(`providers[${index}].providerName is required`);
  if (!response && !thinkResponse) errors.push(`providers[${index}] must include response or thinkResponse`);

  if (!providerId || !providerName || (!response && !thinkResponse)) return null;

  return {
    providerId,
    providerName,
    status,
    response,
    ...(thinkResponse ? { thinkResponse } : {}),
    stats: readStats(value.stats),
  };
}

function readSummary(value: unknown): ShareSummary | undefined {
  if (!isRecord(value)) return undefined;
  const response = optionalString(value.response, MAX_TEXT_LENGTH);
  const thinkResponse = optionalString(value.thinkResponse, MAX_TEXT_LENGTH);
  const analysisResponse = optionalString(value.analysisResponse, MAX_TEXT_LENGTH);
  if (!response && !thinkResponse && !analysisResponse) return undefined;
  return {
    response,
    ...(thinkResponse ? { thinkResponse } : {}),
    ...(analysisResponse ? { analysisResponse } : {}),
    stats: readStats(value.stats),
  };
}

export function validateShareSnapshot(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(input)) return { ok: false, errors: ['request body must be a JSON object'] };

  const question = optionalString(input.question, MAX_TEXT_LENGTH);
  if (!question.trim()) errors.push('question is required');

  const locale = input.locale === 'en' ? 'en' : 'zh';
  const rawProviders = Array.isArray(input.providers) ? input.providers : [];
  if (!rawProviders.length) errors.push('providers must include at least one item');
  if (rawProviders.length > MAX_PROVIDERS) errors.push(`providers cannot exceed ${MAX_PROVIDERS} items`);

  const providers = rawProviders
    .slice(0, MAX_PROVIDERS)
    .map((item, index) => readProvider(item, index, errors))
    .filter((item): item is ShareProvider => !!item);

  const createdAt = Number.isFinite(Number(input.createdAt)) ? Number(input.createdAt) : Date.now();
  const summary = readSummary(input.summary);

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      schemaVersion: 1,
      title: optionalString(input.title, 160) || question.trim().slice(0, 80),
      question,
      createdAt,
      locale,
      providers,
      ...(summary ? { summary } : {}),
    },
  };
}
