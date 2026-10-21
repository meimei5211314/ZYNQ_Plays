/* ============================================================
   ZYNQ 讲义互动内容 · Part 1（第 1–17 章）
   ============================================================ */
window.ZX_LABS = Object.assign(window.ZX_LABS || {}, {

  ch01: {
    title: '工程现场 · 这条路通向什么',
    lead: '先别急着写代码。下面是一台真实设备的改造轮廓：它会把后面 50 章的知识点一个个“点亮”。看完再决定你的学习顺序。',
    case: {
      tag: '工程现场 · 产线改造',
      title: '三面继电器柜，换成一台 ZYNQ 控制器',
      scene: '某汽车零部件厂的 3 号装配线已经运行 11 年，控制逻辑散落在三面继电器柜里：时间继电器老化、故障只能靠电工逐根线查。改造目标不是“换块开发板”，而是把 <b>16 路 DI、12 路 DO、4 路模拟量</b> 接到一台 ZYNQ-7020 控制器上，并保留原有操作面板与 SCADA。',
      metrics: ['16 DI / 12 DO', '4 AI / 2 AO', '2 ms 扫描', '7×24 运行'],
      points: [
        '第 2 章决定 PS 与 PL 怎么分工：确定性 IO 时序放 PL，网络与文件系统放 Linux。',
        '第 9、17、27、28 章把“寄存器—驱动—用户态”这条链路打通。',
        '第 29–32 章实现 PLC 扫描、梯形图和 Modbus，让老电工能继续用熟悉的方式编程。',
        '第 44 章会明确一条边界：ZYNQ 做标准控制，急停与安全门必须由安全继电器/安全 PLC 承担。'
      ],
      ask: '如果老板要求“先做个能亮的 Demo”，你会先打通哪三章？为什么？'
    },
    quiz: [
      {
        q: '在这台控制器里，最适合放在 PL 侧的是哪一项？',
        options: ['Modbus TCP 协议栈', 'Web 监控页面', 'DI 滤波与 PWM 的确定性时序', '文件系统日志'],
        answer: 2,
        exp: 'PL 的价值是并行与确定性：去抖、PWM、编码器计数等对时序敏感的任务放 PL；协议栈、页面和日志属于 Linux 的强项。'
      },
      {
        q: '面对一个全新的 ZYNQ 平台，最稳的起步顺序是？',
        options: ['先读内核源码，再装工具链', '先跑通工具链与最小系统，再逐步加驱动和业务', '直接上软 PLC 项目，遇到问题再补基础', '先学 SeL4，再回头看 Linux'],
        answer: 1,
        exp: '先把“编译—下载—串口—启动”闭环跑通，后面每个知识点才有可验证的落脚点。直接上大项目会把工具链问题和业务问题混在一起。'
      }
    ]
  },

  ch02: {
    title: '架构判断 · 选型不是背参数',
    lead: '第 2 章已经有资源地图与 AXI 动画。这里补上一个真实决策：为什么这块板子不拆成“MCU + FPGA”两颗芯片？',
    case: {
      tag: '工程现场 · 架构选型',
      title: '省掉一颗 FPGA，代价是什么？',
      scene: '控制器的早期方案是 STM32 做主控、外挂一颗 Spartan-6 做 IO 扩展，两颗芯片通过 SPI 通信。问题出现在产线节拍提升后：STM32 轮询 16 路 DI 的抖动达到 800 µs，SPI 链路还会偶发丢帧。改用 ZYNQ 后，PL 直接并行采样，PS 通过 AXI 读取一致快照。',
      metrics: ['1 颗 SoC', '2×Cortex-A9', '4 个 HP 端口', '共享 DDR3'],
      points: [
        'PS 与 PL 共享 DDR：大批量采样数据走 HP 端口，控制寄存器走 GP 端口。',
        'HP 通路不自动保持 A9 Cache 一致；ACP 可在满足事务属性与配置条件时提供一致访问。Linux DMA 缓冲通过 DMA API 交接。',
        'PL 负责“准点采样”，PS 负责“决定怎么处理”，两者用 AXI 解耦。',
        '选型不是看主频，而是看数据通路、实时边界和软件生态是否匹配。'
      ],
      ask: '如果采样数据只有每秒 100 字节，还需要 HP 端口吗？'
    },
    quiz: [
      {
        q: 'PL 采集的高速数据要写入 PS 侧 DDR，优先走哪类 AXI 接口？',
        options: ['GP（通用）端口', 'HP（高性能）端口', 'MIO', 'JTAG'],
        answer: 1,
        exp: 'HP 端口为高吞吐数据通路设计，可直接访问 DDR；GP 更适合寄存器级控制访问，带宽和并发能力有限。'
      },
      {
        q: 'ZYNQ-7000 中，PL 写入 DDR 后，A9 读到的数据可能是旧值，主要原因是？',
        options: ['DDR 坏了', 'CPU cache 中缓存了旧数据，需要软件维护一致性', 'AXI 不支持写操作', '必须使用 JTAG 才能读'],
        answer: 1,
        exp: '经非一致 HP 通路接收 DMA 数据时，CPU 可能命中旧 Cache。设备完成后按 DMA API 把所有权同步给 CPU；不能在 DMA 写完后盲目 clean，把旧脏数据覆盖回 DDR。ACP 的一致访问另有事务与配置条件。'
      },
      {
        q: '“共享 DDR”对软硬件划分带来的关键好处是？',
        options: ['PL 不再需要时钟', '大数据不必在两颗芯片间通过窄串行链路搬运', '自动获得实时性', '可以省掉电源'],
        answer: 1,
        exp: '共享内存避免了 MCU+FPGA 方案里的片间搬运瓶颈，但软件必须自己处理一致性与带宽竞争。'
      }
    ]
  },

  ch03: {
    title: '互动实验室 · 从原理图反查一个引脚',
    lead: '读板不是“背引脚表”，而是一条可复现的证据链：功能 → 网络名 → Bank 电压 → 封装引脚 → XDC。点击流程逐级核对。',
    widget: {
      title: '五步反查：LED 到底接在哪个引脚？',
      sub: '真实项目里，约束写错往往不是语法问题，而是证据链断了一环。',
      type: 'flow',
      steps: [
        { title: '锁定功能与电平', desc: '确认是 LED、按键还是继电器输出；方向、电压域、驱动能力各是什么。', tag: '需求' , detail: '例如：LED 由 PL 驱动，3.3 V，低电平点亮。先把“现象”翻译成电气条件，再去翻图。' },
        { title: '在原理图搜索网络名', desc: '用网络名搜索，而不是凭 PCB 丝印猜。记录它连到哪个连接器、哪个 Bank。', tag: '证据' , detail: '丝印可能因为改版而错位；网络名与原理图页才是可追溯证据。把页码和版本号一起记下来。' },
        { title: '确认 Bank 与 VCCO', desc: '同一个引脚在不同 VCCO 下可能是 1.8 V 或 3.3 V，IOSTANDARD 必须匹配。', tag: '电压' , detail: '领航者板上 PL Bank 的 VCCO 由硬件决定。写错 IOSTANDARD 轻则不工作，重则长期过压损伤 IO。' },
        { title: '核对封装引脚号', desc: '以板卡原理图/手册为准，确认 PACKAGE_PIN 与封装一致，避免同名网络。', tag: '引脚' , detail: 'XC7Z020 的 CLG400 封装引脚号不是按 Bank 连续排列的，必须逐字核对。' },
        { title: '写 XDC 并回读验证', desc: '综合后打开 I/O Ports 或实现报告，确认引脚、标准、方向三项都生效。', tag: '验证' , detail: '推荐把约束按功能分组，并在版本库中保留。Vivado 的 I/O Ports 窗口是最快的回读证据。' }
      ],
      faults: [
        { at: 2, label: 'Bank 电压写错', title: '3.3 V 信号被约束成 LVCMOS18', symptom: '综合可能通过，但上板电平异常、输入阈值漂移，严重时会损伤 IO。先量 VCCO，再改 IOSTANDARD。' },
        { at: 3, label: '把 MIO 当 PL 引脚', title: '在 XDC 里给 MIO 写 PACKAGE_PIN', symptom: 'MIO 属于 PS 固定引脚，不受 PL 的 PACKAGE_PIN 约束；应通过 PS 配置或 EMIO/AXI GPIO 访问。' }
      ],
      note: '排查顺序永远是“电源 → 引脚 → 约束 → 逻辑”。跳过前两项直接改代码，通常只是浪费半天。'
    },
    case: {
      tag: '工程现场 · 读板',
      title: '一块“灯不亮”的板子，问题在约束不在代码',
      scene: '试产批次的 8 块板中有 2 块 LED 常亮、1 块完全不亮。代码与 bit 文件相同，最终发现：硬件把 LED 的公共端接到了 5 V，而 XDC 仍按 3.3 V 低电平点亮编写。不同批次的物料替代让极性反转。',
      metrics: ['3 个批次', '8 块样机', '2 种极性', '0 行 RTL 改动'],
      points: [
        '先量电压与极性，再判断是“逻辑错”还是“电气错”。',
        '把 LED 极性、有效电平写进硬件接口文档，别只留在某个人脑子里。',
        '约束文件要进版本库；丝印和原理图也要标注版本。',
        '试产阶段保留测试点，能让“灯不亮”在 5 分钟内定位。'
      ],
      ask: '如果板子已经贴片完成，怎样用最少飞线验证“极性假设”？'
    },
    quiz: [
      {
        q: 'XDC 中 IOSTANDARD 的选择首先取决于什么？',
        options: ['引脚编号', '该 Bank 的 VCCO 电压', '时钟频率', 'LED 颜色'],
        answer: 1,
        exp: 'IOSTANDARD 必须与所在 Bank 的供电电压和外部器件电平匹配；引脚编号只决定位置。'
      },
      {
        q: 'PS 的 MIO 引脚要输出一个 LED 信号，正确做法是？',
        options: ['在 XDC 里写 PACKAGE_PIN', '通过 PS 的 MIO 配置与 GPIO 驱动访问', '用 EMIO 自动映射', '接到 JTAG'],
        answer: 1,
        exp: 'MIO 是 PS 固定引脚，通过 PS 配置和 xgpiops/Linux GPIO 访问；只有引到 PL 的 EMIO 或 AXI GPIO 才由 PL 约束。'
      },
      {
        q: '综合通过、上板灯不亮，最先应该检查什么？',
        options: ['重装 Vivado', '电源、极性、引脚约束三项', '更换芯片', '把时钟改成 1 GHz'],
        answer: 1,
        exp: '先排除电气与约束问题，再怀疑逻辑。硬件问题在代码里是找不到答案的。'
      }
    ]
  },

  ch04: {
    title: '互动实验室 · 工具链是一条生产线',
    lead: '环境搭建的难点不是“装软件”，而是让 Windows、Ubuntu、板卡三端的版本与路径形成一个可重复的闭环。',
    widget: {
      title: '从源码到板卡：一次装对的最小闭环',
      sub: '每一步都有明确的产物；产物对不上，后面一定出问题。',
      type: 'flow',
      steps: [
        { title: '冻结版本矩阵', desc: 'Vivado/Vitis 2020.2、Ubuntu 18.04、PetaLinux 2020.2 一一对应，写进 README。', tag: '基线', detail: '版本矩阵要包含补丁号、安装路径、License 类型。团队里“我这儿能跑”不是证据。' },
        { title: 'Windows 侧：Vivado + Vitis', desc: '安装器件库、安装 Cable 驱动，确认 Hardware Manager 能识别 JTAG。', tag: 'FPGA' },
        { title: 'Ubuntu 侧：PetaLinux + SDK', desc: '安装依赖包，配置 tftp/nfs/串口权限，确保能交叉编译 ARM 程序。', tag: 'Linux' },
        { title: '导出 XSA 并生成平台', desc: 'Vivado 导出含 bitstream 的 XSA；Vitis/PetaLinux 以它为唯一硬件输入。', tag: '交接' },
        { title: '联调三件套', desc: '串口看启动、TFTP 下载镜像、NFS 挂载根文件系统；三条链路都能独立验证。', tag: '联通' , detail: '先用 ping 和串口确认物理链路，再谈应用。联调时把 IP、网段、网关写在白板上，避免“玄学网络”。' },
        { title: '自检脚本与版本冻结', desc: '用脚本检查工具版本、路径和串口；通过后打 tag，任何人可复现。', tag: '固化' }
      ],
      faults: [
        { at: 4, label: '三台机器补丁不一致', title: 'XSA 来自 2020.2，PetaLinux 却是 2020.1', symptom: '设备树或 FSBL 生成的产物不兼容，表现为启动早期卡死、DDR 初始化失败。版本必须成组冻结。' },
        { at: 2, label: '串口权限不足', title: 'brltty 占用 /dev/ttyUSB0', symptom: '终端能打开但无输出，或权限被拒。卸载 brltty、把用户加入 dialout，再重新插拔。' }
      ],
      note: '“环境问题”占嵌入式排障的一半。把环境本身当成一个可测试的交付物，而不是一次性劳动。'
    },
    case: {
      tag: '工程现场 · 团队协作',
      title: '同一份代码，三个人编出三个结果',
      scene: '项目组三人各自搭建环境，A 的 bit 文件能跑，B 的驱动加载失败，C 的 PetaLinux 镜像启动不了。根因不是代码，而是三人分别用了 Vivado 2020.1/2020.2、不同内核分支和不同交叉编译器。最终用一台共享构建机 + 版本矩阵解决。',
      metrics: ['3 人', '3 套环境', '1 台构建机', '0 个“玄学”'],
      points: [
        '环境版本必须成组管理：Vivado、Vitis、PetaLinux、内核、编译器缺一不可。',
        '构建产物加版本号与 git commit，问题才能回溯。',
        '共享构建机减少“我这里可以”的争论。',
        '自检脚本比口头约定可靠。'
      ],
      ask: '如果团队只能用 Windows，怎样保证 Linux 侧构建仍然可复现？'
    },
    quiz: [
      {
        q: 'XSA 文件在 Vitis/PetaLinux 流程中扮演什么角色？',
        options: ['只是一个压缩包', '硬件平台的唯一描述，包含 PS 配置与可选的 bitstream', 'Linux 内核镜像', 'JTAG 驱动'],
        answer: 1,
        exp: 'XSA 描述硬件：PS 外设、地址映射、中断和 PL 逻辑，是软件平台生成的输入。'
      },
      {
        q: '交叉编译出的 ARM 程序在板子上报 “not found”，但文件明明存在，常见原因是？',
        options: ['文件权限 777', '动态链接器/glibc 版本不匹配', '串口波特率错', '没插网线'],
        answer: 1,
        exp: '“No such file or directory” 可能是 ELF interpreter 不存在。用 file/readelf 检查架构与解释器，或改用匹配的 SDK。'
      }
    ]
  },

  ch05: {
    title: '互动实验室 · 看清一个状态机如何“走时钟”',
    lead: 'Verilog 的难点不是语法，而是脑内同时运行“并行电路”和“时间”。拖动时间轴，观察 start 被采样后状态如何逐拍迁移。',
    widget: {
      title: '三段式状态机：IDLE → START → RUN → STOP',
      sub: '每个上升沿采样一次；状态总线在时钟沿之后变化，组合输出跟随状态。',
      type: 'wave',
      signals: [
        { name: 'clk', values: [0,1,0,1,0,1,0,1,0,1,0,1,0,1], color: '#fbbf24' },
        { name: 'rst_n', values: [0,0,1,1,1,1,1,1,1,1,1,1,1,1], color: '#94a3b8' },
        { name: 'start', values: [0,0,0,1,1,0,0,0,0,0,0,0,0,0], color: '#60a5fa' },
        { name: 'state', values: ['IDLE','IDLE','IDLE','IDLE','START','START','RUN','RUN','RUN','STOP','IDLE','IDLE','IDLE','IDLE'], color: '#22d3ee' },
        { name: 'done', values: [0,0,0,0,0,0,0,0,0,1,0,0,0,0], color: '#34d399' }
      ],
      markers: [{ tick: 3, label: '采样 start' }, { tick: 6, label: '进入 RUN' }, { tick: 9, label: 'done 脉冲' }],
      chips: ['posedge 采样', '非阻塞赋值', '状态在沿后更新', '组合输出跟随'],
      tickUnit: ' 拍',
      note: '仿真器里的“沿后更新”来自非阻塞赋值的 delta 延迟。写 RTL 时永远用 <= 更新时序逻辑，用 = 描述组合逻辑；不要在同一个 always 里混用。'
    },
    case: {
      tag: '工程现场 · DI 去抖',
      title: '一个按键抖动，让产线停了 4 分钟',
      scene: '操作面板的启动按钮没有硬件滤波，机械抖动在 8 ms 内产生 7 个边沿。PL 把每个边沿都当成了“启动”，状态机在 START/RUN 之间反复跳转，气缸动作错位，触发安全门。最终在 PL 里加入 20 ms 稳定计数与单周期脉冲输出。',
      metrics: ['7 个抖动边沿', '20 ms 去抖', '50 MHz 时钟', '1 个脉冲/按下'],
      points: [
        '按键、限位、继电器触点都需要去抖；软件延时不如硬件计数确定。',
        '去抖后的“按下”应输出单周期脉冲，避免长按被重复执行。',
        'testbench 要主动注入抖动，而不是只测理想波形。',
        '状态机必须定义非法事件的处理方式，不能默默留在原地。'
      ],
      ask: '20 ms 去抖在 50 MHz 下需要计数多少次？如果时钟改为 100 MHz，参数该怎么改？'
    },
    quiz: [
      {
        q: '在一个时钟上升沿，a、b 初值分别为 1、0，执行 begin a = b; b = a; end，结果是什么？',
        options: ['a=0, b=1', 'a=0, b=0', 'a=1, b=1', 'a=1, b=0'],
        answer: 1,
        exp: '阻塞赋值按顺序立即生效：a 先被赋为 0，随后 b 读到新的 a，也被赋为 0。两个变量“交换失败”。'
      },
      {
        q: '若要实现真正的交换 a <= b; b <= a;，正确写法是？',
        options: ['把两条写成一条阻塞语句', '使用非阻塞赋值，让右侧在同一时刻采样旧值', '加一个 #1 延时', '把 always 改成 initial'],
        answer: 1,
        exp: '非阻塞赋值在时间步结束时统一更新，右侧读取的是沿前的旧值，因此能完成交换。'
      },
      {
        q: '三段式状态机中，次态逻辑通常用什么描述？',
        options: ['时序 always @(posedge clk)', '组合 always @(*)', 'initial 块', 'assign 到时钟'],
        answer: 1,
        exp: '次态是当前状态与输入的函数，属于组合逻辑；状态寄存器才是时序逻辑。'
      }
    ]
  },

  ch06: {
    title: '互动实验室 · 一次点击，背后发生了什么',
    lead: 'Vivado 的“Run Implementation”不是一个黑盒。把流程拆开，你才知道每个阶段失败时该看哪份报告。',
    widget: {
      title: '从 RTL 到 bitstream：FPGA 工程七步',
      sub: '点击节点查看产物与典型失败点；故障注入按钮演示三种常见翻车。',
      type: 'flow',
      steps: [
        { title: '建工程与选器件', desc: '器件型号必须与板上丝印/封装一致，否则引脚与资源全错。', tag: 'XC7Z020' },
        { title: 'RTL + XDC 约束', desc: '顶层端口、时钟、引脚、IOSTANDARD 四项齐全，才谈得上“能上板”。', tag: '输入' },
        { title: '综合 Synthesis', desc: '把 RTL 映射为 LUT/FF/BRAM/DSP；看综合报告中的推断结果与警告。', tag: 'RTL → 网表' },
        { title: '实现 Implementation', desc: '布局、布线、时序优化；关键看 WNS/TNS 与未约束路径。', tag: '网表 → 布局' },
        { title: '生成 bitstream', desc: '把配置数据写入 .bit；此时还没有“固化”，掉电即失。', tag: '.bit' },
        { title: 'JTAG 下载验证', desc: '用 Hardware Manager 下载，先确认时钟与复位，再看功能。', tag: '在线' },
        { title: 'QSPI/SD 固化', desc: '把 BOOT.BIN 写入非易失介质，配合启动模式开关完成脱机启动。', tag: '量产' }
      ],
      faults: [
        { at: 1, label: '引脚号写错', title: 'XDC 指向了封装中不存在的引脚', symptom: 'Implementation 报 IO placement 冲突或找不到端口；上板表现为灯不受控、时钟无输出。先回读 I/O Ports。' },
        { at: 3, label: '时钟未约束', title: 'create_clock 缺失', symptom: '报告里出现大量 unconstrained paths，时序“看起来通过”其实没检查；上板随温度/批次偶发。' },
        { at: 4, label: '只下载未固化', title: 'bitstream 只在 JTAG 下有效', symptom: '断电重启后 PL 为空，PS 可能仍在运行。需要 BOOT.BIN 或 QSPI 固化。' }
      ],
      note: '先看 Critical Warning，再看时序，再看功能。Vivado 的警告分级是有道理的，不要一键忽略。'
    },
    case: {
      tag: '工程现场 · 首板点亮',
      title: '流水灯只亮一颗，问题在“低电平有效”',
      scene: '首板 bring-up 时，4 位流水灯只亮 D2，且不流动。检查发现：LED 为共阳接法、低电平点亮，而代码按高电平有效输出；同时 50 MHz 时钟约束被误写成 100 MHz，时序报告全是红色。修正极性和时钟后一次通过。',
      metrics: ['4 位 LED', '共阳接法', '50 MHz 实际', '100 MHz 约束'],
      points: [
        '先确认“有效电平”，再写输出逻辑；硬件极性是需求的一部分。',
        '时钟约束必须来自板卡晶振与 MMCM 配置，不能凭感觉。',
        '首板只看现象不够，要回读 I/O Ports 与时序报告。',
        '把 bring-up 检查清单固化成文档，下一块板直接复用。'
      ],
      ask: '如果 LED 是高电平有效，但代码输出取反，流水方向看起来会怎样？'
    },
    quiz: [
      {
        q: 'bitstream 与 BOOT.BIN 的关系是？',
        options: ['完全相同', 'BOOT.BIN 可包含 FSBL、bitstream 和 U-Boot，用于上电启动', 'bitstream 包含 Linux 内核', 'BOOT.BIN 只能放 SD 卡'],
        answer: 1,
        exp: 'bitstream 只是 PL 配置数据；BOOT.BIN 是 BootROM 可识别的容器，可包含 FSBL、PL 配置和 U-Boot 等。'
      },
      {
        q: '时序报告中大量 unconstrained paths 意味着？',
        options: ['设计一定更快', '这些路径没有被约束，工具没有按你的时钟检查', '可以忽略', '需要换芯片'],
        answer: 1,
        exp: '未约束路径不会被正确分析，报告“通过”并不代表满足真实时序。先补 create_clock / I/O 约束。'
      }
    ]
  },

  ch07: {
    title: '互动实验室 · Hello ZYNQ 的完整链路',
    lead: '从点击 Run 到串口出现字符，中间至少有六个交接点。任意一个产物不对，现象都可能是“串口没输出”。',
    widget: {
      title: '最小裸机系统：XSA → BSP → ELF → 串口',
      sub: '按顺序点击每一步，看看谁依赖谁。',
      type: 'flow',
      steps: [
        { title: 'PS 最小系统', desc: '在 Vivado 中配置 UART、DDR、时钟，导出含 PS 配置的 XSA。', tag: '硬件' },
        { title: 'Vitis Platform', desc: '以 XSA 创建平台工程，生成硬件描述与启动代码。', tag: '平台' },
        { title: 'BSP', desc: '板级支持包提供 xil_printf、驱动与链接脚本；版本必须与平台一致。', tag: '软件' },
        { title: '应用工程', desc: '编写 main、初始化 UART、打印；编译得到 ARM ELF。', tag: 'ELF' },
        { title: 'ps7_init 与下载', desc: '调试器先执行 PS 初始化（DDR、时钟、MIO），再加载 ELF。', tag: 'JTAG' },
        { title: '串口输出', desc: 'UART1 引脚、波特率、终端设置三者一致，才能看到字符。', tag: '验证' }
      ],
      faults: [
        { at: 4, label: '跳过 ps7_init', title: '直接加载 ELF', symptom: 'DDR 未初始化，程序跑飞或卡在启动；JTAG 调试必须先执行初始化 Tcl。' },
        { at: 5, label: '串口接错', title: 'UART0/UART1 或波特率不一致', symptom: '终端全黑或乱码。先确认板卡调试口对应哪个 UART，再核对 115200-8-N-1。' }
      ],
      note: '裸机调试的三件套：XSA 描述硬件、BSP 提供底座、ps7_init 把芯片带到可运行状态。少一件都不行。'
    },
    case: {
      tag: '工程现场 · 生产工装',
      title: '一台测试工装，为什么换电脑就不出字？',
      scene: '产线测试工装用 USB 转串口连接 ZYNQ 调试口。换了一台笔记本后终端全黑，工程师以为是板子坏了。实际是新电脑的串口驱动把端口映射成 COM7，而脚本仍写死 COM3；同时终端流控被打开。改端口与流控后恢复。',
      metrics: ['1 台工装', 'COM3 → COM7', '115200 8N1', '0 行代码改动'],
      points: [
        '“无输出”先分层：供电、JTAG、PS 初始化、UART 引脚、终端参数。',
        '不要写死 COM 口；用设备管理器或脚本自动发现。',
        '终端流控（RTS/CTS）在嵌入式调试口上通常应关闭。',
        '把工装环境也纳入版本管理，而不是依赖某台电脑。'
      ],
      ask: '如果串口有输出但全是乱码，最可能的三个原因是什么？'
    },
    quiz: [
      {
        q: 'Vitis 中 BSP 的主要作用是？',
        options: ['生成 bitstream', '提供外设驱动、启动代码和链接配置', '替代 Vivado', '烧写 QSPI'],
        answer: 1,
        exp: 'BSP 把硬件描述封装成软件可用的驱动与配置，并给出启动/链接所需文件。'
      },
      {
        q: 'JTAG 裸机调试时，ps7_init 负责什么？',
        options: ['编译 C 代码', '初始化 DDR、时钟、MIO 等 PS 基础环境', '生成设备树', '启动 Linux'],
        answer: 1,
        exp: 'ps7_init 由 Vivado 导出，调试器在加载应用前执行，把 PS 带到可运行状态。'
      }
    ]
  },

  ch08: {
    title: '互动实验室 · 中断为什么一次都不来',
    lead: '中断是“四级使能”的串联系统。按错顺序、漏掉一级，现象都是静默无反应。用状态机走一遍，看看每一级卡住时会发生什么。',
    widget: {
      title: 'GIC 中断通路：四级使能缺一不可',
      sub: '依次触发事件；试着跳过某一级，观察状态是否还能到达 ISR。',
      type: 'fsm',
      initial: 'OFF',
      states: [
        { id: 'OFF', name: '外设未使能', x: 110, y: 90 },
        { id: 'PERIPH', name: '外设已使能', x: 320, y: 90 },
        { id: 'GIC', name: 'GIC 已使能', x: 530, y: 90 },
        { id: 'CPU', name: 'CPU 接口使能', x: 530, y: 230 },
        { id: 'ISR', name: '进入 ISR', x: 320, y: 250 }
      ],
      transitions: [
        { from: 'OFF', to: 'PERIPH', event: '使能外设', label: '外设使能' },
        { from: 'PERIPH', to: 'GIC', event: '使能 GIC', label: 'GIC 使能' },
        { from: 'GIC', to: 'CPU', event: '使能 CPU', label: 'CPU 使能' },
        { from: 'CPU', to: 'ISR', event: '触发中断', label: 'IRQ' },
        { from: 'ISR', to: 'CPU', event: '清中断', label: '清标志' }
      ],
      auto: ['使能外设', '使能 GIC', '使能 CPU', '触发中断', '清中断'],
      note: '四级的顺序可以调整，但必须全部打开：外设自身使能位 → GIC Distributor → CPU 接口 → 全局异常使能。缺任何一级，CPU 都收不到。'
    },
    case: {
      tag: '工程现场 · 急停输入',
      title: '急停按钮按下去，PLC 却晚了 30 ms',
      scene: '产线急停信号接到 PL 的 GPIO，再经 GIC 送给 PS。测试发现从按下到 DO 切断有 30 ms 延迟。根因是中断服务程序里调用了 xil_printf，且 GPIO 中断未清标志，导致重复进入。改为 PL 硬件去抖 + 中断里只置标志，30 ms 降到 0.4 ms。',
      metrics: ['30 ms → 0.4 ms', '1 kHz 采样', '20 ms 去抖', 'ISR 只置标志'],
      points: [
        'ISR 要短：置标志、清中断、唤醒任务，别在里面打印或延时。',
        '中断标志不清会重复进入，表现为“系统变慢”而不是“没中断”。',
        '安全相关信号不要只依赖软件：急停回路应由安全继电器硬切除。',
        '用 ILA 或 GPIO 翻转测真实延迟，别靠感觉。'
      ],
      ask: '如果按钮是低有效，且外部有 10 kΩ 上拉，GPIO 应配置成什么触发边沿？'
    },
    quiz: [
      {
        q: 'ZYNQ 的 IRQ_F2P 属于哪类 GIC 中断？',
        options: ['SGI 软件中断', 'PPI 私有外设中断', 'SPI 共享外设中断', 'NMI'],
        answer: 2,
        exp: 'PL 到 PS 的中断通过 SPI（共享外设中断）进入 GIC，ID 通常在 61–68 / 84–91。'
      },
      {
        q: '中断服务程序里执行 xil_printf 的主要风险是？',
        options: ['编译报错', '阻塞时间过长，增加中断延迟并可能丢失事件', '会清空 DDR', '改变 GIC 优先级'],
        answer: 1,
        exp: '串口打印是慢速阻塞操作；ISR 应尽量短，把耗时处理交给任务或下半部。'
      },
      {
        q: '中断只触发一次，之后再也不来，最可能的原因是？',
        options: ['CPU 主频太低', '中断标志未清除或外设未重新使能', 'DDR 容量不足', '没开 MMU'],
        answer: 1,
        exp: 'GIC/外设的中断状态需要显式清除；否则挂起状态一直存在，或外设不再产生新事件。'
      }
    ]
  },

  ch09: {
    title: '互动实验室 · AXI 握手到底看哪一刻',
    lead: 'VALID 和 READY 不是“电平高就传输”，而是在时钟上升沿同时为高才完成一次握手。拖动时间轴，看地址与数据分别在什么时候被接收。',
    widget: {
      title: 'AXI4-Lite 写事务：AW 与 W 两个通道',
      sub: '地址通道和数据通道各自握手；两个都完成，写操作才真正生效。',
      type: 'wave',
      signals: [
        { name: 'ACLK', values: [0,1,0,1,0,1,0,1,0,1,0,1,0,1], color: '#fbbf24' },
        { name: 'AWVALID', values: [0,0,0,1,1,1,0,0,0,0,0,0,0,0], color: '#60a5fa' },
        { name: 'AWREADY', values: [0,0,0,0,1,1,0,0,0,0,0,0,0,0], color: '#34d399' },
        { name: 'AWADDR', values: ['—','—','—','0x43C00000','0x43C00000','0x43C00000','—','—','—','—','—','—','—','—'], color: '#22d3ee' },
        { name: 'WVALID', values: [0,0,0,0,0,0,1,1,1,0,0,0,0,0], color: '#60a5fa' },
        { name: 'WREADY', values: [0,0,0,0,0,0,0,1,1,0,0,0,0,0], color: '#34d399' },
        { name: 'WDATA', values: ['—','—','—','—','—','—','0x00000001','0x00000001','0x00000001','—','—','—','—','—'], color: '#a78bfa' }
      ],
      markers: [{ tick: 4, label: 'AW 握手' }, { tick: 7, label: 'W 握手' }],
      chips: ['上升沿采样', 'VALID 不能等 READY', 'READY 可先于 VALID', '两个通道独立'],
      tickUnit: ' 拍',
      note: '主设备不能因为 READY 为低就撤销 VALID；从设备也不能因为 VALID 为低就撤销 READY（除非协议允许）。握手是双方各自表达“我有/我能收”，在沿上同时成立才传输。'
    },
    case: {
      tag: '工程现场 · 自定义 IP',
      title: '地址偏移错 4 字节，8 路 DO 全部镜像',
      scene: '软 PLC 的 IO 引擎定义了 0x00 控制、0x04 DI、0x08 DO。驱动初始化时按 32 位指针步进，却把 DO 写到了 0x0C（保留区）。现象是：写 DO 寄存器没反应，而写 PWM 寄存器会意外点亮输出。对照寄存器映射表逐项核对后修正。',
      metrics: ['3 个寄存器', '4 字节对齐', '1 个偏移错', '8 路 DO 异常'],
      points: [
        '寄存器映射必须先写文档再写 RTL，地址、位宽、读写属性、复位值四项齐全。',
        'AXI-Lite 访问必须按 4 字节对齐；偏移计算用字节地址。',
        '软件写寄存器前先读回 ID/版本寄存器，确认 IP 与驱动匹配。',
        '握手波形能区分“地址没到”和“数据没到”，别只看最终现象。'
      ],
      ask: '如果 AWVALID 和 WVALID 同时到达，但从设备只接受了地址，数据会怎样？'
    },
    quiz: [
      {
        q: 'AXI 一次写传输完成的判据是？',
        options: ['VALID 为高', 'READY 为高', '在时钟上升沿 VALID 与 READY 同时为高', '地址总线变化'],
        answer: 2,
        exp: '握手发生在时钟沿，双方的 VALID/READY 同时为高才表示该拍传输被接受。'
      },
      {
        q: '寄存器控制类自定义 IP，通常挂在哪类 AXI 接口上？',
        options: ['HP', 'GP', 'ACP', 'JTAG'],
        answer: 1,
        exp: 'GP 端口适合低带宽的寄存器访问；HP 面向高吞吐数据流。'
      },
      {
        q: '写 DO 寄存器没反应，但写相邻地址有效，最可能是什么问题？',
        options: ['时钟频率不对', '寄存器偏移/地址译码错误', 'DDR 坏了', '串口波特率不对'],
        answer: 1,
        exp: '相邻地址生效说明总线通路正常，问题在 IP 的地址译码或软件偏移计算。'
      }
    ]
  },

  ch10: {
    title: '互动实验室 · 把六章知识拧成一台原型',
    lead: '综合实验不是“再做一遍流水灯”，而是第一次跑通“PL 采集 → 寄存器 → PS 决策 → PL 输出”的闭环。',
    widget: {
      title: '数字控制原型：一次数据往返',
      sub: '每一步都对应前几章的一个产物；故障注入看看哪一层最容易“假成功”。',
      type: 'flow',
      steps: [
        { title: '需求切片', desc: '8 路 DI、8 路 DO、1 路 PWM；明确扫描周期与有效电平。', tag: '需求' },
        { title: 'PL IO 引擎', desc: '去抖、寄存器、PWM、中断汇聚封成一个 AXI 从设备。', tag: '第 9 章' },
        { title: 'PS 裸机驱动', desc: 'ioremap/指针访问寄存器，注册中断，提供 read/write API。', tag: '第 8 章' },
        { title: '控制逻辑', desc: '按键启停、状态机、互锁；用映像区而不是直接操作硬件。', tag: '第 5 章' },
        { title: '联调验收', desc: '示波器测延迟、逻辑分析仪看时序、故障注入验证安全输出。', tag: '第 21 章' }
      ],
      faults: [
        { at: 2, label: '只测理想按键', title: '去抖参数不匹配实际按键', symptom: '实验室通过，现场因抖动误触发。必须用真实按键与温度条件测试。' },
        { at: 4, label: '只看功能不看时序', title: '没有测量输入到输出的延迟', symptom: '功能“看起来对”，但节拍提升后丢步。功能验收必须带时序指标。' }
      ],
      note: '原型的目标不是“能演示”，而是“能被测量、能被复现、能被别人接手”。'
    },
    case: {
      tag: '工程现场 · 原型评审',
      title: 'Demo 很漂亮，为什么评审没通过？',
      scene: '团队用一周做出按键点灯原型，评审时被问到三个问题：输入抖动多大？最坏响应时间多少？断电后输出是什么状态？三个都答不上来。最终补做去抖、延迟测量和安全状态设计，才进入下一阶段。',
      metrics: ['1 周原型', '3 个致命问题', '0 份时序数据', '1 次返工'],
      points: [
        '原型阶段就要定义可测量的指标：延迟、抖动、功耗、温度。',
        '安全状态要明确：断电、复位、通信丢失时 DO 应回到什么状态。',
        '把关键信号引出测试点，别等评审时才飞线。',
        '代码分层，让控制逻辑可以脱离硬件仿真。'
      ],
      ask: '如果评审只给你 10 分钟，你会用哪三个数据证明原型可用？'
    },
    quiz: [
      {
        q: 'PL 侧 IO 引擎对 PS 暴露的核心接口通常是？',
        options: ['一个 TCP 端口', '一组按地址映射的寄存器', '一个文件路径', '一个中断向量表'],
        answer: 1,
        exp: 'AXI-Lite 从设备把状态与控制映射为寄存器，PS 通过读写地址访问。'
      },
      {
        q: '控制逻辑直接操作硬件寄存器而不经过映像区，主要问题是？',
        options: ['编译变慢', '逻辑与硬件耦合，难以测试、复用和保证一致性', '会损坏 DDR', '无法使用中断'],
        answer: 1,
        exp: '映像区提供统一快照与解耦，便于扫描周期内一致读写，也方便仿真和移植。'
      }
    ]
  },

  ch11: {
    title: '互动实验室 · 宿主机与目标机的往返',
    lead: '交叉开发的关键不是“会 scp”，而是理解每个产物在哪台机器上生成、如何到达板卡、出错时在哪一层排查。',
    widget: {
      title: '一次交叉编译的完整往返',
      sub: '点击步骤查看产物与常见错误。',
      type: 'flow',
      steps: [
        { title: '宿主机编辑', desc: '源码、Makefile、设备树在 Ubuntu 工作区；用 git 管理。', tag: 'Host' },
        { title: '交叉编译', desc: '用 PetaLinux SDK 的 aarch32 工具链生成 ARM ELF / .ko。', tag: 'arm-linux' },
        { title: '传输到目标机', desc: 'scp、NFS、TFTP 或 SD 卡；选择取决于迭代频率与网络条件。', tag: 'Deploy' },
        { title: '目标机运行', desc: '动态库、权限、设备节点、内核版本必须匹配。', tag: 'Target' },
        { title: '远程调试', desc: 'gdbserver + 端口转发 + VSCode，断点停在目标机进程里。', tag: 'Debug' },
        { title: '回归与版本化', desc: '把可运行组合打成版本，记录 commit、工具链与内核。', tag: 'Release' }
      ],
      faults: [
        { at: 3, label: '动态库缺失', title: 'ELF 架构对但运行时报 libc 版本不符', symptom: '用 readelf -d 查依赖，用 file 查架构；优先使用与根文件系统同源的 SDK。' },
        { at: 2, label: 'NFS 权限/网段', title: '目标机挂载超时', symptom: '先 ping，再 showmount -e，再查防火墙与 /etc/exports 的 no_subtree_check。' }
      ],
      note: '先让“编译—传输—运行”变成一条 30 秒内可重复的路径，再谈效率。'
    },
    case: {
      tag: '工程现场 · 协作开发',
      title: '同一个 .ko，在 A 板能加载、B 板报错',
      scene: '团队把驱动模块通过 U 盘拷贝到两台设备。A 板加载正常，B 板报 “version magic mismatch”。两台板子的内核一个来自 PetaLinux 预编译，一个是自行编译的，SMP/抢占配置不同。最终统一内核与模块构建来源。',
      metrics: ['2 台设备', '2 个内核', '1 个 vermagic', '0 个共享产物'],
      points: [
        '内核模块必须与运行内核同源编译；不能跨配置复用。',
        '用 modinfo 对比 vermagic，用 uname -a 确认运行内核。',
        '把内核、模块、设备树、根文件系统作为一个版本单元。',
        'NFS 适合迭代，量产必须落到本地介质并验证断电恢复。'
      ],
      ask: '如果只能在板子上编译，怎样避免污染系统库？'
    },
    quiz: [
      {
        q: '交叉编译出的程序在目标机上运行时报 “Exec format error”，首先检查？',
        options: ['文件权限', 'ELF 架构与解释器是否匹配目标机', '网络连接', '串口波特率'],
        answer: 1,
        exp: '用 file/readelf 检查 EI_CLASS、Machine 和 interpreter；架构错或解释器缺失都会导致无法执行。'
      },
      {
        q: 'NFS 根文件系统最适合哪个阶段？',
        options: ['量产出货', '开发迭代', '安全认证', '低功耗待机'],
        answer: 1,
        exp: 'NFS 便于快速替换文件，适合开发；量产应使用本地介质并验证掉电与升级。'
      }
    ]
  },

  ch12: {
    title: '互动实验室 · 启动失败，死在第几级？',
    lead: '启动链是五级火箭。串口停在某个位置，不代表“芯片坏了”，而是某一级的交接失败。点击故障注入，练习用现象定位层级。',
    widget: {
      title: 'ZYNQ 五级启动链与故障定位',
      sub: '每一步的输出都是下一步的输入；故障注入会标出典型症状。',
      type: 'flow',
      steps: [
        { title: 'BootROM', desc: '上电后读启动模式引脚，从 QSPI/SD/JTAG 找 BOOT.BIN，验头后加载 FSBL。', tag: '固化' },
        { title: 'FSBL', desc: '初始化 DDR、时钟、MIO，按需配置 PL，然后加载 U-Boot 或裸机。', tag: 'BOOT.BIN' },
        { title: 'U-Boot', desc: '初始化网络/存储，加载内核、设备树、根文件系统；可进命令行救援。', tag: 'boot.scr' },
        { title: 'Linux 内核', desc: '解压、初始化内存与外设、挂载 rootfs、启动 init。', tag: 'image.ub' },
        { title: '用户态 init', desc: '/sbin/init → inittab → rcS → 应用；权限、库、设备节点都在这里暴露。', tag: 'rootfs' }
      ],
      faults: [
        { at: 0, label: '启动模式错', title: '拨码在 JTAG 档', symptom: '串口完全无输出，JTAG 却能连上。先看拨码与 BOOT.BIN 所在介质。' },
        { at: 1, label: 'DDR 初始化失败', title: 'FSBL 卡在 DDR 校准', symptom: '串口打印 FSBL 头后停住；换 BOOT.BIN 或核对 DDR 型号/时序。' },
        { at: 3, label: 'rootfs 挂载失败', title: '内核启动到 VFS 报错', symptom: '能看到内核日志但停在 “VFS: Unable to mount root fs”；检查 root= 参数、MMC/NFS。' },
        { at: 4, label: 'init 脚本死循环', title: '应用不断重启', symptom: '串口反复打印同一段启动日志；看 inittab、rcS 与看门狗。' }
      ],
      note: '排障口诀：无输出看 BootROM/供电，有 FSBL 无内核看 U-Boot，有内核无 shell 看 rootfs，有 shell 无应用看 init。'
    },
    case: {
      tag: '公共交通现场 · 车载终端',
      title: '零下 20℃ 冷启动，十台车里三台起不来',
      scene: '北方冬季，公交场站的智能终端在 -20℃ 冷启动时偶发卡在 U-Boot。实验室常温无法复现。根因是 eMMC 在低温下初始化时间变长，U-Boot 的 MMC 超时固定为 100 ms；同时电源上电斜率偏慢。加长超时并调整电源时序后通过 200 次冷启动。',
      metrics: ['-20℃', '3/10 失败', '100 ms 超时', '200 次验证'],
      points: [
        '启动链路对温度、电源斜率、器件批次高度敏感，必须做环境测试。',
        'U-Boot 阶段的失败往往能通过串口日志定位到具体驱动。',
        '不要把“常温能启动”当成量产标准。',
        '电源时序与复位时序是硬件设计的一部分，软件只能有限补偿。'
      ],
      ask: '如果串口在 FSBL 之后完全没有输出，你会先查 U-Boot 还是 DDR？依据是什么？'
    },
    quiz: [
      {
        q: 'BOOT.BIN 中通常不包含以下哪一项？',
        options: ['FSBL', 'PL bitstream', 'U-Boot', '根文件系统'],
        answer: 3,
        exp: 'BOOT.BIN 由 BootROM 解析，通常含 FSBL、bitstream 和 U-Boot；根文件系统在内核之后挂载。'
      },
      {
        q: '内核已经打印日志，但停在 “VFS: Unable to mount root fs”，问题最可能在？',
        options: ['BootROM', 'FSBL', 'rootfs 介质或 root= 参数', 'JTAG 线'],
        answer: 2,
        exp: '内核已运行到挂载根文件系统阶段，问题在 rootfs 本身、存储驱动或启动参数。'
      },
      {
        q: '串口完全没有任何输出，最先排查的是？',
        options: ['应用代码', '供电、启动模式、BOOT.BIN 介质', '文件系统权限', 'Modbus 地址'],
        answer: 1,
        exp: 'BootROM 之前没有软件日志，先排除供电、复位、拨码和启动介质。'
      }
    ]
  },

  ch13: {
    title: '互动实验室 · Flash 布局就是一份地址合同',
    lead: 'BOOT.BIN、内核、设备树、启动脚本在 Flash 里的位置不是随便放的。点击区块，理解每一段的职责与升级策略。',
    widget: {
      title: '16 MB QSPI 的典型分区',
      sub: '地址是偏移量；实际产品还要考虑备份、对齐与坏块。',
      type: 'map',
      search: false,
      regions: [
        { name: 'BOOT.BIN', base: '0x000000', size: 4 * 1024 * 1024, color: '#22d3ee', tag: '偏移 0x000000', desc: 'BootROM 直接读取的容器：FSBL + bitstream + U-Boot。必须放在启动介质起始位置。', items: ['升级时先写备份区，再切换', '校验头与长度，避免半包'] },
        { name: 'image.ub', base: '0x400000', size: 8 * 1024 * 1024, color: '#60a5fa', tag: '偏移 0x400000', desc: 'FIT 镜像，通常包含内核、设备树与可选的 initramfs。U-Boot 负责加载。', items: ['内核与 DTB 必须匹配', '保留升级失败回滚空间'] },
        { name: 'boot.scr', base: '0xC00000', size: 64 * 1024, color: '#34d399', tag: '偏移 0xC00000', desc: 'U-Boot 脚本，定义加载地址、启动参数与 A/B 选择逻辑。', items: ['脚本要可读、可回滚', '不要把关键参数写死在代码里'] },
        { name: 'U-Boot 环境', base: '0xC10000', size: 128 * 1024, color: '#fbbf24', tag: '偏移 0xC10000', desc: 'bootcmd、bootargs、IP 等环境变量；通常主备两份。', items: ['saveenv 会擦写，注意寿命', '保留默认环境恢复方式'] },
        { name: '黄金镜像 / 备份', base: '0xE00000', size: 2 * 1024 * 1024, color: '#a78bfa', tag: '偏移 0xE00000', desc: '最小可启动备份，用于升级失败时恢复。空间不足时可放 SD 卡。', items: ['定期验证备份可启动', '恢复流程要写进作业指导书'] }
      ],
      note: '分区表要与 U-Boot 环境、升级脚本、产线烧录工具三处保持一致。任何一个地方改地址，其他两处必须同步。'
    },
    case: {
      tag: '工程现场 · 现场升级',
      title: '升级到一半断电，设备还能救回来吗？',
      scene: '客户现场升级时断电，设备重启后停在 U-Boot。原因是升级脚本直接擦除了 BOOT.BIN 所在分区，且没有备份。最终通过 SD 卡启动 + 重新烧录恢复，但停机 3 小时。后续版本加入 A/B 分区与黄金镜像。',
      metrics: ['1 次断电', '3 小时停机', '0 备份', 'A/B 升级'],
      points: [
        '升级必须先写非活动分区，校验通过后再切换启动指针。',
        '任何擦写操作都要考虑断电窗口。',
        '保留一个不可被常规升级覆盖的恢复路径（SD 卡、串口、黄金镜像）。',
        '升级脚本要能在实验室模拟断电。'
      ],
      ask: '如果 Flash 只有 8 MB，放不下 A/B 双份，你会怎么设计降级方案？'
    },
    quiz: [
      {
        q: 'U-Boot 环境变量通常存储在哪里？',
        options: ['DDR 中，掉电丢失', 'Flash 的专用环境分区，可 saveenv', 'SD 卡的根目录', 'PL 的 BRAM'],
        answer: 1,
        exp: '环境变量保存在非易失介质的环境分区；saveenv 会写入，需考虑擦写寿命与主备。'
      },
      {
        q: 'A/B 升级的核心安全点是？',
        options: ['同时擦除两个分区', '先写非活动分区并校验，再切换启动', '关闭看门狗', '删除旧内核'],
        answer: 1,
        exp: '保持一个可启动分区不变，写入并校验另一个，失败可回退。'
      }
    ]
  },

  ch14: {
    title: '互动实验室 · 设备树如何变成驱动',
    lead: '设备树不是“配置文件”，而是内核认识硬件的证据链。点击每一步，看 compatible 如何把节点、驱动和 probe 串起来。',
    widget: {
      title: '从 .dts 到 probe：设备树的旅程',
      sub: '故障注入演示 compatible 不匹配时会发生什么。',
      type: 'flow',
      steps: [
        { title: '.dts / .dtsi 源文件', desc: '描述 CPU、内存、总线、外设节点；板级文件通过 include 复用 SoC 描述。', tag: '源' },
        { title: 'dtc 编译', desc: '生成 .dtb 二进制；语法错、重复节点、地址越界在这里暴露。', tag: 'dtc' },
        { title: 'Bootloader 加载', desc: 'U-Boot 把 .dtb 放到内存并传给内核；地址与加载方式要匹配。', tag: '交接' },
        { title: '内核解析', desc: '展开节点，创建 platform_device，解析 reg/interrupts/clocks。', tag: '展开' },
        { title: '驱动匹配', desc: 'of_match_table 与 compatible 逐字符匹配，命中后调用 probe。', tag: 'match' },
        { title: 'probe 获取资源', desc: 'devm_ioremap_resource、platform_get_irq、devm_clk_get 完成初始化。', tag: '绑定' }
      ],
      faults: [
        { at: 1, label: 'compatible 拼错', title: '驱动里的字符串与 DTS 不一致', symptom: '设备节点存在但 probe 不执行；/sys/bus/platform/devices 下能看到设备，却没有对应驱动绑定。' },
        { at: 0, label: 'status = "disabled"', title: '节点被显式关闭', symptom: '内核根本不创建 platform_device。先检查 status，再看地址与中断。' },
        { at: 4, label: 'reg 地址错', title: 'ioremap 到错误地址', symptom: 'probe 成功但读写寄存器无效，甚至触发总线错误。对照 TRM 与 Vivado 地址编辑器。' }
      ],
      note: '设备树只描述“有什么、在哪、怎么连”；驱动负责“怎么用”。把硬件参数写进 C 代码，等于放弃了设备树的意义。'
    },
    case: {
      tag: '工程现场 · 网络不通',
      title: 'PHY 地址写错，千兆网只剩百兆',
      scene: '自制底板的 GEM 接口在 U-Boot 下能通，进 Linux 后链路不稳定。设备树照抄参考板，PHY 地址为 0x7，而实际硬件因 strap 电阻改成了 0x3。内核反复扫描错误地址，偶发识别成百兆。修正 phy-handle 后恢复千兆。',
      metrics: ['1 个 PHY', '0x7 → 0x3', '千兆 → 百兆', '0 行驱动代码'],
      points: [
        '同一颗 PHY 在不同板子上的地址可能由 strap 引脚决定。',
        'U-Boot 与 Linux 使用不同设备树/配置时，表现可能不一致。',
        '先看 dmesg 中的 PHY 探测日志，再怀疑硬件。',
        '设备树改动也要进版本库并做板级回归。'
      ],
      ask: '如果 dmesg 里完全没有 PHY 探测日志，你会先查设备树还是 MDIO 总线？'
    },
    quiz: [
      {
        q: 'platform 驱动匹配设备树节点的关键是？',
        options: ['节点名字必须相同', 'compatible 字符串与 of_match_table 一致', 'reg 地址必须为 0', '驱动必须编进内核'],
        answer: 1,
        exp: 'compatible 是匹配依据；节点名只是约定，reg 提供资源。'
      },
      {
        q: '驱动 probe 中获取寄存器基地址的推荐方式是？',
        options: ['直接写死 0x43C00000', 'platform_get_resource + devm_ioremap_resource', '用 malloc', '从串口读取'],
        answer: 1,
        exp: '从设备树 reg 属性解析资源并 ioremap，避免硬编码，便于移植。'
      }
    ]
  },

  ch15: {
    title: '互动实验室 · PetaLinux 不是魔法',
    lead: '它把“手工编译 U-Boot/内核/rootfs”的重复劳动封装成工程。理解流水线，才能在看不懂的报错里找到入口。',
    widget: {
      title: 'PetaLinux 工程的七段流水线',
      sub: '从 XSA 到可启动镜像；每一段都有配置入口和产物。',
      type: 'flow',
      steps: [
        { title: 'petalinux-create', desc: '创建工程模板，选定 ZYNQ 架构与版本。', tag: '工程' },
        { title: '导入 XSA', desc: 'petalinux-config --get-hw-description，生成硬件相关的 DTS 与配置。', tag: '硬件' },
        { title: '四层配置', desc: '工程配置、内核、U-Boot、rootfs；优先级从高到低要分清。', tag: '配置' },
        { title: '添加应用/模块', desc: '用 petalinux-create -t apps/modules，配方自动进入 rootfs。', tag: '扩展' },
        { title: 'petalinux-build', desc: 'BitBake 驱动全量构建；首次很慢，增量依赖正确。', tag: '构建' },
        { title: '打包', desc: 'petalinux-package --boot 生成 BOOT.BIN，--wic 生成可烧录镜像。', tag: '产物' },
        { title: '部署验证', desc: 'SD/QSPI 启动，检查版本、设备树、驱动与自启应用。', tag: '上板' }
      ],
      faults: [
        { at: 2, label: '改错配置层', title: '在 kernel 菜单里改了 U-Boot 参数', symptom: '修改不生效或下次构建被覆盖。先确认菜单属于哪一层，再用 bbappend 固化。' },
        { at: 4, label: '本地缓存污染', title: '换 XSA 后没有清理 sstate', symptom: '设备树仍是旧硬件。petalinux-build -x mrproper 后重建，确认新 XSA 生效。' }
      ],
      note: 'PetaLinux 的配置是分层叠加的：工程配置 → 内核/U-Boot/rootfs 配置 → 配方 bbappend。改之前先问“这是哪一层”。'
    },
    case: {
      tag: '工程现场 · 可复现构建',
      title: '同一块板，两个工程师编出的镜像不一样',
      scene: '因为一人在 petalinux-config 里改了内核命令行，另一人直接改了 DTS，两人的构建产物启动参数不同。CI 上又用了不同的 sstate 缓存。最后统一为：配置改动全部落到配方/补丁，CI 从干净目录构建，产物带 build ID。',
      metrics: ['2 套配置', '1 个 CI', '0 手工修改', 'build ID'],
      points: [
        '任何手工修改都要落到配方、补丁或配置片段，否则不可复现。',
        'CI 必须从干净工作区构建，缓存只加速不改变结果。',
        '产物要能回答：哪个 XSA、哪个 commit、哪个配置。',
        'PetaLinux 很强，但不是“点一下就好”；理解层级别省几天。'
      ],
      ask: '如果客户现场只能升级 rootfs，不能动 BOOT.BIN，你会怎么组织产物？'
    },
    quiz: [
      {
        q: 'PetaLinux 导入 XSA 的主要目的是？',
        options: ['生成 bitstream', '获得硬件描述并生成匹配的设备树/配置', '安装 Vivado', '编译应用'],
        answer: 1,
        exp: 'PetaLinux 从 XSA 提取 PS 配置与地址信息，生成硬件相关的设备树和配置。'
      },
      {
        q: '要让一个自定义内核模块自动进入 rootfs，最规范的做法是？',
        options: ['手工复制到 SD 卡', '创建 petalinux 模块工程或用配方/bbappend', '改内核源码硬编码', '放进 /tmp'],
        answer: 1,
        exp: '用 PetaLinux 的模块模板或 BitBake 配方，让构建系统管理依赖与安装。'
      }
    ]
  },

  ch16: {
    title: '互动实验室 · 内核交棒之后',
    lead: '根文件系统决定“系统活起来之后能做什么”。从内核挂载 rootfs 到应用启动，每一步都可能让板子停在黑屏。',
    widget: {
      title: '从 rootfs 到你的应用：init 六步',
      sub: '点击每一步查看失败时的典型现象。',
      type: 'flow',
      steps: [
        { title: '内核挂载 rootfs', desc: '按 root= 参数找到块设备/NFS，识别文件系统并挂载。', tag: 'VFS' },
        { title: '执行 /sbin/init', desc: '内核启动 1 号进程；找不到 init 会 panic。', tag: 'PID 1' },
        { title: '读取 /etc/inittab', desc: 'BusyBox init 根据 inittab 启动 sysinit、respawn、getty。', tag: 'BusyBox' },
        { title: '运行 rcS 启动脚本', desc: '挂载 proc/sys、配置网络、创建设备节点、启动守护进程。', tag: 'rcS' },
        { title: 'getty / 登录', desc: '串口或控制台提供 shell；账号、权限、/dev/console 必须存在。', tag: 'Shell' },
        { title: '启动业务应用', desc: '自启脚本、systemd 或 supervise；失败要能记录并重试。', tag: 'App' }
      ],
      faults: [
        { at: 0, label: 'root= 写错', title: '内核找不到根分区', symptom: 'VFS: Unable to mount root fs；检查分区号、文件系统类型与驱动是否编入内核。' },
        { at: 1, label: '缺少 /sbin/init', title: 'No init found', symptom: '内核 panic。手工 rootfs 常忘记创建 init 或 BusyBox 链接。' },
        { at: 2, label: '/dev/console 缺失', title: '串口无登录提示', symptom: '系统其实已启动，但没有控制台。检查 devtmpfs 与 inittab 的 console 设备。' }
      ],
      note: '最小 rootfs 的四件事：init、/dev/console、/etc/inittab、必要的动态库。缺一件都可能“启动成功但不可用”。'
    },
    case: {
      tag: '工程现场 · 最小系统',
      title: '串口没有登录提示，但系统其实活着',
      scene: '手工搭建的 rootfs 启动后串口一片安静，ping 却能通。检查发现 /dev/console 不存在，inittab 的 respawn 行无法打开控制台。补上 devtmpfs 挂载和 console 设备后，登录提示恢复。',
      metrics: ['1 个设备节点', 'ping 正常', '无 shell', '5 分钟定位'],
      points: [
        '“没有串口输出”不等于“系统没启动”；先看网络与串口日志。',
        'devtmpfs 应在早期挂载，否则设备节点缺失。',
        'inittab 的每一行都要有明确的设备和动作。',
        '最小系统要能自检：串口、网络、存储、时间。'
      ],
      ask: '如果没有 devtmpfs，你会手工创建哪些设备节点来恢复登录？'
    },
    quiz: [
      {
        q: '内核启动后找不到 /sbin/init，通常会？',
        options: ['自动进入 shell', 'kernel panic', '重启进入 U-Boot', '继续运行但没有进程'],
        answer: 1,
        exp: '1 号进程无法创建会导致 panic；必须提供 init 或通过 init= 指定。'
      },
      {
        q: 'BusyBox init 读取的配置文件通常是？',
        options: ['/etc/fstab', '/etc/inittab', '/etc/network/interfaces', '/boot/cmdline.txt'],
        answer: 1,
        exp: 'BusyBox init 使用 /etc/inittab 定义 sysinit、respawn、getty 等行为。'
      }
    ]
  },

  ch17: {
    title: '互动实验室 · 一次 write 的系统旅程',
    lead: '用户态的一行 write(fd, ...) 如何穿过 VFS、字符设备、copy_from_user，最后落到 PL 寄存器？拖动流程，看清每一层边界。',
    widget: {
      title: '字符设备写操作：用户态 → 内核 → 硬件',
      sub: '故障注入演示“直接解引用物理地址”和“漏判 copy_from_user”的后果。',
      type: 'flow',
      steps: [
        { title: '应用调用 write()', desc: 'fd 指向 /dev/plcled，参数是用户态缓冲区指针和长度。', tag: 'User' },
        { title: '系统调用进入内核', desc: '触发异常切换到内核态，VFS 根据 inode 找到 cdev 与 file_operations。', tag: 'Syscall' },
        { title: '驱动 .write 回调', desc: '拿到 struct file * 和用户指针，不能直接解引用用户地址。', tag: 'Kernel' },
        { title: 'copy_from_user', desc: '在用户地址空间与内核缓冲区间安全拷贝；失败返回 -EFAULT。', tag: '边界' },
        { title: '访问硬件寄存器', desc: '用 ioremap 得到的虚拟地址 + readl/writel，或 regmap。', tag: 'MMIO' },
        { title: 'PL 执行动作', desc: '寄存器写入触发 PWM/DO 更新；必要时读回状态确认。', tag: 'Hardware' }
      ],
      faults: [
        { at: 3, label: '直接 memcpy 用户指针', title: '内核态解引用用户地址', symptom: '可能偶发 Oops 或读到错误数据；必须用 copy_from_user/copy_to_user 并检查返回值。' },
        { at: 4, label: 'ioremap 后忘 readl', title: '写入被编译器/总线重排', symptom: '寄存器写顺序不符合预期。使用 readl/writel 保证顺序与字节序，必要时加屏障。' }
      ],
      note: '驱动的三层边界：用户/内核、内核/硬件、进程/中断。每一层都有专属 API，跨层“图省事”最终会以 Oops 或偶发故障的形式还债。'
    },
    case: {
      tag: '工程现场 · 驱动调试',
      title: '/dev 节点有了，write 却没反应',
      scene: '驱动加载成功、设备节点也出现了，但应用写入后 LED 不变。排查发现：驱动在 probe 里 ioremap 的地址是 AXI GPIO 的基地址，而 RTL 实际把 DO 寄存器放在了 +0x08；另外 write 没有检查 copy_from_user 返回值。修正偏移并补上错误处理后正常。',
      metrics: ['1 个节点', '0x00 vs 0x08', '2 处缺陷', '1 次 Oops'],
      points: [
        '节点存在只证明注册成功，不证明寄存器访问正确。',
        '先读 ID 寄存器确认 IP 版本，再写控制寄存器。',
        '所有 copy_*_user 的返回值都必须检查。',
        '用 devmem 或示波器分别验证“软件写了”和“硬件收到了”。'
      ],
      ask: '如果 write 返回成功但硬件无动作，你会怎样把问题一分为二？'
    },
    quiz: [
      {
        q: '内核驱动访问用户态缓冲区必须使用？',
        options: ['memcpy', 'copy_from_user / copy_to_user', '直接解引用', 'strcpy'],
        answer: 1,
        exp: '用户地址可能缺页、非法或属于其他进程；copy_*_user 负责安全拷贝并返回错误。'
      },
      {
        q: '访问 AXI IP 寄存器时，ioremap 得到的地址应配合什么读写？',
        options: ['readl / writel', 'scanf / printf', 'fread / fwrite', 'malloc / free'],
        answer: 0,
        exp: 'readl/writel 处理 MMIO 的字节序与访问语义；普通指针解引用可能被优化或产生非预期访问。'
      },
      {
        q: '设备节点已出现但 probe 可能失败，最直接的确认点是？',
        options: ['dmesg 中的 probe 日志与返回值', '串口波特率', 'SD 卡容量', 'CPU 温度'],
        answer: 0,
        exp: 'probe 失败会打印错误或返回 -EPROBE_DEFER；dmesg 与 /sys 是首选证据。'
      }
    ]
  }

});
