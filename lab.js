/* ============================================================
   ZYNQ 讲义 · 互动实验室引擎
   依赖 window.ZX_LABS（lab-data.js），不需要联网或第三方库
   支持：flow / wave / fsm / map / bits / sched / net / calc / ladder
   ============================================================ */
(function () {
  'use strict';

  const LABS = window.ZX_LABS || {};
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const PALETTE = ['#22d3ee', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#fb923c', '#f472b6', '#a3e635'];

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtInt(n) {
    return Number(n).toLocaleString('zh-CN');
  }

  function fmtNum(value, decimals) {
    if (!isFinite(value)) return '—';
    const dec = typeof decimals === 'number' ? decimals : 2;
    const abs = Math.abs(value);
    if (abs !== 0 && (abs >= 1e6 || abs < 0.001)) return value.toExponential(2);
    let out = value.toFixed(dec);
    if (out.indexOf('.') >= 0) out = out.replace(/0+$/, '').replace(/\.$/, '');
    return out;
  }

  function parseNumber(value) {
    if (typeof value === 'number') return value;
    if (value == null) return 0;
    const text = String(value).replace(/_/g, '').trim();
    if (/^0x/i.test(text)) return parseInt(text, 16);
    return Number(text);
  }

  function hexAddr(value) {
    const n = parseNumber(value);
    return '0x' + Math.max(0, n).toString(16).toUpperCase().padStart(8, '0');
  }

  function sizeText(bytes) {
    if (bytes == null || !isFinite(bytes)) return '';
    if (bytes >= 1024 * 1024 * 1024) return fmtNum(bytes / (1024 * 1024 * 1024), 1) + ' GB';
    if (bytes >= 1024 * 1024) return fmtNum(bytes / (1024 * 1024), 0) + ' MB';
    if (bytes >= 1024) return fmtNum(bytes / 1024, 0) + ' KB';
    return bytes + ' B';
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function clearTimer(state) {
    if (state.timer) {
      window.clearInterval(state.timer);
      state.timer = null;
    }
  }

  function controlsHTML(parts) {
    return parts.join('');
  }

  function noteHTML(text) {
    return text ? '<b>要点</b> ' + text : '';
  }

  /* =========================================================
     1. Flow —— 流程 / 启动链 / 调用路径
     ========================================================= */

  function initFlow(stage, controls, spec) {
    const steps = Array.isArray(spec.steps) ? spec.steps : [];
    if (!steps.length) return function () {};
    let index = clamp(spec.start || 0, 0, steps.length - 1);
    let playing = false;
    let activeFault = -1;
    const state = { timer: null };

    stage.innerHTML =
      '<div class="zx-flow">' +
        steps.map(function (step, i) {
          return '<button type="button" class="zx-flow-node" data-flow-step="' + i + '">' +
            '<span class="zx-flow-dot">' + String(i + 1).padStart(2, '0') + '</span>' +
            '<span class="zx-flow-main"><b>' + esc(step.title) + '</b>' +
              (step.desc ? '<small>' + esc(step.desc) + '</small>' : '') +
            '</span>' +
            (step.tag ? '<span class="zx-flow-tag">' + esc(step.tag) + '</span>' : '') +
          '</button>';
        }).join('') +
      '</div>' +
      '<div class="zx-flow-detail"><span class="zx-detail-tag">当前步骤</span><p></p></div>' +
      (Array.isArray(spec.faults) && spec.faults.length
        ? '<div class="zx-faults">' + spec.faults.map(function (fault, i) {
            return '<button type="button" class="zx-fault-btn" data-fault="' + i + '">故障注入 · ' + esc(fault.label) + '</button>';
          }).join('') + '</div><div class="zx-fault-panel" hidden></div>'
        : '');

    const nodes = $$('[data-flow-step]', stage);
    const detail = $('.zx-flow-detail p', stage);
    const detailTag = $('.zx-flow-detail .zx-detail-tag', stage);
    const faultPanel = $('.zx-fault-panel', stage);
    const faultButtons = $$('[data-fault]', stage);

    controls.innerHTML = controlsHTML([
      '<button type="button" class="zx-btn" data-act="prev" aria-label="上一步">←</button>',
      '<button type="button" class="zx-btn is-primary" data-act="play">播放</button>',
      '<button type="button" class="zx-btn" data-act="next" aria-label="下一步">→</button>',
      '<button type="button" class="zx-btn" data-act="reset">重置</button>',
      '<span class="zx-controls-spacer"></span>',
      '<span class="zx-status">STEP <b data-flow-status>1 / ' + steps.length + '</b></span>'
    ]);

    function renderFault() {
      if (!faultPanel) return;
      const fault = activeFault >= 0 ? spec.faults[activeFault] : null;
      faultButtons.forEach(function (btn, i) {
        btn.classList.toggle('is-on', i === activeFault);
      });
      if (!fault) {
        faultPanel.hidden = true;
        faultPanel.innerHTML = '';
        return;
      }
      faultPanel.hidden = false;
      faultPanel.innerHTML = '<b>' + esc(fault.title || fault.label) + '：</b>' + (fault.symptom || '');
    }

    function render() {
      nodes.forEach(function (node, i) {
        node.classList.toggle('is-active', i === index);
        node.classList.toggle('is-done', i < index);
        node.setAttribute('aria-current', i === index ? 'step' : 'false');
      });
      const step = steps[index];
      detail.innerHTML = (step.detail || step.desc || '') +
        (step.code ? '<br><code>' + esc(step.code) + '</code>' : '');
      detailTag.textContent = step.tag ? step.tag : '当前步骤 ' + (index + 1);
      const status = $('[data-flow-status]', controls);
      if (status) status.textContent = (index + 1) + ' / ' + steps.length;
      $('[data-act="prev"]', controls).disabled = index === 0;
      $('[data-act="next"]', controls).disabled = index === steps.length - 1;
      if (activeFault >= 0 && spec.faults[activeFault].at !== index) {
        activeFault = -1;
      }
      renderFault();
    }

    function stop() {
      playing = false;
      clearTimer(state);
      const btn = $('[data-act="play"]', controls);
      if (btn) btn.textContent = '播放';
    }

    function next() {
      if (index < steps.length - 1) {
        index += 1;
        render();
      } else {
        stop();
      }
    }

    function play() {
      if (playing) {
        stop();
        return;
      }
      if (index >= steps.length - 1) index = 0;
      playing = true;
      $('[data-act="play"]', controls).textContent = '暂停';
      render();
      state.timer = window.setInterval(next, reduceMotion ? 900 : 1500);
    }

    nodes.forEach(function (node) {
      node.addEventListener('click', function () {
        index = Number(node.dataset.flowStep);
        render();
      });
    });

    faultButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const i = Number(btn.dataset.fault);
        activeFault = activeFault === i ? -1 : i;
        if (activeFault >= 0) {
          index = clamp(spec.faults[activeFault].at, 0, steps.length - 1);
          render();
        } else {
          renderFault();
        }
      });
    });

    controls.addEventListener('click', function (event) {
      const btn = event.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === 'prev') { stop(); index = Math.max(0, index - 1); render(); }
      if (act === 'next') { stop(); index = Math.min(steps.length - 1, index + 1); render(); }
      if (act === 'play') play();
      if (act === 'reset') { stop(); index = clamp(spec.start || 0, 0, steps.length - 1); render(); }
    });

    render();
    return stop;
  }

  /* =========================================================
     2. Wave —— 数字波形 / 协议时序
     ========================================================= */

  function initWave(stage, controls, spec) {
    const signals = Array.isArray(spec.signals) ? spec.signals : [];
    if (!signals.length) return function () {};
    const ticks = Math.max.apply(null, signals.map(function (s) { return s.values.length; }));
    const cell = spec.cell || 27;
    const labelW = 94;
    const top = Array.isArray(spec.markers) && spec.markers.length ? 38 : 16;
    const rowH = 34;
    const axisH = 22;
    const width = labelW + ticks * cell + 12;
    const height = top + signals.length * rowH + axisH;
    let current = 0;
    let playing = false;
    const state = { timer: null };

    function isBitRow(signal) {
      return signal.values.every(function (v) { return v === 0 || v === 1 || v === '0' || v === '1'; });
    }

    function bitPath(signal, rowTop) {
      const yH = rowTop + 7;
      const yL = rowTop + rowH - 8;
      let d = '';
      let prev = null;
      signal.values.forEach(function (value, i) {
        const v = (value === 1 || value === '1') ? 1 : 0;
        const x = labelW + i * cell;
        const y = v ? yH : yL;
        if (i === 0) {
          d += 'M' + x + ',' + y;
        } else if (prev !== v) {
          d += ' L' + x + ',' + (prev ? yH : yL) + ' L' + x + ',' + y;
        } else {
          d += ' L' + x + ',' + y;
        }
        prev = v;
      });
      const last = signal.values[signal.values.length - 1];
      const lastY = (last === 1 || last === '1') ? yH : yL;
      d += ' L' + (labelW + ticks * cell) + ',' + lastY;
      return d;
    }

    function busRuns(signal, rowTop, color, rowIndex) {
      let out = '';
      let i = 0;
      while (i < signal.values.length) {
        let j = i;
        while (j + 1 < signal.values.length && signal.values[j + 1] === signal.values[i]) j += 1;
        const x = labelW + i * cell + 2;
        const w = (j - i + 1) * cell - 4;
        const label = String(signal.values[i] == null ? '' : signal.values[i]);
        const maxChars = Math.max(2, Math.floor(w / 6));
        const shown = label.length > maxChars ? label.slice(0, maxChars - 1) + '…' : label;
        out += '<g><title>' + esc(label) + '</title>' +
          '<rect class="zx-wave-busrect" x="' + x + '" y="' + (rowTop + 5) + '" width="' + w + '" height="' + (rowH - 11) + '" ' +
          'fill="' + color + '" fill-opacity="0.09" stroke="' + color + '" stroke-opacity="0.55"></rect>' +
          (w > 26 ? '<text x="' + (x + w / 2) + '" y="' + (rowTop + rowH / 2 + 2) + '" text-anchor="middle" fill="' + color + '" font-size="7.5">' + esc(shown) + '</text>' : '') +
          '</g>';
        i = j + 1;
      }
      return out;
    }

    let svg = '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + esc(spec.aria || '数字时序波形') + '">';
    svg += '<defs><marker id="zxArrow-' + Math.random().toString(36).slice(2, 7) + '" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#fbbf24"></path></marker></defs>';

    if (Array.isArray(spec.markers)) {
      spec.markers.forEach(function (marker) {
        const x = labelW + clamp(marker.tick, 0, ticks) * cell;
        svg += '<line class="zx-wave-marker-line" x1="' + x + '" y1="14" x2="' + x + '" y2="' + (top - 4) + '"></line>';
        svg += '<text class="zx-wave-marker-text" x="' + (x + 3) + '" y="12">' + esc(marker.label) + '</text>';
      });
    }

    signals.forEach(function (signal, row) {
      const rowTop = top + row * rowH;
      const color = signal.color || PALETTE[row % PALETTE.length];
      svg += '<g>';
      svg += '<rect class="zx-wave-row-bg" x="' + labelW + '" y="' + rowTop + '" width="' + (ticks * cell) + '" height="' + rowH + '"></rect>';
      svg += '<text class="zx-wave-name" x="2" y="' + (rowTop + rowH / 2 + 3) + '" fill="' + color + '">' + esc(signal.name) + '</text>';
      if (signal.tag) {
        svg += '<text x="' + (labelW - 5) + '" y="' + (rowTop + rowH / 2 + 3) + '" text-anchor="end" font-size="6.5">' + esc(signal.tag) + '</text>';
      }
      if (isBitRow(signal)) {
        svg += '<path class="zx-wave-line" d="' + bitPath(signal, rowTop) + '" stroke="' + color + '"></path>';
      } else {
        svg += busRuns(signal, rowTop, color, row);
      }
      svg += '<line class="zx-wave-grid" x1="' + labelW + '" y1="' + (rowTop + rowH) + '" x2="' + (labelW + ticks * cell) + '" y2="' + (rowTop + rowH) + '"></line>';
      svg += '</g>';
    });

    for (let t = 0; t <= ticks; t += 1) {
      if (t % (spec.labelEvery || 5) === 0) {
        const x = labelW + t * cell;
        svg += '<line class="zx-wave-axis" x1="' + x + '" y1="' + top + '" x2="' + x + '" y2="' + (top + signals.length * rowH) + '"></line>';
        svg += '<text x="' + x + '" y="' + (height - 6) + '" text-anchor="middle">' + t + '</text>';
      }
    }
    const axisY = top + signals.length * rowH;
    svg += '<line class="zx-wave-axis" x1="' + labelW + '" y1="' + axisY + '" x2="' + (labelW + ticks * cell) + '" y2="' + axisY + '"></line>';
    svg += '<line class="zx-wave-playhead" x1="' + (labelW + current * cell) + '" y1="' + (top - 2) + '" x2="' + (labelW + current * cell) + '" y2="' + axisY + '"></line>';
    svg += '<rect class="zx-wave-playhead-cap" x="' + (labelW + current * cell - 3) + '" y="' + (top - 6) + '" width="6" height="4" rx="1"></rect>';
    svg += '<line class="zx-wave-cursor" x1="0" y1="0" x2="0" y2="0"></line>';
    svg += '</svg>';

    stage.innerHTML = '<div class="zx-wave-wrap"><div class="zx-wave">' + svg + '</div></div>' +
      (Array.isArray(spec.chips) && spec.chips.length
        ? '<div class="zx-wave-hint">' + spec.chips.map(function (chip) { return '<span class="zx-wave-chip">' + chip + '</span>'; }).join('') + '</div>'
        : '');

    const svgEl = $('svg', stage);
    const playhead = $('.zx-wave-playhead', stage);
    const cap = $('.zx-wave-playhead-cap', stage);
    const cursor = $('.zx-wave-cursor', stage);

    controls.innerHTML = controlsHTML([
      '<button type="button" class="zx-btn" data-act="back" aria-label="上一拍">←</button>',
      '<button type="button" class="zx-btn is-primary" data-act="play">播放</button>',
      '<button type="button" class="zx-btn" data-act="step" aria-label="下一拍">→</button>',
      '<input class="zx-scrub" type="range" min="0" max="' + ticks + '" value="0" step="1" aria-label="时间轴位置">',
      '<span class="zx-status">t = <b data-wave-t></b>' + (spec.tickUnit || '') + '</span>'
    ]);

    const scrub = $('.zx-scrub', controls);
    const tLabel = $('[data-wave-t]', controls);

    function paint() {
      const x = labelW + current * cell;
      playhead.setAttribute('x1', x);
      playhead.setAttribute('x2', x);
      cap.setAttribute('x', x - 3);
      cursor.setAttribute('x1', labelW + current * cell);
      cursor.setAttribute('x2', labelW + (current + 1) * cell);
      scrub.value = current;
      tLabel.textContent = current;
    }

    function stop() {
      playing = false;
      clearTimer(state);
      const btn = $('[data-act="play"]', controls);
      if (btn) btn.textContent = '播放';
    }

    function play() {
      if (playing) { stop(); return; }
      if (current >= ticks) current = 0;
      playing = true;
      $('[data-act="play"]', controls).textContent = '暂停';
      paint();
      state.timer = window.setInterval(function () {
        current += 1;
        if (current > ticks) {
          current = ticks;
          stop();
        }
        paint();
      }, reduceMotion ? 900 : 520);
    }

    controls.addEventListener('click', function (event) {
      const btn = event.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === 'play') play();
      if (act === 'step') { stop(); current = Math.min(ticks, current + 1); paint(); }
      if (act === 'back') { stop(); current = Math.max(0, current - 1); paint(); }
    });
    scrub.addEventListener('input', function () { stop(); current = Number(scrub.value); paint(); });

    svgEl.addEventListener('click', function (event) {
      const rect = svgEl.getBoundingClientRect();
      const scale = width / rect.width;
      const x = (event.clientX - rect.left) * scale;
      const t = Math.round((x - labelW) / cell);
      current = clamp(t, 0, ticks);
      stop();
      paint();
    });

    paint();
    return stop;
  }

  /* =========================================================
     3. FSM —— 状态机
     ========================================================= */

  function initFsm(stage, controls, spec) {
    const states = Array.isArray(spec.states) ? spec.states : [];
    const transitions = Array.isArray(spec.transitions) ? spec.transitions : [];
    if (!states.length) return function () {};
    const byId = {};
    states.forEach(function (s) { byId[s.id] = s; });
    let current = spec.initial || states[0].id;
    let takenEdge = -1;
    let playing = false;
    const state = { timer: null };
    const logs = [];

    function center(node) {
      return { x: node.x == null ? 320 : node.x, y: node.y == null ? 170 : node.y };
    }

    function edgeGeometry(from, to, index) {
      const a = center(from);
      const b = center(to);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const startX = a.x + ux * 56;
      const startY = a.y + uy * 27;
      const endX = b.x - ux * 56;
      const endY = b.y - uy * 27;
      const hasReverse = transitions.some(function (t) { return t.from === to.id && t.to === from.id; });
      const curve = hasReverse ? (index % 2 === 0 ? 16 : -16) : 0;
      const mx = (startX + endX) / 2 - uy * curve;
      const my = (startY + endY) / 2 + ux * curve;
      return { startX: startX, startY: startY, endX: endX, endY: endY, mx: mx, my: my, curve: curve };
    }

    function buildSvg() {
      let svg = '<svg viewBox="0 0 640 340" role="img" aria-label="' + esc(spec.aria || '状态机') + '">';
      svg += '<defs><marker id="zxFsmArrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="currentColor"></path></marker></defs>';
      transitions.forEach(function (t, i) {
        const from = byId[t.from];
        const to = byId[t.to];
        if (!from || !to) return;
        const g = edgeGeometry(from, to, i);
        const pathId = 'zx-edge-' + i;
        svg += '<path id="' + pathId + '" class="zx-edge" d="M' + g.startX + ',' + g.startY + ' Q' + g.mx + ',' + g.my + ' ' + g.endX + ',' + g.endY + '" marker-end="url(#zxFsmArrow)" style="color:#64748b"></path>';
        svg += '<text class="zx-edge-label" id="' + pathId + '-label" x="' + g.mx + '" y="' + (g.my - 3) + '">' + esc(t.label || t.event) + '</text>';
      });
      states.forEach(function (s) {
        const c = center(s);
        svg += '<g class="zx-state" data-state="' + esc(s.id) + '" transform="translate(' + c.x + ',' + c.y + ')">' +
          '<rect class="zx-state-shell" x="-53" y="-23" width="106" height="46" rx="10"></rect>' +
          '<text class="zx-state-label" x="0" y="-2">' + esc(s.id) + '</text>' +
          '<text class="zx-state-sub" x="0" y="12">' + esc(s.name || '') + '</text>' +
        '</g>';
      });
      svg += '</svg>';
      return svg;
    }

    stage.innerHTML = '<div class="zx-fsm-wrap"><div class="zx-fsm">' + buildSvg() + '</div>' +
      '<div class="zx-fsm-events"></div><div class="zx-fsm-log" aria-live="polite"></div></div>';

    const svgEl = $('svg', stage);
    const eventsBox = $('.zx-fsm-events', stage);
    const logBox = $('.zx-fsm-log', stage);
    const eventNames = [];
    transitions.forEach(function (t) {
      if (eventNames.indexOf(t.event) < 0 && t.event !== 'reset') eventNames.push(t.event);
    });

    eventsBox.innerHTML = eventNames.map(function (name, i) {
      return '<button type="button" class="zx-btn" data-event="' + esc(name) + '">' + esc(name) + '</button>';
    }).join('');

    controls.innerHTML = controlsHTML([
      '<button type="button" class="zx-btn" data-act="reset">复位到 ' + esc(spec.initial || states[0].id) + '</button>',
      Array.isArray(spec.auto) && spec.auto.length ? '<button type="button" class="zx-btn is-primary" data-act="auto">自动演示</button>' : '',
      '<span class="zx-controls-spacer"></span>',
      '<span class="zx-status">STATE <b data-fsm-status></b></span>'
    ]);

    function addLog(html) {
      logs.unshift(html);
      if (logs.length > 10) logs.pop();
      logBox.innerHTML = logs.map(function (line, i) {
        return '<div style="opacity:' + (1 - i * 0.07) + '">' + line + '</div>';
      }).join('');
    }

    function render(taken) {
      $$('.zx-state', stage).forEach(function (node) {
        node.classList.toggle('is-active', node.dataset.state === current);
      });
      $$('.zx-edge', stage).forEach(function (edge) {
        edge.classList.remove('is-taken');
        edge.style.color = '#64748b';
      });
      if (taken && taken >= 0) {
        const edge = document.getElementById('zx-edge-' + taken);
        if (edge) {
          edge.classList.add('is-taken');
          edge.style.color = 'var(--zx-accent)';
        }
        const label = document.getElementById('zx-edge-' + taken + '-label');
        if (label) label.style.fill = 'var(--zx-accent)';
      }
      $$('.zx-edge-label', stage).forEach(function (label, i) {
        if (!taken || i !== taken) label.style.fill = '';
      });
      const status = $('[data-fsm-status]', controls);
      if (status) status.textContent = current;
    }

    function fire(eventName) {
      const foundIndex = transitions.findIndex(function (t) { return t.from === current && t.event === eventName; });
      if (foundIndex < 0) {
        addLog('<b>✕</b> 在 ' + esc(current) + ' 下事件 <b>' + esc(eventName) + '</b> 无效 —— 真实状态机必须显式处理非法事件，通常留在原状态并记录故障。');
        return false;
      }
      const transition = transitions[foundIndex];
      addLog('<b>' + esc(current) + '</b> --' + esc(eventName) + '--> <b>' + esc(transition.to) + '</b>' + (transition.note ? ' · ' + esc(transition.note) : ''));
      current = transition.to;
      takenEdge = foundIndex;
      render(foundIndex);
      return true;
    }

    eventsBox.addEventListener('click', function (event) {
      const btn = event.target.closest('[data-event]');
      if (!btn) return;
      stopAuto();
      fire(btn.dataset.event);
    });

    function stopAuto() {
      playing = false;
      clearTimer(state);
      const btn = $('[data-act="auto"]', controls);
      if (btn) btn.textContent = '自动演示';
    }

    controls.addEventListener('click', function (event) {
      const btn = event.target.closest('[data-act]');
      if (!btn) return;
      if (btn.dataset.act === 'reset') {
        stopAuto();
        current = spec.initial || states[0].id;
        takenEdge = -1;
        logs.length = 0;
        logBox.innerHTML = '';
        render(-1);
      }
      if (btn.dataset.act === 'auto') {
        if (playing) { stopAuto(); return; }
        stopAuto();
        const seq = spec.auto.slice();
        if (!seq.length) return;
        current = spec.initial || states[0].id;
        logs.length = 0;
        logBox.innerHTML = '';
        render(-1);
        playing = true;
        btn.textContent = '停止';
        let i = 0;
        state.timer = window.setInterval(function () {
          if (i >= seq.length) { stopAuto(); return; }
          fire(seq[i]);
          i += 1;
        }, reduceMotion ? 1000 : 1300);
      }
    });

    addLog('<b>INIT</b> 初始状态 <b>' + esc(current) + '</b>，等待事件。');
    render(-1);
    return stopAuto;
  }

  /* =========================================================
     4. Map —— 地址 / 存储地图
     ========================================================= */

  function initMap(stage, controls, spec) {
    const regions = Array.isArray(spec.regions) ? spec.regions : [];
    if (!regions.length) return function () {};
    let active = 0;
    const colors = spec.regions.map(function (r, i) { return r.color || PALETTE[i % PALETTE.length]; });

    stage.innerHTML =
      (spec.search === false ? '' :
        '<div class="zx-map-search"><input type="text" inputmode="text" placeholder="' + esc(spec.searchPlaceholder || '输入地址，如 0x43C00000') + '" aria-label="地址查询"><button type="button" class="zx-btn" data-map-find>定位</button></div>' +
        '<div class="zx-map-result" aria-live="polite">输入一个 32 位地址，查看它落在哪个区块。</div>') +
      '<div class="zx-map">' +
        '<div class="zx-map-list">' + regions.map(function (r, i) {
          return '<button type="button" class="zx-map-row' + (i === 0 ? ' is-active' : '') + '" data-map-row="' + i + '" style="--row-color:' + colors[i] + '">' +
            '<i class="zx-map-swatch"></i>' +
            '<span><b>' + esc(r.name) + '</b><small>' + (spec.search === false ? esc(r.tag || '') : hexAddr(r.base) + ' – ' + hexAddr(parseNumber(r.base) + parseNumber(r.size) - 1)) + '</small></span>' +
            '<span class="zx-map-size">' + sizeText(parseNumber(r.size)) + '</span>' +
          '</button>';
        }).join('') + '</div>' +
        '<div class="zx-map-detail"></div>' +
      '</div>';

    const detail = $('.zx-map-detail', stage);
    const rows = $$('[data-map-row]', stage);

    function renderDetail() {
      const r = regions[active];
      const base = parseNumber(r.base);
      const size = parseNumber(r.size);
      detail.style.setProperty('--zx-accent', colors[active]);
      detail.innerHTML =
        '<div class="zx-md-range">' + (spec.search === false ? esc(r.tag || r.name) : hexAddr(base) + ' · ' + sizeText(size)) + '</div>' +
        '<h4>' + esc(r.name) + '</h4>' +
        '<p>' + (r.desc || '') + '</p>' +
        (Array.isArray(r.items) && r.items.length ? '<ul>' + r.items.map(function (item) { return '<li>' + item + '</li>'; }).join('') + '</ul>' : '');
      rows.forEach(function (row, i) { row.classList.toggle('is-active', i === active); });
    }

    rows.forEach(function (row) {
      row.addEventListener('click', function () {
        active = Number(row.dataset.mapRow);
        renderDetail();
      });
    });

    const input = $('.zx-map-search input', stage);
    const findBtn = $('[data-map-find]', stage);
    const result = $('.zx-map-result', stage);

    function find() {
      if (!input || !result) return;
      const value = parseNumber(input.value);
      if (!isFinite(value)) {
        result.innerHTML = '未识别该地址，请输入十六进制（0x...）或十进制。';
        return;
      }
      const hit = regions.findIndex(function (r) {
        const base = parseNumber(r.base);
        return value >= base && value < base + parseNumber(r.size);
      });
      if (hit < 0) {
        result.innerHTML = '<b>' + hexAddr(value) + '</b> 未落在任何已列区块内 —— 先查地址映射表，别直接解引用。';
        return;
      }
      active = hit;
      const base = parseNumber(regions[hit].base);
      result.innerHTML = '<b>' + hexAddr(value) + '</b> → ' + esc(regions[hit].name) + '，块内偏移 <b>0x' + (value - base).toString(16).toUpperCase() + '</b>';
      renderDetail();
    }

    if (findBtn) findBtn.addEventListener('click', find);
    if (input) {
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') find(); });
    }
    renderDetail();
    if (controls) controls.innerHTML = '';
    return function () {};
  }

  /* =========================================================
     5. Bits —— 寄存器 / 位域
     ========================================================= */

  function initBits(stage, controls, spec) {
    const width = spec.width || 32;
    const fields = Array.isArray(spec.fields) ? spec.fields : [];
    let value = parseNumber(spec.value || 0);
    let selected = fields.length ? 0 : -1;
    const colors = fields.map(function (f, i) { return f.color || PALETTE[i % PALETTE.length]; });
    const editable = spec.editable !== false;
    const cols = width > 16 ? 16 : width;

    function fieldOf(bit) {
      return fields.findIndex(function (f) { return bit <= f.msb && bit >= f.lsb; });
    }

    function bitIsOn(bit) {
      return Boolean((value >>> bit) & 1);
    }

    function setBit(bit, on) {
      if (on) value = (value | (1 << bit)) >>> 0;
      else value = (value & ~(1 << bit)) >>> 0;
    }

    function maskFor(field) {
      const length = field.msb - field.lsb + 1;
      const mask = (length >= 32 ? 0xFFFFFFFF : ((1 << length) - 1)) >>> 0;
      return mask;
    }

    stage.innerHTML =
      '<div class="zx-bits-head"><b>' + esc(spec.title || 'REGISTER') + '</b><span>' + width + ' bit' + (editable ? ' · 点击位翻转' : ' · 只读') + '</span></div>' +
      '<div class="zx-bits-grid" style="--cols:' + cols + '">' +
        Array.from({ length: width }, function (_, i) {
          const bit = width - 1 - i;
          return '<button type="button" class="zx-bit" data-bit="' + bit + '" aria-label="bit ' + bit + '">' + bit + '</button>';
        }).join('') +
      '</div>' +
      '<div class="zx-bit-labels" style="--cols:' + cols + '">' +
        Array.from({ length: width }, function (_, i) {
          const bit = width - 1 - i;
          return '<span>' + (bit % 8 === 0 ? 'B' + (bit / 8) : '') + '</span>';
        }).join('') +
      '</div>' +
      '<div class="zx-bit-legend">' + fields.map(function (f, i) {
        return '<button type="button" class="zx-field-btn' + (i === selected ? ' is-active' : '') + '" data-field="' + i + '" style="--field-color:' + colors[i] + '">' + esc(f.name) + ' [' + f.msb + (f.lsb !== f.msb ? ':' + f.lsb : '') + ']</button>';
      }).join('') + '</div>' +
      '<div class="zx-bit-info">' +
        '<div><span>HEX</span><b data-bits-hex></b></div>' +
        '<div><span>UNSIGNED</span><b data-bits-dec></b></div>' +
        '<div><span>BINARY</span><b data-bits-bin style="font-size:9px"></b></div>' +
        '<div><span>选中字段</span><b data-bits-field>—</b></div>' +
      '</div>' +
      '<div class="zx-bit-desc"></div>';

    const bitButtons = $$('[data-bit]', stage);
    const fieldButtons = $$('[data-field]', stage);
    const desc = $('.zx-bit-desc', stage);

    function renderDesc() {
      if (selected >= 0) {
        const field = fields[selected];
        const shifted = (value >>> field.lsb) & maskFor(field);
        desc.innerHTML = '<b>' + esc(field.name) + '</b> = ' + shifted + '（0x' + shifted.toString(16).toUpperCase() + '）· ' + (field.desc || '');
        $('[data-bits-field]', stage).textContent = field.name + '=' + shifted;
      } else {
        desc.textContent = '点击任意字段查看含义；点击位可翻转该位。';
        $('[data-bits-field]', stage).textContent = '—';
      }
    }

    function render() {
      bitButtons.forEach(function (btn) {
        const bit = Number(btn.dataset.bit);
        const fieldIndex = fieldOf(bit);
        btn.classList.toggle('is-on', bitIsOn(bit));
        btn.classList.toggle('is-field', fieldIndex >= 0);
        btn.classList.toggle('is-dim', selected >= 0 && fieldIndex !== selected);
        if (fieldIndex >= 0) btn.style.setProperty('--field-color', colors[fieldIndex]);
        btn.disabled = !editable;
      });
      $('[data-bits-hex]', stage).textContent = '0x' + value.toString(16).toUpperCase().padStart(Math.ceil(width / 4), '0');
      $('[data-bits-dec]', stage).textContent = fmtInt(value);
      $('[data-bits-bin]', stage).textContent = value.toString(2).padStart(width, '0');
      fieldButtons.forEach(function (btn, i) {
        btn.classList.toggle('is-active', i === selected);
        btn.style.setProperty('--field-color', colors[i]);
      });
      renderDesc();
    }

    bitButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!editable) return;
        const bit = Number(btn.dataset.bit);
        setBit(bit, !bitIsOn(bit));
        selected = fieldOf(bit);
        render();
      });
    });

    fieldButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const index = Number(btn.dataset.field);
        selected = selected === index ? -1 : index;
        render();
      });
    });

    controls.innerHTML = editable ? controlsHTML([
      '<button type="button" class="zx-btn" data-act="clear">清零</button>',
      '<button type="button" class="zx-btn" data-act="ones">全置 1</button>',
      '<button type="button" class="zx-btn" data-act="reset">恢复初始值</button>',
      '<span class="zx-controls-spacer"></span>',
      '<span class="zx-status">BASE <b>0x' + value.toString(16).toUpperCase().padStart(Math.ceil(width / 4), '0') + '</b></span>'
    ]) : '';

    controls.addEventListener('click', function (event) {
      const btn = event.target.closest('[data-act]');
      if (!btn) return;
      if (btn.dataset.act === 'clear') value = 0;
      if (btn.dataset.act === 'ones') value = width >= 32 ? 0xFFFFFFFF : (Math.pow(2, width) - 1) >>> 0;
      if (btn.dataset.act === 'reset') value = parseNumber(spec.value || 0);
      render();
      const status = $('.zx-status b', controls);
      if (status) status.textContent = '0x' + value.toString(16).toUpperCase().padStart(Math.ceil(width / 4), '0');
    });

    render();
    return function () {};
  }

  /* =========================================================
     6. Sched —— 调度 / 时间线
     ========================================================= */

  function initSched(stage, controls, spec) {
    const rows = Array.isArray(spec.rows) ? spec.rows : [];
    const ticks = spec.ticks || 40;
    if (!rows.length) return function () {};
    let current = 0;
    let playing = false;
    const state = { timer: null };
    const phases = Array.isArray(spec.phases) ? spec.phases : [];

    const rowsHTML = rows.map(function (row, r) {
      const color = row.color || PALETTE[r % PALETTE.length];
      const segments = (row.segments || []).map(function (seg) {
        const start = clamp(Number(seg[0]), 0, ticks);
        const end = clamp(Number(seg[1]), start, ticks);
        const label = seg[2] == null ? '' : String(seg[2]);
        return '<span class="zx-sched-seg' + (seg[3] ? ' is-idle' : '') + '" style="left:' + (start / ticks * 100) + '%;width:' + ((end - start) / ticks * 100) + '%;--seg-color:' + color + '" title="' + esc(label) + '">' + esc(label) + '</span>';
      }).join('');
      return '<div class="zx-sched-row">' +
        '<div class="zx-sched-name">' + esc(row.name) + (row.sub ? '<small>' + esc(row.sub) + '</small>' : '') + '</div>' +
        '<div class="zx-sched-track" data-sched-track style="--ticks:' + ticks + '">' + segments + '<i class="zx-sched-playhead" data-sched-head style="left:0"></i></div>' +
      '</div>';
    }).join('');

    const labelEvery = spec.labelEvery || 5;
    let tickLabels = '';
    for (let t = 0; t <= ticks; t += labelEvery) {
      tickLabels += '<span style="left:' + (t / ticks * 100) + '%">' + t + '</span>';
    }

    stage.innerHTML = '<div class="zx-sched-wrap"><div class="zx-sched">' + rowsHTML +
      '<div class="zx-sched-axis"><div></div><div class="zx-sched-ticks">' + tickLabels + '</div></div>' +
      '</div></div>' +
      '<div class="zx-sched-note">' + (spec.note || '') + '</div>';

    const heads = $$('[data-sched-head]', stage);
    controls.innerHTML = controlsHTML([
      '<button type="button" class="zx-btn is-primary" data-act="play">播放</button>',
      '<button type="button" class="zx-btn" data-act="reset">重置</button>',
      '<input class="zx-scrub" type="range" min="0" max="' + ticks + '" value="0" step="1" aria-label="时间轴">',
      '<span class="zx-status"><b data-sched-status>t=0</b></span>'
    ]);
    const scrub = $('.zx-scrub', controls);
    const status = $('[data-sched-status]', controls);

    function phaseAt(t) {
      let label = '';
      phases.forEach(function (p) { if (p.at <= t) label = p.label; });
      return label;
    }

    function paint() {
      const pct = (current / ticks) * 100;
      heads.forEach(function (head) { head.style.left = pct + '%'; });
      scrub.value = current;
      const p = phaseAt(current);
      status.textContent = 't=' + current + (p ? ' · ' + p : '');
    }

    function stop() {
      playing = false;
      clearTimer(state);
      const btn = $('[data-act="play"]', controls);
      if (btn) btn.textContent = '播放';
    }

    function play() {
      if (playing) { stop(); return; }
      if (current >= ticks) current = 0;
      playing = true;
      $('[data-act="play"]', controls).textContent = '暂停';
      paint();
      state.timer = window.setInterval(function () {
        current += 1;
        if (current > ticks) { current = ticks; stop(); }
        paint();
      }, reduceMotion ? 500 : 150);
    }

    controls.addEventListener('click', function (event) {
      const btn = event.target.closest('[data-act]');
      if (!btn) return;
      if (btn.dataset.act === 'play') play();
      if (btn.dataset.act === 'reset') { stop(); current = 0; paint(); }
    });
    scrub.addEventListener('input', function () { stop(); current = Number(scrub.value); paint(); });

    paint();
    return stop;
  }

  /* =========================================================
     7. Net —— 拓扑 / 故障切换
     ========================================================= */

  function initNet(stage, controls, spec) {
    const nodes = Array.isArray(spec.nodes) ? spec.nodes : [];
    const links = Array.isArray(spec.links) ? spec.links : [];
    if (!nodes.length) return function () {};
    const byId = {};
    nodes.forEach(function (n) { byId[n.id] = n; });
    const primary = Array.isArray(spec.path) ? spec.path.slice() : [];
    const alt = Array.isArray(spec.altPath) ? spec.altPath.slice() : null;
    let activeFault = -1;
    let path = primary.slice();
    let packetIndex = 0;
    let playing = false;
    const state = { timer: null };

    function nodePos(id) {
      const n = byId[id];
      return n ? { x: n.x, y: n.y } : { x: 320, y: 160 };
    }

    function linkKey(a, b) { return [a, b].sort().join('|'); }

    function faultAffectsPath(fault, p) {
      if (!fault) return false;
      if (fault.node && p.indexOf(fault.node) >= 0) return true;
      if (Array.isArray(fault.link)) {
        const key = linkKey(fault.link[0], fault.link[1]);
        for (let i = 0; i < p.length - 1; i += 1) {
          if (linkKey(p[i], p[i + 1]) === key) return true;
        }
      }
      return false;
    }

    let svg = '<svg viewBox="0 0 640 330" role="img" aria-label="' + esc(spec.aria || '网络拓扑') + '">';
    links.forEach(function (link, i) {
      const a = nodePos(link.from);
      const b = nodePos(link.to);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      svg += '<line class="zx-link" data-link="' + i + '" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"></line>';
      if (link.label) svg += '<text class="zx-link-label" x="' + mx + '" y="' + (my - 4) + '">' + esc(link.label) + '</text>';
    });
    nodes.forEach(function (n) {
      svg += '<g class="zx-node" data-node="' + esc(n.id) + '" transform="translate(' + n.x + ',' + n.y + ')" style="cursor:pointer" tabindex="0" role="button" aria-label="' + esc(n.name) + '">' +
        '<rect class="zx-node-box" x="-52" y="-23" width="104" height="46" rx="9"></rect>' +
        '<text class="zx-node-title" x="0" y="-2">' + esc(n.name) + '</text>' +
        '<text class="zx-node-sub" x="0" y="12">' + esc(n.sub || '') + '</text>' +
      '</g>';
    });
    svg += '<circle class="zx-packet" data-packet r="4.5" cx="' + nodePos(path[0]).x + '" cy="' + nodePos(path[0]).y + '" style="opacity:0;transition:transform .55s linear"></circle>';
    svg += '</svg>';

    stage.innerHTML = '<div class="zx-net">' + svg + '</div>' +
      '<div class="zx-net-detail">点击节点查看角色；故障按钮模拟链路/节点失效。</div>' +
      (Array.isArray(spec.faults) && spec.faults.length
        ? '<div class="zx-net-faults">' + spec.faults.map(function (f, i) {
            return '<button type="button" class="zx-fault-btn" data-net-fault="' + i + '">' + esc(f.label) + '</button>';
          }).join('') + '</div>'
        : '');

    const svgEl = $('svg', stage);
    const packet = $('[data-packet]', stage);
    const detail = $('.zx-net-detail', stage);
    const faultButtons = $$('[data-net-fault]', stage);

    function currentPath() {
      if (activeFault >= 0 && faultAffectsPath(spec.faults[activeFault], primary) && alt) return alt.slice();
      return primary.slice();
    }

    function renderPath() {
      path = currentPath();
      $$('.zx-link', stage).forEach(function (line, i) {
        const link = links[i];
        const onPath = path.some(function (id, k) {
          return k < path.length - 1 && linkKey(path[k], path[k + 1]) === linkKey(link.from, link.to);
        });
        const failed = activeFault >= 0 && spec.faults[activeFault] && Array.isArray(spec.faults[activeFault].link) &&
          linkKey(spec.faults[activeFault].link[0], spec.faults[activeFault].link[1]) === linkKey(link.from, link.to);
        line.classList.toggle('is-path', onPath);
        line.classList.toggle('is-failed', failed);
      });
      $$('.zx-node', stage).forEach(function (node) {
        const failed = activeFault >= 0 && spec.faults[activeFault] && spec.faults[activeFault].node === node.dataset.node;
        node.classList.toggle('is-failed', failed);
      });
      if (path.length) {
        const p = nodePos(path[0]);
        packet.setAttribute('cx', p.x);
        packet.setAttribute('cy', p.y);
        packet.style.transform = 'translate(0px,0px)';
      }
    }

    function showFault() {
      if (activeFault < 0) {
        detail.innerHTML = '点击节点查看角色；故障按钮模拟链路/节点失效。';
        stage.classList.remove('zx-is-animating');
        return;
      }
      const fault = spec.faults[activeFault];
      const switched = faultAffectsPath(fault, primary) && alt;
      detail.innerHTML = '<b>' + esc(fault.label) + '</b> · ' + (fault.desc || '') +
        (switched ? ' <br><b>路径已切换到备用链路</b>，业务继续运行。' : '') +
        (faultAffectsPath(fault, primary) && !alt ? ' <br><b>无备用路径，业务中断。</b>' : '');
      stage.classList.toggle('zx-is-animating', Boolean(switched));
    }

    function stop() {
      playing = false;
      clearTimer(state);
      const btn = $('[data-act="play"]', controls);
      if (btn) btn.textContent = '播放数据流';
    }

    function step() {
      if (!path.length) return;
      packetIndex = (packetIndex + 1) % path.length;
      const p = nodePos(path[packetIndex]);
      packet.style.opacity = '1';
      packet.style.transform = 'translate(' + (p.x - nodePos(path[0]).x) + 'px,' + (p.y - nodePos(path[0]).y) + 'px)';
    }

    function play() {
      if (playing) { stop(); return; }
      if (!path.length) return;
      playing = true;
      packetIndex = 0;
      packet.style.opacity = '1';
      packet.style.transform = 'translate(0px,0px)';
      $('[data-act="play"]', controls).textContent = '暂停';
      state.timer = window.setInterval(step, 700);
    }

    controls.innerHTML = controlsHTML([
      '<button type="button" class="zx-btn is-primary" data-act="play">播放数据流</button>',
      '<button type="button" class="zx-btn" data-act="reset">重置</button>',
      '<span class="zx-controls-spacer"></span>',
      '<span class="zx-status">PATH <b data-net-path>' + (path.join(' → ')) + '</b></span>'
    ]);

    controls.addEventListener('click', function (event) {
      const btn = event.target.closest('[data-act]');
      if (!btn) return;
      if (btn.dataset.act === 'play') play();
      if (btn.dataset.act === 'reset') {
        stop();
        activeFault = -1;
        faultButtons.forEach(function (b) { b.classList.remove('is-on'); });
        packet.style.opacity = '0';
        renderPath();
        showFault();
        const p = $('[data-net-path]', controls);
        if (p) p.textContent = path.join(' → ');
      }
    });

    faultButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const i = Number(btn.dataset.netFault);
        activeFault = activeFault === i ? -1 : i;
        faultButtons.forEach(function (b, k) { b.classList.toggle('is-on', k === activeFault); });
        stop();
        renderPath();
        showFault();
        const p = $('[data-net-path]', controls);
        if (p) p.textContent = path.join(' → ');
      });
    });

    $$('.zx-node', stage).forEach(function (node) {
      function choose() {
        const n = byId[node.dataset.node];
        if (!n) return;
        detail.innerHTML = '<b>' + esc(n.name) + '</b> · ' + (n.desc || n.sub || '');
      }
      node.addEventListener('click', choose);
      node.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); }
      });
    });

    renderPath();
    showFault();
    return stop;
  }

  /* =========================================================
     8. Calc —— 实时计算器
     ========================================================= */

  function initCalc(stage, controls, spec) {
    const inputs = Array.isArray(spec.inputs) ? spec.inputs : [];
    const values = {};
    inputs.forEach(function (input) { values[input.id] = Number(input.value); });

    function compile(expr) {
      try {
        const names = inputs.map(function (i) { return i.id; });
        const fn = new Function(names.join(','), 'Math', 'return (' + expr + ');');
        return function (v) { return fn.apply(null, names.map(function (n) { return v[n]; }).concat([Math])); };
      } catch (error) {
        return function () { return NaN; };
      }
    }

    const computed = {};
    inputs.forEach(function (input) { computed[input.id] = compile(input.expr || '0'); });
    const primaryExpr = compile(spec.primary ? spec.primary.expr : '0');
    const outputs = (spec.outputs || []).map(function (out) {
      return Object.assign({}, out, { fn: compile(out.expr) });
    });
    const barFn = spec.bar ? compile(spec.bar.expr) : null;
    const verdictFn = spec.verdict ? compile(spec.verdict.expr) : null;

    stage.innerHTML =
      '<div class="zx-calc-grid">' +
        '<div class="zx-calc-controls">' + inputs.map(function (input, i) {
          return '<div class="zx-calc-field">' +
            '<label for="zx-calc-' + i + '"><span>' + esc(input.label) + '</span><b data-calc-value="' + input.id + '"></b></label>' +
            '<input id="zx-calc-' + i + '" type="range" min="' + input.min + '" max="' + input.max + '" step="' + (input.step || 1) + '" value="' + input.value + '" data-calc-input="' + input.id + '">' +
            (input.note ? '<small>' + esc(input.note) + '</small>' : '') +
          '</div>';
        }).join('') + '</div>' +
        '<div class="zx-calc-out">' +
          '<div class="zx-calc-primary"><span>' + esc(spec.primary ? spec.primary.label : '结果') + '</span><b data-calc-primary></b><em data-calc-primary-note></em></div>' +
          (spec.bar ? '<div class="zx-calc-bar' + (spec.bar.danger ? ' is-danger' : '') + '"><i data-calc-bar></i></div>' : '') +
          outputs.map(function (out, i) {
            return '<div class="zx-calc-row"><span>' + esc(out.label) + '</span><b data-calc-out="' + i + '"></b></div>';
          }).join('') +
          (spec.formulaText ? '<div class="zx-formula">' + esc(spec.formulaText) + '</div>' : '') +
          (spec.verdict ? '<div class="zx-calc-verdict" data-calc-verdict></div>' : '') +
        '</div>' +
      '</div>';

    const inputEls = $$('[data-calc-input]', stage);

    function computeValues() {
      const result = Object.assign({}, values);
      inputs.forEach(function (input) {
        if (input.expr) {
          const v = computed[input.id](result);
          if (isFinite(v)) result[input.id] = v;
        }
      });
      return result;
    }

    function update() {
      const v = computeValues();
      inputEls.forEach(function (input) {
        const id = input.dataset.calcInput;
        const cfg = inputs.find(function (i) { return i.id === id; });
        const val = Number(input.value);
        values[id] = val;
        const pct = (val - cfg.min) / (cfg.max - cfg.min) * 100;
        input.style.setProperty('--fill', pct + '%');
        const label = $('[data-calc-value="' + id + '"]', stage);
        if (label) label.textContent = fmtNum(val, cfg.decimals == null ? 2 : cfg.decimals) + (cfg.unit || '');
      });
      const primaryValue = primaryExpr(v);
      const primaryEl = $('[data-calc-primary]', stage);
      if (primaryEl) {
        primaryEl.innerHTML = (isFinite(primaryValue) ? fmtNum(primaryValue, spec.primary.decimals == null ? 2 : spec.primary.decimals) : '—') +
          (spec.primary.unit ? '<small> ' + esc(spec.primary.unit) + '</small>' : '');
      }
      if (spec.primary && spec.primary.note) {
        $('[data-calc-primary-note]', stage).textContent = spec.primary.note;
      }
      outputs.forEach(function (out, i) {
        const el = $('[data-calc-out="' + i + '"]', stage);
        if (!el) return;
        const value = out.fn(v);
        el.textContent = (isFinite(value) ? fmtNum(value, out.decimals == null ? 2 : out.decimals) : '—') + (out.unit ? ' ' + out.unit : '');
      });
      if (barFn) {
        const bar = $('[data-calc-bar]', stage);
        const barValue = clamp(barFn(v), 0, 100);
        if (bar) bar.style.width = barValue + '%';
      }
      if (verdictFn) {
        const verdictEl = $('[data-calc-verdict]', stage);
        const ok = Boolean(verdictFn(v));
        verdictEl.classList.toggle('is-bad', !ok);
        verdictEl.textContent = ok ? spec.verdict.good : spec.verdict.bad;
      }
    }

    inputEls.forEach(function (input) {
      input.addEventListener('input', update);
    });
    if (controls) controls.innerHTML = '';
    update();
    return function () {};
  }

  /* =========================================================
     9. Ladder —— 梯形图扫描
     ========================================================= */

  function initLadder(stage, controls, spec) {
    const rungs = Array.isArray(spec.rungs) ? spec.rungs : [];
    if (!rungs.length) return function () {};
    const vars = {};
    (spec.inputs || []).forEach(function (input) { vars[input.id] = false; });
    rungs.forEach(function (rung) {
      if (rung.coil) vars[rung.coil] = false;
      (rung.blocks || []).forEach(function (block) {
        block.forEach(function (contact) { vars[contact.var] = Boolean(vars[contact.var]); });
      });
    });
    let scanCount = 0;
    let running = false;
    const state = { timer: null };

    function contactClosed(contact) {
      const isSet = Boolean(vars[contact.var]);
      return contact.nc ? !isSet : isSet;
    }

    function rungOn(rung) {
      return (rung.blocks || []).every(function (block) {
        return block.some(contactClosed);
      });
    }

    stage.innerHTML =
      '<div class="zx-ladder-io">' + (spec.inputs || []).map(function (input) {
        return '<button type="button" class="zx-io-btn" data-io="' + esc(input.id) + '"><i></i>' + esc(input.label || input.id) + '</button>';
      }).join('') + '</div>' +
      '<div class="zx-ladder">' + rungs.map(function (rung, r) {
        return '<div class="zx-rung" data-rung="' + r + '">' +
          '<span class="zx-rail"></span>' +
          (rung.blocks || []).map(function (block, b) {
            const inner = block.map(function (contact) {
              return '<span class="zx-contact' + (contact.nc ? ' is-nc' : '') + '" data-contact="' + r + '-' + b + '-' + block.indexOf(contact) + '">' +
                '<span class="zx-contact-shape"></span>' +
                '<span class="zx-contact-label">' + esc(contact.var) + (contact.nc ? ' NC' : '') + '</span>' +
              '</span>';
            }).join('<span class="zx-wire"></span>');
            return '<span class="zx-wire"></span>' +
              (block.length > 1 ? '<span class="zx-parallel">' + inner + '</span>' : inner) +
              '<span class="zx-wire"></span>';
          }).join('') +
          '<span class="zx-coil" data-coil="' + r + '"><span class="zx-coil-shape"></span><span class="zx-coil-label">' + esc(rung.coil) + '</span></span>' +
          '<span class="zx-wire"></span><span class="zx-rail"></span>' +
        '</div>';
      }).join('') + '</div>' +
      '<div class="zx-ladder-status"><span>SCAN <b data-scan>0</b></span><span data-varline></span></div>';

    const ioButtons = $$('[data-io]', stage);

    function paint() {
      rungs.forEach(function (rung, r) {
        const on = rungOn(rung);
        const row = $('[data-rung="' + r + '"]', stage);
        if (row) row.classList.toggle('is-live', on);
        const coil = $('[data-coil="' + r + '"]', stage);
        if (coil) coil.classList.toggle('is-on', Boolean(vars[rung.coil]));
        (rung.blocks || []).forEach(function (block, b) {
          block.forEach(function (contact, c) {
            const el = $('[data-contact="' + r + '-' + b + '-' + c + '"]', stage);
            if (el) {
              el.classList.toggle('is-closed', contactClosed(contact));
              el.classList.toggle('is-on', Boolean(vars[contact.var]));
            }
          });
        });
      });
      ioButtons.forEach(function (btn) {
        const id = btn.dataset.io;
        btn.classList.toggle('is-on', Boolean(vars[id]));
      });
      const scanEl = $('[data-scan]', stage);
      if (scanEl) scanEl.textContent = scanCount;
      const varline = $('[data-varline]', stage);
      if (varline) {
        varline.textContent = Object.keys(vars).map(function (k) { return k + '=' + (vars[k] ? 1 : 0); }).join('  ');
      }
    }

    function scan() {
      const next = {};
      rungs.forEach(function (rung) {
        next[rung.coil] = (next[rung.coil] || false) || rungOn(rung);
      });
      Object.keys(next).forEach(function (k) {
        if (k in vars) vars[k] = next[k];
      });
      scanCount += 1;
      paint();
    }

    function stop() {
      running = false;
      clearTimer(state);
      const btn = $('[data-act="run"]', controls);
      if (btn) btn.textContent = '连续扫描';
    }

    function run() {
      if (running) { stop(); return; }
      running = true;
      $('[data-act="run"]', controls).textContent = '暂停扫描';
      scan();
      state.timer = window.setInterval(scan, 750);
    }

    controls.innerHTML = controlsHTML([
      '<button type="button" class="zx-btn is-primary" data-act="run">连续扫描</button>',
      '<button type="button" class="zx-btn" data-act="scan">单次扫描</button>',
      '<button type="button" class="zx-btn" data-act="reset">复位</button>',
      '<span class="zx-controls-spacer"></span>',
      '<span class="zx-status">扫描周期 <b>' + (spec.cycle || '2 ms') + '</b></span>'
    ]);

    ioButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.dataset.io;
        vars[id] = !vars[id];
        paint();
        if (!running) scan();
      });
    });

    controls.addEventListener('click', function (event) {
      const btn = event.target.closest('[data-act]');
      if (!btn) return;
      if (btn.dataset.act === 'run') run();
      if (btn.dataset.act === 'scan') { stop(); scan(); }
      if (btn.dataset.act === 'reset') {
        stop();
        Object.keys(vars).forEach(function (k) { vars[k] = false; });
        scanCount = 0;
        paint();
      }
    });

    paint();
    return stop;
  }

  /* =========================================================
     10. Frame —— 协议帧 / 字节布局
     ========================================================= */

  function initFrame(stage, controls, spec) {
    const bytes = Array.isArray(spec.bytes) ? spec.bytes : [];
    const fields = Array.isArray(spec.fields) ? spec.fields : [];
    if (!bytes.length) return function () {};
    let selected = 0;
    let activeField = -1;
    const colors = fields.map(function (f, i) { return f.color || PALETTE[i % PALETTE.length]; });

    function byteValue(b) {
      if (b && b.value != null) return b.value & 0xFF;
      const raw = String(b && b.hex != null ? b.hex : '00').replace(/0x/i, '');
      const n = parseInt(raw, 16);
      return isFinite(n) ? n & 0xFF : 0;
    }

    stage.innerHTML =
      '<div class="zx-frame-head"><b>' + esc(spec.title || 'FRAME') + '</b><span>' + bytes.length + ' bytes · 点击字节查看含义</span></div>' +
      '<div class="zx-frame-fields">' + fields.map(function (f, i) {
        return '<button type="button" class="zx-frame-field" data-frame-field="' + i + '" style="--field-color:' + colors[i] + '">' + esc(f.name) + ' · B' + f.from + (f.to !== f.from ? '–B' + f.to : '') + '</button>';
      }).join('') + '</div>' +
      '<div class="zx-frame-bytes">' + bytes.map(function (b, i) {
        const value = byteValue(b);
        const bits = value.toString(2).padStart(8, '0');
        return '<button type="button" class="zx-frame-byte" data-frame-byte="' + i + '">' +
          '<span class="zx-fb-index">B' + i + '</span>' +
          '<span class="zx-fb-hex">' + value.toString(16).toUpperCase().padStart(2, '0') + '</span>' +
          '<span class="zx-fb-bits">' + bits.split('').map(function (bit) { return '<i class="' + (bit === '1' ? 'on' : '') + '">' + bit + '</i>'; }).join('') + '</span>' +
          (spec.ascii ? '<span class="zx-fb-ascii">' + (value >= 32 && value <= 126 ? esc(String.fromCharCode(value)) : '·') + '</span>' : '') +
        '</button>';
      }).join('') + '</div>' +
      '<div class="zx-frame-info"><div class="zx-frame-info-main"></div><div class="zx-frame-info-sub"></div></div>';

    const byteEls = $$('[data-frame-byte]', stage);
    const fieldEls = $$('[data-frame-field]', stage);
    const infoMain = $('.zx-frame-info-main', stage);
    const infoSub = $('.zx-frame-info-sub', stage);

    function fieldOfByte(i) {
      return fields.findIndex(function (f) { return i >= f.from && i <= f.to; });
    }

    function renderInfo() {
      const b = bytes[selected] || {};
      const value = byteValue(b);
      const fIndex = fieldOfByte(selected);
      infoMain.innerHTML = '<b>B' + selected + '</b> = 0x' + value.toString(16).toUpperCase().padStart(2, '0') +
        ' · ' + (b.label ? esc(b.label) : '') +
        (fIndex >= 0 ? ' <span style="color:' + colors[fIndex] + '">[' + esc(fields[fIndex].name) + ']</span>' : '');
      if (activeField >= 0) {
        const f = fields[activeField];
        infoSub.innerHTML = '<b>' + esc(f.name) + '</b> · ' + (f.desc || '');
      } else {
        infoSub.innerHTML = (b.desc ? b.desc : '点击下方字段条查看各字段职责。') +
          (spec.endian ? ' <span style="color:#64748b">字节序：' + esc(spec.endian) + '</span>' : '');
      }
    }

    function paint() {
      byteEls.forEach(function (el, i) {
        const f = fieldOfByte(i);
        el.classList.toggle('is-active', i === selected);
        el.classList.toggle('is-field', activeField >= 0 && f === activeField);
        el.classList.toggle('is-dim', activeField >= 0 && f !== activeField);
        el.style.setProperty('--field-color', f >= 0 ? colors[f] : 'transparent');
        el.style.borderTopColor = f >= 0 ? colors[f] : '';
      });
      fieldEls.forEach(function (el, i) {
        el.classList.toggle('is-active', i === activeField);
        el.style.setProperty('--field-color', colors[i]);
      });
      renderInfo();
      const status = $('[data-frame-status]', controls);
      if (status) status.textContent = 'B' + selected + ' / ' + bytes.length;
    }

    controls.innerHTML = controlsHTML([
      '<button type="button" class="zx-btn" data-act="prev" aria-label="上一字节">←</button>',
      '<button type="button" class="zx-btn" data-act="next" aria-label="下一字节">→</button>',
      '<button type="button" class="zx-btn" data-act="clear">取消字段选中</button>',
      '<span class="zx-controls-spacer"></span>',
      '<span class="zx-status">BYTE <b data-frame-status></b></span>'
    ]);

    byteEls.forEach(function (el) {
      el.addEventListener('click', function () {
        selected = Number(el.dataset.frameByte);
        activeField = -1;
        paint();
      });
    });
    fieldEls.forEach(function (el) {
      el.addEventListener('click', function () {
        const i = Number(el.dataset.frameField);
        activeField = activeField === i ? -1 : i;
        if (activeField >= 0) selected = fields[activeField].from;
        paint();
      });
    });
    controls.addEventListener('click', function (event) {
      const btn = event.target.closest('[data-act]');
      if (!btn) return;
      if (btn.dataset.act === 'prev') selected = clamp(selected - 1, 0, bytes.length - 1);
      if (btn.dataset.act === 'next') selected = clamp(selected + 1, 0, bytes.length - 1);
      if (btn.dataset.act === 'clear') activeField = -1;
      paint();
    });

    paint();
    return function () {};
  }

  /* =========================================================
     渲染：章节 → 互动区
     ========================================================= */

  const ENGINES = {
    experiment: function(stage, controls, spec) {
      return window.ZynqWorkbench.mount(stage, controls, spec);
    },
    flow: initFlow,
    wave: initWave,
    fsm: initFsm,
    map: initMap,
    bits: initBits,
    sched: initSched,
    net: initNet,
    calc: initCalc,
    ladder: initLadder,
    frame: initFrame
  };

  function widgetHTML(data) {
    const widget = data.widget;
    const hasViews = widget && Array.isArray(widget.views) && widget.views.length;
    return '<div class="zx-widget">' +
      '<div class="zx-widget-top"><div class="zx-widget-title">' +
        '<span class="zx-kicker">Interactive Lab</span>' +
        '<h3>' + esc(widget.title || '互动演示') + '</h3>' +
        (widget.sub ? '<p>' + esc(widget.sub) + '</p>' : '') +
      '</div></div>' +
      (hasViews ? '<div class="zx-view-tabs" role="tablist">' + widget.views.map(function (view, i) {
        return '<button type="button" class="zx-view-tab" role="tab" id="zx-tab-' + i + '" aria-selected="' + (i === 0 ? 'true' : 'false') + '" data-view="' + i + '">' + esc(view.label) + '</button>';
      }).join('') + '</div>' : '') +
      '<div class="zx-stage" data-stage></div>' +
      '<div class="zx-controls" data-controls></div>' +
      '<div class="zx-note" data-note>' + noteHTML(widget.note || '') + '</div>' +
    '</div>';
  }

  function initWidget(host, data) {
    const widget = data.widget;
    if (!widget) return;
    const stage = $('[data-stage]', host);
    const controls = $('[data-controls]', host);
    const note = $('[data-note]', host);
    const tabs = $$('.zx-view-tab', host);
    let cleanup = null;

    function mount(spec) {
      if (typeof cleanup === 'function') cleanup();
      cleanup = null;
      stage.innerHTML = '';
      controls.innerHTML = '';
      controls.style.display = '';
      const engine = ENGINES[spec.type];
      if (!engine) {
        stage.innerHTML = '<p style="color:#93a4bd;font-size:12px">该互动组件暂不可用。</p>';
        return;
      }
      cleanup = engine(stage, controls, spec);
      if (!controls.innerHTML.trim()) controls.style.display = 'none';
      note.innerHTML = noteHTML(spec.note || widget.note || '');
    }

    if (widget.views && widget.views.length) {
      tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
          tabs.forEach(function (t) { t.setAttribute('aria-selected', 'false'); });
          tab.setAttribute('aria-selected', 'true');
          mount(widget.views[Number(tab.dataset.view)]);
        });
      });
      mount(widget.views[0]);
    } else {
      mount(widget);
    }
  }

  function quizHTML(quiz) {
    return '<div class="zx-quiz">' +
      '<div class="zx-quiz-head"><div><h3>知识快检 · 当场验证</h3><p>选一个答案立即看解析；答错不扣分，但请回到上文找到依据。</p></div>' +
      '<div class="zx-score">得分 <b data-score>0</b><span>/ ' + quiz.length + '</span></div></div>' +
      '<div class="zx-quiz-list">' + quiz.map(function (q, qi) {
        return '<div class="zx-q" data-q="' + qi + '">' +
          '<div class="zx-q-title"><span>' + (qi + 1) + '</span><div>' + esc(q.q) + '</div></div>' +
          '<div class="zx-opts">' + q.options.map(function (opt, oi) {
            return '<button type="button" class="zx-opt" data-opt="' + oi + '"><i>' + String.fromCharCode(65 + oi) + '</i><span>' + esc(opt) + '</span></button>';
          }).join('') + '</div>' +
          '<div class="zx-exp" hidden>' + esc(q.exp || '') + '</div>' +
        '</div>';
      }).join('') + '</div>' +
    '</div>';
  }

  function initQuiz(root, quiz) {
    const storageKey = 'zynq_quiz_v2_' + root.dataset.zxChapter;
    let answers = [];
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (Array.isArray(saved)) answers = saved.slice(0, quiz.length);
    } catch (_) {}
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'zx-btn learning-reset';
    reset.textContent = '重新作答本章测验';
    $('.zx-quiz', root).appendChild(reset);
    function save() {
      try { localStorage.setItem(storageKey, JSON.stringify(answers)); } catch (_) {}
    }
    function score() {
      const correct = quiz.filter(function (q, i) { return answers[i] === q.answer; }).length;
      const scoreEl = $('[data-score]', root);
      if (scoreEl) scoreEl.textContent = correct;
    }
    const painters = [];
    $$('.zx-q', root).forEach(function (qEl, qi) {
      const q = quiz[qi];
      const opts = $$('.zx-opt', qEl);
      const exp = $('.zx-exp', qEl);
      function paint() {
        const chosen = answers[qi];
        const done = Number.isInteger(chosen) && chosen >= 0 && chosen < opts.length;
        opts.forEach(function (o, k) {
          o.disabled = done;
          o.classList.toggle('is-correct', done && k === q.answer);
          o.classList.toggle('is-wrong', done && k === chosen && k !== q.answer);
        });
        exp.hidden = !done;
        exp.setAttribute('role', 'status');
        if (done) exp.textContent = (chosen === q.answer ? '正确。' : '正确答案是 ' + String.fromCharCode(65 + q.answer) + '。') + (q.exp || '') + ' 完成相关实验后可重新作答。';
      }
      painters.push(paint);
      opts.forEach(function (opt, oi) { opt.addEventListener('click', function () {
        answers[qi] = oi; save(); paint(); score();
      }); });
      paint();
    });
    reset.addEventListener('click', function () { answers = []; save(); painters.forEach(function (paint) { paint(); }); score(); $('.zx-opt', root).focus(); });
    score();
  }

  function caseHTML(data) {
    const c = data.case;
    if (!c) return '';
    return '<aside class="zx-case">' +
      '<div class="zx-case-top">' + esc(c.tag || '工程现场 · Field Case') + '</div>' +
      '<h3>' + esc(c.title) + '</h3>' +
      (c.sourceNote ? '<p class="zx-case-source">' + esc(c.sourceNote) + (c.source ? ' <a href="' + esc(c.source[1]) + '" target="_blank" rel="noopener">来源：' + esc(c.source[0]) + '</a>' : '') + '</p>' : '') +
      '<p class="zx-case-scene">' + c.scene + '</p>' +
      (Array.isArray(c.metrics) && c.metrics.length ? '<div class="zx-case-metrics">' + c.metrics.map(function (m) { return '<span>' + esc(m) + '</span>'; }).join('') + '</div>' : '') +
      '<div class="zx-case-body"><h4>本章知识在现场怎么用</h4><ul>' + (c.points || []).map(function (p) { return '<li>' + p + '</li>'; }).join('') + '</ul></div>' +
      (c.ask ? '<div class="zx-case-ask"><span>现场追问</span><p>' + c.ask + '</p></div>' : '') +
    '</aside>';
  }

  function render(root) {
    const key = root.dataset.zxChapter;
    const data = LABS[key];
    if (!data) {
      root.hidden = true;
      return;
    }
    const title = data.title || '互动实验室';
    const lead = data.lead || '';
    let html = '<div class="section-head"><div class="section-index">LAB</div><div>' +
      '<h2 id="zx-lab-title">' + esc(title) + '</h2>' +
      (lead ? '<p class="zx-lead">' + lead + '</p>' : '') +
      '</div></div>';

    const hasWidget = data.widget && (data.widget.type || (data.widget.views && data.widget.views.length));
    if (hasWidget) {
      html += '<div class="zx-workbench">' + widgetHTML(data) + caseHTML(data) + '</div>';
    } else if (data.case) {
      html += '<div class="zx-workbench" style="grid-template-columns:1fr">' + caseHTML(data) + '</div>';
    }
    if (Array.isArray(data.quiz) && data.quiz.length) html += quizHTML(data.quiz);
    root.innerHTML = html;
    root.setAttribute('aria-labelledby', 'zx-lab-title');

    if (hasWidget) initWidget($('.zx-widget', root), data);
    if (Array.isArray(data.quiz) && data.quiz.length) initQuiz(root, data.quiz);
    if (window.ZynqLearning) window.ZynqLearning.render(root, data, key);
  }

  function boot() {
    $$('[data-zx-chapter]').forEach(render);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
