# Search Console setup — task A4

**Task A4** of `TRAFFIC-IMPLEMENTATION-PLAN.md` §3. Prepared 2026-08-03.

A4 needs a Google sign-in, so **the account steps are yours**. Everything checkable without one is
done and recorded below — the site side is clean, so anything GSC reports is about authority or
crawl budget, not a defect you need to hunt.

Budget ~20 minutes, not the plan's 45.

---

## 0. Pre-flight — already verified, all 150 URLs

Run against production 2026-08-03. These are the conditions that produce *"Discovered – currently
not indexed"* and *"Excluded"* in GSC, so having them clean narrows what any bad number can mean.

| Check | Result |
|---|---|
| HTTP 200 | **150 / 150** |
| `noindex` present | **0** |
| Canonical is self-referencing | **150 / 150**, zero mismatches |
| hreflang set = `en` · `de` · `es` · `x-default` | **150 / 150** |
| hreflang targets present in the sitemap | **all**, zero dangling |
| hreflang **reciprocity** (A lists B ⇒ B lists A) | **zero** non-reciprocal pairs |
| `sitemap.xml` | 200, `application/xml`, uncompressed, parses to 150 unique `<loc>` (A5) |
| `robots.txt` | allows all, names AI crawlers, points at the sitemap |

**So: if indexation comes back low, it is not a technical fault on the site.** That distinction is
the whole point of doing this pre-flight — it stops the Week-9 gate being read as "we have a bug".

---

## 1. Choose the property type — this decision has a downstream consequence

Pick **Domain property** (`qrcodeagent.net`).

- **Domain property** covers every subdomain and both protocols, and cannot silently miss traffic
  because someone linked `www.`. Verified by **one DNS TXT record**.
- **URL-prefix property** (`https://qrcodeagent.net/`) is faster to verify (an HTML file or tag)
  but only covers that exact prefix.

**The consequence people find out too late:** `scripts/gsc-submit.mjs` (task A7) defaults to
`GSC_SITE_URL=https://qrcodeagent.net/`, which is the **URL-prefix** form. If you create a Domain
property — and you should — that default is wrong and the script will die with a 404 whose message
already tells you this. Fix by exporting the domain form:

```bash
export GSC_SITE_URL="sc-domain:qrcodeagent.net"
```

Set that in whatever shell profile or CI env you use, once, and A7's script works from then on.

---

## 2. Verify the property

1. <https://search.google.com/search-console> → **Add property** → **Domain** → `qrcodeagent.net`.
2. Google shows a TXT record. Add it in the DNS provider for the domain — the domain is served by
   **Vercel**, so if DNS is managed there it is *Project → Settings → Domains → DNS Records*; if the
   registrar holds DNS, add it there instead.
3. Wait for propagation (usually minutes) → **Verify**.

> The TXT record must stay in place permanently. Removing it later un-verifies the property.

---

## 3. Submit the sitemap

**Sitemaps** → enter `sitemap.xml` → **Submit**.

Expect *Success* and **150 discovered URLs**. Anything else is worth reporting, because the sitemap
was verified as well-formed on 2026-08-03 (A5) — a parse error would mean something changed since.

There is no `sitemap-index.xml`, and its 404 is correct. Do not submit it.

---

## 4. Read the number the Week-9 gate needs

**Pages → Indexing.** Record both figures:

- **Indexed** — pages Google has actually indexed
- **Not indexed** — and specifically the split between *Discovered – currently not indexed* and
  *Crawled – currently not indexed*

Then fill in §6 below and copy the totals into `docs/AEO-BASELINE.md` as a dated block, so the
indexation series sits alongside the AEO series.

### How to read it

Indexation will be **low at first, and that is expected, not a failure.** Three of the 150 URLs went
live on 2026-08-02/03 and the DE/ES bundles are recent. Google indexes a new site's pages over
weeks, and it indexes *selectively* — a large fraction of "Discovered – currently not indexed" on a
young, low-authority domain is normal and is a statement about authority, not about markup.

The plan's gate threshold is **~50%**. Read it against these:

| Signal | What it means |
|---|---|
| EN indexed ≫ DE/ES indexed | Normal early on; localized pages are usually indexed later. Not a reason to stop C1/C2. |
| **Most URLs "Discovered – currently not indexed"** | Google found them and chose not to index. **This is the authority signal**, and it argues for workstream D over more locales. |
| "Crawled – currently not indexed" | Google fetched and declined — closer to a quality/duplication signal. Worth investigating per-URL. |
| Any *"Alternate page with proper canonical tag"* | Expected and harmless for the locale set. |
| Any **"Duplicate without user-selected canonical"** | Would be a real bug — but pre-flight found zero canonical problems, so treat it as new. |

---

## 5. Then A6's other half, while you are in the neighbourhood

Bing Webmaster Tools (<https://www.bing.com/webmasters>) — verify and submit the same sitemap.
IndexNow already **pushes** all 150 URLs (shipped 2026-08-03, `npm run indexnow:submit`), but it
reports nothing back, so Webmaster Tools is the only place to **read** Bing indexation. Bing can
import the property directly from Search Console, which is why doing it right after A4 is cheapest.

---

## 6. Record the reading

| Date | Property type | Sitemap discovered | Indexed | Discovered–not indexed | Crawled–not indexed | Notes |
|---|---|---:|---:|---:|---:|---|
| | | | | | | |

Re-read monthly, alongside the `AEO-BASELINE.md` measurement. **The Week-9 gate reads this table.**

---

*Pre-flight verified against production 2026-08-03: 150/150 URLs clean on status, noindex,
canonical, hreflang and reciprocity.*
