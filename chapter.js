(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const body = document.body;
  const isCourse = body.classList.contains('course-page');

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function setText(el, text) {
    if (el) el.textContent = text;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function readProgressMap() {
    const value = loadJSON('zynq_progress_v1', {});
    return value && typeof value === 'object' ? value : {};
  }

  function writeProgressMap(map) {
    saveJSON('zynq_progress_v1', map);
  }

  function legacyProgress(key, total) {
    const saved = loadJSON(key, []);
    if (!Array.isArray(saved)) return 0;
    const count = saved.filter(Boolean).length;
    return total > 0 ? Math.round((count / total) * 100) : 0;
  }

  const progressEl = $('.scroll-progress');

  function updateScrollProgress() {
    if (!progressEl) return;
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const current = window.scrollY || doc.scrollTop || 0;
    const pct = max > 0 ? clamp((current / max) * 100, 0, 100) : 0;
    progressEl.style.width = pct.toFixed(2) + '%';
  }

  window.addEventListener('scroll', updateScrollProgress, { passive: true });
  window.addEventListener('resize', updateScrollProgress);
  updateScrollProgress();

  const sidebar = $('#sidebar');
  const overlay = $('#overlay');
  const menuBtn = $('#menuBtn');
  const navLinks = $$('.nav a[href^="#"]');
  const navSections = navLinks
    .map((link) => document.getElementById(link.getAttribute('href').slice(1)))
    .filter(Boolean);

  if ('IntersectionObserver' in window && navSections.length) {
    const navObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          navLinks.forEach((link) => {
            const active = link.getAttribute('href') === '#' + entry.target.id;
            link.classList.toggle('active', active);
            if (active) {
              link.setAttribute('aria-current', 'location');
            } else {
              link.removeAttribute('aria-current');
            }
          });
        });
      },
      { rootMargin: '-20% 0px -68% 0px', threshold: 0 }
    );
    navSections.forEach((section) => navObserver.observe(section));
  }

  function setMenu(open) {
    if (!sidebar || !menuBtn) return;
    sidebar.classList.toggle('open', open);
    if (overlay) overlay.classList.toggle('show', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  }

  if (menuBtn) {
    menuBtn.addEventListener('click', () => setMenu(!sidebar.classList.contains('open')));
  }
  if (overlay) overlay.addEventListener('click', () => setMenu(false));
  const navRoot = document.querySelector('.nav');
  if (navRoot) navRoot.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMenu(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMenu(false);
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 1024) setMenu(false);
  });

  const revealEls = $$('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.06, rootMargin: '0px 0px -3% 0px' }
    );
    revealEls.forEach((el) => revealObserver.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('in'));
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (err) {
        ok = false;
      }
      area.remove();
      return ok;
    }
  }

  $$('.copy-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const block = button.closest('.code-block');
      const code = block ? $('pre', block) : null;
      if (!code) return;
      const ok = await copyText(code.textContent);
      const old = button.textContent;
      button.textContent = ok ? '已复制' : '复制失败';
      window.setTimeout(() => {
        button.textContent = old;
      }, 1400);
    });
  });

  if (isCourse) {
    const cards = $$('.course-card[data-chapter]');
    const progressMap = readProgressMap();
    const totalText = $('#courseTotalText');
    const totalBar = $('#courseTotalBar');
    const last = loadJSON('zynq_last_chapter_v1', null);
    let sum = 0;

    cards.forEach((card) => {
      const id = card.dataset.chapter;
      const total = Number(card.dataset.total || 0);
      const legacyKey = card.dataset.progressKey;
      const pct = legacyKey ? legacyProgress(legacyKey, total) : clamp(Number(progressMap[id] || 0), 0, 100);
      const fill = $('.course-progress i', card);
      const label = $('.course-progress b', card);
      const state = $('.course-state', card);
      sum += pct;

      if (fill) fill.style.setProperty('--p', pct + '%');
      setText(label, pct + '%');
      card.classList.toggle('is-done', pct === 100);
      if (pct === 100) {
        setText(state, '已通关');
        state.classList.remove('doing');
        state.classList.add('done');
      } else if (pct > 0) {
        setText(state, '进行中');
        state.classList.add('doing');
        state.classList.remove('done');
      } else {
        setText(state, '未开始');
        state.classList.remove('doing', 'done');
      }

      if (last && last.id === id) {
        card.classList.add('is-current');
      }
    });

    const overall = cards.length ? Math.round(sum / cards.length) : 0;
    setText(totalText, overall + '%');
    if (totalBar) totalBar.style.width = overall + '%';

    const resumeLink = $('#resumeLink');
    const resumeTitle = $('#resumeTitle');
    const resumeProgress = $('#resumeProgress');
    const resumeProgressBar = $('#resumeProgressBar');
    let resumeCard = null;

    if (last && last.file) {
      resumeCard = cards.find((card) => card.getAttribute('href') === last.file) || null;
    }
    if (!resumeCard) {
      resumeCard = cards.find((card) => card.dataset.chapter === 'ch03') || cards[0] || null;
    }

    if (resumeCard) {
      const id = resumeCard.dataset.chapter;
      const total = Number(resumeCard.dataset.total || 0);
      const legacyKey = resumeCard.dataset.progressKey;
      const pct = legacyKey ? legacyProgress(legacyKey, total) : clamp(Number(progressMap[id] || 0), 0, 100);
      if (resumeLink) resumeLink.href = resumeCard.getAttribute('href');
      if (resumeTitle) resumeTitle.textContent = last && last.id === id ? last.title : resumeCard.dataset.title || resumeCard.querySelector('h3').textContent;
      if (resumeProgress) resumeProgress.textContent = pct + '%';
      if (resumeProgressBar) resumeProgressBar.style.setProperty('--resume-progress', pct + '%');
      resumeCard.classList.add('is-current');
    }

    const search = $('#courseSearch');
    const groups = $$('.course-part');
    const empty = $('#courseEmpty');

    if (search) {
      search.addEventListener('input', () => {
        const query = search.value.trim().toLowerCase();
        let visible = 0;
        cards.forEach((card) => {
          const text = (card.dataset.search || '').toLowerCase();
          const show = !query || text.includes(query);
          card.hidden = !show;
          if (show) visible += 1;
        });
        groups.forEach((group) => {
          const hasVisible = $$('.course-card:not([hidden])', group).length > 0;
          group.hidden = !hasVisible;
        });
        if (empty) empty.classList.toggle('show', visible === 0);
      });
    }

    window.__zynqChapterReady = true;
    return;
  }

  const chapterId = body.dataset.chapterId;
  if (!chapterId) {
    window.__zynqChapterReady = true;
    return;
  }

  const goalBoxes = $$('#checklist input[data-goal]');
  const labBoxes = $$('input[data-lab]');
  const goalKey = 'zynq_' + chapterId + '_goals_v1';
  const labKey = 'zynq_' + chapterId + '_labs_v1';
  const savedGoals = loadJSON(goalKey, []);
  const savedLabs = loadJSON(labKey, []);
  const checkBar = $('#checkBar');
  const checkText = $('#checkText');
  const sideProgressText = $('#sideProgressText');
  const sideProgressBar = $('#sideProgressBar');

  goalBoxes.forEach((box, index) => {
    box.checked = Boolean(savedGoals[index]);
    const label = box.closest('.check-item');
    if (label) label.classList.toggle('checked', box.checked);
  });

  labBoxes.forEach((box, index) => {
    box.checked = Boolean(savedLabs[index]);
    const lab = box.closest('.lab');
    if (lab) lab.classList.toggle('lab-completed', box.checked);
    const state = lab ? $('.lab-state', lab) : null;
    setText(state, box.checked ? '实验已完成' : '待完成');
  });

  function updateChapterProgress(save) {
    const goalCount = goalBoxes.filter((box) => box.checked).length;
    const labCount = labBoxes.filter((box) => box.checked).length;
    const total = goalBoxes.length + labBoxes.length;
    const done = goalCount + labCount;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    goalBoxes.forEach((box) => {
      const label = box.closest('.check-item');
      if (label) label.classList.toggle('checked', box.checked);
    });

    labBoxes.forEach((box) => {
      const lab = box.closest('.lab');
      if (!lab) return;
      lab.classList.toggle('lab-completed', box.checked);
      const state = $('.lab-state', lab);
      setText(state, box.checked ? '实验已完成' : '待完成');
    });

    if (checkBar) checkBar.style.width = pct + '%';
    setText(checkText, done + ' / ' + total + (pct === 100 ? ' · 已通关' : ''));
    setText(sideProgressText, pct + '%');
    if (sideProgressBar) sideProgressBar.style.width = pct + '%';

    if (save) {
      saveJSON(goalKey, goalBoxes.map((box) => box.checked));
      saveJSON(labKey, labBoxes.map((box) => box.checked));
      const map = readProgressMap();
      map[chapterId] = pct;
      writeProgressMap(map);
    }
  }

  goalBoxes.forEach((box) => box.addEventListener('change', () => updateChapterProgress(true)));
  labBoxes.forEach((box) => box.addEventListener('change', () => updateChapterProgress(true)));
  updateChapterProgress(false);

  const chapterLabel = body.dataset.chapterLabel || document.title.split('|')[0].trim();
  saveJSON('zynq_last_chapter_v1', {
    id: chapterId,
    file: body.dataset.chapterFile || location.pathname.split('/').pop(),
    title: chapterLabel
  });

  const notes = $('#notes');
  if (notes) {
    const noteStatus = $('#noteStatus');
    const noteKey = 'zynq_' + chapterId + '_notes_v1';
    let savedNote = '';
    try {
      savedNote = localStorage.getItem(noteKey) || '';
    } catch (error) {
      savedNote = '';
    }
    if (savedNote) {
      notes.value = savedNote;
      if (noteStatus) noteStatus.textContent = '已恢复上次保存的笔记';
    }

    let noteTimer = null;

    function saveNote() {
      try {
        localStorage.setItem(noteKey, notes.value);
        if (noteStatus) {
          const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
          noteStatus.textContent = '已自动保存 · ' + time;
        }
      } catch (error) {
        if (noteStatus) noteStatus.textContent = '当前浏览器不允许本地保存';
      }
    }

    notes.addEventListener('input', () => {
      window.clearTimeout(noteTimer);
      noteTimer = window.setTimeout(saveNote, 400);
    });
    notes.addEventListener('blur', saveNote);
    window.addEventListener('beforeunload', saveNote);

    $$('.quiz-note-btn').forEach((button, index) => {
      button.addEventListener('click', () => {
        const token = '【' + chapterLabel + ' · 思考题 ' + (index + 1) + '】';
        if (!notes.value.includes(token)) {
          const prefix = notes.value.trim() ? '\n\n' : '';
          notes.value = notes.value + prefix + token + '\n1. ';
        }
        notes.focus();
        notes.setSelectionRange(notes.value.length, notes.value.length);
        notes.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        saveNote();
      });
    });
  }

  window.__zynqChapterReady = true;
})();
