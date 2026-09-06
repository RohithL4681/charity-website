// Admin API: CRUD for News posts (src/posts/*.md) and Programs (src/_programs/*.md).
// Every action requires the admin token (password hash) in X-Admin-Token.

const lib = require('./_lib.js');

const TYPES = {
  posts: {
    dir: 'src/posts',
    layout: 'post.njk',
  },
  programs: {
    dir: 'src/_programs',
    layout: 'page.njk',
  },
};

function buildFrontMatter(type, fields) {
  const meta = TYPES[type];
  const lines = ['---', 'layout: ' + meta.layout];
  const title = String(fields.title || '').trim();

  if (type === 'posts') {
    lines.push('title: ' + title);
    lines.push('date: ' + (String(fields.date || '').trim() || lib.todayISO()));
    if (fields.excerpt) lines.push('excerpt: ' + String(fields.excerpt).trim());
    if (fields.image) lines.push('image: ' + String(fields.image).trim());
  } else {
    lines.push('title: ' + title);
    if (fields.tag) lines.push('tag: ' + String(fields.tag).trim());
    lines.push('subtitle: ' + String(fields.excerpt || '').trim());
    lines.push('excerpt: ' + String(fields.excerpt || '').trim());
    const rawOrder = parseInt(fields.order, 10);
    const order = Number.isNaN(rawOrder) ? 1 : Math.max(1, rawOrder);
    lines.push('order: ' + order);
    if (fields.image) lines.push('image: ' + String(fields.image).trim());
  }
  lines.push('---');
  return lines.join('\n');
}

function validate(action, type, fields) {
  if (!TYPES[type]) return { error: 'Unknown type. Use "posts" or "programs".' };
  if (action === 'save' && !String((fields && fields.title) || '').trim()) {
    return { error: 'Title is required.' };
  }
  return null;
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
  const type = String(body.type || '');
  const ctx = TYPES[type];
  const invalid = validate(action, type, body);
  if (invalid) return lib.json(res, 400, invalid);

  try {
    switch (action) {
      case 'list': {
        const files = await lib.listDir(ctx.dir);
        const items = [];
        for (const f of files) {
          if (!f.name.toLowerCase().endsWith('.md')) continue;
          const { data } = lib.parseFrontMatter(
            (await lib.readFile(f.path)).content
          );
          items.push({
            path: f.path,
            title: data.title || f.name.replace(/\.md$/, ''),
            date: data.date || '',
            excerpt: data.excerpt || '',
            order: data.order || '',
          });
        }
        if (type === 'programs') {
          items.sort(function (a, b) {
            var ao = parseInt(a.order, 10) || 100;
            var bo = parseInt(b.order, 10) || 100;
            return ao - bo || a.title.localeCompare(b.title);
          });
        } else {
          items.sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.title.localeCompare(b.title));
        }
        return lib.json(res, 200, { items: items });
      }

      case 'get': {
        const path = String(body.path || '');
        if (!path.startsWith(ctx.dir + '/')) return lib.json(res, 400, { error: 'Invalid path.' });
        const { content } = await lib.readFile(path);
        const parsed = lib.parseFrontMatter(content);
        return lib.json(res, 200, {
          path: path,
          filename: path.split('/').pop(),
          data: { ...parsed.data, body: parsed.body },
        });
      }

      case 'save': {
        const title = String(body.title || '').trim();
        let path = String(body.path || '');
        let slug = lib.slugify(title);
        if (!slug) return lib.json(res, 400, { error: 'Could not build a filename from the title.' });

        let existingSha = null;
        if (path) {
          if (!path.startsWith(ctx.dir + '/')) return lib.json(res, 400, { error: 'Invalid path.' });
          const file = await lib.readFile(path);
          existingSha = file.sha;
        } else {
          path = ctx.dir + '/' + slug + '.md';
        }

        const front = buildFrontMatter(type, body);
        const bodyText = String(body.body || '').replace(/^\r?\n+/, '').trimEnd();
        const content = front + '\n\n' + (bodyText ? bodyText + '\n' : '');

        await lib.writeFile(path, content, existingSha);
        return lib.json(res, 200, { ok: true, path: path, created: !existingSha });
      }

      case 'delete': {
        const path = String(body.path || '');
        if (!path.startsWith(ctx.dir + '/')) return lib.json(res, 400, { error: 'Invalid path.' });
        await lib.deleteFile(path);
        return lib.json(res, 200, { ok: true });
      }

      default:
        return lib.json(res, 400, { error: 'Unknown action.' });
    }
  } catch (e) {
    console.error('content.js error:', e && e.message);
    return lib.json(res, 500, { error: e && e.message ? e.message : 'Something went wrong.' });
  }
};