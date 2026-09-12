import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
let html = readFileSync('dist/index.html', 'utf8');
const assets = readdirSync('dist/assets');
const jsFile = assets.find(f => f.endsWith('.js'));
const cssFile = assets.find(f => f.endsWith('.css'));
let js = readFileSync('dist/assets/' + jsFile, 'utf8');
const css = readFileSync('dist/assets/' + cssFile, 'utf8');
js = js.replace(/<\/script>/gi, '<\\/script>');
html = html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/, () => '<script type="module">' + js + '</script>');
html = html.replace(/<link[^>]*rel="stylesheet"[^>]*>/, () => '<style>' + css + '</style>');
mkdirSync('dist-single', { recursive: true });
writeFileSync('dist-single/index.html', html);
// carry non-inlined files from dist (public/ items: passports, icons) so they ship beside the app
function copyInto(from, to) {
  mkdirSync(to, { recursive: true });
  for (const f of readdirSync(from)) {
    const src = join(from, f), dst = join(to, f);
    if (statSync(src).isDirectory()) copyInto(src, dst);
    else copyFileSync(src, dst);
  }
}
for (const f of readdirSync('dist')) {
  if (f === 'index.html' || f === 'assets') continue;
  const src = join('dist', f);
  if (statSync(src).isDirectory()) copyInto(src, join('dist-single', f));
  else copyFileSync(src, join('dist-single', f));
}
console.log('single-file written:', html.length, 'bytes');
