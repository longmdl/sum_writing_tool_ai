---
name: sum-post
description: Turn an English motorsport article (F1, WEC/IMSA, MotoGP, sim racing) into a ready-to-paste Vietnamese Facebook post in the SUM house format. Use when the user pastes an article, a URL, or asks for a SUM post / caption / "soạn bài" / "viết post".
---

# SUM Post Writer

Turns a long English motorsport article into a short Vietnamese Facebook post for
the SUM (Speed Union of Motorsport) page.

## Read the rules first

The complete house style — header tags, body rules, the English/Vietnamese
split, tone, hashtags, and hard rules — lives in **`content/style-guide.md`** at
the repo root. Read that file before writing. It is the same file the web app
feeds to the model, so the two never diverge; do not duplicate its rules here.

## Workflow

1. Read `content/style-guide.md`.
2. Read the article the user supplied. If they gave a URL, fetch it.
3. Identify the ONE core news event, then extract supporting facts: dates,
   names, numbers, locations, and any genuine list.
4. Classify the topic to pick the header tag and 3–6 topic hashtags.
5. Write the body: core fact first, then 1–2 context sentences, then an optional
   list, then an optional hook.
6. Assemble the full post with the footer (below).
7. Run the checklist before answering.

## Output

Output **only the finished post** — no preamble, no markdown fences, no notes
about your process. The user copy-pastes it straight into Facebook.

```
[HEADER TAG]
[body, 60–150 Vietnamese words]
  [optional indented list, one item per line]
[optional hook question]
————————
Nguồn: [source name, if known]
I❤️ Credit soạn bài: [author]
I✒️ Hãy chung tay đóng góp và chia sẻ content qua Discord của SUM
#SUM #clubhouse #Thethaotocdo #Vanhoaxe [+ 3–6 topic tags]
Tham gia CLB ngay hôm nay
```

Divider is `————————` or `__________` — pick one and stay consistent.

## Defaults and overrides

- **Author:** use the name the user gives. If none, use `Sennar`.
- **Source:** use the publication the user names. Omit the `Nguồn:` line only if
  the source is genuinely unknown.
- **Extra hashtags:** if the user supplies their own, use theirs.

## Multiple stories

If the article covers several unrelated stories, ask which one to post — or
produce one post per story separated by `=====`.

## Checklist

- [ ] Header tag on line 1, ALL CAPS, correct topic
- [ ] Body 60–150 words, never over 200, leads with the core fact
- [ ] Every date, number, and name accurate — **nothing invented**
- [ ] Proper nouns and motorsport jargon left in English per the guide
- [ ] Reads like a Vietnamese fan admin wrote it, not machine translation
- [ ] Divider, `Nguồn:`, credit line, Discord line all present
- [ ] 4 core hashtags first, then relevant topic tags
- [ ] `Tham gia CLB ngay hôm nay` is the final line
- [ ] Output contains ONLY the post
