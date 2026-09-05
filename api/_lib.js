// Shared helpers for the admin API functions.
// The GitHub token and admin password hash live only in Vercel environment
// variables — never in the repo or the browser.

const crypto = require('crypto');

const GH_API = 'https://api.github.com';

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  if (!req.body) return {};
  return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
}

// Admin writes require an X-Admin-Token header equal to the SHA-256 hash of
// the admin password (ADMIN_PASSWORD_HASH env var).
function authorized(req) {
  const expected = String(process.env.ADMIN_PASSWORD_HASH || '').toLowerCase();
  const token = String((req.headers && req.headers['x-admin-token']) || '').toLowerCase();
  return !!expected && token.length > 0 && token === expected;
}

function repo() {
  const r = String(process.env.GITHUB_REPO || '').trim().replace(/^\/+|\/+$/g, '');
  if (!r) throw new Error('GITHUB_REPO env var is not configured.');
  return r;
}

function ghToken() {
  const t = process.env.GITHUB_TOKEN;
  if (!t) throw new Error('GITHUB_TOKEN env var is not configured.');
  return t;
}

async function ghRequest(method, endpoint, payload) {
  const url = endpoint.startsWith('http') ? endpoint : GH_API + endpoint;
  const res = await fetch(url, {
    method: method,
    headers: {
      Authorization: 'Bearer ' + ghToken(),
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = null;
    }
  }
  return { ok: res.ok, status: res.status, data: data };
}

async function defaultBranch() {
  const { ok, data } = await ghRequest('GET', '/repos/' + repo());
  if (!ok) throw new Error('Could not reach the GitHub repository. Check GITHUB_REPO and GITHUB_TOKEN.');
  return data.default_branch || 'main';
}

async function readFile(path) {
  const branch = await defaultBranch();
  const { ok, data } = await ghRequest(
    'GET',
    '/repos/' + repo() + '/contents/' + path + '?ref=' + encodeURIComponent(branch)
  );
  if (!ok) throw new Error('File not found: ' + path);
  return { sha: data.sha, content: Buffer.from(data.content, 'base64').toString('utf8') };
}

async function writeFile(path, content, existingSha, message) {
  const payload = {
    message: message || (existingSha ? 'chore: update ' + path : 'chore: add ' + path),
    content: Buffer.from(content, 'utf8').toString('base64'),
  };
  if (existingSha) payload.sha = existingSha;
  const { ok, status, data } = await ghRequest(
    'PUT',
    '/repos/' + repo() + '/contents/' + path,
    payload
  );
  if (!ok) {
    throw new Error(
      'GitHub rejected the change (' + status + '). ' + JSON.stringify(data && data.message)
    );
  }
  return true;
}

async function deleteFile(path, message) {
  const file = await readFile(path);
  const { ok, status, data } = await ghRequest(
    'DELETE',
    '/repos/' + repo() + '/contents/' + path,
    { message: message || 'chore: delete ' + path, sha: file.sha }
  );
  if (!ok) {
    throw new Error(
      'GitHub rejected the delete (' + status + '). ' + JSON.stringify(data && data.message)
    );
  }
  return true;
}

async function listDir(path) {
  const branch = await defaultBranch();
  const { ok, data } = await ghRequest(
    'GET',
    '/repos/' + repo() + '/contents/' + path + '?ref=' + encodeURIComponent(branch)
  );
  if (!ok) return [];
  if (!Array.isArray(data)) return [];
  return data.filter((item) => item.type === 'file');
}

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseFrontMatter(text) {
  const source = String(text || '');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source);
  if (!match) return { data: {}, body: source };
  const data = {};
  const lines = match[1].split(/\r?\n/);
  for (const line of lines) {
    const i = line.indexOf(':');
    if (i > 0) {
      const key = line.slice(0, i).trim();
      const val = line.slice(i + 1).trim().replace(/^["']+|["']+$/g, '');
      data[key] = val;
    }
  }
  const body = match[2].replace(/^\r?\n/, '');
  return { data: data, body: body };
}

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

module.exports = {
  json,
  readBody,
  authorized,
  ghRequest,
  defaultBranch,
  readFile,
  writeFile,
  deleteFile,
  listDir,
  slugify,
  parseFrontMatter,
  todayISO,
  GH_API,
};