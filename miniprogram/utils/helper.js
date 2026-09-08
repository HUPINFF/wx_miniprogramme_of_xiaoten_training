/**
 * 工具函数集合
 * 从各页面提取的纯函数，不依赖小程序环境，方便测试
 */

/**
 * 格式化日期为 YYYY-MM-DD
 * @param {Date|string} date
 * @returns {string}
 */
function formatTime(date) {
  if (!date) return '';
  try {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (error) {
    return '';
  }
}

/**
 * 解析运动成绩原始值为可计算的数值
 * @param {*} value - 原始值（数字或字符串，如 "3分20秒"）
 * @param {string} sportKey - 运动项目标识
 * @returns {number|null}
 */
function parsePerformanceValue(value, sportKey) {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    if (sportKey === 'standingLongJump') {
      return value / 100;
    }
    return value;
  }

  if (typeof value === 'string') {
    // 800米： "3分20秒" → 3 + 20/60 = 3.33
    if (sportKey === 'eightHundredMeter' && value.includes('分')) {
      const parts = value.split('分');
      const minutes = parseFloat(parts[0]) || 0;
      let seconds = 0;
      if (parts[1]) {
        const secMatch = parts[1].match(/(\d+)/);
        seconds = secMatch ? parseFloat(secMatch[1]) : 0;
      }
      return minutes + seconds / 60;
    }

    // 1000米： "5分10秒" → 5*60 + 10 = 310
    if (sportKey === 'thousandMeter' && value.includes('分')) {
      const parts = value.split('分');
      const minutes = parseFloat(parts[0]) || 0;
      let seconds = 0;
      if (parts[1]) {
        const secMatch = parts[1].match(/(\d+)/);
        seconds = secMatch ? parseFloat(secMatch[1]) : 0;
      }
      return minutes * 60 + seconds;
    }

    // 通用：提取字符串中的数字
    const match = value.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const numValue = parseFloat(match[0]);
      if (sportKey === 'standingLongJump') {
        return numValue / 100;
      }
      return numValue;
    }
    return null;
  }

  return null;
}

/**
 * 格式化运动成绩为显示字符串
 * @param {number} value
 * @param {string} sportKey
 * @param {Array} sportItems - 运动项目配置列表
 * @returns {string}
 */
function formatPerformanceValue(value, sportKey, sportItems) {
  if (value === null || value === undefined) return '';

  if (sportKey === 'eightHundredMeter') {
    const minutes = Math.floor(value);
    const seconds = Math.round((value - minutes) * 60);
    return minutes + "'" + seconds + '"';
  }

  if (sportKey === 'thousandMeter') {
    const minutes = Math.floor(value / 60);
    const seconds = Math.round(value % 60);
    return minutes + "'" + seconds + '"';
  }

  const sport = (sportItems || []).find(function (item) { return item.key === sportKey; });
  return value.toFixed(1) + (sport ? sport.unit : '');
}

/**
 * 获取运动项目的显示名称
 * @param {string} sportKey
 * @param {Array} sportItems
 * @returns {string}
 */
function getSportName(sportKey, sportItems) {
  const sport = (sportItems || []).find(function (item) { return item.key === sportKey; });
  return sport ? sport.name : '';
}

/**
 * 按状态分类预约列表
 * @param {Array} appointments
 * @returns {{ pending: Array, approved: Array, rejected: Array, completed: Array }}
 */
function classifyAppointments(appointments) {
  const result = {
    pending: [],
    approved: [],
    rejected: [],
    completed: []
  };

  (appointments || []).forEach(function (item) {
    switch (item.status) {
      case 'pending':
        result.pending.push(item);
        break;
      case 'approved':
        result.approved.push(item);
        break;
      case 'rejected':
        result.rejected.push(item);
        break;
      case 'completed':
        result.completed.push(item);
        break;
    }
  });

  return result;
}

module.exports = {
  formatTime,
  parsePerformanceValue,
  formatPerformanceValue,
  getSportName,
  classifyAppointments
};
