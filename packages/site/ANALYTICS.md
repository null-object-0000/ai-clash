# AI Clash Analytics Tracking Plan

Last updated: 2026-06-13

This document is the source of truth for AI Clash analytics events across the browser extension sidepanel and the public website.
Whenever analytics events are added, removed, renamed, or their payload fields change, update this file in the same change.

## Goals

- Understand install source distribution: Chrome Web Store, Edge Add-ons, offline/unpacked install, and other Chromium browsers.
- Measure the extension funnel from sidepanel open, question submit, provider execution, summary, and sharing.
- Monitor failures by provider, mode, and failure type so regressions can be located quickly.
- Measure share page reach and conversion to extension installation.
- Avoid collecting sensitive user content.

## Privacy Rules

Do not send:

- User prompts or questions.
- AI answers, summaries, or reasoning content.
- API keys, account identifiers, cookies, tokens, or raw provider URLs.
- Full URL query strings from third-party AI websites.

Allowed dimensions:

- Extension/site version.
- Install source.
- Browser family.
- UI language.
- Screen size.
- Provider id.
- Provider mode.
- Status, counts, booleans, and coarse failure types.

## Data Source Split

Analytics must always be analyzed by source first:

| Source | Runtime | Hostname | Main code path | Purpose |
| --- | --- | --- | --- | --- |
| Extension sidepanel | Browser extension background and sidepanel | `extension.ai-clash` | `src/shared/analytics.js` | Extension install source, sidepanel funnel, provider execution, summary, sharing, and settings behavior. |
| Website | Public AI Clash site | Actual website host, e.g. `ai-clash.snewbie.site` | `packages/site/src/app/analytics.ts` and `packages/site/index.html` | Website page views, share page reads, and install CTA conversion. |

Both sources currently use the same Umami website id by default. Do not mix them without filtering by `hostname`, `url`, and event names.

## Extension Sidepanel Analytics

### Shared Dimensions

Extension events are sent from `src/shared/analytics.js` with:

| Field | Meaning |
| --- | --- |
| `version` | Extension version from `chrome.runtime.getManifest().version`. |
| `install_source` | `chrome_store`, `edge_store`, or `offline_or_unpacked`. |
| `browser_family` | `edge`, `brave`, `vivaldi`, `chrome`, or `unknown`. |
| `language` | Browser language from `navigator.language`. |
| `screen` | Screen size, e.g. `1920x1080`. |

### Install And Open

| Event | Trigger | URL | Data |
| --- | --- | --- | --- |
| `extension_installed` | Chrome `runtime.onInstalled`, reason is `install`. | `/extension/install` | `reason`, `previous_version` |
| `extension_updated` | Chrome `runtime.onInstalled`, reason is not `install`. | `/extension/install` | `reason`, `previous_version` |
| `sidepanel_opened` | Extension action click or sidepanel mount. | `/extension/sidepanel` | `source`: `action_click` or `sidepanel_mount` |

### Question Funnel

| Event | Trigger | URL | Data |
| --- | --- | --- | --- |
| `question_submitted` | User submits a question in the sidepanel. | `/extension/question` | `enabled_provider_count`, `has_previous_question`, `summary_enabled` |

### Provider Execution

| Event | Trigger | URL | Data |
| --- | --- | --- | --- |
| `provider_started` | Background receives a provider dispatch request. | `/extension/provider` | `provider_id`, `mode` |
| `provider_completed` | Provider task completes. | `/extension/provider` | `provider_id`, `mode` |
| `provider_failed` | Provider task reports an error. | `/extension/provider` | `provider_id`, `error_type` |

Provider modes:

- `web`
- `api`
- `stored` when the request uses the stored provider mode.

Failure type examples:

- `provider_error`
- `system_error`
- `auth_required`
- `summary_error`

### Summary

| Event | Trigger | URL | Data |
| --- | --- | --- | --- |
| `summary_started` | Background starts summary generation. | `/extension/summary` | `provider_id` |
| `summary_completed` | Summary generation completes. | `/extension/summary` | `provider_id` |
| `summary_failed` | Summary generation fails. | `/extension/summary` | `provider_id`, `error_type` |

### Sharing

| Event | Trigger | URL | Data |
| --- | --- | --- | --- |
| `share_started` | User starts publishing a share. | `/extension/share` | `provider_count`, `has_summary` |
| `share_created` | Share is successfully created. | `/extension/share` | `provider_count`, `has_summary` |
| `share_failed` | Share creation or deletion fails. | `/extension/share` | `reason`, optional `action` |
| `share_deleted` | Published share is revoked. | `/extension/share` | none |

### Channel Settings

| Event | Trigger | URL | Data |
| --- | --- | --- | --- |
| `provider_toggled` | User enables or disables a provider. | `/extension/settings` | `provider_id`, `enabled`, `enabled_provider_count` |
| `provider_mode_changed` | User changes provider mode. | `/extension/settings` | `provider_id`, `mode` |
| `api_key_tested` | User tests an API key. | `/extension/settings` | `provider_id`, `success`, optional `error_type` |
| `analytics_enabled` | User turns anonymous analytics back on. | `/extension/settings` | none |

`api_key_tested` must never include the API key or provider response body.

## Website Analytics

Website events are sent from `packages/site/src/app/analytics.ts`. Website page-view tracking is also loaded in `packages/site/index.html` through Umami's script.

Website analytics should answer questions about public site traffic, share page reads, and install CTA conversion. It should not be used to infer extension provider reliability unless the event comes from the extension hostname.

### Share Page

| Event | Trigger | URL | Data |
| --- | --- | --- | --- |
| `share_page_viewed` | Share page route is opened. | `/share/:id` or `/share` | `has_id` |
| `share_loaded` | Share snapshot loads successfully. | `/share/:id` | `provider_count`, `has_summary` |
| `share_load_failed` | Share snapshot fails to load. | `/share/:id` | `reason` |

### Install CTA

| Event | Trigger | URL | Data |
| --- | --- | --- | --- |
| `install_cta_clicked` | User clicks an install CTA on the share page. | Current page URL | `source`, `channel` |

Known values:

- `source`: `share_bottom`
- `channel`: `chrome`, `edge`, `offline`

## Suggested Analysis Prompts

Use these questions when asking another AI to analyze Umami exports:

- Which install source is growing fastest by week?
- Which browser family has the highest provider failure rate?
- Which providers fail most often, split by `mode` and `error_type`?
- What percentage of questions reach at least one provider completion?
- What percentage of share attempts become successful `share_created` events?
- Do share pages convert to install CTA clicks, split by `channel`?
- Are failures concentrated after a specific extension `version`?

## Maintenance Checklist

Before shipping a release that changes analytics:

- Add new events or fields to this document.
- Confirm no sensitive content is included.
- Run `bun run typecheck`.
- Run `bun run build`.
- Run `bun run build:site` if website tracking changed.
- If the API affects share data or event meaning, run API compile checks too.
