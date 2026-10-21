/* ============================================================
   ZYNQ 讲义互动内容 · Part 2（第 18–34 章）
   ============================================================ */
window.ZX_LABS = Object.assign(window.ZX_LABS || {}, {

  ch18: {
    title: '互动实验室 · probe 为什么没被调用',
    lead: 'platform 驱动的匹配是一条证据链：DTS 节点 → 设备枚举 → compatible 匹配 → probe → 资源获取。任何一环断了，现象都是“驱动没反应”。',
    widget: {
      title: '从设备树节点到 probe 成功',
      sub: '点击步骤查看每层的证据与常见断点。',
      type: 'flow',
      steps: [
        { title: 'DTS 节点存在且 status=okay', desc: '节点必须有正确的 compatible、reg、interrupts；status 不能是 disabled。', tag: 'DTS' },
        { title: '内核创建 platform_device', desc: '解析设备树后，设备出现在 /sys/bus/platform/devices。', tag: '枚举' },
        { title: 'compatible 逐字符匹配', desc: 'of_match_table 与节点字符串完全一致才绑定。', tag: 'match' },
        { title: 'probe 被调用', desc: '传入 platform_device，驱动开始获取资源、初始化硬件。', tag: 'probe' },
        { title: 'devm 资源与中断', desc: 'devm_ioremap_resource、platform_get_irq、devm_request_irq 完成绑定。', tag: '资源' },
        { title: 'sysfs / 设备节点可用', desc: '驱动注册 class、sysfs 属性或字符设备，用户态才能访问。', tag: '用户态' }
      ],
      faults: [
        { at: 2, label: 'compatible 不一致', title: 'DTS 写 demo,plc-io-v1，驱动写 demo,plc_io_v1', symptom: '设备存在但驱动不绑定；dmesg 无 probe 日志。逐字符对比，注意连字符与下划线。' },
        { at: 4, label: 'reg 解析失败', title: 'reg 格式/地址长度错误', symptom: 'probe 返回 -EINVAL 或 ioremap 失败。检查 #address-cells/#size-cells 与 reg 元组。' },
        { at: 4, label: '中断号缺失', title: 'interrupts 未写或 GIC 未配置', symptom: 'platform_get_irq 返回负值，probe 失败。对照 Vivado 中断号与 DTS。' }
      ],
      note: '先看 /sys/bus/platform/devices 有没有设备，再看 /sys/bus/platform/drivers 有没有绑定。设备在、驱动不在 → 匹配问题；绑定在、功能不在 → 资源/寄存器问题。'
    },
    case: {
      tag: '工程现场 · 多板型复用',
      title: '一套驱动，三种板子，靠设备树区分',
      scene: '同一款控制器衍生出标准型、扩展型、宽温型三个硬件版本，IO 数量与寄存器基地址不同。团队把差异全部放进设备树，驱动只读 compatible 与 reg，不为每种板子编译不同 .ko。',
      metrics: ['3 种板型', '1 套驱动', '3 份 DTS', '0 份分支代码'],
      points: [
        '硬件差异放设备树，行为差异用 compatible 或属性区分。',
        '驱动不要在 C 里写死基地址、中断号和 GPIO 编号。',
        '用 devm_* 管理资源，probe 失败自动回滚。',
        'sysfs 暴露版本与状态，现场排障不需要重新编译。'
      ],
      ask: '如果两个板型的寄存器布局不同，应该用不同 compatible，还是同一个 compatible 加属性？'
    },
    quiz: [
      {
        q: 'platform 驱动没有 probe，最先应该确认什么？',
        options: ['CPU 温度', '设备树节点是否存在、status 是否 okay、compatible 是否匹配', 'SD 卡容量', '串口波特率'],
        answer: 1,
        exp: '先确认设备枚举与匹配，再谈资源获取；这三项是最常见的“静默失败”。'
      },
      {
        q: 'devm_ioremap_resource 相比手写 ioremap 的优势是？',
        options: ['速度更快', '资源随设备生命周期自动释放，probe 失败自动回滚', '不需要设备树', '可以访问用户空间'],
        answer: 1,
        exp: 'devm 家族把资源绑定到 device，驱动卸载或 probe 失败时自动清理，减少泄漏与错误路径遗漏。'
      },
      {
        q: '同一套驱动支持多种硬件版本，最规范的做法是？',
        options: ['为每个版本复制一份驱动', '用设备树描述差异，驱动解析属性', '在驱动里判断 CPU 序列号', '运行时让用户输入地址'],
        answer: 1,
        exp: '设备树负责描述硬件差异，驱动负责通用逻辑，这是 Linux 设备模型的核心分工。'
      }
    ]
  },

  ch19: {
    title: '互动实验室 · 两条总线的时序语言',
    lead: 'I2C 与 SPI 都不难，难在“模式、相位、地址、时序”四项对齐。切换标签，逐拍看两条总线如何搬运一个寄存器。',
    widget: {
      title: 'I2C 读寄存器 vs SPI Mode 0 传输',
      sub: '点击标签切换；拖动时间轴观察采样边沿。',
      type: 'wave',
      views: [
        {
          label: 'I2C 读寄存器',
          type: 'wave',
          signals: [
            { name: 'SCL', values: [1,1,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1], color: '#fbbf24' },
            { name: 'SDA', values: ['IDLE','START','ADDR+W','ACK','REG','ACK','START','ADDR+R','ACK','DATA','NACK','STOP','—','—','—','—','—','—','—'], color: '#22d3ee' },
            { name: '总线状态', values: ['空闲','起始','地址','应答','寄存器','应答','重复起始','地址','应答','读数据','非应答','停止','空闲','空闲','空闲','空闲','空闲','空闲','空闲'], color: '#a78bfa' }
          ],
          markers: [{ tick: 1, label: 'START' }, { tick: 6, label: '重复 START' }, { tick: 11, label: 'STOP' }],
          chips: ['7 位地址 + R/W', 'ACK 低有效', 'SCL 高时 SDA 必须稳定', '上拉电阻决定边沿'],
          tickUnit: ' 拍',
          note: 'I2C 的地址、数据都在 SDA 上，SCL 提供采样节拍。起始/停止条件是 SCL 高时 SDA 的跳变，因此不能用普通 GPIO 随便模拟高速 I2C。'
        },
        {
          label: 'SPI Mode 0',
          type: 'wave',
          signals: [
            { name: 'CS_N', values: [1,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1], color: '#fb7185' },
            { name: 'SCLK', values: [0,0,1,0,1,0,1,0,1,0,0,0,0,0,0,0], color: '#fbbf24' },
            { name: 'MOSI', values: ['—','D7','D7','D6','D6','D5','D5','D4','D4','—','—','—','—','—','—','—'], color: '#60a5fa' },
            { name: 'MISO', values: ['—','—','0','0','1','1','0','0','1','—','—','—','—','—','—','—'], color: '#34d399' }
          ],
          markers: [{ tick: 1, label: 'CS 拉低' }, { tick: 2, label: '第一个上升沿采样' }],
          chips: ['CPOL=0 CPHA=0', '上升沿采样', 'MSB first', 'CS 决定帧边界'],
          tickUnit: ' 拍',
          note: 'Mode 0 是 CPOL=0、CPHA=0：空闲低电平，上升沿采样。模式选错时数据会整体错位一位，表现为读数“有变化但不对”。'
        }
      ]
    },
    case: {
      tag: '工程现场 · 外置 ADC',
      title: '温度读数一直跳，问题在 SPI 模式',
      scene: '产线用 SPI 外置 ADC 采 4–20 mA 传感器，读数在 20℃ 附近上下跳 8℃。示波器发现主机按 Mode 0 采样，而从设备要求 Mode 3。数据位错位后，符号位与量程位被误读。改 CPOL/CPHA 后稳定。',
      metrics: ['4 路 AI', '12 位 ADC', 'Mode 0 vs 3', '8℃ 误差'],
      points: [
        'SPI 没有统一标准，模式、位序、字长必须从器件手册确认。',
        'CS 的建立/保持时间也要满足从设备要求。',
        '先读芯片 ID，再读数据；ID 不对说明时序或模式有问题。',
        'IIO 子系统可把 ADC 通道标准化，应用不必关心总线细节。'
      ],
      ask: '如果 SPI 读数总是左移一位，你会先查 CPHA 还是位序？'
    },
    quiz: [
      {
        q: 'SPI Mode 0 的采样边沿是？',
        options: ['下降沿', '上升沿', '任意边沿', 'CS 边沿'],
        answer: 1,
        exp: 'Mode 0 为 CPOL=0、CPHA=0，空闲低电平，第一个（上升）沿采样。'
      },
      {
        q: 'Linux 下快速验证 I2C 设备是否在线，最方便的工具是？',
        options: ['i2cdetect', 'fdisk', 'ping', 'insmod'],
        answer: 0,
        exp: 'i2c-tools 的 i2cdetect 可扫描总线地址，i2cget/i2cset 可读写寄存器。'
      },
      {
        q: 'IIO 子系统的主要价值是？',
        options: ['替代内核', '为 ADC/DAC 等模拟量设备提供统一的用户态接口', '加速 SPI 时钟', '管理网络'],
        answer: 1,
        exp: 'IIO 把不同 ADC 的通道、量程、采样率抽象成统一接口，应用可通过 sysfs/字符设备读取。'
      }
    ]
  },

  ch20: {
    title: '互动实验室 · 2 ms 扫描里塞进了什么',
    lead: '实时性不是“线程优先级调高”这么简单。看一条 10 ms 的时间线：扫描、IO、Modbus、Web 如何争用同一个 CPU。',
    widget: {
      title: '单核 Linux 上的任务时间线',
      sub: '每个小格 0.5 ms。观察扫描任务被网络与日志切碎的位置。',
      type: 'sched',
      ticks: 20,
      labelEvery: 5,
      phases: [
        { at: 0, label: '周期开始' },
        { at: 2, label: 'IO 刷新' },
        { at: 6, label: 'Modbus 突发' },
        { at: 10, label: '第二个扫描周期' },
        { at: 16, label: 'Web 请求' }
      ],
      rows: [
        { name: 'PLC 扫描', sub: '2 ms 周期', color: '#22d3ee', segments: [[0,2,'SCAN'],[2,3,'IO'],[6,8,'SCAN'],[10,12,'SCAN'],[14,16,'SCAN'],[18,20,'SCAN']] },
        { name: 'Modbus TCP', sub: '网络中断 + 协议栈', color: '#60a5fa', segments: [[1,2,'RX'],[3,6,'PARSE'],[8,9,'TX'],[12,14,'RX'],[17,18,'TX']] },
        { name: 'Web / 日志', sub: '非实时', color: '#a78bfa', segments: [[4,6,'HTTP'],[9,10,'LOG'],[16,17,'HTTP']] },
        { name: '空闲', sub: 'idle', color: '#64748b', segments: [[3,4,'IDLE',1],[6,7,'IDLE',1],[14,15,'IDLE',1],[19,20,'IDLE',1]] }
      ],
      note: '图中扫描周期已经被切碎。真实系统需要优先级、CPU 隔离、中断合并和实时调度共同保证；单靠 nice 值不够。'
    },
    case: {
      tag: '工程现场 · 扫描抖动',
      title: '平均 2 ms，最坏 11 ms',
      scene: '软 PLC 在实验室测得扫描周期稳定 2.1 ms，现场接入 SCADA 后偶发 11 ms。ftrace 显示网络中断与日志写入在扫描线程运行时抢占 CPU。最终把扫描线程绑定到隔离核，Modbus 放到另一核，日志改为异步落盘。',
      metrics: ['平均 2.1 ms', '最坏 11 ms', '1 个隔离核', '抖动 < 200 µs'],
      points: [
        '实时性看最坏情况，不看平均值。',
        '网络中断、日志、页缓存回写都会造成不可预测的延迟。',
        'CPU 隔离 + 实时优先级 + 减少共享资源是组合拳。',
        '用 cyclictest、ftrace 或 GPIO 翻转测抖动，别凭感觉。'
      ],
      ask: '如果把 Web 服务放到另一个核，是否就一定能消除扫描抖动？还有什么共享资源？'
    },
    quiz: [
      {
        q: '评价 PLC 扫描实时性最重要的指标是？',
        options: ['平均周期', '最坏周期/抖动', 'CPU 占用率', '内存占用'],
        answer: 1,
        exp: '平均值会掩盖偶发长延迟，工业控制关心最坏情况是否仍满足节拍。'
      },
      {
        q: 'Linux 应用要访问 PL 寄存器，常用且高效的方式是？',
        options: ['每次 read/write 文件', 'mmap /dev/mem 或 UIO 映射寄存器', '通过串口发送命令', '重启系统'],
        answer: 1,
        exp: 'mmap 把物理寄存器映射到用户态虚拟地址，避免每次系统调用；UIO 还提供中断支持。'
      },
      {
        q: '以下哪种做法最可能降低扫描抖动？',
        options: ['在扫描线程里写日志', '把网络中断绑到同一核', '隔离 CPU 并给扫描线程实时优先级', '增加 Web 轮询频率'],
        answer: 2,
        exp: '隔离核减少干扰，实时调度保证扫描线程及时运行；日志和网络都应移出关键路径。'
      }
    ]
  },

  ch21: {
    title: '互动实验室 · 触发点前后到底发生了什么',
    lead: 'ILA 的价值不是“看波形”，而是“在正确的条件下停下来”。拖动时间轴，观察触发器前后的信号关系。',
    widget: {
      title: 'ILA 捕获：DI 毛刺触发',
      sub: '触发条件设置为 di_raw 上升沿；观察滤波前后与状态机的反应。',
      type: 'wave',
      signals: [
        { name: 'clk', values: [0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1], color: '#fbbf24' },
        { name: 'di_raw', values: [0,0,1,1,0,1,1,1,1,1,1,0,0,0,0,0], color: '#fb7185' },
        { name: 'di_filt', values: [0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0], color: '#34d399' },
        { name: 'state', values: ['IDLE','IDLE','IDLE','IDLE','IDLE','IDLE','IDLE','RUN','RUN','RUN','RUN','STOP','STOP','IDLE','IDLE','IDLE'], color: '#22d3ee' },
        { name: 'do0', values: [0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0], color: '#a78bfa' }
      ],
      markers: [{ tick: 6, label: '触发点' }],
      chips: ['触发位置 50%', '采样深度 1024', '时钟域必须选对', '未约束信号不可信'],
      tickUnit: ' 拍',
      note: 'ILA 采样的是真实时钟域里的信号。若把异步信号直接接入 ILA，看到的可能是亚稳态或与功能不一致的采样结果；先同步再观察。'
    },
    case: {
      tag: '工程现场 · 偶发丢帧',
      title: '每秒丢 1 帧，ILA 一抓就“正常”',
      scene: '编码器接口每 10 万帧丢 1 帧，逻辑分析仪外接抓不到，因为毛刺只有 2 ns。改用 ILA 以 200 MHz 采样并在状态机异常时触发，发现跨时钟域信号未打两拍，偶尔出现亚稳态导致丢计数。加同步器后连续运行 72 小时无丢帧。',
      metrics: ['200 MHz 采样', '2 ns 毛刺', '72 小时验证', '0 丢帧'],
      points: [
        '外部逻辑分析仪可能错过极窄事件，ILA 在片内更接近真实信号。',
        '触发条件要选“异常状态”，而不是只看输入电平。',
        '跨时钟域必须同步，ILA 也要在正确时钟域采样。',
        '验证时间要覆盖故障概率，不能抓一次正常就收工。'
      ],
      ask: '如果 ILA 的采样时钟与待测信号异步，波形还能直接作为功能证据吗？'
    },
    quiz: [
      {
        q: 'ILA 与 VIO 的核心区别是？',
        options: ['ILA 有存储深度，可捕获一段历史；VIO 用于实时读写控制信号', 'ILA 只能看模拟量', 'VIO 必须占用外部引脚', '两者完全相同'],
        answer: 0,
        exp: 'ILA 带采集存储与触发，适合看时序；VIO 是实时虚拟 IO，适合在线改参数/看状态。'
      },
      {
        q: '触发位置设置为 50% 的意义是？',
        options: ['采样深度减半', '触发点前后各保留一半样本，便于看前因后果', '时钟频率加倍', '只采上升沿'],
        answer: 1,
        exp: '触发位置决定触发事件在缓冲区中的位置，50% 能同时观察触发前后的上下文。'
      }
    ]
  },

  ch22: {
    title: '互动实验室 · 时序余量是算出来的',
    lead: '时序收敛不是“多跑几次实现”。拖动参数，直观看到时钟周期、逻辑延迟、建立时间、偏斜与不确定性如何吃掉余量。',
    widget: {
      title: '建立时间余量计算器',
      sub: '默认值对应一个 100 MHz 接口。把逻辑延迟调大，看看何时开始违例。',
      type: 'calc',
      formulaText: 'T_slack = T_clk − T_logic − T_setup − T_skew − T_uncertainty',
      inputs: [
        { id: 'Tclk', label: '时钟周期 T_clk', min: 4, max: 20, step: 0.1, value: 10, unit: ' ns', decimals: 1 },
        { id: 'Tlogic', label: '最长组合逻辑 T_logic', min: 1, max: 12, step: 0.1, value: 4.2, unit: ' ns', decimals: 1 },
        { id: 'Tsu', label: '建立时间 T_setup', min: 0.2, max: 3, step: 0.05, value: 0.8, unit: ' ns', decimals: 2 },
        { id: 'Tskew', label: '时钟偏斜 T_skew', min: 0, max: 3, step: 0.05, value: 0.6, unit: ' ns', decimals: 2 },
        { id: 'Tunc', label: '抖动/不确定性', min: 0, max: 2, step: 0.05, value: 0.4, unit: ' ns', decimals: 2 }
      ],
      primary: { label: '建立时间余量 Slack', expr: 'Tclk - Tlogic - Tsu - Tskew - Tunc', unit: 'ns', decimals: 2, note: '大于 0 仅表示满足该条路径；还要看 hold、跨域与所有角落。' },
      outputs: [
        { label: '可达到的最高频率', expr: '1000 / (Tlogic + Tsu + Tskew + Tunc)', unit: 'MHz', decimals: 0 },
        { label: '时序预算占用', expr: '(Tlogic + Tsu + Tskew + Tunc) / Tclk * 100', unit: '%', decimals: 0 },
        { label: '对应时钟频率', expr: '1000 / Tclk', unit: 'MHz', decimals: 1 }
      ],
      bar: { expr: '(Tlogic + Tsu + Tskew + Tunc) / Tclk * 100', danger: true },
      verdict: { expr: 'Tclk - Tlogic - Tsu - Tskew - Tunc >= 0', good: '当前参数下时序收敛；继续检查 hold、CDC 与未约束路径。', bad: '建立时间违例。优先减少组合逻辑级数、重定时，或降低时钟频率。' },
      note: '这是单条路径的简化模型。真实 STA 还包含时钟树、OCV、布线延迟与多角分析，但预算思想一致。'
    },
    case: {
      tag: '工程现场 · 编码器接口',
      title: '100 MHz 采样，夏天开始丢步',
      scene: '伺服编码器接口在实验室 25℃ 正常，夏季柜内 55℃ 时偶发丢步。时序报告在慢速角落 WNS 为 -0.18 ns，恰好被温度和电压压垮。把组合逻辑从 6 级降到 3 级并加一级流水后，WNS 恢复到 +0.9 ns。',
      metrics: ['100 MHz', 'WNS -0.18 ns', '55℃ 柜温', '0 丢步'],
      points: [
        '时序要按 worst-case corner 看，不是typical。',
        '温度和电压会改变延迟，工业设备必须留余量。',
        '减少组合逻辑级数比盲目提高频率更有效。',
        '跨时钟域信号要同步，STA 通过不代表 CDC 安全。'
      ],
      ask: '如果 WNS 为 +0.05 ns，你会直接发货吗？还需要看什么？'
    },
    quiz: [
      {
        q: '建立时间（setup）检查的本质是？',
        options: ['数据在时钟沿前必须稳定足够长时间', '数据在时钟沿后必须保持足够长时间', '时钟必须为 0', '复位必须一直有效'],
        answer: 0,
        exp: 'setup 要求数据在采样沿之前稳定；hold 要求采样沿之后继续保持。'
      },
      {
        q: '跨时钟域信号即使 STA 通过，仍然需要？',
        options: ['提高电压', '同步器（如两级触发器）或异步 FIFO/握手', '增加 LED', '关闭时钟'],
        answer: 1,
        exp: 'STA 不检查异步相位关系，亚稳态风险必须靠同步结构解决。'
      },
      {
        q: '时序违例最优先的修复方向通常是？',
        options: ['换更大的芯片', '减少关键路径组合逻辑/插入流水', '提高温度', '关闭时序分析'],
        answer: 1,
        exp: '先优化逻辑结构与约束，再考虑频率、布局和器件；直接换芯片是最后手段。'
      }
    ]
  },

  ch23: {
    title: '互动实验室 · CPU 停下来之后看什么',
    lead: 'JTAG 调试不是“点一下暂停”。断点、寄存器、内存、外设视图要形成一条证据链，才能从现象走到根因。',
    widget: {
      title: '三分钟定位“中断不来”的调试路径',
      sub: '点击每一步，查看该阶段应该看哪些证据。',
      type: 'flow',
      steps: [
        { title: '连接目标并确认 halt', desc: 'XSCT/Vitis 能识别 ARM 核，halt 后 PC 停在合理地址。', tag: '连接' },
        { title: '下载 bitstream 与 ELF', desc: 'PL 配置、PS 初始化、应用符号三者匹配。', tag: '加载' },
        { title: '在 ISR 入口打断点', desc: '若从未命中，问题在中断通路；命中则看 ISR 内部。', tag: '断点' },
        { title: '读 GIC 与外设寄存器', desc: '查看 pending/enable 位，确认中断是否到达 GIC。', tag: '寄存器' },
        { title: '检查四级使能', desc: '外设、GIC、CPU 接口、全局异常逐级确认。', tag: '通路' },
        { title: '单步/继续验证', desc: '修复后连续运行并观察计数，而不是只看一次命中断点。', tag: '回归' }
      ],
      faults: [
        { at: 3, label: 'GIC 有 pending 但 CPU 无响应', title: 'CPU 接口或全局异常未开', symptom: '外设与 GIC 都正常，但 CPU 不跳 ISR。检查 Xil_ExceptionEnable 与优先级。' },
        { at: 2, label: '断点从未命中', title: '中断号/触发条件错', symptom: '先确认外设是否真的产生事件，再看 GIC ID 是否对应。不要只改代码。' }
      ],
      note: '断点命中不代表逻辑正确；断点不命中也不代表代码没跑。先用寄存器证明“事件发生了没有”，再谈软件。'
    },
    case: {
      tag: '工程现场 · Bring-up',
      title: '板子刚回，串口都没通，怎么救？',
      scene: '新贴片的板子首次上电，串口无输出。团队用 JTAG 连接 ARM 核，发现 PC 停在 BootROM 的等待循环；进一步读启动模式寄存器，发现拨码被贴片助焊剂污染导致误判。清理后正常启动。',
      metrics: ['0 串口输出', '1 个拨码', '15 分钟定位', '0 代码修改'],
      points: [
        'Bring-up 先确认供电、复位、启动模式，再连 JTAG。',
        '能 halt 说明 JTAG 链路与电源基本正常。',
        '读芯片内部寄存器可以区分“没启动”和“启动了但没输出”。',
        '保存一份板级 bring-up 检查表，能救很多次现场。'
      ],
      ask: '如果 JTAG 也连不上，你会先量哪三个电源轨？'
    },
    quiz: [
      {
        q: 'XSCT 相比 GUI 调试器的优势是？',
        options: ['更漂亮的界面', '可脚本化、可自动化、可复现', '不需要 JTAG', '自动修复时序'],
        answer: 1,
        exp: 'XSCT 用 Tcl 脚本完成连接、下载、读写内存，适合批量测试与 CI。'
      },
      {
        q: '中断断点从未命中，最合理的第一步是？',
        options: ['重装系统', '确认外设是否产生事件、GIC 是否有 pending', '换 CPU', '删除中断代码'],
        answer: 1,
        exp: '先证明事件到达哪一级，再定位是外设、GIC 还是 CPU 接口的问题。'
      }
    ]
  },

  ch24: {
    title: '互动实验室 · 断点停在板子的进程里',
    lead: '远程调试的链路比本地长：gdbserver、网络、符号、权限。任何一段不通，VSCode 都只会显示“连接失败”。',
    widget: {
      title: 'GDB + VSCode 远程调试链路',
      sub: '点击步骤查看每段的配置与常见错误。',
      type: 'flow',
      steps: [
        { title: '目标机运行 gdbserver', desc: '在板子上启动 gdbserver :2345 ./app，确认监听端口。', tag: 'Target' },
        { title: '网络可达', desc: '宿主机能 ping 通板子，端口未被防火墙拦截。', tag: '网络' },
        { title: '符号文件匹配', desc: 'GDB 加载的 ELF 必须与目标机运行的程序完全一致。', tag: '符号' },
        { title: 'VSCode launch.json', desc: '配置 miDebuggerPath、target remote、sysroot 与源码路径映射。', tag: 'IDE' },
        { title: '下断点并检查', desc: '断点命中后看调用栈、线程、变量与寄存器。', tag: '调试' },
        { title: '修复与回归', desc: '修改后重新编译、部署、复测；保留复现步骤。', tag: '闭环' }
      ],
      faults: [
        { at: 2, label: '符号不一致', title: '板上跑的是旧二进制', symptom: '断点位置错乱、变量显示错误。对比 md5sum 与 build ID，确保部署的是同一份。' },
        { at: 3, label: '源码路径映射错', title: '停在了汇编窗口', symptom: '设置 substitutePath 或正确 sysroot，让 GDB 找到源码。' }
      ],
      note: '调试的第一原则是“可复现”：固定二进制、固定输入、固定环境。否则断点命中也无法解释。'
    },
    case: {
      tag: '工程现场 · 多线程死锁',
      title: 'PLC 每小时卡死一次，GDB 一停就恢复',
      scene: '运行时偶发卡死，重启后恢复。用 gdbserver 附加到进程，触发后查看所有线程栈，发现两个线程以相反顺序获取同一对互斥锁。GDB 暂停改变了时序，所以之前“一停就正常”。最终统一锁顺序并加超时检测。',
      metrics: ['1 次/小时', '2 把锁', '相反顺序', '0 复现失败'],
      points: [
        '死锁要用线程栈证明，不要靠猜。',
        '调试器会改变时序，偶发问题需要日志与看门狗辅助。',
        '统一锁获取顺序是最便宜的预防手段。',
        '加锁超时与死锁检测能让现场更快恢复。'
      ],
      ask: '如果 gdbserver 附加后问题不再复现，你还能收集哪些证据？'
    },
    quiz: [
      {
        q: '远程调试时断点位置错乱，最常见的原因是？',
        options: ['网线太长', '调试的 ELF 与目标机运行版本不一致', 'CPU 温度高', '串口未连接'],
        answer: 1,
        exp: '符号与机器码必须一一对应；版本不一致会导致地址和行号错位。'
      },
      {
        q: '查看多线程死锁最直接的证据是？',
        options: ['所有线程的调用栈与持有的锁', 'CPU 主频', 'SD 卡型号', 'LED 状态'],
        answer: 0,
        exp: '线程栈能显示每个线程阻塞在哪把锁、谁持有锁，从而定位循环等待。'
      }
    ]
  },

  ch25: {
    title: '互动实验室 · 五层二分，把玄学变成流程',
    lead: '“偶发故障”最怕没有层次。把系统分成应用、系统调用、驱动、总线、硬件五层，每次用证据砍掉一半。',
    widget: {
      title: '五层二分定位：从现象到根因',
      sub: '点击事件逐层验证；任意一层异常就收敛到根因。',
      type: 'fsm',
      initial: 'L1_APP',
      states: [
        { id: 'L1_APP', name: '应用层', x: 120, y: 95 },
        { id: 'L2_SYS', name: '系统调用', x: 340, y: 75 },
        { id: 'L3_DRV', name: '驱动层', x: 520, y: 145 },
        { id: 'L4_BUS', name: '总线/协议', x: 440, y: 255 },
        { id: 'L5_HW', name: '硬件层', x: 220, y: 255 },
        { id: 'ROOT', name: '根因定位', x: 120, y: 175 }
      ],
      transitions: [
        { from: 'L1_APP', to: 'L2_SYS', event: '应用层正常', label: '应用正常' },
        { from: 'L1_APP', to: 'ROOT', event: '应用层异常', label: '应用异常' },
        { from: 'L2_SYS', to: 'L3_DRV', event: '系统调用正常', label: '系统调用正常' },
        { from: 'L2_SYS', to: 'ROOT', event: '系统调用异常', label: '系统调用异常' },
        { from: 'L3_DRV', to: 'L4_BUS', event: '驱动正常', label: '驱动正常' },
        { from: 'L3_DRV', to: 'ROOT', event: '驱动异常', label: '驱动异常' },
        { from: 'L4_BUS', to: 'L5_HW', event: '总线正常', label: '总线正常' },
        { from: 'L4_BUS', to: 'ROOT', event: '总线异常', label: '总线异常' },
        { from: 'L5_HW', to: 'ROOT', event: '硬件异常', label: '硬件异常' }
      ],
      auto: ['应用层正常', '系统调用正常', '驱动正常', '总线正常', '硬件异常'],
      note: '真实定位不一定线性：某一层异常后，仍要问“为什么这一层会遇到异常”。二分法的作用是快速缩小证据范围，而不是替代根因分析。'
    },
    case: {
      tag: '工程现场 · 偶发超时',
      title: 'Modbus 每小时超时一次，先砍掉哪一半？',
      scene: 'SCADA 每小时报一次读超时。团队先抓包：请求发出、响应未回，说明应用层无问题；再在驱动加计数，发现收到帧但未唤醒用户线程；最终定位为 poll 条件检查顺序错误，偶发丢唤醒。修复后 72 小时无超时。',
      metrics: ['1 次/小时', '3 层证据', '1 个 poll 竞态', '72 小时验证'],
      points: [
        '先抓包确定“请求有没有发出、响应有没有回来”。',
        '驱动层计数能区分“没收到”和“收到没上报”。',
        '偶发问题要延长验证时间，并记录统计分布。',
        '每次定位都把证据留档，下次同类问题能复用。'
      ],
      ask: '如果抓包显示请求根本没发出，二分应该从哪一层开始？'
    },
    quiz: [
      {
        q: '五层二分法的第一刀通常切在哪里？',
        options: ['直接换硬件', '先区分应用/系统调用与更底层', '先改内核配置', '先重装工具链'],
        answer: 1,
        exp: '先用日志/抓包/strace 确定问题在软件上层还是底层，能最快缩小范围。'
      },
      {
        q: '驱动收到数据但用户态读不到，最值得检查的是？',
        options: ['CPU 主频', '唤醒机制（wait queue/poll）与缓冲区状态', 'LED 极性', 'SD 卡容量'],
        answer: 1,
        exp: '数据到达但未被消费，常见于唤醒丢失、条件检查顺序或缓冲区未更新。'
      }
    ]
  },

  ch26: {
    title: '互动实验室 · 需求如何变成架构',
    lead: '架构不是画得漂亮，而是把需求里的约束翻译成模块边界和接口。按顺序走一遍，看看每个决定对应哪条需求。',
    widget: {
      title: '从需求到总体架构：六步',
      sub: '点击步骤查看输入、输出与关键决策。',
      type: 'flow',
      steps: [
        { title: '识别干系人与场景', desc: '操作工、电工、设备科、SCADA、MES 各自关心什么。', tag: '需求' },
        { title: '量化约束', desc: 'IO 点数、扫描周期、环境温度、可用性、认证边界。', tag: '指标' },
        { title: '划分实时边界', desc: '哪些必须由 PL 保证，哪些可以交给 Linux，哪些不能由本系统承担。', tag: 'PS/PL' },
        { title: '定义接口合同', desc: '寄存器映射、Modbus 地址表、Web API、升级协议。', tag: '接口' },
        { title: '选择技术栈', desc: 'UIO vs 自定义驱动、Modbus TCP vs RTU、Web 框架与依赖。', tag: '选型' },
        { title: '记录架构决策', desc: 'ADR 写清背景、选项、取舍与后果，方便后来人。', tag: 'ADR' }
      ],
      faults: [
        { at: 2, label: '把所有任务都放 Linux', title: '缺少确定性边界', symptom: '扫描周期随网络/日志抖动。实时 IO 时序应下沉 PL 或隔离核。' },
        { at: 4, label: '接口没有文档', title: '软硬件各写各的', symptom: '寄存器偏移、字节序、单位不一致。先冻结映射表，再并行开发。' }
      ],
      note: '好的架构让变化局部化：换 Web 框架不影响扫描，换 IO 模块不影响协议。接口合同就是这种隔离层。'
    },
    case: {
      tag: '工程现场 · 需求评审',
      title: '“响应要快”不是需求',
      scene: '客户最初只写“操作响应要快”。评审时被追问：从按钮到 DO 动作多少毫秒？从 SCADA 写入到生效多少毫秒？断电后输出什么状态？最终量化为：本地 IO ≤ 5 ms、SCADA ≤ 50 ms、断电 DO 全断。',
      metrics: ['≤ 5 ms 本地', '≤ 50 ms 远程', '断电安全态', '可验收'],
      points: [
        '把形容词变成数字、条件和测量方法。',
        '区分本地闭环与远程链路的实时预算。',
        '安全状态要在需求阶段定义，而不是最后补。',
        '每条需求都要有验收方法，否则无法结项。'
      ],
      ask: '如果客户要求“远程响应 ≤ 5 ms”，你会怎么判断这个需求是否合理？'
    },
    quiz: [
      {
        q: '架构阶段最重要的输出之一是？',
        options: ['完整的 UI', '模块边界与接口合同', '最终 BOM', '所有源代码'],
        answer: 1,
        exp: '接口合同让软硬件、应用与驱动可以并行开发，并能在集成时快速定位不一致。'
      },
      {
        q: '“响应快”应该被改写成？',
        options: ['尽量快', '可测量的时延指标 + 测试条件', 'CPU 主频越高越好', '使用实时内核'],
        answer: 1,
        exp: '没有测量条件与阈值的“快”无法验收，也无法指导设计。'
      }
    ]
  },

  ch27: {
    title: '互动实验室 · 一个寄存器就是一份合同',
    lead: 'IO 引擎的寄存器不是随便排的：每个位都有读写属性、复位值和时序含义。点击位与字段，理解软件和 RTL 如何共享这份合同。',
    widget: {
      title: 'IO_CTRL 寄存器：8 路 DO + 滤波 + 版本',
      sub: '点击位翻转，或选择字段查看含义。VERSION 为只读，软件不应写入。',
      type: 'bits',
      width: 32,
      value: '0x02000C01',
      title: 'IO_CTRL @ 0x43C00000',
      fields: [
        { name: 'EN', msb: 0, lsb: 0, color: '#22d3ee', desc: '全局使能。0 时 DO 强制安全态，1 时按 DO 字段输出。' },
        { name: 'MODE', msb: 2, lsb: 1, color: '#60a5fa', desc: '00 直通，01 取反，10 PWM，11 保留。模式切换应先清零 EN。' },
        { name: 'DIR', msb: 10, lsb: 3, color: '#34d399', desc: '8 路方向：1 输出，0 输入。上电默认全输入。' },
        { name: 'DO', msb: 18, lsb: 11, color: '#fbbf24', desc: '8 路输出电平。写入后在下一次 IO 刷新生效。' },
        { name: 'IRQ_EN', msb: 19, lsb: 19, color: '#fb923c', desc: 'DI 变化中断使能。清中断前必须先读 DI 快照。' },
        { name: 'FILTER', msb: 23, lsb: 20, color: '#a78bfa', desc: 'DI 去抖时间选择：0=关，1=1 ms，2=2 ms，…，15=15 ms。' },
        { name: 'VERSION', msb: 31, lsb: 24, color: '#94a3b8', desc: '只读 IP 版本。驱动 probe 时读取并与预期比对，防止 bit 与驱动不匹配。' }
      ],
      note: '寄存器文档必须包含：偏移、名称、位域、读写属性、复位值、时钟域、副作用。缺一项，软件就可能写出“偶发”的 bug。'
    },
    case: {
      tag: '工程现场 · DI 误动作',
      title: '变频器一启动，DI 就抖一下',
      scene: '产线变频器启动时，PLC 的 DI4 偶发误触发，导致气缸误动作。示波器看到 DI 线上有 1.5 ms 的振铃。硬件加了 RC 与TVS，PL 侧把 FILTER 从 0 改为 4（4 ms），误动作消失。',
      metrics: ['1.5 ms 振铃', '4 ms 滤波', '1 路 DI', '0 误动作'],
      points: [
        '滤波时间要大于干扰持续时间，小于真实信号最小脉宽。',
        '硬件滤波与软件/PL 滤波要配合，不能只靠一边。',
        '滤波会引入延迟，安全信号要单独评估。',
        '寄存器字段要能在现场调整，而不是重新综合。'
      ],
      ask: '如果真实输入脉宽只有 2 ms，而干扰持续 4 ms，滤波时间该怎么定？'
    },
    quiz: [
      {
        q: '驱动 probe 时读 VERSION 寄存器的主要目的是？',
        options: ['提高主频', '确认 IP 与驱动版本匹配，避免寄存器布局不一致', '校准 DDR', '启动 Web'],
        answer: 1,
        exp: '版本寄存器是软硬件合同的一部分，能提前发现 bit 与驱动错配。'
      },
      {
        q: 'DI 滤波时间的选择应满足？',
        options: ['越大越好', '大于干扰持续时间且小于最小有效脉宽', '等于时钟周期', '固定 1 ms'],
        answer: 1,
        exp: '滤波过大漏掉真实脉冲，过小滤不掉干扰；应夹在两者之间。'
      },
      {
        q: 'DO 上电默认状态应设计为？',
        options: ['全部导通', '安全态（通常全部断开），直到软件使能', '随机', '跟随上次状态'],
        answer: 1,
        exp: '上电与复位期间输出应处于安全态，避免执行器误动作。'
      }
    ]
  },

  ch28: {
    title: '互动实验室 · UIO 把中断交给用户态',
    lead: 'UIO 不是“省掉驱动”，而是把“寄存器映射 + 中断”这两件通用事做好，把策略留给用户态。',
    widget: {
      title: 'UIO 中断路径：PL → GIC → /dev/uio0 → 应用',
      sub: '点击步骤查看内核与用户态各自负责什么。',
      type: 'flow',
      steps: [
        { title: 'PL 产生中断', desc: 'IO 引擎在 DI 变化或周期到时拉高 IRQ，保持到被清除。', tag: 'PL' },
        { title: 'GIC 路由', desc: '设备树 interrupts 指定 SPI 号，内核 UIO 驱动注册处理函数。', tag: 'GIC' },
        { title: 'UIO 内核侧', desc: 'uio_pdrv_genirq 屏蔽中断并唤醒等待队列，不处理业务。', tag: 'Kernel' },
        { title: '用户态 read()', desc: 'read(/dev/uio0) 阻塞，返回中断计数；应用被唤醒。', tag: 'User' },
        { title: '处理并重新使能', desc: '读寄存器、清中断源，写 UIO 的 enable 属性重新开中断。', tag: 'ACK' },
        { title: '避免中断风暴', desc: '若不清源就重新使能，会立即再次进入，CPU 占满。', tag: '边界' }
      ],
      faults: [
        { at: 4, label: '忘记清源', title: '中断持续挂起', symptom: '应用占满 CPU，系统变慢；先清外设中断源，再重新使能 UIO。' },
        { at: 1, label: '中断号错', title: 'DTS 与 Vivado 不一致', symptom: '/dev/uio0 能打开但永远不返回。对照地址编辑器与 interrupts 属性。' }
      ],
      note: 'UIO 适合寄存器简单、实时性要求高的自定义 IP；复杂设备仍应写内核驱动，以获得 DMA、电源管理和标准子系统支持。'
    },
    case: {
      tag: '工程现场 · 实时 IO',
      title: 'UIO 中断延迟 8 µs，够不够？',
      scene: '软 PLC 需要 1 ms 内响应 DI 变化。UIO 方案实测从引脚变化到用户态读到的延迟为 8–15 µs，满足要求；但网络中断与日志会造成偶发 200 µs 抖动。最终把 UIO 线程绑定隔离核并设实时优先级。',
      metrics: ['8–15 µs', '200 µs 抖动', '1 ms 预算', '隔离核'],
      points: [
        'UIO 延迟低，但仍受调度与系统负载影响。',
        '中断线程要绑定 CPU、设优先级、避免锁与内存分配。',
        '先测最坏延迟，再决定是否需要内核驱动或 PL 硬件处理。',
        '中断清源与重新使能的顺序必须严格。'
      ],
      ask: '如果要求 2 µs 响应，UIO 还合适吗？替代方案是什么？'
    },
    quiz: [
      {
        q: 'UIO 驱动的主要职责是？',
        options: ['实现完整协议栈', '映射寄存器并转发中断，策略留给用户态', '替代 Linux 内核', '管理文件系统'],
        answer: 1,
        exp: 'UIO 提供通用的内存映射与中断等待机制，业务逻辑在用户态实现。'
      },
      {
        q: 'UIO 中断线程被唤醒后必须做什么？',
        options: ['立即 sleep', '清外设中断源并重新使能 UIO 中断', '重启系统', '关闭 GIC'],
        answer: 1,
        exp: '否则中断源持续有效，会导致中断风暴或再也收不到新中断。'
      }
    ]
  },

  ch29: {
    title: '互动实验室 · 扫描周期里的三条线程',
    lead: '软 PLC 的实时性来自“职责分离”：扫描线程只做确定性逻辑，IO 与通信各自在自己的节奏上。',
    widget: {
      title: '10 ms 内的运行时协作',
      sub: '每格 0.5 ms。观察扫描、IO 刷新、通信与 Web 的相对位置。',
      type: 'sched',
      ticks: 20,
      labelEvery: 5,
      phases: [
        { at: 0, label: '扫描开始' },
        { at: 2, label: 'IO 快照' },
        { at: 6, label: '通信窗口' },
        { at: 10, label: '下一周期' },
        { at: 16, label: 'Web 刷新' }
      ],
      rows: [
        { name: 'Scan 线程', sub: '2 ms 周期 / 实时', color: '#22d3ee', segments: [[0,2,'LOGIC'],[2,3,'OUT'],[6,8,'LOGIC'],[10,12,'LOGIC'],[12,13,'OUT'],[14,16,'LOGIC'],[18,20,'LOGIC']] },
        { name: 'IO 线程', sub: '1 ms 快照', color: '#34d399', segments: [[0,1,'DI'],[2,3,'DO'],[4,5,'DI'],[6,7,'DO'],[10,11,'DI'],[12,13,'DO'],[16,17,'DI'],[18,19,'DO']] },
        { name: 'Modbus / Web', sub: '非实时', color: '#60a5fa', segments: [[3,4,'RX'],[8,10,'WEB'],[13,14,'RX'],[17,18,'TX']] }
      ],
      note: '扫描线程只读 IO 映像、执行逻辑、写输出映像；真正的硬件读写由 IO 线程完成。双缓冲/原子交换避免半更新数据。'
    },
    case: {
      tag: '工程现场 · 扫描抖动',
      title: '1 ms IO 刷新，为什么扫描读到“半新半旧”？',
      scene: '运行时把 DI 结构体逐字段拷贝给逻辑线程，拷贝途中 IO 线程更新了后半部分，导致一个扫描周期里同时出现新旧数据，气缸动作错位。改为双缓冲 + 原子指针交换后问题消失。',
      metrics: ['16 DI', '2 个线程', '半更新窗口', '原子交换'],
      points: [
        '共享映像必须有明确的同步策略，不能“反正只有几个字节”。',
        '双缓冲让读侧看到一致快照，写侧在后台准备下一帧。',
        '原子指针/序列锁比逐字段拷贝更可靠。',
        '用压力测试与故障注入验证并发正确性。'
      ],
      ask: '如果只加一把互斥锁保护整个映像，会带来什么代价？'
    },
    quiz: [
      {
        q: 'IO 映像采用双缓冲的主要目的是？',
        options: ['节省 Flash', '让逻辑线程读到一致快照，避免半更新', '提高串口波特率', '替代看门狗'],
        answer: 1,
        exp: '双缓冲把读写分离，配合原子切换可避免撕裂读（torn read）。'
      },
      {
        q: '扫描线程中执行 malloc 或阻塞 IO 的主要风险是？',
        options: ['编译失败', '引入不确定延迟，破坏周期', '损坏 PL', '提高实时性'],
        answer: 1,
        exp: '实时线程应避免不可预测的阻塞与内存分配，所有资源预先准备。'
      }
    ]
  },

  ch30: {
    title: '互动实验室 · 一条梯形图如何被“执行”',
    lead: '梯形图不是画给 PLC 看的，而是编译成指令、由虚拟机每个扫描周期执行。先点按钮看启保停，再切换标签看编译链路。',
    widget: {
      title: '启保停：扫描、锁存与输出',
      sub: '点击 START/STOP 改变输入，观察 M0 自锁与 DO0 输出。',
      type: 'ladder',
      cycle: '2 ms',
      inputs: [
        { id: 'START', label: '启动 SB1' },
        { id: 'STOP', label: '停止 SB2' }
      ],
      rungs: [
        { blocks: [[{ var: 'START' }, { var: 'M0' }], [{ var: 'STOP', nc: true }]], coil: 'M0' },
        { blocks: [[{ var: 'M0' }]], coil: 'DO0' }
      ],
      views: [
        {
          label: '梯形图扫描',
          type: 'ladder',
          cycle: '2 ms',
          inputs: [
            { id: 'START', label: '启动 SB1' },
            { id: 'STOP', label: '停止 SB2' }
          ],
          rungs: [
            { blocks: [[{ var: 'START' }, { var: 'M0' }], [{ var: 'STOP', nc: true }]], coil: 'M0' },
            { blocks: [[{ var: 'M0' }]], coil: 'DO0' }
          ],
          note: '第一行：START 与 M0 并联，再串联 STOP 的常闭触点。按下启动，M0 得电并自锁；按下停止，常闭触点断开，M0 失电。'
        },
        {
          label: 'LD → IL → VM',
          type: 'flow',
          steps: [
            { title: 'LD 源程序', desc: '操作员用触点、线圈画出启保停；编辑器保存为结构化文本/JSON。', tag: '源' },
            { title: '解析 Parser', desc: '检查语法、变量是否存在、触点/线圈配对；错误要能定位到行。', tag: '编译' },
            { title: '生成 IL', desc: '把并联/串联翻译成 LD/AND/OR/OUT 等指令序列。', tag: '中间码' },
            { title: '虚拟机执行', desc: '每个扫描周期从头执行指令，读写映像区，最后统一刷新输出。', tag: 'VM' },
            { title: '输出与监控', desc: 'DO 映像写入硬件；Web/调试器读取同一映像，看到一致状态。', tag: '结果' }
          ],
          note: '编译与执行分离，让逻辑可以在 PC 上仿真、在板卡上执行；也便于下载、校验与回滚。'
        }
      ]
    },
    case: {
      tag: '工程现场 · 老程序迁移',
      title: '电工师傅的启保停，为什么“按一下停不下来”？',
      scene: '把老继电器柜的启保停照搬到软 PLC 后，按下启动就停不下来。检查发现 STOP 用了常开触点（应常闭），且 M0 自锁与 START 的并联关系画成了串联。重新按梯形图语义编译后正常。',
      metrics: ['1 条回路', '1 个常闭', '1 处并联', '0 行 C 代码'],
      points: [
        '常开/常闭描述的是“未动作时的通断”，不是按钮的物理外观。',
        '自锁必须把线圈状态并联到启动触点。',
        '扫描顺序影响同一周期内的中间变量，要理解“先读后写”。',
        '让电工参与验收：他们能一眼看出逻辑是否符合现场习惯。'
      ],
      ask: '如果把 STOP 接成常开，现场会发生什么？这是否可以作为“停止优先”的失效安全设计？'
    },
    quiz: [
      {
        q: '启保停回路中，M0 自锁触点应与哪个元件并联？',
        options: ['STOP 常闭', 'START 启动触点', '输出负载', '电源'],
        answer: 1,
        exp: '启动后 M0 得电，其常开触点并联在 START 两端，松开 START 后仍保持通路。'
      },
      {
        q: 'STOP 使用常闭触点的安全意义是？',
        options: ['接线更短', '断线时回路断开，设备倾向停止', '提高扫描速度', '减少 IO 点数'],
        answer: 1,
        exp: '常闭回路在断线/失电时呈断开状态，符合失效安全（fail-safe）思路。'
      },
      {
        q: '虚拟机每个扫描周期通常如何更新输出？',
        options: ['每条指令立即写硬件', '先执行完逻辑，再统一刷新输出映像', '每秒刷新一次', '只在启动时刷新'],
        answer: 1,
        exp: '集中刷新保证同一周期内逻辑看到一致状态，避免输出抖动。'
      }
    ]
  },

  ch31: {
    title: '互动实验室 · 定时器与星三角的节拍',
    lead: '定时器不是“sleep”，而是每个扫描周期累加/比较的状态机。拖动时间轴，看 K1/K2/K3 在什么时刻切换。',
    widget: {
      title: '星三角降压启动：24 拍时序',
      sub: '每拍 100 ms（示例）。注意星形与三角形之间必须有切换间隔，避免短路。',
      type: 'wave',
      views: [
        {
          label: '星三角时序',
          type: 'wave',
          signals: [
            { name: 'START', values: [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], color: '#60a5fa' },
            { name: 'K1 主接触器', values: [0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], color: '#34d399' },
            { name: 'K2 星形', values: [0,0,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], color: '#fbbf24' },
            { name: 'K3 三角', values: [0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1], color: '#fb923c' },
            { name: 'TON.Q', values: [0,0,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], color: '#a78bfa' }
          ],
          markers: [{ tick: 2, label: 'K1 吸合' }, { tick: 3, label: '星形启动' }, { tick: 9, label: '星形断开' }, { tick: 10, label: '三角吸合' }],
          chips: ['切换间隔 ≥ 100 ms', 'K2/K3 必须互锁', '定时器每周期更新', '过载保护独立'],
          tickUnit: ' ×100 ms',
          note: '星三角切换必须保证 K2 与 K3 不同时闭合，否则电源相间短路。硬件互锁 + 软件互锁 + 时间间隔三重保护。'
        },
        {
          label: 'TON 参数计算',
          type: 'calc',
          formulaText: 'T = prescaler × preset / f_clk；分辨率 = prescaler / f_clk',
          inputs: [
            { id: 'fclk', label: '定时器时钟', min: 1, max: 100, step: 1, value: 50, unit: ' MHz', decimals: 0 },
            { id: 'presc', label: '预分频 prescaler', min: 1, max: 256, step: 1, value: 100, unit: '', decimals: 0 },
            { id: 'preset', label: '预装值 preset', min: 100, max: 65535, step: 1, value: 25000, unit: '', decimals: 0 }
          ],
          primary: { label: '定时时间 T', expr: 'presc * preset / (fclk * 1000000) * 1000', unit: 'ms', decimals: 1, note: '示例默认值：50 MHz / 100 分频 × 25000 = 50 ms。' },
          outputs: [
            { label: '计数分辨率', expr: 'presc / fclk', unit: 'µs', decimals: 2 },
            { label: '可定时最大值', expr: 'presc * 65535 / (fclk * 1000000) * 1000', unit: 'ms', decimals: 1 }
          ],
          bar: { expr: 'presc * preset / (fclk * 1000000) * 1000 / 500 * 100', danger: false },
          verdict: { expr: 'presc * preset / (fclk * 1000000) * 1000 >= 3 && presc * preset / (fclk * 1000000) * 1000 <= 10', good: '定时时间落在 3–10 s 的常见星三角切换窗口内（仅示例）。', bad: '当前定时不在 3–10 s 示例窗口；请按电机功率与工艺要求调整。' },
          note: '定时精度受时钟误差、中断延迟与扫描周期影响。安全相关延时不能只依赖软件定时器。'
        }
      ]
    },
    case: {
      tag: '工程现场 · 星三角',
      title: '切换间隔少 40 ms，接触器炸了',
      scene: '现场调试时把星三角切换间隔从 150 ms 改成 50 ms，结果 K2 灭弧未完成 K3 就吸合，相间短路炸毁接触器。教训：软件定时器只负责逻辑，切换间隔必须按接触器灭弧时间与硬件互锁设计。',
      metrics: ['150 ms → 50 ms', '2 个接触器', '1 次短路', '硬件互锁'],
      points: [
        '星三角切换间隔由接触器特性决定，不是随便填。',
        '软件互锁不能替代硬件互锁。',
        '定时器 Q 位在扫描周期更新，实际动作有 1–2 个周期延迟。',
        '调试参数要记录变更，并做故障复现。'
      ],
      ask: '如果扫描周期为 5 ms，TON 的设定时间会有多大误差？'
    },
    quiz: [
      {
        q: 'TON 定时器的 Q 位通常在什么时候更新？',
        options: ['每个扫描周期比较当前值后', '只在程序下载时', '每秒一次', '由硬件自动清零'],
        answer: 0,
        exp: 'TON 在当前值达到预设值时置位 Q，更新发生在扫描周期内，因此有周期级延迟。'
      },
      {
        q: '星三角切换中 K2 与 K3 必须？',
        options: ['同时吸合', '硬件与软件双重互锁，且留切换间隔', '只靠软件互锁', '只靠操作员确认'],
        answer: 1,
        exp: '两者同时闭合会造成相间短路，必须硬件互锁并留足灭弧时间。'
      }
    ]
  },

  ch32: {
    title: '互动实验室 · 拆开一帧 Modbus TCP',
    lead: '协议调试最有效的能力是“逐字节读”。先看一帧请求的 MBAP 与 PDU，再看服务器如何分发功能码。',
    widget: {
      title: 'Modbus TCP 读保持寄存器（FC03）',
      sub: '点击字节查看含义；切换标签看服务器处理路径。',
      type: 'frame',
      views: [
        {
          label: '请求帧逐字节',
          type: 'frame',
          ascii: false,
          endian: '大端（网络字节序）',
          title: 'MBAP + PDU · 12 bytes',
          bytes: [
            { hex: '00', label: '事务 ID 高', desc: '客户端生成，服务器原样返回；用于匹配请求与响应。' },
            { hex: '01', label: '事务 ID 低', desc: '事务 ID = 0x0001。' },
            { hex: '00', label: '协议 ID 高', desc: 'Modbus 固定为 0x0000。' },
            { hex: '00', label: '协议 ID 低', desc: '非 0 表示不是 Modbus，服务器应丢弃。' },
            { hex: '00', label: '长度高', desc: '后续字节数（Unit ID + PDU）。' },
            { hex: '06', label: '长度低', desc: '长度 = 6：Unit(1) + FC(1) + 地址(2) + 数量(2)。' },
            { hex: '01', label: '单元 ID', desc: '从站地址；TCP 网关常用它区分串口从站。' },
            { hex: '03', label: '功能码 FC03', desc: '读保持寄存器。FC01 读线圈，FC04 读输入寄存器，FC06 写单个寄存器。' },
            { hex: '00', label: '起始地址高', desc: '寄存器地址 0x0000，对应文档中的 40001（协议地址 0 基）。' },
            { hex: '00', label: '起始地址低', desc: '地址 0。' },
            { hex: '00', label: '数量高', desc: '读取 10 个寄存器。' },
            { hex: '0A', label: '数量低', desc: '数量 = 10；注意最大数量限制。' }
          ],
          fields: [
            { name: 'MBAP 头', from: 0, to: 6, color: '#22d3ee', desc: '事务 ID(2) + 协议 ID(2) + 长度(2) + 单元 ID(1)。TCP 专有。' },
            { name: 'PDU', from: 7, to: 11, color: '#fbbf24', desc: '功能码 + 数据。与 RTU 的 PDU 相同，只是外面多了 MBAP。' },
            { name: '地址', from: 8, to: 9, color: '#34d399', desc: '协议地址从 0 开始；上位机常显示 40001，差 1 是最常见的坑。' },
            { name: '数量', from: 10, to: 11, color: '#a78bfa', desc: '读取寄存器个数，响应长度 = 3 + 2×数量。' }
          ],
          note: 'Wireshark 里看到的是字节；PLC 文档里写的是 40001。协议地址 0 = 40001，因此读写时通常要减 1。'
        },
        {
          label: '服务器处理路径',
          type: 'flow',
          steps: [
            { title: '接收 TCP 数据', desc: '按 MBAP 长度字段切帧，处理粘包/半包。', tag: 'Socket' },
            { title: '校验 MBAP', desc: '协议 ID 必须为 0，长度合理，单元 ID 匹配。', tag: '校验' },
            { title: '分发功能码', desc: 'FC03 → 读保持寄存器；越界或非法功能码返回异常响应。', tag: 'Dispatch' },
            { title: '访问映像区', desc: '通过统一映像区读写，保证与扫描线程一致。', tag: 'Image' },
            { title: '组响应', desc: '字节数 = 2×数量；数据大端排列；事务 ID 原样返回。', tag: 'Response' },
            { title: '异常处理', desc: 'FC | 0x80 + 异常码（02 非法地址，03 非法数据值）。', tag: 'Exception' }
          ],
          faults: [
            { at: 1, label: '单元 ID 不匹配', title: '请求被静默丢弃', symptom: '客户端超时，服务器日志无异常。检查网关配置与 Unit ID。' },
            { at: 3, label: '地址差 1', title: '读到相邻寄存器', symptom: '温度值看起来“像但不对”。确认文档是 0 基还是 1 基。' }
          ],
          note: '实现 Modbus 从站，70% 的工作量在边界处理：长度、越界、异常码、并发与字节序。'
        }
      ]
    },
    case: {
      tag: '工程现场 · SCADA 联调',
      title: '温度值总是高 0.1℃，地址差了一个',
      scene: 'SCADA 读到的温度比实际高 0.1℃，且流量值完全对不上。抓包发现请求起始地址为 0x0000，而 PLC 文档写的是 40001；工程师按“地址减 1”处理后，温度正常但流量仍错位，最终发现映像区把 float 拆成两个寄存器时高低字顺序反了。',
      metrics: ['2 个故障', '1 个地址偏移', '1 个字节序', '抓包定位'],
      points: [
        '地址基准（0/1）与数据类型（float 高低字）是两个独立问题。',
        '先用已知常量寄存器验证地址，再验证数据类型。',
        '响应异常码要记录，不要只报“通信失败”。',
        'Modbus 映射表要写明类型、字节序、单位和缩放。'
      ],
      ask: '如果读到的 float 是 0.1 而不是 25.0，你会先怀疑地址、字节序还是缩放？'
    },
    quiz: [
      {
        q: 'Modbus TCP 的 MBAP 头不包括以下哪项？',
        options: ['事务 ID', '协议 ID', '长度', 'CRC16'],
        answer: 3,
        exp: 'TCP 由以太网/ IP 校验，不需要 RTU 的 CRC16；MBAP 包含事务 ID、协议 ID、长度、单元 ID。'
      },
      {
        q: '文档写 40001，协议报文中的起始地址通常是？',
        options: ['40001', '1', '0', '65535'],
        answer: 2,
        exp: 'Modbus 协议地址从 0 开始，40001 对应协议地址 0；具体以实现文档为准。'
      },
      {
        q: '服务器收到非法功能码时，正确响应是？',
        options: ['直接断开连接', '返回 FC|0x80 与异常码 01', '返回全 0 数据', '重启'],
        answer: 1,
        exp: '异常响应把功能码最高位置 1，并附带异常码；非法功能码对应 01。'
      }
    ]
  },

  ch33: {
    title: '互动实验室 · 浏览器里看到的是哪份数据',
    lead: 'Web 监控看似简单，真正的问题是“实时性、一致性和故障可见性”。点击节点与故障，看看数据从哪来、在哪里可能变旧。',
    widget: {
      title: '从浏览器到 IO：一条监控数据链',
      sub: '点击节点查看职责；故障注入观察是“断”还是“旧”。',
      type: 'net',
      path: ['browser', 'server', 'runtime', 'plc'],
      altPath: ['browser', 'server', 'runtime', 'plc'],
      nodes: [
        { id: 'browser', name: '浏览器', sub: 'HMI / 手机', x: 90, y: 80, desc: '轮询或 WebSocket 获取数据；断线后必须显示“数据已过期”，不能继续显示旧值。' },
        { id: 'server', name: 'Web 服务', sub: 'HTTP / JSON', x: 300, y: 80, desc: '鉴权、限流、序列化；不能直接阻塞扫描线程。' },
        { id: 'runtime', name: '运行时', sub: '映像区', x: 500, y: 80, desc: '提供一致快照；读写通过锁或双缓冲，避免 Web 看到半更新。' },
        { id: 'plc', name: 'PL / IO', sub: '硬件', x: 500, y: 230, desc: '真实 IO 状态；刷新周期与扫描周期分离。' }
      ],
      links: [
        { from: 'browser', to: 'server', label: 'HTTP/WS' },
        { from: 'server', to: 'runtime', label: '共享内存' },
        { from: 'runtime', to: 'plc', label: 'UIO/寄存器' }
      ],
      faults: [
        { label: '网络断开', node: 'browser', desc: '页面应显示“离线/数据过期”，本地保留最后一次值会造成误判。' },
        { label: '服务阻塞', node: 'server', desc: 'Web 线程阻塞会拖慢运行时；应异步读取快照并限流。' },
        { label: '快照不一致', node: 'runtime', desc: '逐字段读取可能得到半新半旧的数据；用序列号或双缓冲保证一致性。' }
      ],
      aria: 'Web 监控数据链拓扑',
      note: '监控界面的第一原则：宁可显示“未知”，也不要显示错误但看似合理的旧值。'
    },
    case: {
      tag: '工程现场 · 远程监控',
      title: '手机上显示运行，现场其实已停机',
      scene: '客户在手机上看到产线“运行中”，到现场发现已停机 20 分钟。原因是页面轮询失败后保留了最后一次 JSON，且没有时间戳。改为：每次响应带服务器时间与序列号，超过 3 秒未更新显示“数据过期”。',
      metrics: ['20 分钟误判', '3 秒超时', '1 个时间戳', '0 旧值'],
      points: [
        '监控数据必须有时间戳与序列号，前端要能判断新鲜度。',
        '通信失败与设备停机是两种状态，不能混为一谈。',
        'Web 服务不能阻塞实时线程；读快照、异步序列化。',
        '写操作要二次确认、权限控制与审计日志。'
      ],
      ask: '如果网络恢复但设备仍停机，页面如何区分“数据恢复”与“设备恢复”？'
    },
    quiz: [
      {
        q: 'Web 页面轮询失败后，最安全的显示策略是？',
        options: ['继续显示最后一次值', '显示“数据过期/离线”并标出最后更新时间', '自动重启设备', '清空所有数据'],
        answer: 1,
        exp: '旧值可能误导操作员；必须明确标识数据新鲜度。'
      },
      {
        q: 'Web 服务读取 PLC 映像区时，最重要的要求是？',
        options: ['读取速度越快越好', '读到一致快照，不能半新半旧', '直接写硬件寄存器', '绕过鉴权'],
        answer: 1,
        exp: '一致性比极限速度更重要；双缓冲/序列锁能提供一致快照。'
      }
    ]
  },

  ch34: {
    title: '互动实验室 · 上电之后，谁来保证它活着',
    lead: '从“能跑”到“上电即用”，需要自启、看门狗、崩溃恢复与版本回滚四条防线。逐级点击，看看哪一级会救你一命。',
    widget: {
      title: '设备自愈链：init → 应用 → 看门狗 → 回滚',
      sub: '故障注入演示应用崩溃、死锁与升级失败。',
      type: 'flow',
      steps: [
        { title: '内核与 rootfs 启动', desc: '挂载分区、启动 init；关键服务按依赖顺序拉起。', tag: 'Boot' },
        { title: '启动业务应用', desc: '用 systemd/supervisor/rcS 启动，记录 PID、版本与启动时间。', tag: 'App' },
        { title: '应用心跳', desc: '应用周期性喂硬件看门狗；喂狗必须代表“业务真的在跑”。', tag: 'Heartbeat' },
        { title: '崩溃/死锁检测', desc: '进程退出由 supervisor 重启；死锁靠心跳超时触发复位。', tag: 'Recover' },
        { title: '升级与回滚', desc: 'A/B 分区、校验、切换；失败自动回退到上一版本。', tag: 'OTA' },
        { title: '现场可观测性', desc: '日志、复位原因、版本号、最后一次升级结果都要可查。', tag: 'Ops' }
      ],
      faults: [
        { at: 2, label: '在主循环里无脑喂狗', title: '看门狗失去意义', symptom: '业务死锁但喂狗线程仍运行，设备不重启。喂狗必须由业务健康检查驱动。' },
        { at: 4, label: '升级未校验', title: '半包镜像被写入', symptom: '重启后无法启动。写入后必须校验哈希/签名，再切换启动。' }
      ],
      note: '看门狗不是“定时重启器”，而是最后一道保险。先保证应用能自愈，再让看门狗兜底。'
    },
    case: {
      tag: '公共交通现场 · 车载终端',
      title: '司机说“黑屏”，后台却显示在线',
      scene: '公交终端黑屏但 4G 仍在线，后台看到心跳正常。根因是 HMI 进程崩溃后 supervisor 没有重启它，而看门狗由另一个线程喂着。改为：HMI 崩溃必须重启；心跳聚合 HMI、CAN、存储三项健康状态；连续失败触发整机复位。',
      metrics: ['1 个黑屏', '3 项健康检查', '1 个假心跳', '自动恢复'],
      points: [
        '“在线”不等于“可用”；健康检查要覆盖关键业务。',
        '进程守护与整机看门狗分层，先局部重启，最后整机复位。',
        '复位原因要持久化，否则现场无法复盘。',
        'A/B 升级与回滚要纳入出厂测试。'
      ],
      ask: '如果 HMI 每 10 分钟崩溃一次，你会先修 HMI 还是加重启？为什么？'
    },
    quiz: [
      {
        q: '看门狗喂狗逻辑最合理的位置是？',
        options: ['一个独立的高优先级线程无条件喂', '业务健康检查全部通过后喂', '在中断里喂', '启动时喂一次'],
        answer: 1,
        exp: '喂狗必须代表业务真的健康，否则死锁时仍会被喂，失去保护意义。'
      },
      {
        q: 'A/B 升级切换启动前必须？',
        options: ['删除旧分区', '校验新镜像完整性并确认可启动', '关闭电源', '格式化 SD 卡'],
        answer: 1,
        exp: '未校验的镜像可能导致设备变砖；校验通过后再切换启动指针。'
      }
    ]
  }

});
