(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.AdvancedModels=factory();})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const clip=(x,a,b)=>Math.min(b,Math.max(a,x));
  const roundAway=x=>Math.sign(x)*Math.floor(Math.abs(x)+0.5);
  const hex=x=>'0x'+x.toString(16).toUpperCase();
  function layout(p={}){
    p=Object.assign({text:2048,data:256,bss:768,stack:1024,ram:4096,textInRam:false},p);
    const flashUsed=p.text+p.data,ramUsed=(p.textInRam?p.text:0)+p.data+p.bss+p.stack;
    const rows=[{step:'上电',section:'.text',flash:p.text,ram:p.textInRam?p.text:0,action:p.textInRam?'代码装入 RAM 后执行；占装载存储与运行 RAM':'代码从独立可执行存储区执行，不计本 RAM 池'},
      {step:'复制',section:'.data',flash:p.data,ram:p.data,action:'LMA 初值复制到 VMA'},
      {step:'清零',section:'.bss',flash:0,ram:p.bss,action:'启动代码清零，不存储逐字节初值'},
      {step:'保留',section:'stack',flash:0,ram:p.stack,action:'设置栈指针并检查最坏栈深'}];
    return {flashUsed,ramUsed,freeRam:p.ram-ramUsed,rows};
  }
  function mmu(p={}){
    p=Object.assign({address:0x1234,frame:9,oldFrame:5,oldWritable:true,oldValid:true,writable:true,write:false,stale:false,valid:true},p);
    const offset=p.address%4096,vpn=Math.floor(p.address/4096),frame=p.stale?p.oldFrame:p.frame;
    const valid=p.stale?p.oldValid:p.valid,writable=p.stale?p.oldWritable:p.writable;
    const fault=!valid?'translation':p.write&&!writable?'permission':null;
    return {vpn,offset,physical:fault?null:frame*4096+offset,fault,rows:[
      {step:'拆分虚拟地址',address:hex(p.address),detail:'VPN='+vpn+'，页内偏移='+hex(offset)},
      {step:p.stale?'命中旧 TLB':'页表/有效 TLB',address:hex(frame*4096),detail:p.stale?'旧项仍缓存 frame='+frame+'、valid='+Number(valid)+'、writable='+Number(writable):'映射到 frame='+frame},
      {step:'权限与转换',address:fault?'FAULT':hex(frame*4096+offset),detail:fault||'偏移保持；尚未模拟 cache 属性'}]};
  }
  function publish(p={}){
    p=Object.assign({release:true,acquire:true},p);const correct=p.release&&p.acquire;
    return {observed:correct?42:0,rows:correct?[
      {step:'生产者写槽位',payload:42,head:0,observed:'—'},
      {step:'release 发布 head',payload:42,head:1,observed:'—'},
      {step:'acquire 读到新 head',payload:42,head:1,observed:'—'},
      {step:'消费者读 payload',payload:42,head:1,observed:42}]:[
      {step:'缺少发布/获取约束',payload:0,head:0,observed:'—'},
      {step:'示意：head 先变得可见',payload:0,head:1,observed:'—'},
      {step:'消费者过早读槽位',payload:0,head:1,observed:0},
      {step:'payload 才可见',payload:42,head:1,observed:0}]};
  }
  function cdc(p={}){
    p=Object.assign({phase:1,width:1,handshake:false},p);
    let q1=0,q2=0,captured=0,ack=false;const rows=[];
    for(let t=0;t<=25;t++){
      const raw=t>=p.phase&&(p.handshake?!ack:t<p.phase+p.width)?1:0,edge=t%5===0;
      if(edge){const old=q1,prev=q2;q1=raw;q2=old;if(q2&&!prev){captured++;if(p.handshake)ack=true;}}
      rows.push({t,request:raw,destEdge:+edge,sync1:q1,sync2:q2,event:captured});
    }
    return {captured,rows};
  }
  function lifecycle(p={}){
    p=Object.assign({failAt:4,unsafe:false},p);
    const acquire=['free','unmap','free_irq','stop_dma'],rows=[],done=[];
    for(let i=0;i<Math.min(4,p.failAt);i++){done.push(acquire[i]);rows.push({step:'申请 '+['内存','MMIO映射','IRQ','DMA启动'][i],owned:done.join(',')});}
    let cleanup=done.slice().reverse();
    if(p.failAt>=4)cleanup=['stop_dma','synchronize_irq','free_irq','unmap','free'];
    if(p.unsafe&&p.failAt>=4)cleanup=['free','unmap','free_irq','stop_dma'];
    const unsafe=p.unsafe&&p.failAt>=4;
    cleanup.forEach(s=>rows.push({step:s,owned:unsafe?'故障路径：设备可能仍访问已释放对象':'按逆序/依赖解除资源'}));
    return {cleanup,unsafe,rows};
  }
  function rta(p={}){
    p=Object.assign({cost:2,blocking:1,deadline:5,hpCost:1,hpPeriod:4},p);
    // UI inputs are multiples of 0.1 ms. Integer microseconds avoid ceil(0.3/0.3)
    // being accidentally rounded to two jobs by binary floating point arithmetic.
    const C=Math.round(p.cost*1000),B=Math.round(p.blocking*1000),H=Math.round(p.hpCost*1000),T=Math.round(p.hpPeriod*1000),D=Math.round(p.deadline*1000);
    if(T<=0)throw new RangeError('HP period must be positive');
    let r=C+B;const rows=[{iteration:0,previous:0,jobs:0,response:r/1000}];let converged=false;
    for(let i=1;i<=64;i++){const jobs=Math.ceil(r/T),next=C+B+jobs*H;rows.push({iteration:i,previous:r/1000,jobs,response:next/1000});if(next===r){converged=true;break;}r=next;if(r>D)break;}
    return {response:r/1000,schedulable:converged&&r<=D,converged,rows};
  }
  function crc16(bytes){let c=0xffff;for(const b of bytes){c^=b;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xa001:0);}return c;}
  function encodeFrame(payload,seq=0){
    if(payload.length>256)throw new RangeError('payload exceeds 256 bytes');
    const body=[1,payload.length&255,payload.length>>>8,seq&255,(seq>>>8)&255,...payload],crc=crc16(body);
    return [0xa5,0x5a,...body,crc&255,crc>>>8];
  }
  class FrameParser{
    constructor(){this.buffer=[];this.crcErrors=0;this.lengthErrors=0;this.versionErrors=0;this.timeouts=0;}
    feed(bytes){
      const out=[];
      // Feed bytewise so even one huge noise chunk cannot grow retained state unboundedly.
      for(const b of bytes){this.buffer.push(b&255);for(;;){
        while(this.buffer.length>=2&&(this.buffer[0]!==0xa5||this.buffer[1]!==0x5a))this.buffer.shift();
        if(this.buffer.length===1&&this.buffer[0]!==0xa5)this.buffer.shift();
        if(this.buffer.length<3)break;
        if(this.buffer[2]!==1){this.versionErrors++;this.buffer.shift();continue;}
        if(this.buffer.length<5)break;
        const len=this.buffer[3]+256*this.buffer[4];
        if(len>256){this.lengthErrors++;this.buffer.shift();continue;}
        const total=len+9;if(this.buffer.length<total)break;
        const f=this.buffer.slice(0,total),expected=f[total-2]+256*f[total-1];
        if(crc16(f.slice(2,-2))!==expected){this.crcErrors++;this.buffer.shift();continue;}
        out.push({seq:f[5]+256*f[6],payload:f.slice(7,-2)});this.buffer.splice(0,total);
      }}return out;
    }
    expirePartial(){if(this.buffer.length){this.buffer=[];this.timeouts++;}}
  }
  function parser(p={}){
    p=Object.assign({split:5,corrupt:false,noise:true},p);const bad=encodeFrame([0xa5,0x5a,7],17),good=encodeFrame([8,9],18);
    if(p.corrupt)bad[bad.length-1]^=1;
    const wire=[...(p.noise?[0,0xff,0xa5]:[]),...bad,...good],parser=new FrameParser(),frames=[],rows=[];
    let at=0;
    while(at<wire.length){const chunk=wire.slice(at,at+p.split),found=parser.feed(chunk);frames.push(...found);rows.push({step:rows.length+1,chunk:chunk.map(b=>b.toString(16).padStart(2,'0')).join(' '),buffered:parser.buffer.length,frames:found.map(f=>f.seq).join(',')||'—',crcErrors:parser.crcErrors});at+=chunk.length;}
    return {rows,frames,crcErrors:parser.crcErrors,buffered:parser.buffer.length};
  }
  function journal(p={}){
    p=Object.assign({cutAfter:6,tamper:false},p);const actions=['擦除非活动槽','写入 generation=2','写 payload=99','写长度/CRC','回读校验','最后写 commit'];
    const rows=[{step:'起始',old:'有效：42',candidate:'无',selected:42}];
    for(let i=0;i<6;i++)rows.push({step:actions[i],old:'有效：42',candidate:i>=p.cutAfter?'掉电，未执行':i===5?'commit有效':'未提交',selected:i<p.cutAfter&&i===5&&!p.tamper?99:42});
    const committed=p.cutAfter>=6&&!p.tamper;
    return {selected:committed?99:42,rows,committed};
  }
  function ota(p={}){
    p=Object.assign({signature:true,version:4,floor:3,healthy:true,tries:3},p);const rows=[{step:'当前系统',active:'A',floor:p.floor,decision:'可信旧版本正常运行'}];
    if(!p.signature||p.version<p.floor){rows.push({step:'校验候选 B',active:'A',floor:p.floor,decision:!p.signature?'签名验证失败，拒绝':'版本低于回滚下限，拒绝'});return {active:'A',floor:p.floor,rows,rejected:true};}
    rows.push({step:'写非活动槽并验证',active:'A',floor:p.floor,decision:'读回镜像并完成真实性验证'});
    for(let i=1;i<=Math.max(1,p.tries);i++){rows.push({step:'试启动 '+i,active:'B',floor:p.floor,decision:p.healthy?'业务健康检查通过':'看门狗/健康检查失败'});if(p.healthy){rows.push({step:'确认候选',active:'B',floor:p.version,decision:'确认后提升版本策略；原子元数据另行保证'});return {active:'B',floor:p.version,rows,rejected:false};}}
    rows.push({step:'试启动次数耗尽',active:'A',floor:p.floor,decision:'恢复旧槽；未提前抬高下限'});return {active:'A',floor:p.floor,rows,rejected:false};
  }
  function fixedpoint(p={}){
    p=Object.assign({a:0.5,b:0.5,bits:15,wrap:false},p);const s=2**p.bits,min=-s,max=s-1;
    const a=clip(roundAway(p.a*s),min,max),b=clip(roundAway(p.b*s),min,max),product=a*b,rounded=roundAway(product/s);
    const word=p.wrap?((rounded+s)%(2*s)+2*s)%(2*s)-s:clip(rounded,min,max),value=word/s;
    return {a,b,product,word,value,error:value-p.a*p.b,saturated:word!==rounded,rows:[
      {step:'编码输入 A',integer:a,value:a/s},{step:'编码输入 B',integer:b,value:b/s},
      {step:'宽乘积',integer:product,value:product/(s*s)},{step:'除尺度并舍入',integer:rounded,value:rounded/s},{step:p.wrap?'截断回绕':'饱和输出',integer:word,value}]};
  }
  function queuebudget(p={}){
    p=Object.assign({arrival:5,service:2,capacity:8,burst:8,ticks:12},p);let q=0,offered=0,accepted=0,rejected=0,completed=0,high=0;const rows=[];
    for(let t=0;t<p.ticks;t++){const served=Math.min(q,p.service);q-=served;completed+=served;const a=p.arrival+(t===0?p.burst:0),admit=Math.min(a,p.capacity-q);offered+=a;accepted+=admit;rejected+=a-admit;q+=admit;high=Math.max(high,q);rows.push({t,arrivals:a,served,occupancy:q,accepted,rejected,completed});}
    return {offered,accepted,rejected,completed,remaining:q,high,rows};
  }
  function thermal(p={}){
    p=Object.assign({ambient:25,power:2,resistance:10,capacitance:10,duration:100,step:1,throttle:false,limit:40},p);let temperature=p.ambient,energy=0,limited=false;const rows=[{t:0,temperature,power:p.power,energy:0}];
    for(let t=0;t<p.duration;){const dt=Math.min(p.step,p.duration-t);if(p.throttle){if(temperature>=p.limit)limited=true;else if(temperature<=p.limit-3)limited=false;}const power=p.power*(limited?0.4:1),a=Math.exp(-dt/(p.resistance*p.capacitance));temperature=p.ambient+(temperature-p.ambient)*a+power*p.resistance*(1-a);energy+=power*dt;t+=dt;rows.push({t,temperature:Number(temperature.toFixed(3)),power,energy:Number(energy.toFixed(3))});}
    return {temperature,energy,limited,rows};
  }
  function clock(p={}){
    p=Object.assign({bits:16,start:65500,elapsedTicks:100,ppm:20,seconds:60,forward:100,reverse:100},p);const modulus=2**p.bits,start=p.start%modulus,end=(start+p.elapsedTicks)%modulus,modularDelta=(end-start+modulus)%modulus;
    return {end,modularDelta,ambiguous:p.elapsedTicks>=modulus,driftUs:p.ppm*p.seconds,offsetBias:(p.forward-p.reverse)/2,rows:[
      {step:'起始计数',value:start,meaning:'无符号硬件计数器'},
      {step:'终止计数',value:end,meaning:'模 '+modulus+' 计数'},
      {step:'模减法',value:modularDelta,meaning:p.elapsedTicks>=modulus?'间隔超过模数，仅两次读数无法还原':'外部约束：读数间隔小于模数'},
      {step:'自由运行漂移 / µs',value:p.ppm*p.seconds,meaning:p.ppm+' ppm × '+p.seconds+' s'},
      {step:'双向时延不对称偏差 / µs',value:(p.forward-p.reverse)/2,meaning:'四时间戳估计中，路径不对称不能自动抵消'}]};
  }
  return {layout,mmu,publish,cdc,lifecycle,rta,crc16,encodeFrame,FrameParser,parser,journal,ota,fixedpoint,queuebudget,thermal,clock};
});
