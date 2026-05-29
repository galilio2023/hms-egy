import { COMBINED_PATTERN_AR, PREFIX_PATTERN_EN, MENTION_PATTERN } from './src/lib/utils/anonymization';

function getGroupCount(re: RegExp): number {
  return new RegExp(re.source + '|').exec('')!.length - 1;
}

console.log('COMBINED_PATTERN_AR groups:', getGroupCount(COMBINED_PATTERN_AR));
console.log('PREFIX_PATTERN_EN groups:', getGroupCount(PREFIX_PATTERN_EN));
console.log('MENTION_PATTERN groups:', getGroupCount(MENTION_PATTERN));
