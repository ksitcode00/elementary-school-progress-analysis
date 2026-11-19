const source = JSON.parse(document.getElementById('dashboard-data').textContent);
const data = new Fairmont(source);
const state = {page:'context',year:'2026',school:'all',grade:'0',subject:'0',metric:'spring',statusSample:'spring',trend:'enrollment',modelSubject:'both'};
const colors = ['#326c9d','#227c77','#af771d','#8266a2'];
const byId = id => document.getElementById(id);
const t = en => en;
const esc = value => String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = value => value===null||value===undefined?'n/a':typeof value==='string'?value:Number(value).toLocaleString('en-US',{maximumFractionDigits:1});
const pct = (value,digits=1) => value===null||value===undefined||!Number.isFinite(value)?'n/a':`${(value*100).toFixed(digits)}%`;
const yr = value => value==='all'?t('2023-24 to 2025-26'):`${Number(value)-1}-${String(value).slice(-2)}`;
const gradeName = value => value==='all'?t('All K-5'):Number(value)===0?'K':String(value);
const schoolName = id => source.schools.find(s=>s[0]===Number(id))?.[1]||'';
const shortSchool = id => schoolName(id).replace(' Elementary','');
const color = id => colors[source.schools.findIndex(s=>s[0]===Number(id))]||colors[0];
const schools = () => source.schools.filter(s=>state.school==='all'||s[0]===Number(state.school));
const sum = values => values.reduce((a,b)=>a+b,0);
const selection = (extra={}) => ({...state,...extra});
const empty = (id,text=t('No records for this selection. Try another school or year.')) => {byId(id).innerHTML=`<div class="empty">${esc(text)}</div>`;};
const paragraph = en => `<p>${t(en)}</p>`;
const legend = entries => `<div class="legend">${entries.map(e=>`<span><i style="background:${e[1]}"></i>${esc(e[0])}</span>`).join('')}</div>`;
const schoolLegend = () => legend(schools().map(s=>[shortSchool(s[0]),color(s[0])]));
const panel = (id,title,note,wide=false,extra='') => `<section class="panel${wide?' wide':''}"><div class="panel-top"><h2>${title}</h2><button type="button" class="save-chart" data-save="${id}">${t('Save chart')}</button></div><p class="note">${note}</p>${extra}<div id="${id}" class="chart"></div></section>`;
function svgEl(tag, attrs={}, parent) {
  const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
  for(const [k,v] of Object.entries(attrs))node.setAttribute(k,String(v));
  if(parent)parent.appendChild(node);return node;
}
function chart(id,height,title) {
  const host=byId(id);host.innerHTML='';const width=Math.max(270,host.clientWidth);
  const svg=svgEl('svg',{viewBox:`0 0 ${width} ${height}`,width,height,role:'img','aria-label':title,style:'font-family:Avenir Next,Trebuchet MS,Arial,sans-serif;font-size:12px;color:#16324a'},host);
  const a=svgEl('title',{},svg);a.textContent=title;
  return {svg,w:width,h:height};
}
function text(svg,x,y,value,attrs={}) {const n=svgEl('text',{x,y,fill:'#16324a',...attrs},svg);n.textContent=value;return n;}
function line(svg,x1,y1,x2,y2,attrs={}) {return svgEl('line',{x1,y1,x2,y2,stroke:'#d6e0e8',...attrs},svg);}
function tip(node,info) {node.setAttribute('data-tip',info);node.setAttribute('tabindex','0');node.setAttribute('aria-label',info);const title=svgEl('title',{},node);title.textContent=info;return node;}
function ticksX(svg,left,right,y,max,formatter=num,steps=4) {
  for(let i=0;i<=steps;i++){const x=left+(right-left)*i/steps;line(svg,x,y,x,y+4,{stroke:'#9db0bd'});text(svg,x,y+19,formatter(max*i/steps),{'text-anchor':'middle',fill:'#5c6d7a'});}
}
function barChart(id,rows,{valueLabel=num,axisLabel='',max=null}={}) {
  if(!rows.length)return empty(id);
  const h=Math.max(245,rows.length*43+55),{svg,w}=chart(id,h,axisLabel);
  const left=w<420?106:143,right=w-48,top=22,available=right-left;
  max=max||Math.max(...rows.map(r=>r.value))*1.2||1;
  rows.forEach((r,i)=>{const y=top+i*43;text(svg,left-10,y+17,r.label,{'text-anchor':'end','font-size':w<360?10:12});
    const rect=svgEl('rect',{x:left,y,width:Math.max(0,r.value/max*available),height:25,rx:3,fill:r.color||'#326c9d'},svg);
    tip(rect,r.tip||`${r.label}: ${valueLabel(r.value)}`);text(svg,Math.min(right+5,left+r.value/max*available+7),y+17,valueLabel(r.value),{'font-size':11});});
  ticksX(svg,left,right,h-39,max,valueLabel);text(svg,(left+right)/2,h-4,axisLabel,{'text-anchor':'middle',fill:'#5c6d7a'});
}
function enrollmentChart() {
  const series=schools().map(s=>({id:s[0],values:[2024,2025,2026].map(year=>{const rows=data.contextRows({school:s[0],year,grade:'all'});return state.trend==='absence'?data.absence(rows):rows.length;})}));
  const {svg,w,h}=chart('enrollment-chart',280,state.trend==='absence'?t('Annual absence by school and year'):t('Enrollment by school and year'));
  const left=48,right=w-38,top=27,bottom=h-46;
  const values=series.flatMap(s=>s.values),lo=state.trend==='absence'?0:Math.max(0,Math.floor((Math.min(...values)-15)/25)*25),hi=state.trend==='absence'?.10:Math.ceil((Math.max(...values)+15)/25)*25;
  const y=v=>bottom-(v-lo)/(hi-lo)*(bottom-top),x=i=>left+(right-left)*i/2;
  for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4;line(svg,left,y(v),right,y(v));text(svg,left-9,y(v)+4,state.trend==='absence'?pct(v,1):num(v),{'text-anchor':'end',fill:'#5c6d7a'});}
  [2024,2025,2026].forEach((year,i)=>{text(svg,x(i),bottom+25,yr(year),{'text-anchor':'middle',fill:'#5c6d7a'});if(String(year)===state.year)line(svg,x(i),top-5,x(i),bottom,{stroke:'#b3c8d6','stroke-dasharray':'3 5'});});
  series.forEach(s=>{svgEl('polyline',{points:s.values.map((v,i)=>`${x(i)},${y(v)}`).join(' '),fill:'none',stroke:color(s.id),'stroke-width':2.5},svg);s.values.forEach((v,i)=>{const dot=svgEl('circle',{cx:x(i),cy:y(v),r:4.5,fill:color(s.id)},svg);tip(dot,`${shortSchool(s.id)}\n${yr(2024+i)}: ${state.trend==='absence'?pct(v):num(v)} ${state.trend==='absence'?t('annual absence'):t('enrolled students')}`);});});
  byId('enrollment-chart').insertAdjacentHTML('afterend',schoolLegend());
}
function needsChart() {
  const rows=data.contextRows(selection({grade:'all'}));
  const {svg,w,h}=chart('needs-chart',Math.max(280,schools().length*68+52),t('Recorded student needs'));
  const left=w<420?108:145,right=w-44,top=15,max=.6;
  const categories=[['el','EL','#326c9d'],['econ',t('Economic disadvantage'),'#227c77'],['sped','SPED','#8266a2']];
  schools().forEach((s,i)=>{const group=rows.filter(r=>r.school===s[0]);text(svg,left-10,top+i*68+29,shortSchool(s[0]),{'text-anchor':'end','font-size':w<360?10:12});categories.forEach(([key,label,fill],j)=>{const rate=group.length?data.sum(group,key)/group.length:0,y=top+i*68+j*17;const rect=svgEl('rect',{x:left,y,width:rate/max*(right-left),height:12,fill,rx:2},svg);tip(rect,`${shortSchool(s[0])}\n${label}: ${pct(rate)} (${data.sum(group,key)} / ${group.length})`);text(svg,left+rate/max*(right-left)+5,y+10,pct(rate,0),{'font-size':10});});});
  ticksX(svg,left,right,h-29,max,v=>pct(v,0),3);byId('needs-chart').insertAdjacentHTML('afterend',legend(categories.map(c=>[c[1],c[2]])));
}
function stackedChart(id,groups,labels,fills) {
  if(!groups.some(g=>g.total))return empty(id);
  const h=Math.max(245,groups.length*49+42),{svg,w}=chart(id,h,t('Composition of selected records'));
  const left=w<420?108:145,right=w-25,top=18;
  groups.forEach((g,i)=>{const y=top+i*49;text(svg,left-10,y+18,g.label,{'text-anchor':'end','font-size':w<360?10:12});let x=left;
    g.counts.forEach((count,j)=>{const width=g.total?count/g.total*(right-left):0;if(width){const rect=svgEl('rect',{x,y,width,height:29,fill:fills[j]},svg);tip(rect,`${g.label}\n${labels[j]}: ${num(count)} / ${num(g.total)} (${pct(count/g.total)})`);if(width>35)text(svg,x+width/2,y+19,pct(count/g.total,0),{'text-anchor':'middle','font-size':10,fill:parseInt(fills[j].slice(1,3),16)*.299+parseInt(fills[j].slice(3,5),16)*.587+parseInt(fills[j].slice(5,7),16)*.114<145?'white':'#16324a'});x+=width;}});
    text(svg,right,y+42,`n=${num(g.total)}`,{'text-anchor':'end','font-size':10,fill:'#5c6d7a'});});
  byId(id).insertAdjacentHTML('afterend',legend(labels.map((l,i)=>[l,fills[i]])));
}
function contextView() {
  const rows=data.contextRows(selection({grade:'all'}));
  byId('counts').innerHTML=countStrip([[rows.length,t(state.year==='all'?'student-year records':'enrolled students')],[data.uniqueStudents(rows),t('unique students')],[pct(data.absence(rows)),t('annual absence')]]);
  enrollmentChart();needsChart();
  const groups=schools().map(s=>{const group=rows.filter(r=>r.school===s[0]);return {label:shortSchool(s[0]),total:group.length,counts:[0,1,2,3,4,5].map(g=>group.filter(r=>r.grade===g).length)};});
  stackedChart('grade-chart',groups,['K','1','2','3','4','5'],['#dceaf2','#bad3e3','#93b7d0','#709cbb','#4a7e9f','#285c7d']);
  byId('school-table').innerHTML=`<table><thead><tr><th>${t('School')}</th><th class="num">${t('Records')}</th><th class="num">${t('Absence')}</th><th class="num">${t('Median days enrolled')}</th></tr></thead><tbody>${schools().map(s=>{const g=rows.filter(r=>r.school===s[0]);return `<tr><td><button class="school-button" data-school="${s[0]}"><span class="dot" style="background:${color(s[0])}"></span>${esc(shortSchool(s[0]))}</button></td><td class="num">${num(g.length)}</td><td class="num">${pct(data.absence(g))}</td><td class="num">${num(data.median(g.map(r=>r.days)))}</td></tr>`;}).join('')}</tbody></table>`;
  const changes=schools().map(s=>{const first=data.contextRows({year:2024,school:s[0],grade:'all'}).length,last=data.contextRows({year:2026,school:s[0],grade:'all'}).length;return `${shortSchool(s[0])}: ${first} → ${last} (${last>=first?'+':''}${((last-first)/first*100).toFixed(1)}%)`;});
  byId('takeaway').textContent=t('Enrollment did not move in one direction. '+changes.join('; ')+'. Compare learning within grade and subject because school averages also reflect who is enrolled.');
}
function countStrip(items){return items.map(([value,name])=>`<div><span class="value">${num(value)}</span><span class="name">${esc(name)}</span></div>`).join('');}
function learningScores() {
  const groups=schools().map(s=>{const records=data.learning(selection({school:s[0]})).paired;return {id:s[0],rows:records,fall:data.median(records.map(r=>r.fall)),spring:data.median(records.map(r=>r.spring))};});
  const points=groups.flatMap(g=>[g.fall,g.spring]).filter(v=>v!==null);if(!points.length)return empty('scores-chart');
  const {svg,w,h}=chart('scores-chart',280,t('Median Fall and Spring scores among paired students'));
  const left=w<420?110:145,right=w-30,top=24,bottom=h-53,min=Math.floor((Math.min(...points)-8)/10)*10,max=Math.ceil((Math.max(...points)+8)/10)*10,x=v=>left+(v-min)/(max-min)*(right-left);
  for(let i=0;i<=4;i++){const value=min+(max-min)*i/4;line(svg,x(value),top,x(value),bottom);text(svg,x(value),bottom+21,num(value),{'text-anchor':'middle',fill:'#5c6d7a'});}
  groups.forEach((g,i)=>{const y=top+23+i*44;text(svg,left-11,y+4,shortSchool(g.id),{'text-anchor':'end','font-size':w<360?10:12});if(g.fall===null){text(svg,left,y,t('No pairs'));return;}line(svg,x(g.fall),y,x(g.spring),y,{stroke:color(g.id),'stroke-width':3});
    for(const [stage,value,fill] of [['Fall',g.fall,'white'],['Spring',g.spring,color(g.id)]]){const dot=svgEl('circle',{cx:x(value),cy:y,r:6,fill,stroke:color(g.id),'stroke-width':2},svg);tip(dot,`${shortSchool(g.id)}\n${stage} ${t('median')}: ${num(value)}\n${t('Complete pairs')}: ${g.rows.length}`);}
    text(svg,right,y+20,`n=${g.rows.length}`,{'text-anchor':'end','font-size':10,fill:'#5c6d7a'});});
  text(svg,(left+right)/2,h-3,t('Benchmark scale score'),{'text-anchor':'middle',fill:'#5c6d7a'});
  byId('scores-chart').insertAdjacentHTML('afterend',`<div class="legend"><span><i class="outline"></i>${t('Fall median')}</span><span><i style="background:#16324a"></i>${t('Spring median')}</span></div>`);
}
function learningView() {
  const result=data.learning(state);
  byId('counts').innerHTML=countStrip([[result.fall.length,t('Fall results')],[result.spring.length,t('Spring results')],[result.paired.length,t('complete pairs')],[pct(result.springAtAbove),t('Spring At/Above')]]);
  learningScores();
  const groups=schools().map(s=>{const g=data.learning(selection({school:s[0]})).paired;return {label:shortSchool(s[0]),value:data.median(g.map(r=>r.spring-r.fall)),color:color(s[0]),tip:`${shortSchool(s[0])}\n${t('Median individual change')}: ${num(data.median(g.map(r=>r.spring-r.fall)))}\n${t('Complete pairs')}: ${g.length}`};}).filter(r=>r.value!==null);
  // Change can be negative; use a zero-centered plot instead of clipping at zero.
  changeChart(groups);
  const statusGroups=schools().map(s=>{const learning=data.learning(selection({school:s[0]})),rows=state.statusSample==='spring'?learning.spring:learning.paired;return {label:shortSchool(s[0]),total:rows.length,counts:[0,1,2,3].map(level=>rows.filter(r=>r.springLevel===level).length)};});
  stackedChart('status-chart',statusGroups,[t('Well below'),t('Below'),t('At benchmark'),t('Above')],['#dbb59b','#ead6a7','#78acb7','#367487']);
  if(!result.paired.length){byId('takeaway').textContent=t('There are no complete pairs for this selection. Spring status can still describe tested students, but score change cannot be calculated.');return;}
  byId('takeaway').textContent=t(`These ${num(result.paired.length)} pairs have a median individual change of ${num(data.median(result.paired.map(r=>r.spring-r.fall)))} points. Compare the Fall dots before judging the Spring difference. No expected-growth target is supplied, so positive change alone does not establish sufficient growth.`);
}
function changeChart(rows) {
  if(!rows.length)return empty('change-chart');
  const {svg,w,h}=chart('change-chart',280,t('Median individual Fall-Spring change'));
  const left=w<420?110:145,right=w-32,top=26,bottom=h-48,min=Math.min(0,...rows.map(r=>r.value))-2,max=Math.max(1,...rows.map(r=>r.value))+4,x=v=>left+(v-min)/(max-min)*(right-left);
  line(svg,x(0),top,x(0),bottom,{stroke:'#9eb3c1'});
  rows.forEach((r,i)=>{const y=top+i*45;const rect=svgEl('rect',{x:Math.min(x(0),x(r.value)),y,width:Math.abs(x(r.value)-x(0)),height:27,rx:3,fill:r.color},svg);tip(rect,r.tip);text(svg,left-10,y+18,r.label,{'text-anchor':'end','font-size':w<360?10:12});text(svg,x(r.value)+(r.value>=0?6:-6),y+18,num(r.value),{'text-anchor':r.value>=0?'start':'end','font-size':11});});
  for(let i=0;i<=4;i++){const value=min+(max-min)*i/4;text(svg,x(value),bottom+20,num(value),{'text-anchor':'middle',fill:'#5c6d7a'});}text(svg,(left+right)/2,h-3,t('Spring minus Fall, points'),{'text-anchor':'middle',fill:'#5c6d7a'});
}
function heatmap() {
  const rows=data.contextRows(selection({school:'all',grade:'all'}));
  byId('heatmap').innerHTML=`<table aria-label="${t('Annual absence rate by school and grade')}"><thead><tr><th>${t('School / grade')}</th>${[0,1,2,3,4,5].map(g=>`<th>${gradeName(g)}</th>`).join('')}</tr></thead><tbody>${source.schools.map(s=>`<tr><th class="row-label">${esc(shortSchool(s[0]))}</th>${[0,1,2,3,4,5].map(g=>{const group=rows.filter(r=>r.school===s[0]&&r.grade===g),rate=data.absence(group),v=rate===null?0:Math.min(1,rate/.10),rgb=[238,245,248].map((start,i)=>Math.round(start+([50,108,157][i]-start)*v)),selected=Number(state.school)===s[0]&&Number(state.grade)===g;return `<td><button data-cell="${s[0]},${g}" aria-pressed="${selected}" style="background:rgb(${rgb});color:${v>.6?'white':'#16324a'}" aria-label="${esc(shortSchool(s[0]))}, ${t('grade')} ${gradeName(g)}, ${pct(rate)}, n=${group.length}" title="${esc(shortSchool(s[0]))} · ${gradeName(g)} · n=${group.length}">${pct(rate)}</button></td>`;}).join('')}</tr>`).join('')}</tbody></table><div class="heat-legend"><span>0%</span><span class="ramp"></span><span>10%+</span></div>`;
}
function scatter() {
  const rows=data.learning(state).paired.filter(r=>r.intervalDays>0&&r.intervalAbsent!==null);
  const metric=r=>state.metric==='change'?r.spring-r.fall:r[state.metric];
  const label=state.metric==='change'?t('Spring minus Fall, points'):state.metric==='fall'?t('Fall scale score'):t('Spring scale score');
  if(!rows.length){empty('scatter-chart');return {rows,rho:null};}
  const {svg,w,h}=chart('scatter-chart',300,t('Between-test absence alongside learning'));
  const left=50,right=w-18,top=20,bottom=h-57,xmax=Math.max(.2,Math.ceil(Math.max(...rows.map(r=>r.intervalAbsent/r.intervalDays))*10)/10),values=rows.map(metric),min=Math.floor((Math.min(...values)-3)/10)*10,max=Math.ceil((Math.max(...values)+3)/10)*10,x=v=>left+v/xmax*(right-left),y=v=>bottom-(v-min)/(max-min)*(bottom-top);
  for(let i=0;i<=4;i++){const v=min+(max-min)*i/4;line(svg,left,y(v),right,y(v));text(svg,left-8,y(v)+4,num(v),{'text-anchor':'end',fill:'#5c6d7a'});}
  ticksX(svg,left,right,bottom,xmax,v=>pct(v,0));
  rows.forEach(r=>{const rate=r.intervalAbsent/r.intervalDays,point=svgEl('circle',{cx:x(rate),cy:y(metric(r)),r:3.2,fill:color(r.school),opacity:.55},svg);tip(point,`${shortSchool(r.school)} · ${yr(r.year)} · ${gradeName(r.grade)}\n${t('Between-test absence')}: ${pct(rate)} (${r.intervalAbsent}/${r.intervalDays} ${t('days')})\nFall: ${num(r.fall)} · Spring: ${num(r.spring)}\n${t('Change')}: ${num(r.spring-r.fall)}`);});
  text(svg,(left+right)/2,h-4,t('Between-test absence rate'),{'text-anchor':'middle',fill:'#5c6d7a'});text(svg,left,top-7,label,{'font-size':11,fill:'#5c6d7a'});
  byId('scatter-chart').insertAdjacentHTML('afterend',schoolLegend());
  return {rows,rho:data.spearman(rows.map(r=>r.intervalAbsent/r.intervalDays),rows.map(metric))};
}
function attendanceView() {
  heatmap();
  const annual=data.contextRows(state),scatterResult=scatter(),intervalRows=scatterResult.rows;
  byId('counts').innerHTML=countStrip([[annual.length,t('enrolled records')],[pct(data.absence(annual)),t('annual absence')],[intervalRows.length,t('usable subject pairs')],[scatterResult.rho===null?'n/a':scatterResult.rho.toFixed(2),t('Spearman correlation')]]);
  const bins=[0,.025,.05,.075,.10,.15,.20,Infinity],labels=['0-<2.5%','2.5-<5%','5-<7.5%','7.5-<10%','10-<15%','15-<20%','20%+'];
  barChart('distribution-chart',labels.map((label,i)=>({label,value:annual.filter(r=>r.absent/r.days>=bins[i]&&r.absent/r.days<bins[i+1]).length,color:'#326c9d'})),{axisLabel:t('Enrolled student-year records')});
  const rhoFall=data.spearman(intervalRows.map(r=>r.intervalAbsent/r.intervalDays),intervalRows.map(r=>r.fall));
  byId('takeaway').textContent=t(`For the selected grade and subject, ${num(intervalRows.length)} pairs have usable attendance intervals. The raw Fall correlation is ${rhoFall===null?'undefined':rhoFall.toFixed(2)}. Fall was measured before this attendance period, so starting differences need attention when interpreting Spring. Select Fall, Spring, or change below to compare the relationships.`);
  byId('interval-note').textContent=t(`Annual distribution includes ${num(annual.length)} enrolled records. The scatterplot uses ${num(intervalRows.length)} complete subject pairs. Median between-test interval: ${num(data.median(intervalRows.map(r=>r.intervalDays)))} instructional days. These are different samples and attendance periods.`);
}
function pathsChart() {
  const p=data.learningPaths(state);
  const rows=[];
  if(p.fallBelow)rows.push({label:t('Remain below'),value:p.persistent/p.fallBelow,color:'#326c9d',tip:`${p.persistent} / ${p.fallBelow} ${t('paired Fall-below records')}`});
  if(p.persistent)rows.push({label:t('Gained points'),value:p.positiveAmongPersistent/p.persistent,color:'#227c77',tip:`${p.positiveAmongPersistent} / ${p.persistent} ${t('records below in both windows')}`});
  barChart('paths-chart',rows,{max:1,valueLabel:v=>pct(v),axisLabel:t('Share within each stated sample')});
  byId('paths-chart').closest('.panel').querySelector('.note').textContent=t(
    `Remain below: ${p.persistent}/${p.fallBelow} paired Fall-below records. Gained points: ${p.positiveAmongPersistent}/${p.persistent} records below in both windows. These are different denominators; no expected-growth target is supplied.`);
  byId('takeaway').textContent=p.fallBelow?t(
    `${pct(p.persistent/p.fallBelow)} of paired Fall-below records remain below in Spring. Among records below in both windows, ${pct(p.positiveAmongPersistent/p.persistent)} gained points. Progress and reaching Benchmark answer different questions.`):t('No paired Fall-below records are available for this selection.');
  if(p.fallBelow&&!p.persistent)byId('takeaway').textContent=t(`All ${p.fallBelow} paired Fall-below records reached At/Above Benchmark in Spring. No records remain below in both windows for the conditional progress percentage.`);
  byId('path-counts').innerHTML=paragraph(`${p.persistent} / ${p.fallBelow} paired Fall-below records remained below in Spring. ${p.positiveAmongPersistent} / ${p.persistent} records below in both windows gained score points. Median change in this latter group: ${num(p.medianPersistentChange)} points.`);
}
function needsView() {
  const n=data.learningNeeds(state);
  byId('counts').innerHTML=countStrip([[n.enrolled,t(state.year==='all'?'enrolled student-years':'enrolled students')],[n.knownAny,t('identified in at least one subject')],[n.counts[0],t('below in both windows, both subjects')],[n.counts[4],t('incomplete two-subject information')]]);
  const labels=[t('Both subjects'),t('Reading only'),t('Math only'),t('Neither pattern'),t('Incomplete information')];
  const groups=schools().map(s=>{const a=data.learningNeeds(selection({school:s[0]}));return {label:shortSchool(s[0]),counts:a.counts,total:a.enrolled};});
  stackedChart('overlap-chart',groups,labels,['#326c9d','#7ba4c6','#69a9a0','#d9e7e8','#dfd6c2']);
  const completeKnown=sum(n.counts.slice(0,3)),partialKnown=n.knownAny-completeKnown;
  byId('overlap-chart').insertAdjacentHTML('afterend',`<div id="needs-count-explanation">${paragraph(
    `The five groups cover all ${num(n.enrolled)} enrolled records. The ${num(n.knownAny)} identified records are a separate count: ${num(completeKnown)} with both subject pairs complete + ${num(partialKnown)} with one complete pair showing below at both tests. They are not a sixth group.`)}${paragraph(
    'Reading only and Math only mean both subject pairs are complete and only that subject is below at both tests. Below includes Below Benchmark and Well Below Benchmark. Two observations do not show status throughout the year or rule out score gains.')}</div>`);

  const attendance=[{label:t('Below 10%'),value:n.lowerAbsence,color:'#227c77'},{label:t('10% or more'),value:n.highAbsence,color:'#af771d'}];
  if(n.unknownAttendance)attendance.push({label:t('Undefined'),value:n.unknownAttendance,color:'#b4bdc5'});
  if(n.knownAny)barChart('needs-attendance-chart',attendance,{axisLabel:t('Records with an identified learning pattern')});else empty('needs-attendance-chart');
  byId('needs-attendance-note').innerHTML=paragraph(`${num(n.lowerAbsence)} / ${num(n.knownAny)} records with an identified pattern have annual absence below 10%; ${num(n.highAbsence)} / ${num(n.knownAny)} have 10% or more. Undefined attendance: ${num(n.unknownAttendance)}. This uses the whole enrolled year, not the between-test model interval.`);
  byId('takeaway').textContent=t(`${num(n.knownAny)} records have a known pattern in at least one subject. The overlap chart requires complete information in both subjects to name a Reading-only or Math-only group; identified needs in partially observed records still enter the count above. Review academic support broadly and coordinate attendance help for the overlapping group.`);
}
function intervalChart(id,rows,min,max,formatter,axisLabel) {
  if(!rows.length)return empty(id);
  const {svg,w,h}=chart(id,Math.max(270,rows.length*52+80),axisLabel);
  const left=w<420?108:145,right=w-55,top=30,bottom=h-47;
  const x=v=>left+(v-min)/(max-min)*(right-left);
  for(let i=0;i<=4;i++){const v=min+(max-min)*i/4;line(svg,x(v),top-12,x(v),bottom);text(svg,x(v),bottom+19,formatter(v),{'text-anchor':'middle','font-size':11,fill:'#5c6d7a'});}
  if(min<0&&max>0)line(svg,x(0),top-12,x(0),bottom,{stroke:'#788f9f','stroke-dasharray':'4 4'});
  rows.forEach((r,i)=>{const y=top+i*52+8;text(svg,left-8,y+4,r.label,{'text-anchor':'end','font-size':w<420?10:12});
    line(svg,x(r.low),y,x(r.high),y,{stroke:r.color,'stroke-width':2.5});
    for(const v of [r.low,r.high])line(svg,x(v),y-5,x(v),y+5,{stroke:r.color,'stroke-width':2});
    tip(svgEl('circle',{cx:x(r.value),cy:y,r:5.5,fill:r.color},svg),r.tip);
    text(svg,w-3,y+4,r.display||formatter(r.value),{'text-anchor':'end','font-size':11});});
  text(svg,(left+right)/2,h-3,axisLabel,{'text-anchor':'middle','font-size':11,fill:'#5c6d7a'});
}
function modelsView() {
  const m=source.models,visible=r=>state.modelSubject==='both'||r.subject===state.modelSubject;
  const subject=r=>r.subject==='Reading'?t('Reading'):t('Math');
  const probabilities=m.probabilities.filter(visible).map(r=>({
    label:`${subject(r)}: ${r.fall_group==='Fall Below'?t('Below'):t('Well Below')}`,
    value:r.probability,display:pct(r.probability,1),low:r.ci_low,high:r.ci_high,color:r.fall_group==='Fall Below'?'#227c77':'#326c9d',
    tip:`${r.subject} · ${r.fall_group}\n${pct(r.probability)}; 95% CI ${pct(r.ci_low)} to ${pct(r.ci_high)}`}));
  intervalChart('probability-chart',probabilities,0,1,v=>pct(v,0),t('Adjusted probability of remaining below in Spring'));
  const attendance=m.attendance.filter(visible).map(r=>({label:`${subject(r)}: ${r.model==='Model 2'?t('Adjusted'):t('Raw')}`,
    value:r.estimate,low:r.ci_low,high:r.ci_high,color:r.model==='Model 2'?'#227c77':'#9bafbf',
    tip:`${r.subject} · ${r.model}\n${r.estimate.toFixed(3)} points; 95% CI ${r.ci_low.toFixed(3)} to ${r.ci_high.toFixed(3)}\np=${r.p_value.toPrecision(3)}`}));
  intervalChart('adjusted-attendance-chart',attendance,-4,1,v=>v.toFixed(1),t('Score points per 5 percentage points more absence'));
  const samples=m.samples.filter(visible);
  byId('counts').innerHTML=countStrip(samples.map(r=>[r.fall_below_rows,`${subject(r)} ${t('Fall-below model rows')}`]));
  byId('model-summary').innerHTML=`<div class="summary-lines">${m.contrasts.filter(visible).map(r=>paragraph(
    `${r.subject}: the adjusted starting-group gap is ${r.difference_pp.toFixed(1)} percentage points (95% CI ${r.ci_low_pp.toFixed(1)} to ${r.ci_high_pp.toFixed(1)}; Holm-adjusted p < .001).`)).join('')}
    ${paragraph('The adjusted absence association is about -0.20 Reading points and -0.32 Math points per 5 percentage points more absence. Both are statistically significant, but small in score units. This does not establish absence as the largest influence or estimate the effect of an intervention.')}</div>`;
  byId('model-samples').innerHTML=paragraph(samples.map(r=>`${r.subject}: ${num(r.fall_below_rows)} paired Fall-below student-year rows from ${num(r.students)} students`).join('; ')+'.')+
    paragraph('Logistic analysis adjusts for school, grade and year, standardized to a common mix. Intervals account for repeated students. The comparison is exploratory and restricted to paired Fall-below records; it is not a future forecast. Fixed background-label sensitivity checks retain the main interpretation.')+
    paragraph('Primary OLS adjusts Fall score, school, grade and year, then adds between-test absence. Reading uses 3,653 rows from 1,780 students; Mathematics uses 3,606 rows from 1,779 students. Background labels enter a sensitivity check rather than the primary formula. No models are refitted by the display controls.');
  byId('school-model-table').innerHTML=`<table><thead><tr><th>${t('Subject / school')}</th><th class="num">${t('Points vs Cedar Ridge')}</th><th class="num">95% CI</th></tr></thead><tbody>${m.school_contrasts.filter(visible).map(r=>`<tr><td>${subject(r)} / ${esc(r.school.replace(' Elementary',''))}</td><td class="num">${r.estimate.toFixed(2)}</td><td class="num">${r.ci_low.toFixed(2)} ${t('to')} ${r.ci_high.toFixed(2)}</td></tr>`).join('')}</tbody></table>`;
  byId('takeaway').textContent=t('Starting severity identifies a large continuing-needs difference. Absence adds a small adjusted score association. School contrasts are small and uncertain. The briefing should focus on current learning support and coordinated attendance help, with principals confirming the roster and barriers.');
}
function modelSampleNotes(){
  byId('sample-notes').innerHTML=byId('model-samples').innerHTML+
    paragraph('Model values come from the completed notebook exports, not from the current descriptive school, year or grade filters. Pointwise school-contrast intervals all include zero; this is uncertainty, not proof that schools are equivalent. Read the notebook diagnostics and sensitivity review before making substantive claims.');
}

const pages=['context','learning','needs','attendance','models'];
const wording={
context:{question:['Who do the four schools serve?'],description:['Start with enrollment, grade mix, and recorded needs. These provide context for the learning comparisons that follow.'],qc:['Enrollment is unique by student and year. Student program labels are fixed across the extract.'],eda:['Schools grew in different directions, and their student profiles are not identical.'],next:['Check current enrollment and supports, then compare learning within grade and subject.']},
learning:{question:['Who improved their scores but remained below Benchmark?'],description:['Compare the same students at both tests, then keep their changes separate from the full Spring-tested snapshot.'],qc:['Test keys and dates are valid. Participation was reviewed before calculating paired change.'],eda:['Many paired Fall-below students remain below in Spring, even after gaining score points. Starting severity helps frame the follow-up.'],next:['Adjusted models in the notebook find small, uncertain school contrasts. Interpret school comparisons alongside starting points.']},
attendance:{question:['Where is absence concentrated, and what does it add to the learning picture?'],description:['Locate school-grade patterns, then compare absence and scores among complete pairs within the same grade and subject.'],qc:['Every expected enrolled instructional day has a record. Test dates define each attendance interval.'],eda:['Absence relates to Fall and Spring score levels. Its raw relationship with score change is much weaker.'],next:['Adjusted models in the notebook find a small absence association. The briefing discusses overlapping needs and attendance barriers.']} ,
needs:{question:['Where do learning and attendance needs overlap?'],description:['Count each enrolled student-year once, preserve incomplete information, and identify where support needs coincide.'],qc:['Both subject pairs link to one enrollment record. Missing pairs remain unknown.'],eda:['Across the four schools in 2025-26, all K-5: 618 students are identified in at least one subject, including 254 in both.'],next:['Check current rosters and academic supports, and coordinate attendance follow-up for overlapping needs.']},
models:{question:['What remains after allowing for starting points and school context?'],description:['Read the completed models alongside the descriptive patterns. These historical associations help frame follow-up questions.'],qc:['Models use checked paired records; repeated students are accounted for in uncertainty estimates.'],eda:['Positive score change can coexist with continuing below-Benchmark status; needs also overlap across subjects.'],next:['Prioritize learning support, starting severity and coordinated attendance help. Verify barriers with principals.']}
};
function render() {
  document.documentElement.lang='en';
  document.querySelectorAll('[data-en]').forEach(e=>{e.textContent=e.dataset.en;});
  for(const key of ['year','school','grade','subject'])byId(key).value=state[key];
  document.querySelector('.controls').hidden=state.page==='models';
  byId('grade-control').hidden=state.page==='context';byId('subject-control').hidden=['context','needs'].includes(state.page);
  document.querySelectorAll('[data-page]').forEach(e=>e.setAttribute('aria-selected',String(e.dataset.page===state.page)));byId('view').setAttribute('aria-labelledby',`tab-${state.page}`);
  const copy=wording[state.page];byId('question').textContent=t(...copy.question);byId('description').textContent=t(...copy.description);
  byId('reasoning').innerHTML=[['qc',t('From the quality checks')],['eda',t('What EDA showed')],['next',t('How this informs the briefing')]].map(([key,title])=>`<div><h2>${title}</h2><p>${t(...copy[key])}</p></div>`).join('');
  byId('scope').innerHTML=`<strong>${yr(state.year)}</strong> · ${state.school==='all'?t('Four-school comparison'):esc(shortSchool(state.school))}${state.page==='context'?'':` · ${t('Grade')} ${gradeName(state.grade)} · ${Number(state.subject)===0?t('Reading'):t('Mathematics')}`} · ${t(state.year==='all'?'Counts are student-year records.':'Counts refer to the selected school year.')}`;
  if(state.page==='models')byId('scope').textContent=t('2023-24 to 2025-26 · Four schools · K-5 · Fixed completed-model samples · 95% confidence intervals');
  if(state.page==='needs')byId('scope').textContent=`${yr(state.year)} · ${state.school==='all'?t('Four schools'):shortSchool(state.school)} · ${gradeName(state.grade)} · ${t('Both subjects; counts are student-years across years')}`;
  const contextControls=`<div class="counts" id="counts"></div>`;
  if(state.page==='context')byId('content').innerHTML=contextControls+`<div class="panels">${panel('enrollment-chart',t('School context over time'),t('All three years remain visible. Absence rates use total student-days.'),false,`<label class="mini-control">${t('Show')}<select id="trend"><option value="enrollment">${t('Enrollment')}</option><option value="absence">${t('Annual absence rate')}</option></select></label>`)}${panel('needs-chart',t('Recorded student needs'),t('Each flag has its own denominator. Categories overlap and do not add to 100%.'))}${panel('grade-chart',t('Grade composition'),t('A different grade mix can change the overall school score.'))}<section class="panel"><h2>${t('Selected school profile')}</h2><p class="note">${t('Click a school name to focus the view. Rates use total absent days / total enrolled instructional days.')}</p><div class="school-table" id="school-table"></div></section></div>`;
  if(state.page==='learning')byId('content').innerHTML=contextControls+`<div class="panels">${panel('paths-chart',t('Improvement and continuing need'),t('Two different denominators: paired Fall-below records, then records below in both windows. Positive change is not an expected-growth target.'),true)}<div class="panel wide path-counts" id="path-counts"></div>${panel('scores-chart',t('Same students, two testing points'),t('Fall and Spring medians use complete pairs within the selected grade.'))}${panel('change-chart',t('Observed individual score change'),t('Median of each student’s Spring minus Fall. No expected-growth standard is supplied.'))}${panel('status-chart',t('Spring benchmark categories'),t('The sample selector below affects this chart only. Hover for counts and percentages.'),true,`<label class="mini-control">${t('Status sample')}<select id="status-sample"><option value="spring">${t('All Spring-tested')}</option><option value="paired">${t('Fall-Spring pairs')}</option></select></label>`)}</div>`;
  if(state.page==='attendance')byId('content').innerHTML=contextControls+`<div class="panels"><section class="panel"><h2>${t('Find the school-grade pattern')}</h2><p class="note">${t('All schools and grades in the selected year. Click a cell to update the other charts.')}</p><div id="heatmap" class="heatmap"></div></section>${panel('scatter-chart',t('Attendance alongside learning'),t('Complete pairs in the selected grade and subject. Each dot is one student-year pair.'),false,`<label class="mini-control">${t('Compare absence with')}<select id="metric"><option value="fall">${t('Fall score')}</option><option value="spring">${t('Spring score')}</option><option value="change">${t('Spring minus Fall')}</option></select></label>`)}${panel('distribution-chart',t('How annual absence is distributed'),t('All enrolled records in the selected school, grade, and year. Bands are exploratory display categories.'))}<section class="panel"><h2>${t('Keep the two attendance periods separate')}</h2><p id="interval-note"></p><p class="note">${t('Annual attendance describes the enrolled year. Between-test attendance excludes both test days. Higher absence and lower scores together do not establish causation.')}</p></section></div>`;
  if(state.page==='needs')byId('content').innerHTML=contextControls+`<div class="panels">${panel('overlap-chart',t('Two-subject learning patterns'),t('Below in both Fall and Spring. Exclusive categories require both subjects to be complete; incomplete records remain visible.'),true)}${panel('needs-attendance-chart',t('Learning patterns and annual absence'),t('Includes any identified subject pattern, even if the other subject is incomplete. The 10% band is a display cutoff.'))}<section class="panel"><h2>${t('Support extends beyond the high-absence band')}</h2><div id="needs-attendance-note"></div>${paragraph('Verify the incoming roster, existing reading and math support, and attendance barriers with principals. Historical grade 5 students need a separate transition review; these counts are not a forecast.')}</section></div>`;
  if(state.page==='models')byId('content').innerHTML=`<label class="mini-control model-tools">${t('Show completed results for')}<select id="model-subject"><option value="both">${t('Both subjects')}</option><option value="Reading">${t('Reading')}</option><option value="Mathematics">${t('Mathematics')}</option></select></label>${contextControls}<div class="panel" id="model-summary"></div><div class="panels" style="margin-top:20px">${panel('probability-chart',t('Starting level and Spring status'),t('Logistic model: paired Fall-below students; school, grade and year standardized to a common mix. Bars show 95% CIs.'))}${panel('adjusted-attendance-chart',t('Raw and adjusted absence associations'),t('OLS: Spring score per 5 percentage points more between-test absence. Adjusted for Fall score, school, grade and year; 95% CIs.'))}<section class="panel"><h2>${t('School contrasts remain uncertain')}</h2><p class="note">${t('OLS Model 1; pointwise 95% CIs versus Cedar Ridge all include zero. This does not establish equivalence or support an effectiveness ranking.')}</p><div class="school-table" id="school-model-table"></div></section><section class="panel"><h2>${t('Who entered these models?')}</h2><div id="model-samples"></div></section><section class="panel wide"><h2>${t('What to ask principals next')}</h2><ol>
<li>${t('Verify who is returning. Use the historical K–4 group to check the incoming roster and existing support. Historical grade 5 students need a separate transition review.')}</li>
<li>${t('Prioritize students who started Well Below. Ask how progress is monitored and how support changes when progress is not enough. The roughly 97% probability describes the pooled historical model, not a forecast for returning students.')}</li>
<li>${t('Coordinate academic and attendance support where needs overlap. Also review students below the 10% annual-absence cutoff; attendance alone misses many identified academic needs.')}</li>
</ol></section></div>`;
  if(state.page==='context'){byId('trend').value=state.trend;contextView();}if(state.page==='learning'){byId('status-sample').value=state.statusSample;learningView();pathsChart();}if(state.page==='needs')needsView();if(state.page==='models'){byId('model-subject').value=state.modelSubject;modelsView();}if(state.page==='attendance'){byId('metric').value=state.metric;attendanceView();}
  if(state.page==='models')modelSampleNotes();else sampleNotes();byId('next-question').textContent=t(...copy.next);
  const nextLabels={context:['Explore learning'],learning:['See overlapping needs'],needs:['Explore attendance'],attendance:['Read adjusted results'],models:['Return to school context']};
  byId('next-page').textContent=t(...nextLabels[state.page]);
}
function sampleNotes() {
  const result=data.learning(selection({grade:state.page==='context'?'all':state.grade})),pairs=result.paired,usable=pairs.filter(r=>r.intervalDays>0&&r.intervalAbsent!==null);
  const rate=(a,b)=>b?`${num(a)} / ${num(b)} (${pct(a/b)})`:`${num(a)} / 0 (n/a)`;
  byId('sample-notes').innerHTML=`<p>${t('These counts follow the current school/year selection. On this page, the sample check uses')} ${state.page==='context'?t('all K-5 grades'):t('grade')+' '+gradeName(state.grade)} ${t('and')} ${Number(state.subject)===0?t('Reading'):t('Mathematics')}.</p><div class="school-table"><table class="sample-table"><tbody><tr><th>${t('Enrolled student-year records')}</th><td class="num">${num(result.rows.length)}</td></tr><tr><th>${t('Fall results / estimated opportunities')}</th><td class="num">${rate(result.fall.length,result.fallOpportunities)}</td></tr><tr><th>${t('Spring results / estimated opportunities')}</th><td class="num">${rate(result.spring.length,result.springOpportunities)}</td></tr><tr><th>${t('Complete pairs / estimated opportunities for both tests')}</th><td class="num">${rate(pairs.length,result.bothOpportunities)}</td></tr><tr><th>${t('Complete pairs / all enrolled records')}</th><td class="num">${rate(pairs.length,result.rows.length)}</td></tr><tr><th>${t('Usable attendance intervals / complete pairs')}</th><td class="num">${rate(usable.length,pairs.length)}</td></tr><tr><th>${t('Unique students with complete pairs')}</th><td class="num">${num(data.uniqueStudents(pairs))}</td></tr></tbody></table></div>`+
  paragraph('Opportunity is estimated from enrollment overlap with recorded test dates for each school-year-grade-subject-window. Official testing windows were not supplied. A missing result does not explain why the student did not test.')+
  paragraph('Annual absence = total absent days / total enrolled instructional days. Tardy counts as present. Test-interval absence uses days strictly between the student’s Fall and Spring dates. Records with undefined intervals are excluded from attendance-score plots.')+
  paragraph('Student program labels are fixed across this extract. Earlier-year grades do not identify the upcoming fall roster. With three annual observations, the enrollment view describes change, not a long-term forecast.')+
  paragraph('QC checked IDs, joins, dates, dictionary rules, and expected-day coverage. Fourteen employed teacher-year periods lack assignment records; staffing therefore remains a verification question outside these main views. These checks do not validate the extract against the original SIS.')+
  paragraph('The notebook contains a supporting state-test review: grade 5 literacy results recur at Lincoln Park and Meadowbrook. Those tested cohorts have moved on. Discipline and staffing remain context rather than the main dashboard story.');
}
for(const school of source.schools){const option=document.createElement('option');option.value=school[0];option.textContent=shortSchool(school[0]);byId('school').appendChild(option);}
for(const key of ['year','school','grade','subject'])byId(key).addEventListener('change',event=>{state[key]=event.target.value;render();});
byId('reset').addEventListener('click',()=>{Object.assign(state,{year:'2026',school:'all',grade:'0',subject:'0',metric:'spring',statusSample:'spring',trend:'enrollment'});render();});
byId('print').addEventListener('click',()=>window.print());
byId('next-page').addEventListener('click',()=>{state.page=pages[(pages.indexOf(state.page)+1)%pages.length];render();window.scrollTo({top:0,behavior:'instant'});});
document.querySelector('.nav').addEventListener('click',event=>{const tab=event.target.closest('[data-page]');if(tab){state.page=tab.dataset.page;render();}});
document.querySelector('.nav').addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const i=pages.indexOf(state.page);state.page=event.key==='Home'?pages[0]:event.key==='End'?pages[pages.length-1]:pages[(i+(event.key==='ArrowRight'?1:pages.length-1))%pages.length];render();byId(`tab-${state.page}`).focus();}});
byId('content').addEventListener('change',event=>{if(event.target.id==='model-subject')state.modelSubject=event.target.value;if(event.target.id==='trend')state.trend=event.target.value;if(event.target.id==='metric')state.metric=event.target.value;if(event.target.id==='status-sample')state.statusSample=event.target.value;render();});
byId('content').addEventListener('click',event=>{
  const cell=event.target.closest('[data-cell]'),school=event.target.closest('[data-school]'),save=event.target.closest('[data-save]');
  if(cell){const [school,grade]=cell.dataset.cell.split(',');state.school=school;state.grade=grade;render();byId('scope').scrollIntoView({block:'nearest'});}
  if(school){state.school=school.dataset.school;render();}
  if(save){
    const original=byId(save.dataset.save).querySelector('svg');if(!original)return;
    const panel=save.closest('.panel'),dimensions=original.viewBox.baseVal,width=dimensions.width+32;
    const exported=svgEl('svg',{xmlns:'http://www.w3.org/2000/svg',width,style:'font-family:Arial,sans-serif'});
    const background=svgEl('rect',{x:0,y:0,width,height:1000,fill:'white'},exported);
    let cursor=23;
    const measure=document.createElement('canvas').getContext('2d');
    function wrapped(value,size=12,fill='#5c6d7a'){
      measure.font=`${size}px Arial`;let lineText='';
      const words=value.split(/\s+/);
      for(const word of words){const candidate=lineText+(lineText?' ':'')+word;
        if(measure.measureText(candidate).width>width-42&&lineText){text(exported,16,cursor,lineText,{'font-size':size,fill});cursor+=size+6;lineText=word;}else lineText=candidate;}
      if(lineText){text(exported,16,cursor,lineText,{'font-size':size,fill});cursor+=size+8;}
    }
    wrapped(panel.querySelector('h2').textContent,17,'#16324a');
    wrapped(byId('scope').textContent,11);
    if(state.page==='models')wrapped(t('Displayed subject: ')+byId('model-subject').selectedOptions[0].textContent,11);
    if(save.dataset.save==='status-chart')wrapped(t('Status sample: ')+byId('status-sample').selectedOptions[0].textContent,11);
    if(save.dataset.save==='scatter-chart')wrapped(t('Score measure: ')+byId('metric').selectedOptions[0].textContent,11);
    if(save.dataset.save==='enrollment-chart')wrapped(t('Trend: ')+byId('trend').selectedOptions[0].textContent,11);
    wrapped(panel.querySelector('.note').textContent,11);
    const copied=original.cloneNode(true);copied.setAttribute('x','16');copied.setAttribute('y',cursor);exported.appendChild(copied);cursor+=dimensions.height+15;
    let legendX=16;
    for(const item of panel.querySelectorAll('.legend span')){
      const label=item.textContent,icon=item.querySelector('i');measure.font='11px Arial';const itemWidth=measure.measureText(label).width+32;
      if(legendX+itemWidth>width-16){legendX=16;cursor+=21;}
      svgEl('circle',{cx:legendX+5,cy:cursor-4,r:4,fill:icon.classList.contains('outline')?'white':icon.style.background||'#16324a',stroke:icon.classList.contains('outline')?'#16324a':'none','stroke-width':2},exported);
      text(exported,legendX+16,cursor,label,{'font-size':11,fill:'#5c6d7a'});legendX+=itemWidth;
    }
    cursor+=25;wrapped(state.page==='models'?t('Synthetic Fairmont data. Completed historical model; association does not establish intervention effects.'):t('Synthetic Fairmont data. Descriptive result; see the adjusted-results page for completed models.'),10);
    exported.setAttribute('height',cursor+8);exported.setAttribute('viewBox',`0 0 ${width} ${cursor+8}`);background.setAttribute('height',cursor+8);
    const blob=new Blob([new XMLSerializer().serializeToString(exported)],{type:'image/svg+xml'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;
    link.download=state.page==='models'?`Fairmont_models_${save.dataset.save}_2023-24_to_2025-26_${state.modelSubject}.svg`:`Fairmont_${state.page}_${save.dataset.save}_${state.year}_grade${state.page==='context'?'all':state.grade}_subject${state.subject}.svg`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
});
const tooltip=byId('tooltip');
document.addEventListener('pointermove',event=>{const target=event.target.closest('[data-tip]');if(!target){tooltip.hidden=true;return;}tooltip.textContent=target.getAttribute('data-tip');tooltip.hidden=false;tooltip.style.left=`${Math.max(8,Math.min(event.clientX+14,window.innerWidth-tooltip.offsetWidth-12))}px`;tooltip.style.top=`${Math.max(8,Math.min(event.clientY+12,window.innerHeight-tooltip.offsetHeight-12))}px`;});
document.addEventListener('focusin',event=>{const target=event.target.closest('[data-tip]');if(target){const rect=target.getBoundingClientRect();tooltip.textContent=target.getAttribute('data-tip');tooltip.hidden=false;tooltip.style.left=`${Math.max(8,Math.min(rect.left,window.innerWidth-tooltip.offsetWidth-12))}px`;tooltip.style.top=`${Math.min(rect.bottom+8,window.innerHeight-tooltip.offsetHeight-12)}px`;}});
document.addEventListener('focusout',()=>{tooltip.hidden=true;});document.addEventListener('keydown',event=>{if(event.key==='Escape')tooltip.hidden=true;});
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(render,120);});
render();
