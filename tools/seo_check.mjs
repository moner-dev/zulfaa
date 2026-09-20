#!/usr/bin/env node
/* ZULFAA - the search and sharing metadata of every page, read out of the
 * files a visitor actually receives.
 *
 *   node tools/seo_check.mjs [--root <site>] [--json]
 *
 * It starts no server and fetches nothing: the site is a static tree, so the
 * tree IS what is served. Every expectation below is a fact about the page
 * itself - no ranking, no index coverage, nothing about how a search engine
 * has actually treated any of this is claimed or checked here.
 *
 * WHAT IT CHECKS
 *
 *   the 18 indexable pages   six slugs x three languages: a unique title
 *                            within its language, a page-specific description,
 *                            a self-referential absolute canonical, og:url
 *                            equal to it, four hreflang alternates that every
 *                            target reciprocates, x-default on the ENGLISH
 *                            page of the same slug, the full Open Graph set,
 *                            og:image:alt, og:locale matching the document
 *                            language, twitter:card, one <h1>, dir="rtl" on
 *                            Arabic, and no noindex.
 *   the shared preview       og:image exists on disk, and one approved alt
 *                            text per language serves every page of it.
 *   the excluded pages       403 x3, 404 and maintenance x3 still carry
 *                            noindex and are still absent from the sitemap.
 *   no development address   no 127.0.0.1, localhost or :8081 in any head tag.
 *   no duplicate tag         each key appears exactly once per page.
 *   sitemap and robots       the sitemap lists exactly the 18 indexable URLs;
 *                            robots.txt allows the site and disallows /p/.
 *
 * WHAT IT DELIBERATELY DOES NOT REQUIRE
 *
 *   twitter:title, twitter:description and twitter:image. X falls back to the
 *   og: values, which every page has, so requiring them would turn a working
 *   intentional fallback into a permanent failure.
 *
 * Exit 0 when every check passes; 1 with a list of failures otherwise.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(name)
  return i === -1 ? fallback : args[i + 1]
}
const ROOT = resolve(flag('--root', join(HERE, '..')))
const JSON_OUT = args.includes('--json')

const ORIGIN = 'https://zulfaa.nl/'
const SLUGS = ['', 'privacy/', 'terms/', 'delete-data/', 'support/', 'updates/']
const LANGS = ['en', 'ar', 'nl']
/* The eight pages that exist and are meant to stay out of search. They are
 * listed by name rather than discovered, so adding a page cannot quietly join
 * them; the owner-only Updates preview under /p/ is found by its directory,
 * because its path is deliberately unguessable and is not written here. */
const EXCLUDED = [
  '403/index.html', 'ar/403/index.html', 'nl/403/index.html', '404.html',
  'maintenance/index.html', 'ar/maintenance/index.html', 'nl/maintenance/index.html',
  ...(existsSync(join(resolve(flag('--root', join(HERE, '..'))), 'p'))
    ? readdirSync(join(resolve(flag('--root', join(HERE, '..'))), 'p'), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => `p/${d.name}/index.html`)
    : []),
]

const fails = []
const fail = (where, what) => fails.push(`${where}: ${what}`)
const eq = (where, what, got, want) => { if (got !== want) fail(where, `${what} is ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`) }
const ok = (where, what, got) => { if (!got) fail(where, `${what} is missing`) }

/* ── reading tags as tags ───────────────────────────────────────────────────
 * The generated pages put every attribute on one line; the five hand-written
 * English pages wrap a long tag over three. A reader that assumes either one
 * reports the other as absent - the SEO-01A defect, and the reason this walks
 * to the closing `>` respecting quotes instead of matching a fixed shape. */
const ATTR = /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')/gs

function tags(markup, name) {
  const out = []
  const open = new RegExp(`<${name}(?=[\\s/>])`, 'gi')
  let m
  while ((m = open.exec(markup))) {
    let i = open.lastIndex
    let quote = null
    for (; i < markup.length; i++) {
      const c = markup[i]
      if (quote) { if (c === quote) quote = null }
      else if (c === '"' || c === "'") quote = c
      else if (c === '>') break
    }
    const attrs = {}
    for (const a of markup.slice(open.lastIndex, i).matchAll(ATTR)) {
      const key = a[1].toLowerCase()
      if (!(key in attrs)) attrs[key] = decode(a[3] ?? a[4])
    }
    out.push(attrs)
    open.lastIndex = i
  }
  return out
}

const decode = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#0*39;|&#x0*27;/gi, "'").replace(/&amp;/g, '&')

const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, '')

function read(rel) {
  const file = join(ROOT, rel)
  if (!existsSync(file)) return null
  const raw = readFileSync(file, 'utf8')
  const head = strip(raw.split('</head>')[0])
  const metas = tags(head, 'meta')
  const meta = (key, kind = 'name') => metas.find((a) => a[kind] === key)?.content ?? null
  const links = tags(head, 'link')
  const html = tags(raw.slice(0, 4000), 'html')[0] || {}
  return {
    raw,
    head,
    lang: html.lang ?? null,
    dir: html.dir ?? null,
    title: (/<title>([\s\S]*?)<\/title>/i.exec(raw) || [])[1]?.trim() ?? null,
    description: meta('description'),
    robots: meta('robots'),
    canonical: links.find((a) => a.rel?.toLowerCase() === 'canonical')?.href ?? null,
    alternates: Object.fromEntries(
      links.filter((a) => a.rel?.toLowerCase() === 'alternate' && a.hreflang).map((a) => [a.hreflang, a.href]),
    ),
    og: {
      title: meta('og:title', 'property'),
      description: meta('og:description', 'property'),
      type: meta('og:type', 'property'),
      siteName: meta('og:site_name', 'property'),
      url: meta('og:url', 'property'),
      image: meta('og:image', 'property'),
      imageAlt: meta('og:image:alt', 'property'),
      locale: meta('og:locale', 'property'),
    },
    twitterCard: meta('twitter:card'),
    h1: (raw.match(/<h1\b/gi) || []).length,
    count: (key, kind) => (head.match(new RegExp(`<meta\\s[^>]*\\b${kind}="${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g')) || []).length,
  }
}

const url = (lang, slug) => ORIGIN + (lang === 'en' ? '' : lang + '/') + slug
const rel = (lang, slug) => (lang === 'en' ? '' : lang + '/') + slug + 'index.html'

// ── the 18 indexable pages ──────────────────────────────────────────────────
const pages = {}
for (const slug of SLUGS) {
  for (const lang of LANGS) {
    const p = read(rel(lang, slug))
    if (!p) { fail(rel(lang, slug), 'the page does not exist'); continue }
    /* `lang` is the language the page is EXPECTED to be, from its path;
       `htmlLang` is what the document actually declares. Keeping both is the
       point - overwriting one with the other would make the check vacuous. */
    pages[url(lang, slug)] = { ...p, htmlLang: p.lang, lang, slug }
  }
}

const altByLang = {}
for (const [u, p] of Object.entries(pages)) {
  eq(u, '<html lang>', p.htmlLang, p.lang)
  if (p.lang === 'ar') eq(u, '<html dir>', p.dir, 'rtl')
  ok(u, 'title', p.title)
  ok(u, 'meta description', p.description)
  eq(u, 'canonical', p.canonical, u)
  eq(u, 'og:url', p.og.url, u)
  ok(u, 'og:title', p.og.title)
  ok(u, 'og:description', p.og.description)
  ok(u, 'og:type', p.og.type)
  eq(u, 'og:site_name', p.og.siteName, 'ZULFAA')
  eq(u, 'og:image', p.og.image, ORIGIN + 'assets/og.png')
  ok(u, 'og:image:alt', p.og.imageAlt)
  eq(u, 'og:locale', p.og.locale, p.lang)
  eq(u, 'twitter:card', p.twitterCard, 'summary_large_image')
  eq(u, '<h1> count', p.h1, 1)
  if (p.robots && /noindex/i.test(p.robots)) fail(u, `an intended public page carries robots="${p.robots}"`)
  for (const [key, kind] of [['description', 'name'], ['og:description', 'property'], ['og:image:alt', 'property'], ['og:locale', 'property'], ['twitter:card', 'name'], ['og:title', 'property']]) {
    const n = p.count(key, kind)
    if (n !== 1) fail(u, `${key} appears ${n} times, expected once`)
  }
  if (/127\.0\.0\.1|localhost|:8081|file:\/\//.test(p.head)) fail(u, 'a development address appears in the head')
  ;(altByLang[p.lang] ??= new Set()).add(p.og.imageAlt)

  // hreflang: four codes, every alternate reciprocated, x-default on the English twin
  for (const code of [...LANGS, 'x-default']) ok(u, `hreflang ${code}`, p.alternates[code])
  eq(u, 'x-default', p.alternates['x-default'], url('en', p.slug))
  for (const code of LANGS) {
    const href = p.alternates[code]
    if (!href) continue
    eq(u, `hreflang ${code}`, href, url(code, p.slug))
    const target = pages[href]
    if (!target) { fail(u, `hreflang ${code} points at ${href}, which is not an indexable page`); continue }
    if (target.alternates[p.lang] !== u) fail(u, `hreflang ${code} is not reciprocated by ${href}`)
  }
}

// one approved alt text per language, for the one shared image
for (const [lang, set] of Object.entries(altByLang)) {
  if (set.size !== 1) fail(`og:image:alt (${lang})`, `${set.size} different texts describe one shared image: ${[...set].join(' | ')}`)
}
const og = join(ROOT, 'assets', 'og.png')
if (!existsSync(og)) fail('assets/og.png', 'the shared preview image does not exist')
else if (statSync(og).size < 1000) fail('assets/og.png', 'the shared preview image is suspiciously small')

// unique titles and descriptions WITHIN a language (across languages they may match)
for (const field of ['title', 'description']) {
  const seen = {}
  for (const [u, p] of Object.entries(pages)) {
    const k = p.lang + '\u0000' + p[field]
    ;(seen[k] ??= []).push(u)
  }
  for (const [k, us] of Object.entries(seen)) {
    if (us.length > 1) fail(`${field} (${k.split('\u0000')[0]})`, `${us.length} pages share it: ${us.join(', ')}`)
  }
}

// ── the pages that are meant to stay out of search ──────────────────────────
for (const r of EXCLUDED) {
  const p = read(r)
  if (!p) { fail(r, 'the page does not exist'); continue }
  if (!p.robots || !/noindex/i.test(p.robots)) fail(r, `robots is ${JSON.stringify(p.robots)}, expected noindex`)
}

// ── sitemap and robots ──────────────────────────────────────────────────────
const sitemap = existsSync(join(ROOT, 'sitemap.xml')) ? readFileSync(join(ROOT, 'sitemap.xml'), 'utf8') : null
if (!sitemap) fail('sitemap.xml', 'missing')
else {
  const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  const want = Object.keys(pages).sort()
  const got = [...listed].sort()
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    for (const u of got.filter((u) => !want.includes(u))) fail('sitemap.xml', `lists ${u}, which is not an indexable page`)
    for (const u of want.filter((u) => !got.includes(u))) fail('sitemap.xml', `does not list ${u}`)
  }
  for (const r of EXCLUDED) {
    const u = ORIGIN + r.replace(/index\.html$/, '')
    if (listed.includes(u)) fail('sitemap.xml', `lists the excluded page ${u}`)
  }
}

const robots = existsSync(join(ROOT, 'robots.txt')) ? readFileSync(join(ROOT, 'robots.txt'), 'utf8') : null
if (!robots) fail('robots.txt', 'missing')
else {
  if (!/^Allow:\s*\/\s*$/m.test(robots)) fail('robots.txt', 'does not allow the site')
  if (!/^Disallow:\s*\/p\/\s*$/m.test(robots)) fail('robots.txt', 'does not disallow /p/')
  if (!/^Sitemap:\s*\S+/m.test(robots)) fail('robots.txt', 'has no Sitemap: line')
}

// ── report ──────────────────────────────────────────────────────────────────
const summary = {
  indexablePages: Object.keys(pages).length,
  excludedPages: EXCLUDED.length,
  altTextsPerLanguage: Object.fromEntries(Object.entries(altByLang).map(([l, s]) => [l, [...s][0]])),
  failures: fails,
}
if (JSON_OUT) console.log(JSON.stringify(summary, null, 1))
else {
  console.log(`${summary.indexablePages} indexable pages, ${summary.excludedPages} deliberately excluded pages`)
  for (const [lang, alt] of Object.entries(summary.altTextsPerLanguage)) console.log(`  og:image:alt ${lang}: ${alt}`)
  if (!fails.length) console.log('\nOK - every check passed.')
  else {
    console.log(`\n${fails.length} failure(s):`)
    for (const f of fails) console.log('  ' + f)
  }
}
process.exit(fails.length ? 1 : 0)
