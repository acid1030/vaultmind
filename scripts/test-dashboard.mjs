import assert from 'node:assert/strict';
import { dailyCounts, itemTags, tagDistribution } from '../ui/src/lib/dashboard.ts';
const now = new Date('2026-11-10T12:00:00+08:00');
assert.deepEqual(dailyCounts([], now), [0,0,0,0,0,0,0]);
assert.deepEqual(dailyCounts(['invalid', '2026-11-11T00:00:00+08:00', '2026-11-10T11:00:00+08:00', '2026-11-04T12:00:00+08:00', '2026-11-03T12:00:00+08:00'], now), [1,0,0,0,0,0,1]);
assert.deepEqual(itemTags('["安全","安全",null,7," 文档 "]'), ['安全','文档']);
assert.deepEqual(itemTags('安全，文档 安全'), ['安全','文档']);
assert.deepEqual(tagDistribution([{tags:'安全,安全'},{tags:'安全,文档'}]), [{label:'安全',count:2},{label:'文档',count:1}]);
console.log('Dashboard data tests passed: true daily counts, invalid/future dates, unique per-item tags and distribution.');
