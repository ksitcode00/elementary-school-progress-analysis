import assert from 'node:assert/strict';
import {Fairmont} from './dashboard_core.js';

// Double-counting cross-subject needs or treating missing Math as 'no need'
// would change these hand-counted totals.
const fixture={schools:[[101,'A'],[102,'B']],context:[
 [0,0,101,2026,0,0,0,0,100,10],
 [1,1,101,2026,1,0,0,0,100,5],
 [2,2,101,2026,0,0,0,0,100,5],
 [3,3,102,2026,1,0,0,0,100,20],
 [4,4,102,2026,0,0,0,0,100,0],
 [5,5,102,2025,0,0,0,0,0,0]],pairs:[
 [0,0,0,10,0,1,80,2,1,1],[0,1,20,30,1,1,80,2,1,1],
 [1,0,20,25,1,1,80,2,1,1],[1,1,20,30,2,2,80,2,1,1],
 [2,0,40,50,2,2,80,2,1,1],[2,1,30,20,1,0,80,2,1,1],
 [3,0,20,25,1,1,80,2,1,1],[3,1,null,30,null,1,null,null,0,1],
 [4,0,40,50,2,2,80,2,1,1],[4,1,40,50,2,2,80,2,1,1]]};
const f=new Fairmont(fixture),s={year:'all',school:'all',grade:'all',subject:'0'};
assert.equal(typeof f.learningPaths,'function','Learning paths are not implemented');
const reading=f.learningPaths(s);
assert.equal(reading.paired,5);assert.equal(reading.fallBelow,3);
assert.equal(reading.persistent,3);assert.equal(reading.positiveAmongPersistent,3);
assert.equal(reading.reached,0);assert.equal(reading.medianPersistentChange,5);
const math=f.learningPaths({...s,subject:'1'});
assert.equal(math.persistent,2);assert.equal(math.positiveAmongPersistent,1);
assert.equal(f.learningPaths({...s,school:'102'}).fallBelow,1);
assert.equal(typeof f.learningNeeds,'function','Joint learning needs are not implemented');
const needs=f.learningNeeds(s);
assert.deepEqual(needs.counts,[1,1,1,1,2]);
assert.equal(needs.enrolled,6);assert.equal(needs.knownAny,4);
assert.equal(needs.highAbsence,2);assert.equal(needs.lowerAbsence,2);assert.equal(needs.unknownAttendance,0);
assert.deepEqual(f.learningNeeds({...s,year:'2026',school:'102'}).counts,[0,0,0,1,1]);
assert.equal(f.learningNeeds({...s,year:'2026',school:'102'}).knownAny,1);
fixture.context[3][8]=0;
const missingDays=new Fairmont(fixture).learningNeeds(s);
assert.equal(missingDays.unknownAttendance,1);assert.equal(missingDays.highAbsence,1);
const noRecords=f.learningPaths({...s,year:'2024'});
assert.equal(noRecords.persistent,0);assert.equal(noRecords.medianPersistentChange,null);
console.log('PASS: paths, cross-subject overlap, partial information, filters, zero scores and annual-absence denominators');
