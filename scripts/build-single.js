/* Packs the app in www/ into one self-contained file: dist/clock-rate.html.
   Run from the repo root:  node scripts/build-single.js
   The single file can be opened straight from disk in a desktop browser, or hosted anywhere. */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), www = path.join(root, 'www');
let html = fs.readFileSync(path.join(www, 'index.html'), 'utf8');

html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, href) =>
  '<style>\n' + fs.readFileSync(path.join(www, href), 'utf8') + '\n</style>');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) =>
  '<script>\n' + fs.readFileSync(path.join(www, src), 'utf8').replace(/<\/script/g, '<\\/script') + '\n</script>');

if (/<script src=|rel="stylesheet" href="(?!https:)/.test(html)) throw new Error('Something was not inlined');
fs.mkdirSync(path.join(root, 'dist'), {recursive: true});
const out = path.join(root, 'dist', 'clock-rate.html');
fs.writeFileSync(out, html);
console.log('Wrote ' + path.relative(root, out) + ' (' + Math.round(html.length / 1024) + ' KB)');
