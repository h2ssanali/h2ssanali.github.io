/* Studio — phone-first editor for content.json.
   No logins or tokens live here. Publishing opens GitHub's "new file" page with
   the edit pre-filled (incoming/edit-*.studio); one "Commit" and a workflow
   applies it. Copy & paste into content.json stays as a fallback. */
(() => {
  'use strict';
  const REPO = 'https://github.com/h2ssanali/h2ssanali.github.io';
  const DRAFT_KEY = 'hassan-studio-draft-v2';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const media = (p) => (!p ? '' : /^(https?:)?\/\//.test(p) || p.startsWith('/') ? p : '../' + p);

  const THEMES = [
    { id: 'suite', name: 'غرفة المونتاج', desc: 'ليل وضوء كهرماني وإحساس الشاشة الكبيرة.', bg: 'radial-gradient(80% 70% at 30% 30%, #3a2a12, #0b0a08 70%)', ink: '#f3eadb', accent: '#f5a524', font: 'Lalezar', poster: 'saturate(.9)', radius: '8px' },
    { id: 'archive', name: 'أرشيف ورقي', desc: 'ورق قديم وحبر وختم أحمر، بروح الكولاج والحكايات.', bg: 'radial-gradient(90% 80% at 50% 0%, #f5eddc, #e3d6bc)', ink: '#1f1a14', accent: '#b3261e', font: 'Aref Ruqaa', poster: 'sepia(.25)', radius: '2px', frame: '4px solid #fbf8f1' },
    { id: 'noir', name: 'أبيض وأسود', desc: 'صور بالأبيض والأسود بتتلوّن لما تلمسها، ولمسة أحمر.', bg: '#060606', ink: '#f4f4f4', accent: '#e5332a', font: 'Reem Kufi', poster: 'grayscale(1) contrast(1.15)', radius: '0' },
    { id: 'teal', name: 'تيل وبرتقالي', desc: 'ألوان التصحيح السينمائي المشهورة، دافئة وعصرية.', bg: 'radial-gradient(80% 70% at 30% 30%, #12414a, #061a1e 70%)', ink: '#eef5f2', accent: '#ff8a3d', font: 'Marhey', poster: 'saturate(1.05)', radius: '12px' },
  ];

  const ICONS = {
    whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm4.5 12.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 3c.4 2.2 1.8 3.6 4 3.8v3.1a7.6 7.6 0 0 1-4-1.2v6.1a5.8 5.8 0 1 1-5.8-5.8c.3 0 .6 0 .9.1v3.2a2.7 2.7 0 1 0 1.8 2.5V3h3.1z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 7.5a3 3 0 0 0-2.1-2.1C19 5 12 5 12 5s-7 0-8.9.4A3 3 0 0 0 1 7.5 31 31 0 0 0 .6 12 31 31 0 0 0 1 16.5a3 3 0 0 0 2.1 2.1C5 19 12 19 12 19s7 0 8.9-.4a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .4-4.5 31 31 0 0 0-.4-4.5zM9.8 15.2V8.8L15.5 12z"/></svg>',
    snapchat: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5c3 0 5.2 2.3 5.2 5.3v2.4c.5.2 1 .1 1.5-.1.6-.2 1.1.5.6 1-.6.5-1.6.8-2.1 1 .6 1.9 2.1 3.4 3.9 3.9.4.1.4.6 0 .8-.8.4-1.7.5-2.3.7-.2.5-.1 1.2-.7 1.2-.8 0-1.6-.4-2.7 0-1.1.4-1.8 1.6-3.4 1.6s-2.3-1.2-3.4-1.6c-1.1-.4-1.9 0-2.7 0-.6 0-.5-.7-.7-1.2-.6-.2-1.5-.3-2.3-.7-.4-.2-.4-.7 0-.8 1.8-.5 3.3-2 3.9-3.9-.5-.2-1.5-.5-2.1-1-.5-.5 0-1.2.6-1 .5.2 1 .3 1.5.1V7.8c0-3 2.2-5.3 5.2-5.3z"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.2L1.9 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.3 4.7H5.5l11.2 14.5z"/></svg>',
    email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  };
  const CONTACTS = [
    ['whatsapp', 'واتساب', 'رقمك مع رمز الدولة، مثل 9665xxxxxxxx', 'tel', 'tel'],
    ['instagram', 'إنستغرام', 'اسم الحساب، مثل @hassan', 'text', 'url'],
    ['tiktok', 'تيك توك', 'اسم الحساب', 'text', 'url'],
    ['youtube', 'يوتيوب', 'اسم القناة أو الرابط', 'text', 'url'],
    ['snapchat', 'سناب شات', 'اسم الحساب', 'text', 'url'],
    ['x', 'إكس (تويتر)', 'اسم الحساب', 'text', 'url'],
    ['email', 'الإيميل', 'name@example.com', 'email', 'email'],
  ];
  const TEXTS = [
    ['name', 'اسمك (يطلع كبير فوق)'],
    ['role', 'شو بتشتغل'],
    ['tagline', 'الجملة الرئيسية'],
    ['about', 'نبذة عنك', true],
    ['name_latin', 'اسمك بالإنجليزي (تفصيل صغير)'],
  ];
  const ICON = {
    up: '<svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  };

  let published = null; // JSON text as on the site
  let data = null;       // working copy

  const store = {
    get() { try { return localStorage.getItem(DRAFT_KEY); } catch (_) { return null; } },
    set(v) { try { localStorage.setItem(DRAFT_KEY, v); } catch (_) {} },
    clear() { try { localStorage.removeItem(DRAFT_KEY); } catch (_) {} },
  };
  const json = () => JSON.stringify(data, null, 2) + '\n';
  const dirty = () => json() !== published;

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 1800);
  }

  /* -------------------------------------------------------------- load */
  async function init() {
    try {
      const res = await fetch('../content.json', { cache: 'no-cache' });
      published = JSON.stringify(await res.json(), null, 2) + '\n';
    } catch (_) {
      published = JSON.stringify({ site: {}, categories: [], style: [], works: [] }, null, 2) + '\n';
      toast('ما قدرت أحمّل المحتوى');
    }
    const draft = store.get();
    data = JSON.parse(published);
    if (draft && draft !== published) {
      try { data = JSON.parse(draft); } catch (_) { /* ignore */ }
    }
    normalize();
    renderAll();
    changed(false, true);
  }
  function normalize() {
    data.site = { theme: 'suite', show_style: true, show_about: true, ...(data.site || {}) };
    data.categories = data.categories || [];
    data.style = data.style || [];
    data.works = (data.works || []).map((w) => ({ featured: false, hidden: false, before: '', blurb: '', ...w }));
  }

  /* ------------------------------------------------------------ changes */
  let pushT;
  function changed(rerender, quiet) {
    if (rerender) renderAll();
    const d = dirty();
    if (!quiet || d) store.set(json());
    if (!d) store.clear();
    const s = $('#status');
    s.textContent = d ? '● تعديلات ما انتشرت بعد' : 'كل شي منشور';
    s.classList.toggle('dirty', d);
    $('#publishBar').hidden = !d;
    $('#worksCount').textContent = `${data.works.filter((w) => !w.hidden).length} ظاهر من ${data.works.length}`;
    clearTimeout(pushT);
    pushT = setTimeout(pushPreview, 150);
  }
  function pushPreview() {
    try { $('#frame').contentWindow.postMessage({ type: 'hassan:content', content: JSON.parse(JSON.stringify(data)) }, location.origin); } catch (_) {}
  }
  function scrollPreview(id) {
    try { $('#frame').contentWindow.postMessage({ type: 'hassan:scroll', to: id }, location.origin); } catch (_) {}
  }
  $('#frame').addEventListener('load', () => setTimeout(pushPreview, 300));

  function renderAll() { renderWorks(); renderCats(); renderThemes(); renderSwitches(); renderStyle(); renderInfo(); }

  /* -------------------------------------------------------------- works */
  function renderWorks() {
    const ol = $('#works');
    ol.innerHTML = '';
    if (!data.works.length) { ol.innerHTML = '<li class="hint">ما في أعمال لسا. ارفع فيديو على مجلد incoming.</li>'; return; }
    data.works.forEach((w, i) => {
      const li = document.createElement('li');
      li.className = 'work' + (w.hidden ? ' is-hidden' : '');
      li._w = w;
      li.innerHTML = `
        <button class="work__handle" type="button" aria-label="اسحب لترتيب">⋮⋮</button>
        <img class="work__thumb" src="${esc(media(w.poster))}" alt="" loading="lazy">
        <button class="work__open" type="button"><b>${esc(w.title || 'بدون عنوان')}</b><span>${esc(w.category || 'بدون تصنيف')}${w.hidden ? ' · مخفي' : ''}</span></button>
        <div class="work__side">
          <button class="ico star" type="button" aria-pressed="${!!w.featured}" aria-label="مميّز بالشوريل">★</button>
          <button class="ico up" type="button" aria-label="لفوق" ${i === 0 ? 'disabled' : ''}>${ICON.up}</button>
          <button class="ico eye" type="button" aria-pressed="${!!w.hidden}" aria-label="إخفاء من الموقع">${ICON.eye}</button>
          <button class="ico down" type="button" aria-label="لتحت" ${i === data.works.length - 1 ? 'disabled' : ''}>${ICON.down}</button>
        </div>`;
      $('.work__open', li).addEventListener('click', () => openWork(w));
      $('.work__thumb', li).addEventListener('click', () => openWork(w));
      $('.star', li).addEventListener('click', () => { w.featured = !w.featured; changed(true); toast(w.featured ? '★ صار بالشوريل' : 'انشال من الشوريل'); });
      $('.eye', li).addEventListener('click', () => { w.hidden = !w.hidden; changed(true); toast(w.hidden ? 'انخفى من الموقع' : 'رجع ظاهر'); });
      $('.up', li).addEventListener('click', () => move(i, -1));
      $('.down', li).addEventListener('click', () => move(i, 1));
      dragify(li, $('.work__handle', li));
      ol.appendChild(li);
    });
  }
  function move(i, d) {
    const j = i + d;
    if (j < 0 || j >= data.works.length) return;
    [data.works[i], data.works[j]] = [data.works[j], data.works[i]];
    changed(true);
  }

  function openWork(w) {
    const form = $('#workForm');
    const others = data.works.filter((x) => x !== w).map((x) => x.video);
    form.innerHTML = `
      <div class="sheet__hero"><img src="${esc(media(w.poster))}" alt=""><div><h2>تعديل العمل</h2><a class="hint" href="../#w-${esc(w.id)}" target="_blank" rel="noopener">شوفه بالموقع ↗</a></div></div>
      <label class="field"><span>العنوان</span><input name="title" value="${esc(w.title)}"></label>
      <div class="field"><span>التصنيف</span><div class="chips" id="catChips">${data.categories.map((c) => `<button type="button" aria-pressed="${c === w.category}">${esc(c)}</button>`).join('')}</div></div>
      <label class="field"><span>سطر وصف قصير (بيطلع بالمشغّل)</span><textarea name="blurb" rows="3">${esc(w.blurb)}</textarea></label>
      <label class="switch"><span>★ يظهر بالشوريل فوق</span><input type="checkbox" name="featured" ${w.featured ? 'checked' : ''}><i></i></label>
      <label class="switch"><span>إخفاء من الموقع</span><input type="checkbox" name="hidden" ${w.hidden ? 'checked' : ''}><i></i></label>
      <label class="field"><span>فيديو «قبل» لقسم قبل وبعد (اختياري)</span>
        <select name="before"><option value="">— ما في —</option>${data.works.filter((x) => x !== w).map((x) => `<option value="${esc(x.video)}" ${x.video === w.before ? 'selected' : ''}>${esc(x.title)}</option>`).join('')}${w.before && !others.includes(w.before) ? `<option selected>${esc(w.before)}</option>` : ''}</select></label>
      <button class="btn btn--amber btn--big" value="done">تمام</button>`;
    const f = form.elements;
    f.title.addEventListener('input', () => { w.title = f.title.value; changed(); });
    f.blurb.addEventListener('input', () => { w.blurb = f.blurb.value; changed(); });
    f.featured.addEventListener('change', () => { w.featured = f.featured.checked; changed(); });
    f.hidden.addEventListener('change', () => { w.hidden = f.hidden.checked; changed(); });
    f.before.addEventListener('change', () => { w.before = f.before.value; changed(); });
    $$('#catChips button', form).forEach((b) => b.addEventListener('click', () => {
      w.category = b.textContent;
      $$('#catChips button', form).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      changed();
    }));
    const dlg = $('#workSheet');
    dlg.onclose = () => renderWorks();
    dlg.showModal();
  }

  /* ------------------------------------------------------- drag & drop */
  function dragify(li, handle) {
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const ol = li.parentElement;
      li.classList.add('is-dragging');
      const moveH = (ev) => {
        const y = ev.clientY;
        const after = $$('.work', ol).filter((n) => n !== li).find((n) => { const r = n.getBoundingClientRect(); return y < r.top + r.height / 2; });
        if (after) { if (li.nextElementSibling !== after) ol.insertBefore(li, after); }
        else if (ol.lastElementChild !== li) ol.appendChild(li);
        if (y < 90) scrollBy(0, -10); else if (y > innerHeight - 160) scrollBy(0, 10);
      };
      const up = () => {
        removeEventListener('pointermove', moveH); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
        li.classList.remove('is-dragging');
        const order = $$('.work', ol).map((n) => n._w);
        if (order.some((w, k) => w !== data.works[k])) { data.works = order; changed(true); } else renderWorks();
      };
      addEventListener('pointermove', moveH); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    });
  }

  /* --------------------------------------------------------- categories */
  function renderCats() {
    const ul = $('#cats');
    ul.innerHTML = '';
    data.categories.forEach((c, i) => {
      const li = document.createElement('li');
      li.className = 'cat';
      li.innerHTML = `<input value="${esc(c)}" aria-label="اسم التصنيف"><span class="n">${data.works.filter((w) => w.category === c).length}</span>
        <button class="ico" type="button" data-a="up" aria-label="لفوق" ${i === 0 ? 'disabled' : ''}>${ICON.up}</button>
        <button class="ico" type="button" data-a="del" aria-label="حذف">${ICON.trash}</button>`;
      const input = $('input', li);
      input.addEventListener('change', () => {
        const nv = input.value.trim();
        if (!nv || (nv !== c && data.categories.includes(nv))) { input.value = c; return; }
        data.categories[i] = nv;
        data.works.forEach((w) => { if (w.category === c) w.category = nv; });
        changed(true);
      });
      li.addEventListener('click', (e) => {
        const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
        if (a === 'up' && i > 0) [data.categories[i - 1], data.categories[i]] = [data.categories[i], data.categories[i - 1]];
        else if (a === 'del') {
          const n = data.works.filter((w) => w.category === c).length;
          if (n && !confirm(`في ${n} عمل بهالتصنيف، رح يصيروا بدون تصنيف. أكيد؟`)) return;
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
    toast('انضاف التصنيف');
  });

  /* ------------------------------------------------------------- themes */
  function renderThemes() {
    const box = $('#themes');
    box.innerHTML = '';
    const sample = data.works.filter((w) => !w.hidden && w.poster).slice(0, 2);
    THEMES.forEach((t) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'theme'; b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(data.site.theme === t.id));
      b.innerHTML = `
        <span class="theme__check">✓</span>
        <span class="theme__art" style="background:${t.bg};color:${t.ink}">
          <span class="theme__name-art" style="font-family:'${t.font}';font-weight:700">حسن</span>
          <span class="theme__bar" style="background:${t.accent}"></span>
          <span class="theme__posters">${sample.map((w) => `<img src="${esc(media(w.poster))}" alt="" style="filter:${t.poster};border-radius:${t.radius};${t.frame ? 'border:' + t.frame : ''}">`).join('')}</span>
        </span>
        <span class="theme__label"><b>${t.name}</b><span>${t.desc}</span></span>`;
      b.addEventListener('click', () => {
        data.site.theme = t.id;
        $$('.theme', box).forEach((x) => x.setAttribute('aria-checked', String(x === b)));
        changed();
        toast(`الستايل: ${t.name}`);
      });
      box.appendChild(b);
    });
    let full = $('#themeFull');
    if (!full) {
      full = document.createElement('a');
      full.id = 'themeFull'; full.className = 'theme__full'; full.target = '_blank'; full.rel = 'noopener';
      box.after(full);
    }
    full.href = `../?theme=${data.site.theme}`;
    full.textContent = 'افتح الستايل المختار بالموقع كامل ↗';
  }

  function renderSwitches() {
    const s = $('#showStyle'), a = $('#showAbout');
    s.checked = data.site.show_style !== false;
    a.checked = data.site.show_about !== false;
    s.onchange = () => { data.site.show_style = s.checked; changed(); scrollPreview('style'); };
    a.onchange = () => { data.site.show_about = a.checked; changed(); scrollPreview('about'); };
  }

  function renderStyle() {
    const ol = $('#styles');
    ol.innerHTML = '';
    if (!data.style.length) { ol.innerHTML = '<li class="hint">ما في لقطات. القسم مخفي.</li>'; return; }
    data.style.forEach((it, i) => {
      const li = document.createElement('li');
      li.className = 'sitem';
      li.innerHTML = `<img src="${esc(media(it.poster))}" alt="">
        <div class="sitem__f">
          <input value="${esc(it.title)}" aria-label="عنوان اللقطة">
          <textarea rows="2" aria-label="وصف اللقطة">${esc(it.text)}</textarea>
          <div class="sitem__tools">
            <button class="ico" type="button" data-a="up" aria-label="لفوق" ${i === 0 ? 'disabled' : ''}>${ICON.up}</button>
            <button class="ico" type="button" data-a="down" aria-label="لتحت" ${i === data.style.length - 1 ? 'disabled' : ''}>${ICON.down}</button>
            <button class="ico" type="button" data-a="del" aria-label="حذف اللقطة">${ICON.trash}</button>
          </div>
        </div>`;
      $('input', li).addEventListener('input', (e) => { it.title = e.target.value; changed(); });
      $('textarea', li).addEventListener('input', (e) => { it.text = e.target.value; changed(); });
      li.addEventListener('click', (e) => {
        const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
        if (a === 'up') [data.style[i - 1], data.style[i]] = [data.style[i], data.style[i - 1]];
        else if (a === 'down') [data.style[i + 1], data.style[i]] = [data.style[i], data.style[i + 1]];
        else if (a === 'del') { if (!confirm('تحذف هاللقطة من قسم أسلوبي؟')) return; data.style.splice(i, 1); }
        changed(true);
        scrollPreview('style');
      });
      ol.appendChild(li);
    });
  }

  /* --------------------------------------------------------------- info */
  function renderInfo() {
    const cbox = $('#contactFields');
    cbox.innerHTML = '';
    CONTACTS.forEach(([key, label, ph, type, mode]) => {
      const row = document.createElement('label');
      row.className = 'contact' + ((data.site[key] || '').trim() ? ' is-filled' : '');
      row.innerHTML = `<span class="contact__icon">${ICONS[key]}</span>
        <span class="contact__main"><b>${label}</b><input class="ltr" type="${type}" inputmode="${mode}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(ph)}" value="${esc(data.site[key] || '')}" dir="ltr"></span>`;
      const input = $('input', row);
      input.addEventListener('input', () => {
        data.site[key] = input.value;
        row.classList.toggle('is-filled', !!input.value.trim());
        changed();
      });
      input.addEventListener('focus', () => scrollPreview('contact'));
      cbox.appendChild(row);
    });
    const tbox = $('#textFields');
    tbox.innerHTML = '';
    TEXTS.forEach(([key, label, area]) => {
      const l = document.createElement('label');
      l.className = 'field';
      l.innerHTML = `<span>${label}</span>`;
      const input = document.createElement(area ? 'textarea' : 'input');
      if (area) input.rows = 6;
      input.value = data.site[key] || '';
      input.addEventListener('input', () => { data.site[key] = input.value; changed(); });
      l.appendChild(input);
      tbox.appendChild(l);
    });
  }

  /* ------------------------------------------------------------ publish */
  function patch() {
    return {
      v: 1, site: data.site, categories: data.categories, style: data.style,
      works: data.works.map((w) => [w.id, w.title, w.category, w.blurb, w.featured ? 1 : 0, w.hidden ? 1 : 0, w.before || '']),
    };
  }
  function b64url(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  async function payload() {
    const raw = new TextEncoder().encode(JSON.stringify(patch()));
    if ('CompressionStream' in window) {
      try {
        const stream = new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'));
        const buf = new Uint8Array(await new Response(stream).arrayBuffer());
        return 'HSTUDIO1.' + b64url(buf);
      } catch (_) { /* fall through */ }
    }
    return 'HSTUDIO1J.' + b64url(raw);
  }
  $('#btnPublish').addEventListener('click', async () => {
    const go = $('#pubGo');
    go.removeAttribute('href');
    $('#manual').value = json();
    $('#pubSheet').showModal();
    const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    const url = `${REPO}/new/main?filename=${encodeURIComponent(`incoming/edit-${stamp}.studio`)}&value=${encodeURIComponent(await payload())}`;
    go.href = url;
    if (url.length > 7500) { go.textContent = 'التعديل كبير، استعمل النسخ واللصق ↓'; go.removeAttribute('href'); $('.manual').open = true; }
    else go.textContent = 'افتح GitHub ↗';
  });
  $('#pubGo').addEventListener('click', () => { store.set(json()); setTimeout(() => $('#pubSheet').close(), 400); });
  $('#btnCopy').addEventListener('click', async () => {
    const text = json();
    try { await navigator.clipboard.writeText(text); toast('انسخ ✓'); }
    catch (_) { const ta = $('#manual'); ta.focus(); ta.select(); try { document.execCommand('copy'); toast('انسخ ✓'); } catch (__) { toast('انسخه يدوياً من المربع'); } }
  });
  $('#btnUndo').addEventListener('click', () => {
    if (!confirm('ترجّع كل شي متل ما هو على الموقع وتمسح تعديلاتك؟')) return;
    store.clear();
    data = JSON.parse(published);
    normalize();
    changed(true);
    toast('رجع كل شي');
  });

  /* --------------------------------------------------------------- tabs */
  function setTab(tab) {
    $('#app').dataset.tab = tab;
    $$('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    if (tab === 'preview') pushPreview();
    scrollTo(0, 0);
    try { sessionStorage.setItem('studio-tab', tab); } catch (_) {}
  }
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
  let first = 'works';
  try { first = sessionStorage.getItem('studio-tab') || 'works'; } catch (_) {}
  setTab(first);

  $$('.seg button').forEach((b) => b.addEventListener('click', () => {
    $$('.seg button').forEach((t) => t.setAttribute('aria-pressed', String(t === b)));
    $('#stage').classList.toggle('desktop', b.dataset.size === 'desktop');
  }));

  init();
})();
