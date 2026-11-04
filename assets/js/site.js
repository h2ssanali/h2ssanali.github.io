/* Hassan — portfolio runtime (vanilla, no build step).
   Everything shown on the page comes from content.json. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const params = new URLSearchParams(location.search);
  const EMBED = params.has('embed');
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const reduce = () => mqReduce.matches;
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  const FPS = 24;

  const state = { content: null, works: [], filter: 'all', list: [] };

  if (window.CSS && CSS.registerProperty) root.classList.add('burn-ok');
  if (EMBED) root.classList.add('intro-done', 'embed');
  else setTimeout(() => root.classList.add('intro-done'), 1600);

  /* ---------------------------------------------------------------- utils */
  const pad = (n, l = 2) => String(Math.floor(n)).padStart(l, '0');
  function tc(sec, frames = true) {
    sec = Math.max(0, sec || 0);
    const h = sec / 3600, m = (sec / 60) % 60, s = sec % 60;
    const base = `${pad(h)}:${pad(m)}:${pad(s)}`;
    return frames ? `${base}:${pad((sec % 1) * FPS)}` : base;
  }
  const short = (sec) => { sec = Math.round(sec || 0); return `${pad(sec / 60)}:${pad(sec % 60)}`; };
  const src = (p) => (!p ? '' : /^(https?:)?\/\//.test(p) || p.startsWith('/') ? p : p);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function el(tag, attrs = {}, html = '') {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === false || v == null) continue;
      if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v; else e.setAttribute(k, v === true ? '' : v);
    }
    if (html) e.innerHTML = html;
    return e;
  }

  /* -------------------------------------------------------------- content */
  async function load() {
    try {
      const res = await fetch('content.json', { cache: 'no-cache' });
      apply(await res.json());
    } catch (e) {
      console.warn('content.json could not be loaded', e);
      apply({ site: {}, categories: [], works: [] });
    }
  }

  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin) return;
    const d = e.data || {};
    if (d.type === 'hassan:content' && d.content) apply(d.content, true);
    if (d.type === 'hassan:scroll' && d.to) document.getElementById(d.to)?.scrollIntoView({ behavior: 'smooth' });
  });

  function apply(content, live = false) {
    state.content = content;
    const site = content.site || {};
    state.works = (content.works || []).filter((w) => w && !w.hidden && w.video);
    bindSite(site);
    renderTracks();
    renderGrid(live);
    showreel.setup();
    ba.setup();
    contact(site);
    requestAnimationFrame(timeline.build);
    if (!live) openFromHash();
  }

  function bindSite(site) {
    $$('[data-bind]').forEach((n) => {
      const v = site[n.dataset.bind];
      if (v) n.textContent = v;
    });
    if (site.name && !EMBED) document.title = `${site.name} — ${site.role || 'مونتير ريلز سينمائية'}`;
    $('#year').textContent = new Date().getFullYear();
  }

  /* --------------------------------------------------------------- tracks */
  function categoriesInUse() {
    const listed = state.content.categories || [];
    const used = new Set(state.works.map((w) => w.category).filter(Boolean));
    const out = listed.filter((c) => used.has(c));
    used.forEach((c) => { if (!out.includes(c)) out.push(c); });
    return out;
  }

  function renderTracks() {
    const box = $('#tracks');
    box.innerHTML = '';
    const cats = categoriesInUse();
    if (state.filter !== 'all' && !cats.includes(state.filter)) state.filter = 'all';
    const items = [['all', 'الكل', state.works.length], ...cats.map((c) => [c, c, state.works.filter((w) => w.category === c).length])];
    box.hidden = state.works.length === 0 || cats.length < 2;
    items.forEach(([key, label, n], i) => {
      const b = el('button', { class: 'track', role: 'tab', type: 'button', 'aria-selected': String(state.filter === key) },
        `<span class="mono">V${i + 1}</span>${esc(label)}<b>${n}</b>`);
      b.addEventListener('click', () => {
        if (state.filter === key) return;
        state.filter = key;
        $$('.track', box).forEach((t) => t.setAttribute('aria-selected', String(t === b)));
        renderGrid();
        requestAnimationFrame(timeline.build);
      });
      box.appendChild(b);
    });
  }

  /* ----------------------------------------------------------------- grid */
  const playIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  let cardObserver;

  function renderGrid() {
    const grid = $('#grid');
    grid.innerHTML = '';
    state.list = state.filter === 'all' ? state.works : state.works.filter((w) => w.category === state.filter);
    if (!state.list.length) {
      grid.appendChild(el('div', { class: 'empty' },
        `<p class="mono label">MEDIA OFFLINE</p><p class="display">الأعمال في طريقها إلى غرفة المونتاج</p><p>قريباً هنا: ريلز التاريخ كاملة.</p>`));
      return;
    }
    if (cardObserver) cardObserver.disconnect();
    if (!canHover) cardObserver = new IntersectionObserver(onCardVisible, { threshold: [0, .7] });

    state.list.forEach((w, i) => {
      const card = el('button', { class: 'card' + (w.preview ? ' has-preview' : ''), type: 'button', style: `--i:${Math.min(i, 12)}`, 'aria-label': `شاهد: ${w.title || ''}` },
        `${w.poster ? `<img src="${esc(src(w.poster))}" alt="" loading="${i < 4 ? 'eager' : 'lazy'}" decoding="async" width="360" height="640">` : ''}
         <span class="card__top mono"><span>C${pad(i + 1)}</span>${w.featured ? '<span class="card__star" aria-label="مميّز">●</span>' : ''}</span>
         <span class="card__play">${playIcon}</span>
         <span class="card__cap">
           <span class="card__title">${esc(w.title || 'بدون عنوان')}</span>
           <span class="card__meta"><span>${esc(w.category || '')}</span>${w.duration ? `<span class="mono">${short(w.duration)}</span>` : ''}</span>
         </span>`);
      card.addEventListener('click', () => player.open(i));
      if (w.preview && !saveData) {
        if (canHover) {
          card.addEventListener('pointerenter', () => preview(card, w, true));
          card.addEventListener('pointerleave', () => preview(card, w, false));
          card.addEventListener('focus', () => preview(card, w, true));
          card.addEventListener('blur', () => preview(card, w, false));
        } else {
          card._work = w;
          cardObserver.observe(card);
        }
      }
      grid.appendChild(card);
    });
  }

  const playingCards = new Set();
  function preview(card, w, on) {
    let v = card._v;
    if (on) {
      if (reduce()) return;
      if (!v) {
        v = card._v = el('video', { muted: true, playsinline: true, loop: true, preload: 'auto', 'aria-hidden': 'true' });
        v.muted = true;
        v.src = src(w.preview);
        v.addEventListener('playing', () => card.classList.add('is-playing'));
        card.insertBefore(v, card.querySelector('.card__top'));
      }
      v.play().catch(() => {});
      playingCards.add(card);
    } else if (v) {
      v.pause();
      card.classList.remove('is-playing');
      playingCards.delete(card);
    }
  }
  function onCardVisible(entries) {
    entries.forEach((en) => {
      const on = en.intersectionRatio >= .7;
      if (on && playingCards.size >= 2) {
        const first = playingCards.values().next().value;
        preview(first, first._work, false);
      }
      preview(en.target, en.target._work, on);
    });
  }

  /* ------------------------------------------------------------- showreel */
  const showreel = (() => {
    const screen = $('#reelScreen');
    const titleEl = $('#reelTitle');
    const tcEl = $('#reelTc');
    const leader = $('#leader');
    let reel = [], idx = 0, layers = [], active = 0, timer, running = false, visible = true, started = 0, raf, countTimer;

    function pick() {
      const f = state.works.filter((w) => w.featured);
      return (f.length ? f : state.works).slice(0, 8);
    }

    function setup() {
      reel = pick();
      clearTimeout(timer); clearInterval(countTimer); cancelAnimationFrame(raf);
      $$('video, img, .flash', screen).forEach((n) => n.remove());
      layers = [];
      idx = 0;
      if (!reel.length) { startLeader(); titleEl.textContent = 'SHOWREEL · قريباً'; return; }
      leader.hidden = true;
      for (let k = 0; k < 2; k++) {
        const v = el('video', { muted: true, playsinline: true, preload: 'none', 'aria-hidden': 'true' });
        v.muted = true; v.style.opacity = 0;
        screen.appendChild(v);
        layers.push(v);
      }
      const poster = el('img', { alt: '', decoding: 'async', src: src(reel[0].poster || '') });
      poster.className = 'reel-poster';
      screen.prepend(poster);
      screen.appendChild(el('div', { class: 'flash' }));
      titleEl.textContent = reel[0].title || '';
      screen.onclick = () => player.openWork(reel[idx]);
      started = performance.now();
      tick();
      if (reduce() || saveData) { stillCycle(poster); return; }
      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? resume() : pause(); });
      io.observe(screen);
      setTimeout(() => play(0, true), EMBED ? 0 : 1500);
    }

    function startLeader() {
      leader.hidden = false;
      let n = 3;
      const num = $('.leader__num', leader);
      num.textContent = n;
      if (reduce()) return;
      countTimer = setInterval(() => { n = n === 1 ? 3 : n - 1; num.textContent = n; }, 1000);
    }

    function stillCycle(img) {
      timer = setTimeout(function next() {
        idx = (idx + 1) % reel.length;
        img.src = src(reel[idx].poster || '');
        titleEl.textContent = reel[idx].title || '';
        timer = setTimeout(next, 4000);
      }, 4000);
    }

    function play(i, first = false) {
      idx = i % reel.length;
      const w = reel[idx];
      const v = layers[first ? 0 : 1 - active];
      const usePreview = !!w.preview;
      v.src = src(usePreview ? w.preview : w.video);
      v.loop = false;
      const go = () => {
        v.removeEventListener('canplay', go);
        if (!usePreview) { try { v.currentTime = Math.min(4, (w.duration || 8) / 3); } catch (_) {} }
        v.play().then(() => {
          const old = layers[active];
          if (!first) {
            const f = $('.flash', screen);
            f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
          }
          v.style.opacity = 1;
          if (old !== v) { old.style.opacity = 0; setTimeout(() => old.pause(), 500); }
          active = layers.indexOf(v);
          titleEl.textContent = w.title || '';
          $('.reel-poster', screen)?.remove();
          running = true;
          schedule(v, usePreview);
        }).catch(() => { timer = setTimeout(() => play(idx + 1), 2500); });
      };
      v.addEventListener('canplay', go);
      v.load();
    }

    function schedule(v, usePreview) {
      clearTimeout(timer);
      const len = usePreview ? (v.duration || 3.5) : 4;
      timer = setTimeout(() => { if (visible) play(idx + 1); }, Math.max(2.2, len - .12) * 1000);
    }
    function pause() { clearTimeout(timer); layers.forEach((v) => v.pause()); }
    function resume() {
      if (!running || !layers.length) return;
      const v = layers[active];
      v.play().catch(() => {});
      clearTimeout(timer);
      timer = setTimeout(() => play(idx + 1), 3000);
    }
    function tick() {
      tcEl.textContent = tc((performance.now() - started) / 1000);
      raf = requestAnimationFrame(tick);
    }
    return { setup, pause };
  })();

  /* ------------------------------------------------------------- player */
  const player = (() => {
    const box = $('#player'), v = $('#pv'), stage = $('#playerStage');
    const fill = $('#pFill'), head = $('#pHead'), buf = $('#pBuf'), scrub = $('#pScrub');
    let list = [], i = 0, lastFocus = null, wantSound = true;

    function open(index, from = state.list) {
      list = from.slice();
      if (!list.length) return;
      lastFocus = document.activeElement;
      box.hidden = false;
      box.classList.add('is-open');
      root.style.overflow = 'hidden';
      showreel.pause();
      show(index, 0);
      $('#pClose').focus({ preventScroll: true });
    }
    function openWork(w) {
      const k = state.list.indexOf(w);
      if (k >= 0) open(k); else open(0, [w, ...state.works.filter((x) => x !== w)]);
    }
    function close() {
      v.pause();
      v.removeAttribute('src'); v.load();
      box.hidden = true;
      box.classList.remove('is-open', 'is-playing');
      root.style.overflow = '';
      if (location.hash.startsWith('#w-')) history.replaceState(null, '', location.pathname + location.search);
      lastFocus?.focus?.({ preventScroll: true });
      showreel.setup();
    }
    function show(k, dir) {
      i = (k + list.length) % list.length;
      const w = list[i];
      stage.classList.remove('swap-next', 'swap-prev');
      if (dir) { void stage.offsetWidth; stage.classList.add(dir > 0 ? 'swap-next' : 'swap-prev'); }
      v.poster = src(w.poster || '');
      v.src = src(w.video);
      $('#playerBg').style.backgroundImage = w.poster ? `url("${src(w.poster)}")` : 'none';
      $('#pTitle').textContent = w.title || '';
      $('#pCat').textContent = w.category || '';
      $('#pBlurb').textContent = w.blurb || '';
      $('#pBlurb').hidden = !w.blurb;
      $('#pIndex').textContent = `${pad(i + 1)}/${pad(list.length)}`;
      if (!EMBED && w.id) history.replaceState(null, '', `#w-${w.id}`);
      update();
      v.muted = !wantSound;
      v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
      const nxt = list[(i + 1) % list.length];
      if (nxt?.poster) { const im = new Image(); im.src = src(nxt.poster); }
    }
    const next = () => show(i + 1, 1);
    const prev = () => show(i - 1, -1);
    function toggle() { v.paused ? v.play().catch(() => {}) : v.pause(); }
    function mute() { v.muted = !v.muted; wantSound = !v.muted; box.classList.toggle('is-muted', v.muted); }

    function update() {
      const d = v.duration || 0, t = v.currentTime || 0, p = d ? (t / d) * 100 : 0;
      fill.style.width = p + '%'; head.style.left = p + '%';
      scrub.setAttribute('aria-valuenow', Math.round(p));
      $('#pTc').textContent = short(t) + ' / ' + short(d);
      if (v.buffered.length && d) buf.style.width = (v.buffered.end(v.buffered.length - 1) / d) * 100 + '%';
      box.classList.toggle('is-muted', v.muted);
    }
    ['timeupdate', 'loadedmetadata', 'progress', 'volumechange'].forEach((e) => v.addEventListener(e, update));
    v.addEventListener('play', () => box.classList.add('is-playing'));
    v.addEventListener('pause', () => box.classList.remove('is-playing'));
    v.addEventListener('ended', () => { if (list.length > 1) next(); });

    // scrubbing
    function seekTo(x) {
      const r = scrub.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (x - r.left) / r.width));
      if (v.duration) v.currentTime = p * v.duration;
      update();
    }
    scrub.addEventListener('pointerdown', (e) => {
      scrub.setPointerCapture(e.pointerId); seekTo(e.clientX);
      const mv = (ev) => seekTo(ev.clientX);
      const up = () => { scrub.removeEventListener('pointermove', mv); scrub.removeEventListener('pointerup', up); };
      scrub.addEventListener('pointermove', mv); scrub.addEventListener('pointerup', up);
    });
    scrub.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { v.currentTime += 5; e.preventDefault(); e.stopPropagation(); }
      if (e.key === 'ArrowLeft') { v.currentTime -= 5; e.preventDefault(); e.stopPropagation(); }
    });

    // buttons
    $('#pClose').addEventListener('click', close);
    $('#pNext').addEventListener('click', next);
    $('#pPrev').addEventListener('click', prev);
    $('#pPlay').addEventListener('click', toggle);
    $('#pBig').addEventListener('click', () => { wantSound = true; v.muted = false; v.play().catch(() => {}); });
    $('#pMute').addEventListener('click', mute);

    // keyboard (RTL: left = forward)
    document.addEventListener('keydown', (e) => {
      if (box.hidden) return;
      const k = e.key;
      if (k === 'Escape') close();
      else if (k === 'ArrowLeft' || k === 'ArrowDown' || k === 'PageDown') { e.preventDefault(); next(); }
      else if (k === 'ArrowRight' || k === 'ArrowUp' || k === 'PageUp') { e.preventDefault(); prev(); }
      else if (k === ' ' || k === 'k') { if (e.target.tagName !== 'BUTTON' || k === 'k') { e.preventDefault(); toggle(); } }
      else if (k === 'm' || k === 'M') mute();
      else if (k === 'Tab') { // simple focus trap
        const f = $$('button, [tabindex="0"]', box).filter((n) => n.offsetParent !== null);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });

    // swipe / tap on the stage
    let sx = 0, sy = 0, st = 0, tracking = false;
    stage.addEventListener('pointerdown', (e) => { tracking = true; sx = e.clientX; sy = e.clientY; st = Date.now(); });
    stage.addEventListener('pointerup', (e) => {
      if (!tracking) return; tracking = false;
      if (e.target.closest('button')) return;
      const dx = e.clientX - sx, dy = e.clientY - sy, adx = Math.abs(dx), ady = Math.abs(dy);
      if (Math.max(adx, ady) < 12 && Date.now() - st < 400) { toggle(); return; }
      if (ady > 60 && ady > adx) dy < 0 ? next() : prev();
      else if (adx > 60) dx > 0 ? next() : prev();   // RTL: swipe toward the right brings the next work
    });
    box.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (box._wheel) return;
      if (Math.abs(e.deltaY) > 30) { box._wheel = true; e.deltaY > 0 ? next() : prev(); setTimeout(() => (box._wheel = false), 700); }
    }, { passive: false });

    return { open, openWork, close };
  })();

  function openFromHash() {
    const m = location.hash.match(/^#w-(.+)$/);
    if (!m) return;
    const k = state.list.findIndex((w) => w.id === decodeURIComponent(m[1]));
    if (k >= 0) setTimeout(() => player.open(k), EMBED ? 0 : 1300);
  }

  /* -------------------------------------------------------- before/after */
  const ba = (() => {
    const sec = $('#before-after'), stage = $('#baStage'), range = $('#baRange');
    let pairs = [], cur = 0, io;
    function setup() {
      pairs = state.works.filter((w) => w.before);
      sec.hidden = !pairs.length;
      if (!pairs.length) return;
      const picker = $('#baPicker');
      picker.innerHTML = '';
      if (pairs.length > 1) pairs.forEach((w, k) => {
        const b = el('button', { class: 'track', type: 'button', 'aria-selected': String(k === cur) }, `<span class="mono">B${k + 1}</span>${esc(w.title)}`);
        b.addEventListener('click', () => { cur = k; $$('.track', picker).forEach((t) => t.setAttribute('aria-selected', String(t === b))); mount(); });
        picker.appendChild(b);
      });
      cur = Math.min(cur, pairs.length - 1);
      mount();
    }
    function mount() {
      const w = pairs[cur];
      const mk = (s, poster) => {
        const v = el('video', { muted: true, playsinline: true, loop: true, preload: 'none', poster: poster ? src(poster) : false });
        v.muted = true; v.src = src(s); return v;
      };
      const after = mk(w.video, w.poster), before = mk(w.before, w.before_poster || w.poster);
      $('#baAfter').replaceChildren(after);
      $('#baBefore').replaceChildren(before);
      after.addEventListener('timeupdate', () => {
        if (before.duration && Math.abs(before.currentTime - after.currentTime) > .3 && after.currentTime < before.duration) before.currentTime = after.currentTime;
      });
      io?.disconnect();
      io = new IntersectionObserver(([e]) => {
        [after, before].forEach((v) => (e.isIntersecting && !reduce() ? v.play().catch(() => {}) : v.pause()));
      }, { threshold: .35 });
      io.observe(stage);
    }
    range.addEventListener('input', () => stage.style.setProperty('--x', range.value + '%'));
    return { setup };
  })();

  /* ------------------------------------------------------------- contact */
  const icons = {
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
    email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3z"/></svg>',
  };
  function contact(site) {
    const box = $('#contactLinks');
    box.innerHTML = '';
    const ig = (site.instagram || '').trim();
    const mail = (site.email || '').trim();
    const wa = (site.whatsapp || '').replace(/[^\d]/g, '');
    const add = (href, label, icon, primary) => box.appendChild(el('a', { class: 'btn ' + (primary ? 'btn--amber' : 'btn--ghost'), href, target: href.startsWith('http') ? '_blank' : false, rel: 'noopener' }, icon + `<span>${label}</span>`));
    if (ig) add(/^https?:/.test(ig) ? ig : `https://instagram.com/${ig.replace(/^@/, '')}`, 'إنستغرام', icons.instagram, !box.children.length);
    if (wa) add(`https://wa.me/${wa}`, 'واتساب', icons.whatsapp, !box.children.length);
    if (mail) add(`mailto:${mail}`, 'البريد', icons.email, !box.children.length);
  }

  /* ------------------------------------------------------------ timeline */
  const timeline = (() => {
    const clipsBox = $('#tlClips'), head = $('#playhead'), tcEl = $('#tlTc'), finalTc = $('#finalTc');
    let segs = [], docH = 1, ticking = false;
    const REEL = 59 + 23 / FPS; // the page is a one-minute reel

    function build() {
      const secs = $$('main > section[data-clip]').filter((s) => !s.hidden);
      docH = document.documentElement.scrollHeight;
      clipsBox.innerHTML = '';
      segs = secs.map((s) => {
        const top = s.offsetTop, h = s.offsetHeight;
        const a = el('a', { class: 'tl__clip', href: `#${s.id}`, style: `inset-inline-start:${(top / docH) * 100}%;width:calc(${(h / docH) * 100}% - 3px)` }, `<span>${esc(s.dataset.clip)}</span>`);
        clipsBox.appendChild(a);
        return { a, top, h };
      });
      finalTc.textContent = tc(REEL);
      update();
    }
    function update() {
      ticking = false;
      const y = scrollY, vh = innerHeight;
      const prog = Math.min(1, Math.max(0, y / Math.max(1, docH - vh)));
      const pos = (y + vh * prog) / docH;
      head.style.insetInlineStart = (pos * 100) + '%';
      tcEl.textContent = tc(pos * REEL);
      const at = pos * docH;
      segs.forEach((s) => s.a.classList.toggle('is-active', at >= s.top && at < s.top + s.h + 1));
    }
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    let rt;
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(build, 150); });
    if ('ResizeObserver' in window) new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(build, 150); }).observe(document.body);
    return { build };
  })();

  /* -------------------------------------------------------------- reveal */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    $$('.section-head, .chip, .about__grid, .final__frame').forEach((n, k) => {
      n.classList.add('reveal');
      if (n.classList.contains('chip')) n.style.transitionDelay = (k % 5) * 70 + 'ms';
      io.observe(n);
    });
  }

  load();
})();
