# SUM Pit Wall

A caption desk for the SUM Facebook page. It pulls the latest F1 and motorsport
headlines, drafts each one as a Vietnamese Facebook post in the SUM house style,
and hands it to an admin to edit and post.

The adjacent **Shitpost Feed** uses Bluesky's public AppView API to rank viral
automotive image and video posts from a curated set of searches. An admin can preview
the media, download the original Bluesky-hosted asset, open the original post,
and generate a credited Vietnamese caption through the same cache and quota
pipeline as editorial news.

The point is speed: an admin picks a story off the board, hits generate, tweaks a
line or two, copies the caption, grabs the image, and posts.

---

## How it works

```
RSS feeds  ─►  scraper  ─►  50-story mixed queue, deduped  ─►  admin picks one
   (free)                        (free)                          (free)
                                                                    │
                                                      admin clicks generate
                                                                    │
                                      public article page  ──────────┤
                                      (RSS excerpt fallback)         │
                                                                    │
                                     content/style-guide.md  ──►  OpenAI
                                                                    │
                                              model writes 5 fields │
                                                                    ▼
                                         app assembles fixed footer ─►  post
```

**Nothing calls the model until you click generate.** Browsing the feed and
selecting stories costs zero tokens — it is all RSS. Generated posts are cached
in Supabase for 30 days, so the same inputs can be reused without another model
call. The **Generated Work** tab lists every unexpired cached caption. Only the
explicit **Regenerate** button pays again and replaces that cache entry. Admins
can also permanently delete an individual cached caption from its detail view.
Fresh model calls are limited to 10 per rolling hour per hashed IP address;
cache hits do not consume that quota.

The model writes only **header tag, body, list, hook, topic hashtags**. The
divider, `Nguồn:` credit, Discord line, core hashtags, and CTA are assembled in
code from your settings, so they are identical on every post and the source
credit cannot be dropped.

Output format:

```
F1 NEWS
F1 vừa chính thức xác nhận sẽ trở lại đường đua Sepang…
————————
Nguồn: Formula1.com
I❤️ Credit soạn bài:
I✒️ Hãy chung tay đóng góp và chia sẻ content qua Discord của SUM
#SUM #clubhouse #Thethaotocdo #Vanhoaxe #F1 #bangtinF1 #F1News
Tham gia CLB ngay hôm nay
```

### Sources

| Source | Default | Notes |
| --- | --- | --- |
| Formula 1 (official) | on | Feed has no dates or images, so article metadata is enriched from the public page. Full text is extracted when the admin generates. |
| Motorsport.com F1 | on | No AI restrictions. Dates and images come straight from the feed. |
| Traxion.GG | on | `Content-Signal: ai-train=no, use=reference`. Permits reference use; forbids training. |
| RaceFans | on | Same signal as Traxion. |
| Crash.net | on | Public F1 RSS feed. |
| The Race | on | Independent multi-series motorsport RSS. |
| Motorsport Week | on | Multi-series coverage including Formula E, IndyCar, WRC, endurance, and MotoGP. |
| Motorsport.com MotoGP | on | Public MotoGP category RSS. |
| Motorsport.com WEC | on | Public World Endurance Championship category RSS. |
| Motorsport.com GT | on | Public international GT racing category RSS. |
| Motorsport.com IMSA | on | Public IMSA category RSS. |
| GT World Challenge | on | Official GT World Challenge Europe public RSS. |
| Sportscar365 | on | Endurance and GT racing RSS. |
| DirtFish | on | Rally and WRC RSS. |
| RACER | on | US and international motorsport RSS. |
| FIA | on | Official FIA news RSS. |

This tool never trains on publisher content. At generation time it extracts the
publicly accessible article for reference, falls back to the publisher's RSS
excerpt when extraction is blocked or unreadable, and always prints `Nguồn:`.
It never bypasses a paywall or access control. Re-check `robots.txt`
occasionally; publishers change these.

**Never remove the `Nguồn:` line from a generated caption.**

---

## Setup

```bash
npm install
cp .env.example .env.local     # then paste your OpenAI key into .env.local
npx supabase link              # select the SUM Supabase project
npx supabase db push           # creates generated_posts + daily retention job
npm run dev
```

Open http://localhost:3000.

### Environment

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | yes | — | Get one at https://platform.openai.com/api-keys |
| `OPENAI_MODEL` | no | `gpt-4o` | Any OpenAI model supporting JSON response format |
| `SUPABASE_URL` | yes for generation | — | Project URL used by the archive and fresh-generation limiter |
| `SUPABASE_SECRET_KEY` | yes for generation | — | Server-only secret key; never expose it as `NEXT_PUBLIC_*` |
| `RATE_LIMIT_HASH_SECRET` | no | Supabase secret key | Server-only HMAC secret; raw IP addresses are never stored |
| `BLUESKY_MEME_QUERIES` | no | curated automotive searches | Comma-separated public Bluesky search override |

Without an OpenAI key the feed still loads and browses fine; only generation
fails. Without Supabase credentials cached browsing still works, but fresh
generation fails closed so the OpenAI budget cannot be used without rate-limit
protection.

The Shitpost Feed needs no Bluesky account or secret. It uses the public
`api.bsky.app` search endpoint, hides labelled adult content, replies, and
text-only posts, then ranks media posts from the last 60 days. Upstream data is
refetched only when an admin uses **Refresh Bluesky**; otherwise the server
reuses its five-minute cache.

### Generated post retention

The migration in `supabase/migrations/` creates a locked-down
`generated_posts` table. Browser roles have no access; only the server-side
secret key can read or write it. Each row expires 30 days after generation, and
a daily Supabase Cron job permanently deletes rows only after `expires_at`.

---

## Changing the writing style

Edit **`content/style-guide.md`**. That file *is* the system prompt — it defines
the header tags, the voice, the Vietnamese conventions, which proper nouns stay
in English, the source-length tiers (70–450 words), the hashtag sets, and the
JSON contract. There is no hidden house-style prompt in the code; the generation
request adds only the exact source-length target and article text.

The same file backs the **`sum-post` Claude Code skill**
(`.claude/skills/sum-post/`), so you can paste any article into Claude Code and
get a post in the identical format without opening the web app. The skill reads
the guide rather than restating it, so the two can never drift.

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
vercel env add SUPABASE_URL production
vercel env add SUPABASE_SECRET_KEY production
vercel --prod
```

Or import the Git repo at https://vercel.com/new and add all required variables
under **Settings → Environment Variables**.

`next.config.ts` force-includes `content/**` in the serverless bundle — without
that the style guide is missing at runtime and generation fails.

---

## Project layout

```
content/style-guide.md      the writing rules — edit this, not the code
src/lib/sources.ts          source registry + each publisher's AI policy
src/lib/rss.ts              dependency-free RSS reader
src/lib/scraper.ts          fetch, merge, dedupe, rank, enrich
src/lib/bluesky.ts          public Bluesky viral media feed adapter
src/lib/openai.ts           model call + response validation
src/lib/caption.ts          deterministic footer assembly
src/lib/generated-posts.ts  Supabase-backed 30-day caption cache
src/lib/freshness.ts        age → F1 timing colours
src/app/api/feed/           GET  the 50-story mixed queue
src/app/api/shitposts/      GET  curated Bluesky image/video queue
src/app/api/media/download  GET  allowlisted Bluesky media download proxy
src/app/api/generate/       POST a story id → caption
src/app/api/generated-posts GET/DELETE cached Generated Work
src/components/             timing board (dark) + composer (paper)
```

### Design

The screen is a dense editorial workspace. The left board ranks the 50 newest
stories across F1, MotoGP, WEC, GT, IMSA, rally, IndyCar, Formula E, sim racing,
and general motorsport,
with each story's age shown in F1 timing colours. The right side is the editable
caption workspace.

Body text is set in Be Vietnam Pro, chosen because everything this tool produces
is Vietnamese and most grotesques set the stacked diacritics badly.

---

## Caveats

- Generation is **untested against a live model** — it was built and verified
  without an API key. Caption assembly, both feed sources, and every error path
  are tested. Run one generation after adding your key.
- The feed is cached for 5 minutes and article pages for 24 hours. Full article
  extraction happens only when an admin generates a caption; browsing the queue
  remains lightweight.
- If a publisher changes its feed shape, that source fails alone and the rest keep
  working — a failed source is named in the UI rather than blanking the board.
