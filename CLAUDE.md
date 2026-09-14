# CLAUDE.md

Jekyll academic site. Each publication is a "post" data record in `_posts/` (no
per-paper page is generated — `permalink: /` collapses posts so they're used only
as data). Three real pages render the site's data:

- **Homepage** (`_layouts/default.html`, served at `/`): bio hero → **Recent
  Updates** (`_includes/news.html` ← `_data/news.yml`) → **Selected Work** (only
  posts with `highlight: true`, newest first) → "See all publications" link.
- **Publications** (`publications.html`, served at `/publications/`): every paper,
  grouped by year, with client-side filter chips (`assets/filter.js`).
- **News** (`news.html`, served at `/news/`): every news entry, grouped by year.

One shared partial renders a paper everywhere: `_includes/publication-card.html`.

## Adding a paper

Create `_posts/YYYY-MM-DD-slug.markdown`. Use the **publication date** (e.g.
conference start day). The body is the one-paragraph abstract.

```yaml
---
layout: post
highlight: true            # OPTIONAL — feature this paper on the homepage "Selected Work"
title:  "Full Title"
date:   YYYY-MM-DD          # `future: true` is set, so a date slightly ahead still renders
image: /images/slug.jpg     # teaser; thumbnail auto-derived as /tn/images/slug.jpg
categories: research        # research | preprint | workshop — drives the /publications/ filter chips
author: "Lennart Bastian"
authors: "A. One*, <strong>Lennart Bastian</strong>*, ..."  # bold Lennart; * = equal contribution
venue: "Full Venue (<strong>SHORT</strong>) 2026"
venue_short: "SHORT"        # shown as banner on the teaser
oral: true                  # OPTIONAL — turns the teaser banner orange (oral/spotlight)
---
```

The paper appears on `/publications/` under its year automatically. Add
`highlight: true` to also feature it on the homepage. `categories` no longer
controls *which* section shows it — every paper lists on `/publications/`; the
category only sets its filter-chip group.

Link fields (each renders as an **icon**, only if set, in this order): `webpage`,
`eprint` (arXiv), `paper` (published/official version), `arxiv` (legacy → paper),
`video`, `code`, `poster`, `slides`, `website`, `youtube`, `bibtex`. Each maps to a
symbol in `_includes/icon-sprite.html` — **to add a new link type, add a matching
`<symbol id="i-...">` to the sprite** and a branch in `_includes/publication-card.html`.

## News

`_data/news.yml` is the single chronological list, newest first — **add new
entries at the top**. Each is `{date, text, link?}` (`text` may contain inline
HTML). The homepage "Recent Updates" box shows at least the latest 5 and runs on
to the end of the 5th entry's year (normally: all of the current year), capped at
10; if that year has more, a "Show all of YYYY" button (`assets/news.js`) reveals
the rest. "All news" links to `/news/`, which lists everything under year
dividers. The numbers are `min` / `max` on the include in `_layouts/default.html`.
Both pages render entries through `_includes/news-item.html`.

## Teasers

Put the image in `images/`. Keep web-sized (~2000px wide, a few hundred KB). To
convert a PDF figure:

```bash
magick -density 300 fig.pdf -background white -alpha remove -quality 92 images/slug.png
magick images/slug.png -resize 2000x images/slug.png
```

Then regenerate the thumbnail: `rm -f tn/images/slug.png && ./_make_thumbnails.sh`.
The GitHub Pages build does NOT run ImageMagick — commit the `tn/images/...` file.

## Structure

```
_layouts/default.html   homepage (rendered via the permalink:/ collapse)
_layouts/page.html      interior pages (publications, news)
publications.html       full list, grouped by year + filter chips
news.html               full news archive, grouped by year
_includes/head.html     <head>: GA tag, fonts, canonical, title
_includes/nav.html      sticky top nav
_includes/news.html     homepage "Recent Updates" box (current year, 5–10 entries, expand if more, link to /news/)
_includes/news-item.html          ONE source of truth for a news entry
_includes/publication-card.html   ONE source of truth for a paper card
_includes/icon-sprite.html        inline SVG <symbol>s for link/social icons
_includes/footer.html   Jon Barron credit
style.scss              all styles (CSS variables, responsive, dark mode)
assets/filter.js        publications filter chips (progressive enhancement)
assets/news.js          homepage news "Show all of YYYY" toggle (progressive enhancement)
_data/news.yml          news feed, newest first (homepage + /news/)
```

## Verify

```bash
jekyll build      # exit 0; the "Conflict … _site/index.html" warning is EXPECTED
                  # (permalink:/ collapses all posts to the homepage)
```
Then confirm: homepage `_site/index.html` shows the `highlight: true` papers, and
`_site/publications/index.html` lists every paper under year dividers, and
`_site/news/index.html` lists every news entry under year dividers. For live
preview use `jekyll serve` (http://localhost:4000).
