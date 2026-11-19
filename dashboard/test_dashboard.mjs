import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

const corePath = path.join(import.meta.dirname, 'dashboard_core.js');
assert.ok(fs.existsSync(corePath), 'Dashboard calculations have not been implemented yet');
const {Fairmont} = await import(pathToFileURL(corePath));
// Two enrollment lengths catch averaging percentages instead of student-days.
const data = {
  schools: [[101,'Cedar Ridge Elementary'],[102,'Harper Creek Elementary']],
  context: [
    [0,0,101,2026,0,1,0,0,10,2,0,0],
    [1,1,101,2026,0,0,1,0,100,0,0,0],
    [2,0,102,2025,1,1,0,0,100,10,0,0],
  ],
  pairs: [
    [0,0,0,20,0,2,8,1,1,1],
    [1,0,null,40,null,3,null,null,0,1],
    [2,0,10,null,1,null,null,null,1,0],
  ],
};
const f = new Fairmont(data);
const selection = {year:2026,school:'all',grade:0,subject:0};
const context = f.contextRows(selection);
assert.equal(context.length,2,'A year filter must exclude earlier records');
assert.equal(f.absence(context),2/110,'Absence must use enrolled days, not mean student rates');
assert.equal(f.uniqueStudents(f.contextRows({year:'all',school:'all',grade:'all'})),2,'Repeated students must not be counted twice as unique people');
const learning=f.learning(selection);
assert.equal(learning.fall.length,1,'A score of zero is an observed score');
assert.equal(learning.spring.length,2,'Spring-tested sample must retain students without Fall');
assert.equal(learning.paired.length,1,'Change must exclude incomplete pairs');
assert.equal(learning.springAtAbove,1,'All Spring results form the benchmark-status denominator');
assert.equal(f.median(learning.paired.map(r=>r.spring-r.fall)),20);
assert.equal(f.spearman([1,1,2],[2,2,1]),-1,'Spearman must use average ranks for ties');
assert.equal(f.spearman([1,1],[2,3]),null,'A constant variable cannot have a defined correlation');
assert.equal(f.absence([]),null,'An empty denominator must stay undefined');
assert.equal(f.learning({...selection,school:102}).spring.length,0,'No-data school selections must remain empty');
console.log('PASS: weighted rates, year/school filters, repeated students, tested/paired samples, zero scores, and tied ranks');
