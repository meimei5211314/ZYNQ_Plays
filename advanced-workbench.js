(function(){
  'use strict';
  const W=window.ZynqWorkbench,M=window.AdvancedModels;if(!W||!M)return;
  const r=(key,label,min,max,value,step=1,unit='')=>({key,label,min,max,value,step,unit});
  const t=(key,label,value=false)=>({key,label,value,toggle:true});
  const n=x=>Number(x.toFixed(3)).toLocaleString('zh-CN');
  const labels={step:'阶段',section:'段',flash:'ROM / B',ram:'RAM / B',action:'动作',address:'地址',detail:'解释',payload:'槽位值',head:'head',observed:'读值',request:'源请求',destEdge:'目的时钟沿',sync1:'第一级',sync2:'第二级',event:'累计事件',owned:'资源状态',iteration:'迭代',previous:'上轮 R',jobs:'干扰次数',response:'本轮 R / ms',chunk:'本次收到的字节',buffered:'保留字节',frames:'本次交付序号',crcErrors:'累计 CRC 错',old:'旧槽',candidate:'候选槽',selected:'恢复值',active:'启动槽',floor:'版本下限',decision:'判断',integer:'整数值',value:'解释值',arrivals:'到达数',served:'完成数',accepted:'累计接纳',rejected:'累计拒绝',completed:'累计完成',temperature:'结温 / °C',power:'功率 / W',energy:'能量 / J',meaning:'解释'};
  const add=(kind,spec)=>W.register(kind,Object.assign({},spec,{labels:Object.assign({},labels,spec.labels)}));
  add('layout',{
    intro:'把链接后的段放进存储预算，逐步检查复制、清零与栈保留。数字单位均为字节。',
    fields:[r('text','.text / 只读区',512,8192,2048,256),r('data','.data 初值',0,2048,256,128),r('bss','.bss',0,4096,768,128),r('stack','栈保留',256,4096,1024,256),r('ram','可用 RAM',1024,8192,4096,512),t('textInRam','代码也装入当前 RAM 池执行',true)],
    predict:'.bss 增大 1 KiB，固件镜像与 RAM 都会增大 1 KiB 吗？',answer:'常见 ELF 布局中 .bss 为 NOBITS，只占运行时内存；.data 的初值既需装载存储也需运行内存。以实际链接脚本、program headers 和 map 为准。',
    limit:'简化分段预算；未计对齐、堆、页表、DMA 保留区和镜像头。默认代码装入本 RAM 池执行；关闭后假设代码从独立可执行区执行，本 RAM 池不承担 .text。Zynq 的 FSBL 可将代码装入 DDR；本模型不配置真实映射。',
    run:p=>{const x=M.layout(p);return {...x,stats:[[x.flashUsed,'装载存储 / B'],[x.ramUsed,'运行 RAM / B'],[x.freeRam,'剩余 RAM / B']],bars:[{label:'装载存储',value:x.flashUsed},{label:'运行 RAM',value:x.ramUsed},{label:'RAM 总量',value:p.ram}],message:x.freeRam<0?'预算越界；先查段与保留区，再调整链接布局。':'先看预算，再展开步骤表核对启动动作。',fault:x.freeRam<0};}
  });
  add('mmu',{
    intro:'改变虚拟地址、物理页框和写权限；注入“页表已更新但 TLB 未失效”。',
    fields:[r('address','虚拟地址（十进制）',4096,8191,4660),r('frame','新物理页框号',1,15,9),t('writable','允许写入',true),t('write','本次访问为写'),t('stale','注入旧 TLB：仍指向页框 5'),t('invalid','取消页表有效位')],
    predict:'把页表改到新物理页后，下一条访问必然命中新地址吗？',answer:'不必然。旧 TLB 项可能继续生效；还须按架构要求执行页表维护、TLB 失效与相应屏障。实际页表格式、地址空间与 SMP shootdown 必须按 ARMv7-A 和内核版本处理。',
    limit:'4 KiB 页的地址拆分示意，不模拟 A9 页表描述符编码、ASID、权限域或 cache。权限失败是模型状态，不生成真实 Data Abort。',
    run:p=>{const x=M.mmu({...p,valid:!p.invalid});return {...x,stats:[[x.vpn,'虚拟页号'],[x.offset,'页内偏移 / B'],[x.fault||'0x'+x.physical.toString(16),'转换结果']],message:x.fault?'访问被 '+x.fault+' 拒绝。':p.stale?'当前访问仍落在旧页框；对照关闭旧 TLB。':'页内偏移保持不变。',fault:!!x.fault||p.stale};}
  });
  add('publish',{
    intro:'逐步观察“先写数据，再发布索引”的可见性关系。用两个开关破坏发布与获取的配对。',fields:[t('release','生产者 release 发布 head',true),t('acquire','消费者 acquire 获取 head',true)],
    predict:'head 是 atomic 或 volatile，就足以保证 payload 已可读吗？',answer:'仅 atomic head 的 relaxed 访问不建立 payload 的跨线程 happens-before。消费者读到 release 发布的索引并执行对应 acquire，才能建立所需顺序；槽位复用方向也要对 tail 建立同步。',
    limit:'这是可见性教学状态机。缺少同步的非原子 payload 读写在 C 中可能产生数据竞争和未定义行为；红色轨迹不是 C 标准保证的某一次执行。仅单生产者、单消费者。',
    run:p=>{const x=M.publish(p);return {...x,stats:[[x.observed,'消费者观察值'],[p.release?'release':'缺失','发布'],[p.acquire?'acquire':'缺失','获取']],message:x.observed===42?'发布链成立；还需检查 tail 的槽位复用链。':'缺少同步：索引先可见的危险轨迹。',fault:x.observed!==42};}
  });
  add('cdc',{
    labels:{t:'离散时间'},
    intro:'目的时钟每 5 个离散单位采样；改变窄脉冲相位与宽度，再用保持请求的握手对照。',fields:[r('phase','请求开始相位',1,4,1),r('width','源脉冲宽度',1,8,1),t('handshake','请求保持到目的端观察到')],
    predict:'所有单周期脉冲经过双触发器同步器后都能被捕获吗？',answer:'不能。短脉冲可能落在两个目的采样沿之间。握手或 toggle 方案可传递事件，但需满足事件间隔，并实现应答返回同步和复位协议；连续数据应考虑异步 FIFO。',
    limit:'确定性数字采样模型，不模拟模拟亚稳态、MTBF 或真实应答返回延迟。“保持到观察到”省略返回同步，仅用于解释为何请求必须保持，不能直接作为可综合 RTL。',
    run:p=>{const x=M.cdc(p);return {...x,keys:['request','destEdge','sync1','sync2','event'],stats:[[x.captured,'目的端事件数'],[5,'目的周期 / 单位'],[p.handshake?'保持请求':p.width,'源脉宽策略']],message:x.captured?'事件已到达；用不同相位检查延迟变化。':'脉冲被漏采；两级同步器不能保证捕获任意窄事件。',fault:!x.captured};}
  });
  add('lifecycle',{
    intro:'在第几个资源申请后停止，观察失败回滚。全部成功时比较安全卸载与错误的释放顺序。',fields:[r('failAt','成功获取资源个数',0,4,2),t('unsafe','注入故障：先释放内存再停止 DMA')],
    predict:'用了 devm_kzalloc，设备移除时就可以省略停止 DMA 吗？',answer:'不能。自动释放只管理资源寿命，不会自动证明设备已停止访问。应先阻止新请求、停设备、同步 IRQ/异步任务，最后解除映射并释放对象；具体顺序由设备依赖决定。',
    limit:'通用资源依赖示意；不是实际 Linux probe/remove 实现。同步 IRQ、DMA 终止、runtime PM 与锁的正确顺序需要结合驱动版本审查。失败点表示已成功获取的数量。',
    run:p=>{const x=M.lifecycle(p);return {...x,stats:[[p.failAt,'已获取资源'],[x.cleanup.length,'清理动作'],[p.unsafe&&p.failAt===4?'危险':'可审查','卸载路径']],message:p.unsafe&&p.failAt===4?'对象先释放，DMA 或 ISR 仍可能访问，形成 UAF。':'只撤销已成功获取的资源；完整运行路径先解除异步访问。',fault:p.unsafe&&p.failAt===4};}
  });
  add('rta',{
    intro:'迭代 R=C+B+ceil(R/Tₕ)Cₕ。每轮用上轮响应窗口重新计算高优先级干扰。单位统一为 ms。',fields:[r('cost','本任务 WCET C',0.1,8,2,0.1),r('blocking','阻塞上界 B',0,5,1,0.1),r('deadline','截止期 D',0.1,20,5,0.1),r('hpCost','高优先级 WCET Cₕ',0.1,6,1,0.1),r('hpPeriod','高优先级周期 Tₕ',0.1,15,4,0.1)],
    predict:'CPU 平均利用率不高，是否就能保证某个任务满足截止期？',answer:'不能。短截止期任务仍可能受阻塞和高优先级干扰。固定优先级响应时间迭代收敛且 R≤D，才在既定假设下给出可调度结论；先获得可信 WCET 与阻塞上界。',
    limit:'单核、固定优先级、一个高优先级周期任务、可抢占、无释放抖动/自挂起、任意截止期需另分析。输入是设定上界，不能把 Linux 的有限次测量最大值当成已证明 WCET。',
    run:p=>{const x=M.rta(p);return {...x,stats:[[x.response,x.converged?'响应界 / ms':'当前迭代 / ms'],[p.deadline,'截止期 / ms'],[x.schedulable?'满足':'未满足','当前假设下结论']],message:x.schedulable?'迭代收敛且不超过截止期。':'迭代超过截止期或未收敛；该数值不是最终响应上界，本次未证明可调度。',fault:!x.schedulable};}
  });
  add('parser',{
    intro:'真正增量解析同一条字节流：帧内含 A5 5A；按不同大小分块，插入噪声或损坏首帧 CRC。',fields:[r('split','每次 feed 的字节数',1,20,5),t('corrupt','损坏首帧 CRC'),t('noise','帧前插入噪声与孤立 A5',true)],
    predict:'一次 TCP read 收到半帧或多帧，是否属于协议错误？',answer:'都不是。字节流不保存应用帧边界。解析器必须跨调用保留有限状态，按长度等待完整帧，校验后交付；错误时重新寻找同步点，并明确超时和资源上界。',
    limit:'课程自定义二进制协议，非 Modbus：A5 5A | v1 | len16LE | seq16LE | payload≤256 | CRC16Modbus(version..payload)，低 CRC 先传。浏览器逐字节真实计算 CRC；无 socket/串口 IO。Python 实验增加超时与模糊测试。',
    run:p=>{const x=M.parser(p);return {...x,stats:[[x.frames.length,'有效帧'],[x.crcErrors,'CRC 错误'],[x.frames.map(f=>f.seq).join(','),'交付序号']],message:p.corrupt?'首帧被拒绝，解析器重新同步并交付后续有效帧。':'分块大小不应改变有效帧及其 payload。',fault:p.corrupt};}
  });
  add('journal',{
    intro:'拖动断电位置：旧槽始终保留，新槽只有最后提交且校验通过才有效。',fields:[r('cutAfter','已完成写入阶段（0–6）',0,6,6),t('tamper','破坏候选槽 CRC')],
    predict:'写入 payload 后立即断电，恢复程序应选新值 99 还是旧值 42？',answer:'应选完整且有效的旧记录。新记录尚未提交时不能生效；恢复需同时检查长度、版本/代数、CRC 和提交标记。真实介质还须考虑写粒度、擦除单元、掉电行为与磨损。',
    limit:'六阶段逻辑事务示意；不是 NOR/NAND 电气仿真。Python 实验在模型的每一个写字节处断电穷举。实际 flash 的 1→0、ECC、坏块、控制器缓存与 fsync 语义需上板验证。',
    run:p=>{const x=M.journal(p);return {...x,stats:[[x.selected,'恢复结果'],[p.cutAfter,'完成阶段'],[x.committed?'有效':'无效','候选记录']],message:x.committed?'候选槽完成提交与校验，恢复到新值 99。':'候选槽不完整或损坏，恢复到旧值 42。',fault:p.tamper};}
  });
  add('ota',{
    intro:'按可信验证结果、版本下限和业务健康检查推演 A/B 更新。失败试启动耗尽后回到 A。',fields:[t('signature','候选签名验证通过',true),r('version','候选安全版本',1,6,4),r('floor','允许的最低安全版本',1,6,3),t('healthy','候选业务健康检查通过',true),r('tries','最大试启动次数',1,4,3)],
    predict:'只要签名有效，旧的有漏洞镜像就可以接受吗？',answer:'还需防回滚策略。签名证明来源与完整性，不代表版本安全。更新先验证候选再试启动；确认前不能过早抬高版本下限，否则健康检查失败后可能无法恢复旧槽。',
    limit:'签名开关是外部验证器的输入，本页面不执行密码签名或模拟可信根。下限是课程元数据策略，不代表 eFUSE；真实不可逆熔丝升级必须另审计回退兼容性。',
    run:p=>{const x=M.ota(p);return {...x,stats:[[x.active,'最终启动槽'],[x.floor,'最终版本下限'],[x.rejected?'拒绝':p.healthy?'确认':'回退','决策']],message:x.rejected?'候选在启动前被拒绝。':p.healthy?'健康检查通过，确认候选并更新策略元数据。':'候选试启动失败，恢复已知可用旧槽。',fault:x.rejected||!p.healthy};}
  });
  add('fixedpoint',{
    intro:'追踪输入编码、宽乘积、舍入和饱和；比较 −1×−1 在饱和与回绕下的差异。',fields:[r('a','输入 A',-1,1,0.5,0.01),r('b','输入 B',-1,1,0.5,0.01),{key:'bits',label:'小数位数',options:[[7,'Q1.7'],[15,'Q1.15']],value:15},t('wrap','注入故障：溢出回绕')],
    predict:'Q1.15 的 −1×−1 可以输出准确的 +1 吗？',answer:'不能。最大可表示数为 32767/32768，应饱和到 32767；直接截断回绕会得到 −32768。这里乘积缩放用最近舍入，恰在中点时远离零；库函数可能采用不同规则，要逐项比较。',
    limit:'单次带符号乘法，JS Number 能精确表示这里的 Q15 整数乘积。未模拟多抽头累加、ADC 噪声和滤波器频响。Q1.n 表示范围 −1 到 1−2⁻ⁿ，输入 +1 会先饱和。',
    run:p=>{const x=M.fixedpoint(p);return {...x,stats:[[x.word,'输出整数'],[x.value.toFixed(8),'输出实数'],[x.error.toExponential(3),'相对理想乘积误差']],message:p.wrap&&x.saturated?'溢出回绕改变了符号；比较关闭故障后的输出。':'展开步骤检查量化与舍入；Python 参考测试覆盖正负半值。',fault:p.wrap&&x.saturated};}
  });
  add('queuebudget',{
    labels:{t:'时间槽'},
    intro:'每个时间槽先服务已有队列，再接纳新到达；超出容量的工作明确拒绝，计数始终守恒。',fields:[r('arrival','每槽持续到达',0,10,5),r('service','每槽可完成',1,10,2),r('capacity','队列容量',1,24,8),r('burst','首槽额外突发',0,20,8)],
    predict:'把容量加倍，能否解决持续到达速率高于服务速率？',answer:'不能。只能延缓耗尽；须限流、扩容或采用有定义的降级与拒绝策略。验收时同时检查 offered=accepted+rejected、accepted=completed+remaining，并测最坏停顿和队列水位。',
    limit:'固定离散服务能力、FIFO、无重试、不含网络/DDR 抖动；拒绝代表业务明确丢弃，不伪装成背压。真实背压必须把未提交工作保留在上游并计入端到端延迟。',
    run:p=>{const x=M.queuebudget(p);return {...x,keys:['arrivals','served','occupancy','rejected'],stats:[[x.offered,'总到达'],[x.rejected,'明确拒绝'],[x.high,'最高水位']],message:'接纳 '+x.accepted+' = 完成 '+x.completed+' + 剩余 '+x.remaining+'；到达 '+x.offered+' = 接纳 + 拒绝。',fault:x.rejected>0};}
  });
  add('thermal',{
    labels:{t:'时间 / s'},
    intro:'使用一阶热 RC 的解析离散更新。改变热阻、热容、功耗，并观察带滞回降额对温度和能量的影响。',fields:[r('ambient','环境温度',15,45,25,1,'°C'),r('power','持续功率',1,8,4,0.5,'W'),r('resistance','热阻 Rθ',2,20,10,1,'°C/W'),r('capacitance','等效热容',2,20,10,1,'J/°C'),r('limit','降额触发温度',35,85,50,1,'°C'),t('throttle','达到阈值后降到 40% 功耗')],
    predict:'换大散热片后温升变慢，就说明最终温度更低吗？',answer:'温升时间常数为 RθCθ，稳态温升为 P×Rθ。增大热容会减缓温升，却不必降低稳态温度；降低热阻才降低同功率稳态温升。降额还会改变吞吐与截止期，应联合测量。',
    limit:'参数均为教学设定，非 Zynq 实测；单节点、线性热阻热容、瞬时功率切换。不能据图选择真实结温极限；器件等级、XADC 误差、环境与散热结构需按数据手册和实测确定。',
    run:p=>{const x=M.thermal({...p,duration:300,step:5});return {...x,plot:{x:'t',y:'temperature',min:p.ambient,label:'结温 / °C',unit:'s'},stats:[[n(x.temperature)+' °C','末端温度'],[n(x.energy)+' J','累计能量'],[n(p.resistance*p.capacitance)+' s','热时间常数']],message:p.throttle?'阈值触发降额，回落 3°C 后恢复；检查数据表中的功率。':'理想稳态温度 '+n(p.ambient+p.power*p.resistance)+'°C；有限时间不一定到达稳态。',fault:x.temperature>p.limit};}
  });
  add('clock',{
    intro:'观察 16 位定时器回绕，再独立计算晶振漂移和双向链路不对称造成的授时偏差。',fields:[r('elapsedTicks','两次读取实际间隔 / tick',10,131000,100,10),r('ppm','本地频率误差',-100,100,20,5,'ppm'),r('seconds','自由运行时间',1,600,60,1,'s'),r('forward','前向链路延迟',10,500,100,10,'µs'),r('reverse','反向链路延迟',10,500,100,10,'µs')],
    predict:'无符号减法能处理回绕，是否意味着任意长的读数间隔都能恢复？',answer:'不能。模减法要求真实间隔小于一个完整模数；多次回绕次数无法从两个读数获知。PTP 的四时间戳也不能自行消除链路不对称，偏差为 (前向延迟−反向延迟)/2。',
    limit:'起点固定 65500、16 位模计数；完整间隔只有仿真器知道。漂移为固定 ppm 近似，未模拟伺服环、温漂与时间戳硬件。没有宣称本板达到任何 PTP 精度。',
    run:p=>{const x=M.clock(p);return {...x,stats:[[x.end,'终止计数'],[x.modularDelta,'模减法结果'],[x.driftUs+' µs','自由运行漂移']],message:x.ambiguous?'真实间隔已超过 65536 tick；仅两个读数无法恢复。':'当前间隔小于模数，可用模减法恢复；前提须由设计保证。',fault:x.ambiguous};}
  });
})();
