---
name: TutorInvoice
description: A minimal, refined invoicing tool for solo tutoring businesses.
colors:
  neutral-white: "oklch(1 0 0)"
  neutral-ink: "oklch(0.145 0 0)"
  neutral-surface: "oklch(0.97 0 0)"
  neutral-border: "oklch(0.922 0 0)"
  neutral-muted: "oklch(0.556 0 0)"
  accent-primary: "oklch(0.40 0.08 250)"
  accent-destructive: "oklch(0.577 0.245 27.325)"
typography:
  display:
    fontFamily: "Geist, system-ui, -apple-system, sans-serif"
    fontSize: "clamp(1.75rem, 5vw, 2.5rem)"
    fontWeight: 600
    lineHeight: 1.2
  heading:
    fontFamily: "Geist, system-ui, -apple-system, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Geist, system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  md: "8px"
  lg: "10px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent-primary}"
    textColor: "{colors.neutral-white}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.neutral-ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  input-default:
    backgroundColor: "{colors.neutral-white}"
    textColor: "{colors.neutral-ink}"
    rounded: "{rounded.md}"
    padding: "8px 10px"
  card-default:
    backgroundColor: "{colors.neutral-white}"
    textColor: "{colors.neutral-ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
---

# Design System: TutorInvoice

## 1. Overview

**Creative North Star: "The Expert's Desktop"**

This system is built for a solo business owner who values clarity, control, and speed. Every interface element serves a purpose—there is no decoration, no animation for its own sake, no visual noise. The palette is neutral and grounded, with a single refined accent color used sparingly to draw focus to the most important interactions (links, active navigation, primary actions). The typography is clear and readable without fussiness; components are minimal, with subtle depth cues (shadows and borders) that signal state without demanding attention.

The design philosophy rejects startup-trendy aesthetics (no gradients, glassmorphism, or decorative animations), overly corporate formality (no dark, intimidating interfaces), and generic UI-kit defaults (every element is considered). This is a working tool that feels like it was designed by someone who understands the user's job.

**Key Characteristics:**
- Neutral, grayscale foundation with one refined accent color
- Clean, purposeful hierarchy—nothing uniform, nothing redundant
- Minimal shadows and subtle hover states for interactivity feedback
- No decorative elements; every pixel has a function
- Fast, efficient workflows with clear visual order

## 2. Colors

The palette is neutral by design, signaling clarity and professionalism. A single refined accent color (slate-teal) guides focus and highlights key interactions.

### Primary (Accent)
- **Slate-Teal** (oklch(0.40 0.08 250)): Active navigation, primary buttons, links, highlights. This refined blue-grey feels professional and timeless—intentionally muted compared to web-default bright blue, giving the interface an "expert" feel rather than a startup sheen.

### Neutral
- **Pure White** (oklch(1 0 0)): Backgrounds, cards, surfaces. Clean slate for content.
- **Near-Black** (oklch(0.145 0 0)): Body text, headings, primary ink color. High contrast with white backgrounds for readability (WCAG AA+).
- **Near-White** (oklch(0.97 0 0)): Secondary surfaces (secondary buttons, disabled states), slight visual separation without clutter.
- **Light Grey** (oklch(0.922 0 0)): Borders, dividers, input backgrounds, subtle visual boundaries.
- **Medium Grey** (oklch(0.556 0 0)): Muted text (placeholder text, helper text, secondary labels), secondary hierarchy.

### Destructive
- **Red-Orange** (oklch(0.577 0.245 27.325)): Delete confirmations, error states, warnings. Warm and unmistakable, but muted enough not to feel aggressive.

### Named Rules

**The Restraint Rule.** The accent color (slate-teal) appears on ≤10% of any screen—active tabs, a primary CTA, a link. Its rarity is the entire point: when it appears, it commands focus. Backgrounds, borders, and body text remain neutral. Overuse dilutes the signal.

**The Contrast Rule.** All text must meet WCAG AA minimum (4.5:1 for normal text, 3:1 for large text). Muted text on white backgrounds reaches exactly 4.5:1 (oklch(0.556 0 0) on oklch(1 0 0)); avoid lighter grays. Placeholder text carries the same contrast floor—no ultra-light placeholders.

## 3. Typography

**Display Font:** Geist (with system-ui, -apple-system, sans-serif fallback)  
**Body Font:** Geist (same family in lighter weight)  
**Accent/Mono Font:** None; the system uses Geist for all type roles.

**Character:** Geist is a modern, geometric sans-serif with excellent legibility and a clean, intentional feel. The single-family approach (varying only weight and size) keeps the interface calm and unified. No serif/sans mixing, no decorative fonts.

### Hierarchy
- **Display** (600 weight, clamp(1.75rem–2.5rem)): Page titles, hero headlines. Rare; only the primary heading on a screen uses this size.
- **Heading** (600 weight, 1.25rem, line-height 1.3): Section titles, card headers, dialog titles. Clears a subsection's purpose.
- **Body** (400 weight, 1rem, line-height 1.5): Paragraph text, table cells, form labels, general prose. Capped at ~65–75 characters per line for readability.
- **Label** (500 weight, 0.875rem, line-height 1.4): Form field labels, badges, secondary metadata, helper text. Slightly bolder than body to distinguish its semantic role.

### Named Rules

**The Weight Rule.** Only two weights in active use: 400 (body) and 600 (headings/labels). No 300, no 700, no weight games. Hierarchy comes from size and color, not thickness.

**The Line-Length Rule.** Body text and prose maxes at 75 characters per line. Narrow text blocks (forms, labels) may be shorter. Tables and lists vary by content, but always readable. Narrow columns collapse at mobile; readability is non-negotiable.

## 4. Elevation

This system is **flat-by-default with minimal, purposeful shadows**. Depth is conveyed primarily through borders and color layering, not shadows. Shadows appear only as state feedback (hover, focus, active modals) to signal interactivity without adding visual weight at rest.

### Shadow Vocabulary
- **Subtle Lift** (`box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06)`): Hover state on buttons, input focus. Minimal, soft. Signals that the element is interactive without drawing the eye away from content.
- **Focused Glow** (`box-shadow: 0 0 0 3px oklch(0.40 0.08 250 / 20%)`): Focus ring on buttons and inputs. A thin halo in the accent color, at reduced opacity, for keyboard navigation visibility.

### Named Rules

**The Flat-by-Default Rule.** At rest, every surface is flat. No drop shadows, no ambient glows, no layered depth illusion. Borders and background color alone define structure. Shadows appear only as a response to state (hover, focus, active modal), and they fade immediately when the state ends. This keeps the interface calm and lets content breathe.

**The Focus Rule.** Every interactive element (button, input, link, tab) has a visible focus state. Buttons receive a subtle glow; inputs receive a border shift or a soft ring. Keyboard users must never lose track of where focus is.

## 5. Components

### Buttons

**Shape:** Rounded corners (8px), giving a softer, more refined feel than sharp corners without the playfulness of heavily rounded buttons.

**Primary** (Slate-Teal bg, white text, 8px × 16px padding):
- Padding: 8px 16px (h-8)
- Background: oklch(0.40 0.08 250)
- Text: white, 0.875rem, 500 weight
- Hover: Slightly darker overlay or reduced opacity; subtle lift shadow
- Focus: 3px ring in accent color at 20% opacity
- Active: A tiny downward offset (1–2px) or slight darkening

**Secondary** (Light grey bg, dark text, 8px × 16px padding):
- Padding: 8px 16px
- Background: oklch(0.97 0 0)
- Text: oklch(0.145 0 0), 0.875rem, 500 weight
- Hover: Slightly darker background or border shift
- Focus: Same ring as primary

**Ghost** (No background, dark text):
- Padding: 8px 16px
- Background: transparent
- Text: oklch(0.145 0 0), 0.875rem, 500 weight
- Hover: Light background fill or text emphasis
- Focus: Same ring as primary

**Destructive** (Red-orange, subtle):
- Background: oklch(0.577 0.245 27.325 / 15%) at rest, slightly darker on hover
- Text: oklch(0.577 0.245 27.325)
- Hover: Opacity increase or background darkening
- Used sparingly for delete/cancel flows

### Inputs & Fields

**Style:**
- Background: white (oklch(1 0 0))
- Border: 1px solid oklch(0.922 0 0) (light grey)
- Height: 32px (8px padding, proportional to buttons)
- Radius: 8px
- Text: oklch(0.145 0 0), 1rem base, 400 weight
- Placeholder: oklch(0.556 0 0), same size, 4.5:1 contrast with white

**Focus State:**
- Border shifts to oklch(0.40 0.08 250) (accent color)
- Ring: 3px oklch(0.40 0.08 250 / 20%) for a soft glow
- Subtle lift shadow (same as button hover)

**Error State:**
- Border: oklch(0.577 0.245 27.325) (destructive)
- Ring: 3px oklch(0.577 0.245 27.325 / 20%)
- Helper text in destructive color

**Disabled State:**
- Background: oklch(0.922 0 0 / 50%)
- Text: oklch(0.556 0 0)
- Border: oklch(0.922 0 0)
- Cursor: not-allowed

### Cards / Containers

**Corner Style:** 10px radius (slightly larger than buttons for a softer, contained feel).

**Background:** White (oklch(1 0 0)) or near-white (oklch(0.97 0 0)) for nested containers.

**Shadow Strategy:** Flat at rest. On hover or interactive focus (dashboard rows, expandable sections), apply the Subtle Lift shadow.

**Border:** 1px solid oklch(0.922 0 0) to define edges without harsh lines. No thick borders.

**Internal Padding:** 16px for typical cards; 8px for tight table cells. Consistent breathing room, not cramped.

### Navigation

**Top Navigation (Horizontal Tab-Style):**
- Layout: Flex row, gap-6 spacing
- Default: Text in medium grey (oklch(0.556 0 0)), no underline
- Hover: Text in darker grey (oklch(0.205 0 0)) for feedback
- Active: Text in accent (oklch(0.40 0.08 250)), underline border-bottom (2px) in accent color, subtle inset offset
- Transition: Smooth color and border transition (~150–200ms)

**Keyboard Navigation:**
- Tab order follows visual left-to-right flow
- Focus ring on each nav item matches button focus ring

### Tables

**Style:** Clean, minimal rows. No background shading on alternating rows unless data density requires it.

- Header row: Medium grey text (oklch(0.556 0 0)) on white, 500 weight, uppercase or title-case labels
- Body rows: Dark text (oklch(0.145 0 0)) on white, 400 weight
- Row separator: 1px border (oklch(0.922 0 0)) between rows, light and unobtrusive
- Hover state: Subtle background tint (oklch(0.97 0 0)) or hover shadow on interactive rows
- Density: Typical cell padding 12px vertical, 16px horizontal; adjust for mobile to maintain readability

### Dialogs & Modals

**Backdrop:** Semi-transparent dark (oklch(0 0 0 / 30%)), dims the background without fully obscuring it.

**Dialog Body:**
- Background: White (oklch(1 0 0))
- Radius: 10px
- Padding: 24px
- Shadow: Subtle lift shadow + a slightly more pronounced shadow (0 10px 32px rgba(0, 0, 0, 0.10)) to lift the modal above the backdrop
- Border: None (shadow alone defines elevation)

**Dialog Header & Footer:** Consistent typography and spacing; buttons follow the button component rules above.

## 6. Do's and Don'ts

### Do:

- **Do** use the slate-teal accent (oklch(0.40 0.08 250)) for interactive focus—active navigation, primary CTAs, links. Keep it ≤10% of any screen.
- **Do** maintain high contrast: body text on white must be oklch(0.145 0 0) or darker; muted text reaches at least 4.5:1 (oklch(0.556 0 0)).
- **Do** keep backgrounds white or near-white (oklch(1 0 0) or oklch(0.97 0 0)). Tinted or warm-beige backgrounds are forbidden.
- **Do** use 8px and 16px as your foundational spacing scale. 24px and 32px for larger gaps.
- **Do** use 8px border radius for buttons and inputs, 10px for cards. Consistent, gentle, not sharp.
- **Do** apply subtle shadows (Subtle Lift) only on hover or focus, never at rest. Flat at rest is the rule.
- **Do** keep typography to one family (Geist) in two weights (400 and 600). No decorative fonts, no serif/sans mixing.
- **Do** limit display headlines to the page title; every screen has one primary heading, not several competing for focus.
- **Do** ensure every interactive element (button, input, link, tab) has a visible focus ring for keyboard users (3px ring at 20% opacity in the accent color).

### Don't:

- **Don't** use the default bright blue (web-default blue-600). The system's accent is a refined slate-teal, intentionally muted for professionalism.
- **Don't** use startup-trendy effects: no gradients, no glassmorphism, no decorative animations. Animations are for state feedback only (fade, slide).
- **Don't** layer unnecessary shadows or add depth effects "for visual interest." Flat is the starting point; add depth only in response to state.
- **Don't** use light grey for body text. Dark text on white is mandatory for readability and WCAG AA compliance.
- **Don't** use warm or cream-tinted backgrounds (the "warm-neutral" default of 2026). Backgrounds are pure white or near-white, cool and clean.
- **Don't** create uniform card grids with identical visual weight. Vary hierarchy and spacing to guide the eye to what matters.
- **Don't** add decorative icons, illustrations, or flourishes. Icons are functional; no ornament.
- **Don't** make buttons, inputs, or cards overly rounded (>12px radius). A 8–10px radius is refined; anything more looks playful or dated.
- **Don't** create dense, cramped layouts. Generous padding and breathing room are part of the "expert desktop" feel.
- **Don't** override focus states or hide focus rings "for aesthetics." Keyboard users depend on them; they are not optional.
