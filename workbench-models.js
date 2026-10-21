(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.ZynqModels=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const defaults=(p,d)=>Object.assign({},d,p);
  function stream(input){
    const p=defaults(input,{cycles:20,packet:8,stallStart:2,stallLength:4,broken:false});
    let data=0,violations=0;const rows=[],accepted=[];
    for(let t=0;t<p.cycles;t++){
      const valid=data<p.packet,ready=!(t>=p.stallStart&&t<p.stallStart+p.stallLength);
      const fire=valid&&ready,last=valid&&data===p.packet-1;
      rows.push({t,valid:+valid,ready:+ready,data:valid?data:'—',last:+last,fire:+fire});
      if(fire)accepted.push(data);
      if(valid&&(fire||p.broken)){if(!ready)violations++;data++;}
    }
    return {rows,accepted,violations};
  }
  function lite(input){
    const p=defaults(input,{addressAt:1,dataAt:4,broken:false});
    let address=false,data=false,writes=0;const rows=[];
    for(let t=0;t<10;t++){
      const aw=+(t===p.addressAt),w=+(t===p.dataAt);
      address=address||!!aw;data=data||!!w;
      const commit=p.broken?!!(aw&&w):address&&data&&writes===0;
      if(commit)writes++;
      rows.push({t,aw,w,address:+address,data:+data,commit:+commit,response:+(writes>0&&t>Math.max(p.addressAt,p.dataAt))});
    }
    return {rows,writes};
  }
  function timing(input){
    const p=defaults(input,{freqMHz:100,clockToQ:0.5,logic:7,route:1,setup:0.5,uncertainty:0.2,skew:0});
    const period=1000/p.freqMHz,arrival=p.clockToQ+p.logic+p.route;
    const required=period+p.skew-p.setup-p.uncertainty,slack=required-arrival;
    return {period,arrival,required,slack,pass:slack>=0,rows:[{label:'clk→Q',value:p.clockToQ},{label:'组合逻辑',value:p.logic},{label:'布线',value:p.route},{label:'setup + 不确定度',value:p.setup+p.uncertainty}]};
  }
  function debounce(input){
    const p=defaults(input,{threshold:3,samples:[0,0,1,0,1,0,1,1,0,1,1,1,1,1,1,0,1,0,0,0,0,0]});
    let output=0,count=0,candidate=0,rises=0;
    const rows=p.samples.map((raw,t)=>{
      const previous=output;
      if(raw!==candidate){candidate=raw;count=1;}else count++;
      if(count>=p.threshold)output=candidate;
      if(output&&!previous)rises++;
      return {t,raw,output,count:Math.min(count,p.threshold),rise:+(output&&!previous)};
    });
    return {rows,rises};
  }
  function fifo(input){
    const p=defaults(input,{cycles:24,depth:4,produceEvery:1,consumeEvery:1,pauseStart:4,pauseLength:8,backpressure:true});
    const queue=[],rows=[],received=[];let accepted=0,dropped=0,next=0;
    for(let t=0;t<p.cycles;t++){
      const read=t%p.consumeEvery===0&&!(t>=p.pauseStart&&t<p.pauseStart+p.pauseLength)&&queue.length>0;
      const out=read?queue.shift():null;
      if(read)received.push(out);
      const wants=t%p.produceEvery===0,space=queue.length<p.depth;
      const write=wants&&space,blocked=wants&&!space;
      if(write){queue.push(next++);accepted++;}
      else if(blocked&&!p.backpressure){next++;dropped++;}
      rows.push({t,write:+write,read:+read,occupancy:queue.length,blocked:+blocked,dropped,contents:queue.slice(),out});
    }
    return {rows,accepted,received,remaining:queue,dropped};
  }
  // One cache line, noncoherent HP port, sequential operations; not an ISA emulator.
  function cache(actions){
    let memory=0,line=0,valid=false,dirty=false,deviceRead=null,cpuRead=null,lostDirty=false;
    const rows=[];
    (actions||[]).forEach((action,t)=>{
      if(action==='cpuWrite'){line=42;valid=true;dirty=true;}
      if(action==='clean'&&dirty){memory=line;dirty=false;}
      if(action==='dmaRead')deviceRead=memory;
      if(action==='dmaWrite')memory=99;
      if(action==='invalidate'){if(dirty)lostDirty=true;valid=false;dirty=false;}
      if(action==='cpuRead'){if(!valid){line=memory;valid=true;}cpuRead=line;}
      rows.push({t,action,memory,line,valid,dirty,deviceRead,cpuRead,lostDirty});
    });
    return {rows,memory,line,valid,dirty,deviceRead,cpuRead,lostDirty};
  }
  function plc(input){
    const p=defaults(input,{inputAt:1,scanMs:10,computeMs:3,networkMs:2});
    const sampleAt=Math.ceil(p.inputAt/p.scanMs)*p.scanMs,outputAt=sampleAt+p.computeMs,visibleAt=outputAt+p.networkMs;
    return {sampleAt,outputAt,visibleAt,latency:outputAt-p.inputAt,rows:Array.from({length:Math.ceil(visibleAt)+3},(_,t)=>({t,input:+(t>=p.inputAt),image:+(t>=sampleAt),output:+(t>=outputAt),web:+(t>=visibleAt)}))};
  }
  function periodic(input){
    const p=defaults(input,{tickHz:1000,periodUs:2000,execUs:500,method:'until',iterations:8});
    const ticks=Math.floor(p.periodUs*p.tickHz/1e6),quantized=ticks*1e6/p.tickHz;
    const supported=p.method==='hardware'||ticks>=1;
    const step=p.method==='hardware'?p.periodUs:quantized;
    const starts=Array.from({length:p.iterations},(_,i)=>i*(p.method==='delay'?step+p.execUs:Math.max(step,p.execUs)));
    return {ticks,quantized,supported,starts,overrun:p.execUs>step,drift:starts[starts.length-1]-(p.iterations-1)*p.periodUs};
  }
  function bandwidth(input){
    const p=defaults(input,{channels:8,rateKsps:100,bits:16,busBits:64,clockMHz:100,efficiency:75,bufferKiB:64,hostPauseMs:50});
    const inputMBs=p.channels*p.rateKsps*1000*p.bits/8/1e6,capacityMBs=p.busBits/8*p.clockMHz*p.efficiency/100;
    const backlogBytes=inputMBs*1e6*p.hostPauseMs/1000,bufferBytes=p.bufferKiB*1024;
    return {inputMBs,capacityMBs,backlogBytes,bufferBytes,fits:backlogBytes<=bufferBytes&&inputMBs<=capacityMBs,bufferMs:bufferBytes/(inputMBs*1000)};
  }
  function inversion(input){
    const p=defaults(input,{inherit:false});
    let low=3,medium=3,high=1,doneAt=null;const rows=[];
    for(let t=0;t<9;t++){
      let running='空闲',inherited=false;
      if(t>=1&&low===0&&high){running='H';high--;doneAt=t+1;}
      else if(low>0&&t>=1&&p.inherit&&high){running='L';inherited=true;low--;}
      else if(t>=2&&medium){running='M';medium--;}
      else if(low){running='L';low--;}
      rows.push({t,running,inherited,locked:low>0,waiting:t>=1&&high>0});
    }
    return {rows,response:doneAt-1,doneAt};
  }
  function crc16(bytes){
    let crc=0xFFFF;
    for(const byte of bytes){crc^=byte;for(let b=0;b<8;b++)crc=crc&1?(crc>>>1)^0xA001:crc>>>1;}
    return crc;
  }
  function modbus(input){
    const p=defaults(input,{unit:1,address:0,count:10});
    const bytes=[p.unit,3,(p.address>>>8)&255,p.address&255,(p.count>>>8)&255,p.count&255];
    const crc=crc16(bytes);bytes.push(crc&255,crc>>>8);
    return {bytes,crc,valid:p.unit>=1&&p.unit<=247&&p.count>=1&&p.count<=125&&p.address+p.count<=65536};
  }
  function boot(input){
    const p=defaults(input,{rom:0.1,loader:2,kernel:3,network:4,app:5,parallel:false});
    const base=p.rom+p.loader+p.kernel;
    return {total:base+(p.parallel?Math.max(p.network,p.app):p.network+p.app),rows:[{name:'BootROM',start:0,end:p.rom},{name:'FSBL/U-Boot',start:p.rom,end:p.rom+p.loader},{name:'Kernel',start:p.rom+p.loader,end:base},{name:'网络',start:base,end:base+p.network},{name:'应用',start:p.parallel?base:base+p.network,end:base+(p.parallel?0:p.network)+p.app}]};
  }
  return {stream,lite,timing,debounce,fifo,cache,plc,periodic,bandwidth,inversion,crc16,modbus,boot};
});
