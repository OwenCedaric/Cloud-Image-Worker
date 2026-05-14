Chronicle Design System
Positioning: A universal visual and typographic system engineered for long-form content, immersive reading, presentations, and print media.

Applicability: Web front-ends (any framework), Native Clients (iOS/Android), UI Design Software (Figma/Sketch), and Print Layouts.
0. Design Philosophy
Chromatic Austerity: The interface submits to the content. The system utilizes exactly one neutral foundation and one single accent color.
Typographic Polarity: Serif typefaces bear the responsibility of weight, pause, and emphasis. Sans-serif typefaces carry the flow of the narrative. These boundaries are absolute.
Vacuum as Rhythm: Massive vertical physical space acts as punctuation for reading psychology. Whitespace is the breathing room of the narrative.
1. Global Design Tokens & Foundation
1.1 Semantic Color System
Core Narrative Palette (HEX Reference):
Base Surface: Light #fbf9f6 | Dark #1c1f26. (Page background, left chat bubble fill).
Primary Ink: Light #3d4451 | Dark #d2d6dd. (Body paragraphs, headings, right chat bubble).
Secondary Ink: Light #757d8a | Dark #a0a7b4. (Captions, dimmed modifiers, inline quotes).
Sole Accent: Light #82a1b9 | Dark #9cb4cd. (Highlighted keywords, text selection background, progress fills. Never use as a background block fill.)
Subtle Border: 20% Opacity of Primary Ink. (Hairline dividers, watermark icons).
Subtle Fill: 8% Opacity of Primary Ink. (Right chat bubble, inset blocks).
Stroke Tint: 60% Opacity of Primary Ink. (Outer outline for hollow display text).
UI Structural Grays:

Used strictly for system controls decoupled from the reading flow (e.g., floating menus). Floating overlays requiring a blur must use a 12px Gaussian blur, overlaid with an 80% opacity White (Light) or Dark Gray (Dark) tint.
1.2 Typography System & Mechanics
Font Families & Global Typesetting:
Narrative / Body: CJK Sans-serif (e.g., Noto Sans SC). Required weights: Light (300), Regular (400), Medium (500).
Headings / Emphasis: CJK Serif (e.g., Noto Serif SC). Required weights: SemiBold (600), Bold (700).
Alignment Constraint: All narrative text must be Left-Aligned (flush-left, ragged-right). Justify alignment is forbidden to prevent uncontrollable "rivers of whitespace."
CJK-Latin Mixed Typesetting (Pangu Spacing): A standard space (or 1/4 em gap) must be enforced between CJK characters and Latin letters/numbers to ensure reading clarity.
Edge Case Overflow: Text containers must enforce overflow-wrap: break-word (or word-break: break-word) to prevent URLs or unbroken strings from shattering the layout.
Fluid Typography Scale & Leading Matrix:

Fluid text scales linearly based on the viewport, without abrupt breakpoint snaps.
Micro (12px tier): Line-height ratio 1.33. (UI meta, timestamps).
Auxiliary (14px tier): Line-height ratio 1.42. (Captions, secondary labels).
Base Body (16px → 18px): Line-height ratio hard-locked at 1.85.
Subheadings (20px → 24px): Line-height ratio 1.33 - 1.4.
Major Headings (28px → 40px): Line-height ratio 1.1 - 1.2.
Giant Display (48px → 128px): Line-height ratio force-locked to 1.0 (zero extra leading).
1.3 Space, Boundaries & Degradation Protocols
Macro Layout & Safe Zones:
Horizontal Safe Zone: Content must never touch the edge of the screen. A minimum padding of 24px on the left and right is permanently required across all devices.
Width Ceilings: Core Reading Zone max-width 896px. Dialogue Zone max-width 608px. Media Controls max-width 448px.
Terminal Bottom Padding: The bottom of an article must possess massive "overscroll" breathing room, scaling from 96px on mobile up to 160px on desktop.
Touch vs. Hover Protocols:
All micro-interactions defined as "Hover" (upward floats, opacity doubling) apply to fine-pointer environments only.
On touch devices (pointer: coarse), hover states are disabled. Elements remain in their base resting state. Active/Tap states may trigger a 0.15s opacity dimming, but sticky hover anomalies must be prevented.
Z-Axis & Shadow Restraint:

Physical drop shadows are strictly prohibited within the reading flow.
Level 0: Base Surface.
Level 1: Subtle Fill (8%).
Level 2: Multi-layered text-glow matching the background color (8px/12px/16px blur) to push away underlying watermarks.
(Exception: Left Chat Bubble uses a micro-shadow: Y: 4px, Blur: 12px, Opacity: 2%).
2. Component Blueprints & Responsive Behaviors
Global Animation: Standard Ease-In-Out. Transient micro-interactions 0.15s; state changes 0.3s.
2.1 Narrative Body
Paragraphs: Sans-serif, Weight 300. Line-height 1.85. Paragraph bottom-margin forced to 1.75x the font size. Left-aligned.
Subsections (H3): Serif, Weight 600. Top margin 3x line-height; Bottom margin 1x line-height.
2.2 Inline Semantics
Symbolic Keyword: Serif 600 + Letter spacing 0.1em + Accent Color.
Dimmed Modifier: Secondary Ink Color + Weight 600.
Inline Dialogue: Plain text quotation marks + Secondary Ink Color.
Strikethrough: 50% opacity applied to the struck text. Unlike a simple deletion, the struck content remains legible — use when the original word carries meaning even after correction. The reader sees both what was said and that it was wrong.
2.3 Section Break
Desktop State ( > 768px): 96px top/bottom margins. Flanked by 1px dashed lines (Subtle Border). Center title is Serif Bold, mapped to the Major Headings tier (28px - 40px), with the anti-interference text-glow. A giant watermark (20% viewport width, 4% opacity) sits behind it.
Mobile Degradation ( ≤ 768px): The 96px margin shrinks to a proportional 64px.
Micro-Screen Degradation ( ≤ 480px): The left/right dashed lines must be hidden completely to prevent squeezing the title. Only the centered text and watermark remain.
2.4 Epigraph
A standalone typographic pause — distinct from both Section Break (which divides structure) and ordinary paragraphs (which carry narrative). Use when a single line needs to be emotionally isolated: a maxim, a quoted fragment, a thesis statement, a moment of stillness before the next movement.
Layout: Centered. Italic. Secondary Ink Color.
Isolation: Minimum 80px top and bottom margin. This space is not decorative — it is the pause itself.
Scale: Mapped to the Base Body tier (16px → 18px). Do not scale up to heading size; the Epigraph’s power comes from restraint, not size.
Usage constraint: One per major section at most. Multiple consecutive Epigraphs collapse the pause into noise.
2.5 Structured Chat Box
Desktop State: Max width 608px. Transparent background. Center vertical axis line (1px, 20% opacity). Bubbles are max 85% width. Left bubble: Base Surface, 2px top-left radius, hairline border. Right bubble: Subtle Fill (8%), 2px top-right radius, no border. Both enforce overflow-wrap: break-word. Hover floats bubble upward by 2px.
Mobile Degradation ( ≤ 640px): The central axis line vanishes. Bubble maximum width expands from 85% to 90%. Internal gap between messages shrinks from 20px to 16px.
2.6 Component Selection: Dialogue & Parallel Content
Three components handle quoted speech and parallel material. The choice is structural, not stylistic:
Inline Dialogue — when quoted speech is embedded in the flow of a paragraph and does not need to be spatially separated from its surrounding prose. The reader moves through it without stopping.
Chat Box — when an exchange between two parties needs to be lifted out of the prose and read as its own spatial event. Use for multi-turn back-and-forth, or when the exchange itself is the focus rather than an illustration of something else.
Dual-Column Layout — when two bodies of content need to exist simultaneously and be read in parallel, not sequentially. Use for contrast, comparison, or juxtaposition where the spatial relationship between the two columns is part of the meaning.
If the content can be read as a single thread, use Inline Dialogue. If it needs to breathe as a contained exchange, use Chat Box. If it demands side-by-side simultaneity, use Dual-Column.
2.7 Hero Frame & Hollow Stroke Title
Hollow Stroke: Text fill is transparent. Outline is drawn using a 1px Stroke Tint (60%). Rendering order must draw the stroke behind the fill boundary.
Geometric Anchor: At the absolute bottom Z-layer of the initial viewport, center a perfect circle (80vmin diameter, hairline border).
2.8 Terminal Coda (Visual Breathing Space)
Isolation: Minimum 80px top margin.
Framing Rows (Top/Bottom): Mapped to the Auxiliary tier (14px - 18px). Serif, Secondary Ink. Extreme letter-tracking (0.1em+).
Focal Anchor: Mapped to the Giant Display tier (48px - 128px). A single Hollow Stroke character, buffered by vertical margins.
2.9 Dual-Column Layout
Desktop State: 50:50 grid, 32px gap. Column max-width 384px.
Mobile Degradation ( ≤ 768px): Columns collapse into a vertical stack (100% width for each). The spacing between the collapsed sections must match the standard 1.75em paragraph gap.
2.10 Interactive Media Components
UI Typography Mapping: Track names map to the Auxiliary tier (14px). Timestamps map to the Micro tier (12px) with Tabular Numerals.
Progress Track: Height 4px (Subtle Fill). Hovering (fine-pointer only) inflates the inner Accent bar to 6px and shifts it upward by 1px (0.15s).
Cover Images: By default, full-width narrative images apply a 100% Grayscale filter. Hovering smoothly restores full color.
3. Cross-Medium Adaptations
Presentations (PPT / Keynote):
Maximum 3 colors per slide: Base Surface, Primary Ink, and Sole Accent. No additional colors under any circumstance. Background locked to Base Surface. No software shadows.
Body text must use Sans-serif Light (300). Line spacing locked at 1.8.
If text overflows the slide, cut the text. Compressing line spacing to fit more text is forbidden.
Résumés (Print / PDF CV):
Base Surface maps to pure white. Subtle Fill maps to pale gray (#f5f5f5). Accent color (#82a1b9) remains.
Line-height minimum is 1.7. Expanding to a spacious two-page layout is strictly required over a compressed one-page layout.
4. Agnostic AI Generation Prompts
When instructing LLMs or UI generators to build interfaces, use these conceptual prompts:
Narrative Body:
"Generate a reading layout. Constraints: Horizontal safe zone of 24px padding on both sides. Body font MUST be Light weight (300) Sans-serif, Left-Aligned (NO Justify allowed). Add a standard space between CJK characters and Latin words. Line-height locked at 1.85. Paragraph bottom margin is 1.75x font size. Max container width 896px."
Section Break:
"Generate a major divider. Top/bottom margins are 96px (degrading to 64px on mobile). Flank the center with 1px dashed lines (Hide these lines on screens ≤ 480px). The center title is Serif Bold (28-40px fluid size) with a background-color text-shadow. Place a giant abstract icon at 4% opacity behind the title."
Structured Chat Box:
"Generate a two-party dialogue component. Max width 608px. Left bubble is left-aligned, Base Surface background, hairline border, 2px top-left radius. Right bubble is right-aligned, 8% Subtle Fill background, no border, 2px top-right radius. Both must enforce break-word. On screens ≤ 640px, expand bubble max-width to 90%."
5. Hard Constraints
Alignment Contamination: All body text must be Left-Aligned. Justify is strictly forbidden.
Chromatic Contamination: The "Sole Accent" is the ONLY color allowed. Introducing blue, green, red, or yellow warning colors is absolutely prohibited.
Body Weight Lockdown: Narrative paragraphs must always be set to 300 / Light weight. Weights ≥ 400 are quarantined to UI elements or headings.
Line-Height Collapse: The body text line-height ratio must never drop below 1.85.
Shadow Abuse: Content containers within the reading flow must never use physical drop shadows.
Visual Field Ceiling: The maximum width of narrative text must never exceed 896px. The text must never touch the screen edge (minimum 24px horizontal safe zone required).
CJK Formatting: A space must always separate CJK characters from Latin letters/numerals to prevent visual crowding.