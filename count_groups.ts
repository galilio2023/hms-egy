import * as fs from 'fs';

const content = fs.readFileSync('src/lib/utils/anonymization.ts', 'utf8');

function countGroups(regexStr: string): number {
  let count = 0;
  for (let i = 0; i < regexStr.length; i++) {
    if (regexStr[i] === '(' && regexStr[i+1] !== '?') {
      count++;
    }
  }
  return count;
}

// We need to evaluate the strings to get the final regex string.
// Since I can't easily import the internal variables, I'll just check the patterns in the file.

const patterns = [
  'COMBINED_PATTERN_AR',
  'PREFIX_PATTERN_EN',
  'MENTION_PATTERN'
];

patterns.forEach(p => {
  const match = content.match(new RegExp('const ' + p + ' = new RegExp\\(\\s*`([\\s\\S]+?)`'));
  if (match) {
    console.log(p + ' groups:', countGroups(match[1]));
  }
});
