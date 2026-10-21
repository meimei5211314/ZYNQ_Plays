# Zynq 工程能力讲义

打开 [course.html](course.html) 开始学习，或直接双击该文件。全部讲义、动画、计算和学习记录均在本地运行，不依赖 CDN；查阅外部原始资料时需要联网。

## 面向高级工程能力的补强

- 71 章正文、4 份附录、11 个学习篇章。第 52–71 章新增 ABI/ELF、MMU/TLB、C11 并发、CDC/RDC、RTL 验证、驱动生命周期、RTA、诊断、协议健壮性、断电恢复、安全升级、构建、DSP、容量、测量、功耗热与时基。
- 25 类可计算实验、65 个入口，覆盖 46 章；每章都有预测、对照实验、故障定位、证据验收与迁移挑战。
- 28 处有来源的公开参考案例；其余情境明确标注教学用途，练习数字不冒充实测。
- 两个可运行综合项目：采集数据链；控制超时、重启与升级恢复。Python 参考实验只依赖标准库，另附 C11 SPSC 和 AXI-Stream RTL 自检。
- 4 份附录加入闭卷抽题、解析与待复习记录。
- 测验支持保存和重新作答；工程记录支持导出 JSON、恢复并合并课程进度。

缺口分析与完整目录见 [SENIOR-PLAN.md](SENIOR-PLAN.md)，项目验收见 [SENIOR-ACCEPTANCE.md](SENIOR-ACCEPTANCE.md)，代码与命令见 [labs/README.md](labs/README.md)。

建议先体验 [AXI 握手](chapter9.html#zx-lab)、[旧 TLB](chapter53.html#zx-lab)、[协议重同步](chapter60.html#zx-lab)、[断电提交](chapter61.html#zx-lab)、[定点溢出](chapter64.html#zx-lab) 和 [热响应](chapter67.html#zx-lab)。

## 怎样学得扎实

1. 操作前写下预测，说明使用了什么假设。
2. 一次只改变一个参数，对照正常与故障的结果。
3. 展开数据表，逐拍解释，不只看动画。
4. 用自己的 RTL 仿真、驱动日志或板上测量复现；在工程训练区保存证据位置。
5. 隔天闭卷复盘，换一个输入条件，再解释一次。

页面模型会注明简化条件。模型正确不等于实际工程通过时序、性能或安全验证；各章验收条件要求独立的工程证据。

## 版本与资料

主线沿用原教程的领航者 Zynq-7020 与 Vivado/Vitis/PetaLinux 2020.2。上游资料用于核对原理，实际使用时应冻结匹配的 BSP、内核、工具和源码提交；不把上游 main 的当前接口直接当作 2020.2 接口。

原教程：[ZYNQ-7020 嵌入式开发完全教程](https://zn-phd336699.github.io/ZYNQ_Learning/)。修订依据、范围及限制见 [OPTIMIZATION-REPORT.md](OPTIMIZATION-REPORT.md)。

学习记录保存在浏览器本地。使用 file://、localhost 和 127.0.0.1 会形成不同的存储位置；迁移浏览器、路径或访问方式前请导出记录。恢复会保留已有记录，并按章节合并课程进度。

## 本地预览与检查

无需安装项目依赖。在当前目录运行：

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

再访问 `http://localhost:8765/course.html`。修改文件后刷新页面；若浏览器缓存旧脚本，可关闭预览后重新打开，或使用浏览器的强制刷新。

开发检查使用 Node 内置能力：

```powershell
node tools/verify.cjs
node --test --test-isolation=none tests/models.test.cjs tests/advanced-models.test.cjs
python -m unittest discover -s labs/tests -v
python -m labs.reference.capstone
python -m labs.reference.recovery
```

静态页面生成：修改 `senior-content-core.js` 或 `senior-content-systems.js` 后运行 `node tools/build-senior.cjs`；不要只修改生成的第 52–71 章 HTML。

检查报告写入 [verification-report.json](verification-report.json)。GitHub Actions 配置会在 Linux 上进一步编译 C、运行 Icarus RTL 自检；是否实际通过须查看对应提交的运行结果。初始本机没有 C/RTL 工具链，板级验证仍需自行执行。原文件备份留在本机 `_backups/`，不进入仓库。

来源说明：讲义沿用原教程的主题与原有内容，新增教学设计、工程练习和参考实现；保留原教程出处。公开项目通过原始链接提供参考。
