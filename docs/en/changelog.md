# Changelog

## [1.2.0] - 2026-04-25

### 🎉 Major

- **New Channel - Xiaomi MIMO**: Xiaomi MIMO is now supported and can be added directly to multi-channel comparisons.
- **Add Channels Mid-Conversation**: No need to restart your prompt. You can add another AI channel at any point during the same turn.

### ✨ Features

- **DeepSeek API Mode Upgraded to V4**: API mode now supports `deepseek-v4-flash` and `deepseek-v4-pro`, with the old `deepseek-chat` / `deepseek-reasoner` model options removed.
- **Version Update Status**: Added "About / Version Updates" to global settings, showing the installed version, Chrome/Edge store versions, website preview version, and store review status.
- **Clearer AI Judge Summaries**: Summaries now separate "shared conclusions", "different viewpoints", and the "judge's choice" before showing the final advice, making it easier to see where the AIs agree and where they disagree.

### 🛠️ Fixes & Improvements

- **Better Channel List**: Select all / invert selection are now available, channels are grouped by region, and the list expands to fit the sidebar. The expand/collapse button is hidden when everything is already visible.
- **Quieter Settings**: Switching between Web/API mode now only saves the setting and no longer opens the target webpage automatically. Yuanbao also no longer needs a manual web-search toggle.
- **More Stable Multi-Channel Runs**: Channel wake-up, page readiness, and message dispatch are more reliable. DeepSeek now fails fast on the login page and lets other channels continue.
- **Web Login Checks**: Before sending in Web mode, the sidebar checks login state per channel. Logged-out channels show an in-channel prompt with a "Go to Login" entry, while logged-in channels keep running, and history preserves the login-required message.
- **Smarter Defaults**: When 2 or more channels are enabled, `Auto Summary` and `Director Mode` turn on by default. If you change them manually, your choice is remembered.
- **Easier Recovery After Failure**: Failed channels can be retried individually without restarting the whole turn, and failed states are restored correctly from history.

## [1.1.0] - 2026-04-17

### 🎉 Major

- **New Channel - Wenxin Yiyan**: Wenxin Yiyan is now supported and can join multi-channel comparisons directly.
- **"Focus Follow" Director Mode**: When an AI is actively generating, focus is moved to that page automatically to reduce browser throttling on background tabs.

### ✨ Features

- **Custom Summary Prompt**: You can edit the "AI Judge" prompt in global settings to make summary style fit your preference.
- **Summary Flow Reworked**: Summary is now manually triggered, and "Regenerate" is available when you want another version.
- **Official Site & Distribution Hub**: The official site is live with version history, offline ZIP packages, and developer mode install docs.

### 🛠️ Fixes & Improvements

- **Follow-up Protection**: Added an anti-mistap confirmation popup in multi-channel mode to avoid clearing unfinished responses.

## [1.0.0] - 2026-04-15

### 🎉 MVP Release

- **Concurrent Multi-Channel Comparison**: Added a dedicated sidebar workspace so one prompt can trigger multiple AI webpages at once.
- **Zero API Cost Architecture**: No API key setup required. It directly reuses capabilities from each platform's official web interface.
- **Four Launch Channels**: The first release supports DeepSeek, Doubao, Qwen, and Tencent Yuanbao.

### ✨ Core Features

- **Built-in AI Judge**: After channels finish responding, it automatically generates a summary to help you quickly see consensus and differences.
- **Native Mode Mapping**: Syncs common platform toggles, such as "Deep Thinking" and "Web Search" status.
