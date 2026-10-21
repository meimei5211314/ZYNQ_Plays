# 可运行参考实验

这组实验给课程提供可以检查结果的代码。Python 参考实现仅使用标准库，在普通电脑上即可运行；C 和 RTL 各带一个自检入口。板卡、JTAG、UART 设备和 Vivado 都不是运行 Python 实验的前提。

从仓库根目录执行以下命令，建议 Python 3.10 或更新版本：

```text
python -m unittest discover -s labs/tests -v
python -m labs.reference.capstone
python -m labs.reference.capstone --seed 42
python -m labs.reference.recovery
```

`unittest` 应报告全部通过；综合实验会向标准输出写入一个 JSON 对象。修改实现时先运行测试，确认修改没有改变约定。

| 目录 / 文件 | 实验内容 | 验收方式 |
| --- | --- | --- |
| `reference/protocol.py` | UART 帧编码、增量解析、重同步与超时 | 跨任意位置拆包、CRC、噪声和长度测试 |
| `reference/journal.py` | 双槽日志、CRC32、最后提交 | 穷举每个字节写入后的断电点 |
| `reference/dsp.py` | Q1.15 乘法、舍入和饱和 | 手算定点边界向量 |
| `reference/capstone.py` | 故障注入、数据处理和检查点恢复 | 99 帧、1 次 CRC 错误、1 个序号缺口 |
| `reference/recovery.py` | 命令超时、重启安全状态、持久序号与升级策略 | 四项安全状态为 true，恢复序号 2，失败回 A / 成功确认 B |
| `c/spsc.c` | C11 单生产者单消费者环形队列 | 容量、空满、10 万项保序与回绕自检 |
| `rtl/axis_source.sv` | AXI4-Stream 计数源 | `tb_axis_source.sv` 自检记分板 |

## 1. UART 协议与超时

线上协议精确定义如下，所有多字节字段均为小端：

| 起始偏移 | 字段 | 字节数 / 约束 |
| --- | --- | --- |
| 0 | 同步头 | `A5 5A`，2 字节 |
| 2 | 版本 | `01`，1 字节 |
| 3 | 载荷长度 | 无符号 16 位，`0..256` |
| 5 | 序号 | 无符号 16 位，`0..65535` |
| 7 | 载荷 | 长度字段指定的字节数 |
| 7 + 载荷长度 | CRC | CRC-16/Modbus，低字节先发 |

总长度为 `9 + 载荷长度`。CRC 覆盖版本、长度、序号和载荷，不覆盖同步头及 CRC 自身；初始值 `0xFFFF`，反射多项式 `0xA001`，无最终异或。标准向量 `123456789` 的 CRC 是 `0x4B37`。空载荷、序号 0 的完整帧为 `A5 5A 01 00 00 00 00 19 C0`。

```python
from labs.reference.protocol import FrameParser, encode_frame

parser = FrameParser()
wire = encode_frame(b"hello", seq=7)
assert parser.feed(wire[:4]) == []
assert parser.feed(wire[4:]) == [(7, b"hello")]
```

`feed()` 接受任意分块，返回本次恢复出的 `(序号, bytes载荷)` 列表。解析器保留的输入缓冲区最多为 265 字节；无关噪声只可能保留结尾的 `A5`。`crc_errors`、`version_errors`、`length_errors` 和 `partial_timeouts` 提供可见的错误计数。

载荷允许包含 `A5 5A`，甚至包含一整个编码后的帧。因此，看到载荷中的同步头时，解析器会继续等待当前帧的约定长度。CRC 错误后从下一个字节寻找同步头；若噪声或坏长度形成另一个貌似合理的未完成帧，也可能继续等待。传输层必须配置合理的帧接收超时，并在超时时调用：

```python
recovered_frames = parser.expire_partial()
```

该方法放弃一个未完成候选帧并重新扫描已缓冲的数据，也可能返回其后已经完整到达的帧。新的未完成候选帧需要它自己的超时。超时长度应按波特率、最大帧长和驱动调度间隔设定；本实现不隐藏系统时钟或自动猜测包边界。

## 2. 双槽日志与断电枚举

```python
from labs.reference.journal import TwoSlotJournal

journal = TwoSlotJournal(max_payload=16)
assert journal.write(b"old")
assert not journal.write(b"new", cut_after=3)
rebooted = TwoSlotJournal.from_slots(journal.export_slots(), max_payload=16)
assert rebooted.recover() == (1, b"old")
```

每槽布局为：`generation:u32LE | length:u16LE | 定长载荷区 | CRC32:u32LE | commit:u8`。载荷区未用部分填 `FF`。CRC32 覆盖代数、长度和完整载荷区；只有提交字节为 `A5`、长度合法且 CRC 正确的槽才有效。代数从 1 开始，取最高代数恢复，达到 `0xFFFFFFFF` 后拒绝继续写入，避免静默回绕。

一次更新只触碰非活动槽：先使提交标志失效，再逐字节写正文和 CRC，最后写提交标志。`cut_after=N` 表示恰好完成前 N 个字节写操作后模拟断电。`write_operations` 给出完成一次更新的写操作总数。测试对首次写入和复用旧槽分别穷举所有断电点：最终提交之前恢复旧记录，完整提交之后恢复新记录。

模型假设两个槽相互独立，单字节赋值原子完成，允许任意 `0↔1` 改写。它不是 NOR Flash 驱动：真实 NOR 通常只能在编程时把 `1` 变成 `0`，擦除粒度也远大于一个字节。移植前需要独立擦除块、器件规定的断电行为、写完成检查、必要的屏障及缓存处理；不能直接把本模型的槽放在同一个擦除块里。

## 3. Q1.15 定点乘法

`q15_multiply(a, b)` 的两个输入必须是 `[-32768, 32767]` 内的整数，对应实数 `a/32768` 和 `b/32768`。先保留完整的有符号 32 位乘积，再舍入到最近整数，恰好一半时向远离零的方向舍入，最后饱和到 Q15 范围。

| 输入 | 结果 | 含义 |
| --- | --- | --- |
| `16384 × 16384` | `8192` | `0.5 × 0.5 = 0.25` |
| `-32768 × -32768` | `32767` | `1.0` 无法由正 Q15 表示，饱和 |
| `1 × 16384` | `1` | 正半 LSB 向外舍入 |
| `-1 × 16384` | `-1` | 负半 LSB 向外舍入 |
| `32767 × 32767` | `32766` | 最大正数相乘 |

Python 的整数不会在中间溢出。C 移植时必须先用 `int32_t` 保留乘积，且不要直接把对负数加正偏置后右移当作对称舍入。

## 4. 综合实验验收

综合实验构造序号 `0..99` 的 100 帧，载荷为 `<Hh`：重复序号和有符号样本 `seq * 200 - 10000`。对序号 42 的帧翻转一个 CRC 位，以指定种子随机切块，输入真实解析器；随后用 Q15 的 `0.5` 增益处理样本，并把最后有效序号写入双槽检查点、重新装载并恢复。

默认命令输出中的核心结果如下；`--seed` 只改变切块，不改变验收计数：

```json
{
  "generated_frames": 100,
  "valid_frames": 99,
  "crc_errors": 1,
  "sequence_gap_events": 1,
  "missing_sequences": 1,
  "first_sequence": 0,
  "last_sequence": 99,
  "q15_checksum": -4200,
  "checkpoint": {"generation": 1, "last_sequence": 99}
}
```

这是主机上的算法与故障注入验收。移植到板卡后仍须测量真实吞吐、驱动超时、DMA/缓存一致性和存储器掉电行为。

## 5. 控制、恢复与升级综合演练

运行 `python -m labs.reference.recovery`。状态机接收单调递增的逻辑 tick；命令在 tick 0 生效，tick 2 保持，tick 3 因超时进入 `SAFE` 且输出为 0。恢复时只载入持久序号来拒绝重放，始终从 SAFE 开始，不能自动重放上次执行器输出。有效新命令先持久化，再发布输出；写入返回失败或抛出异常时均先置 SAFE，异常继续交由调用者处理。

输出中 `timeout_safe`、`reboot_safe`、`replay_rejected`、`persistence_failure_safe` 均应为 true，`recovered_sequence` 为 2。`unhealthy_update` 在三次试启动失败后回 A，版本下限保持 3；`healthy_update` 确认 B 后下限变为 4。`verified` 仅表示外部可信验证器的结果，不执行密码签名；版本下限仅为模型元数据，不烧写 eFUSE。

测试穷举命令持久化的字节断电点，并从 RUN 状态注入存储异常。这里的 SAFE=0 是练习的业务定义，不代表所有执行器的安全状态；逻辑 tick 不保证真实墙钟时限。每条命令都持久化是为解释事务顺序，产品需重新计算写入寿命与批处理策略。真实看门狗、存储器断电、升级元数据原子性和安全输出电路仍须独立验证。

## 6. C11 SPSC 自检

先创建构建目录：PowerShell 使用 `New-Item -ItemType Directory -Force labs/.build`，POSIX shell 使用 `mkdir -p labs/.build`。已安装 GCC 时，在仓库根目录运行：

```text
gcc -std=c11 -O2 -Wall -Wextra -Werror -pedantic labs/c/spsc.c -o labs/.build/spsc_selftest
```

Linux / macOS 运行 `./labs/.build/spsc_selftest`；Windows GCC 通常生成 `.exe`，在 PowerShell 运行 `./labs/.build/spsc_selftest.exe`。成功时打印 `PASS spsc`、保序检查项数、有效容量和两个原子索引的 `atomic_is_lock_free` 结果。如平台要求原子运行库，按该工具链的文档链接 `libatomic`。

队列深度默认 8，可用 `-DSPSC_DEPTH=3` 重跑非 2 次幂回绕测试。保留一个空槽，因此容量恒为 `SPSC_DEPTH - 1`。只允许一个生产者调用 `spsc_push()`、一个消费者调用 `spsc_pop()`；必须先初始化，再发布队列；成功出队需要传入有效的非空输出指针。

生产者用 release 发布 `head`、消费者用 acquire 获取 `head`，保证先写数据后读数据；消费者用 release 发布 `tail`、生产者用 acquire 获取 `tail`，保证读完后才复用槽位。自有索引采用 relaxed 访问。自检在单线程交错操作下验证空满、回绕和保序；目标上的并发调度、内存布局与性能仍需实测。

C11 原子操作并不保证所有目标都无锁，不能把通过桌面自检当作 Cortex-A9 上无锁的证据。Cortex-A9 移植需要支持 C11 `_Atomic` 的编译器与运行库，检查目标汇编和 `atomic_is_lock_free`。`-DSPSC_NO_MAIN` 可只编译实现；裸机交叉编译示例：

```text
arm-none-eabi-gcc -std=c11 -O2 -Wall -Wextra -mcpu=cortex-a9 -marm -DSPSC_NO_MAIN -c labs/c/spsc.c -o labs/.build/spsc.o
```

该命令只产生目标文件。AMP、DMA、非一致性共享内存还需要正确的共享区属性、缓存维护和平台屏障设计；C11 内存顺序不能代替这些系统条件。

## 7. RTL 与自检 Testbench

`axis_source` 连续输出从 0 开始的计数，默认 16 位、每帧 8 拍，计数在位宽边界自然回绕。只有 `TVALID && TREADY` 时推进数据与帧内位置；反压期间保持 `TVALID/TDATA/TLAST`。`aresetn` 是**低有效同步复位**，只在 `aclk` 上升沿采样：复位清零所有输出，撤销待接收拍，释放后的第一个上升沿开始提供第 0 拍。

已安装 Icarus Verilog 时，从仓库根目录运行：

```text
iverilog -g2012 -Wall -s tb_axis_source -o labs/.build/axis_source.vvp labs/rtl/axis_source.sv labs/rtl/tb_axis_source.sv
vvp labs/.build/axis_source.vvp
iverilog -g2012 -Wall -s tb_axis_source -Ptb_axis_source.FRAME_BEATS=1 -o labs/.build/axis_source_one.vvp labs/rtl/axis_source.sv labs/rtl/tb_axis_source.sv
vvp labs/.build/axis_source_one.vvp
```

默认 Testbench 使用每帧 4 拍，第二次运行覆盖单拍帧边界。记分板在下降沿驱动输入、保存将要被接收的拍，在上升沿后延迟 1 ns 检查输出，避开非阻塞赋值采样竞争；覆盖持续反压、最后一拍连续三周期反压、运行中复位和重启，并设置看门狗。成功打印 `PASS axis_source`，断言失败使用 `$fatal`。

Vivado 已安装并配置命令行环境时，可从 `labs/.build` 目录使用其自带模拟器：

```text
xvlog --sv ../rtl/axis_source.sv ../rtl/tb_axis_source.sv
xelab tb_axis_source -s axis_source_sim
xsim axis_source_sim -runall
```

也可在 Vivado 中把 `axis_source.sv` 加入设计源、把 `tb_axis_source.sv` 加入仿真源，设置仿真顶层 `tb_axis_source` 后运行行为仿真。实现上板还需为具体板卡补充顶层、时钟、复位同步、管脚约束和真实接收端；此处不绑定某款板卡。

## 验证边界

Python 标准库测试可独立执行，包含协议拆包与错误恢复、日志逐字节断电点、Q15 边界和综合流程。初始开发环境仅提供 Python/Node，未检测到 GCC、Clang、Icarus、Verilator 或 Vivado 命令；C/RTL 文件提供了可执行的自检入口，只有实际运行上述工具且得到通过输出后，才能把相应部分标为已编译或已仿真。
