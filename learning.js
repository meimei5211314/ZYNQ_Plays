(function(){
  'use strict';
  const DATA=window.ZynqLearningData;if(!DATA)return;
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const file=n=>n===1?'index.html':'chapter'+n+'.html';
  const read=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key));return v===null?fallback:v;}catch(_){return fallback;}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(_){return false;}};
  function backup(container){
    const button=document.createElement('button');button.type='button';button.className='learning-button';button.textContent='导出本机学习记录';
    const status=document.createElement('span');status.className='learning-evidence-status';status.setAttribute('role','status');
    button.addEventListener('click',()=>{
      try{
        const entries={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(/^(zynq_|zx_)/.test(k))entries[k]=localStorage.getItem(k);}
        const blob=new Blob([JSON.stringify({format:'zynq-learning-records',version:1,exportedAt:new Date().toISOString(),entries},null,2)],{type:'application/json'});
        const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='zynq-learning-records-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='已生成下载文件。';
      }catch(_){status.textContent='浏览器禁止读取本地存储，请手动复制笔记。';}
    });
    const importLabel=document.createElement('label');importLabel.className='learning-button';importLabel.textContent='从记录恢复';
    const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.setAttribute('aria-label','选择学习记录备份');input.style.maxWidth='190px';importLabel.appendChild(input);
    input.addEventListener('change',async()=>{
      const chosen=input.files[0];if(!chosen)return;
      try{
        if(chosen.size>5*1024*1024)throw new Error('文件过大');
        const parsed=JSON.parse(await chosen.text());if(parsed.format!=='zynq-learning-records'||parsed.version!==1||!parsed.entries||typeof parsed.entries!=='object')throw new Error('格式不匹配');
        const pairs=Object.entries(parsed.entries);if(pairs.some(([k,v])=>!/^(zynq_|zx_)/.test(k)||typeof v!=='string'))throw new Error('记录字段无效');
        let added=0,kept=0;for(const [k,v]of pairs){
          if(k==='zynq_progress_v1'&&localStorage.getItem(k)!==null){
            const incoming=JSON.parse(v),current=read(k,{});
            if(!incoming||Array.isArray(incoming)||typeof incoming!=='object')throw new Error('进度表格式无效');
            const existing=current&&typeof current==='object'&&!Array.isArray(current)?current:{};
            localStorage.setItem(k,JSON.stringify(Object.assign({},incoming,existing)));added++;continue;
          }
          if(localStorage.getItem(k)!==null){kept++;continue;}localStorage.setItem(k,v);added++;
        }
        status.textContent='恢复 '+added+' 项，保留现有 '+kept+' 项。刷新页面后显示。';
      }catch(error){status.textContent='恢复失败：'+error.message+'。';}
      input.value='';
    });
    container.append(button,importLabel,status);
  }
  function render(root,data,key){
    const p=DATA.chapters[key];if(!p)return;
    const section=document.createElement('section');section.className='learning-section';section.id='engineering';section.setAttribute('aria-labelledby','engineering-title');
    section.innerHTML='<span class="learning-kicker">ENGINEERING PRACTICE · 第 '+p.number+' 章</span><h3 id="engineering-title">'+esc(p.project)+'</h3><p>把本章知识变成可检查的工程结果。先写预测，再做对照实验；浏览器推演建立直觉，仿真与上板记录验证实现。</p>'+
      '<div class="learning-links">'+(p.prerequisites.length?p.prerequisites.map(n=>'<a href="'+file(n)+'">前置：第 '+n+' 章</a>').join(''):'<span class="learning-source-note">前置：基础 C 语言、数字电路；不熟悉可先完成本章预备知识。</span>')+'</div>'+
      '<div class="learning-stages">'+[['01 · 先预测',p.prediction],['02 · 做实验',p.experiment],['03 · 定位故障',p.fault],['04 · 用证据验收',p.acceptance]].map(s=>'<div class="learning-stage"><h4>'+s[0]+'</h4><p>'+esc(s[1])+'</p></div>').join('')+'</div>'+
      '<div class="learning-evidence"><h4>我的实验记录</h4>'+[['prediction','已在操作前写下预测'],['contrast','已保存正常与故障的对照结果'],['evidence','已有满足本章条件的波形、日志或计算证据'],['explain','能脱离页面解释原因与模型边界']].map(s=>'<label><input type="checkbox" data-practice="'+s[0]+'"><span>'+s[1]+'</span></label>').join('')+
      '<label for="engineering-notes">记录预测、参数、现象、解释和证据位置</label><textarea id="engineering-notes" placeholder="预测：\n条件/版本：\n正常与故障结果：\n解释：\n波形、日志或工程文件位置：\n仍未验证的部分："></textarea><div class="learning-evidence-status" role="status" aria-live="polite"></div></div>'+
      '<p><b>迁移挑战：</b>'+esc(p.transfer)+'</p><p class="learning-review">隔天复盘：不看笔记重做一个故障，再解释为何原方案失败。勾选是自我记录，不等于自动能力认证。</p>'+
      '<div class="learning-sources"><h4>查证与公开工程入口</h4><ul>'+p.sources.map(id=>'<li><a href="'+DATA.sources[id][1]+'" target="_blank" rel="noopener">'+esc(DATA.sources[id][0])+'</a></li>').join('')+'</ul><p class="learning-source-note">资料核验日期：2026-10-21。外部原始资料需要联网；练习参数与模型结果不代表本板实测。工具、BSP、内核与板卡版本需记录在实验报告中。</p></div><div class="learning-backup"></div>';
    root.appendChild(section);const storeKey='zynq_engineering_v1_'+key,saved=read(storeKey,{}),notes=section.querySelector('textarea'),status=section.querySelector('.learning-evidence-status'),checks=[...section.querySelectorAll('[data-practice]')];
    notes.value=typeof saved.notes==='string'?saved.notes:'';checks.forEach(c=>c.checked=!!saved[c.dataset.practice]);
    function save(){const value={notes:notes.value,updatedAt:new Date().toISOString()};checks.forEach(c=>value[c.dataset.practice]=c.checked);const ok=write(storeKey,value);status.textContent=ok?'已保存在本机 · '+checks.filter(c=>c.checked).length+' / 4 项练习记录':'本地存储不可用，请复制笔记或导出已有记录。';}
    checks.forEach(c=>c.addEventListener('change',save));notes.addEventListener('input',save);status.textContent='笔记保存在当前浏览器；导出后可随学习工程归档。';backup(section.querySelector('.learning-backup'));
    const nav=document.querySelector('.nav');if(nav&&!nav.querySelector('[href="#engineering"]')){const a=document.createElement('a');a.href='#engineering';a.innerHTML='<span class="num">DO</span>工程训练与证据';nav.appendChild(a);}
  }
  function course(){
    if(!document.body.classList.contains('course-page'))return;const target=document.querySelector('.resume-band');if(!target)return;
    const section=document.createElement('section');section.className='learning-section';section.id='practice-map';
    const routes=[['硬件与接口闭环','从按键、RTL 到 AXI 命令往返。',[3,5,6,7,8,9,10]],['可交付的软 PLC','从需求、IO 映像到通信与故障验收。',[26,27,28,29,30,31,32,33,34,35]],['数据与实时性进阶','从逐拍协议到缓存、预算和双核边界。',[9,21,22,37,38,39,40,48,49,50,51]],['底层正确性与可靠恢复','用内存、并发、驱动与故障模型建立可审查的实现。',[52,53,54,55,56,57,58,59,60,61]],['产品化与独立交付','完成安全、DSP、容量和测量，再做两个综合项目。',[62,63,64,65,66,67,68,69,70,71]]];
    const demoCount=Object.values(DATA.chapters).reduce((n,p)=>n+p.demos.length,0);
    section.innerHTML='<span class="learning-kicker">LEARN → EXPERIMENT → EXPLAIN</span><h2>把 71 章学成能交付的工程能力</h2><p>提供 '+Object.keys(DATA.demoTitles).length+' 类可计算实验，在 '+Object.values(DATA.chapters).filter(p=>p.demos.length).length+' 章提供 '+demoCount+' 个推演入口；71 章各有独立训练任务和验收证据。原有波形、状态机与流程演示仍可切换查看。</p><div class="learning-stages">'+routes.map(r=>'<div class="learning-stage"><h3>'+r[0]+'</h3><p>'+r[1]+'</p><small>每章完成：预测 → 对照实验 → 故障定位 → 证据验收</small><div class="learning-links">'+r[2].map(n=>'<a href="'+file(n)+'#zx-lab">第 '+n+' 章</a>').join('')+'</div></div>').join('')+'<div class="learning-stage"><h3>先体验，再选学习路径</h3><p>把 AW 与 W 错开、让 READY 拉低、让 DMA 看见缓存旧值，再试着解释每一次变化。</p><div class="learning-links"><a href="chapter9.html#zx-lab">AXI 握手</a><a href="chapter38.html#zx-lab">DMA 与 Cache</a><a href="chapter22.html#zx-lab">时序余量</a><a href="chapter49.html#zx-lab">100 µs 周期难题</a></div></div></div><p class="learning-source-note">练习情境明确标注；公开参考工程带来源。浏览器模型用于教学，真正掌握以仿真、上板测量和独立排故为准。</p><div class="learning-backup"></div>';
    target.before(section);backup(section.querySelector('.learning-backup'));
  }
  window.ZynqLearning={render};
  function retrieval(){
    const id=document.body.dataset.chapterId;
    if(!/^app[a-d]$/.test(id||''))return;
    const items=[...document.querySelectorAll('#content details.qa')].map(e=>({question:e.querySelector('summary')?.textContent.trim(),answer:e.querySelector('.ans')?.textContent.trim()})).filter(x=>x.question&&x.answer);
    if(!items.length)document.querySelectorAll('#content table tr').forEach(row=>{const cells=[...row.querySelectorAll('td')];if(cells.length>=2)items.push({question:cells[0].textContent.trim(),answer:cells.slice(1).map(c=>c.textContent.trim()).join('；')});});
    if(!items.length)return;
    const section=document.createElement('section');section.className='learning-section';section.id='retrieval';
    section.innerHTML='<span class="learning-kicker">ACTIVE RECALL</span><h2>先闭卷解释，再核对答案</h2><p>从本附录的 '+items.length+' 个条目抽取一道；先说出机制、举例与边界，再展开原文。答案是复盘起点，数值与平台细节仍需查证。</p><h3 data-recall-question></h3><details><summary>显示原文解析</summary><p data-recall-answer></p></details><div class="learning-backup"><button type="button" class="learning-button" data-recall-next>抽取下一题</button><button type="button" class="learning-button" data-recall-mark>记入待复习</button></div><div class="learning-evidence-status" role="status"></div><p>解释标准：能说清机制 → 能给反例或故障现象 → 能指出验证方法。只背术语不算完成。</p>';
    document.querySelector('#content').before(section);let current=-1;
    const key='zynq_retrieval_v1_'+id;
    function choose(){current=(current+1+Math.floor(Math.random()*Math.max(1,items.length-1)))%items.length;section.querySelector('[data-recall-question]').textContent=items[current].question;section.querySelector('[data-recall-answer]').textContent=items[current].answer;section.querySelector('details').open=false;section.querySelector('[role=status]').textContent='先回答，再展开；下次复习换一种例子解释。';}
    section.querySelector('[data-recall-next]').addEventListener('click',choose);
    section.querySelector('[data-recall-mark]').addEventListener('click',()=>{const saved=read(key,[]);const list=Array.isArray(saved)?saved:[];if(!list.includes(items[current].question))list.push(items[current].question);const ok=write(key,list);section.querySelector('[role=status]').textContent=ok?'已记录 '+list.length+' 道待复习条目，可随学习记录导出。':'存储不可用，请手动记录题目。';});choose();
    const nav=document.querySelector('.nav');if(nav){const a=document.createElement('a');a.href='#retrieval';a.innerHTML='<span class="num">DO</span>闭卷抽题练习';nav.appendChild(a);}
  }
  function boot(){course();retrieval();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
