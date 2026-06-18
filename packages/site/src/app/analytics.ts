const UMAMI_HOST_URL = (import.meta.env.VITE_UMAMI_HOST_URL || 'https://cloud.umami.is').replace(/\/+$/, '')
const UMAMI_WEBSITE_ID = import.meta.env.VITE_UMAMI_WEBSITE_ID || '3895ace9-ac76-4d79-aa29-40618f3386c9'
const ANALYTICS_PROXY_URL = (
  import.meta.env.VITE_ANALYTICS_PROXY_URL
  || `${(import.meta.env.VITE_API_BASE_URL || 'https://ai-clash-service.snewbie.site').replace(/\/+$/, '')}/api/analytics`
).replace(/\/+$/, '')
const ANALYTICS_ENABLED = import.meta.env.VITE_ANALYTICS_ENABLED !== 'false'

type AnalyticsData = Record<string, string | number | boolean | null | undefined>

function cleanData(data: AnalyticsData = {}) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined && value !== null),
  )
}

export function trackSiteEvent(name: string, data?: AnalyticsData, url = window.location.pathname) {
  if (!ANALYTICS_ENABLED || !UMAMI_WEBSITE_ID) return

  const body = JSON.stringify({
    type: 'event',
    payload: {
      website: UMAMI_WEBSITE_ID,
      hostname: window.location.hostname || 'ai-clash.site',
      language: navigator.language,
      referrer: document.referrer,
      screen: `${window.screen.width}x${window.screen.height}`,
      title: document.title,
      url,
      name,
      data: cleanData(data),
    },
  })

  fetch(ANALYTICS_PROXY_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    keepalive: true,
    body,
  }).catch(() => {
    fetch(`${UMAMI_HOST_URL}/api/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      keepalive: true,
      body,
    }).catch(() => {})
  })
}
