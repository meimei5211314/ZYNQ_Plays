(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    } catch (error) {
      /* localStorage may be unavailable on some file:// setups */
    }
  }

  function setText(el, text) {
    if (el) el.textContent = text;
  }

  function fmt8(value) {
    const bits = (value & 0xff).toString(2).padStart(8, '0');
    return bits.slice(0, 4) + ' ' + bits.slice(4);
  }

  function hex32(value) {
    return '0x' + (value >>> 0).toString(16).toUpperCase().padStart(8, '0');
  }

  /* ---------------- scroll progress & active nav ---------------- */

  const progressEl = $('.scroll-progress');

  function updateScrollProgress() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const current = window.scrollY || doc.scrollTop || 0;
    const pct = max > 0 ? Math.min(100, Math.max(0, (current / max) * 100)) : 0;
    if (progressEl) progressEl.style.width = pct.toFixed(2) + '%';
  }

  window.addEventListener('scroll', updateScrollProgress, { passive: true });
  window.addEventListener('resize', updateScrollProgress);
  updateScrollProgress();

  const navLinks = $$('.nav a');
  const navSections = navLinks
    .map((link) => document.getElementById(link.getAttribute('href').slice(1)))
    .filter(Boolean);

  if ('IntersectionObserver' in window && navSections.length) {
    const navObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          navLinks.forEach((link) => {
            link.classList.toggle('active', link.getAttribute('href') === '#' + entry.target.id);
          });
        });
      },
      { rootMargin: '-22% 0px -66% 0px', threshold: 0 }
    );
    navSections.forEach((section) => navObserver.observe(section));
  }

  /* ---------------- mobile menu ---------------- */

  const sidebar = $('#sidebar');
  const overlay = $('#overlay');
  const menuBtn = $('#menuBtn');

  function setMenu(open) {
    if (!sidebar || !menuBtn) return;
    sidebar.classList.toggle('open', open);
    if (overlay) overlay.classList.toggle('show', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  }

  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      setMenu(!sidebar.classList.contains('open'));
    });
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

  /* ---------------- reveal on scroll ---------------- */

  const revealEls = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -4% 0px' }
    );
    revealEls.forEach((el) => revealObserver.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('in'));
  }

  const roadmapGrid = $('#roadmapGrid');
  if (roadmapGrid && 'IntersectionObserver' in window) {
    const roadmapObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            roadmapGrid.classList.add('in');
            observer.disconnect();
          }
        });
      },
      { threshold: 0.12 }
    );
    roadmapObserver.observe(roadmapGrid);
  } else if (roadmapGrid) {
    roadmapGrid.classList.add('in');
  }

  /* ---------------- hero stat counters ---------------- */

  const statBlock = $('.hero-stats');
  const statNumbers = $$('.hero-stats b[data-count]');

  function animateStat(el) {
    const target = parseFloat(el.dataset.count || '0');
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const suffix = el.dataset.suffix || '';
    const duration = 1200;

    if (reduceMotion) {
      el.textContent = (decimals ? target.toFixed(decimals) : target.toLocaleString('en-US')) + suffix;
      return;
    }

    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = target * eased;
      el.textContent =
        (decimals ? value.toFixed(decimals) : Math.round(value).toLocaleString('en-US')) + suffix;
      if (t < 1) requestAnimationFrame(frame);
      else
        el.textContent =
          (decimals ? target.toFixed(decimals) : target.toLocaleString('en-US')) + suffix;
    }
    requestAnimationFrame(frame);
  }

  if (statBlock && statNumbers.length) {
    if ('IntersectionObserver' in window) {
      const statObserver = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              statNumbers.forEach(animateStat);
              observer.disconnect();
            }
          });
        },
        { threshold: 0.35 }
      );
      statObserver.observe(statBlock);
    } else {
      statNumbers.forEach(animateStat);
    }
  }

  /* ---------------- task sorter ---------------- */

  const sorter = $('#sorter');
  if (sorter) {
    const tasks = [
      { t: '100 MHz ADC 连续采样', side: 'pl', hint: '并行采样与确定性节拍', why: '采样带宽高、时序要求确定，PL 是天然主场。' },
      { t: 'Modbus TCP 协议栈', side: 'ps', hint: '现成的协议栈与 socket 生态', why: '协议栈、socket、连接管理复杂度高，Linux 上现成。' },
      { t: '纳秒级 PWM 死区控制', side: 'pl', hint: '纳秒级、可预测的硬件时序', why: '死区时间要求精确到 ns，只有硬件计数能做到。' },
      { t: 'Web 监控页面', side: 'ps', hint: 'HTTP、前端与文件系统', why: 'HTTP/前端/文件系统，PS 跑 Linux 最省力。' },
      { t: '图像卷积预处理', side: 'pl', hint: '像素级并行流水线', why: '像素级并行流水线，PL 可以同时算多路。' },
      { t: 'Linux 字符设备驱动', side: 'ps', hint: '操作系统软件层', why: '驱动属于操作系统软件层，跑在 PS 上。' },
      { t: '1 MHz 编码器 A/B 相解码', side: 'pl', hint: '高频边沿计数与并行处理', why: '高频边沿计数与防抖，硬件并行处理更稳。' },
      { t: '梯形图逻辑解释执行', side: 'ps', hint: '解释执行属于软件逻辑', why: '解释器是软件逻辑，放在 Linux 应用层。' },
      { t: '多路高速数据流 DMA 搬运', side: 'pl', hint: '高带宽数据流与硬件配合', why: 'PL 侧配合 HP 口与 DMA 做高带宽搬运。' },
      { t: '串口命令行控制台', side: 'ps', hint: '交互式软件任务', why: '终端交互是典型软件任务。' },
    ];

    const deck = $('#sorterDeck');
    const scoreEl = $('#sorterScore');
    const feedbackEl = $('#sorterFeedback');
    const resetBtn = $('#sorterReset');
    const binLists = {
      pl: $('.bin-list[data-list="pl"]'),
      ps: $('.bin-list[data-list="ps"]'),
    };
    let score = 0;
    let selected = null;
    let placed = 0;

    function setFeedback(message, tone) {
      feedbackEl.textContent = message;
      feedbackEl.classList.remove('good', 'bad');
      if (tone) feedbackEl.classList.add(tone);
    }

    function buildSorter() {
      deck.innerHTML = '';
      Object.values(binLists).forEach((list) => {
        if (list) list.innerHTML = '';
      });
      score = 0;
      selected = null;
      placed = 0;
      setText(scoreEl, '0');
      setFeedback('等待你选择第一张任务卡……', '');

      tasks.forEach((task, index) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'task-card';
        btn.dataset.index = String(index);
        const dot = document.createElement('span');
        dot.className = 'dot';
        btn.appendChild(dot);
        btn.appendChild(document.createTextNode(task.t));
        btn.addEventListener('click', () => selectTask(index, btn));
        deck.appendChild(btn);
      });
    }

    function selectTask(index, btn) {
      if (btn.classList.contains('placed')) return;
      selected = index;
      $$('.task-card', deck).forEach((card) => card.classList.remove('selected'));
      btn.classList.add('selected');
      setFeedback('已选择「' + tasks[index].t + '」—— 点左侧 PL 或右侧 PS 完成分诊。', '');
    }

    function placeTask(side) {
      if (selected === null) {
        setFeedback('先点一张任务卡，再选择放入哪一侧。', '');
        return;
      }
      const task = tasks[selected];
      const btn = deck.querySelector('[data-index="' + selected + '"]');
      if (!btn) {
        selected = null;
        return;
      }

      if (task.side === side) {
        score += 1;
        placed += 1;
        setText(scoreEl, String(score));
        btn.classList.remove('selected');
        btn.classList.add('placed');
        window.setTimeout(() => btn.remove(), 240);

        const list = binLists[side];
        if (list) {
          const chip = document.createElement('span');
          chip.className = 'placed-chip';
          chip.textContent = task.t;
          list.appendChild(chip);
        }

        setFeedback('正确：' + task.why, 'good');
        selected = null;

        if (placed === tasks.length) {
          setFeedback('全部完成！记住这张分诊表：PL 负责「快」，PS 负责「智」。', 'good');
        }
      } else {
        btn.classList.add('shake');
        window.setTimeout(() => btn.classList.remove('shake'), 420);
        setFeedback('再想想：「' + task.t + '」更看重' + task.hint + '。', 'bad');
      }
    }

    $$('.bin').forEach((bin) => {
      const side = bin.dataset.side;
      bin.addEventListener('click', () => placeTask(side));
      bin.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          placeTask(side);
        }
      });
    });

    if (resetBtn) resetBtn.addEventListener('click', buildSorter);
    buildSorter();
  }

  /* ---------------- number base converter ---------------- */

  const decInput = $('#decInput');
  const hexInput = $('#hexInput');
  const binInput = $('#binInput');
  const binGrouped = $('#binGrouped');

  if (decInput && hexInput && binInput) {
    let converterLock = false;

    function formatBinaryGroups(value) {
      let bits = value.toString(2);
      const padded = Math.max(8, Math.ceil(bits.length / 8) * 8);
      bits = bits.padStart(padded, '0');
      return bits.replace(/(.{4})/g, '$1 ').trim();
    }

    function syncConverter(source) {
      if (converterLock) return;
      converterLock = true;

      let value = 0;

      if (source === 'dec') {
        const raw = decInput.value.replace(/[^\d]/g, '');
        if (raw !== decInput.value) decInput.value = raw;
        value = raw === '' ? 0 : Math.min(4294967295, parseInt(raw, 10));
        decInput.value = String(value);
      } else if (source === 'hex') {
        const raw = hexInput.value
          .replace(/^0x/i, '')
          .replace(/[^0-9a-f]/gi, '')
          .slice(0, 8)
          .toUpperCase();
        if (raw !== hexInput.value) hexInput.value = raw;
        value = raw === '' ? 0 : parseInt(raw, 16);
      } else {
        const raw = binInput.value.replace(/[^01]/g, '').slice(0, 32);
        if (raw !== binInput.value) binInput.value = raw;
        value = raw === '' ? 0 : parseInt(raw, 2);
      }

      if (!Number.isFinite(value) || value < 0) value = 0;
      value = Math.min(4294967295, value);

      if (source !== 'dec') decInput.value = String(value);
      if (source !== 'hex') hexInput.value = value.toString(16).toUpperCase();
      if (source !== 'bin') binInput.value = value.toString(2);
      if (binGrouped) binGrouped.textContent = formatBinaryGroups(value);

      converterLock = false;
    }

    decInput.addEventListener('input', () => syncConverter('dec'));
    hexInput.addEventListener('input', () => syncConverter('hex'));
    binInput.addEventListener('input', () => syncConverter('bin'));

    $$('.quick-chips button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const value = parseInt(btn.dataset.value || '0', 10);
        decInput.value = String(value);
        syncConverter('dec');
      });
    });

    syncConverter('dec');
  }

  /* ---------------- two's complement lab ---------------- */

  const twosRange = $('#twosRange');
  const twosBits = $('#twosBits');
  const twosValue = $('#twosValue');
  const twosStage = $('#twosStage');
  const twosHex = $('#twosHex');
  const twosDemo = $('#twosDemo');
  const twosReset = $('#twosReset');

  if (twosRange && twosBits && twosValue) {
    const tiles = [];
    for (let bit = 7; bit >= 0; bit -= 1) {
      const tile = document.createElement('div');
      tile.className = 'bit-tile';
      if (bit === 7) tile.classList.add('sign');
      tile.dataset.bit = String(bit);
      const valueSpan = document.createElement('span');
      valueSpan.textContent = '0';
      const indexSpan = document.createElement('span');
      indexSpan.className = 'bit-idx';
      indexSpan.textContent = String(bit);
      tile.appendChild(valueSpan);
      tile.appendChild(indexSpan);
      twosBits.appendChild(tile);
      tiles.push(tile);
    }

    let twosRun = 0;
    let twosAnimating = false;

    function setTwosBit(bit, value, animate) {
      const tile = tiles[7 - bit];
      if (!tile) return;
      const valueSpan = tile.querySelector('span');
      const changed = valueSpan.textContent !== String(value);
      valueSpan.textContent = String(value);
      tile.classList.toggle('on', value === 1);
      if (animate && changed) {
        tile.classList.remove('flip', 'changed');
        void tile.offsetWidth;
        tile.classList.add(value === 1 ? 'changed' : 'flip');
        window.setTimeout(() => tile.classList.remove('flip', 'changed'), 420);
      }
    }

    function setTwosByte(byte, animate) {
      for (let bit = 0; bit < 8; bit += 1) {
        setTwosBit(bit, (byte >> bit) & 1, animate);
      }
    }

    function updateTwosStatic() {
      twosRun += 1;
      twosAnimating = false;
      if (twosDemo) twosDemo.disabled = false;
      const v = parseInt(twosRange.value, 10);
      twosValue.textContent = v > 0 ? '+' + v : String(v);
      const byte = v & 0xff;
      setTwosByte(byte, false);
      if (twosHex) twosHex.textContent = '0x' + byte.toString(16).toUpperCase().padStart(2, '0');
      if (twosStage) {
        if (v >= 0) {
          twosStage.innerHTML = '<b>正数</b>：补码 = 原码，无需变换。';
        } else {
          twosStage.innerHTML =
            '负数：先取绝对值 <b>' + Math.abs(v) + '</b>，再按位取反、加 1。点「演示转换」看过程。';
        }
      }
    }

    async function runTwosDemo() {
      if (twosAnimating) return;
      const v = parseInt(twosRange.value, 10);
      if (v >= 0) {
        twosStage.innerHTML = '<b>正数</b>：补码与原码相同，直接写出即可。';
        setTwosByte(v & 0xff, true);
        return;
      }

      const magnitude = Math.abs(v);
      const inverted = (~magnitude) & 0xff;
      const result = (inverted + 1) & 0xff;
      const token = ++twosRun;
      twosAnimating = true;
      if (twosDemo) twosDemo.disabled = true;

      setTwosByte(magnitude, false);
      twosStage.innerHTML = '① 写出绝对值 ' + magnitude + ' 的二进制：<b>' + fmt8(magnitude) + '</b>';
      await sleep(850);
      if (token !== twosRun) return;

      twosStage.innerHTML = '② 按位取反：<b>' + fmt8(inverted) + '</b>';
      for (let bit = 7; bit >= 0; bit -= 1) {
        if (token !== twosRun) return;
        setTwosBit(bit, (inverted >> bit) & 1, true);
        await sleep(85);
      }

      await sleep(620);
      if (token !== twosRun) return;

      twosStage.innerHTML =
        '③ 加 1：<b>' + fmt8(result) + '</b>，这就是 ' + v + ' 的补码（' +
        '0x' + result.toString(16).toUpperCase().padStart(2, '0') + '）。';
      setTwosByte(result, true);
      await sleep(520);
      if (token !== twosRun) return;

      twosAnimating = false;
      if (twosDemo) twosDemo.disabled = false;
    }

    twosRange.addEventListener('input', updateTwosStatic);
    if (twosDemo) twosDemo.addEventListener('click', runTwosDemo);
    if (twosReset) twosReset.addEventListener('click', updateTwosStatic);
    updateTwosStatic();
  }

  /* ---------------- logic gates ---------------- */

  $$('.gate-card').forEach((card) => {
    const gate = card.dataset.gate;
    const buttons = $$('.logic-btn', card);
    const lamp = $('.lamp', card);
    const lampText = $('.lamp span', card);
    const rows = $$('.truth-mini tbody tr', card);
    let a = 0;
    let b = 0;

    function outputOf(x, y) {
      if (gate === 'and') return x & y;
      if (gate === 'or') return x | y;
      return x ^ y;
    }

    function updateGate() {
      const out = outputOf(a, b);
      buttons.forEach((btn) => {
        const bit = parseInt(btn.dataset.bit, 10);
        const value = bit === 0 ? a : b;
        btn.textContent = (bit === 0 ? 'A' : 'B') + ' = ' + value;
        btn.setAttribute('aria-pressed', String(value === 1));
      });
      lamp.classList.toggle('on', out === 1);
      lampText.textContent = 'Y = ' + out;
      rows.forEach((row) => {
        row.classList.toggle(
          'active',
          parseInt(row.dataset.a, 10) === a && parseInt(row.dataset.b, 10) === b
        );
      });
    }

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.bit === '0') a = a ? 0 : 1;
        else b = b ? 0 : 1;
        updateGate();
      });
    });

    updateGate();
  });

  /* ---------------- D flip-flop waveform ---------------- */

  const dffCanvas = $('#dffCanvas');
  if (dffCanvas && dffCanvas.getContext) {
    const ctx = dffCanvas.getContext('2d');
    const playBtn = $('#dffPlay');
    const restartBtn = $('#dffRestart');
    const statusEl = $('#dffStatus');
    const edges = [0, 0.25, 0.5, 0.75, 1.0];
    const highIntervals = [
      [0.06, 0.30],
      [0.43, 0.62],
      [0.70, 0.88],
    ];

    let progress = 0;
    let playing = !reduceMotion;
    let visible = true;
    let lastTime = performance.now();
    let canvasW = 900;
    const canvasH = 300;

    function dAt(t) {
      return highIntervals.some(([start, end]) => t >= start && t < end) ? 1 : 0;
    }

    function qAt(t) {
      let q = 0;
      for (let i = 0; i < edges.length; i += 1) {
        if (t + 0.00001 >= edges[i]) q = dAt(edges[i]);
      }
      return q;
    }

    function resizeCanvas() {
      const width = Math.max(320, dffCanvas.clientWidth || 900);
      const dpr = window.devicePixelRatio || 1;
      canvasW = width;
      dffCanvas.width = Math.round(width * dpr);
      dffCanvas.height = Math.round(canvasH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function levelPath(xStart, xEnd, value, highY, lowY) {
      ctx.beginPath();
      ctx.moveTo(xStart, value ? highY : lowY);
      ctx.lineTo(xEnd, value ? highY : lowY);
      ctx.stroke();
    }

    function drawWave(progressValue) {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvasW, canvasH);

      const padL = 62;
      const padR = 22;
      const plotW = canvasW - padL - padR;
      const plotX = (f) => padL + f * plotW;
      const xMax = plotX(1);

      const clkHigh = 58;
      const clkLow = 88;
      const dHigh = 140;
      const dLow = 170;
      const qHigh = 222;
      const qLow = 252;

      ctx.font = '11px "Cascadia Code", Consolas, monospace';
      ctx.textBaseline = 'middle';

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i += 1) {
        const x = plotX(i * 0.25);
        ctx.beginPath();
        ctx.moveTo(x, 34);
        ctx.lineTo(x, 275);
        ctx.stroke();
      }

      const rows = [
        { label: 'CLK', y: clkHigh + 15, color: '#22d3ee' },
        { label: 'D', y: dHigh + 15, color: '#fb923c' },
        { label: 'Q', y: qHigh + 15, color: '#34d399' },
      ];

      rows.forEach((row) => {
        ctx.fillStyle = row.color;
        ctx.fillText(row.label, 16, row.y);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
        ctx.beginPath();
        ctx.moveTo(padL, row.y);
        ctx.lineTo(xMax, row.y);
        ctx.stroke();
      });

      ctx.fillStyle = 'rgba(100, 116, 139, 0.65)';
      ctx.font = '9px "Cascadia Code", Consolas, monospace';
      ctx.fillText('1', 47, clkHigh);
      ctx.fillText('0', 47, clkLow);
      ctx.fillText('1', 47, dHigh);
      ctx.fillText('0', 47, dLow);
      ctx.fillText('1', 47, qHigh);
      ctx.fillText('0', 47, qLow);

      ctx.lineWidth = 1;
      ctx.setLineDash([4, 5]);
      edges.forEach((edge, index) => {
        const x = plotX(edge);
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.22)';
        ctx.beginPath();
        ctx.moveTo(x, 34);
        ctx.lineTo(x, 268);
        ctx.stroke();

        ctx.fillStyle = 'rgba(251, 191, 36, 0.55)';
        ctx.beginPath();
        ctx.moveTo(x, 35);
        ctx.lineTo(x - 3, 40);
        ctx.lineTo(x + 3, 40);
        ctx.closePath();
        ctx.fill();

        if (index > 0) {
          const sample = dAt(edge);
          const q = dAt(edge);
          ctx.fillStyle = '#fb923c';
          ctx.beginPath();
          ctx.arc(x, sample ? dHigh : dLow, 3.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#34d399';
          ctx.beginPath();
          ctx.arc(x, q ? qHigh : qLow, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.setLineDash([]);

      ctx.lineWidth = 2.2;
      ctx.strokeStyle = '#22d3ee';
      ctx.beginPath();
      for (let cycle = 0; cycle < 4; cycle += 1) {
        const start = plotX((cycle / 4));
        const mid = plotX((cycle / 4) + 0.125);
        const end = plotX((cycle + 1) / 4);
        if (cycle === 0) ctx.moveTo(start, clkLow);
        ctx.lineTo(start, clkHigh);
        ctx.lineTo(mid, clkHigh);
        ctx.lineTo(mid, clkLow);
        ctx.lineTo(end, clkLow);
      }
      ctx.stroke();

      ctx.strokeStyle = '#fb923c';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      let dValue = dAt(0);
      ctx.moveTo(padL, dValue ? dHigh : dLow);
      const transitions = highIntervals.flatMap(([start, end]) => [start, end]).concat([1]);
      transitions.forEach((fraction) => {
        const x = plotX(fraction);
        ctx.lineTo(x, dValue ? dHigh : dLow);
        dValue = dValue ? 0 : 1;
        ctx.lineTo(x, dValue ? dHigh : dLow);
      });
      ctx.stroke();

      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      let qValue = dAt(0);
      ctx.moveTo(padL, qValue ? qHigh : qLow);
      for (let i = 1; i < edges.length; i += 1) {
        const x = plotX(edges[i]);
        ctx.lineTo(x, qValue ? qHigh : qLow);
        qValue = dAt(edges[i]);
        ctx.lineTo(x, qValue ? qHigh : qLow);
      }
      ctx.lineTo(xMax, qValue ? qHigh : qLow);
      ctx.stroke();

      const cursorX = plotX(progressValue);
      ctx.save();
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.85)';
      ctx.lineWidth = 1.4;
      ctx.shadowColor = 'rgba(34, 211, 238, 0.75)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(cursorX, 30);
      ctx.lineTo(cursorX, 272);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
      ctx.font = '9px "Segoe UI", "Microsoft YaHei", sans-serif';
      ctx.fillText('上升沿采样 D → Q 只在时钟沿更新', padL, 16);
    }

    function updateDffStatus(progressValue) {
      if (!statusEl) return;
      const d = dAt(progressValue);
      const q = qAt(progressValue);
      const cycles = (progressValue * 4).toFixed(2);
      statusEl.textContent =
        't = ' + cycles + ' 周期 · D = ' + d + ' · Q = ' + q + '（Q 只在上升沿更新）';
    }

    function tick(now) {
      if (playing && visible) {
        const delta = now - lastTime;
        lastTime = now;
        progress += delta / 9000;
        if (progress >= 1) progress -= 1;
        drawWave(progress);
        updateDffStatus(progress);
      } else {
        lastTime = now;
      }
      requestAnimationFrame(tick);
    }

    function updatePlayButton() {
      if (playBtn) playBtn.textContent = playing ? '暂停' : '播放';
    }

    if (playBtn) {
      playBtn.addEventListener('click', () => {
        playing = !playing;
        lastTime = performance.now();
        updatePlayButton();
      });
    }
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        progress = 0;
        playing = true;
        lastTime = performance.now();
        updatePlayButton();
        drawWave(progress);
        updateDffStatus(progress);
      });
    }

    if ('IntersectionObserver' in window) {
      const canvasObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            visible = entry.isIntersecting;
            lastTime = performance.now();
          });
        },
        { threshold: 0 }
      );
      canvasObserver.observe(dffCanvas);
    }

    if ('ResizeObserver' in window) {
      const resizeObserver = new ResizeObserver(() => {
        resizeCanvas();
        drawWave(progress);
      });
      resizeObserver.observe(dffCanvas);
    }

    resizeCanvas();
    drawWave(progress);
    updateDffStatus(progress);
    updatePlayButton();
    requestAnimationFrame(tick);
  }

  /* ---------------- vending machine FSM ---------------- */

  const fsmSvg = $('#fsmSvg');
  if (fsmSvg) {
    const fsmStates = {
      idle: { name: 'IDLE · 空闲', output: '等待投币', action: 'coin', to: 'coin' },
      coin: { name: 'COIN · 已投币', output: '请选择商品', action: 'select', to: 'select' },
      select: { name: 'SELECT · 已选择', output: '等待确认', action: 'confirm', to: 'dispense' },
      dispense: { name: 'DISPENSE · 出货中', output: '电机转动，出货中……', action: 'dispense', to: 'change' },
      change: { name: 'CHANGE · 找零', output: '请取走零钱', action: 'change', to: 'idle' },
    };

    const actionLabels = {
      coin: '投币',
      select: '选择商品',
      confirm: '确认',
      dispense: '完成出货',
      change: '取走零钱',
      reset: '复位',
    };

    const centers = {
      idle: { x: 90, y: 200 },
      coin: { x: 250, y: 85 },
      select: { x: 440, y: 85 },
      dispense: { x: 590, y: 200 },
      change: { x: 440, y: 325 },
    };

    const token = $('#fsmToken');
    const stateName = $('#fsmStateName');
    const outputEl = $('#fsmOutput');
    const logEl = $('#fsmLog');
    const actionButtons = $$('#fsmActions .btn');
    const stateNodes = $$('.state-node', fsmSvg);

    let fsmState = 'idle';
    let fsmBusy = false;

    function logFsm(message) {
      if (logEl) logEl.textContent = '日志：' + message;
    }

    function setTokenPosition(point) {
      if (!token) return;
      token.setAttribute('cx', String(point.x));
      token.setAttribute('cy', String(point.y));
    }

    function updateFsm() {
      const current = fsmStates[fsmState];
      setText(stateName, current.name);
      if (outputEl) outputEl.innerHTML = '<b>输出：</b>' + current.output;
      stateNodes.forEach((node) => {
        node.classList.toggle('active', node.dataset.state === fsmState);
      });
      actionButtons.forEach((btn) => {
        const action = btn.dataset.action;
        btn.classList.toggle('valid', action === current.action);
      });
      if (!fsmBusy) setTokenPosition(centers[fsmState]);
    }

    function animateFsmToken(from, to, duration) {
      if (!token) return Promise.resolve();
      if (reduceMotion) {
        setTokenPosition(to);
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        const start = performance.now();
        function frame(now) {
          const t = Math.min(1, (now - start) / duration);
          const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          token.setAttribute('cx', String(from.x + (to.x - from.x) * eased));
          token.setAttribute('cy', String(from.y + (to.y - from.y) * eased));
          if (t < 1) requestAnimationFrame(frame);
          else resolve();
        }
        requestAnimationFrame(frame);
      });
    }

    async function fsmAction(action, button) {
      if (fsmBusy) return;

      if (action === 'reset') {
        fsmBusy = true;
        fsmState = 'idle';
        updateFsm();
        setTokenPosition(centers.idle);
        fsmBusy = false;
        logFsm('已复位到 IDLE，等待投币。');
        return;
      }

      const current = fsmStates[fsmState];
      if (action !== current.action) {
        if (button) {
          button.classList.add('shake');
          window.setTimeout(() => button.classList.remove('shake'), 400);
        }
        logFsm('当前在 ' + current.name + '，不能执行「' + actionLabels[action] + '」。');
        return;
      }

      fsmBusy = true;
      const fromState = fsmState;
      const toState = current.to;
      const edge = document.getElementById('edge-' + fromState + '-' + toState);
      if (edge) edge.classList.add('active');

      await animateFsmToken(centers[fromState], centers[toState], reduceMotion ? 0 : 560);

      if (edge) edge.classList.remove('active');
      fsmState = toState;
      fsmBusy = false;
      updateFsm();
      logFsm(
        actionLabels[action] + '：' + fromState.toUpperCase() + ' → ' + toState.toUpperCase() + '。'
      );
    }

    actionButtons.forEach((btn) => {
      btn.addEventListener('click', () => fsmAction(btn.dataset.action, btn));
    });

    updateFsm();
  }

  /* ---------------- pointer memory lab ---------------- */

  const memStrip = $('#memStrip');
  if (memStrip) {
    const values = [10, 20, 30, 40, 50, 60, 70, 80];
    const base = 0x2000;
    let pIndex = 2;
    let ptrNote = '';

    const cells = values.map((value, index) => {
      const cell = document.createElement('div');
      cell.className = 'mem-cell';
      const addr = document.createElement('span');
      addr.className = 'addr';
      addr.textContent = '0x' + (base + index * 4).toString(16).toUpperCase();
      const val = document.createElement('span');
      val.className = 'val';
      val.textContent = String(value);
      cell.appendChild(addr);
      cell.appendChild(val);
      memStrip.appendChild(cell);
      return cell;
    });

    const readout = $('#ptrReadout');
    const prevBtn = $('#ptrPrev');
    const nextBtn = $('#ptrNext');
    const resetBtn = $('#ptrReset');

    function renderPointer() {
      cells.forEach((cell, index) => {
        cell.classList.toggle('target', index === pIndex);
      });
      const address = '0x' + (base + pIndex * 4).toString(16).toUpperCase();
      const current = values[pIndex];
      const previous = pIndex > 0 ? String(values[pIndex - 1]) : '越界（UB）';
      const nextAddress = '0x' + (base + (pIndex + 1) * 4).toString(16).toUpperCase();
      if (readout) {
        readout.innerHTML =
          '<span class="readout-chip">p = <b>' + address + '</b></span>' +
          '<span class="readout-chip">*p = <b>' + current + '</b></span>' +
          '<span class="readout-chip">p[-1] = <b>' + previous + '</b></span>' +
          '<span class="readout-chip">p + 1 → <b>' + nextAddress + '</b></span>' +
          '<span class="readout-chip">p++ 前进 <b>4 字节</b>（sizeof(int)）</span>';
      }
      if (ptrNote && readout) {
        const note = document.createElement('span');
        note.className = 'readout-chip';
        note.style.color = '#fbbf24';
        note.textContent = ptrNote;
        readout.appendChild(note);
      }
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (pIndex > 0) {
          pIndex -= 1;
          ptrNote = '';
        } else {
          ptrNote = '已在 buf[0]，再减就越界了。';
        }
        renderPointer();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (pIndex < values.length - 1) {
          pIndex += 1;
          ptrNote = '';
        } else {
          ptrNote = '已在 buf[7]，再加就越界了（UB）。';
        }
        renderPointer();
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        pIndex = 2;
        ptrNote = '';
        renderPointer();
      });
    }

    renderPointer();
  }

  /* ---------------- 32-bit register lab ---------------- */

  const bitGrid = $('#bitGrid');
  if (bitGrid) {
    let bitValue = 0x0000f00f;
    const bitCells = [];

    for (let bit = 31; bit >= 0; bit -= 1) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'bit-cell';
      cell.dataset.bit = String(bit);
      cell.setAttribute('aria-label', '翻转 bit ' + bit);
      const idx = document.createElement('span');
      idx.className = 'idx';
      idx.textContent = String(bit);
      const val = document.createElement('span');
      val.className = 'v';
      val.textContent = '0';
      cell.appendChild(idx);
      cell.appendChild(val);
      cell.addEventListener('click', () => {
        bitValue = (bitValue ^ (1 << bit)) >>> 0;
        setBitNote('x ^= (1u << ' + bit + ');  /* TGL */');
        renderBits();
      });
      bitGrid.appendChild(cell);
      bitCells.push(cell);
    }

    const bitHex = $('#bitHex');
    const bitApply = $('#bitApply');
    const bitClear = $('#bitClear');
    const bitInvert = $('#bitInvert');
    const bitIndex = $('#bitIndex');
    const bitOpNote = $('#bitOpNote');
    const bitValueEl = $('#bitValue');
    const bitPopEl = $('#bitPop');
    const bitPowEl = $('#bitPow');

    function setBitNote(message) {
      if (bitOpNote) bitOpNote.textContent = message;
    }

    function popcount(value) {
      let v = value >>> 0;
      let count = 0;
      while (v) {
        v = (v & (v - 1)) >>> 0;
        count += 1;
      }
      return count;
    }

    function renderBits() {
      const unsigned = bitValue >>> 0;
      bitCells.forEach((cell) => {
        const bit = parseInt(cell.dataset.bit, 10);
        const on = (unsigned >>> bit) & 1;
        cell.classList.toggle('on', on === 1);
        const val = cell.querySelector('.v');
        if (val) val.textContent = String(on);
      });
      const hex = '0x' + unsigned.toString(16).toUpperCase().padStart(8, '0');
      setText(bitValueEl, hex);
      setText(bitPopEl, String(popcount(unsigned)));
      const power = unsigned !== 0 && ((unsigned & (unsigned - 1)) >>> 0) === 0;
      setText(bitPowEl, power ? '是' : '否');
      if (bitHex) bitHex.value = unsigned.toString(16).toUpperCase().padStart(8, '0');
    }

    function applyHex() {
      if (!bitHex) return;
      const raw = bitHex.value.replace(/^0x/i, '').replace(/[^0-9a-f]/gi, '').slice(0, 8);
      if (!raw) {
        setBitNote('输入为空，保持当前值不变。');
        renderBits();
        return;
      }
      bitValue = parseInt(raw, 16) >>> 0;
      setBitNote('已载入 x = 0x' + raw.toUpperCase() + '。');
      renderBits();
    }

    if (bitApply) bitApply.addEventListener('click', applyHex);
    if (bitHex) {
      bitHex.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          applyHex();
        }
      });
    }
    if (bitClear) {
      bitClear.addEventListener('click', () => {
        bitValue = 0;
        setBitNote('x = 0; 全部位清零。');
        renderBits();
      });
    }
    if (bitInvert) {
      bitInvert.addEventListener('click', () => {
        bitValue = (~bitValue) >>> 0;
        setBitNote('x = ~x; 按位取反。');
        renderBits();
      });
    }

    $$('[data-bitop]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const index = bitIndex ? parseInt(bitIndex.value, 10) : 0;
        if (!Number.isInteger(index) || index < 0 || index > 31) {
          setBitNote('bit 编号必须是 0 ~ 31 的整数。');
          return;
        }
        const op = btn.dataset.bitop;
        if (op === 'set') {
          bitValue = (bitValue | (1 << index)) >>> 0;
          setBitNote('x |= (1u << ' + index + ');  /* SET */');
        } else if (op === 'clr') {
          bitValue = (bitValue & ~(1 << index)) >>> 0;
          setBitNote('x &= ~(1u << ' + index + ');  /* CLR */');
        } else {
          bitValue = (bitValue ^ (1 << index)) >>> 0;
          setBitNote('x ^= (1u << ' + index + ');  /* TGL */');
        }
        renderBits();
      });
    });

    renderBits();
  }

  /* ---------------- endianness lab ---------------- */

  const endianMem = $('#endianMem');
  if (endianMem) {
    const bytes = {
      little: ['78', '56', '34', '12'],
      big: ['12', '34', '56', '78'],
    };
    const cells = [];
    for (let i = 0; i < 4; i += 1) {
      const cell = document.createElement('div');
      cell.className = 'mem-byte';
      const addr = document.createElement('span');
      addr.className = 'addr';
      addr.textContent = '0x' + (0x1000 + i).toString(16).toUpperCase();
      const byte = document.createElement('span');
      byte.className = 'byte';
      byte.textContent = '00';
      cell.appendChild(addr);
      cell.appendChild(byte);
      endianMem.appendChild(cell);
      cells.push(cell);
    }

    const endianNote = $('#endianNote');
    const endianButtons = $$('.endian-toggle button');
    let endianMode = 'little';

    function renderEndian(mode, animate) {
      endianMode = mode;
      cells.forEach((cell, index) => {
        const byte = cell.querySelector('.byte');
        if (byte) byte.textContent = bytes[mode][index];
        if (animate) {
          cell.classList.remove('swap');
          void cell.offsetWidth;
          cell.classList.add('swap');
          window.setTimeout(() => cell.classList.remove('swap'), 350);
        }
      });
      endianButtons.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.endian === mode);
      });
      if (endianNote) {
        endianNote.textContent =
          mode === 'little'
            ? '低地址存低字节（0x78）——x86 / ARM 默认。网络字节序则是大端。'
            : '低地址存高字节（0x12）——网络协议与 Modbus 传输中常见，发送前要做字节序转换。';
      }
    }

    endianButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.endian === endianMode) return;
        renderEndian(btn.dataset.endian, true);
      });
    });

    renderEndian('little', false);
  }

  /* ---------------- register model & AAPCS demo ---------------- */

  const regModel = $('#regModel');
  if (regModel) {
    const model = [
      ['R0', '参数 / 返回', 'arg'],
      ['R1', '参数 1', 'arg'],
      ['R2', '参数 2', 'arg'],
      ['R3', '参数 3', 'arg'],
      ['R4', '被调用者保存', ''],
      ['R5', '被调用者保存', ''],
      ['R6', '被调用者保存', ''],
      ['R7', '被调用者保存', ''],
      ['R8', '被调用者保存', ''],
      ['R9', '被调用者保存', ''],
      ['R10', '被调用者保存', ''],
      ['R11', '被调用者保存', ''],
      ['R12', '临时 / 调用者保存', ''],
      ['SP', 'R13 栈指针', 'special'],
      ['LR', 'R14 返回地址', 'special'],
      ['PC', 'R15 当前指令', 'special'],
    ];
    model.forEach(([name, desc, cls]) => {
      const reg = document.createElement('div');
      reg.className = 'reg ' + cls;
      reg.innerHTML = '<span class="name">' + name + '</span><span class="value">' + desc + '</span>';
      regModel.appendChild(reg);
    });
  }

  const callRegs = $('#callRegs');
  if (callRegs) {
    const registerNames = [
      'R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7',
      'R8', 'R9', 'R10', 'R11', 'R12', 'SP', 'LR', 'PC',
    ];
    const initialRegisters = {
      R0: '0', R1: '0', R2: '0', R3: '0', R4: '0xAA', R5: '0', R6: '0', R7: '0',
      R8: '0', R9: '0', R10: '0', R11: '0', R12: '0',
      SP: '0x00100000', LR: '0x00008020', PC: '0x00008000',
    };
    let callState = Object.assign({}, initialRegisters);
    let callStepIndex = 0;
    const valueEls = {};

    registerNames.forEach((name) => {
      const reg = document.createElement('div');
      reg.className = 'reg';
      if (['R0', 'R1', 'R2', 'R3'].includes(name)) reg.classList.add('arg');
      if (['SP', 'LR', 'PC'].includes(name)) reg.classList.add('special');
      const nameSpan = document.createElement('span');
      nameSpan.className = 'name';
      nameSpan.textContent = name;
      const valueSpan = document.createElement('span');
      valueSpan.className = 'value';
      valueSpan.textContent = callState[name];
      reg.appendChild(nameSpan);
      reg.appendChild(valueSpan);
      callRegs.appendChild(reg);
      valueEls[name] = valueSpan;
    });

    const callExplain = $('#callExplain');
    const callStepEl = $('#callStep');
    const callNext = $('#callNext');
    const callReset = $('#callReset');

    const callSteps = [
      {
        changes: { R0: '3', R1: '5', PC: '0x00008004' },
        text: '<b>1. main 准备参数：</b>前 4 个整型参数依次放入 R0~R3，所以 R0 = 3、R1 = 5。',
      },
      {
        changes: { LR: '0x00008008', PC: '0x00008100' },
        text: '<b>2. BL add：</b>把下一条指令地址 0x8008 存入 LR，然后跳到 add 的入口 0x8100。',
      },
      {
        changes: { R0: '8', PC: '0x00008104' },
        text: '<b>3. add 计算：</b>执行 a + b，结果 8 写回 R0。R0 既是第一个参数，也是返回值寄存器。',
      },
      {
        changes: { PC: '0x00008008' },
        text: '<b>4. BX LR 返回：</b>PC = LR = 0x8008，调用者从 R0 读到返回值 8。R4–R11 若被使用，必须由 add 自己保存和恢复。',
      },
    ];

    function renderCall(changed) {
      registerNames.forEach((name) => {
        if (valueEls[name]) valueEls[name].textContent = callState[name];
      });
      if (changed) {
        changed.forEach((name) => {
          const reg = valueEls[name] ? valueEls[name].closest('.reg') : null;
          if (!reg) return;
          reg.classList.remove('flash');
          void reg.offsetWidth;
          reg.classList.add('flash');
          window.setTimeout(() => reg.classList.remove('flash'), 750);
        });
      }
      setText(callStepEl, String(callStepIndex));
      if (callNext) {
        callNext.textContent = callStepIndex >= callSteps.length ? '已完成' : '下一步';
        callNext.disabled = callStepIndex >= callSteps.length;
      }
      if (callExplain && callStepIndex === 0) {
        callExplain.innerHTML =
          '初始状态：main 尚未传参。R0–R3 是参数/返回寄存器，R13–R15 是 SP / LR / PC。';
      }
    }

    if (callNext) {
      callNext.addEventListener('click', () => {
        if (callStepIndex >= callSteps.length) return;
        const step = callSteps[callStepIndex];
        const changed = Object.keys(step.changes);
        changed.forEach((name) => {
          callState[name] = step.changes[name];
        });
        callStepIndex += 1;
        if (callExplain) callExplain.innerHTML = step.text;
        renderCall(changed);
      });
    }

    if (callReset) {
      callReset.addEventListener('click', () => {
        callState = Object.assign({}, initialRegisters);
        callStepIndex = 0;
        if (callExplain) {
          callExplain.innerHTML =
            '初始状态：main 尚未传参。R0–R3 是参数/返回寄存器，R13–R15 是 SP / LR / PC。';
        }
        renderCall([]);
      });
    }

    renderCall([]);
  }

  /* ---------------- startup code demo ---------------- */

  const startupCode = $('#startupCode');
  if (startupCode) {
    const bssCells = $('#bssCells');
    const stackFill = $('#stackFill');
    const stackTopLabel = $('#stackTopLabel');
    const startupPC = $('#startupPC');
    const startupBss = $('#startupBss');
    const startupExplain = $('#startupExplain');
    const startupNext = $('#startupNext');
    const startupReset = $('#startupReset');
    const initialBss = ['7F', '2A', '00', '91', '13', '5C', 'A8', '3E'];
    const cells = [];
    let startupStep = 0;
    let startupRun = 0;

    initialBss.forEach((value) => {
      const cell = document.createElement('div');
      cell.className = 'bss-cell';
      cell.textContent = value;
      bssCells.appendChild(cell);
      cells.push(cell);
    });

    const explanations = [
      '点击「下一步」开始。第一步必须先建立栈，否则 C 函数无法保存局部变量和返回地址。',
      '第一步：设置栈指针 SP。C 运行环境的前提是先有栈，函数调用、局部变量、返回地址都靠它。',
      '第二步：循环把 __bss_start 到 __bss_end 的每一个字清零。C 标准要求未初始化全局变量为 0，而 RAM 上电内容不确定。',
      '第三步：BL main，把控制权交给 C 世界。main 正常不应返回；真返回了就进入死循环兜底。',
    ];

    const lineSets = [[], [1, 2], [3, 4, 5, 6, 7, 8, 9], [10, 11, 12]];

    function restoreBss() {
      cells.forEach((cell, index) => {
        cell.textContent = initialBss[index];
        cell.classList.remove('zero');
      });
    }

    function clearBssAnimated() {
      const token = ++startupRun;
      cells.forEach((cell, index) => {
        window.setTimeout(() => {
          if (token !== startupRun) return;
          cell.textContent = '00';
          cell.classList.add('zero');
        }, index * 75);
      });
    }

    function updateStartupUI() {
      $$('.line', startupCode).forEach((line) => {
        line.classList.toggle('hl', lineSets[startupStep].includes(parseInt(line.dataset.line, 10)));
      });

      if (stackFill) stackFill.style.width = startupStep >= 1 ? '20%' : '4%';
      setText(stackTopLabel, startupStep >= 1 ? 'SP = 0x00100000' : 'SP = ?');
      setText(startupPC, startupStep >= 2 ? 'clr 循环' : '_start');
      if (startupStep >= 3) setText(startupPC, 'main');
      setText(startupBss, startupStep >= 2 ? '全 0' : '未清零');
      if (startupExplain) startupExplain.textContent = explanations[startupStep];

      if (startupNext) {
        startupNext.textContent = startupStep >= 3 ? '已完成' : '下一步';
        startupNext.disabled = startupStep >= 3;
      }
    }

    if (startupNext) {
      startupNext.addEventListener('click', () => {
        if (startupStep >= 3) return;
        startupStep += 1;
        if (startupStep === 2) {
          clearBssAnimated();
        } else if (startupStep < 2) {
          restoreBss();
        }
        updateStartupUI();
      });
    }

    if (startupReset) {
      startupReset.addEventListener('click', () => {
        startupRun += 1;
        startupStep = 0;
        restoreBss();
        updateStartupUI();
      });
    }

    updateStartupUI();
  }

  /* ---------------- quiz ---------------- */

  const quizList = $('#quizList');
  if (quizList) {
    const questions = [
      {
        q: '下列哪类任务最适合放在 PL？',
        options: ['Modbus TCP 协议栈', 'Web 监控页面', '纳秒级 PWM 死区控制', '文件系统日志'],
        answer: 2,
        why: 'PWM 死区要求纳秒级、可预测的硬件时序，PS 上的中断与调度会带来抖动，PL 的硬件计数更合适。',
      },
      {
        q: '8 位补码 1111_1011 表示的十进制数是？',
        options: ['-4', '-5', '251', '-3'],
        answer: 1,
        why: '按位取反得 0000_0100，加 1 得 0000_0101，即 5；符号位为 1，所以是 -5（无符号解释则是 251）。',
      },
      {
        q: '哪个关键字要求每次访问都真实读写内存，但不保证原子性？',
        options: ['const', 'static', 'volatile', 'restrict'],
        answer: 2,
        why: 'volatile 防止编译器把访问优化成寄存器缓存，但「读-改-写」仍可能被打断，不能替代锁或关中断。',
      },
      {
        q: 'AAPCS 中，函数前 4 个整型参数通常放在哪些寄存器？',
        options: ['R0–R3', 'R4–R7', 'R8–R11', 'R12–R15'],
        answer: 0,
        why: '前 4 个整型参数走 R0–R3，返回值放 R0；R4–R11 由被调用者保存。',
      },
      {
        q: 'FPGA 配置掉电丢失的根本原因是？',
        options: ['Flash 容量不足', '配置存储基于 SRAM', '没有 MMU', '时钟不稳定'],
        answer: 1,
        why: 'FPGA 的配置信息保存在 SRAM 中，掉电即失。所以每次上电都要从 QSPI/SD 加载 bitstream。',
      },
      {
        q: 'start.S 中清零 bss 段的主要目的是？',
        options: ['加快启动', '满足 C 标准：未初始化全局变量应为 0', '释放 DDR', '配置 PLL'],
        answer: 1,
        why: 'C 标准要求未初始化的全局/静态变量初值为 0，而 RAM 上电内容不确定，因此启动代码必须手动清零 bss。',
      },
      {
        q: 'M_AXI_GP 接口最适合下列哪种场景？',
        options: ['CPU 读写 PL 侧 IP 的控制寄存器', '视频帧连续搬运', '缓存一致性小数据交互', '片外 DDR 物理接口'],
        answer: 0,
        why: 'M_AXI_GP 用于 PS 主机访问 PL 从设备，典型是 AXI-Lite 控制寄存器；大流量数据应走 S_AXI_HP + DMA。',
      },
      {
        q: 'setup / hold 时序违例最可能导致的直接现象是？',
        options: ['芯片烧毁', '亚稳态或偶发错误', '功耗归零', '波特率翻倍'],
        answer: 1,
        why: '数据在时钟沿附近不稳定，触发器可能进入亚稳态，表现为偶发、难复现的错误。',
      },
    ];

    const quizScoreEl = $('#quizScore');
    const quizReset = $('#quizReset');
    let quizScore = 0;
    let quizAnswered = 0;

    function renderQuiz() {
      quizList.innerHTML = '';
      quizScore = 0;
      quizAnswered = 0;
      setText(quizScoreEl, '0');
      setText($('#quizDone'), '');

      questions.forEach((item, questionIndex) => {
        const card = document.createElement('div');
        card.className = 'q-card';

        const head = document.createElement('div');
        head.className = 'q-head';
        const num = document.createElement('span');
        num.className = 'q-num';
        num.textContent = 'Q' + (questionIndex + 1);
        const title = document.createElement('h4');
        title.textContent = item.q;
        head.appendChild(num);
        head.appendChild(title);
        card.appendChild(head);

        const options = document.createElement('div');
        options.className = 'q-options';
        const optionButtons = [];

        item.options.forEach((option, optionIndex) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'q-option';
          const letter = document.createElement('span');
          letter.className = 'letter';
          letter.textContent = 'ABCD'[optionIndex];
          const text = document.createElement('span');
          text.textContent = option;
          btn.appendChild(letter);
          btn.appendChild(text);
          btn.addEventListener('click', () => {
            if (card.dataset.answered === '1') return;
            card.dataset.answered = '1';
            const correct = optionIndex === item.answer;
            optionButtons.forEach((candidate, index) => {
              candidate.disabled = true;
              if (index === item.answer) candidate.classList.add('correct');
              if (index === optionIndex && !correct) candidate.classList.add('wrong');
            });
            const explain = card.querySelector('.q-explain');
            explain.hidden = false;
            explain.innerHTML =
              '<b>正确答案：' + 'ABCD'[item.answer] + '。</b>' + item.why;
            if (correct) {
              quizScore += 1;
              setText(quizScoreEl, String(quizScore));
            }
            quizAnswered += 1;
            if (quizAnswered === questions.length) {
              setText($('#quizDone'), ' · 已完成');
            }
          });
          options.appendChild(btn);
          optionButtons.push(btn);
        });

        card.appendChild(options);
        const explain = document.createElement('div');
        explain.className = 'q-explain';
        explain.hidden = true;
        card.appendChild(explain);
        quizList.appendChild(card);
      });
    }

    if (quizReset) quizReset.addEventListener('click', renderQuiz);
    renderQuiz();
  }

  /* ---------------- checklist & sidebar progress ---------------- */

  const checklist = $('#checklist');
  if (checklist) {
    const storageKey = 'zynq_ch01_checklist_v1';
    const boxes = $$('input[type="checkbox"]', checklist);
    const saved = loadJSON(storageKey, []) || [];
    const checkBar = $('#checkBar');
    const checkText = $('#checkText');
    const sideProgressText = $('#sideProgressText');
    const sideProgressBar = $('#sideProgressBar');

    boxes.forEach((box, index) => {
      box.checked = Boolean(saved[index]);
      const label = box.closest('.check-item');
      if (label) label.classList.toggle('checked', box.checked);
    });

    function updateChecklist(save) {
      const values = boxes.map((box) => box.checked);
      const count = values.filter(Boolean).length;
      const pct = Math.round((count / boxes.length) * 100);
      boxes.forEach((box) => {
        const label = box.closest('.check-item');
        if (label) label.classList.toggle('checked', box.checked);
      });
      if (checkBar) checkBar.style.width = pct + '%';
      setText(checkText, count + ' / ' + boxes.length + (count === boxes.length ? ' · 已通关' : ''));
      setText(sideProgressText, pct + '%');
      if (sideProgressBar) sideProgressBar.style.width = pct + '%';
      if (save) saveJSON(storageKey, values);
    }

    boxes.forEach((box) => {
      box.addEventListener('change', () => updateChecklist(true));
    });

    updateChecklist(false);
  }

  /* ---------------- notes autosave ---------------- */

  const notes = $('#notes');
  if (notes) {
    const noteStatus = $('#noteStatus');
    const noteKey = 'zynq_ch01_notes_v1';
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
  }

  /* ---------------- copy code buttons ---------------- */

  $$('.code-block').forEach((block) => {
    const head = $('.code-head', block);
    const pre = $('pre', block);
    if (!head || !pre) return;
    if ($('.copy-btn', head)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-btn';
    button.textContent = '复制';
    button.addEventListener('click', () => {
      const text = pre.innerText;
      function done() {
        button.textContent = '已复制';
        window.setTimeout(() => {
          button.textContent = '复制';
        }, 1300);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => {
          fallbackCopy(text);
          done();
        });
      } else {
        fallbackCopy(text);
        done();
      }
    });
    head.appendChild(button);
  });

  function fallbackCopy(text) {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand('copy');
    } catch (error) {
      /* ignore */
    }
    area.remove();
  }

  saveJSON('zynq_last_chapter_v1', {
    id: 'ch01',
    file: 'index.html',
    title: '第 1 章 · 课程导学与学习路线图'
  });

  window.__zynqLectureReady = true;

  // JS-END
})();
