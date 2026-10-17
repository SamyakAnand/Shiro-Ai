---
name: SHIRO CodeMind
description: A source-grounded codebase workspace with Shiro at its center.
colors:
  midnight: "#090711"
  panel: "#110F1C"
  panel-raised: "#191628"
  ink: "#F6F1FF"
  secondary-ink: "#B8B1C9"
  line: "#342D4A"
  cyan: "#54E6F5"
  violet: "#A47CFF"
  pink: "#F98BE7"
  success: "#6FE7C5"
  warning: "#FFD37B"
  error: "#FF7E9D"
typography:
  display:
    fontFamily: "Switzer, Inter, Segoe UI, sans-serif"
    fontSize: "clamp(1.5rem, 2.1vw, 2rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Switzer, Inter, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
  code:
    fontFamily: "Cascadia Code, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.65
rounded:
  sm: "8px"
  md: "13px"
  lg: "18px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.cyan}"
    textColor: "{colors.midnight}"
    rounded: "{rounded.md}"
    padding: "10px 15px"
    height: "42px"
  button-quiet:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 11px"
  input-chat:
    backgroundColor: "{colors.midnight}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
  nav-selected:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.cyan}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
---

# Design System: SHIRO CodeMind

## Overview

**Creative North Star: "Shiro's Code Observatory"**

The workspace feels like a quiet, precise place to inspect a live codebase. Shiro is the recognizable guide, shown from the user's supplied local art, while the source, repository context, and evidence remain the primary working material. The surface uses a dark midnight foundation, icy text, and concentrated cyan and violet light to connect the art to the developer tool.

The character is expressive only when actual application state changes. The code interface stays familiar and calm: standard navigation, tabs, search fields, source panels, and citations. Translucent surfaces are reserved for the character stage and layered workspace panels; neon is an accent that marks state and focus rather than a glow on every control.

**Key Characteristics:**

- Shiro's supplied portrait is visible in the primary workspace, not hidden in a launcher.
- Chat, real evidence, repository files, graph, and investigations share one app shell.
- Cyan and violet distinguish active focus and character identity; state colors remain semantic.
- Source snippets use a dedicated monospace voice and remain easy to verify.

## Colors

Midnight ink sets the work surface; icy text carries dense code-related content, with cyan and violet reserved for interaction and SHIRO identity.

### Primary
- **Signal Cyan** (`#54E6F5`): Primary actions, focus, selected navigation, and active evidence references.
- **Shiro Violet** (`#A47CFF`): Character-stage edge light, secondary selection, and graph emphasis.

### Secondary
- **Aurora Pink** (`#F98BE7`): A small expressive accent in the character/art layer; not used for ordinary action states.

### Neutral
- **Midnight Ink** (`#090711`): App background and deepest workspace surface.
- **Dark Panel** (`#110F1C`): Main work area.
- **Raised Panel** (`#191628`): Selected rows, message surfaces, and raised controls.
- **Icy Text** (`#F6F1FF`): Primary reading color.
- **Lavender Text** (`#B8B1C9`): Supporting copy and metadata.
- **Violet Line** (`#342D4A`): Panel dividers and quiet outlines.

### Named Rules
**The Evidence-First Rule.** Accent glow cannot outrank question text, code, or source citations. Use semantic green, amber, and red only for real success, warning, and error states.

## Typography

Switzer remains the interface face, with system fallbacks. Cascadia Code or Consolas is reserved for source code, file paths, and measured technical values. Keep body copy compact but readable and avoid using monospace as decoration.

## Layout

The desktop shell uses four columns: a 64–72px feature rail, a 220–270px repository list, a flexible conversation/work area, and a 260–320px Shiro stage. The central work area gets the largest share. Below tablet width the Shiro stage becomes compact; phone layouts prioritize the conversation and place primary feature navigation at the bottom while keeping repository selection reachable.

Use a 4/8/12/16/24/32px spacing rhythm. Keep the viewport as the app canvas; long conversations, source files, repository lists, and graphs scroll in their own regions rather than extending the marketing page.

## Elevation & Depth

Depth comes from three dark surface values and thin violet-gray dividers. A broad, soft shadow is reserved for the connect dialog and focused popovers. Cyan/violet bloom is localized behind the portrait and active state; avoid stacked shadows or constant whole-screen glow.

## Shapes

Use clean rectangles with 8–18px corners for workspace panels, 8–13px for controls and messages, and pills only for compact status chips. Outlines remain 1px. The character artwork stays uncropped where practical and is never masked into a fake 3D figure.

## Components

### Buttons
- Primary actions use a cyan fill and dark text; quiet actions use a raised panel with a visible focus outline.
- Icon-only navigation has an accessible name and a selected state, with labels shown on hover/focus or beside the icon.

### Navigation and repository list
- Navigation clearly communicates Ask, Files, Connections, and Investigations using familiar web controls.
- The selected repository stays visible near the workspace header. Empty state uses a real connect action and no invented repository data.

### Conversation and evidence
- Assistant messages and user messages have distinct alignment and surfaces.
- Evidence opens real indexed paths and excerpts. The answer and evidence remain visually connected.
- Loading, insufficient evidence, success, and network errors are explicit; Shiro's expression follows those actual states.

### Character stage
- Use the existing Shiro portrait and matching local expressions. A small avatar remains beside the conversation; the larger stage gives the character prominence.
- Expression changes are a brief opacity transition. Do not imply rigged body or hair animation.

### Inputs
- Chat and search fields remain high contrast, keyboard accessible, and visibly focused. The chat composer never covers the last message or evidence.

## Do's and Don'ts

- Do keep the repository operations and evidence as the content of the experience.
- Do use provided artwork and label the actual answer/provider behavior accurately.
- Do keep reduced-motion users on an immediate static state.
- Don't ship marketing filler on the app's primary route.
- Don't invent metrics, code relationships, tool activity, or generated progress.
- Don't turn the workspace into a poster or fictional terminal; keep familiar developer-tool navigation and controls.
- Don't add more external assets or libraries when the current local asset and vanilla UI can do the job.
