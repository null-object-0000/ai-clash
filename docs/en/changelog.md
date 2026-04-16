# Changelog

## [1.1.0] - 2026-04-16

### Added
- **"Focus Follow" (Cyber Director) Mode**: Added an automated tab-switching mode. When enabled, the extension will automatically switch tabs to follow active AI channels, ensuring a seamless, waterfall-like viewing experience and bypassing browser background throttling.
- **Multilingual Support for Website**: Introduced language support for both English and Chinese in documentation and the Vitepress site.

### Fixed
- **AI Summary Button Visibility**: Fixed an issue where the "Generate Summary" button was incorrectly visible while an AI channel was still actively outputting content. Now appropriately hidden during active generation.
- **Empty Summary Bubbles**: Fixed a bug where empty summary bubbles were rendered. Content validation (using trim) is now firmly implemented to ensure clean UI rendering.
