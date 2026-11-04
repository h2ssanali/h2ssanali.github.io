/* Studio — visual editor for content.json. No logins, no tokens:
   it copies the new JSON and opens GitHub's editor so Hassan pastes & commits. */
(() => {
  'use strict';
  const REPO_EDIT = 'https://github.com/h2ssanali/h2ssanali.github.io/edit/main/content.json';
  const DRAFT_KEY = 'hassan-studio-draft-v1';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const media = (p) => (!p ? '' : /^(https?:)?\/\//.test(p) || p.startsWith('/') ? p : '../' + p);

  let published = null;   // JSON string as on the site
  let data = null;        // working copy

  const SITE_FIELDS = [
    ['name', 'الاسم (يظهر كبيراً في أعلى الصفحة)'],
    ['name_latin', 'الاسم بالإنجليزي (تفصيل صغير)', 'ltr'],
    ['role', 'الوصف المهني'],
    ['tagline', 'الجملة الرئيسية'],
    ['about', 'نبذة عنك', 'area'],
    ['instagram', 'إنستغرام (اسم الحساب أو الرابط) — اتركه فارغاً لإخفائه', 'ltr'],
    ['email', 'البريد الإلكتروني — اتركه فارغاً لإخفائه', 'ltr'],
    ['whatsapp', 'رقم واتساب مع رمز الدولة، مثل 9665xxxxxxxx — اتركه فارغاً لإخفائه', 'ltr'],
  ];

  /* ------------------------------------------------------------ storage */
  const store = {
    get() { try { return localStorage.getItem(DRAFT_KEY); } catch (_) { return null; } },
    set(v) { try { localStorage.setItem(DRAFT_KEY, v); } catch (_) {} },
    clear() { try { localStorage.removeItem(DRAFT_KEY); } catch (_) {} },
  };

  function status(msg, warn = false) { const s = $('#status'); s.textContent = msg; s.classList.toggle('warn', warn); }
  const json = () => JSON.stringify(data, null, 2) + '\n';
  function dirty() { return json() !== published; }

  /* -------------------------------------------------------------- load */
  async function init() {
    try {
      const res = await fetch('../content.json', { cache: 'no-cache' });
      const obj = await res.json();
      published = JSON.stringify(obj, null, 2) + '\n';
    } catch (e) {
      status('تعذّر تحميل content.json', true);
      published = JSON.stringify({ site: {}, categories: [], works: [] }, null, 2) + '\n';
    }
    const draft = store.get();
    if (draft && draft !== published) {
      try { data = JSON.parse(draft); status('استرجعتُ تعديلاتك غير المنشورة من آخر مرة. اضغط "استرجاع المنشور" لتجاهلها.', true); }
      catch (_) { data = JSON.parse(published); }
    } else data = JSON.parse(published);
    normalize();
    renderAll();
  }

  function normalize() {
    data.site = data.site || {};
    data.categories = data.categories || [];
    data.works = (data.works || []).map((w) => ({ featured: false, hidden: false, before: '', blurb: '', ...w }));
  }

  /* ------------------------------------------------------------ changes */
  let pushT;
  function changed(rerender) {
    if (rerender) renderAll(); else updateCounts();
    store.set(json());
    status(dirty() ? 'تعديلات غير منشورة — اضغط "نسخ المحتوى" عندما تنتهي.' : 'لا توجد تعديلات.', dirty());
    clearTimeout(pushT);
    pushT = setTimeout(pushPreview, 200);
  }
  function pushPreview() {
    const f = $('#frame');
    try { f.contentWindow.postMessage({ type: 'hassan:content', content: JSON.parse(JSON.stringify(data)) }, location.origin); } catch (_) {}
  }
  $('#frame').addEventListener('load', () => setTimeout(pushPreview, 300));

  /* ------------------------------------------------------------- render */
  function renderAll() {
    renderSite();
    renderCats();
    renderWorks();
    updateCounts();
  }
  function updateCounts() {
    const vis = data.works.filter((w) => !w.hidden).length;
    $('#worksCount').textContent = `${vis}/${data.works.length}`;
    $$('.cat').forEach((li) => { li.querySelector('.n').textContent = data.works.filter((w) => w.category === li.dataset.name).length; });
  }

  function renderSite() {
    const box = $('#siteFields');
    box.innerHTML = '';
    SITE_FIELDS.forEach(([key, label, kind]) => {
      const l = document.createElement('label');
      l.innerHTML = `<span>${esc(label)}</span>`;
      const input = document.createElement(kind === 'area' ? 'textarea' : 'input');
      if (kind === 'area') input.rows = 5;
      if (kind === 'ltr') input.className = 'ltr';
      input.value = data.site[key] || '';
      input.addEventListener('input', () => { data.site[key] = input.value; changed(); });
      l.appendChild(input);
      box.appendChild(l);
    });
  }

  function renderCats() {
    const ul = $('#cats');
    ul.innerHTML = '';
    data.categories.forEach((c, i) => {
      const li = document.createElement('li');
      li.className = 'cat'; li.dataset.name = c;
      li.innerHTML = `<input value="${esc(c)}" aria-label="اسم التصنيف"><span class="n"></span>
        <button type="button" data-a="up" aria-label="أعلى">↑</button><button type="button" data-a="down" aria-label="أسفل">↓</button><button type="button" data-a="del" aria-label="حذف">✕</button>`;
      const input = li.querySelector('input');
      input.addEventListener('change', () => {
        const nv = input.value.trim();
        if (!nv || (nv !== c && data.categories.includes(nv))) { input.value = c; return; }
        data.categories[i] = nv;
        data.works.forEach((w) => { if (w.category === c) w.category = nv; });
        changed(true);
      });
      li.addEventListener('click', (e) => {
        const a = e.target.dataset.a; if (!a) return;
        if (a === 'up' && i > 0) [data.categories[i - 1], data.categories[i]] = [data.categories[i], data.categories[i - 1]];
        else if (a === 'down' && i < data.categories.length - 1) [data.categories[i + 1], data.categories[i]] = [data.categories[i], data.categories[i + 1]];
        else if (a === 'del') {
          const n = data.works.filter((w) => w.category === c).length;
          if (n && !confirm(`في هذا التصنيف ${n} عمل. سيصبحون بدون تصنيف. متأكد؟`)) return;
          data.categories.splice(i, 1);
          data.works.forEach((w) => { if (w.category === c) w.category = ''; });
        } else return;
        changed(true);
      });
      ul.appendChild(li);
    });
  }
  $('#addCat').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('#newCat').value.trim();
    if (!v || data.categories.includes(v)) return;
    data.categories.push(v);
    $('#newCat').value = '';
    changed(true);
  });

  function catOptions(sel) {
    const opts = ['<option value="">— بدون تصنيف —</option>', ...data.categories.map((c) => `<option ${c === sel ? 'selected' : ''}>${esc(c)}</option>`)];
    if (sel && !data.categories.includes(sel)) opts.push(`<option selected>${esc(sel)}</option>`);
    return opts.join('');
  }

  function renderWorks() {
    const ol = $('#works');
    ol.innerHTML = '';
    if (!data.works.length) {
      ol.innerHTML = '<li class="empty-works">لا توجد أعمال بعد. ارفع فيديو إلى مجلد <code>incoming/</code> على GitHub وسيظهر هنا تلقائياً.</li>';
      return;
    }
    const videos = data.works.map((w) => w.video).filter(Boolean);
    data.works.forEach((w, i) => {
      const li = document.createElement('li');
      li.className = 'work' + (w.hidden ? ' is-hidden' : '');
      li._w = w;
      li.innerHTML = `
        <button class="work__handle" type="button" aria-label="اسحب لتغيير الترتيب">⋮⋮</button>
        <img class="work__thumb" src="${esc(media(w.poster))}" alt="" loading="lazy">
        <div class="work__main">
          <input class="t" value="${esc(w.title)}" aria-label="العنوان" placeholder="العنوان">
          <div class="work__row">
            <select class="c" aria-label="التصنيف">${catOptions(w.category)}</select>
            <button type="button" class="tog star" aria-pressed="${!!w.featured}" title="مميّز: يظهر في الشوريل">★</button>
            <button type="button" class="tog eye" aria-pressed="${!!w.hidden}" title="إخفاء من الموقع">👁</button>
          </div>
          <details>
            <summary>تفاصيل</summary>
            <div class="fields">
              <label><span>سطر قصير يظهر في المشغّل (اختياري)</span><input class="b" value="${esc(w.blurb)}"></label>
              <label><span>فيديو "قبل" لقسم قبل/بعد (اختياري)</span>
                <select class="bf"><option value="">— لا يوجد —</option>${videos.filter((v) => v !== w.video).map((v) => `<option ${v === w.before ? 'selected' : ''}>${esc(v)}</option>`).join('')}${w.before && !videos.includes(w.before) ? `<option selected>${esc(w.before)}</option>` : ''}</select></label>
              <div class="work__move"><button type="button" data-m="-1" aria-label="أعلى">↑</button><button type="button" data-m="1" aria-label="أسفل">↓</button><a href="../#w-${esc(w.id)}" target="_blank" rel="noopener" class="mono dim" style="align-self:center;margin-inline-start:8px">مشاهدة ↗</a></div>
              <p class="path">${esc(w.video)}</p>
            </div>
          </details>
        </div>`;
      $('.t', li).addEventListener('input', (e) => { w.title = e.target.value; changed(); });
      $('.c', li).addEventListener('change', (e) => { w.category = e.target.value; changed(); });
      $('.b', li).addEventListener('input', (e) => { w.blurb = e.target.value; changed(); });
      $('.bf', li).addEventListener('change', (e) => { w.before = e.target.value; changed(); });
      $('.star', li).addEventListener('click', (e) => { w.featured = !w.featured; e.currentTarget.setAttribute('aria-pressed', w.featured); changed(); });
      $('.eye', li).addEventListener('click', (e) => { w.hidden = !w.hidden; e.currentTarget.setAttribute('aria-pressed', w.hidden); li.classList.toggle('is-hidden', w.hidden); changed(); });
      $$('[data-m]', li).forEach((b) => b.addEventListener('click', () => {
        const j = i + Number(b.dataset.m);
        if (j < 0 || j >= data.works.length) return;
        [data.works[i], data.works[j]] = [data.works[j], data.works[i]];
        changed(true);
      }));
      dragify(li, $('.work__handle', li));
      ol.appendChild(li);
    });
  }

  /* ------------------------------------------------------ drag & drop */
  function dragify(li, handle) {
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const ol = li.parentElement;
      li.classList.add('is-dragging');
      let lastY = e.clientY;
      const move = (ev) => {
        lastY = ev.clientY;
        const siblings = $$('.work', ol).filter((n) => n !== li);
        const after = siblings.find((n) => { const r = n.getBoundingClientRect(); return lastY < r.top + r.height / 2; });
        if (after) { if (li.nextElementSibling !== after) ol.insertBefore(li, after); }
        else if (ol.lastElementChild !== li) ol.appendChild(li);
        // auto-scroll the pane
        const pane = $('#paneEdit'), pr = pane.getBoundingClientRect();
        if (lastY < pr.top + 60) pane.scrollTop -= 12; else if (lastY > pr.bottom - 60) pane.scrollTop += 12;
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        li.classList.remove('is-dragging');
        const order = $$('.work', ol).map((n) => n._w);
        if (order.some((w, k) => w !== data.works[k])) { data.works = order; changed(true); }
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });
  }

  /* ------------------------------------------------------------ actions */
  $('#btnCopy').addEventListener('click', () => {
    const text = json();
    $('#manual').value = text;
    $('#ghLink').href = REPO_EDIT;
    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => { copied = true; }).catch(() => fallbackCopy());
    } else fallbackCopy();
    function fallbackCopy() {
      const ta = $('#manual'); ta.closest('details').open = true; ta.focus(); ta.select();
      try { copied = document.execCommand('copy'); } catch (_) {}
    }
    window.open(REPO_EDIT, '_blank', 'noopener');
    $('#modal').showModal();
  });

  $('#btnDownload').addEventListener('click', () => {
    const blob = new Blob([json()], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'content.json' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $('#btnReset').addEventListener('click', () => {
    if (dirty() && !confirm('ستُحذف كل تعديلاتك غير المنشورة. متأكد؟')) return;
    store.clear();
    data = JSON.parse(published);
    normalize();
    renderAll();
    changed();
  });

  $$('.tabs button').forEach((b) => b.addEventListener('click', () => {
    $$('.tabs button').forEach((t) => t.setAttribute('aria-selected', String(t === b)));
    $('.layout').dataset.pane = b.dataset.pane;
  }));
  $('.layout').dataset.pane = 'edit';

  $$('.seg button').forEach((b) => b.addEventListener('click', () => {
    $$('.seg button').forEach((t) => t.setAttribute('aria-pressed', String(t === b)));
    $('#stage').classList.toggle('desktop', b.dataset.size === 'desktop');
  }));

  window.addEventListener('beforeunload', (e) => { if (data && dirty()) { e.preventDefault(); e.returnValue = ''; } });

  init();
})();
