import assert from 'node:assert/strict';
import { projectStatus } from '../ui/src/lib/projectStatus.ts';
assert.deepEqual(projectStatus('## main...origin/main [ahead 1]\n M file with spaces.ts\n?? new.txt\nR  old -> new\n', 'git'), {branch:'main...origin/main [ahead 1]', files:[{status:'M',path:'file with spaces.ts'},{status:'??',path:'new.txt'},{status:'R',path:'old -> new'}]});
assert.deepEqual(projectStatus('## No commits yet on main\n', 'git').files, []);
assert.deepEqual(projectStatus('M       notes.txt\n?       new file.txt\n', 'svn').files, [{status:'M',path:'notes.txt'},{status:'?',path:'new file.txt'}]);
assert.deepEqual(projectStatus('fatal: not a git repository', 'git').files, []);
console.log('Project status display parsing passed.');
