# Frontend Design References — Index

Optional references for the frontend skill. Read one when the direction calls for it: the user names a brand or a style, or the work needs one of the mechanics below. Read the file you chose closely enough to carry its decisions into the page.

## Styles

From [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill). Each describes one way to execute a page; use one at a time.

| File | What it is | Read when |
|---|---|---|
| `taste-skill.md` | A broad anti-template style with dials for layout variance, motion and density. Long. | The user asks for a polished landing page or portfolio and names no style. |
| `gpt-tasteskill.md` | A stricter variant tuned for GPT: high-variance layouts, strong GSAP motion. | The user asks for a bold, award-style site with scroll-driven scenes. |
| `soft-skill.md` | Calm and expensive-looking: soft contrast, generous whitespace, spring motion. | "Premium", "calm", "luxurious", "boutique". |
| `minimalist-skill.md` | Editorial product UI in the manner of Notion and Linear: monochrome, crisp structure. | "Minimal", "clean", "editorial". |
| `brutalist-skill.md` | Swiss typography, sharp contrast, raw structure. | "Brutalist", "raw", "Swiss", "industrial". |
| `redesign-skill.md` | Audits an existing UI and fixes layout, spacing, hierarchy, color and type in place. | The user wants an existing page improved, not replaced. |
| `image-to-code-skill.md` | Generates reference images, analyzes them, then builds to match. Pair with an imagegen file. | The user wants the design generated as images first. |
| `output-skill.md` | Insists on complete output: no placeholders or TODOs. | The work keeps coming back unfinished. |
| `stitch-skill.md` | Google Stitch design rules and DESIGN.md export; a worked export is in `stitch-design-example.md`. | The user works with Google Stitch. |

### Image generation (images only, no code)

| File | What it is |
|---|---|
| `imagegen-frontend-web.md` | Website mockup images. |
| `imagegen-frontend-mobile.md` | Mobile screen concepts and flows. |
| `imagegen-brandkit.md` | Brand-kit boards: logo directions, color, type, mockups. |

## Mechanics

| File | What it is | Read when |
|---|---|---|
| `design-system-architecture.md` | The layout of a DESIGN.md and how to create one for a new or existing project. | The work creates or extracts a reusable design system. |
| `layout-skill.md` | Scroll ownership, two CSS contracts that fail silently, layout under real content. | App shells, dashboards, split panes, layouts that break with long or empty content. |
| `interaction-skill.md` | Interaction mechanics taken from the beui.dev catalog and adapted to the project. | Adding or changing micro-interactions, transitions or gestures. |
| `stylegallery.md` | Lookup of named spatial patterns with their constraints. | A concrete layout problem needs a known pattern. |
| `lazyweb.md` | Lookup of real product screens for research. | Looking for how real products handle a screen. |
| `clone-from-url.md` | Extracting a live site's styles in the browser to clone it. | A live site is the target. |
| `print-paged-media.md` | Paged media for print and PDF. | The output is printed or exported as pages. |

## Brands (70)

Most brand files come from [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md), in the [Google Stitch DESIGN.md format](https://stitch.withgoogle.com/docs/design-md/overview/). Each captures one site's visual language: palette, type, components, spacing, depth and do's and don'ts. When the user points to a brand, read its file and borrow the decisions that give it character; apply them to this project's own content.

### AI & LLM Platforms (12)

| File | Aesthetic |
|---|---|
| `claude.md` | Anthropic's AI assistant. Warm terracotta accent, parchment canvas, literary salon mood, clean editorial layout. |
| `cohere.md` | Enterprise AI platform. Vibrant gradients, data-rich dashboard aesthetic. |
| `elevenlabs.md` | AI voice platform. Dark cinematic UI, audio-waveform aesthetics. |
| `minimax.md` | AI model provider. Bold dark interface with neon accents. |
| `mistral.ai.md` | Open-weight LLM provider. French-engineered minimalism, purple-toned. |
| `ollama.md` | Run LLMs locally. Terminal-first, monochrome simplicity. |
| `opencode.ai.md` | AI coding platform. Developer-centric dark theme. |
| `replicate.md` | Run ML models via API. Clean white canvas, code-forward. |
| `runwayml.md` | AI video generation. Cinematic dark UI, media-rich layout. |
| `together.ai.md` | Open-source AI infrastructure. Technical, blueprint-style design. |
| `voltagent.md` | AI agent framework. Void-black canvas, emerald accent, terminal-native. |
| `x.ai.md` | Elon Musk's AI lab. Stark monochrome, futuristic minimalism. |

### Developer Tools & IDEs (8)

| File | Aesthetic |
|---|---|
| `aside.md` | AI browser agent. Bright product-app marketing, custom display type, soft squircle controls, browser-product framing. |
| `cursor.md` | AI-first code editor. Sleek dark interface, gradient accents. |
| `expo.md` | React Native platform. Dark theme, tight letter-spacing, code-centric. |
| `lovable.md` | AI full-stack builder. Playful gradients, friendly dev aesthetic. |
| `raycast.md` | Productivity launcher. Sleek dark chrome, vibrant gradient accents. |
| `superhuman.md` | Fast email client. Premium dark UI, keyboard-first, purple glow. |
| `vercel.md` | Frontend deployment platform. Black and white precision, Geist font. |
| `warp.md` | Modern terminal. Dark IDE-like interface, block-based command UI. |

### Backend, Database & DevOps (9)

| File | Aesthetic |
|---|---|
| `clickhouse.md` | Fast analytics database. Yellow-accented, technical documentation style. |
| `composio.md` | Tool integration platform. Modern dark with colorful integration icons. |
| `hashicorp.md` | Infrastructure automation. Enterprise-clean, black and white. |
| `mongodb.md` | Document database. Green leaf branding, developer documentation focus. |
| `posthog.md` | Product analytics. Playful hedgehog branding, developer-friendly dark UI. |
| `sanity.md` | Headless CMS. Red accent, content-first editorial layout. |
| `sentry.md` | Error monitoring. Dark dashboard, data-dense, pink-purple accent. |
| `supabase.md` | Open-source Firebase alternative. Dark emerald theme, code-first. |

### Productivity & SaaS (7)

| File | Aesthetic |
|---|---|
| `cal.md` | Open-source scheduling. Clean neutral UI, developer-oriented simplicity. |
| `intercom.md` | Customer messaging. Friendly blue palette, conversational UI patterns. |
| `linear.app.md` | Project management for engineers. Ultra-minimal, precise, purple accent. |
| `mintlify.md` | Documentation platform. Clean, green-accented, reading-optimized. |
| `notion.md` | All-in-one workspace. Warm minimalism, serif headings, soft surfaces. |
| `resend.md` | Email API for developers. Minimal dark theme, monospace accents. |
| `zapier.md` | Automation platform. Warm orange, friendly illustration-driven. |

### Design & Creative Tools (6)

| File | Aesthetic |
|---|---|
| `airtable.md` | Spreadsheet-database hybrid. Colorful, friendly, structured data aesthetic. |
| `clay.md` | Creative agency. Organic shapes, soft gradients, art-directed layout. |
| `figma.md` | Collaborative design tool. Vibrant multi-color, playful yet professional. |
| `framer.md` | Website builder. Bold black and blue, motion-first, design-forward. |
| `miro.md` | Visual collaboration. Bright yellow accent, infinite canvas aesthetic. |
| `webflow.md` | Visual web builder. Blue-accented, polished marketing site aesthetic. |

### Fintech & Crypto (7)

| File | Aesthetic |
|---|---|
| `binance.md` | Crypto exchange. Bold Binance Yellow on monochrome, trading-floor urgency. |
| `coinbase.md` | Crypto exchange. Clean blue identity, trust-focused, institutional feel. |
| `kraken.md` | Crypto trading platform. Purple-accented dark UI, data-dense dashboards. |
| `mastercard.md` | Global payments network. Warm cream canvas, orbital pill shapes, editorial warmth. |
| `revolut.md` | Digital banking. Sleek dark interface, gradient cards, fintech precision. |
| `stripe.md` | Payment infrastructure. Signature purple gradients, weight-300 elegance. |
| `wise.md` | International money transfer. Bright green accent, friendly and clear. |

### E-commerce & Retail (5)

| File | Aesthetic |
|---|---|
| `airbnb.md` | Travel marketplace. Warm coral accent, photography-driven, rounded UI. |
| `meta.md` | Tech retail store. Photography-first, binary light/dark surfaces, Meta Blue CTAs. |
| `nike.md` | Athletic retail. Monochrome UI, massive uppercase Futura, full-bleed photography. |
| `shopify.md` | E-commerce platform. Dark-first cinematic, neon green accent, ultra-light display type. |
| `starbucks.md` | Coffee retail flagship. Four-tier earth-green system, warm cream canvas, SoDoSans typography. |

### Media & Consumer Tech (11)

| File | Aesthetic |
|---|---|
| `apple.md` | Consumer electronics. Premium white space, SF Pro, cinematic imagery. |
| `ibm.md` | Enterprise technology. Carbon design system, structured blue palette. |
| `nvidia.md` | GPU computing. Green-black energy, technical power aesthetic. |
| `pinterest.md` | Visual discovery platform. Red accent, masonry grid, image-first. |
| `playstation.md` | Gaming console retail. Three-surface channel layout, cyan hover-scale interaction. |
| `spacex.md` | Space technology. Stark black and white, full-bleed imagery, futuristic. |
| `spotify.md` | Music streaming. Vibrant green on dark, bold type, album-art-driven. |
| `theverge.md` | Tech editorial media. Acid-mint and ultraviolet accents, Manuka display type. |
| `uber.md` | Mobility platform. Bold black and white, tight type, urban energy. |
| `vodafone.md` | Global telecom brand. Monumental uppercase display, Vodafone Red chapter bands. |
| `wired.md` | Tech magazine. Paper-white broadsheet density, custom serif, ink-blue links. |

### Automotive (6)

| File | Aesthetic |
|---|---|
| `bmw.md` | Luxury automotive. Dark premium surfaces, precise German engineering aesthetic. |
| `bugatti.md` | Luxury hypercar. Cinema-black canvas, monochrome austerity, monumental display type. |
| `ferrari.md` | Luxury automotive. Chiaroscuro black-white editorial, Ferrari Red with extreme sparseness. |
| `lamborghini.md` | Luxury automotive. True black cathedral, gold accent, LamboType custom Neo-Grotesk. |
| `renault.md` | French automotive. Vivid aurora gradients, NouvelR proprietary typeface, zero-radius buttons. |
| `tesla.md` | Electric vehicles. Radical subtraction, cinematic full-viewport photography, Universal Sans. |

### By mood

When the user describes a feeling rather than a brand, these files are a place to start.


- **"Premium / luxurious / expensive"** → `apple.md`, `stripe.md`, `vercel.md`, `linear.app.md`
- **"Editorial / paper-like / readable"** → `notion.md`, `wired.md`, `claude.md`
- **"Brutal / Swiss / industrial"** → `nike.md`, `bugatti.md`, `vodafone.md`
- **"Dark cinematic"** → `runwayml.md`, `elevenlabs.md`, `superhuman.md`, `shopify.md`
- **"Terminal / developer-native"** → `vercel.md`, `warp.md`, `voltagent.md`, `ollama.md`
- **"AI browser / agentic browser / product-app launch"** → `aside.md`, `raycast.md`, `superhuman.md`
- **"Warm / approachable / soft"** → `airbnb.md`, `notion.md`, `intercom.md`, `mastercard.md`
- **"Data-dense / dashboard"** → `sentry.md`, `kraken.md`, `posthog.md`, `clickhouse.md`
- **"Bold / sporty / monochrome punch"** → `nike.md`, `uber.md`, `tesla.md`, `binance.md`
- **"Playful / colorful / friendly"** → `figma.md`, `airtable.md`, `zapier.md`, `lovable.md`
