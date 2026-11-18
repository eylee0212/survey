'use strict';
// index.html 안의 <script id="survey-core"> 블록을 꺼내 화면 없이 실행한다.
// 배포되는 코드를 그대로 시험하기 위해서다.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const htmlPath = path.join(__dirname, '..', 'index.html');

function readHtml() {
  return fs.readFileSync(htmlPath, 'utf8');
}

function loadCore() {
  const html = readHtml();
  const m = html.match(/<script id="survey-core">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('index.html에 survey-core 블록이 없습니다');
  // 화면 객체(window, document)를 주지 않아 계산 로직이 DOM에 기대지 않는지도 확인된다.
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(m[1] + '\n;this.SurveyCore = SurveyCore;', sandbox);
  // vm 안에서 만든 배열·객체는 프로토타입이 달라 assert.deepStrictEqual에서 어긋난다.
  // 결과는 모두 JSON으로 나타낼 수 있으므로 복사해 돌려준다.
  const inner = sandbox.SurveyCore;
  const outer = {};
  for (const key of Object.keys(inner)) {
    outer[key] = (...args) => {
      const r = inner[key](...args);
      return r === undefined ? r : JSON.parse(JSON.stringify(r));
    };
  }
  return outer;
}

module.exports = { loadCore, readHtml };
