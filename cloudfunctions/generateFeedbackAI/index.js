/**
 * 云函数 generateFeedbackAI：课后反馈 AI 文案
 *
 * 小程序端（coach/post-class 页「✨ AI 生成」按钮）→ 这里 → 智谱 GLM-4-Flash。
 * 走云函数中转的原因：API key 只存云函数环境变量（控制台配置），不进小程序代码；
 * 服务端出站请求也不受小程序 request 域名白名单约束。
 *
 * 用 Node 内置 https（云函数 Node 16 无全局 fetch），不引 axios——依赖越少，云端安装越稳。
 * 所有失败都返回 { success:false, code }，前端按 code 出提示并回落模板文案，教练永不被卡住。
 */

const cloud = require('wx-server-sdk');
const https = require('https');
const pb = require('./promptBuilder');
const ip = require('./itemPrompts');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const ZHIPU_HOST = 'open.bigmodel.cn';
const ZHIPU_PATH = '/api/paas/v4/chat/completions';
// AI 请求最多占 10s。真正的天花板不是函数 60s 上限，而是小程序端 callFunction 约 15s 的
// 客户端等待（不可配置）：预算超过它，慢请求会被客户端先掐断，TIMEOUT 错误码永远到不了前端。
// 10s = 15s 减去冷启动（1-3s）与回包开销；GLM-4-Flash 常态 2-8s，极少截断正常生成。
const REQUEST_TIMEOUT_MS = 10000;

/** POST 智谱 chat/completions。resolve { statusCode, bodyText }；网络/超时 reject { code } */
function callZhipu(requestBody, apiKey) {
  return new Promise(function (resolve, reject) {
    const bodyText = JSON.stringify(requestBody);
    const req = https.request({
      hostname: ZHIPU_HOST,
      path: ZHIPU_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'Content-Length': Buffer.byteLength(bodyText)
      }
    }, function (res) {
      // 不设编码时 data 是 Buffer，逐 chunk += 会把跨包拆开的多字节汉字各自解成 U+FFFD 乱码
      // （JSON.parse 照样成功，乱码文案会静默发给教练/家长）——setEncoding 让 Node 按整体解码
      res.setEncoding('utf8');
      let chunks = '';
      res.on('data', function (c) { chunks += c; });
      res.on('end', function () { resolve({ statusCode: res.statusCode, bodyText: chunks }); });
      // 响应头已收到后连接中断：req 的 error 不触发、res end 也不来，不监听这条 promise 永不
      // settle，云函数会挂到 60s 被强杀——必须补 res 自己的 error 监听（对正常回包无害）
      res.on('error', function () { reject({ code: 'NETWORK' }); });
    });
    req.on('error', function (err) {
      reject({ code: 'NETWORK', message: err && err.message });
    });
    req.setTimeout(REQUEST_TIMEOUT_MS, function () {
      // destroy 会顺带触发上面的 error 事件，但对已 reject 的 promise 是无害的空操作
      req.destroy();
      reject({ code: 'TIMEOUT' });
    });
    req.write(bodyText);
    req.end();
  });
}

/**
 * 智谱的错误是双轨的：HTTP 状态码 + 包在 HTTP 200 里的 body.error.code。
 * 未知码一律落 UPSTREAM_ERROR——处理策略不硬依赖具体码值，前端统一回落模板。
 */
function mapUpstreamError(statusCode, body) {
  const raw = body && body.error && body.error.code;
  const n = typeof raw === 'string' ? parseInt(raw, 10) : raw;
  if (statusCode === 401 || n === 401 || n === 1002) return 'AUTH_FAILED';
  if (statusCode === 429 || n === 429 || n === 1003 || n === 1004) return 'RATE_LIMITED';
  if (n === 1301 || n === 1302 || n === 1303) return 'CONTENT_BLOCKED';
  return 'UPSTREAM_ERROR';
}

exports.main = async (event) => {
  // 任务分发：默认 feedback（课后反馈文案，原流程不动）；另承载训练项目两个小任务——
  // 共用同一个 API key / 超时 / 错误码映射，客户端少部署少配一个函数
  const task = (event && event.task) || 'feedback';
  if (task === 'matchNames' || task === 'parsePerformance') {
    return runItemTask(task, event && event.payload);
  }
  try {
    // 1) 密钥在云开发控制台 → 云函数 → generateFeedbackAI → 配置 → 环境变量里配
    const apiKey = process.env.ZHIPU_API_KEY;
    if (!apiKey) {
      console.error('[generateFeedbackAI] 缺少环境变量 ZHIPU_API_KEY');
      return { success: false, code: 'NO_API_KEY' };
    }

    // 2) 白名单清洗 + 校验（客户端多传的字段在这里被丢弃）
    const payload = pb.sanitizePayload(event && event.payload);
    const check = pb.validatePayload(payload);
    if (!check.ok) {
      return { success: false, code: 'BAD_PAYLOAD', error: check.error };
    }

    // 3) 调智谱
    const result = await callZhipu(pb.buildChatRequest(payload), apiKey);

    let body = null;
    try { body = JSON.parse(result.bodyText); } catch (e) { body = null; }

    // 4) 成功：choices[0].message.content 里的 JSON → 两版文案
    if (result.statusCode === 200 && body && !body.error) {
      const content = body.choices && body.choices[0] &&
        body.choices[0].message && body.choices[0].message.content;
      const parsed = pb.extractJson(content);
      if (parsed.ok) {
        return {
          success: true,
          parentVersion: parsed.parentVersion,
          momentsVersion: parsed.momentsVersion,
          model: pb.MODEL
        };
      }
      // 原文落日志（截 500 字）方便线上排查，不打密钥、不打全文
      console.error('[generateFeedbackAI] 回包 JSON 解析失败，原文前 500 字：',
        String(content || result.bodyText || '').slice(0, 500));
      return { success: false, code: 'BAD_JSON' };
    }

    // 5) 上游报错：映射成稳定错误码
    const code = mapUpstreamError(result.statusCode, body);
    console.error('[generateFeedbackAI] 上游错误', code, 'HTTP', result.statusCode,
      '摘要：', String(result.bodyText || '').slice(0, 200));
    return { success: false, code: code };
  } catch (err) {
    // callZhipu reject 的 { code:'TIMEOUT'|'NETWORK' }，或本函数内的意外异常
    const raw = (err && err.code) || '';
    const code = (raw === 'TIMEOUT' || raw === 'NETWORK') ? raw : 'UPSTREAM_ERROR';
    console.error('[generateFeedbackAI] 异常', code, err && err.message);
    return { success: false, code: code };
  }
};

/**
 * 训练项目两任务（matchNames / parsePerformance）的共用执行体。
 * 结构与 feedback 流程同构：洗白 → 调智谱 → 防编造解析 → 稳定错误码。
 * 客户端对这两个任务一律 fail-open（AI 挂了按原名保存/只显文字），错误码只进日志。
 */
async function runItemTask(task, rawPayload) {
  try {
    const apiKey = process.env.ZHIPU_API_KEY;
    if (!apiKey) {
      console.error('[generateFeedbackAI:' + task + '] 缺少环境变量 ZHIPU_API_KEY');
      return { success: false, code: 'NO_API_KEY' };
    }

    const clean = task === 'matchNames'
      ? ip.sanitizeMatchPayload(rawPayload)
      : ip.sanitizePerfPayload(rawPayload);
    const request = task === 'matchNames'
      ? ip.buildMatchRequest(clean)
      : ip.buildPerfRequest(clean);

    const result = await callZhipu(request, apiKey);

    let body = null;
    try { body = JSON.parse(result.bodyText); } catch (e) { body = null; }

    if (result.statusCode === 200 && body && !body.error) {
      const content = body.choices && body.choices[0] &&
        body.choices[0].message && body.choices[0].message.content;
      // 模型原文也落一条（截300字）：校验后结果为空时，能区分「模型弃权」和
      // 「模型输出了但被防编造校验丢弃」（如 to 多了空格/自创规范名）
      console.log('[generateFeedbackAI:' + task + '] 模型原文', String(content || '').slice(0, 300));
      const parsed = task === 'matchNames'
        ? ip.extractMappings(content, clean)
        : ip.extractMetric(content);
      // 归一/抽数值的结果不落库、用完即弃，云函数日志是唯一能看到 AI 判了什么的地方——
      // 入参和结果各打一条（内容只有项目名与表现文字，无敏感信息）
      console.log('[generateFeedbackAI:' + task + '] 入参', JSON.stringify(clean));
      console.log('[generateFeedbackAI:' + task + '] 结果', JSON.stringify(parsed.ok ?
        (task === 'matchNames' ? parsed.mappings : parsed.metric) : { code: 'BAD_JSON' }));
      if (parsed.ok) {
        return task === 'matchNames'
          ? { success: true, task: task, mappings: parsed.mappings, model: pb.MODEL }
          : { success: true, task: task, metric: parsed.metric, model: pb.MODEL };
      }
      console.error('[generateFeedbackAI:' + task + '] 回包 JSON 解析失败，原文前 500 字：',
        String(content || result.bodyText || '').slice(0, 500));
      return { success: false, code: 'BAD_JSON' };
    }

    const code = mapUpstreamError(result.statusCode, body);
    console.error('[generateFeedbackAI:' + task + '] 上游错误', code, 'HTTP', result.statusCode,
      '摘要：', String(result.bodyText || '').slice(0, 200));
    return { success: false, code: code };
  } catch (err) {
    const raw = (err && err.code) || '';
    const code = (raw === 'TIMEOUT' || raw === 'NETWORK') ? raw : 'UPSTREAM_ERROR';
    console.error('[generateFeedbackAI:' + task + '] 异常', code, err && err.message);
    return { success: false, code: code };
  }
}
