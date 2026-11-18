'use strict';
// index.html 안의 <script id="game-core"> 블록을 꺼내 화면 없이 실행한다.
// 배포되는 코드를 그대로 시험하기 위해서다.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const htmlPath = path.join(__dirname, '..', 'index.html');

function readHtml() {
  return fs.readFileSync(htmlPath, 'utf8');
}

function loadCore() {
  const m = readHtml().match(/<script id="game-core">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('index.html에 game-core 블록이 없습니다');
  // window·document를 주지 않으므로 로직이 화면에 기대면 여기서 실패한다.
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(m[1] + '\n;this.GameCore = GameCore;', sandbox);
  // vm 안의 배열·객체는 프로토타입이 달라 deepStrictEqual에서 어긋나므로 JSON으로 복사해 돌려준다.
  const inner = sandbox.GameCore;
  const outer = {};
  for (const key of Object.keys(inner)) {
    const v = inner[key];
    outer[key] = typeof v !== 'function' ? v : (...args) => {
      const r = v(...JSON.parse(JSON.stringify(args)));
      return r === undefined ? r : JSON.parse(JSON.stringify(r));
    };
  }
  return outer;
}

module.exports = { loadCore, readHtml };
