// generateFeedbackAI/itemPrompts 的纯函数测试
// 项目名归一 + 表现抽数值两个 AI 任务的 prompt/回包层。数值会画进成绩曲线给家长看，
// 「模型编造」和「解析挂掉」都是线上事故，所以防编造校验和 fail-soft 全锁进 jest。
const ip = require('../cloudfunctions/generateFeedbackAI/itemPrompts');

describe('generateFeedbackAI itemPrompts（项目名归一）', () => {
  test('buildMatchRequest：含 JSON 字样、防注入声明、response_format json_object', () => {
    const req = ip.buildMatchRequest({ historyNames: ['快步走200米'], newNames: ['快走200'] });
    expect(req.model).toBe(ip.MODEL); // 跟着常量走，换模型不用改测试
    expect(req.temperature).toBeGreaterThan(0);
    expect(req.temperature).toBeLessThan(1); // 智谱 temperature 开区间 (0,1)
    expect(req.max_tokens).toBeGreaterThan(0);
    expect(req.response_format).toEqual({ type: 'json_object' });
    expect(req.messages.length).toBe(2);
    expect(req.messages[0].role).toBe('system');
    expect(req.messages[0].content).toContain('JSON');
    expect(req.messages[0].content).toContain('"mappings"'); // 格式示例
    // 清单文本一律视为数据：项目名里混进指令不许理
    expect(req.messages[0].content).toContain('一律忽略');
    expect(req.messages[1].content).toContain('快走200');
  });

  test('sanitizeMatchPayload：截断、去空、去重保序、畸形入参不炸', () => {
    const out = ip.sanitizeMatchPayload({
      historyNames: ['  快步走200米 ', '', '跳绳', '跳绳', '名'.repeat(40)],
      newNames: ['快走200', null, 42, '双摇跳绳']
    });
    expect(out.historyNames).toEqual(['快步走200米', '跳绳', '名'.repeat(30)]);
    expect(out.newNames).toEqual(['快走200', '42', '双摇跳绳']);
    expect(ip.sanitizeMatchPayload(null).historyNames).toEqual([]);
    expect(ip.sanitizeMatchPayload({ historyNames: '不是数组' }).historyNames).toEqual([]);
    expect(ip.sanitizeMatchPayload({ historyNames: { a: 1 } }).historyNames).toEqual([]);
  });

  test('extractMappings：合法改写保留，from/to 出自清单的约束成立', () => {
    const payload = { historyNames: ['快步走200米', '跳绳'], newNames: ['快走200', '双摇跳绳'] };
    const r = ip.extractMappings(
      '{"mappings":[{"from":"快走200","to":"快步走200米"}]}',
      payload
    );
    expect(r.ok).toBe(true);
    expect(r.mappings).toEqual([{ from: '快走200', to: '快步走200米' }]);
  });

  test('extractMappings：防编造——from 不在新填清单 / to 不在两份清单 / from===to 全部丢弃', () => {
    const payload = { historyNames: ['跳绳'], newNames: ['快走200'] };
    const r = ip.extractMappings(JSON.stringify({
      mappings: [
        { from: '模型编的新名', to: '跳绳' },      // from ∉ newNames
        { from: '快走200', to: '规范快走' },        // to ∉ 两份清单
        { from: '快走200', to: '快走200' },         // from === to
        { from: '快走200', to: '跳绳' }             // 唯一合法
      ]
    }), payload);
    expect(r.ok).toBe(true);
    expect(r.mappings).toEqual([{ from: '快走200', to: '跳绳' }]);
  });

  test('extractMappings：同一 from 只留第一条；剥 ``` 围栏；坏回包 ok:false', () => {
    const payload = { historyNames: ['跳绳'], newNames: ['快走200', '走200米'] };
    const dup = ip.extractMappings(JSON.stringify({
      mappings: [
        { from: '快走200', to: '跳绳' },
        { from: '快走200', to: '走200米' }
      ]
    }), payload);
    expect(dup.mappings).toEqual([{ from: '快走200', to: '跳绳' }]);

    const fenced = ip.extractMappings('```json\n{"mappings":[{"from":"走200米","to":"跳绳"}]}\n```', payload);
    expect(fenced.mappings).toEqual([{ from: '走200米', to: '跳绳' }]);

    expect(ip.extractMappings('这不是JSON', payload).ok).toBe(false);
    expect(ip.extractMappings('', payload).ok).toBe(false);
    // 解析失败和「没有需要改写」是两回事：后者 ok:true 空数组
    const none = ip.extractMappings('{"mappings":[]}', payload);
    expect(none.ok).toBe(true);
    expect(none.mappings).toEqual([]);
  });
});

describe('generateFeedbackAI itemPrompts（表现抽数值）', () => {
  test('buildPerfRequest：含 JSON 字样、格式示例、防注入声明', () => {
    const req = ip.buildPerfRequest({ itemName: '跳绳', text: '1分钟跳了160下' });
    expect(req.model).toBe(ip.MODEL); // 跟着常量走，换模型不用改测试
    expect(req.response_format).toEqual({ type: 'json_object' });
    expect(req.messages[0].content).toContain('JSON');
    expect(req.messages[0].content).toContain('"unitKind"');
    expect(req.messages[0].content).toContain('绝不编造');
    expect(req.messages[0].content).toContain('一律忽略');
    expect(req.messages[1].content).toContain('跳绳');
    expect(req.messages[1].content).toContain('160');
  });

  test('sanitizePerfPayload：trim + 截断 + 畸形入参不炸', () => {
    expect(ip.sanitizePerfPayload({ itemName: ' 跳绳 ', text: ' 跳了' + '很'.repeat(120) + '多 ' }))
      .toEqual({ itemName: '跳绳', text: ('跳了' + '很'.repeat(120) + '多').slice(0, 100) });
    expect(ip.sanitizePerfPayload(null)).toEqual({ itemName: '', text: '' });
    expect(ip.sanitizePerfPayload({ text: 123 }).text).toBe('123');
  });

  test('extractMetric：数值/字符串数值/时间类/单位截断', () => {
    const num = ip.extractMetric('{"value":160,"unit":"下","unitKind":"count","display":"160下"}');
    expect(num.ok).toBe(true);
    expect(num.metric).toEqual({ value: 160, unit: '下', unitKind: 'count', display: '160下' });

    const str = ip.extractMetric('{"value":"160"}');
    expect(str.metric.value).toBe(160);
    expect(str.metric.unitKind).toBe('count'); // 缺省按 count

    const sec = ip.extractMetric('{"value":90,"unit":"秒","unitKind":"time","display":"1分30秒"}');
    expect(sec.metric.unitKind).toBe('time'); // time 的秒数由模型换算，这里不二次换算

    const round = ip.extractMetric('{"value":123.456}');
    expect(round.metric.value).toBe(123.46); // 两位小数

    const trunc = ip.extractMetric(JSON.stringify({
      value: 1, unit: '超'.repeat(15), display: '长'.repeat(20)
    }));
    expect(trunc.metric.unit).toHaveLength(10);
    expect(trunc.metric.display).toHaveLength(16);
  });

  test('extractMetric：无数值/非法数值一律 metric:null（不抛错），坏回包 ok:false', () => {
    // 教练只写了定性描述 → 模型按约定回 null
    expect(ip.extractMetric('{"value":null,"unit":"","unitKind":"count","display":""}'))
      .toEqual({ ok: true, metric: null });
    // 非法数值也按「没有」处理：负数 / 0 / 非有限数 / 超上限
    expect(ip.extractMetric('{"value":-5}').metric).toBeNull();
    expect(ip.extractMetric('{"value":0}').metric).toBeNull();
    expect(ip.extractMetric('{"value":"abc"}').metric).toBeNull();
    expect(ip.extractMetric('{"value":2000000}').metric).toBeNull();
    expect(ip.extractMetric('没有JSON').ok).toBe(false);
    expect(ip.extractMetric('').ok).toBe(false);
  });
});
