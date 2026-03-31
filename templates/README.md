# Shift07 HTML Templates

Reusable snippets for building new pages on shift07.ai.

## Files

### `head.html`
Standard `<head>` content: charset, viewport, Google Analytics (G-K1S1RXBDS8), Google AdSense (ca-pub-8475857002943858), Inter font, and Tailwind CDN. Copy into every new page's `<head>` tag.

### `nav.html`
Standard navigation bar with links to SEO-Tool (/), Blog (/blog/), Tools (/tools/), and Anmelden (/app/#/login). Includes mobile hamburger menu. Set the active page link to `text-blue-300` (remove `hover:text-blue-300`).

### `footer.html`
Standard footer with copyright and links to Impressum, Datenschutz, and AGB.

### `tool-page.html`
Complete template for creating new tool pages. Replace these placeholders:

| Placeholder | Description | Example |
|---|---|---|
| `{{TOOL_NAME}}` | Tool display name | `Meta Tag Generator` |
| `{{TOOL_SLUG}}` | URL-safe filename (no extension) | `meta-tag-generator` |
| `{{TOOL_ACTION}}` | What the tool does (for title) | `Meta-Tags erstellen` |
| `{{TOOL_DESCRIPTION}}` | Meta description (max 160 chars) | `Erstelle kostenlos...` |
| `{{TOOL_KEYWORDS}}` | Comma-separated keywords | `Meta Tags, SEO, ...` |
| `{{TOOL_SUBTITLE}}` | Hero subtitle text | `Erstelle kostenlos...` |
| `{{CROSS_SELL_TITLE}}` | CTA box heading | `Meta-Tags richtig eingebaut?` |
| `{{CROSS_SELL_TEXT}}` | CTA box description | `Prufe ob deine...` |
| `{{TIPS_TITLE}}` | Explanation section heading | `Meta-Tags erklaert` |

## Usage

1. Copy `tool-page.html` to `/tools/your-tool-name.html`
2. Replace all `{{PLACEHOLDER}}` values
3. Add form fields in the input section
4. Add JavaScript logic at the bottom
5. Add explanation cards in the tips section
6. Add the tool to `/tools/index.html` (if it exists)

## Tracking IDs

- **Google Analytics**: `G-K1S1RXBDS8`
- **Google AdSense**: `ca-pub-8475857002943858`
