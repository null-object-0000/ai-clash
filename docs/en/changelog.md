# Changelog

## [1.2.0] - Unreleased

### 🎉 Major

- **New Channel - Xiaomi MIMO**: Xiaomi MIMO is now supported and can be added directly to multi-channel comparisons.
- **Add Channels Mid-Conversation**: No need to restart your prompt. You can add another AI channel at any point during the same turn.

### ✨ Features

### 🛠️ Fixes & Improvements

- **Channel List UX Improvements**: Supports select all / deselect all, groups channels by domestic / overseas, and adapts to sidebar space automatically.
- **Removed Manual Yuanbao Search Toggle**: Tencent Yuanbao now decides web search automatically based on your prompt, so you no longer need to toggle it manually.

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
