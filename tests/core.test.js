'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCore } = require('./load-core');

const core = loadCore();

// 결과에서 표에 보이는 값만 뽑는다.
function table(text) {
  return core.summarize(text).questions.map(q => [q.name, q.valid, q.average, q.blank, q.excluded]);
}

test('계산 로직은 DOM 없이 실행된다', () => {
  assert.equal(typeof core.summarize, 'function');
});

test('칸 판정: 1~5만 유효, 앞뒤 공백은 지운다', () => {
  for (const v of ['1', '2', '3', '4', '5', ' 3', '4 ', '\t5\t', ' 1 ', ' 2　']) {
    assert.equal(core.classifyCell(v).kind, 'valid', JSON.stringify(v));
  }
  assert.equal(core.classifyCell(' 3 ').value, 3);
});

test('칸 판정: 비었거나 공백뿐이면 빈 응답', () => {
  for (const v of ['', ' ', '   ', '　', undefined]) {
    assert.equal(core.classifyCell(v).kind, 'blank', JSON.stringify(v));
  }
});

test('칸 판정: 그 밖의 값은 제외', () => {
  for (const v of ['0', '6', '10', '3.0', '3.5', '-1', '+3', '03', '１', '3점', 'N/A', '3 4', 'abc', '"3"']) {
    assert.equal(core.classifyCell(v).kind, 'excluded', JSON.stringify(v));
  }
});

test('평균: 소수 셋째 자리에서 반올림해 둘째 자리까지', () => {
  assert.equal(core.formatAverage(0, 0), '-');
  assert.equal(core.formatAverage(9, 3), '3.00');
  assert.equal(core.formatAverage(10, 3), '3.33'); // 3.333…
  assert.equal(core.formatAverage(11, 3), '3.67'); // 3.666…
  assert.equal(core.formatAverage(7, 2), '3.50');
  assert.equal(core.formatAverage(5, 1), '5.00');
  assert.equal(core.formatAverage(1, 1), '1.00');
  // 셋째 자리가 정확히 5면 올린다: 2.675 → 2.68 (부동소수점이면 2.67이 되기 쉽다)
  assert.equal(core.formatAverage(107, 40), '2.68');
  // 1.005 → 1.01
  assert.equal(core.formatAverage(201, 200), '1.01');
  // 4.995 → 5.00
  assert.equal(core.formatAverage(999, 200), '5.00');
  // 1.125 → 1.13
  assert.equal(core.formatAverage(9, 8), '1.13');
  // 1.124 → 1.12
  assert.equal(core.formatAverage(281, 250), '1.12');
});

test('기본 집계: 첫 열은 집계하지 않는다', () => {
  const text = [
    '응답번호\t만족도\t추천',
    '1\t5\t4',
    '2\t3\t2',
    '3\t4\t5',
  ].join('\r\n') + '\r\n';
  assert.deepEqual(table(text), [
    ['만족도', 3, '4.00', 0, 0],
    ['추천', 3, '3.67', 0, 0],
  ]);
  assert.equal(core.summarize(text).responseRows, 3);
});

test('유효·빈 응답·제외가 섞인 경우', () => {
  const text = [
    '번호\tQ1\tQ2\tQ3',
    '1\t5\t \tabc',
    '2\t 4 \t\t3',
    '3\t6\t2\t',
    '4\t3.0\t1\t１',
  ].join('\n');
  assert.deepEqual(table(text), [
    ['Q1', 2, '4.50', 0, 2],
    ['Q2', 2, '1.50', 2, 0],
    ['Q3', 1, '3.00', 1, 2],
  ]);
});

test('유효 응답이 0이면 평균은 "-"', () => {
  const text = '번호\tQ1\tQ2\n1\t\tx\n2\t \t0\n';
  assert.deepEqual(table(text), [
    ['Q1', 0, '-', 2, 0],
    ['Q2', 0, '-', 0, 2],
  ]);
});

test('칸이 모자란 줄은 모자란 칸을 빈 응답으로 센다', () => {
  const text = '번호\tQ1\tQ2\tQ3\n1\t5\n2\t4\t3\n3\n';
  assert.deepEqual(table(text), [
    ['Q1', 2, '4.50', 1, 0],
    ['Q2', 1, '3.00', 2, 0],
    ['Q3', 0, '-', 3, 0],
  ]);
  const s = core.summarize(text);
  assert.equal(s.shortRows, 3); // 세 줄 모두 4칸보다 적다
  assert.equal(s.responseRows, 3);
});

test('칸이 넘치는 줄은 넘치는 칸을 집계하지 않는다', () => {
  const text = '번호\tQ1\n1\t5\t1\t1\n2\t3\n';
  assert.deepEqual(table(text), [['Q1', 2, '4.00', 0, 0]]);
  assert.equal(core.summarize(text).longRows, 1);
});

test('끝의 빈 줄은 버리고, 중간의 빈 줄은 모자란 줄로 센다', () => {
  const text = '번호\tQ1\tQ2\n1\t5\t5\n\n2\t3\t3\n\n\n';
  const s = core.summarize(text);
  assert.equal(s.responseRows, 3);
  assert.equal(s.emptyRows, 1);
  assert.deepEqual(table(text), [
    ['Q1', 2, '4.00', 1, 0],
    ['Q2', 2, '4.00', 1, 0],
  ]);
});

test('줄바꿈 \\r\\n, \\n, \\r 모두 처리한다', () => {
  const expected = [['Q1', 2, '3.00', 0, 0]];
  assert.deepEqual(table('번호\tQ1\r\n1\t2\r\n2\t4\r\n'), expected);
  assert.deepEqual(table('번호\tQ1\n1\t2\n2\t4\n'), expected);
  assert.deepEqual(table('번호\tQ1\r1\t2\r2\t4\r'), expected);
});

test('엑셀 따옴표 칸: 칸 안의 줄바꿈·탭이 줄을 나누지 않는다', () => {
  const text = '번호\tQ1\tQ2\n1\t"여러\n줄"\t5\n2\t"a\tb"\t4\n3\t"say ""hi"""\t3\n';
  const rows = core.parseTable(text);
  assert.equal(rows.length, 4);
  assert.equal(rows[1][1], '여러\n줄');
  assert.equal(rows[2][1], 'a\tb');
  assert.equal(rows[3][1], 'say "hi"');
  assert.deepEqual(table(text), [
    ['Q1', 0, '-', 0, 3],
    ['Q2', 3, '4.00', 0, 0],
  ]);
});

test('문항 이름은 앞뒤 공백을 지우고, 비면 (N열)로 표시한다', () => {
  const text = '번호\t 만족 \t\tQ3\n1\t1\t2\t3\n';
  assert.deepEqual(core.summarize(text).questions.map(q => q.name), ['만족', '(3열)', 'Q3']);
});

test('응답 줄이 없으면 모두 0, 평균 "-"', () => {
  const s = core.summarize('번호\tQ1\tQ2\r\n');
  assert.equal(s.responseRows, 0);
  assert.deepEqual(table('번호\tQ1\tQ2\r\n'), [
    ['Q1', 0, '-', 0, 0],
    ['Q2', 0, '-', 0, 0],
  ]);
});

test('빈 입력·머리글이 한 칸뿐이면 문항이 없다', () => {
  assert.deepEqual(core.summarize('').questions, []);
  assert.deepEqual(core.summarize('\n\n').questions, []);
  assert.deepEqual(core.summarize('응답번호\n1\n2\n').questions, []);
  assert.deepEqual(core.summarize(null).questions, []);
});

test('응답 번호 열의 값은 결과에 영향이 없다', () => {
  const a = table('번호\tQ1\n1\t5\n2\t3\n');
  const b = table('번호\tQ1\nx\t5\n\t3\n');
  assert.deepEqual(a, b);
});

test('많은 줄도 정확히 센다', () => {
  const lines = ['번호\tQ1'];
  for (let i = 1; i <= 1000; i++) lines.push(i + '\t' + ((i % 5) + 1));
  // 1~5가 각각 200번: 합 3000, 평균 3.00
  assert.deepEqual(table(lines.join('\n')), [['Q1', 1000, '3.00', 0, 0]]);
});
