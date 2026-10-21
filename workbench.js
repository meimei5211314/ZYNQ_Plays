(function(){
  'use strict';
  const M=window.ZynqModels,esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=(n,d=2)=>Number(n.toFixed(d)).toLocaleString('zh-CN');
  const range=(key,label,min,max,value,step=1,unit='')=>({key,label,min,max,value,step,unit});
  const toggle=(key,label,value=false)=>({key,label,value,toggle:true});
  const select=(key,label,options,value)=>({key,label,options,value});
  const SPECS={
    stream:{intro:'把 READY 拉低，观察数据源能否守住当前拍。每一列表示该上升沿采样的信号。',fields:[range('stallStart','背压开始 / 拍',0,10,2),range('stallLength','背压长度 / 拍',0,10,4),toggle('broken','注入故障：没握手也递增数据')],predict:'READY 连续为 0 时，TDATA 和 TLAST 应当变化吗？',answer:'不能变化。TVALID 已有效而 TREADY 为 0 时，源必须保持有效信息；只有二者同时为 1 的上升沿才能消费这一拍。',limit:'单包 8 拍、单时钟、无 TKEEP；忽略跨时钟与 AXI DMA 内部流水。背压不是错误，忽略背压才会丢数。'},
    lite:{intro:'让 AW 和 W 错开到达，检查从设备是否分别保存两个通道的握手结果。',fields:[range('addressAt','AW 握手时刻',0,7,1),range('dataAt','W 握手时刻',0,7,4),toggle('broken','注入故障：只认同拍 AW 与 W')],predict:'地址先到 3 拍，能不能是一笔合法写事务？',answer:'能。AW 与 W 是独立通道，谁先到都合法。只有分别接收完地址与数据后，才能提交该笔写并产生响应。',limit:'单 outstanding、READY 恒高、32 位单寄存器。实际 RTL 还须处理 WSTRB、BREADY 与响应保持。'},
    timing:{intro:'拖动频率和路径延迟，观察 required、arrival 与 slack。先用手算预测，再调参数核对。',fields:[range('freqMHz','时钟频率',50,250,100,10,'MHz'),range('logic','组合逻辑延迟',0.5,12,7,0.1,'ns'),range('route','布线延迟',0.2,5,1,0.1,'ns'),range('uncertainty','时钟不确定度',0,1,0.2,0.1,'ns'),range('skew','捕获时钟偏斜',-1,1,0,0.1,'ns')],predict:'100 MHz 改成 200 MHz，原先 +0.8 ns 的路径还能过吗？',answer:'不能。周期由 10 ns 缩短到 5 ns，其他条件不变时 slack 降为 −4.2 ns。加流水、改善布局或降低频率需要结合接口延迟约束选择。',limit:'同频单周期 setup 模型，clk→Q=0.5 ns，setup=0.5 ns。正 capture skew 有利于 setup，却可能不利于 hold；这里没有分析 hold、CDC 或多周期路径。'},
    debounce:{intro:'固定一段含抖动的按键输入，只改变连续采样门槛；比较原始边沿和有效事件。',fields:[range('threshold','连续稳定采样次数',1,8,3)],predict:'“累计读到 3 次高电平”和“连续 3 次高电平”有什么差别？',answer:'累计计数会把中途回落也算进去。连续稳定计数在电平变化时重置候选计数，抖动不会过早生效。门槛越大，响应也越晚。',limit:'每列为一次采样，不代表 FPGA 时钟周期；异步引脚须先同步再消抖。同步器降低亚稳态传播概率，消抖不能替代 CDC。'},
    fifo:{intro:'模拟消费者暂停时 FIFO 的水位变化。取消背压，观察丢弃计数与收到的数据序号。',fields:[range('depth','FIFO 深度',2,12,4),range('pauseLength','消费者暂停 / 拍',0,16,8),range('consumeEvery','每几拍消费一次',1,4,1),toggle('backpressure','启用背压，满时让生产者等待',true)],predict:'加大 FIFO 能解决生产速率永远高于消费速率的问题吗？',answer:'不能。FIFO 只吸收有限突发；长期平均输入速率大于输出速率时，有限容量最终耗尽，必须限流、提速或定义丢弃策略。',limit:'同步 FIFO、先读后写、无空时直通；没有模拟异步 FIFO 的 Gray 指针或同步延迟。'},
    cache:{intro:'亲手执行读写与缓存维护，观察 CPU Cache 与 DDR 为什么会保存不同的值。',fields:[],predict:'把指针改成 volatile，DMA 就会看到 CPU 刚写的 42 吗？',answer:'不会。volatile 不能把脏 cache line 写回 DDR，也不能替代内存屏障或 DMA API。TX 在设备读前需要同步给设备；RX 在 CPU 读前需要同步给 CPU。',limit:'单 cache line、非一致 HP 通路、顺序动作。clean 写回，invalidate 丢弃缓存副本；对脏行直接 invalidate 会丢数据。Linux 应使用 DMA API，不能据此直接复制底层维护指令。'},
    plc:{intro:'传感器变化不等于过程映像立即更新。改变扫描周期、运算耗时和网络显示延迟，看三个时间点。',fields:[range('inputAt','输入跳变时刻',1,19,1,1,'ms'),range('scanMs','扫描周期',5,20,10,1,'ms'),range('computeMs','运算与输出提交',1,4,3,1,'ms'),range('networkMs','监控传输延迟',0,10,2,1,'ms')],predict:'输入在本轮采样后 1 ms 变化，为什么控制逻辑可能要下轮才看到？',answer:'扫描使用本轮开始时的输入快照。下一轮才更新输入映像，之后还要执行逻辑和提交输出。Web 显示又多了一段网络延迟。',limit:'周期采样、运算小于周期，无抢占和 IO 硬件滤波。输入恰在采样点变化时，本模型假设先变化再采样。'},
    periodic:{intro:'比较相对延时、绝对 tick 和硬件定时释放。量化精度与执行时间是两件事。',fields:[range('tickHz','Tick 频率',100,10000,1000,100,'Hz'),range('periodUs','目标周期',100,5000,2000,100,'µs'),range('execUs','每次执行耗时',20,1500,500,20,'µs'),select('method','释放方式',[['until','绝对 tick / DelayUntil'],['delay','相对 tick / Delay'],['hardware','硬件定时释放']], 'until')],predict:'1 kHz tick 下，100 µs 延时会换算成多少 tick？',answer:'常见整数换算结果是 0 tick，无法用 tick 延时表达该周期。使用硬件定时器或 PL 产生事件，再测量 ISR 与任务唤醒的延迟；硬件释放本身也不保证任务准时完成。',limit:'相对延时曲线是理想化“执行耗时+阻塞时长”；绝对曲线在超时时连续执行。没有模拟 tick 相位、抢占或 ISR 开销，不是 WCET 证明。'},
    bandwidth:{intro:'既算总线理论吞吐，也算上位机暂停时需要多少缓冲。带宽足够不代表不会丢数据。',fields:[range('channels','通道数',1,16,8),range('rateKsps','每通道采样率',10,1000,100,10,'kS/s'),select('bits','每样本存储位数',[[16,'16 bit'],[32,'32 bit']],16),range('efficiency','总线有效利用率',10,95,75,5,'%'),range('bufferKiB','接收缓冲',8,512,64,8,'KiB'),range('hostPauseMs','消费者暂停',1,200,50,1,'ms')],predict:'8 路×100 kS/s×16 bit，主机暂停 50 ms，64 KiB 缓冲够吗？',answer:'输入为 1.6 MB/s，50 ms 积压 80,000 B，大于 65,536 B，因此不够；即使总线空闲也会溢出。',limit:'固定 64 bit×100 MHz 总线，MB/s 用十进制，KiB 用 1024。效率是人为假设，不是本板实测；未计报头、打包、DDR 争用和缓存维护。'},
    inversion:{intro:'低优先级 L 先持锁，高优先级 H 在 t=1 请求锁，中优先级 M 在 t=2 就绪。',fields:[toggle('inherit','启用互斥量优先级继承',true)],predict:'高优先级任务为什么会被一个不使用这把锁的中优先级任务拖慢？',answer:'H 被持锁的 L 阻塞，而 M 能抢占 L，于是间接延长 H 的等待。继承让 L 临时以 H 的优先级运行，尽快释放锁；仍须限制临界区长度。',limit:'离散单核模型：L 用 3 单位、M 用 3 单位、H 用 1 单位。忽略切换开销与多锁链，不能代表 FreeRTOS 全部继承细节。'},
    modbus:{intro:'修改站号、零基地址与寄存器数量，实时生成 FC03 RTU 请求并重算 CRC。',fields:[range('unit','从站地址',1,247,1),range('address','PDU 零基起始地址',0,100,0),range('count','读取寄存器数量',1,125,10)],predict:'手册里的 40001，对应这条请求里的地址字段是多少？',answer:'常见 4xxxx 显示法中 40001 对应 PDU 地址 0，但设备手册的映射约定仍须核对。字段地址是大端，RTU CRC 在帧尾先低字节后高字节；TCP 帧使用 MBAP，不附 RTU CRC。',limit:'仅 FC03 RTU 请求，不模拟串口间隔、异常响应或设备映射。多寄存器浮点数字序由设备约定，不能只凭 Modbus 名称推断。'},
    boot:{intro:'将启动分为顺序阶段和可并发的服务，寻找决定 ready 时刻的关键路径。',fields:[range('loader','FSBL 与 U-Boot',0.5,6,2,0.5,'s'),range('kernel','内核初始化',0.5,8,3,0.5,'s'),range('network','网络 ready',0.5,10,4,0.5,'s'),range('app','应用初始化',0.5,10,5,0.5,'s'),toggle('parallel','应用不依赖网络，可并行启动')],predict:'网络与应用各需 4 s、5 s，并行后能省下 9 s 吗？',answer:'不能。两者同时开始后仍须等较慢的 5 s，节省的是较短的 4 s。只有应用确实不依赖网络，才能合法并行。',limit:'BootROM 固定 0.1 s；仅关键路径预算，没有 IO 竞争。ready 要由可验证的业务检查定义，不能用进程存在代替。'}
  };
  const labels={t:'拍/时间',valid:'TVALID',ready:'TREADY',data:'TDATA',last:'TLAST',fire:'接受',aw:'AW握手',w:'W握手',address:'地址已存',commit:'提交写',response:'BVALID',raw:'原始输入',output:'有效输出',count:'稳定计数',rise:'上升事件',write:'写入',read:'读出',occupancy:'水位',blocked:'满阻塞',dropped:'累计丢弃',contents:'FIFO内容',out:'读出值',input:'物理输入',image:'过程映像',web:'监控显示',running:'运行任务',inherited:'继承优先级',locked:'L仍持锁',waiting:'H仍等待'};
  function mount(stage,controls,spec){
    const kind=spec.kind,c=SPECS[kind];if(!c||!M){stage.textContent='实验模型未加载，请检查本地文件。';return ()=>{};}
    const values={};c.fields.forEach(f=>values[f.key]=f.value);
    let index=0,timer=null,result,rows=[],cacheActions=[];
    stage.innerHTML='<div class="wb" data-experiment="'+esc(kind)+'"><p class="wb-intro">'+esc(c.intro)+'</p>'+
      (c.fields.length?'<div class="wb-fields">'+c.fields.map((f,i)=>{const id='wb-'+kind+'-'+i;
        if(f.toggle)return '<label class="wb-field wb-toggle"><input id="'+id+'" type="checkbox" data-key="'+f.key+'"'+(f.value?' checked':'')+'><span>'+esc(f.label)+'</span></label>';
        return '<label class="wb-field" for="'+id+'"><span>'+esc(f.label)+'<output data-value="'+f.key+'"></output></span>'+(f.options?'<select id="'+id+'" data-key="'+f.key+'">'+f.options.map(o=>'<option value="'+o[0]+'"'+(o[0]===f.value?' selected':'')+'>'+esc(o[1])+'</option>').join('')+'</select>':'<input id="'+id+'" type="range" data-key="'+f.key+'" min="'+f.min+'" max="'+f.max+'" step="'+f.step+'" value="'+f.value+'">')+'</label>';
      }).join('')+'</div>':'')+
      '<div class="wb-stats"></div><div class="wb-status" role="status" aria-live="polite"></div>'+
      (kind==='cache'?'<div class="wb-cache-actions">'+[['cpuWrite','CPU 写 42'],['clean','Clean 写回'],['dmaRead','DMA 读取 DDR'],['dmaWrite','DMA 写入 99'],['invalidate','Invalidate'],['cpuRead','CPU 读取']].map(a=>'<button type="button" class="wb-action" data-cache="'+a[0]+'">'+a[1]+'</button>').join('')+'<button type="button" class="wb-action" data-cache-reset>清空记录</button></div>':'')+
      '<div class="wb-chart"></div><div class="wb-controls"><button type="button" data-wb-play>播放</button><button type="button" data-wb-prev aria-label="上一项">←</button><button type="button" data-wb-next aria-label="下一项">→</button><button type="button" data-wb-reset>回到起点</button><input type="range" min="0" value="0" step="1" aria-label="实验时间轴" data-wb-scrub><span class="wb-position"></span></div><div class="wb-inspector"></div>'+
      '<div class="wb-predict"><p><b>先预测：</b>'+esc(spec.predict||c.predict)+'</p><details><summary>做完实验，再看推导</summary><p>'+esc(c.answer)+'</p></details></div><p class="wb-limit"><b>模型边界：</b>'+esc(c.limit)+'</p><details class="wb-table"><summary>展开完整数据，逐项核对</summary><div class="wb-table-scroll"></div></details></div>';
    controls.innerHTML='';const root=stage.querySelector('.wb'),$=s=>root.querySelector(s),$$=s=>Array.from(root.querySelectorAll(s));
    const stats=$('.wb-stats'),status=$('.wb-status'),chart=$('.wb-chart'),inspector=$('.wb-inspector'),scrub=$('[data-wb-scrub]'),play=$('[data-wb-play]');
    function stop(){if(timer){clearInterval(timer);timer=null;}play.textContent='播放';}
    function stat(items){stats.innerHTML=items.map(x=>'<div class="wb-stat"><b>'+esc(x[0])+'</b><span>'+esc(x[1])+'</span></div>').join('');}
    function message(text,fault){status.textContent=text;status.classList.toggle('is-fault',!!fault);}
    function name(key){return (c.labels&&c.labels[key])||(kind==='lite'&&key==='data'?'数据已存':labels[key]||key);}
    function waveform(keys){
      const W=740,L=104,R=18,rowH=45,H=keys.length*rowH+42,cw=(W-L-R)/rows.length;
      let svg='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(spec.title||kind)+'；完整数值见下方数据表">';
      for(let t=0;t<rows.length;t++){const x=L+t*cw;svg+='<path d="M'+x+' 25 V'+(H-8)+'" stroke="#1e3048"/><text x="'+(x+cw/2)+'" y="17" text-anchor="middle" fill="#92a9c1" font-size="10">'+t+'</text>';}
      keys.forEach((key,i)=>{const y=36+i*rowH;svg+='<text x="8" y="'+(y+18)+'" fill="#a9c3dc" font-size="11">'+esc(name(key))+'</text>';
        const binary=rows.every(r=>r[key]===0||r[key]===1||r[key]===true||r[key]===false);
        if(binary){let d='';rows.forEach((r,t)=>{const x=L+t*cw,v=y+(r[key]?2:27);if(t)d+=' V'+v;else d+='M'+x+' '+v;d+=' H'+(x+cw);});svg+='<path d="'+d+'" fill="none" stroke="'+(i%2?'#a78bfa':'#22d3ee')+'" stroke-width="2"/>';}
        else rows.forEach((r,t)=>{const x=L+t*cw,v=r[key];svg+='<rect x="'+(x+1)+'" y="'+y+'" width="'+Math.max(0,cw-2)+'" height="29" rx="3" fill="#14344b"/><text x="'+(x+cw/2)+'" y="'+(y+19)+'" text-anchor="middle" fill="#67e8f9" font-size="11">'+esc(v)+'</text>';});
      });svg+='<rect class="wb-cursor" x="'+L+'" y="24" width="'+cw+'" height="'+(H-27)+'" fill="#fbbf24" opacity=".13" stroke="#fbbf24"/></svg>';chart.innerHTML=svg;
      chart.dataset.left=L;chart.dataset.cell=cw;
    }
    function bars(items,max){
      const W=740,H=items.length*47+35;chart.innerHTML='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="计算结果条形图">'+items.map((r,i)=>{const y=18+i*47,start=(r.start||0)/max*480,width=r.value/max*480;return '<text x="12" y="'+(y+17)+'" fill="#bdd2e8" font-size="12">'+esc(r.label)+'</text><rect x="'+(148+start)+'" y="'+y+'" width="'+Math.max(1,width)+'" height="25" rx="4" fill="'+(r.color||'#17839a')+'"/><text x="'+Math.min(685,155+start+width)+'" y="'+(y+17)+'" fill="#d9ecff" font-size="11">'+esc(num(r.value))+'</text>';}).join('')+'</svg>';
    }
    function table(){const keys=Object.keys(rows[0]||{});$('.wb-table-scroll').innerHTML='<table><thead><tr>'+keys.map(k=>'<th scope="col">'+esc(name(k))+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+keys.map(k=>'<td>'+esc(Array.isArray(r[k])?r[k].join(','):typeof r[k]==='boolean'?(r[k]?'1':'0'):r[k])+'</td>').join('')+'</tr>').join('')+'</tbody></table>';$('.wb-table').hidden=!rows.length;}
    function paint(){
      index=Math.max(0,Math.min(index,rows.length-1));scrub.value=index;
      $('.wb-position').textContent=rows.length?(index+1)+' / '+rows.length:'实时计算';
      const cursor=chart.querySelector('.wb-cursor');if(cursor)cursor.setAttribute('x',Number(chart.dataset.left)+index*Number(chart.dataset.cell));
      const point=chart.querySelector('.wb-plot-cursor');
      if(point&&rows.length){const p=result.plot,r=rows[index],x0=rows[0][p.x],x1=rows[rows.length-1][p.x],y0=Number(chart.dataset.ymin),y1=Number(chart.dataset.ymax);point.setAttribute('cx',55+(r[p.x]-x0)/(x1-x0||1)*650);point.setAttribute('cy',210-(r[p.y]-y0)/(y1-y0||1)*165);}
      chart.querySelectorAll('.wb-step').forEach((el,i)=>el.classList.toggle('is-current',i===index));
      if(rows.length){const r=rows[index];inspector.textContent=Object.keys(r).map(k=>name(k)+' = '+(Array.isArray(r[k])?r[k].join(','):r[k])).join('  ·  ');}
      inspector.hidden=!rows.length;
      $('[data-wb-prev]').disabled=index<=0;$('[data-wb-next]').disabled=index>=rows.length-1;play.disabled=rows.length<2;
      if(kind==='cache'){
        const r=rows[index]||result;chart.innerHTML='<div class="wb-cache-cells"><div class="wb-cache-cell">CPU Cache<b>'+esc(r.valid?r.line:'无效')+'</b><small>'+(r.dirty?'dirty · 尚未写回':'clean / invalid')+'</small></div><div class="wb-cache-cell">DDR / DMA 可见<b>'+r.memory+'</b><small>HP 通路不窥探 CPU Cache</small></div></div>';
      }
    }
    function calculate(){
      stop();index=0;rows=[];
      c.fields.forEach(f=>{const o=$('[data-value="'+f.key+'"]');if(o)o.textContent=f.options?'':values[f.key]+(f.unit?' '+f.unit:'');});
      if(kind==='stream'){result=M.stream(values);rows=result.rows;waveform(['valid','ready','data','last','fire']);stat([[result.accepted.length,'成功接受 / 8 拍'],[result.violations,'背压违例'],[result.accepted.join(', '),'接收序列']]);message(result.violations?'数据源违反保持规则，接收序列已出现缺口。':'只有 TVALID && TREADY 的上升沿接受一拍。',result.violations);}
      if(kind==='lite'){result=M.lite(values);rows=result.rows;waveform(['aw','w','address','data','commit','response']);stat([[result.writes,'寄存器写入次数'],[values.addressAt,'AW 握手拍'],[values.dataAt,'W 握手拍']]);message(result.writes?'地址与数据均已接收，本笔写成功提交。':'同拍假设导致两个合法通道的握手被丢弃。',!result.writes);}
      if(kind==='timing'){result=M.timing(values);stat([[num(result.slack)+' ns','Setup slack'],[num(result.period)+' ns','时钟周期'],[num(result.arrival)+' ns','数据 arrival']]);bars([...result.rows,{label:'可用周期 + skew',value:result.period+values.skew,color:'#6841a6'}],Math.max(result.arrival+1,result.period+values.skew)+2);message('Required = '+num(result.required)+' ns；Arrival = '+num(result.arrival)+' ns；'+(result.pass?'Setup 满足。':'Setup 违例。'),!result.pass);}
      if(kind==='debounce'){result=M.debounce(values);rows=result.rows;waveform(['raw','output','count','rise']);stat([[result.rises,'有效上升事件'],[values.threshold,'稳定门槛'],[rows.filter((r,i)=>r.raw&&(!i||!rows[i-1].raw)).length,'原始上升边沿']]);message('观察 threshold=1 与 threshold=3 的差异；更大门槛也会增加响应延迟。',result.rises>1);}
      if(kind==='fifo'){result=M.fifo(values);rows=result.rows;waveform(['write','read','occupancy','blocked','dropped']);stat([[result.dropped,'丢弃数据'],[result.accepted,'接受写入'],[result.remaining.length,'末尾占用']]);message(result.dropped?'FIFO 已满，生产者忽略背压导致数据丢弃。':'接受写入 = 已读出 + 队列剩余，数据守恒。',result.dropped);}
      if(kind==='cache'){result=M.cache(cacheActions);rows=result.rows;stat([[result.cpuRead===null?'—':result.cpuRead,'最近 CPU 读值'],[result.deviceRead===null?'—':result.deviceRead,'最近 DMA 读值'],[cacheActions.length,'操作次数']]);message(result.lostDirty?'脏行直接失效，CPU 尚未写回的值已丢失。':'试验 A：CPU 写→DMA 读；试验 B：CPU 读→DMA 写→CPU 读。分别插入 clean 或 invalidate 再比较。',result.lostDirty);index=Math.max(0,rows.length-1);}
      if(kind==='plc'){result=M.plc(values);rows=result.rows;waveform(['input','image','output','web']);stat([[result.sampleAt+' ms','下一次采样'],[result.latency+' ms','输入到输出延迟'],[result.visibleAt+' ms','Web 看见变化']]);message('输出在 '+result.outputAt+' ms 更新；过程映像保持到下一轮扫描。',false);}
      if(kind==='periodic'){result=M.periodic(values);rows=result.starts.map((start,t)=>({t,startUs:start,finishUs:start+values.execUs,errorUs:start-t*values.periodUs}));bars(rows.map(r=>({label:'任务 '+r.t,start:r.startUs,value:values.execUs})),Math.max(1,rows[rows.length-1].finishUs+values.periodUs));stat([[result.ticks,'换算 tick 数'],[result.quantized+' µs','tick 可表达周期'],[result.drift+' µs','第 8 次相位误差']]);message(!result.supported?'目标周期换算为 0 tick；此配置不能使用 tick 延时。':result.overrun?'执行时间超过释放间隔，任务无法按目标周期完成。':'比较 starts 与理想周期。硬件定时释放仍须测量实际调度延迟。',!result.supported||result.overrun);}
      if(kind==='bandwidth'){result=M.bandwidth(values);stat([[num(result.inputMBs)+' MB/s','输入数据速率'],[num(result.capacityMBs)+' MB/s','假定有效总线吞吐'],[num(result.bufferMs)+' ms','缓冲可覆盖暂停']]);bars([{label:'积压 / KiB',value:result.backlogBytes/1024,color:result.fits?'#17839a':'#a85e2a'},{label:'缓冲 / KiB',value:values.bufferKiB}],Math.max(result.backlogBytes/1024,values.bufferKiB)*1.2);message('暂停期间积压 '+num(result.backlogBytes,0)+' B；缓冲 '+num(result.bufferBytes,0)+' B。'+(result.fits?'当前预算可容纳。':'当前预算不足。'),!result.fits);}
      if(kind==='inversion'){result=M.inversion(values);rows=result.rows;waveform(['running','inherited','locked','waiting']);stat([[result.response,'H 的响应时间单位'],[result.doneAt,'H 完成时刻'],[values.inherit?'启用':'禁用','优先级继承']]);message(values.inherit?'L 临时继承 H 的优先级，避免 M 延长持锁时间。':'M 抢占 L，间接拖延 H。',!values.inherit);}
      if(kind==='modbus'){result=M.modbus(values);const names=['站号','FC03','地址高','地址低','数量高','数量低','CRC低','CRC高'];chart.innerHTML='<div class="wb-byte-row">'+result.bytes.map((b,i)=>'<div class="wb-byte'+(i>5?' is-crc':'')+'"><b>'+b.toString(16).padStart(2,'0').toUpperCase()+'</b><small>'+names[i]+'</small></div>').join('')+'</div>';stat([[8,'请求字节数'],[values.address,'PDU 地址'],['0x'+result.crc.toString(16).toUpperCase(),'CRC16 数值']]);message('只修改一个字段，也会改变 CRC。CRC 数值与线上发送顺序要分开看。',!result.valid);}
      if(kind==='boot'){result=M.boot(values);stat([[num(result.total)+' s','业务 ready 预算'],[values.parallel?'并行':'顺序','网络与应用关系'],[values.parallel?num(Math.min(values.network,values.app))+' s':'0 s','相对顺序节省']]);bars(result.rows.map(r=>({label:r.name,start:r.start,value:r.end-r.start})),result.total*1.15);message('应用若依赖网络，必须保持顺序；修改依赖后用业务探针验证 ready。',false);}
      if(c.run){
        result=c.run(values);rows=result.rows||[];stat(result.stats||[]);message(result.message||'',result.fault);
        if(result.keys)waveform(result.keys);
        else if(result.bars)bars(result.bars,result.max||Math.max(1,...result.bars.map(r=>(r.start||0)+r.value))*1.15);
        else if(result.plot){
          const p=result.plot,xs=rows.map(r=>r[p.x]),ys=rows.map(r=>r[p.y]),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(p.min==null?Math.min(...ys):p.min,...ys),ymax=Math.max(...ys,ymin+1);
          const X=x=>55+(x-xmin)/(xmax-xmin||1)*650,Y=y=>210-(y-ymin)/(ymax-ymin||1)*165;
          chart.dataset.ymin=ymin;chart.dataset.ymax=ymax;
          chart.innerHTML='<svg viewBox="0 0 740 255" role="img" aria-label="'+esc(p.label)+'；黄色点为当前时间，精确值见数据表"><path d="M55 30V210H710" fill="none" stroke="#92a9c1"/><polyline points="'+rows.map(r=>X(r[p.x])+','+Y(r[p.y])).join(' ')+'" fill="none" stroke="#22d3ee" stroke-width="3"/><circle class="wb-plot-cursor" r="6" cx="55" cy="210" fill="#fbbf24"/><text x="55" y="20" fill="#bdd2e8">'+esc(p.label)+'</text><text x="8" y="46" fill="#bdd2e8">'+num(ymax,1)+'</text><text x="8" y="210" fill="#bdd2e8">'+num(ymin,1)+'</text><text x="55" y="240" fill="#bdd2e8">'+esc(xmin)+'</text><text x="630" y="240" fill="#bdd2e8">'+esc(xmax)+' '+esc(p.unit||'')+'</text></svg>';
        }else chart.innerHTML='<div class="wb-steps">'+rows.map((r,i)=>'<div class="wb-step"><b>'+esc(r.step||'步骤 '+(i+1))+'</b><span>'+Object.entries(r).filter(([k])=>k!=='step').map(([k,v])=>esc(name(k))+': '+esc(v)).join('<br>')+'</span></div>').join('')+'</div>';
      }
      scrub.max=Math.max(0,rows.length-1);scrub.disabled=rows.length<2;table();paint();
    }
    $$('[data-key]').forEach(el=>el.addEventListener('input',()=>{values[el.dataset.key]=el.type==='checkbox'?el.checked:el.tagName==='SELECT'&&!/^-?\d+(\.\d+)?$/.test(el.value)?el.value:Number(el.value);calculate();}));
    $$('[data-cache]').forEach(b=>b.addEventListener('click',()=>{if(cacheActions.length>=128){message('操作记录已满；请先清空记录再开始一组新实验。',false);return;}cacheActions.push(b.dataset.cache);calculate();}));
    if($('[data-cache-reset]'))$('[data-cache-reset]').addEventListener('click',()=>{cacheActions=[];calculate();});
    play.addEventListener('click',()=>{if(timer){stop();return;}if(index>=rows.length-1)index=0;play.textContent='暂停';timer=setInterval(()=>{index++;paint();if(index>=rows.length-1)stop();},window.matchMedia('(prefers-reduced-motion: reduce)').matches?1200:650);});
    $('[data-wb-prev]').addEventListener('click',()=>{stop();index--;paint();});$('[data-wb-next]').addEventListener('click',()=>{stop();index++;paint();});$('[data-wb-reset]').addEventListener('click',()=>{stop();index=0;paint();});scrub.addEventListener('input',()=>{stop();index=Number(scrub.value);paint();});
    const visibility=()=>{if(document.hidden)stop();};document.addEventListener('visibilitychange',visibility);
    const observer='IntersectionObserver' in window?new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)stop();}):null;if(observer)observer.observe(root);
    calculate();return ()=>{stop();document.removeEventListener('visibilitychange',visibility);if(observer)observer.disconnect();};
  }
  window.ZynqWorkbench={mount,specs:SPECS,register(kind,spec){if(SPECS[kind])throw new Error('Duplicate experiment '+kind);SPECS[kind]=spec;}};
})();
