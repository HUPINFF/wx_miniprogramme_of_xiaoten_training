// cloudfunctions/sendSubscribe/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { openid, templateId, page, data } = event;
  
  try {
    const result = await cloud.openapi.subscribeMessage.send({
      touser: openid,
      templateId: templateId,
      page: page || 'pages/users/home/index',
      data: data,
      miniprogramState: 'formal'  // 开发版用developer，正式版改formal
    });
    return { success: true, result };
  } catch (err) {
    console.error('发送订阅消息失败', err);
    return { success: false, error: err };
  }
};