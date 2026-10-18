// E-Diary — build a single-file copy of the diary.
//
//   node tools/build.mjs                 -> "E-Diary (single file).html" in the diary folder
//   node tools/build.mjs --out <file>    -> write it somewhere else
//   node tools/build.mjs --fragment      -> page body only (for hosts that add their own <html>/<head>)
//
// The single file contains every stylesheet and script, so it opens by double-click,
// can be e-mailed, or uploaded as one page to any web host. The regular folder version
// (index.html + css/ + js/) is still the one to use for installable, offline hosting.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const outArg = args.indexOf('--out') >= 0 ? args[args.indexOf('--out') + 1] : null;
const fragment = args.includes('--fragment');

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// inline stylesheets
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => {
  const css = fs.readFileSync(path.join(root, href), 'utf8');
  return '<style>\n/* ' + href + ' */\n' + css + '\n</style>';
});

// inline scripts
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
  const js = fs.readFileSync(path.join(root, src), 'utf8').replace(/<\/script/gi, '<\\/script');
  return '<script>\n/* ' + src + ' */\n' + js + '\n</script>';
});

// icons as data: URIs; drop files that will not travel with a single page
const svg = fs.readFileSync(path.join(root, 'icons/icon.svg'), 'utf8');
const svgData = 'data:image/svg+xml,' + encodeURIComponent(svg.replace(/\s+/g, ' ').trim());
html = html
  .replace(/<link rel="manifest"[^>]*>\n?/, '')
  .replace(/<link rel="apple-touch-icon"[^>]*>\n?/, '')
  .replace(/<link rel="icon" href="icons\/icon-192.png"[^>]*>\n?/, '')
  .replace(/<link rel="icon" href="icons\/icon.svg" type="image\/svg\+xml">/, '<link rel="icon" href="' + svgData + '" type="image/svg+xml">');

if (fragment) {
  // keep <title>, <meta name="description"> and everything inside <body>; drop the document wrapper
  const title = (html.match(/<title>[\s\S]*?<\/title>/) || [''])[0];
  const head = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>'));
  const styles = (head.match(/<style>[\s\S]*?<\/style>/g) || []).join('\n');
  const body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'));
  html = title + '\n' + styles + '\n' + body;
}

// sanity check: the offline cache must list every file the app loads
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const missing = [];
for (const dir of ['css', 'js']) {
  for (const f of fs.readdirSync(path.join(root, dir))) {
    if (!sw.includes("'./" + dir + '/' + f + "'")) missing.push(dir + '/' + f);
  }
}
if (missing.length) console.warn('Warning: sw.js does not cache: ' + missing.join(', '));

const out = outArg ? path.resolve(outArg) : path.join(root, 'E-Diary (single file).html');
fs.writeFileSync(out, html);
console.log('Wrote ' + out + ' (' + Math.round(Buffer.byteLength(html) / 1024) + ' KB)');
