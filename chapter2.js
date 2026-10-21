(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
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
      /* localStorage is unavailable on some file:// setups */
    }
  }

  function setText(el, text) {
    if (el) el.textContent = text;
  }

  function setHTML(el, html) {
    if (el) el.innerHTML = html;
  }

  function fmt(value) {
    return Number(value).toLocaleString('en-US');
  }

  /* ---------------- shell ---------------- */

  const progressEl = $('.scroll-progress');

  function updateScrollProgress() {
    if (!progressEl) return;
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const current = window.scrollY || doc.scrollTop || 0;
    const pct = max > 0 ? Math.min(100, Math.max(0, (current / max) * 100)) : 0;
    progressEl.style.width = pct.toFixed(2) + '%';
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
      { threshold: 0.08, rootMargin: '0px 0px -4% 0px' }
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
      setTimeout(() => {
        button.textContent = old;
      }, 1400);
    });
  });

  /* ---------------- 01 device ladder ---------------- */

  const devices = {
    '7010': {
      name: 'Z-7010',
      kicker: 'XC7Z010 · 入门档',
      note: '适合小规模逻辑与入门实验。资源不多，但足够跑通纯 FPGA、基础 AXI 与轻量控制。',
      lut: 17600,
      bram: 60,
      dsp: 80
    },
    '7020': {
      name: 'Z-7020',
      kicker: 'XC7Z020 · 黄金档',
      note: '教学、竞赛与工业小批量产品的主流选择。软 PLC 的全部自定义逻辑通常只占它不到 10% 的 LUT。',
      lut: 53200,
      bram: 140,
      dsp: 220
    },
    '7030': {
      name: 'Z-7030',
      kicker: 'XC7Z030 · 进阶档',
      note: '为更复杂的算法与更多并行通道留出余量。PS 仍然是同一套双核 A9，差异全部在 PL。',
      lut: 78400,
      bram: 265,
      dsp: 400
    },
    '7045': {
      name: 'Z-7045',
      kicker: 'XC7Z045 · 高端档',
      note: '大容量 PL，适合高并行、多接口与较重的图像/信号处理。对入门项目来说通常资源过剩。',
      lut: 218600,
      bram: 545,
      dsp: 900
    }
  };

  const familyMax = { lut: 218600, bram: 545, dsp: 900 };
  const familyButtons = $$('[data-device]');

  function updateFamily(key) {
    const data = devices[key];
    if (!data) return;
    familyButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.device === key);
    });
    setText($('#familyHint'), '当前：' + data.name);
    setText($('#familyKicker'), data.kicker);
    setText($('#familyName'), data.name);
    setText($('#familyNote'), data.note);
    setText($('#capLutText'), fmt(data.lut));
    setText($('#capBramText'), fmt(data.bram));
    setText($('#capDspText'), fmt(data.dsp));
    const lutBar = $('#capLut');
    const bramBar = $('#capBram');
    const dspBar = $('#capDsp');
    if (lutBar) lutBar.style.width = ((data.lut / familyMax.lut) * 100).toFixed(1) + '%';
    if (bramBar) bramBar.style.width = ((data.bram / familyMax.bram) * 100).toFixed(1) + '%';
    if (dspBar) dspBar.style.width = ((data.dsp / familyMax.dsp) * 100).toFixed(1) + '%';
  }

  if (familyButtons.length) {
    familyButtons.forEach((button) => {
      button.addEventListener('click', () => updateFamily(button.dataset.device));
    });
    updateFamily('7020');
  }

  /* ---------------- 02 architecture map ---------------- */

  const archNodes = {
    apu: {
      badge: 'PS · 应用处理单元',
      title: 'APU：跑软件的那一半',
      text: '双核 Cortex-A9、NEON/FPU 与 512KB L2 缓存，负责 Linux、协议栈、界面和上层业务。它是「智能」的一端。',
      tags: ['Linux', '协议栈', '非实时']
    },
    ddr: {
      badge: 'PS · 存储系统',
      title: 'DDR 控制器：唯一的物理内存入口',
      text: '板载 1GB DDR3 由 PS 的 DDR 控制器统一管理。PL 不能绕过它直接访问内存条，常用 S_AXI_HP，也可依据事务与配置通过 ACP/S_AXI_GP 等路径访问。',
      tags: ['DDR3', '1GB', '共享带宽']
    },
    ocm: {
      badge: 'PS · 片上存储',
      title: 'OCM：256KB 的片上存储区',
      text: '不经过 DDR 控制器的片上 SRAM，延迟低且确定。FSBL、启动早期代码和实时热代码常放在这里。',
      tags: ['256KB', '低延迟', 'FSBL']
    },
    iop: {
      badge: 'PS · I/O 外设',
      title: 'IOP / MIO：外设与引脚的交换机',
      text: 'UART、GPIO、SPI、I2C、CAN、SDIO、USB、GEM 等外设通过 54 根 MIO 复用引出。引脚不够时，可用 EMIO 借道 PL。',
      tags: ['54 MIO', 'EMIO', '外设复用']
    },
    ip: {
      badge: 'PL · 自定义逻辑',
      title: '自定义 IP：把需求变成电路',
      text: '一个 AXI-Lite 从接口加状态机，就能成为 PLC 的 IO 引擎、PWM 发生器或协议加速器。它是 PS 与真实 IO 之间的执行层。',
      tags: ['AXI-Lite', '状态机', 'PLC IO']
    },
    lut: {
      badge: 'PL · 逻辑资源',
      title: 'LUT / FF：组合与时序的基本积木',
      text: 'LUT6 实现任意 6 输入组合逻辑，触发器在时钟沿保存 1 bit 状态。53,200 个 LUT 与 106,400 个 FF 是 7020 的逻辑上限。',
      tags: ['53,200 LUT', '106,400 FF', '并行']
    },
    bram: {
      badge: 'PL · 块存储',
      title: 'BRAM：PL 自己的小内存',
      text: '140 块 36Kb 双口存储，合计约 4.9Mb。适合 FIFO、行缓存、查找表和跨时钟域缓冲，不占用 DDR 带宽。',
      tags: ['140 块', '4.9Mb', 'FIFO']
    },
    dsp: {
      badge: 'PL · 运算硬核',
      title: 'DSP48E1：乘加专用通道',
      text: '220 个 25×18 乘加硬核。FIR、矩阵、坐标变换用它比用 LUT 拼乘法器更省资源，也更容易跑到高频。',
      tags: ['220 个', 'FIR', '乘加']
    },
    xadc: {
      badge: 'PL · 模拟接口',
      title: 'XADC：片内模拟与温度监测',
      text: '双通道 12bit、1MSPS，可测片内电压和温度，也能接外部模拟输入。PLC 的模拟量采集可以从这里起步。',
      tags: ['12bit', '1MSPS', '模拟量']
    }
  };

  const archScenarios = {
    config: {
      label: '控制路径',
      channel: 'gp',
      nodes: ['apu', 'ip'],
      title: 'APU → M_AXI_GP → 自定义 IP',
      text: 'CPU 把周期、占空比、使能位写进 PL 的 AXI-Lite 寄存器。数据量很小，但要求随机访问和确定性响应，所以走 GP 端口。',
      tags: ['M_AXI_GP', 'AXI-Lite', '寄存器访问']
    },
    stream: {
      label: '数据路径',
      channel: 'hp',
      nodes: ['xadc', 'bram', 'ddr'],
      title: 'XADC / IP → BRAM → S_AXI_HP → DDR',
      text: '采样数据先在 PL 内做 FIFO/BRAM 缓冲，再由 DMA 经 S_AXI_HP 成批写入 DDR。CPU 只负责配置 DMA 和处理完成事件，不逐笔搬运。',
      tags: ['S_AXI_HP', 'DMA', '高带宽']
    },
    coherent: {
      label: '缓存一致路径',
      channel: 'acp',
      nodes: ['ip', 'apu'],
      title: '自定义 IP → S_AXI_ACP → L2 / APU',
      text: 'ACP 让 PL 的访问与 CPU 缓存保持一致，适合小数据、低延迟的共享状态表。它不解决大带宽搬运问题，别拿它替代 HP+DMA。',
      tags: ['S_AXI_ACP', '缓存一致', '小数据']
    },
    event: {
      label: '事件路径',
      channel: 'irq',
      nodes: ['ip', 'apu'],
      title: '自定义 IP → IRQ_F2P → GIC → APU',
      text: '中断只负责「通知」，不负责搬数据。PL 检测到急停、采样完成或故障后拉高中断，CPU 进入 ISR 再通过 AXI 读取详细状态。',
      tags: ['IRQ_F2P', 'GIC', '事件通知']
    }
  };

  const archStage = $('#archStage');
  const archDetail = $('#archDetail');
  const archStatus = $('#archStatus');
  const archScenarioButtons = $$('[data-scenario]');

  function clearArchMarks() {
    $$('.arch-node', archStage || document).forEach((node) => node.classList.remove('is-active', 'pulse'));
    $$('.axi-channel', archStage || document).forEach((channel) => channel.classList.remove('is-lit'));
    archScenarioButtons.forEach((button) => button.classList.remove('active'));
  }

  function showArchNode(key) {
    const data = archNodes[key];
    if (!data || !archDetail) return;
    clearArchMarks();
    const node = $('[data-node="' + key + '"]', archStage || document);
    if (node) node.classList.add('is-active', 'pulse');
    archDetail.classList.remove('is-scenario');
    setText($('#archDetailBadge'), data.badge);
    setText($('#archDetailTitle'), data.title);
    setText($('#archDetailText'), data.text);
    setHTML($('#archDetailTags'), data.tags.map((tag) => '<span>' + tag + '</span>').join(''));
    setText(archStatus, data.title.split('：')[0]);
  }

  function showArchScenario(key) {
    const data = archScenarios[key];
    if (!data || !archDetail) return;
    clearArchMarks();
    const button = $('[data-scenario="' + key + '"]');
    if (button) button.classList.add('active');
    data.nodes.forEach((nodeKey) => {
      const node = $('[data-node="' + nodeKey + '"]', archStage || document);
      if (node) node.classList.add('is-active');
    });
    const channel = $('[data-channel="' + data.channel + '"]', archStage || document);
    if (channel) channel.classList.add('is-lit');
    archDetail.classList.add('is-scenario');
    setText($('#archDetailBadge'), data.label);
    setText($('#archDetailTitle'), data.title);
    setText($('#archDetailText'), data.text);
    setHTML($('#archDetailTags'), data.tags.map((tag) => '<span>' + tag + '</span>').join(''));
    setText(archStatus, data.label);
  }

  if (archStage) {
    $$('.arch-node', archStage).forEach((node) => {
      node.addEventListener('click', () => showArchNode(node.dataset.node));
    });
    archScenarioButtons.forEach((button) => {
      button.addEventListener('click', () => showArchScenario(button.dataset.scenario));
    });
    const archReset = $('#archReset');
    if (archReset) {
      archReset.addEventListener('click', () => {
        clearArchMarks();
        archDetail.classList.remove('is-scenario');
        setText($('#archDetailBadge'), 'PS · 应用处理单元');
        setText($('#archDetailTitle'), 'APU：跑软件的那一半');
        setText($('#archDetailText'), archNodes.apu.text);
        setHTML($('#archDetailTags'), archNodes.apu.tags.map((tag) => '<span>' + tag + '</span>').join(''));
        setText(archStatus, '等待选择');
      });
    }
  }

  /* ---------------- 03 PS tabs ---------------- */

  const psData = {
    apu: {
      status: 'APU · 应用处理',
      kicker: 'Application Processing Unit',
      title: '双核 Cortex-A9：Linux 的落脚点',
      text: '每核带 NEON SIMD 与 VFP 浮点单元，32KB L1 指令/数据缓存，两核共享 512KB L2 与 SCU 一致性单元。领航者板卡上的 -2 速度等级最高 767MHz，跑无桌面 Linux 非常从容。',
      points: [
        '双核共享 L2，是 SMP Linux 的基础',
        'NEON 加速图像、滤波与批量数据处理',
        '每核私有定时器与看门狗，另有全局定时器'
      ],
      metrics: [
        ['2×', 'Cortex-A9'],
        ['512KB', '共享 L2'],
        ['767MHz', '-2 速度等级']
      ]
    },
    ddr: {
      status: 'DDR · 主内存',
      kicker: 'DDR Memory Controller',
      title: 'DDR 控制器：所有大块数据的归宿',
      text: 'PS 的 DDR 控制器支持 DDR3/DDR3L/DDR2/LPDDR2，16/32 位总线。领航者板载 1GB DDR3（32bit）。PL 没有独立的 DDR 引脚，所有访问都要经过这个控制器。',
      points: [
        'Linux 内核、应用和文件缓存都在这里',
        'PL 通过 S_AXI_HP 访问，通常配合 DMA',
        '多主设备共享带宽，仲裁延迟要纳入设计'
      ],
      metrics: [
        ['1GB', '板载 DDR3'],
        ['32bit', '数据位宽'],
        ['统一', 'PL / PS 共享']
      ]
    },
    ocm: {
      status: 'OCM · 片上 RAM',
      kicker: 'On-Chip Memory',
      title: 'OCM：256KB 的确定性存储',
      text: 'OCM 是片上 SRAM，不经过 DDR 控制器，访问延迟低且可预测。它常被 FSBL、启动早期代码、异常向量和实时热代码使用；容量只有 256KB，不能当主内存。',
      points: [
        '低延迟、无 DDR 仲裁抖动',
        '常见高地址映射 0xFFFC0000',
        '低端还有别名映射，启动阶段要特别小心'
      ],
      metrics: [
        ['256KB', '总容量'],
        ['0xFFFC0000', '高地址映射'],
        ['片上 SRAM', '相对 DDR']
      ]
    },
    iop: {
      status: 'IOP · 外设与 MIO',
      kicker: 'I/O Peripherals & MIO',
      title: 'IOP / MIO：54 根引脚的外设交换机',
      text: 'UART、GPIO、SPI、I2C、CAN、SDIO、USB、GEM 等 PS 外设通过 54 根 MIO 复用引出。每个外设可路由到多组候选引脚，由 SLCR 寄存器选择。引脚不够时，可用 EMIO 借道 PL。',
      points: [
        'MIO 是 PS 外设到芯片引脚的复用网络',
        'EMIO 把 PS 外设信号送进 PL，再由 PL 引脚输出',
        'GPIO = 0xE000A000，UART1 = 0xE0001000'
      ],
      metrics: [
        ['54', 'MIO 引脚'],
        ['EMIO', '借道 PL'],
        ['2×', 'UART']
      ]
    }
  };

  const psPanel = $('#psPanel');
  const psTabButtons = $$('[data-ps]');

  function showPs(key) {
    const data = psData[key];
    if (!data || !psPanel) return;
    psTabButtons.forEach((button) => {
      const on = button.dataset.ps === key;
      button.classList.toggle('active', on);
      button.setAttribute('aria-selected', String(on));
      if (on) psPanel.setAttribute('aria-labelledby', button.id);
    });
    setText($('#psStatus'), data.status);
    setText($('#psKicker'), data.kicker);
    setText($('#psPanelTitle'), data.title);
    setText($('#psPanelText'), data.text);
    setHTML($('#psPoints'), data.points.map((point) => '<li>' + point + '</li>').join(''));
    setHTML(
      $('#psMetrics'),
      data.metrics
        .map((metric) => '<div><b>' + metric[0] + '</b><span>' + metric[1] + '</span></div>')
        .join('')
    );
  }

  if (psPanel && psTabButtons.length) {
    psTabButtons.forEach((button) => {
      button.addEventListener('click', () => showPs(button.dataset.ps));
    });
    showPs('apu');
  }

  /* ---------------- 04 PL budget ---------------- */

  const budgetInputs = $$('input[data-lut]');
  const budgetTotals = { lut: 53200, bram: 140, dsp: 220 };

  function setBarClass(el, pct) {
    if (!el) return;
    el.classList.toggle('is-warn', pct >= 70 && pct < 100);
    el.classList.toggle('is-danger', pct >= 100);
  }

  function updateBudget(customNote) {
    if (!budgetInputs.length) return;
    let lut = 0;
    let bram = 0;
    let dsp = 0;
    budgetInputs.forEach((input) => {
      const item = input.closest('.budget-item');
      if (item) item.classList.toggle('checked', input.checked);
      if (!input.checked) return;
      lut += Number(input.dataset.lut) || 0;
      bram += Number(input.dataset.bram) || 0;
      dsp += Number(input.dataset.dsp) || 0;
    });

    const lutPct = (lut / budgetTotals.lut) * 100;
    const bramPct = (bram / budgetTotals.bram) * 100;
    const dspPct = (dsp / budgetTotals.dsp) * 100;

    setText($('#budgetLutText'), fmt(lut) + ' / ' + fmt(budgetTotals.lut));
    setText($('#budgetBramText'), fmt(bram) + ' / ' + fmt(budgetTotals.bram));
    setText($('#budgetDspText'), fmt(dsp) + ' / ' + fmt(budgetTotals.dsp));

    const lutFill = $('#budgetLutFill');
    const bramFill = $('#budgetBramFill');
    const dspFill = $('#budgetDspFill');
    if (lutFill) lutFill.style.width = Math.min(100, lutPct).toFixed(1) + '%';
    if (bramFill) bramFill.style.width = Math.min(100, bramPct).toFixed(1) + '%';
    if (dspFill) dspFill.style.width = Math.min(100, dspPct).toFixed(1) + '%';
    setBarClass(lutFill, lutPct);
    setBarClass(bramFill, bramPct);
    setBarClass(dspFill, dspPct);

    const max = Math.max(lutPct, bramPct, dspPct);
    const status = $('#budgetStatus');
    if (max >= 100) {
      setText(status, '已超出资源上限');
    } else if (max >= 70) {
      setText(status, '资源开始吃紧');
    } else {
      setText(status, 'LUT 余量充足');
    }

    let note = customNote;
    if (!note) {
      if (max >= 100) {
        note = '已经超出 7020 的资源上限。先降低并行度、复用乘法器、减少缓存，再考虑换更大器件。';
      } else if (max >= 70) {
        note = '已经接近某一类资源的 70%。综合报告和布局布线可能开始吃紧，应检查时序与拥塞。';
      } else {
        note = '当前占用约 ' + lutPct.toFixed(1) + '% 的 LUT、' + bramPct.toFixed(1) + '% 的 BRAM、' +
          dspPct.toFixed(1) + '% 的 DSP。真正的瓶颈往往在 IO、时钟和布线，而不是容量。';
      }
    }
    setText($('#budgetNote'), note);
  }

  if (budgetInputs.length) {
    budgetInputs.forEach((input) => input.addEventListener('change', () => updateBudget()));
    $$('[data-preset]').forEach((button) => {
      button.addEventListener('click', () => {
        const preset = button.dataset.preset;
        let checked = [];
        let note = '';
        if (preset === 'plc') {
          checked = [0, 1, 2];
          note = '最小 PLC IO 引擎：AXI-Lite 控制口、16 路 DI 消抖、8 路 PWM。约 1,900 LUT，余量非常充足。';
        } else if (preset === 'vision') {
          checked = [0, 3, 5, 6];
          note = '视频预处理组合：控制口、BRAM FIFO、1080p 行缓存与 Sobel。逻辑仍不多，但 BRAM 与带宽开始成为重点。';
        }
        budgetInputs.forEach((input, index) => {
          input.checked = checked.includes(index);
        });
        updateBudget(note);
      });
    });
    updateBudget();
  }

  /* ---------------- 05 AXI chooser ---------------- */

  const axiData = [
    {
      q: 'CPU 要修改 PL 中 PWM 模块的周期和使能位，应该走哪条通道？',
      prompt: '这是典型的「少量、随机、寄存器式」访问。',
      answer: 'gp',
      options: [
        ['gp', 'M_AXI_GP · AXI-Lite'],
        ['hp', 'S_AXI_HP · 高速数据'],
        ['acp', 'S_AXI_ACP · 缓存一致'],
        ['irq', 'IRQ_F2P · 中断']
      ],
      explain: '控制类寄存器访问走 M_AXI_GP，通常把自定义 IP 做成 AXI-Lite 从接口。HP 面向大块数据，IRQ 只传事件。'
    },
    {
      q: '4 通道 ADC 连续采样，需要把数据成批搬进 DDR。最佳路径是什么？',
      prompt: '采样率高、数据连续，不能靠 CPU 一笔一笔搬。',
      answer: 'hp',
      options: [
        ['gp', 'M_AXI_GP · AXI-Lite'],
        ['hp', 'S_AXI_HP + DMA'],
        ['acp', 'S_AXI_ACP'],
        ['irq', 'IRQ_F2P']
      ],
      explain: 'PL 先把数据缓存在 BRAM/FIFO，再由 DMA 经 S_AXI_HP 写入 DDR。这样 CPU 只处理缓冲区和完成事件，吞吐和实时性都更好。'
    },
    {
      q: 'PL 需要读写一小块会被 CPU 缓存的共享状态表，并要求缓存一致。选哪条？',
      prompt: '数据量不大，但 CPU 的 Cache 可能持有旧副本。',
      answer: 'acp',
      options: [
        ['gp', 'M_AXI_GP'],
        ['hp', 'S_AXI_HP'],
        ['acp', 'S_AXI_ACP'],
        ['irq', 'IRQ_F2P']
      ],
      explain: 'ACP 通道与 L2 缓存保持一致，适合小数据、低延迟交互。它不适合替代 HP 做大流量搬运。'
    },
    {
      q: 'PL 作为主设备，要主动读取 PS 地址空间中的一段内存映射数据。选哪条？',
      prompt: '方向反过来：PL 是主，PS 是从。',
      answer: 's_gp',
      options: [
        ['gp', 'M_AXI_GP'],
        ['hp', 'S_AXI_HP'],
        ['s_gp', 'S_AXI_GP'],
        ['irq', 'IRQ_F2P']
      ],
      explain: 'S_AXI_GP 允许 PL 作为主设备访问 PS 地址空间。它是通用存储映射通道，入门项目使用较少，但方向不要与 M_AXI_GP 混淆。'
    },
    {
      q: 'PL 检测到急停按钮按下，需要立刻通知 CPU。应该用哪条？',
      prompt: '重点不是搬数据，而是让 CPU 尽快进入中断服务程序。',
      answer: 'irq',
      options: [
        ['gp', 'M_AXI_GP'],
        ['hp', 'S_AXI_HP'],
        ['acp', 'S_AXI_ACP'],
        ['irq', 'IRQ_F2P']
      ],
      explain: '事件通知走 IRQ_F2P，进入 GIC 后由 CPU 处理中断。中断里再通过 AXI 读取详细状态，而不是把数据塞进中断线。'
    }
  ];

  const axiOptions = $('#axiOptions');
  const axiQuestion = $('#axiQuestion');
  const axiPrompt = $('#axiPrompt');
  const axiFeedback = $('#axiFeedback');
  const axiProgress = $('#axiProgress');
  const axiNext = $('#axiNext');
  const axiScenarioNo = $('#axiScenarioNo');
  let axiIndex = 0;
  let axiCorrect = 0;
  let axiAnswered = false;

  function renderAxi() {
    const data = axiData[axiIndex];
    if (!data || !axiOptions) return;
    axiAnswered = false;
    setText(axiScenarioNo, 'SCENARIO ' + String(axiIndex + 1).padStart(2, '0'));
    setText(axiQuestion, data.q);
    setText(axiPrompt, data.prompt);
    setText(axiProgress, '场景 ' + (axiIndex + 1) + ' / ' + axiData.length + ' · 答对 ' + axiCorrect);
    if (axiFeedback) {
      axiFeedback.hidden = true;
      axiFeedback.classList.remove('is-wrong');
      axiFeedback.innerHTML = '';
    }
    if (axiNext) {
      axiNext.disabled = true;
      axiNext.textContent = axiIndex === axiData.length - 1 ? '查看结果' : '下一题';
    }
    setHTML(
      axiOptions,
      data.options
        .map((option, index) => (
          '<button type="button" class="axi-option" data-key="' + option[0] + '">' +
          '<span class="letter">' + String.fromCharCode(65 + index) + '</span>' +
          '<span>' + option[1] + '</span></button>'
        ))
        .join('')
    );
    $$('.axi-option', axiOptions).forEach((button) => {
      button.addEventListener('click', () => answerAxi(button, data));
    });
  }

  function answerAxi(chosen, data) {
    if (axiAnswered) return;
    axiAnswered = true;
    const correct = chosen.dataset.key === data.answer;
    if (correct) axiCorrect += 1;
    $$('.axi-option', axiOptions).forEach((button) => {
      button.disabled = true;
      if (button.dataset.key === data.answer) button.classList.add('correct');
    });
    if (!correct) chosen.classList.add('wrong', 'chosen');
    if (axiFeedback) {
      axiFeedback.hidden = false;
      axiFeedback.classList.toggle('is-wrong', !correct);
      axiFeedback.innerHTML =
        '<strong>' + (correct ? '判断正确。' : '再想一步。') + '</strong> ' +
        data.explain;
    }
    setText(axiProgress, '场景 ' + (axiIndex + 1) + ' / ' + axiData.length + ' · 答对 ' + axiCorrect);
    if (axiNext) axiNext.disabled = false;
  }

  if (axiOptions) {
    renderAxi();
    if (axiNext) {
      axiNext.addEventListener('click', () => {
        if (!axiAnswered) return;
        if (axiIndex < axiData.length - 1) {
          axiIndex += 1;
          renderAxi();
          return;
        }
        setText(axiScenarioNo, 'SUMMARY');
        setText(axiQuestion, '通道选型完成：答对 ' + axiCorrect + ' / ' + axiData.length);
        setText(axiPrompt, axiCorrect === axiData.length ? '控制、数据、缓存与事件，你已经能把它们分开。' : '回看上面的表格，重点区分「控制 / 数据 / 事件」三类需求。');
        setHTML(axiOptions, '');
        if (axiFeedback) {
          axiFeedback.hidden = false;
          axiFeedback.classList.toggle('is-wrong', axiCorrect < axiData.length);
          axiFeedback.innerHTML = axiCorrect === axiData.length
            ? '<strong>全对。</strong> 记住一句话：控制走 GP，大流量走 HP，缓存一致走 ACP，事件走 IRQ。'
            : '<strong>复盘建议：</strong>先判断这次交互是「寄存器控制」「大块数据」「缓存共享」还是「事件通知」，再选通道。';
        }
        setText(axiProgress, '完成 · 答对 ' + axiCorrect + ' / ' + axiData.length);
        if (axiNext) {
          axiNext.disabled = true;
          axiNext.textContent = '已完成';
        }
      });
    }
    const axiReset = $('#axiReset');
    if (axiReset) {
      axiReset.addEventListener('click', () => {
        axiIndex = 0;
        axiCorrect = 0;
        renderAxi();
      });
    }
  }

  /* ---------------- 06 address probe ---------------- */

  const addressRanges = [
    {
      start: 0x00000000,
      end: 0x0003ffff,
      id: 'ocm-low',
      region: 'OCM 低端别名',
      owner: '0x0000_0000 – 0x0003_FFFF',
      detail: '低 256KB 是 OCM 的低端别名，启动早期代码可能在这里运行。它与 DDR 的低地址存在别名关系，做裸机链接脚本时要特别小心。',
      tags: ['OCM', '启动早期', '低延迟']
    },
    {
      start: 0x00040000,
      end: 0x000fffff,
      id: 'low-boot',
      region: '低 1MB 启动窗口',
      owner: '0x0004_0000 – 0x000F_FFFF',
      detail: '这一段的归属取决于 OCM_CFG 与 SCU 地址过滤：OCM 低别名、保留区和 DDR 低端可能在此交叠。裸机链接脚本通常把 DDR 放在 0x0010_0000，避免踩到启动窗口。',
      tags: ['启动窗口', 'OCM 别名', 'SCU 过滤']
    },
    {
      start: 0x00100000,
      end: 0x3fffffff,
      id: 'ddr',
      region: 'DDR 主内存',
      owner: '0x0010_0000 – 0x3FFF_FFFF',
      detail: '1GB DDR3 的主要地址窗口，Linux 内核、应用、文件缓存都生活在这里。PL 想直接用这片内存，要经过 S_AXI_HP。',
      tags: ['DDR3', 'Linux 主内存', '1GB']
    },
    {
      start: 0x40000000,
      end: 0x7fffffff,
      id: 'gp0',
      region: 'M_AXI_GP0 窗口',
      owner: '0x4000_0000 – 0x7FFF_FFFF',
      detail: 'PS 主设备访问 PL 的地址窗口。Vivado 地址编辑器常从 0x43C0_0000 起给自定义 IP 分配基址，但具体值以你的工程为准。',
      tags: ['M_AXI_GP0', '自定义 IP', 'AXI-Lite']
    },
    {
      start: 0x80000000,
      end: 0xbfffffff,
      id: 'gp1',
      region: 'M_AXI_GP1 窗口',
      owner: '0x8000_0000 – 0xBFFF_FFFF',
      detail: '第二个 PS 主端口可访问的 PL 地址窗口。入门项目通常只用 GP0，遇到地址分配冲突时才需要理解两个窗口的区别。',
      tags: ['M_AXI_GP1', 'PL 窗口', '较少使用']
    },
    {
      start: 0xe0000000,
      end: 0xe02fffff,
      id: 'io',
      region: 'PS I/O 外设',
      owner: '0xE000_0000 – 0xE02F_FFFF',
      detail: 'UART、GPIO、SPI、I2C、CAN、GEM、QSPI、SD 等 PS 外设的寄存器区域。每个外设还有自己的子窗口。',
      tags: ['PS 外设', 'MMIO', '寄存器']
    },
    {
      start: 0xf8000000,
      end: 0xf8000fff,
      id: 'slcr',
      region: 'SLCR 系统控制',
      owner: '0xF800_0000 – 0xF800_0FFF',
      detail: 'MIO 复用、PLL、时钟使能、复位控制的总开关。写错这里可能让外设静默失效，裸机阶段要格外谨慎。',
      tags: ['SLCR', 'MIO 复用', 'PLL']
    },
    {
      start: 0xf8f00000,
      end: 0xf8f0ffff,
      id: 'gic',
      region: 'GIC 中断控制器',
      owner: '0xF8F0_0000 – 0xF8F0_FFFF',
      detail: '中断分发器位于 0xF8F0_1000，CPU 接口位于 0xF8F0_0100。PL 的 IRQ_F2P 事件最终会进入这里，再交给 CPU。',
      tags: ['GIC', 'IRQ_F2P', '中断']
    },
    {
      start: 0xfffc0000,
      end: 0xffffffff,
      id: 'ocm-high',
      region: 'OCM 高端映射',
      owner: '0xFFFC_0000 – 0xFFFF_FFFF',
      detail: '256KB OCM 的高端映射，FSBL 与启动早期代码常在这里运行。它不经过 DDR 控制器，适合对延迟敏感的热代码。',
      tags: ['OCM', '256KB', 'FSBL']
    }
  ];

  const psPeripherals = [
    { start: 0xe0000000, end: 0xe0000fff, name: 'UART0', detail: 'PS 的 UART0 控制器。领航者的调试串口通常接 UART1，但具体以原理图为准。' },
    { start: 0xe0001000, end: 0xe0001fff, name: 'UART1', detail: 'PS 的 UART1 控制器。裸机串口打印、Linux 控制台都常从这里出来。' },
    { start: 0xe0004000, end: 0xe0004fff, name: 'I2C0', detail: 'PS 的 I2C0 控制器，常用于连接 EEPROM、传感器或电源管理芯片。' },
    { start: 0xe0006000, end: 0xe0006fff, name: 'SPI0', detail: 'PS 的 SPI0 控制器，可连接 Flash、显示屏或外部 ADC。' },
    { start: 0xe0008000, end: 0xe0008fff, name: 'CAN0', detail: 'PS 的 CAN0 控制器，工业现场总线实验会用到。' },
    { start: 0xe000a000, end: 0xe000afff, name: 'GPIO', detail: 'PS 的 GPIO 控制器基地址。裸机中通过它配置引脚方向、读写数据与中断；Linux 下由 GPIO 驱动接管。' },
    { start: 0xe000b000, end: 0xe000bfff, name: 'GEM0', detail: 'PS 的千兆以太网控制器。NFS、TFTP、Modbus TCP 和 Web 服务都依赖它。' },
    { start: 0xe000d000, end: 0xe000dfff, name: 'QSPI', detail: 'QSPI 控制器，连接板载 SPI Flash，是 BOOT.BIN 的常见存放介质。' },
    { start: 0xe0100000, end: 0xe0100fff, name: 'SD0', detail: 'SD0 控制器，连接 TF 卡。日常 Linux 开发常从 SD 卡启动。' }
  ];

  function normalizeAddress(value) {
    let cleaned = String(value).trim().replace(/_/g, '').replace(/\s+/g, '');
    if (!/^0x/i.test(cleaned) && /^[0-9a-f]+$/i.test(cleaned)) cleaned = '0x' + cleaned;
    if (!/^0x[0-9a-f]+$/i.test(cleaned)) return null;
    const valueInt = parseInt(cleaned.slice(2), 16);
    if (!Number.isFinite(valueInt) || valueInt < 0 || valueInt > 0xffffffff) return null;
    return valueInt;
  }

  function formatAddress(value) {
    return '0x' + value.toString(16).toUpperCase().padStart(8, '0');
  }

  function probeAddress(raw) {
    const valueInt = normalizeAddress(raw);
    const result = $('#addrResult');
    const badge = $('#addrBadge');
    if (valueInt === null) {
      if (result) result.classList.add('is-unknown');
      setText($('#addrRegion'), '地址格式不正确');
      setText($('#addrOwner'), '请输入 0x00000000 – 0xFFFFFFFF');
      setText($('#addrDetail'), '支持 0x 前缀和十六进制数字，例如 0xE000A000。');
      setHTML($('#addrTags'), '<span>格式错误</span>');
      setText(badge, '无效地址');
      return;
    }

    const normalized = formatAddress(valueInt);
    const input = $('#addrInput');
    if (input) input.value = normalized;
    setText(badge, normalized);

    const range = addressRanges.find((item) => valueInt >= item.start && valueInt <= item.end);
    if (!range) {
      if (result) result.classList.add('is-unknown');
      setText($('#addrRegion'), '未映射 / 保留地址');
      setText($('#addrOwner'), normalized + ' · 无外设响应');
      setText($('#addrDetail'), '这个地址不在课程速查表的常见窗口内。访问它可能触发总线错误或返回无意义数据；先查 UG585 和你的 Vivado 地址分配。');
      setHTML($('#addrTags'), '<span>未映射</span><span>谨慎访问</span>');
      return;
    }

    let region = range.region;
    let owner = range.owner;
    let detail = range.detail;
    let tags = range.tags.slice();

    if (range.id === 'io') {
      const periph = psPeripherals.find((item) => valueInt >= item.start && valueInt <= item.end);
      if (periph) {
        region = 'PS I/O · ' + periph.name;
        owner = normalized + ' · ' + periph.name;
        detail = periph.detail;
        tags = ['PS 外设', periph.name, 'MMIO'];
      }
    }

    if (range.id === 'gp0' && valueInt >= 0x43c00000) {
      detail = '这是 M_AXI_GP0 窗口中 Vivado 常分配给自定义 IP 的区域。具体基址由你的地址编辑器决定，软件侧必须与 xparameters.h 或设备树保持一致。';
      tags = ['M_AXI_GP0', '自定义 IP', '常见落点'];
    }

    if (result) result.classList.remove('is-unknown');
    setText($('#addrRegion'), region);
    setText($('#addrOwner'), owner);
    setText($('#addrDetail'), detail);
    setHTML($('#addrTags'), tags.map((tag) => '<span>' + tag + '</span>').join(''));
  }

  const addrProbeBtn = $('#addrProbeBtn');
  if (addrProbeBtn) {
    addrProbeBtn.addEventListener('click', () => probeAddress($('#addrInput').value));
    const addrInput = $('#addrInput');
    if (addrInput) {
      addrInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          probeAddress(addrInput.value);
        }
      });
    }
    $$('[data-addr]').forEach((button) => {
      button.addEventListener('click', () => {
        const addrInputEl = $('#addrInput');
        if (addrInputEl) addrInputEl.value = button.dataset.addr;
        probeAddress(button.dataset.addr);
      });
    });
    probeAddress('0xE000A000');
  }

  /* ---------------- 07 development modes ---------------- */

  const modeData = {
    fpga: {
      status: '纯 FPGA',
      kicker: 'Pure FPGA · Vivado',
      title: '只用 PL：把 ZYNQ 当一块 FPGA',
      chapter: '第 5–6 章',
      text: 'Verilog 描述电路，Vivado 综合、布局布线并生成 bitstream，通过 JTAG 烧写到 PL。PS 可以完全不参与，适合纯逻辑、高速接口和实时信号处理实验。',
      flow: ['Verilog', '综合', '实现', 'bitstream'],
      facts: ['优势：时序确定、无 OS 抖动', '代价：没有网络与文件系统', '产出：.bit / .bin']
    },
    bare: {
      status: 'PS 裸机',
      kicker: 'Bare Metal · Vitis',
      title: 'PS 裸机：没有 OS，但一切可控',
      chapter: '第 7–10 章',
      text: 'PS 直接运行 C 程序，没有进程调度和页表干扰。你可以精确控制启动时间、内存布局和中断延迟，适合启动链验证、板级自检和硬实时控制。',
      flow: ['ps7_init', 'main()', '寄存器 / 库', 'ELF'],
      facts: ['优势：启动快、延迟可预测', '代价：协议栈与文件系统要自己搭', '产出：ELF / BOOT.BIN']
    },
    linux: {
      status: '嵌入式 Linux',
      kicker: 'PetaLinux · Linux',
      title: 'Linux 系统：生态与分层',
      chapter: '第二篇',
      text: 'U-Boot 启动内核，设备树描述硬件，驱动与应用分层。网络协议栈、文件系统、Web 服务可以直接使用，是软 PLC 的主战场。',
      flow: ['FSBL', 'U-Boot', 'Kernel', 'rootfs'],
      facts: ['优势：生态完整、开发效率高', '代价：启动慢、实时性需补足', '产出：BOOT.BIN + 镜像 + rootfs']
    },
    amp: {
      status: 'AMP 非对称多核',
      kicker: 'OpenAMP · rpmsg',
      title: 'AMP：一芯两世界',
      chapter: '第 40 章（进阶）',
      text: '核 0 跑 Linux 负责界面与网络，核 1 跑裸机或 RTOS 负责硬实时任务。两核通过共享内存和 IPI/rpmsg 通信，兼顾生态与确定性。',
      flow: ['Core0 Linux', '共享内存', 'IPI / rpmsg', 'Core1 裸机'],
      facts: ['优势：生态与实时性兼得', '代价：资源划分与通信设计复杂', '场景：高端工控、机器人']
    }
  };

  const modeButtons = $$('[data-mode]');
  const modeDetail = $('#modeDetail');

  function showMode(key) {
    const data = modeData[key];
    if (!data || !modeDetail) return;
    modeButtons.forEach((button) => {
      const on = button.dataset.mode === key;
      button.classList.toggle('active', on);
      button.setAttribute('aria-selected', String(on));
      if (on) modeDetail.setAttribute('aria-labelledby', button.id);
    });
    setText($('#modeStatus'), data.status);
    setText($('#modeKicker'), data.kicker);
    setText($('#modeTitle'), data.title);
    setText($('#modeChapter'), data.chapter);
    setText($('#modeText'), data.text);
    setHTML(
      $('#modeFlow'),
      data.flow.map((step) => '<span>' + step + '</span>').join('<i>→</i>')
    );
    setHTML(
      $('#modeFacts'),
      data.facts.map((fact) => '<span>' + fact + '</span>').join('')
    );
  }

  if (modeButtons.length) {
    modeButtons.forEach((button) => {
      button.addEventListener('click', () => showMode(button.dataset.mode));
    });
    showMode('fpga');
  }

  /* ---------------- 08 power & clock ---------------- */

  const powerRails = $$('.power-rail');
  const powerBtn = $('#powerBtn');
  const powerStatus = $('#powerStatus');
  const hwStatus = $('#hwStatus');
  let powerTimers = [];

  function clearPowerTimers() {
    powerTimers.forEach((timer) => window.clearTimeout(timer));
    powerTimers = [];
  }

  function resetPowerRails() {
    clearPowerTimers();
    powerRails.forEach((rail) => rail.classList.remove('on'));
    if (powerBtn) {
      powerBtn.disabled = false;
      powerBtn.textContent = '演示上电顺序';
    }
    if (powerStatus) powerStatus.classList.remove('is-live');
  }

  if (powerBtn && powerRails.length) {
    const railNotes = [
      'VCCINT 先建立：PL 的逻辑核心开始获得 1.0V。',
      'VCCAUX 建立：辅助电路与 XADC 获得 1.8V。',
      'PS 核与辅助电源建立：双核 A9 开始具备工作条件。',
      'IO Bank 供电建立：VCCO 决定 MIO / PL IO 的电平标准。'
    ];

    powerBtn.addEventListener('click', () => {
      resetPowerRails();
      if (powerStatus) {
        powerStatus.classList.add('is-live');
        powerStatus.textContent = '正在按分组建立电源……';
      }
      if (hwStatus) hwStatus.textContent = '上电演示中';
      powerBtn.disabled = true;
      powerBtn.textContent = '上电中…';

      if (reduceMotion) {
        powerRails.forEach((rail) => rail.classList.add('on'));
        if (powerStatus) powerStatus.textContent = '电源分组已全部建立。真实上电顺序由板级电源芯片与数据手册决定。';
        if (hwStatus) hwStatus.textContent = '电源就绪';
        powerBtn.disabled = false;
        powerBtn.textContent = '重新演示';
        return;
      }

      powerRails.forEach((rail, index) => {
        const timer = window.setTimeout(() => {
          rail.classList.add('on');
          if (powerStatus) powerStatus.textContent = railNotes[index];
          if (hwStatus) hwStatus.textContent = '电源 ' + (index + 1) + ' / ' + powerRails.length;
        }, 620 * (index + 1));
        powerTimers.push(timer);
      });

      const doneTimer = window.setTimeout(() => {
        if (powerStatus) powerStatus.textContent = '上电完成。注意：这是分组顺序示意，真实时序与最小间隔由电源芯片和数据手册保证。';
        if (hwStatus) hwStatus.textContent = '电源就绪';
        powerBtn.disabled = false;
        powerBtn.textContent = '重新演示';
      }, 620 * powerRails.length + 520);
      powerTimers.push(doneTimer);
    });
  }

  const clockData = {
    ref: {
      kicker: 'PS 参考时钟',
      text: '板载 33.333MHz 晶振进入 PS，三个 PLL 分别服务 ARM、DDR 和 IO 外设。它是整颗芯片的节拍起点。'
    },
    arm: {
      kicker: 'ARM PLL',
      text: 'ARM PLL 倍频后为双核 Cortex-A9、L2 缓存和 SCU 提供 CPU 时钟。-2 速度等级的 7020 最高 767MHz，降频可以降低功耗与发热。'
    },
    ddr: {
      kicker: 'DDR PLL',
      text: 'DDR PLL 产生 DDR 控制器与 PHY 所需时钟。DDR 的时序余量通常比 CPU 更紧，改频率后必须重新验证读写稳定性。'
    },
    io: {
      kicker: 'IO PLL',
      text: 'IO PLL 为 PS 外设提供时钟，并分出 FCLK_CLK0~3 送给 PL。UART 波特率、SPI 速率和 PL 逻辑时钟都从这里获得基准。'
    },
    fclk: {
      kicker: 'FCLK · PS → PL',
      text: 'FCLK_CLK0~3 是 PS 送给 PL 的时钟网络，频率在 Vivado 的 PS 配置页设置。PL 内部还可以用 MMCM/PLL 再倍频或分频；跨时钟域必须做 CDC。'
    }
  };

  const clockButtons = $$('[data-clock]');
  if (clockButtons.length) {
    clockButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const data = clockData[button.dataset.clock];
        if (!data) return;
        clockButtons.forEach((node) => node.classList.remove('active', 'clock-pulse'));
        button.classList.add('active', 'clock-pulse');
        setText($('#clockKicker'), data.kicker);
        setText($('#clockText'), data.text);
        if (hwStatus) hwStatus.textContent = '时钟：' + data.kicker;
        if (!reduceMotion) {
          window.setTimeout(() => button.classList.remove('clock-pulse'), 620);
        }
      });
    });
    const refButton = $('[data-clock="ref"]');
    if (refButton) refButton.classList.add('active');
  }

  /* ---------------- 09 quiz ---------------- */

  const questions = [
    {
      q: 'XC7Z020 大约有多少个 LUT？',
      options: ['17,600', '53,200', '78,400', '218,600'],
      answer: 1,
      why: '7020 有 53,200 个 LUT、140 块 BRAM、220 个 DSP。17,600 是 7010，78,400 是 7030，218,600 是 7045。'
    },
    {
      q: 'CPU 要读写 PL 中自定义 IP 的配置寄存器，通常走哪条通道？',
      options: ['M_AXI_GP', 'S_AXI_HP', 'S_AXI_ACP', 'IRQ_F2P'],
      answer: 0,
      why: '控制类寄存器访问走 M_AXI_GP，自定义 IP 通常实现 AXI-Lite 从接口。HP 面向大块数据，ACP 面向缓存一致，IRQ 只传事件。'
    },
    {
      q: 'PL 采集的高速数据要成批写入 DDR，最合适的组合是？',
      options: ['M_AXI_GP + 轮询', 'S_AXI_HP + DMA', 'IRQ_F2P + PIO', 'EMIO + 软件延时'],
      answer: 1,
      why: 'S_AXI_HP 是 PL 主设备访问 DDR 的高带宽通道，配合 DMA 可以成批搬运。CPU 只配置 DMA 并处理完成事件。'
    },
    {
      q: 'PL 检测到故障后只需通知 CPU，应该用哪条通道？',
      options: ['S_AXI_ACP', 'S_AXI_HP', 'IRQ_F2P', 'M_AXI_GP'],
      answer: 2,
      why: 'IRQ_F2P 把 PL 中断送入 PS 的 GIC。通知走中断，详细状态再由 CPU 通过 AXI 读取。'
    },
    {
      q: '为什么开发板上电后 PL 的逻辑会“消失”？',
      options: ['QSPI 中的 BOOT.BIN 被擦除了', 'PL 配置保存在 SRAM，掉电即失', 'SD 卡没有挂载', 'DDR 没有刷新'],
      answer: 1,
      why: 'FPGA 的配置信息保存在 SRAM 中，掉电即失。产品化时需要由 PS 启动链从 QSPI/SD 加载 bitstream，并打包成 BOOT.BIN。'
    },
    {
      q: '关于 MIO 与 EMIO，哪一项描述正确？',
      options: ['MIO 是 PL 的专用引脚', 'EMIO 只能用于时钟输出', 'MIO 是 PS 外设的固定复用引脚，EMIO 可把 PS 外设信号借道 PL', '两者完全等价'],
      answer: 2,
      why: 'MIO 把 PS 外设复用到固定引脚；引脚不够或需要从 PL 引脚引出时，可用 EMIO 把信号送进 PL，再由 PL 的 IO 输出。'
    },
    {
      q: 'PS GPIO 控制器的基地址是？',
      options: ['0xE0001000', '0xE000A000', '0xF8000000', '0xFFFC0000'],
      answer: 1,
      why: 'GPIO = 0xE000A000，UART1 = 0xE0001000，SLCR = 0xF8000000，OCM 高地址映射 = 0xFFFC0000。'
    },
    {
      q: '送给 PL 的 FCLK_CLK0~3 主要来自哪个 PLL？',
      options: ['ARM PLL', 'DDR PLL', 'IO PLL', '独立晶振'],
      answer: 2,
      why: 'FCLK 由 PS 的 IO PLL 时钟域产生，频率在 Vivado 的 PS 配置中设置。PL 内部还可以再用 MMCM/PLL 处理。'
    }
  ];

  const quizList = $('#quizList');
  const quizScoreEl = $('#quizScore');

  function renderQuiz() {
    if (!quizList) return;
    quizList.innerHTML = '';
    let quizScore = 0;
    let quizAnswered = 0;
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
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'q-option';
        const letter = document.createElement('span');
        letter.className = 'letter';
        letter.textContent = 'ABCD'[optionIndex];
        const text = document.createElement('span');
        text.textContent = option;
        button.appendChild(letter);
        button.appendChild(text);
        button.addEventListener('click', () => {
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
          explain.innerHTML = '<b>正确答案：' + 'ABCD'[item.answer] + '。</b>' + item.why;
          if (correct) {
            quizScore += 1;
            setText(quizScoreEl, String(quizScore));
          }
          quizAnswered += 1;
          if (quizAnswered === questions.length) {
            setText($('#quizDone'), ' · 已完成');
          }
        });
        options.appendChild(button);
        optionButtons.push(button);
      });

      card.appendChild(options);
      const explain = document.createElement('div');
      explain.className = 'q-explain';
      explain.hidden = true;
      card.appendChild(explain);
      quizList.appendChild(card);
    });
  }

  if (quizList) {
    renderQuiz();
    const quizReset = $('#quizReset');
    if (quizReset) quizReset.addEventListener('click', renderQuiz);
  }

  /* ---------------- checklist & notes ---------------- */

  const checklist = $('#checklist');
  if (checklist) {
    const storageKey = 'zynq_ch02_checklist_v1';
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

  const notes = $('#notes');
  if (notes) {
    const noteStatus = $('#noteStatus');
    const noteKey = 'zynq_ch02_notes_v1';
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

  saveJSON('zynq_last_chapter_v1', {
    id: 'ch02',
    file: 'chapter2.html',
    title: '第 2 章 · ZYNQ 架构详解'
  });

  window.__zynqChapter2Ready = true;
})();
