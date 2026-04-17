# 更新日志

## [1.1.0] - 2026-04-17

### 🎉 重磅更新 (Major)

- **接入新通道 - 文心一言**：百度大模型正式加入对撞阵列！全面适配文心一言网页版的原生算力，国内一线大厂模型版图进一步补齐。
- **「焦点跟随」导播模式**：突破浏览器对后台非激活标签页的性能降频限制。后台自动探测并唤醒正在输出的 AI 网页，确保满血多路并发，提供无缝沉浸的观感体验。

### ✨ 新增特性 (Features)

- **自定义归纳总结**：支持在全局设置中自定义「AI 裁判」的系统提示词（System Prompt），随心所欲定制你的专属裁判风格。
- **重构归纳交互**：支持手动按需触发「归纳总结」，并提供「重新生成」功能，将总结的控制权交还给用户。
- **官网与分发中心**：上线专属官网，提供完整的历史版本查看与离线 ZIP 包开发者模式安装指引。

### 🛠️ 优化与修复 (Fixes & Improvements)

- **追问拦截防护**：新增多通道模式下的「防误触追问拦截弹窗」，防止手滑导致未完成的回答意外清空。

---

<details>
<summary>🇬🇧 English Version</summary>

### 🎉 Major

- **New Channel — Wenxin Yiyan**: Baidu's flagship LLM officially joins the arena! Fully adapted to the native computing power of the Wenxin Yiyan web interface, completing the lineup of China's top-tier foundation models.
- **"Focus Follow" Director Mode**: Breaks through browser performance throttling on inactive background tabs. Background detection automatically awakens updating AI webpages to ensure full-speed concurrency, delivering a seamless and immersive viewing experience.

### ✨ Features

- **Customizable AI Judge**: Support for customizing the "AI Judge" System Prompt in global settings, allowing you to tailor the summarization style to your exact needs.
- **Revamped Summary Interaction**: Support for triggering the "Generate Summary" on-demand, along with a "Regenerate" feature, returning full control to the user.
- **Official Website**: Launched a dedicated official website offering a complete version history and offline ZIP package developer mode installation guide.

### 🛠️ Fixes & Improvements

- **Follow-up Question Interception**: New anti-accidental-trigger confirmation modal in multi-channel mode to prevent unintended clearing of in-progress responses.

</details>

## [1.0.0] - 2026-04-15

### 🎉 创世版正式上线 (MVP Release)

- **首创同屏并发对撞**：推出独立的侧边栏工作台，一键提问，多网页同时唤醒狂飙，体验极致的 AI 斗兽快感。
- **零 API 成本架构**：采用突破性的纯前端网页 DOM Hook 技术，直接劫持并复用网页端原生算力。
- **首发四大通道**：原生接入国内顶级大模型阵列，完美适配 DeepSeek、豆包、通义千问、腾讯元宝。

### ✨ 核心特性 (Features)

- **内置 AI 裁判引擎**：各通道回答完毕后，自动触发全局「归纳总结」，瞬间提炼核心共识与分歧。
- **原生模式完美映射**：无缝同步各平台的进阶开关，全面支持「深度思考模式 (如 DeepSeek R1)」与「联网搜索」的实时状态抓取。

---

<details>
<summary>🇬🇧 English Version</summary>

### 🎉 MVP Release

- **Pioneering Concurrent UI**: Launched an independent sidebar workspace. One prompt awakens multiple AI webpages simultaneously for the ultimate LLM arena experience.
- **Zero API Cost Architecture**: Utilizes breakthrough pure frontend DOM Hook injection to directly hijack and reuse the native computing power of logged-in AI web platforms.
- **Four Initial Top Models**: Natively integrated with top-tier foundation models, perfectly adapting to DeepSeek, Doubao, Qwen, and Tencent Yuanbao.

### ✨ Core Features

- **Built-in AI Judge**: After all AI channels finish answering, automatically triggers a global summary to instantly distill core consensus and differences.
- **Native Mode Mapping**: Seamlessly syncs advanced toggles from each platform, fully supporting real-time status capture for "Deep Think (e.g., DeepSeek R1)" and "Web Search".

</details>
