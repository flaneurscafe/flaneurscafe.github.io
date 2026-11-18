# Flâneurs’ Café

Source of [flaneurs.cafe](https://flaneurs.cafe), a blog about the art of flânerie.
Built with Jekyll on GitHub Pages using the Étoile theme
([theme docs](https://docs.unbound.studio/etoile-writer-blogger-jekyll-theme/)).

## Writing a post

Add a Markdown file to `_posts/` named `YYYY-MM-DD-slug.md` with this front matter:

```yaml
---
title: Post title
permalink: /slug/
image: folder/header-image.jpg   # relative to /uploads/
categories: [essay]              # essay, history or letters
tag: [spotlight, featured]       # optional: show on the home/blog sections
author: bperruche
---
```

Images go in `uploads/` and are inserted with
`{% include image.html img="folder/file.jpg" alt="Caption" %}`.

## Local preview

```bash
gem install bundler
bundle install
bundle exec jekyll serve --livereload
```

Then open http://localhost:4000. Pushing to `main` publishes the site.

## Theme assets

`node_modules/` is not tracked. Run `npm install` only if you want to refresh the
vendored UIkit/JS files in `_sass/vendor` and `assets/js/vendor`.
