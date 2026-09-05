// Mocked-GitHub harness for api/content.js and api/media.js.
// Run: node tools/test-admin.js
'use strict';

const content = require('../api/content.js');
const media = require('../api/media.js');

process.env.ADMIN_PASSWORD_HASH = 'a'.repeat(64);
process.env.GITHUB_REPO = 'demo/charity-website';
process.env.GITHUB_TOKEN = 'ght_mock';

const VALID_TOKEN = 'a'.repeat(64); // correct (lowercase) hash

// ---------- in-memory GitHub contents mock ----------
const store = {
  'src/posts/welcome.md': Buffer.from(
    '---\nlayout: post.njk\ntitle: Welcome to BrightHope\ndate: 2026-08-01\nexcerpt: Our first post.\n---\n\nHello world!\n'
  ),
  'src/posts/education-impact-2026.md': Buffer.from(
    '---\nlayout: post.njk\ntitle: Education Impact 2026\ndate: 2026-08-20\nexcerpt: Back to school stats.\n---\n\nGreat progress made.\n'
  ),
  'src/_programs/health.md': Buffer.from(
    '---\nlayout: page.njk\ntitle: Community Health Camps\ntag: Health\nsubtitle: Free checkups.\nexcerpt: Free checkups.\norder: 2\nimage: /images/community.jpg\n---\n\nMonthly camps.\n'
  ),
  'src/_programs/nutrition.md': Buffer.from(
    '---\nlayout: page.njk\ntitle: Nutrition and Meal Kits\ntag: Nutrition\nsubtitle: Meals for families.\nexcerpt: Meals for families.\norder: 3\n---\n\nWeekly kits.\n'
  ),
  'src/_data/gallery.js': Buffer.from(
    'const fs = require("fs");\nconst path = require("path");\n\nconst dir = path.join(__dirname, "..", "images", "gallery");\nconst images = fs.readdirSync(dir)\n  .filter((f) => /\\.(jpe?g|png|gif|webp|svg)$/i.test(f))\n  .sort();\n\nconst captions = {\n  \'img1.jpg\': \'Community day\',\n  \'img2.png\': \'\',\n};\n\nmodule.exports = images.map((name) => ({\n  name,\n  caption: captions[name] || \'\',\n}));\n'
  ),
  'src/images/gallery/img1.jpg': Buffer.from(new Array(200).fill('x').join('')),
  'src/images/gallery/img2.png': Buffer.from(new Array(300).fill('y').join('')),
};

let nextSha = 1;
function computeSha() {
  return 'sha' + nextSha++ + '_' + Math.random().toString(36).slice(2, 8);
}
const shas = {};
for (const key of Object.keys(store)) shas[key] = computeSha();

function findPath(ep) {
  // ep like '/repos/demo/charity-website/contents/src/posts/welcome.md?ref=main'
  const noRef = ep.split('?')[0];
  const prefix = '/repos/' + process.env.GITHUB_REPO + '/contents/';
  if (noRef.startsWith(prefix)) return noRef.slice(prefix.length);
  return null;
}

global.fetch = async function (url, opts) {
  const method = opts ? opts.method || 'GET' : 'GET';
  const ep = url.replace('https://api.github.com', '');
  const body = opts && opts.body ? JSON.parse(opts.body) : undefined;
  const payload = body || {};

  // repo info (default branch)
  if (method === 'GET' && ep === ('/repos/' + process.env.GITHUB_REPO)) {
    return new Response(200, { default_branch: 'main' });
  }

  const p = findPath(ep);

  // directory listing / file read
  if (method === 'GET' && p) {
    if (p in store) {
      return new Response(200, {
        sha: shas[p],
        size: store[p].length,
        content: store[p].toString('base64'),
        name: p.split('/').pop(),
        path: p,
      });
    }
    const children = Object.keys(store).filter((k) => k.startsWith(p + '/'));
    if (children.length) {
      return new Response(200, children.map((k) => ({
        name: k.split('/').pop(),
        path: k,
        type: 'file',
        size: store[k].length,
        sha: shas[k],
      })));
    }
    return new Response(404, { message: 'Not Found' });
  }

  // write (PUT) / delete
  if ((method === 'PUT' || method === 'DELETE') && p) {
    if (!opts.headers.Authorization) return new Response(401, { message: 'Missing auth' });
    if (method === 'PUT') {
      if (payload.sha !== undefined && payload.sha !== shas[p]) {
        return new Response(409, { message: 'sha mismatch' });
      }
      store[p] = Buffer.from(payload.content, 'base64');
      shas[p] = computeSha();
      return new Response(200, { content: { sha: shas[p] } });
    }
    if (!(p in store)) return new Response(404, { message: 'Not Found' });
    delete store[p];
    delete shas[p];
    return new Response(200, {});
  }

  return new Response(404, { message: 'Not Found' });
};

function Response(status, data) {
  this.status = status;
  this.data = data;
  this.ok = status >= 200 && status < 300;
  this.text = function () {
    return Promise.resolve(JSON.stringify(this.data));
  };
}

// ---------- req/res plumbing ----------
function makeRes() {
  return {
    statusCode: 0,
    headers: {},
    status(c) { this.statusCode = c; return this; },
    setHeader(k, v) { this.headers[k] = v; return this; },
    end(s) { this.body = s; },
  };
}

function call(fn, body, token, method) {
  const req = {
    method: (method || 'POST'),
    headers: token ? { 'x-admin-token': token } : {},
    body: JSON.stringify(body || {}),
  };
  const res = makeRes();
  return fn(req, res).then(() => ({ status: res.statusCode, json: JSON.parse(res.body || '{}') }));
}

// ---------- tiny test runner ----------
let passed = 0;
let failed = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed++; console.log('  ok  ' + name); })
    .catch((e) => { failed++; console.log('  FAIL ' + name + ' — ' + (e.message || e)); });
}
function eq(actual, expected, what) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error((what || 'value') + ': expected ' + b + ' got ' + a);
}

async function run() {
  console.log('## content.js');
  await test('401 without token', async () => {
    const r = await call(content, { action: 'list', type: 'posts' });
    eq(r.status, 401);
  });
  await test('401 with wrong token', async () => {
    const r = await call(content, { action: 'list', type: 'posts' }, 'b'.repeat(64));
    eq(r.status, 401);
  });
  await test('405 on GET', async () => {
    const r = await call(content, { action: 'list', type: 'posts' }, VALID_TOKEN, 'GET');
    eq(r.status, 405);
  });
  await test('list posts sorted by date desc', async () => {
    const r = await call(content, { action: 'list', type: 'posts' }, VALID_TOKEN);
    eq(r.status, 200);
    eq(r.json.items.length, 2);
    eq(r.json.items[0].title, 'Education Impact 2026'); // newest first
    eq(r.json.items[0].path, 'src/posts/education-impact-2026.md');
    eq('body' in r.json.items[0], false);
  });
  await test('list programs', async () => {
    const r = await call(content, { action: 'list', type: 'programs' }, VALID_TOKEN);
    eq(r.status, 200);
    eq(r.json.items.length, 2);
    eq(r.json.items.some((i) => i.title === 'Community Health Camps'), true);
  });
  await test('list rejects unknown type', async () => {
    const r = await call(content, { action: 'list', type: 'pages' }, VALID_TOKEN);
    eq(r.status, 400);
  });
  await test('list no longer requires a title', async () => {
    const r = await call(content, { action: 'list', type: 'posts' }, VALID_TOKEN);
    eq(r.status, 200);
  });
  await test('get post returns front matter + body', async () => {
    const r = await call(content, { action: 'get', type: 'posts', path: 'src/posts/welcome.md' }, VALID_TOKEN);
    eq(r.status, 200);
    eq(r.json.data.title, 'Welcome to BrightHope');
    eq(r.json.data.date, '2026-08-01');
    eq(r.json.data.body, 'Hello world!\n');
    eq(r.json.filename, 'welcome.md');
  });
  await test('get rejects path outside type dir', async () => {
    const r = await call(content, { action: 'get', type: 'posts', path: 'src/_programs/health.md' }, VALID_TOKEN);
    eq(r.status, 400);
  });
  await test('save new post writes markdown', async () => {
    const r = await call(content, {
      action: 'save', type: 'posts', title: 'Winter Clothing Drive!', date: '2026-09-01', excerpt: 'Warm coats.', body: 'Coat collection starts now.\n',
    }, VALID_TOKEN);
    eq(r.status, 200);
    eq(r.json.created, true);
    eq(r.json.path, 'src/posts/winter-clothing-drive.md');
    const text = store['src/posts/winter-clothing-drive.md'].toString('utf8');
    eq(text.includes('layout: post.njk'), true);
    eq(text.includes('title: Winter Clothing Drive!'), true);
    eq(text.includes('date: 2026-09-01'), true);
    eq(text.includes('excerpt: Warm coats.'), true);
    eq(text.includes('Coat collection starts now.'), true);
  });
  await test('save requires title', async () => {
    const r = await call(content, { action: 'save', type: 'posts', title: '' }, VALID_TOKEN);
    eq(r.status, 400);
    eq(r.json.error, 'Title is required.');
  });
  await test('save rejects unslugifiable title', async () => {
    const r = await call(content, { action: 'save', type: 'posts', title: '!!!' }, VALID_TOKEN);
    eq(r.status, 400);
    eq(r.json.error, 'Could not build a filename from the title.');
  });
  await test('save edit existing post (created:false, sha sent)', async () => {
    const before = shas['src/posts/welcome.md'];
    const r = await call(content, {
      action: 'save', type: 'posts', path: 'src/posts/welcome.md', title: 'Welcome v2', date: '2026-08-02', excerpt: '', body: 'Updated body.',
    }, VALID_TOKEN);
    eq(r.status, 200);
    eq(r.json.created, false);
    eq(r.json.path, 'src/posts/welcome.md');
    eq(before !== shas['src/posts/welcome.md'], true); // file was rewritten
    const text = store['src/posts/welcome.md'].toString('utf8');
    eq(text.includes('title: Welcome v2'), true);
  });
  await test('save program writes full front matter', async () => {
    const r = await call(content, {
      action: 'save', type: 'programs', title: 'Girls in STEM', tag: 'Education', order: '1', excerpt: 'Scholarships.', image: '/images/community.jpg', body: 'Yearly scholarships.\n',
    }, VALID_TOKEN);
    eq(r.status, 200);
    const text = store['src/_programs/girls-in-stem.md'].toString('utf8');
    eq(text.includes('layout: page.njk'), true);
    eq(text.includes('subtitle: Scholarships.'), true);
    eq(text.includes('order: 1'), true);
    eq(text.includes('image: /images/community.jpg'), true);
    eq(text.includes('Yearly scholarships.'), true);
  });
  await test('delete post removes file', async () => {
    const r = await call(content, { action: 'delete', type: 'posts', path: 'src/posts/welcome.md' }, VALID_TOKEN);
    eq(r.status, 200);
    eq('src/posts/welcome.md' in store, false);
  });
  await test('delete rejects bad path', async () => {
    const r = await call(content, { action: 'delete', type: 'posts', path: '../etc/passwd' }, VALID_TOKEN);
    eq(r.status, 400);
  });
  await test('unknown action', async () => {
    const r = await call(content, { action: 'explode', type: 'posts' }, VALID_TOKEN);
    eq(r.status, 400);
    eq(r.json.error, 'Unknown action.');
  });

  console.log('## media.js');
  await test('401 without token', async () => {
    const r = await call(media, { action: 'list' });
    eq(r.status, 401);
  });
  await test('list images with captions', async () => {
    const r = await call(media, { action: 'list' }, VALID_TOKEN);
    eq(r.status, 200);
    eq(r.json.images.length, 2);
    const c1 = r.json.images.find((i) => i.name === 'img1.jpg');
    eq(c1.caption, 'Community day');
    const c2 = r.json.images.find((i) => i.name === 'img2.png');
    eq(c2.caption, '');
  });
  await test('upload valid image', async () => {
    const bytes = 'x'.repeat(500);
    const r = await call(media, { action: 'upload', filename: 'My Fun Pic.png', content: Buffer.from(bytes).toString('base64'), caption: 'Picnic!' }, VALID_TOKEN);
    eq(r.status, 200);
    eq(r.json.name, 'my-fun-pic.jpg'); // sanitized to .jpg
    eq(store['src/images/gallery/my-fun-pic.jpg'].toString('utf8').startsWith('x'), true);
    const gjs = store['src/_data/gallery.js'].toString('utf8');
    eq(gjs.includes("'my-fun-pic.jpg': 'Picnic!'"), true);
  });
  await test('upload with no caption keeps gallery.js unchanged', async () => {
    const before = store['src/_data/gallery.js'].toString('utf8');
    const r = await call(media, { action: 'upload', filename: 'lone.jpg', content: Buffer.from('z'.repeat(200)).toString('base64') }, VALID_TOKEN);
    eq(r.status, 200);
    eq(store['src/_data/gallery.js'].toString('utf8'), before);
  });
  await test('upload rejects non-base64 content', async () => {
    const r = await call(media, { action: 'upload', filename: 'bad.jpg', content: '!!not-base64!!' }, VALID_TOKEN);
    eq(r.status, 400);
  });
  await test('upload rejects tiny image', async () => {
    const r = await call(media, { action: 'upload', filename: 'tiny.jpg', content: Buffer.from('ab').toString('base64') }, VALID_TOKEN);
    eq(r.status, 400);
  });
  await test('upload rejects oversized image', async () => {
    const big = Buffer.alloc(3 * 1024 * 1024 + 1).toString('base64');
    const r = await call(media, { action: 'upload', filename: 'huge.jpg', content: big }, VALID_TOKEN);
    eq(r.status, 400);
    eq(r.json.error, 'Image is too large (max ~3 MB after compression).');
  });
  await test('delete image removes file + caption', async () => {
    const r = await call(media, { action: 'delete', filename: 'img1.jpg' }, VALID_TOKEN);
    eq(r.status, 200);
    eq('src/images/gallery/img1.jpg' in store, false);
    const gjs = store['src/_data/gallery.js'].toString('utf8');
    eq(gjs.includes("'img1.jpg'"), false);
    eq(gjs.includes('Community day'), false);
  });
  await test('setCaption updates caption', async () => {
    const r = await call(media, { action: 'setCaption', filename: 'img2.png', caption: 'Riverside clean-up' }, VALID_TOKEN);
    eq(r.status, 200);
    const gjs = store['src/_data/gallery.js'].toString('utf8');
    eq(gjs.includes("'img2.png': 'Riverside clean-up'"), true);
  });
  await test('setCaption rejects pathlike name', async () => {
    const r = await call(media, { action: 'setCaption', filename: '../evil.png', caption: 'x' }, VALID_TOKEN);
    eq(r.status, 400);
  });
  await test('unknown action', async () => {
    const r = await call(media, { action: 'spin', filename: 'a.jpg' }, VALID_TOKEN);
    eq(r.status, 400);
  });

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}

run().catch((e) => {
  console.error('Runner crashed:', e);
  process.exit(1);
});