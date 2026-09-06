/* Admin content manager: News posts, Programs, Gallery.
   Everything is stored in the GitHub repo via /api/content.js and /api/media.js.
   The browser only ever sends the password hash (X-Admin-Token); the GitHub
   token and password hash stay in Vercel env vars. */
(function () {
  'use strict';

  var TOKEN_KEY = 'bhAdminToken';

  var loginCard = document.getElementById('login-card');
  var panel = document.getElementById('admin-panel');
  var passwordInput = document.getElementById('admin-password');
  var loginBtn = document.getElementById('admin-login-btn');
  var loginError = document.getElementById('login-error');
  var welcome = document.getElementById('admin-welcome');
  var statusEl = document.getElementById('admin-status');

  var token = '';

  /* ---------- helpers ---------- */

  function sha256(text) {
    var data = new TextEncoder().encode(text);
    return crypto.subtle.digest('SHA-256', data).then(function (buf) {
      return Array.prototype.map
        .call(new Uint8Array(buf), function (b) {
          return b.toString(16).padStart(2, '0');
        })
        .join('');
    });
  }

  function todayISO() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function timestamp() {
    var d = new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    return (
      d.getFullYear() +
      p(d.getMonth() + 1) +
      p(d.getDate()) +
      '_' +
      p(d.getHours()) +
      p(d.getMinutes()) +
      p(d.getSeconds())
    );
  }

  function uniqueImageName(input) {
    var base = String(input && input.name ? input.name : 'image.jpg')
      .replace(/\.[^.]+$/, '')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]+/gi, '')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
    return (base || 'image') + '_' + timestamp() + '.jpg';
  }

  function setStatus(text, kind) {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.className = 'admin-status' + (kind ? ' ' + kind : '');
    statusEl.hidden = !text;
    if (text) {
      clearTimeout(statusEl._t);
      statusEl._t = setTimeout(function () {
        statusEl.hidden = true;
      }, 5000);
    }
  }

  async function api(path, payload) {
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['X-Admin-Token'] = token;
    var res = await fetch(path, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload || {}),
    });
    var data;
    try {
      data = await res.json();
    } catch (e) {
      data = {};
    }
    if (!res.ok) {
      var msg = (data && data.error) || 'Request failed (' + res.status + ').';
      var err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  /* ---------- login ---------- */

  async function attemptLogin() {
    var value = passwordInput.value;
    if (!value) return;
    loginBtn.disabled = true;
    loginError.textContent = '';
    var hash = await sha256(value);
    token = hash;
    try {
      await api('/api/content', { action: 'list', type: 'posts' });
      sessionStorage.setItem(TOKEN_KEY, hash);
      loginCard.hidden = true;
      panel.hidden = false;
      welcome.hidden = false;
      passwordInput.value = '';
      switchTab('news');
      loadPosts();
    } catch (e) {
      token = '';
      if (e.status === 401) {
        loginError.textContent = 'Incorrect password. Please try again.';
      } else {
        loginError.textContent =
          'Could not reach the admin backend. Check that GITHUB_REPO, GITHUB_TOKEN and ADMIN_PASSWORD_HASH are set in Vercel.';
      }
    } finally {
      loginBtn.disabled = false;
    }
  }

  if (loginBtn) {
    loginBtn.addEventListener('click', attemptLogin);
    passwordInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') attemptLogin();
    });
  }

  (function restoreSession() {
    var saved = sessionStorage.getItem(TOKEN_KEY);
    if (!saved) return;
    token = saved;
    api('/api/content', { action: 'list', type: 'posts' })
      .then(function () {
        loginCard.hidden = true;
        panel.hidden = false;
        welcome.hidden = false;
        switchTab('news');
        loadPosts();
      })
      .catch(function () {
        token = '';
        sessionStorage.removeItem(TOKEN_KEY);
      });
  })();

  /* ---------- tabs ---------- */

  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab-btn'));

  function switchTab(name) {
    tabs.forEach(function (t) {
      var on = t.dataset.tab === name;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.getElementById('tab-news').hidden = name !== 'news';
    document.getElementById('tab-programs').hidden = name !== 'programs';
    document.getElementById('tab-gallery').hidden = name !== 'gallery';
    if (name === 'news') loadPosts();
    if (name === 'programs') loadPrograms();
    if (name === 'gallery') loadGallery();
  }

  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      switchTab(t.dataset.tab);
    });
  });

  /* ---------- news posts ---------- */

  var postEditor = {
    path: null,
    title: document.getElementById('post-title'),
    date: document.getElementById('post-date'),
    excerpt: document.getElementById('post-excerpt'),
    imageFile: document.getElementById('post-image-file'),
    imageCurrent: document.getElementById('post-image-current'),
    body: document.getElementById('post-body'),
    container: document.getElementById('post-editor'),
    heading: document.getElementById('post-editor-title'),
    saveBtn: document.getElementById('post-save-btn'),
    cancelBtn: document.getElementById('post-cancel-btn'),
    deleteBtn: document.getElementById('post-delete-btn'),
  };

  function openPostEditor(entry) {
    postEditor.path = entry ? entry.path : null;
    postEditor.heading.textContent = entry ? 'Edit post' : 'New News post';
    postEditor.title.value = entry ? entry.data.title : '';
    postEditor.date.value = entry ? entry.data.date : todayISO();
    postEditor.excerpt.value = entry ? entry.data.excerpt : '';
    if (postEditor.imageFile) postEditor.imageFile.value = '';
    if (postEditor.imageCurrent) {
      postEditor.imageCurrent.textContent = entry && entry.data.image ? 'Current image: ' + entry.data.image : '';
      postEditor.imageCurrent.hidden = !(entry && entry.data.image);
    }
    postEditor.body.value = entry ? entry.data.body : '';
    postEditor.deleteBtn.hidden = !entry;
    postEditor.container.hidden = false;
    postEditor.title.focus();
  }

  function closePostEditor() {
    postEditor.container.hidden = true;
    loadPosts();
  }

  async function savePost() {
    var fileInput = postEditor.imageFile;
    var uploaded = '';
    if (fileInput && fileInput.files && fileInput.files[0]) {
      setStatus('Uploading image…', 'ok');
      try {
        var resized = await resizeImage(fileInput.files[0]);
        resized.name = uniqueImageName(fileInput.files[0]);
        var media = await api('/api/media', {
          action: 'upload',
          filename: resized.name,
          content: resized.base64,
          caption: '',
        });
        uploaded = '/images/gallery/' + media.name;
      } catch (e) {
        setStatus(e.message || 'Image upload failed.', 'error');
        return;
      }
    } else if (postEditor.path && postEditor.imageCurrent && postEditor.imageCurrent.textContent) {
      uploaded = postEditor.imageCurrent.textContent.replace(/^Current image:\s*/, '');
    }

    if (!uploaded) {
      setStatus('Please upload a post image.', 'error');
      return;
    }

    var payload = {
      action: 'save',
      type: 'posts',
      title: postEditor.title.value,
      date: postEditor.date.value,
      excerpt: postEditor.excerpt.value,
      image: uploaded,
      body: postEditor.body.value,
    };
    if (postEditor.path) payload.path = postEditor.path;
    postEditor.saveBtn.disabled = true;
    try {
      var r = await api('/api/content', payload);
      setStatus(r.created ? 'Post created — site is updating.' : 'Post updated — site is updating.', 'ok');
      closePostEditor();
    } catch (e) {
      setStatus(e.message, 'error');
    } finally {
      postEditor.saveBtn.disabled = false;
    }
  }

  async function deletePost() {
    if (!postEditor.path) return;
    if (!confirm('Delete this post permanently?')) return;
    try {
      await api('/api/content', { action: 'delete', type: 'posts', path: postEditor.path });
      setStatus('Post deleted.', 'ok');
      closePostEditor();
    } catch (e) {
      setStatus(e.message, 'error');
    }
  }

  document.getElementById('post-new-btn').addEventListener('click', function () {
    openPostEditor(null);
  });
  postEditor.saveBtn.addEventListener('click', savePost);
  postEditor.cancelBtn.addEventListener('click', closePostEditor);
  postEditor.deleteBtn.addEventListener('click', deletePost);

  async function loadPosts() {
    var list = document.getElementById('post-list');
    list.innerHTML = '<p class="muted">Loading…</p>';
    try {
      var data = await api('/api/content', { action: 'list', type: 'posts' });
      if (!data.items.length) {
        list.innerHTML = '<p class="muted">No posts yet. Click “+ New News post” to create one.</p>';
        return;
      }
      list.innerHTML = '';
      data.items.forEach(function (item) {
        var card = document.createElement('div');
        card.className = 'admin-item';
        var info = document.createElement('div');
        info.className = 'admin-item-info';
        var title = document.createElement('strong');
        title.textContent = item.title;
        var meta = document.createElement('span');
        meta.textContent = item.date || '';
        info.appendChild(title);
        info.appendChild(meta);
        var actions = document.createElement('div');
        actions.className = 'admin-item-actions';
        actions.innerHTML =
          '<button type="button" class="btn btn-sm" data-act="edit" data-path="' +
          escapeHtml(item.path) +
          '">Edit</button> ' +
          '<button type="button" class="btn btn-sm btn-danger" data-act="delete" data-path="' +
          escapeHtml(item.path) +
          '">Delete</button>';
        card.appendChild(info);
        card.appendChild(actions);
        list.appendChild(card);
      });
    } catch (e) {
      list.innerHTML = '<p class="muted">' + escapeHtml(e.message) + '</p>';
    }
  }

  listHandler('post-list', async function (target) {
    var path = target.dataset.path;
    if (target.dataset.act === 'edit') {
      try {
        var data = await api('/api/content', { action: 'get', type: 'posts', path: path });
        openPostEditor({ path: path, data: data.data });
      } catch (e) {
        setStatus(e.message, 'error');
      }
    } else if (target.dataset.act === 'delete') {
      if (!confirm('Delete this post permanently?')) return;
      try {
        await api('/api/content', { action: 'delete', type: 'posts', path: path });
        setStatus('Post deleted.', 'ok');
        loadPosts();
      } catch (e) {
        setStatus(e.message, 'error');
      }
    }
  });

  /* ---------- programs ---------- */

  var programEditor = {
    path: null,
    title: document.getElementById('program-title'),
    tag: document.getElementById('program-tag'),
    order: document.getElementById('program-order'),
    excerpt: document.getElementById('program-excerpt'),
    imageFile: document.getElementById('program-image-file'),
    imageCurrent: document.getElementById('program-image-current'),
    body: document.getElementById('program-body'),
    container: document.getElementById('program-editor'),
    heading: document.getElementById('program-editor-title'),
    saveBtn: document.getElementById('program-save-btn'),
    cancelBtn: document.getElementById('program-cancel-btn'),
    deleteBtn: document.getElementById('program-delete-btn'),
  };

  function openProgramEditor(entry) {
    var d = entry ? entry.data : {};
    programEditor.path = entry ? entry.path : null;
    programEditor.heading.textContent = entry ? 'Edit program' : 'New program';
    programEditor.title.value = d.title || '';
    programEditor.tag.value = d.tag || '';
    programEditor.order.value = (d.order !== undefined && d.order !== '') ? d.order : 1;
    programEditor.excerpt.value = d.excerpt || '';
    if (programEditor.imageFile) programEditor.imageFile.value = '';
    if (programEditor.imageCurrent) {
      programEditor.imageCurrent.textContent = entry && d.image ? 'Current image: ' + d.image : '';
      programEditor.imageCurrent.hidden = !(entry && d.image);
    }
    programEditor.body.value = d.body || '';
    programEditor.deleteBtn.hidden = !entry;
    programEditor.container.hidden = false;
    programEditor.title.focus();
  }

  function closeProgramEditor() {
    programEditor.container.hidden = true;
    loadPrograms();
  }

  async function saveProgram() {
    var fileInput = programEditor.imageFile;
    var uploaded = '';
    if (fileInput && fileInput.files && fileInput.files[0]) {
      setStatus('Uploading image…', 'ok');
      try {
        var resized = await resizeImage(fileInput.files[0]);
        resized.name = uniqueImageName(fileInput.files[0]);
        var media = await api('/api/media', {
          action: 'upload',
          filename: resized.name,
          content: resized.base64,
          caption: '',
        });
        uploaded = '/images/gallery/' + media.name;
      } catch (e) {
        setStatus(e.message || 'Image upload failed.', 'error');
        return;
      }
    } else if (programEditor.path && programEditor.imageCurrent && programEditor.imageCurrent.textContent) {
      uploaded = programEditor.imageCurrent.textContent.replace(/^Current image:\s*/, '');
    }

    if (!uploaded) {
      setStatus('Please upload a program image.', 'error');
      return;
    }

    var payload = {
      action: 'save',
      type: 'programs',
      title: programEditor.title.value,
      tag: programEditor.tag.value,
      order: programEditor.order.value,
      excerpt: programEditor.excerpt.value,
      image: uploaded,
      body: programEditor.body.value,
    };
    if (programEditor.path) payload.path = programEditor.path;
    programEditor.saveBtn.disabled = true;
    try {
      var r = await api('/api/content', payload);
      setStatus(r.created ? 'Program created — site is updating.' : 'Program updated — site is updating.', 'ok');
      closeProgramEditor();
    } catch (e) {
      setStatus(e.message, 'error');
    } finally {
      programEditor.saveBtn.disabled = false;
    }
  }

  document.getElementById('program-new-btn').addEventListener('click', function () {
    openProgramEditor(null);
  });
  programEditor.saveBtn.addEventListener('click', saveProgram);
  programEditor.cancelBtn.addEventListener('click', closeProgramEditor);
  programEditor.deleteBtn.addEventListener('click', async function () {
    if (!programEditor.path) return;
    if (!confirm('Delete this program permanently?')) return;
    try {
      await api('/api/content', { action: 'delete', type: 'programs', path: programEditor.path });
      setStatus('Program deleted.', 'ok');
      closeProgramEditor();
    } catch (e) {
      setStatus(e.message, 'error');
    }
  });

  async function loadPrograms() {
    var list = document.getElementById('program-list');
    list.innerHTML = '<p class="muted">Loading…</p>';
    try {
      var data = await api('/api/content', { action: 'list', type: 'programs' });
      if (!data.items.length) {
        list.innerHTML = '<p class="muted">No programs yet. Click “+ New program” to create one.</p>';
        return;
      }
      list.innerHTML = '';
      data.items.forEach(function (item) {
        var card = document.createElement('div');
        card.className = 'admin-item';
        var info = document.createElement('div');
        info.className = 'admin-item-info';
        var title = document.createElement('strong');
        title.textContent = item.title;
        var meta = document.createElement('span');
        meta.textContent =
          (item.order !== undefined && item.order !== '' ? 'Position: ' + item.order + ' · ' : '') +
          (item.excerpt || '');
        info.appendChild(title);
        info.appendChild(meta);
        var actions = document.createElement('div');
        actions.className = 'admin-item-actions';
        actions.innerHTML =
          '<button type="button" class="btn btn-sm" data-act="edit" data-path="' +
          escapeHtml(item.path) +
          '">Edit</button> ' +
          '<button type="button" class="btn btn-sm btn-danger" data-act="delete" data-path="' +
          escapeHtml(item.path) +
          '">Delete</button>';
        card.appendChild(info);
        card.appendChild(actions);
        list.appendChild(card);
      });
    } catch (e) {
      list.innerHTML = '<p class="muted">' + escapeHtml(e.message) + '</p>';
    }
  }

  listHandler('program-list', async function (target) {
    var path = target.dataset.path;
    if (target.dataset.act === 'edit') {
      try {
        var data = await api('/api/content', { action: 'get', type: 'programs', path: path });
        openProgramEditor({ path: path, data: data.data });
      } catch (e) {
        setStatus(e.message, 'error');
      }
    } else if (target.dataset.act === 'delete') {
      if (!confirm('Delete this program permanently?')) return;
      try {
        await api('/api/content', { action: 'delete', type: 'programs', path: path });
        setStatus('Program deleted.', 'ok');
        loadPrograms();
      } catch (e) {
        setStatus(e.message, 'error');
      }
    }
  });

  /* ---------- gallery ---------- */

  var uploadBox = document.getElementById('gallery-upload');

  document.getElementById('gallery-upload-btn').addEventListener('click', function () {
    uploadBox.hidden = false;
  });
  document.getElementById('gallery-upload-cancel-btn').addEventListener('click', function () {
    uploadBox.hidden = true;
  });

  document.getElementById('gallery-upload-save-btn').addEventListener('click', async function () {
    var fileInput = document.getElementById('gallery-file');
    if (!fileInput.files || !fileInput.files[0]) {
      setStatus('Please choose a photo first.', 'error');
      return;
    }
    var caption = document.getElementById('gallery-caption').value;
    var btn = document.getElementById('gallery-upload-save-btn');
    btn.disabled = true;
    try {
      var resized = await resizeImage(fileInput.files[0]);
      resized.name = uniqueImageName(fileInput.files[0]);
      var data = await api('/api/media', {
        action: 'upload',
        filename: resized.name,
        content: resized.base64,
        caption: caption,
      });
      setStatus('Uploaded ' + data.name + ' — site is updating.', 'ok');
      fileInput.value = '';
      document.getElementById('gallery-caption').value = '';
      uploadBox.hidden = true;
      loadGallery();
    } catch (e) {
      setStatus(e.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  function resizeImage(file) {
    var maxSize = 1600;
    var quality = 0.82;
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth;
        var h = img.naturalHeight;
        var scale = Math.min(1, maxSize / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        var base64 = canvas.toDataURL('image/jpeg', quality).split(',')[1];
        var name = String(file.name || 'image.jpg')
          .replace(/\.[^.]+$/, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        resolve({ base64: base64, name: (name || 'image') + '.jpg' });
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Could not read that image file.'));
      };
      img.src = url;
    });
  }

  async function loadGallery() {
    var grid = document.getElementById('gallery-grid');
    var empty = document.getElementById('gallery-empty');
    grid.hidden = false;
    grid.innerHTML = '<p class="muted">Loading…</p>';
    try {
      var data = await api('/api/media', { action: 'list' });
      if (!data.images.length) {
        empty.hidden = false;
        grid.hidden = true;
        return;
      }
      empty.hidden = true;
      grid.innerHTML = '';
      data.images.forEach(function (img) {
        var item = document.createElement('div');
        item.className = 'admin-gallery-item';
        var preview = document.createElement('img');
        preview.src = '/images/gallery/' + img.name;
        preview.alt = img.caption || img.name;
        var name = document.createElement('span');
        name.className = 'admin-img-name';
        name.textContent = img.name;
        var cap = document.createElement('input');
        cap.type = 'text';
        cap.className = 'admin-img-caption';
        cap.placeholder = 'Caption';
        cap.value = img.caption || '';
        var actions = document.createElement('div');
        actions.className = 'admin-item-actions';
        actions.innerHTML =
          '<button type="button" class="btn btn-sm" data-act="caption">Save caption</button> ' +
          '<button type="button" class="btn btn-sm btn-danger" data-act="delete">Delete</button>';
        item.appendChild(preview);
        item.appendChild(name);
        item.appendChild(cap);
        item.appendChild(actions);
        grid.appendChild(item);

        actions.querySelector('[data-act="caption"]').addEventListener('click', async function () {
          try {
            await api('/api/media', { action: 'setCaption', filename: img.name, caption: cap.value });
            setStatus('Caption saved — site is updating.', 'ok');
          } catch (e) {
            setStatus(e.message, 'error');
          }
        });
        actions.querySelector('[data-act="delete"]').addEventListener('click', async function () {
          if (!confirm('Delete ' + img.name + ' permanently?')) return;
          try {
            await api('/api/media', { action: 'delete', filename: img.name });
            setStatus('Image deleted — site is updating.', 'ok');
            loadGallery();
          } catch (e) {
            setStatus(e.message, 'error');
          }
        });
      });
    } catch (e) {
      grid.innerHTML = '<p class="muted">' + escapeHtml(e.message) + '</p>';
    }
  }

  /* ---------- shared ---------- */

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function listHandler(containerId, handler) {
    var container = document.getElementById(containerId);
    container.addEventListener('click', function (e) {
      var target = e.target.closest('[data-act]');
      if (target) handler(target);
    });
  }

  switchTab('news');
})();