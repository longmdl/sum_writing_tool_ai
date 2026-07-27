# SUM Pit Wall

A caption desk for the SUM Facebook page. It pulls the latest F1 and motorsport
headlines, drafts each one as a Vietnamese Facebook post in the SUM house style,
and hands it to an admin to edit and post.

The point is speed: an admin picks a story off the board, hits generate, tweaks a
line or two, copies the caption, grabs the image, and posts.

---

## How it works

```
RSS feeds  ─►  scraper  ─►  10 newest, merged + deduped  ─►  admin picks one
                                                                    │
                                     content/style-guide.md  ──►  OpenAI
                                                                    │
                                              model writes 4 fields │
                                                                    ▼
                                         app assembles fixed footer ─►  caption
```

The model only writes **headline, lead, body, closing question** (and an optional
list). The separators, `Nguồn:` credit, Discord line, hashtags, and CTA are
assembled in code from your settings, so they are identical on every post and the
source credit cannot be dropped.

### Sources

| Source | Default | Notes |
| --- | --- | --- |
| Formula 1 (official) | on | No AI restrictions. Feed has no dates or images, so each article page is read for `og:image` and `datePublished` — nothing else. |
| Motorsport.com | on | No AI restrictions. Dates and images come straight from the feed. |
| Traxion.GG | off | `Content-Signal: ai-train=no, use=reference`. Permits reference use; forbids training. |
| RaceFans | off | Same signal as Traxion. |

The two restricted sources ship **off by default** and are marked with ▲ in the
UI. This tool never trains on anything, only ever reads the publisher's own RSS
excerpt, and always prints `Nguồn:` — which is the "reference" use those
publishers permit. Enabling them is your call. Re-check `robots.txt` occasionally;
publishers change these.

**Never remove the `Nguồn:` line from a generated caption.**

---

## Setup

```bash
npm install
cp .env.example .env.local     # then paste your OpenAI key into .env.local
npm run dev
```

Open http://localhost:3000.

### Environment

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | yes | — | Get one at https://platform.openai.com/api-keys |
| `OPENAI_MODEL` | no | `gpt-4o` | Any OpenAI model supporting JSON response format |

Without a key the feed still loads and browses fine; only generation fails, with
a message saying so.

---

## Changing the writing style

Edit **`content/style-guide.md`**. That file *is* the system prompt — it defines
the voice, the Vietnamese conventions, which proper nouns stay in English, the
post structure, the length target, and the JSON contract. There is no prompt text
hidden in the code.

In dev the file is re-read every second, so edits take effect on the next
generation. In production it is cached for the life of the instance, so redeploy
after editing.

If you change the JSON output contract in that file, update `parseDraft` in
`src/lib/openai.ts` to match.

---

## Deploying to Vercel

Both the frontend and the API routes are one Next.js app, so it is a single
deploy.

```bash
npm i -g vercel
vercel login          # interactive
vercel link
vercel env add OPENAI_API_KEY production
vercel --prod
```

Or import the Git repo at https://vercel.com/new and add `OPENAI_API_KEY` under
**Settings → Environment Variables**.

`next.config.ts` force-includes `content/**` in the serverless bundle — without
that the style guide is missing at runtime and generation fails.

---

## Project layout

```
content/style-guide.md      the writing rules — edit this, not the code
src/lib/sources.ts          source registry + each publisher's AI policy
src/lib/rss.ts              dependency-free RSS reader
src/lib/scraper.ts          fetch, merge, dedupe, rank, enrich
src/lib/openai.ts           model call + response validation
src/lib/caption.ts          deterministic footer assembly
src/lib/freshness.ts        age → F1 timing colours
src/app/api/feed/           GET  the 10 newest stories
src/app/api/generate/       POST a story id → caption
src/components/             timing board (dark) + composer (paper)
```

### Design

The screen is a pit wall. The left board is incoming data — dark, monospace,
ranked 01–10, with each story's age shown in F1 timing colours (purple newest,
then green, yellow, grey). The right side is outgoing copy on paper. The two
surfaces look different on purpose: machine data in, human writing out.

Body text is set in Be Vietnam Pro, chosen because everything this tool produces
is Vietnamese and most grotesques set the stacked diacritics badly.

---

## Caveats

- Generation is **untested against a live model** — it was built and verified
  without an API key. Caption assembly, both feed sources, and every error path
  are tested. Run one generation after adding your key.
- The feed is cached for 5 minutes and article pages for 24 hours. Hit **Làm mới**
  to force a refetch.
- If a publisher changes its feed shape, that source fails alone and the rest keep
  working — a failed source is named in the UI rather than blanking the board.
