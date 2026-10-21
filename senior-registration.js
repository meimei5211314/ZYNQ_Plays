(function(){
  'use strict';
  const D=window.ZynqLearningData;if(!D)return;
  const titles={layout:'ELF：装载存储与运行内存',mmu:'MMU：地址、权限与旧 TLB',publish:'并发：release/acquire 发布关系',cdc:'CDC：脉冲相位与事件保持',lifecycle:'驱动：资源获取与逆序回滚',rta:'实时：响应时间迭代',parser:'协议：分片、噪声与 CRC 重同步',journal:'存储：断电位置与最后提交',ota:'升级：验证、试启动与回退',fixedpoint:'DSP：量化、舍入、饱和与回绕',queuebudget:'容量：接纳、拒绝与队列守恒',thermal:'热：RC 响应与滞回降额',clock:'时基：回绕、漂移与不对称'};
  Object.assign(D.demoTitles,titles);
  const labs=window.ZX_LABS;
  Object.entries(window.SENIOR_CHAPTERS||{}).forEach(([id,c])=>{
    const sources=c.sources.map((s,i)=>{const key=id+'_'+i;D.sources[key]=[s.title,s.url];return key;});
    const p=Object.assign({number:c.number,prerequisites:c.prerequisites,demos:c.demoKinds,sources},c.practice);D.chapters[id]=p;
    if(!labs)return;
    const views=c.demoKinds.map(kind=>({type:'experiment',kind,title:D.demoTitles[kind],label:D.demoTitles[kind]}));
    labs[id]={title:'工程实验与设计判断',lead:'先写假设和预测，再用结果解释机制；可运行参考代码与板级验证分别留存证据。',practice:p,
      case:Object.assign({tag:'公开参考项目 · 有出处',ask:p.prediction,sourceNote:'公开项目用于查证机制；本章练习条件与数值为教学设定，不代表该项目或本板实测。'},c.case),quiz:c.quiz};
    if(views.length)labs[id].widget={title:'可操作的工程推演',sub:'按知识点选择状态推演、波形、计算链或曲线。展开数据表核对结果。',views};
  });
})();
