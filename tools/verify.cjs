// Dependency-free integrity checks for every offline lesson.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),files=fs.readdirSync(root),errors=[];
const htmlFiles=files.filter(f=>f.endsWith('.html'));
const dynamicIds=new Set(['engineering','practice-map']);
let links=0,scripts=0;
for(const file of htmlFiles){
  const html=fs.readFileSync(path.join(root,file),'utf8');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  for(const id of new Set(ids))if(ids.filter(x=>x===id).length>1)errors.push(file+': duplicate id '+id);
  for(const m of html.matchAll(/\b(?:href|src)="([^"<>]+)"/g)){
    const ref=m[1];if(/^(https?:|data:|mailto:|javascript:|tel:)/i.test(ref))continue;
    const [target,anchor]=ref.split('#'),fileTarget=(target||file).split('?')[0];
    const full=path.resolve(root,decodeURIComponent(fileTarget));
    links++;
    if(!fs.existsSync(full)){errors.push(file+': missing '+ref);continue;}
    if(anchor&&fileTarget.endsWith('.html')&&!dynamicIds.has(anchor)){
      const body=target?fs.readFileSync(full,'utf8'):html;
      if(!body.includes('id="'+decodeURIComponent(anchor)+'"'))errors.push(file+': missing anchor '+ref);
    }
  }
  for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){
    if(/\bsrc=/.test(m[1]))continue;
    try{new vm.Script(m[2],{filename:file+' inline'});}catch(e){errors.push(e.message);}scripts++;
  }
}
for(const file of files.filter(f=>f.endsWith('.js'))){try{new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});}catch(e){errors.push(e.message);}scripts++;}
const context={window:{}};vm.createContext(context);
for(const file of ['lab-data-1.js','lab-data-2.js','lab-data-3.js','workbench-models.js','advanced-models.js','workbench.js','advanced-workbench.js','learning-paths.js','senior-content-core.js','senior-content-systems.js','senior-registration.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const data=context.window.ZynqLearningData,labs=context.window.ZX_LABS;
if(Object.keys(data.chapters).length!==71)errors.push('Expected 71 practice records');
if(htmlFiles.length!==76)errors.push('Expected 76 HTML pages (71 chapters,4 appendices,index)');
const course=fs.readFileSync(path.join(root,'course.html'),'utf8');
if([...course.matchAll(/class="course-card"/g)].length!==75)errors.push('Expected 75 course cards');
for(const [kind,spec] of Object.entries(context.window.ZynqWorkbench.specs)){
  if(!data.demoTitles[kind])errors.push('Missing title for experiment '+kind);
  if(spec.run){try{const value=spec.run(Object.fromEntries(spec.fields.map(f=>[f.key,f.value])));if(!Array.isArray(value.rows)||!value.rows.length)errors.push(kind+': missing computed rows');}catch(e){errors.push(kind+': default calculation failed: '+e.message);}}
}
let demos=0,chaptersWithDemos=0,publicCases=0;
for(const [id,p]of Object.entries(data.chapters)){
  const file=p.number===1?'index.html':'chapter'+p.number+'.html',html=fs.readFileSync(path.join(root,file),'utf8');
  const assets=[...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(m=>m[1].split('?')[0]);
  for(const asset of ['workbench.css','workbench-models.js','advanced-models.js','workbench.js','advanced-workbench.js','learning-paths.js','senior-content-core.js','senior-content-systems.js','senior-registration.js','learning.js','lab.js'])if(!assets.includes(asset))errors.push(file+': not integrated '+asset);
  if(!labs[id]?.practice)errors.push(id+': practice not attached');
  const views=labs[id]?.widget?.views||[labs[id]?.widget];
  for(const view of views.filter(Boolean))if(view.type==='experiment'){demos++;if(!data.demoTitles[view.kind]||!context.window.ZynqWorkbench.specs[view.kind])errors.push(id+': unknown experiment '+view.kind);}
  if(p.demos.length)chaptersWithDemos++;
  if(labs[id]?.case?.source)publicCases++;
  for(const n of p.prerequisites)if(n>=p.number||n<1)errors.push(id+': invalid prerequisite '+n);
  for(const key of p.sources)if(!data.sources[key])errors.push(id+': missing source '+key);
  for(const q of labs[id].quiz||[])if(!q.options[q.answer])errors.push(id+': invalid quiz answer');
  if(p.number>=52){
    const c=context.window.SENIOR_CHAPTERS[id];
    if(c.sections.length<6||c.goals.length!==4||c.quiz.length!==3)errors.push(id+': incomplete senior teaching structure');
    const text=c.sections.map(s=>s.html.replace(/<[^>]+>/g,'')).join('');
    if((text.match(/[\u3400-\u9fff]/g)||[]).length<1500)errors.push(id+': insufficient substantive Chinese content');
    if(!c.case.source||c.sources.length<2)errors.push(id+': missing primary reference evidence');
  }
}
const report={date:'2026-10-21',release:'senior',htmlPages:htmlFiles.length,checkedLocalLinks:links,checkedScriptBlocks:scripts,practiceChapters:Object.keys(data.chapters).length,seniorChapters:Object.keys(context.window.SENIOR_CHAPTERS).length,experimentKinds:Object.keys(data.demoTitles).length,experimentEntrances:demos,chaptersWithExperiments:chaptersWithDemos,referencedPublicCases:publicCases,errors};
fs.writeFileSync(path.join(root,'verification-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(errors.length)process.exitCode=1;
