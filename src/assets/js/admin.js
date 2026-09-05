/* Admin: password gate + content generators. No backend - everything runs locally in the browser. */
(function () {
  'use strict';

  var configScript = document.getElementById('admin-config');
  var config = configScript ? JSON.parse(configScript.textContent) : {};
  var expectedHash = config.passwordHash || '';

  var loginCard = document.getElementById('login-card');
  var panel = document.getElementById('admin-panel');
  var passwordInput = document.getElementById('admin-password');
  var loginBtn = document.getElementById('admin-login-btn');
  var loginError = document.getElementById('login-error');

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

  function slugify(input) {
    return String(input || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function today() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  if (loginBtn) {
    loginBtn.addEventListener('click', async function () {
      var value = passwordInput.value;
      if (!value) return;
      var hash = await sha256(value);
      if (hash === expectedHash) {
        loginCard.hidden = true;
        panel.hidden = false;
        passwordInput.value = '';
        loginError.textContent = '';
        sessionStorage.setItem('brightHopeAdmin', '1');
      } else {
        loginError.textContent = 'Incorrect password. Please try again.';
      }
    });

    passwordInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') loginBtn.click();
    });

    // Keep the session for this browser tab/visit.
    if (sessionStorage.getItem('brightHopeAdmin') === '1' && expectedHash) {
      loginCard.hidden = true;
      panel.hidden = false;
    }
  }

  /* ---------- Generators ---------- */

  function setupGenerator(opts) {
    var bodyInput = document.getElementById(opts.bodyId);
    var generateBtn = document.getElementById(opts.generateBtnId);
    var copyBtn = document.getElementById(opts.copyBtnId);
    var output = document.getElementById(opts.outputId);

    generateBtn.addEventListener('click', function () {
      var frontMatterLines = opts.buildFrontMatter();
      var body = String(bodyInput.value || '').trim();
      var md =
        '---\n' + frontMatterLines.join('\n') + '\n---\n\n' + (body ? body + '\n' : '');
      output.textContent = md;
      output.hidden = false;
      copyBtn.disabled = false;
    });

    copyBtn.addEventListener('click', function () {
      var text = output.textContent;
      if (text && navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function () {
          copyBtn.textContent = 'Copied!';
          setTimeout(function () {
            copyBtn.textContent = 'Copy to clipboard';
          }, 1500);
        });
      }
    });
  }

  setupGenerator({
    titleId: 'post-title',
    bodyId: 'post-body',
    generateBtnId: 'post-generate-btn',
    copyBtnId: 'post-copy-btn',
    outputId: 'post-output',
    buildFrontMatter: function () {
      var title = document.getElementById('post-title').value.trim();
      var excerpt = document.getElementById('post-excerpt').value.trim();
      var lines = ['---', 'layout: post.njk', 'date: ' + today()];
      if (title) lines.push('title: ' + title);
      if (excerpt) lines.push('excerpt: ' + excerpt);
      lines.push('---');
      return lines;
    },
  });

  setupGenerator({
    titleId: 'prog-title',
    bodyId: 'prog-body',
    generateBtnId: 'prog-generate-btn',
    copyBtnId: 'prog-copy-btn',
    outputId: 'prog-output',
    buildFrontMatter: function () {
      var title = document.getElementById('prog-title').value.trim();
      var tag = document.getElementById('prog-tag').value.trim();
      var excerpt = document.getElementById('prog-excerpt').value.trim();
      var lines = ['---', 'layout: page.njk', 'order: 99'];
      if (title) lines.push('title: ' + title);
      if (tag) lines.push('tag: ' + tag);
      if (excerpt) lines.push('subtitle: ' + excerpt, 'excerpt: ' + excerpt);
      lines.push('---');
      return lines;
    },
  });
})();