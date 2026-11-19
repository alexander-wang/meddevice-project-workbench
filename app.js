const $ = selector => document.querySelector(selector);
const content = $('#content');
const dialog = $('#dialog');
const esc = value => String(value ?? '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const states = ['已确认','待批准','待核实'];
const phases = ['详细设计完成','研发样机／工程样机制作与评估','设计冻结、完整 DHR 与初步设计转换','设计验证与设计确认','最终设计转换'];
const qmsPhases = ['体系策划','技术转移','委托生产监督','上市放行','变更与上市后管理'];
const risks = ['高','中','低'];
const levels = ['DHF','DMR','DHR','注册技术文件','一级 · QM','二级 · QP','三级 · WI','四级 · FR','外来参考'];
const kinds = ['文件','追溯','风险','监督','评审','变更','缺失证据','待核实事项','待办'];
const navigation = [
  ['总览与计划', [['home','项目总览','▦'],['projects','项目台账','▣'],['blockers','阻塞事项','⚑'],['weekly','周报','▤']]],
  ['证据与监督', [['files','文件清单','▱'],['trace','设计追溯矩阵','⇄'],['risk','风险与剩余风险','◇'],['use','可用性与网络安全','◎'],['supervision','委托生产与技术转移','▥']]],
  ['审核与跟踪', [['reviews','评审与批准','✓'],['changes','变更记录','≋'],['gaps','缺失证据','◌'],['check','待核实事项','?'],['tasks','待办事项','☷']]]
];
const pages = {
  home:['项目总览','集中追踪研发、注册与质量体系项目的进度和证据。'],
  projects:['项目台账','查看项目范围、当前阶段和归属记录，或复制项目模板。'],
  blockers:['阻塞事项','集中处理已标记阻塞及已逾期的未确认事项。'],
  weekly:['周报','按上海时间汇总本周更新、到期任务和未解决的阻塞事项。'],
  files:['文件清单','管理 DHF、DMR、DHR、注册技术文件与质量体系文件索引。','文件'],
  trace:['设计追溯矩阵','逐条核对设计输入、设计输出、设计验证和设计确认的证据。','追溯'],
  risk:['风险与剩余风险','追踪危害情景、风险控制验证、剩余风险评价与关闭依据。','风险'],
  use:['可用性与网络安全','查看两类专项文件的证据、版本和评审状态。','文件'],
  supervision:['委托生产与技术转移','跟踪技术转移、生产监督、上市放行与上市后管理。','监督'],
  reviews:['评审与批准','按正式签署记录登记评审结论、责任人和批准依据。','评审'],
  changes:['变更记录','登记变更申请、影响评价、批准及实施关闭证据。','变更'],
  gaps:['缺失证据','追踪仍待补录或待取得的文件、签署和原始记录。','缺失证据'],
  check:['待核实事项','汇总专项核实清单及状态为待核实的记录。','待核实事项'],
  tasks:['待办事项','跟进下一步行动、责任人、截止日期及关闭依据。','待办']
};
const labels = {
 title:'名称',stage:'阶段',level:'文件层级',fileType:'文件类型',code:'文件／记录编号',version:'版本',owner:'责任人',status:'状态',risk:'风险等级',due:'截止日期',source:'来源',sourceUrl:'来源链接',evidence:'确认依据／证据',notes:'备注',action:'下一步行动',
 input:'设计输入',output:'设计输出',verification:'设计验证',validation:'设计确认',
 hazard:'危害、事件序列与伤害',control:'风险控制措施',controlProof:'控制实施与有效性验证',residual:'剩余风险及评价结果',acceptance:'接受准则／风险受益依据',closure:'关闭依据与复核',
 reviewer:'审核／批准岗位',decision:'正式评审结论',batch:'批号／转移批次',change:'变更内容',impact:'影响评价',blocked:'阻塞',copiedFrom:'复用来源'
};
const specific = {
  追溯:['input','output','verification','validation'],
  风险:['hazard','control','controlProof','residual','acceptance','closure'],
  监督:['batch','reviewer','decision','closure'],
  评审:['reviewer','decision'],
  变更:['change','impact','reviewer','decision','closure']
};
let items = [], updateDays = [], view = 'home', filters = {}, expanded = false, fileTab = '', weekDate = day(new Date()), ready = false, toastTimer;
function day(value) { return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(value); }
const projectRows = () => items.filter(x=>x.kind==='项目');
const rows = () => items.filter(x=>x.kind!=='项目');
const item = id => items.find(x=>x.id===id);
const projectName = id => item(id)?.title || '';
const today = () => day(new Date());
const blocked = row => row.status!=='已确认' && (row.blocked || (row.due && row.due<today()));
const pill = value => '<span class="status s'+states.indexOf(value)+'">'+esc(value)+'</span>';
const button = (text,act,value='',style='') => '<button class="btn '+style+'" type="button" data-act="'+act+'" data-value="'+esc(value)+'">'+esc(text)+'</button>';
const option = (list,current,empty='全部') => '<option value="">'+empty+'</option>'+list.map(entry=>{
  const [value,label] = Array.isArray(entry)? entry:[entry,entry];
  return '<option value="'+esc(value)+'" '+(current===value?'selected':'')+'>'+esc(label)+'</option>';
}).join('');
const select = (key,list,selected,empty,required=false) => '<select name="'+key+'" '+(required?'required':'')+'>'+option(list,selected,empty)+'</select>';
const uniq = list => [...new Set(list.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
const projectOptions = () => projectRows().map(x=>[x.id,x.title]);
function go(page, next={}) {
  view=page; filters=next; expanded=Object.keys(next).length>0; fileTab='';
  $('#sidebar').classList.remove('open'); $('#menu').setAttribute('aria-expanded','false');
  render(); window.scrollTo(0,0); $('#main').focus({preventScroll:true});
}
function render() {
  $('#nav').innerHTML=navigation.map(([label,links])=>'<div class="nav-label">'+label+'</div>'+links.map(([id,title,icon])=>'<button class="nav-link" type="button" data-act="nav" data-value="'+id+'" '+(view===id?'aria-current="page"':'')+'><span class="nav-icon" aria-hidden="true">'+icon+'</span>'+title+'</button>').join('')).join('');
  const [title,subtitle,kind] = pages[view];
  $('#heading').textContent=title; $('#crumb').textContent=title; $('#subtitle').textContent=subtitle;
  $('#actions').innerHTML=ready ? (view==='home'||view==='projects'
    ? (view==='projects'?button('导出 CSV','export'):'')+button('复制项目模板','copyProject')+button('新建项目','new','项目','primary')
    : button(view==='weekly'?'导出周报':'导出 CSV','export')+ (kind ? button('新增记录','new',kind,'primary') : '')) : '';
  if (!ready) return;
  if (view==='home') { dashboard(); return; }
  const tabs = view==='files'? ['全部','DHF','DMR','DHR','注册技术文件','质量体系'] : view==='use'?['全部','可用性','网络安全'] : view==='risk'?['全部','风险闭环','风险文件']:[];
  content.innerHTML=(tabs.length?'<div class="tabs">'+tabs.map(t=>'<button type="button" class="btn" data-act="tab" data-value="'+(t==='全部'?'':t)+'" aria-pressed="'+(fileTab===(t==='全部'?'':t))+'">'+t+'</button>').join('')+'</div>':'')+
    '<form class="panel filters" id="filters"><div class="toolbar"><input class="search" type="search" name="query" aria-label="搜索记录" placeholder="搜索名称、文件编号或证据" value="'+esc(filters.query)+'">'+button('筛选条件','toggle')+button('清除筛选','clear')+'<span class="muted filter-count" id="filter-count"></span></div>'+
    '<div id="filter-grid" class="filter-grid '+(expanded?'':'is-hidden')+'">'+
    (view!=='projects'? filterSelect('project','项目',projectOptions()):'')+
    filterSelect('stage','阶段',[...phases,...qmsPhases,...uniq(items.map(x=>x.stage)).filter(x=>![...phases,...qmsPhases].includes(x))])+
    filterSelect('level','文件层级',uniq([...levels,...items.map(x=>x.level)]))+
    filterSelect('fileType','文件类型',uniq(items.map(x=>x.fileType)))+
    filterInput('code','文件编号')+
    filterSelect('owner','责任人',[...uniq(items.map(x=>x.owner)),['~','未指定']])+
    filterSelect('status','状态',states)+filterSelect('risk','风险等级',[...risks,['~','未评定']])+
    filterInput('from','截止日期起','date')+filterInput('to','截止日期止','date')+
    filterSelect('source','来源',uniq(items.map(x=>x.source)))+
    '</div></form><div id="results"></div>';
  const form=$('#filters');
  form.addEventListener('submit',event=>event.preventDefault());
  form.addEventListener('input',event=>{filters[event.target.name]=event.target.value; renderResults();});
  renderResults();
}
const filterSelect = (key,title,list) => '<label>'+title+select(key,list,filters[key])+'</label>';
const filterInput = (key,title,type='text') => '<label>'+title+'<input type="'+type+'" name="'+key+'" value="'+esc(filters[key])+'"></label>';
function baseRows() {
  if (view==='projects') return projectRows();
  const all=rows();
  if (view==='blockers') return all.filter(blocked);
  if (view==='weekly') return all;
  if (view==='use') return all.filter(x=>x.kind==='文件' && ['可用性','网络安全'].includes(x.fileType) && (!fileTab||x.fileType===fileTab));
  if (view==='check') return all.filter(x=>x.status==='待核实'||x.kind==='待核实事项');
  if (view==='reviews') return all.filter(x=>x.kind==='评审'||x.status==='待批准');
  if (view==='risk') return all.filter(x=>(x.kind==='风险' && fileTab!=='风险文件') || (x.fileType==='风险管理' && fileTab!=='风险闭环'));
  return all.filter(x=>x.kind===pages[view][2] && (!fileTab || (fileTab==='质量体系'?levels.slice(4).includes(x.level):x.level===fileTab)));
}
function selectedRows() {
  const query=(filters.query||'').trim().toLowerCase();
  const code=(filters.code||'').trim().toLowerCase();
  return baseRows().filter(row=>
    ['project','stage','level','fileType','owner','status','risk','source'].every(key=>!filters[key]||(filters[key]==='~'?!row[key]:row[key]===filters[key])) &&
    (!code||row.code?.toLowerCase().includes(code)) &&
    (!filters.from||(row.due&&row.due>=filters.from)) && (!filters.to||(row.due&&row.due<=filters.to)) &&
    (!query||[row.title,row.code,row.evidence,row.notes,row.action,projectName(row.project)].some(x=>x?.toLowerCase().includes(query)))
  ).sort((a,b)=>Number(Boolean(blocked(b)))-Number(Boolean(blocked(a))) || (a.due||'9999').localeCompare(b.due||'9999'));
}
function dashboard() {
  const all=rows();
  const counts=states.map(s=>all.filter(i=>i.status===s).length);
  const issues=all.filter(blocked);
  const kpis=[
    ['在管项目',projectRows().length,'查看项目台账','▣','projects'],
    ['待核实',counts[2],'核对证据和版本','?','check'],
    ['待批准',counts[1],'跟踪评审与签署','✓','reviews'],
    ['阻塞事项',issues.length,'已标记或已逾期','⚑','blockers']
  ];
  const card=([label,count,sub,icon,page])=>'<button type="button" class="panel kpi" data-act="kpi" data-value="'+page+'"><span class="khead">'+label+'<span class="kicon '+(page==='blockers'?'warn':'')+'" aria-hidden="true">'+icon+'</span></span><strong>'+count+'</strong><small>'+sub+'</small></button>';
  const projectRow=p=>{
    const group=all.filter(r=>r.project===p.id);
    return '<button type="button" class="project-row" data-act="project" data-value="'+esc(p.id)+'"><span class="p-icon" aria-hidden="true">'+(p.fileType==='有源产品'?'研':'质')+'</span><span><strong>'+esc(p.title)+'</strong><small>'+[p.code,p.stage||'当前阶段待核实',p.owner].filter(Boolean).map(esc).join(' · ')+'</small></span><span class="count">'+group.length+' 条记录</span></button>';
  };
  const issueRow=i=>'<button type="button" class="issue" data-act="edit" data-value="'+esc(i.id)+'"><span class="flag" aria-hidden="true">⚑</span><span><strong>'+esc(i.title)+'</strong><small>'+esc(projectName(i.project))+(i.due?' · '+esc(i.due):'')+'</small></span></button>';
  content.innerHTML='<div class="kpis">'+kpis.map(card).join('')+'</div><div class="dash-grid"><section class="panel pad"><div class="section-title"><h2>项目台账</h2>'+button('全部项目','nav','projects','text')+'</div><div class="project-list">'+projectRows().map(projectRow).join('')+'</div></section>'+
    '<section class="panel pad"><div class="section-title"><h2>阻塞事项</h2>'+button('查看清单','nav','blockers','text')+'</div>'+(issues.length?issues.slice(0,4).map(issueRow).join(''):'<p class="muted">当前无阻塞事项。</p>')+'</section></div>'+
    '<section class="panel pad"><div class="section-title"><div><h2>有源产品设计开发流程</h2><p>选择阶段可查看对应文件与证据条目。</p></div></div><div class="timeline">'+phases.map(phase=>'<button type="button" class="phase" data-act="phase" data-value="'+esc(phase)+'">'+esc(phase)+'</button>').join('')+'</div></section>';
}
function table(list,type=view) {
  if (!list.length) return '<div class="empty">当前条件下没有记录。</div>';
  const extraKeys = type==='trace'?specific.追溯 : type==='risk'?['control','controlProof','residual','closure'] : type==='reviews'?['reviewer','decision'] : type==='changes'?['change','impact','closure'] : type==='supervision'?['batch','decision'] : [];
  const isProject=type==='projects';
  const columns=['名称',isProject?'项目类型':'项目','阶段',...extraKeys.map(k=>labels[k]),'责任人','状态',isProject?'记录':'截止日期'];
  return '<div class="table-scroll"><table><thead><tr>'+columns.map(c=>'<th scope="col">'+c+'</th>').join('')+'</tr></thead><tbody>'+list.map(row=>{
    const detail=[row.code,row.version,row.level,row.fileType].filter(Boolean).map(esc).join(' · ');
    return '<tr><td class="title-cell"><button type="button" class="row-link" data-act="edit" data-value="'+esc(row.id)+'">'+esc(row.title)+'</button>'+(detail?'<small>'+detail+'</small>':'')+'</td>'+
      '<td>'+esc(isProject?row.fileType:projectName(row.project))+'</td><td>'+esc(row.stage||'—')+'</td>'+
      extraKeys.map(key=>'<td class="cell-wrap">'+esc(row[key]||'—')+'</td>').join('')+
      '<td>'+esc(row.owner||'—')+'</td><td>'+pill(row.status)+'</td><td>'+(isProject?button('查看文件','project',row.id,'text'):esc(row.due||'—'))+'</td></tr>';
  }).join('')+'</tbody></table></div>';
}
function weekGroups(list) {
  const anchor=new Date(weekDate+'T12:00:00Z');
  anchor.setUTCDate(anchor.getUTCDate()-(anchor.getUTCDay()+6)%7);
  const start=day(anchor); anchor.setUTCDate(anchor.getUTCDate()+6); const end=day(anchor);
  const within=value=>value&&value>=start&&value<=end;
  const touched=new Set(updateDays.filter(entry=>within(entry.day)).map(entry=>entry.id));
  return {start,end,groups:[
    ['本周更新',list.filter(x=>touched.has(x.id))],
    ['本周到期',list.filter(x=>within(x.due))],
    ['当前阻塞',list.filter(blocked)],
    ['待批准及决策',list.filter(x=>x.status==='待批准')],
    ['待落实事项',list.filter(x=>x.kind==='待办'&&x.status!=='已确认')]
  ]};
}
function renderResults() {
  const list=selectedRows();
  $('#filter-count').textContent=list.length+' 条记录';
  const target=$('#results');
  if(view!=='weekly'){ target.innerHTML='<section class="panel">'+table(list)+'</section>'; return; }
  const {start,end,groups}=weekGroups(list);
  target.innerHTML='<div class="weekly"><div class="panel pad toolbar"><label class="weekly-date">选择周内任意日期<input type="date" id="week" value="'+esc(weekDate)+'"></label><p class="muted">'+start+' 至 '+end+' · 上海时间；各条目显示当前状态</p></div>'+groups.map(([name,group])=>'<section class="panel"><h2>'+name+' · '+group.length+'</h2>'+table(group,'weekly')+'</section>').join('')+'</div>';
  $('#week').addEventListener('change',event=>{if(event.target.value){weekDate=event.target.value;renderResults();}});
}
async function api(path,data) {
  const response=await fetch('/api/'+path,data ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)} : {cache:'no-store'});
  const payload=await response.json();
  if(!response.ok) throw new Error(payload.error||'请求未完成');
  return payload;
}
async function refresh(){[items,updateDays]=await Promise.all([api('items'),api('update-days')]);ready=true;render();}
function notify(message){$('#toast').textContent=message;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('#toast').textContent='';},3500);}
function openModal(title,body) {
  $('#modal-title').textContent=title; $('#modal-body').innerHTML='<div class="modal-content">'+body+'</div>';
  if(!dialog.open)dialog.showModal();
  dialog.scrollTop=0;
}
function formField(key,value='',opts={}) {
  const {list,required=false,wide=false,type='text'}=opts;
  const label=labels[key]||key;
  const control=list?select(key,list,value,'请选择',required):type==='textarea'
    ? '<textarea name="'+key+'" maxlength="2500">'+esc(value)+'</textarea>'
    : '<input type="'+type+'" name="'+key+'" '+(required?'required':'')+' maxlength="2500" value="'+esc(value)+'">';
  return '<label class="'+(wide?'wide':'')+'">'+label+control+'</label>';
}
const formError='<p class="error" role="alert"></p>';
const submitButton=text=>'<button type="submit" class="btn primary">'+text+'</button>';
function recordForm(kind,old={}) {
  const isProject=kind==='项目';
  const initialProject=old.project||filters.project||projectRows()[0]?.id||'';
  const initialType=old.fileType||(isProject?'有源产品':view==='use'&&fileTab?fileTab:'');
  const stageList=(isProject?initialType:item(initialProject)?.fileType)==='质量体系'?qmsPhases:phases;
  const allowStage=old.stage&&!stageList.includes(old.stage)?[...stageList,old.stage]:stageList;
  const detailKeys=specific[kind]||[];
  const sourceLink=/^https?:\/\//i.test(old.sourceUrl||'')?'<p class="linkline"><a class="source-link" href="'+esc(old.sourceUrl)+'" target="_blank" rel="noopener noreferrer">打开来源资料</a></p>':'';
  const provenance=old.copiedFrom?'<p class="muted">复用来源：'+esc(item(old.copiedFrom.split('@')[0])?.title||old.copiedFrom)+'</p>':'';
  openModal(old.id?'编辑记录':'新增'+kind,
    '<p class="muted flow-help">已确认表示工作台有据可查。批准结论以正式签署记录为准。</p>'+sourceLink+provenance+
    '<form id="edit-form"><div class="form-grid">'+formField('title',old.title,{wide:true,required:true})+
    (!isProject?'<label>项目'+select('project',projectOptions(),initialProject,'请选择',true)+'</label>':'')+
    (!isProject&&!old.id?'<label>记录类型'+select('kind',kinds,kind,'请选择',true)+'</label>':'')+
    formField('fileType',initialType,isProject?{list:['有源产品','质量体系','其他'],required:true}:{})+
    formField('stage',old.stage,{list:allowStage})+(!isProject?formField('level',old.level,{list:levels}):'')+
    formField('code',old.code)+(!isProject?formField('version',old.version):'')+
    formField('owner',old.owner)+formField('status',old.status||'待核实',{list:states,required:true})+
    formField('risk',old.risk,{list:risks})+formField('due',old.due,{type:'date'})+
    formField('source',old.source)+formField('sourceUrl',old.sourceUrl,{type:'url'})+
    detailKeys.map(k=>formField(k,old[k],{type:'textarea'})).join('')+
    formField('evidence',old.evidence,{type:'textarea',wide:true})+
    formField('action',old.action,{type:'textarea',wide:true})+formField('notes',old.notes,{type:'textarea',wide:true})+
    (!isProject?'<label class="check"><input type="checkbox" name="blocked" '+(old.blocked?'checked':'')+'>标记为阻塞事项</label>':'')+'</div>'+formError+
    '<div class="form-actions">'+(old.id?button('版本历史','history',old.id)+button(isProject?'复制为项目模板':'复用此记录','copyRow',old.id):'')+
    button('取消','close')+submitButton('保存记录')+'</div></form>');
  const form=$('#edit-form');
  if(old.id&&!isProject)form.elements.project.disabled=true;
  const formValues=()=>Object.fromEntries(new FormData(form));
  form.elements.kind?.addEventListener('change',event=>recordForm(event.target.value,{...formValues(),blocked:form.elements.blocked?.checked}));
  function adaptStages(value) {
    const stage=form.elements.stage;
    const list=value==='质量体系'?qmsPhases:phases;
    stage.innerHTML=option(list,list.includes(stage.value)?stage.value:'','请选择');
  }
  if(isProject)form.elements.fileType.addEventListener('change',event=>adaptStages(event.target.value));
  if(!isProject&&!old.id)form.elements.project.addEventListener('change',event=>adaptStages(item(event.target.value)?.fileType));
  form.addEventListener('submit',event=>{
    event.preventDefault();
    saveForm(form,'items',{...formValues(),kind,id:old.id,revision:old.revision,blocked:form.elements.blocked?.checked===true},async()=>{
      await refresh();dialog.close();notify('记录已保存');
    });
  });
}
async function saveForm(form,path,data,onSuccess) {
  const submit=form.querySelector('[type=submit]');
  submit.disabled=true;form.querySelector('.error').textContent='';
  let result;
  try { result=await api(path,data); }
  catch(error){form.querySelector('.error').textContent=error.message;submit.disabled=false;return;}
  try { await onSuccess(result); }
  catch { dialog.close();notify('已保存，列表刷新失败。请刷新页面。'); }
}
function copyForm(source) {
  const isProject=!source||source.kind==='项目';
  openModal(isProject?'复制项目模板':'复用历史记录',
    '<p class="muted flow-help">'+(isProject?'复制关卡和清单结构，新项目记录默认为待核实。':'复用分类、备注和下一步行动。新记录默认为待核实，请核对备注后使用。')+' 责任人、截止日期、文件编号及原证据需重新登记。</p>'+
    '<form id="copy-form"><div class="form-grid">'+(isProject?'<label class="wide">来源项目'+select('id',projectOptions(),source?.id||projectRows()[0]?.id,'请选择',true)+'</label>':
    '<label class="wide">目标项目'+select('project',projectOptions(),filters.project||source.project,'请选择',true)+'</label>')+
    formField('title',source?source.title+'（复用）':'',{wide:true,required:true})+'</div>'+formError+
    '<div class="form-actions">'+button('取消','close')+submitButton('确认复制')+'</div></form>');
  const form=$('#copy-form');
  form.addEventListener('submit',event=>{
    event.preventDefault();
    saveForm(form,'copy',{id:source?.id,sourceRevision:source?.revision,...Object.fromEntries(new FormData(form))},async({id})=>{
      await refresh();dialog.close();
      if(isProject) go('files',{project:id}); else recordForm(source.kind,item(id));
      notify(isProject?'项目模板已复制':'记录已复用');
    });
  });
}
async function history(id) {
  openModal('版本历史','<p class="muted">正在载入…</p>');
  try {
    const versions=await api('history?id='+encodeURIComponent(id));
    if(!dialog.open||$('#modal-title').textContent!=='版本历史')return;
    const current=item(id);
    $('#modal-body').innerHTML='<div class="modal-content"><p class="muted">'+esc(current.title)+'</p><div class="history">'+versions.map((version,index)=>
      '<details '+(index===0?'open':'')+'><summary>'+esc(version.revision?'版本 '+version.revision+' · '+new Date(version.updatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}):'初始索引')+' · '+esc(version.status)+'</summary><dl>'+
      Object.entries(labels).filter(([key])=>version[key]).map(([key,label])=>'<dt>'+label+'</dt><dd>'+esc(version[key])+'</dd>').join('')+
      '</dl>'+button('复用此版本','reuseVersion',version.revision)+'</details>').join('')+'</div><div class="form-actions">'+button('返回记录','edit',id)+'</div></div>';
    for(const control of dialog.querySelectorAll('[data-act=reuseVersion]')) control.addEventListener('click',()=>{
      const old=versions.find(version=>String(version.revision)===control.dataset.value);copyForm(old);
    });
  } catch(error){$('#modal-body').textContent=error.message;}
}
function exportRecords() {
  const list=selectedRows();
  const report=view==='weekly'?weekGroups(list):null;
  const keys=Object.keys(labels);
  const data=report?report.groups.flatMap(([group,groupRows])=>groupRows.map(row=>[report.start,report.end,group,row])):list.map(row=>[row]);
  const header=[...(report?['周起始','周结束','周报分组']:[]),'项目','记录类型',...keys.map(k=>labels[k]),'更新日期','记录ID'];
  const values=data.map(entry=>{
    const row=entry.at(-1);
    return [...entry.slice(0,-1),row.kind==='项目'?row.title:projectName(row.project),row.kind,...keys.map(k=>k==='blocked'?(row.blocked?'是':''):row[k]),row.updatedAt||'',row.id];
  });
  const quote=value=>{
    const text=String(value??'');
    return '"'+(/^[\s]*[=+@-]|^[\t\r\n]/.test(text)?"'":"")+text.replaceAll('"','""')+'"';
  };
  const csv='\uFEFF'+[header,...values].map(row=>row.map(quote).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=pages[view][0]+'-'+(report?.start||today())+'.csv';
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  notify('已导出 '+values.length+' 条记录');
}
document.addEventListener('click',event=>{
  const target=event.target.closest('[data-act]');
  if(!target||!ready) return;
  const {act,value}=target.dataset;
  if(act==='nav')go(value);
  if(act==='kpi')go(value,value==='reviews'?{status:'待批准'}:value==='check'?{status:'待核实'}:{});
  if(act==='project')go('files',{project:value});
  if(act==='phase')go('files',{stage:value});
  if(act==='toggle'){expanded=!expanded;$('#filter-grid').classList.toggle('is-hidden',!expanded);target.setAttribute('aria-expanded',String(expanded));}
  if(act==='clear'){filters={};render();}
  if(act==='tab'){fileTab=value;render();}
  if(act==='new')recordForm(value);
  if(act==='edit'){const row=item(value);if(row)recordForm(row.kind,row);}
  if(act==='close')dialog.close();
  if(act==='copyProject')copyForm();
  if(act==='copyRow')copyForm(item(value));
  if(act==='history')history(value);
  if(act==='export')exportRecords();
});
$('#close').addEventListener('click',()=>dialog.close());
$('#menu').addEventListener('click',()=>{
  const open=$('#sidebar').classList.toggle('open');$('#menu').setAttribute('aria-expanded',String(open));
});
$('#today').textContent=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'long'}).format(new Date());
render();
refresh().catch(error=>{content.innerHTML='<div class="panel pad" role="alert">'+esc(error.message)+' <button class="btn" id="retry" type="button">重试</button></div>';$('#retry').addEventListener('click',()=>location.reload());});
