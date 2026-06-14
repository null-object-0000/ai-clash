const ANALYTICS_STORAGE_KEY = 'aiclash.analytics.enabled';
const UMAMI_HOST_URL = (import.meta.env.VITE_UMAMI_HOST_URL || 'https://cloud.umami.is').replace(/\/+$/, '');
const UMAMI_WEBSITE_ID = import.meta.env.VITE_UMAMI_WEBSITE_ID || '3895ace9-ac76-4d79-aa29-40618f3386c9';
const ANALYTICS_ENABLED = import.meta.env.VITE_ANALYTICS_ENABLED !== 'false';

function chromeStorageGet(key) {
  return new Promise((resolve) => {
    if (!chrome?.storage?.local) {
      resolve(undefined);
      return;
    }
    chrome.storage.local.get([key], (result) => resolve(result?.[key]));
  });
}

function cleanData(data = {}) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined && value !== null),
  );
}

function getBrowserFamily() {
  const brands = navigator?.userAgentData?.brands?.map((brand) => brand.brand.toLowerCase()).join(' ') || '';
  const ua = navigator?.userAgent?.toLowerCase?.() || '';
  const text = `${brands} ${ua}`;
  if (text.includes('edg/')) return 'edge';
  if (text.includes('brave')) return 'brave';
  if (text.includes('vivaldi')) return 'vivaldi';
  if (text.includes('chrome') || text.includes('chromium')) return 'chrome';
  return 'unknown';
}

export function getInstallSource() {
  const runtimeId = chrome?.runtime?.id || '';
  if (runtimeId === 'ggngmgpjdklmkpoldbfahmeefpnfhhai') return 'chrome_store';
  if (runtimeId === 'khjmihaeihajagobgbdhlbjeobdpmfkm') return 'edge_store';
  const updateUrl = chrome?.runtime?.getManifest?.().update_url || '';
  try {
    const host = new URL(updateUrl).hostname.toLowerCase();
    if (host === 'clients2.google.com' || host.endsWith('.clients2.google.com')) return 'chrome_store';
    if (host === 'edge.microsoft.com' || host.endsWith('.edge.microsoft.com')) return 'edge_store';
  } catch {
    // Ignore invalid update_url and fall through.
  }
  return 'offline_or_unpacked';
}

export async function isAnalyticsEnabled() {
  if (!ANALYTICS_ENABLED || !UMAMI_WEBSITE_ID) return false;
  const stored = await chromeStorageGet(ANALYTICS_STORAGE_KEY);
  return stored !== false;
}

export function setAnalyticsEnabled(enabled) {
  chrome?.storage?.local?.set({ [ANALYTICS_STORAGE_KEY]: Boolean(enabled) });
}

export async function trackEvent(name, data = {}, url = '/extension') {
  if (!(await isAnalyticsEnabled())) return;

  const manifest = chrome?.runtime?.getManifest?.();
  const payload = {
    website: UMAMI_WEBSITE_ID,
    hostname: 'extension.ai-clash',
    language: navigator?.language || '',
    referrer: '',
    screen: globalThis.screen ? `${screen.width}x${screen.height}` : '',
    title: 'AI Clash Extension',
    url,
    name,
    data: cleanData({
      version: manifest?.version,
      install_source: getInstallSource(),
      browser_family: getBrowserFamily(),
      ...data,
    }),
  };

  fetch(`${UMAMI_HOST_URL}/api/send`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'event', payload }),
  }).catch(() => {});
}
