export class Fairmont {
  constructor(data) {
    this.schools = data.schools;
    this.context = data.context.map(r => ({record:r[0], student:r[1], school:r[2], year:r[3], grade:r[4], el:r[5], econ:r[6], sped:r[7], days:r[8], absent:r[9], entry:r[10], exit:r[11]}));
    this.pairs = data.pairs.map(r => ({...this.context[r[0]], subject:r[1], fall:r[2], spring:r[3], fallLevel:r[4], springLevel:r[5], intervalDays:r[6], intervalAbsent:r[7], fallOpportunity:r[8], springOpportunity:r[9]}));
  }
  matches(r, s) {
    return (s.year==='all'||r.year===Number(s.year)) && (s.school==='all'||r.school===Number(s.school)) && (s.grade==='all'||r.grade===Number(s.grade));
  }
  contextRows(s) {return this.context.filter(r=>this.matches(r,s));}
  pairRows(s) {return this.pairs.filter(r=>this.matches(r,s)&&r.subject===Number(s.subject));}
  uniqueStudents(rows) {return new Set(rows.map(r=>r.student)).size;}
  sum(rows, key) {return rows.reduce((a,r)=>a+(Number(r[key])||0),0);}
  absence(rows) {const days=this.sum(rows,'days');return days>0?this.sum(rows,'absent')/days:null;}
  mean(values) {return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;}
  quantile(values, p) {if(!values.length)return null;const a=[...values].sort((x,y)=>x-y),i=(a.length-1)*p,lo=Math.floor(i);return a[lo]+(a[Math.ceil(i)]-a[lo])*(i-lo);}
  median(values) {return this.quantile(values,0.5);}
  learning(s) {
    const rows=this.pairRows(s),fall=rows.filter(r=>r.fall!==null),spring=rows.filter(r=>r.spring!==null),paired=rows.filter(r=>r.fall!==null&&r.spring!==null);
    return {rows,fall,spring,paired,fallOpportunities:rows.filter(r=>r.fallOpportunity===1).length,springOpportunities:rows.filter(r=>r.springOpportunity===1).length,bothOpportunities:rows.filter(r=>r.fallOpportunity===1&&r.springOpportunity===1).length,springAtAbove:spring.length?spring.filter(r=>r.springLevel>=2).length/spring.length:null};
  }
  learningPaths(s) {
    const paired=this.learning(s).paired.filter(r=>r.fallLevel!==null&&r.springLevel!==null);
    const fallBelow=paired.filter(r=>r.fallLevel<2);
    const persistent=fallBelow.filter(r=>r.springLevel<2);
    return {paired:paired.length,fallBelow:fallBelow.length,persistent:persistent.length,
      reached:fallBelow.length-persistent.length,
      positiveAmongPersistent:persistent.filter(r=>r.spring>r.fall).length,
      medianPersistentChange:this.median(persistent.map(r=>r.spring-r.fall))};
  }
  learningNeeds(s) {
    const contexts=this.contextRows(s),byRecord=new Map();
    for(const r of this.pairs){
      if(!byRecord.has(r.record))byRecord.set(r.record,new Map());
      byRecord.get(r.record).set(r.subject,r);
    }
    const counts=[0,0,0,0,0];let knownAny=0,highAbsence=0,lowerAbsence=0,unknownAttendance=0;
    for(const c of contexts){
      const subjects=byRecord.get(c.record)||new Map();
      const status=subject=>{
        const r=subjects.get(subject);
        if(!r||r.fall===null||r.spring===null||r.fallLevel===null||r.springLevel===null)return null;
        return r.fallLevel<2&&r.springLevel<2;
      };
      const reading=status(0),math=status(1);
      const category=reading===null||math===null?4:reading&&math?0:reading?1:math?2:3;
      counts[category]++;
      // One complete subject can identify a need even if the other is incomplete.
      if(reading===true||math===true){
        knownAny++;
        if(!(c.days>0)||c.absent===null)unknownAttendance++;
        else if(c.absent/c.days>=.10)highAbsence++;
        else lowerAbsence++;
      }
    }
    return {enrolled:contexts.length,counts,knownAny,highAbsence,lowerAbsence,unknownAttendance};
  }
  ranks(values) {
    const ordered=values.map((v,i)=>({v,i})).sort((a,b)=>a.v-b.v),ranks=Array(values.length);let start=0;
    while(start<ordered.length){let end=start+1;while(end<ordered.length&&ordered[end].v===ordered[start].v)end++;const rank=(start+1+end)/2;for(let k=start;k<end;k++)ranks[ordered[k].i]=rank;start=end;}return ranks;
  }
  spearman(x,y) {
    if(x.length<3||x.length!==y.length)return null;
    const a=this.ranks(x),b=this.ranks(y),ma=this.mean(a),mb=this.mean(b);let numerator=0,va=0,vb=0;
    for(let i=0;i<a.length;i++){const dx=a[i]-ma,dy=b[i]-mb;numerator+=dx*dy;va+=dx*dx;vb+=dy*dy;}return va>0&&vb>0?numerator/Math.sqrt(va*vb):null;
  }
}
