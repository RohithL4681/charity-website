// Admin API: gallery media management (src/images/gallery/).
// Supports listing, uploading (base64), deleting images and editing captions
// (keeps src/_data/gallery.js in sync). Requires the admin token.

const lib = require('./_lib.js');

const GALLERY_DIR = 'src/images/gallery';
const DATA_FILE = 'src/_data/gallery.js';
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|svg)$/i;

async function getGalleryJs() {
  try {
    return (await lib.readFile(DATA_FILE)).content;
  } catch (e) {
    return null;
  }
}

function parseCaptions(raw) {
  const lines = String(raw || '').split('\n');
  let start = -1;
  let end = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/const\s+captions\s*=\s*\{/.test(lines[i])) {
      start = i;
    } else if (start !== -1 && /^\s*\}\s*;/.test(lines[i])) {
      end = i;
      break;
    }
  }
  const map = {};
  if (start !== -1 && end !== -1) {
    for (let i = start + 1; i < end; i++) {
      const m = /^\s*['"]([^'"]+)['"]\s*:\s*['"]([^'"]*)['"],?\s*$/.exec(lines[i]);
      if (m) map[m[1]] = m[2];
    }
  }
  return { start: start, end: end, map: map, lines: lines };
}

function buildCaptions(raw, map) {
  const parsed = parseCaptions(raw);
  const keys = Object.keys(map).sort(function (a, b) {
    return a.localeCompare(b);
  });
  const entries = keys.map(function (k) {
    return "  '" + k + "': '" + String(map[k] || '').replace(/'/g, "\\'") + "',";
  });

  if (parsed.start !== -1 && parsed.end !== -1) {
    const head = parsed.lines[parsed.start].replace(/\s*\{.*$/, '') + ' {';
    const pre = parsed.lines.slice(0, parsed.start).join('\n');
    const block = head + '\n' + entries.join('\n') + '\n};';
    const rest = parsed.lines.slice(parsed.end + 1).join('\n');
    const out = pre + '\n' + block + (rest ? '\n' + rest : '');
    return out.replace(/\n{3,}/g, '\n\n');
  }

  // No captions object found — insert before the first module.exports.
  const lines = parsed.lines;
  const idx = lines.findIndex((l) => /module\.exports/.test(l));
  const block = 'const captions = {\n' + entries.join('\n') + '\n};';
  if (idx === -1) return block + '\n' + lines.join('\n');
  lines.splice(idx, 0, block);
  return lines.join('\n');
}

async function updateCaptions(mutator) {
  const raw = await getGalleryJs();
  if (!raw) return;
  const parsed = parseCaptions(raw);
  const map = parsed.map;
  mutator(map);
  await lib.writeFile(DATA_FILE, buildCaptions(raw, map), (await lib.readFile(DATA_FILE)).sha);
}

function safeImageName(input) {
  const base = String(input || '')
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (base || 'image') + '.jpg';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return lib.json(res, 405, { error: 'Method not allowed' });
  if (!lib.authorized(req)) return lib.json(res, 401, { error: 'Invalid admin token.' });

  let body;
  try {
    body = lib.readBody(req);
  } catch (e) {
    return lib.json(res, 400, { error: 'Invalid request body.' });
  }

  const action = String(body.action || '');

  try {
    switch (action) {
      case 'list': {
        const files = await lib.listDir(GALLERY_DIR);
        const images = files.filter((f) => IMAGE_EXT.test(f.name));
        let captions = {};
        const raw = await getGalleryJs();
        if (raw) captions = parseCaptions(raw).map;
        return lib.json(res, 200, {
          images: images.map((f) => ({
            name: f.name,
            caption: captions[f.name] || '',
            size: f.size || 0,
          })),
        });
      }

      case 'upload': {
        const name = safeImageName(String(body.filename || 'image.jpg'));
        const content = String(body.content || '');
        if (!/^[A-Za-z0-9+/=\r\n]+$/.test(content)) {
          return lib.json(res, 400, { error: 'Invalid image data.' });
        }
        const img = Buffer.from(content, 'base64');
        if (img.length < 100) return lib.json(res, 400, { error: 'Image is empty or too small.' });
        if (img.length > 3 * 1024 * 1024) {
          return lib.json(res, 400, { error: 'Image is too large (max ~3 MB after compression).' });
        }
        const path = GALLERY_DIR + '/' + name;
        let sha = null;
        try {
          sha = (await lib.readFile(path)).sha;
        } catch (e) {
          sha = null;
        }
        await lib.writeFile(
          path,
          img,
          sha,
          sha ? 'chore: update image ' + path : 'chore: add image ' + path
        );
        if (body.caption !== undefined) {
          await updateCaptions(function (map) {
            map[name] = String(body.caption || '');
          });
        }
        return lib.json(res, 200, { ok: true, path: path, name: name });
      }

      case 'delete': {
        const name = String(body.filename || '');
        if (!name || !/^[^/\\]+$/.test(name)) {
          return lib.json(res, 400, { error: 'Invalid image name.' });
        }
        const path = GALLERY_DIR + '/' + name;
        await lib.deleteFile(path);
        await updateCaptions(function (map) {
          delete map[name];
        });
        return lib.json(res, 200, { ok: true });
      }

      case 'setCaption': {
        const name = String(body.filename || '');
        if (!name || !/^[^/\\]+$/.test(name)) {
          return lib.json(res, 400, { error: 'Invalid image name.' });
        }
        await updateCaptions(function (map) {
          map[name] = String(body.caption || '');
        });
        return lib.json(res, 200, { ok: true });
      }

      default:
        return lib.json(res, 400, { error: 'Unknown action.' });
    }
  } catch (e) {
    console.error('media.js error:', e && e.message);
    return lib.json(res, 500, { error: e && e.message ? e.message : 'Something went wrong.' });
  }
};