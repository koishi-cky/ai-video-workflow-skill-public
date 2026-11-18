(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SceneState = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const SEQUENCE = [
    { t: 0, text: '' },
    { t: 0.35, text: '开发一个' },
    { t: 0.55, text: '开发一个 AI 文案工具' },
    { t: 0.95, text: '开发一个 AI 文案工具，支持用户' },
    { t: 1.15, text: '开发一个 AI 文案工具，支持用户输入需求' },
    { t: 1.48, text: '开发一个 AI 文案工具，支持用户输入需求，生成' },
    { t: 1.75, text: '开发一个 AI 文案工具，支持用户输入需求，生成不同平台的文案' }
  ];

  function textAt(time) {
    for (let i = SEQUENCE.length - 1; i >= 0; i -= 1) {
      if (time >= SEQUENCE[i].t) return SEQUENCE[i].text;
    }
    return '';
  }

  function stageAt(time) {
    if (time < 1.1) return 'establish';
    if (time < 2.0) return 'focus';
    if (time < 4.55) return 'input';
    if (time < 5.45) return 'submitted';
    if (time < 6.3) return 'processing';
    if (time < 8.3) return 'result';
    return 'hold';
  }

  return { SEQUENCE, textAt, stageAt };
});
