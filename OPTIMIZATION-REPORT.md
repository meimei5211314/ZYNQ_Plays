# 讲义阅读分析与优化记录

日期：2026-10-21。

## 阅读与判断

已通过浏览器读取原教程的课程定位、工具基线、全部章节结构及重点技术内容，对本地 51 章、4 份附录和现有互动引擎进行了结构检查。重点核对架构、AXI、UIO、DMA、AMP、RTOS、时序与验证边界；本次不是对全部 C/RTL/内核片段的编译认证。

原有资料覆盖面较全，已有波形、流程、状态机、寄存器与自检。主要问题是部分演示仅播放预设数据、故障案例缺少实测出处、学习完成依赖自评，以及若干代码与技术说法互相矛盾。优化以“预测—实验—证据—解释”为核心，沿用离线结构。

## 交付范围

| 项目 | 本轮结果 |
| --- | --- |
| 独立工程任务 | 全 51 章，每章有前置知识、四步练习、验收证据与迁移挑战 |
| 可计算实验 | 12 类，在 29 章提供 44 个入口，保留原有演示供切换 |
| 动画控制 | 播放、暂停、单步、时间轴与数据表；离开可见区域或后台时停止新实验播放 |
| 真实公开案例 | 8 处参考 AMD XUP/EDT、embeddedsw、OpenAMP、libmodbus、FreeRTOS、sel4test |
| 情境标识 | 其余原有故事标注为教学情境，不宣称具体数字来自实测 |
| 附录训练 | A/B/C/D 均有闭卷抽题与待复习记录 |
| 学习记录 | 测验保存与重做；实验记录本地保存；导出、恢复和进度合并 |
| 可访问性 | 表单标签、键盘操作、状态说明、完整数据表、减弱动态效果支持 |

## 重点纠错

- 第 1 章：修正满 32 位掩码的移位边界；板卡封装以实物和原理图确认。
- 第 2 章与附录 A：修正“PL 访问 PS DDR 只能经 HP”和“OCM 零等待”的绝对表述；区分 ACP 一致性条件与 HP 的非一致访问。
- 第 9 章：修正 PWM 状态未复位、使能未生效、SPEED=0 下溢、8 位常量截断与载波/包络混淆；明确用户逻辑片段与协议验证的边界。
- 第 28 章：修正 UIO 中断“read 后自动重新使能”的错误，说明 uio_pdrv_genirq 的 irqcontrol 写 1、外设清源、映射选择与 fd 生命周期。
- 第 37 章：不再把不同任务到达序列直接用于比较优先级继承收益；解释继承不能消除剩余临界区执行时间。
- 第 38 章：区分 Idle 与 IOC、停止与 Reset、设备 DMA 地址与 CPU 地址；修正缓存交接、O_SYNC 保证、SG 占位符、包尾计数、环形缓冲所有权及 PS PL330/PL AXI CDMA 混淆。
- 第 40 章：删除未经平台核对的 remoteproc 伪设备树与混合 API；明确 Zynq-7000 A9 与 ZynqMP R5 的差别。
- 第 44 章：移除带问号与区间猜测的“完整 SIL 算例”，改为明确假设的 1oo1 基础计算；简化模型不输出整机认证结论。
- 第 48–49 章：区分 Cortex-M 与 Cortex-A9 的异常/切换/栈模型，修正 ARM_CA9 目录、1 kHz tick 与 100 µs 周期矛盾、GIC 优先级编码、PMR 方向及错误的 A9 HardFault/SCB 示例。
- 第 50 章：删除 tk1 镜像名和未核对构建占位符；区分平台支持、已验证配置、用户组件与完整产品保证，避免承诺 A9 上依赖其他架构扩展的虚拟化路径。

## 技术依据

- [Arm AXI 协议](https://developer.arm.com/-/media/Arm%20Developer%20Community/PDF/IHI0022H_amba_axi_protocol_spec.pdf)：通道独立与握手规则。
- [AMD UG585](https://docs.amd.com/r/en-US/ug585-zynq-7000-SoC-TRM)：PS/PL 通路、ACP、PS DMA 与处理器资源。
- [AMD PG021](https://docs.amd.com/r/en-US/pg021_axi_dma)、[PG034](https://docs.amd.com/r/en-US/pg034-axi-cdma/Introduction)：AXI DMA 与 AXI CDMA。
- [Linux DMA mapping Guide](https://docs.kernel.org/core-api/dma-api-howto.html)、[UIO 文档](https://docs.kernel.org/driver-api/uio-howto.html)：映射、所有权与用户空间中断接口。
- [FreeRTOS ARM_CA9 移植源码](https://github.com/FreeRTOS/FreeRTOS-Kernel/tree/main/portable/GCC/ARM_CA9)：移植接口、SVC/IRQ 与优先级约定。
- [seL4 Verified Configurations](https://docs.sel4.systems/projects/sel4/verified-configurations.html)：配置对应的证明属性。

## 验证与实际限制

静态检查覆盖全部 56 个 HTML 页面与本地链接、脚本语法、实验注册、章节前置关系、资料引用键和测验答案索引。模型测试使用独立手算样例，覆盖握手保持、通道独立、时序余量、消抖、FIFO 守恒、缓存旧值、扫描延迟、tick 量化、带宽、优先级继承、CRC 与启动关键路径。

浏览器逐章打开了 51 章及全部互动视图，检查组件可用性；在 390×844 视口检查了 51 章和 4 份附录，无页面横向溢出。实际操作验证了 AXI 故障、Cache clean 前后读值、逐拍控制、附录换题、测验重做、笔记恢复及备份进度合并。独立审阅发现的进度合并、动态导航关闭与 AXI-Lite 标签问题均已修正并复测。

浏览器验证使用本机 HTTP 服务；测试工具不允许 file:// 导航，因此没有直接验证双击文件模式。静态检查确认运行所需的脚本与样式均来自本地，未引入 CDN。

当前环境未连接目标板；本轮没有调用 Vivado/Vitis、交叉工具链或 HDL 仿真器。本轮没有运行 FPGA 实现、内核模块、所有原有片段的编译、板上吞吐/时延或工业安全测试。教材中的代码片段与流程仍须按所选版本集成；真实硬件参数、引脚、工具兼容性及产品合规需由对应工程验证。页面中的数值模型不替代这些检查。

原有其他章节仍包含用来说明结构的代码片段，不能把整套讲义理解为一个已经构建通过的完整软件发行版。后续实际项目应按各章新增验收任务逐项保存独立证据。
