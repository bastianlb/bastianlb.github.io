# CLAUDE.md

Jekyll academic site. Each publication is a "post" data record in `_posts/` (no
per-paper page is generated — `permalink: /` collapses posts so they're used only
as data). Two real pages render that data:

- **Homepage** (`_layouts/default.html`, served at `/`): bio hero → **Recent
  Updates** (`_includes/news.html` ← `_data/news.yml`) → **Selected Work** (only
  posts with `highlight: true`, newest first) → "See all publications" link.
- **Publications** (`publications.html`, served at `/publications/`): every paper,
  grouped by year, with client-side filter chips (`assets/filter.js`).

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

## Recent Updates (news)

Edit `_data/news.yml` — a list of `{date, text, link?}` (newest first; `text` may
contain inline HTML). The homepage shows the latest 5.

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
_layouts/page.html      interior pages (publications)
publications.html       full list, grouped by year + filter chips
_includes/head.html     <head>: GA tag, fonts, canonical, title
_includes/nav.html      sticky top nav
_includes/news.html     renders _data/news.yml
_includes/publication-card.html   ONE source of truth for a paper card
_includes/icon-sprite.html        inline SVG <symbol>s for link/social icons
_includes/footer.html   Jon Barron credit
style.scss              all styles (CSS variables, responsive, dark mode)
assets/filter.js        publications filter chips (progressive enhancement)
_data/news.yml          homepage news feed
```

## Verify

```bash
jekyll build      # exit 0; the "Conflict … _site/index.html" warning is EXPECTED
                  # (permalink:/ collapses all posts to the homepage)
```
Then confirm: homepage `_site/index.html` shows the `highlight: true` papers, and
`_site/publications/index.html` lists every paper under year dividers. For live
preview use `jekyll serve` (http://localhost:4000).
