/**
 * 会话与权限封装
 *
 * 这是项目里唯一碰 wx.storage 的权限层，页面只 require 这一个模块即可。
 * storage 是同步 API，所以这里全部同步返回，页面无需 await。
 *
 * 角色模型：users.role 只有 'user'（家长）/ 'coach'（教练）；
 * 管理员的 role 也是 'coach'，靠 isAdmin 布尔字段区分。
 */

const { ENTRY, HOME, readIsAdmin, resolveLoginEntry, coachScopeOf, hasGlobalScope, canViewChild } = require('./helper');

/** storage 键集中在此，避免字面量散落各页 */
const K = {
  TOKEN: 'token',
  OPENID: 'openid',
  ROLE: 'userRole',
  INFO: 'userInfo',
  COACH: 'coachInfo',
  IS_ADMIN: 'isAdmin',
  ENTRY: 'entry'
};

function getOpenid() {
  return wx.getStorageSync(K.OPENID) || '';
}

function isLoggedIn() {
  return !!wx.getStorageSync(K.TOKEN);
}

/** 登录页选中的入口：'user' | 'coach' | 'admin' */
function getEntry() {
  return wx.getStorageSync(K.ENTRY) || wx.getStorageSync(K.ROLE) || ENTRY.USER;
}

/** 读的是缓存，可能过期（在控制台改了 isAdmin 但没重登）。管理页另有服务端兜底校验 */
function isAdmin() {
  return wx.getStorageSync(K.IS_ADMIN) === true;
}

/** 当前登录教练/管理员的 users 记录，缺失返回 null */
function getCurrentCoach() {
  const c = wx.getStorageSync(K.COACH);
  return (c && c._id) ? c : null;
}

function getCoachId() {
  const c = getCurrentCoach();
  return c ? c._id : null;
}

/**
 * 登录成功后一次性落盘会话
 *
 * 顺手写 coachInfo——登录时本来就已经查到整条 users 记录，零额外请求，
 * 同时修掉 performance/weekly 页裸读 coachInfo 导致崩溃的问题。
 *
 * @param {object} user - 数据库里的 users 记录
 * @param {string} [entry] - 登录页选中的入口
 */
function cacheSession(user, entry) {
  wx.setStorageSync(K.COACH, user);
  wx.setStorageSync(K.ROLE, user.role);
  // 走 readIsAdmin 而不是直接读 user.isAdmin：控制台手填的字段名可能带空格
  wx.setStorageSync(K.IS_ADMIN, readIsAdmin(user));
  wx.setStorageSync(K.ENTRY, entry || user.role);
  wx.setStorageSync(K.TOKEN, 'logged_in');
}

/** 登出统一清理，含 isAdmin/entry，防止换号后底栏串味 */
function clearSession() {
  [K.TOKEN, K.INFO, K.OPENID, K.ROLE, K.COACH, K.IS_ADMIN, K.ENTRY]
    .forEach(k => wx.removeStorageSync(k));
}

/**
 * 页面用：一行拿到当前可见范围，直接展开进 where()
 * @param {{allForAdmin?:boolean}} [options] - 传 { allForAdmin: true } 表示 admin 可看全部
 */
function coachScope(options) {
  return coachScopeOf(getCoachId(), isAdmin(), options);
}

/** 当前是否处于全局视野，供页面做 UI 分支 */
function globalScope(options) {
  return hasGlobalScope(isAdmin(), options);
}

/** 可见范围是否可用（替代各页手写的 if(!coachId) return） */
function isScopeReady(options) {
  return globalScope(options) || !!getCoachId();
}

/**
 * 拦下之后统一从这里走：提示 + 退回上一页
 *
 * 延时的 1.5s 是为了让 toast 看得见。
 * 页面栈只有一层时 navigateBack 会静默失败——从「转发」点进来的页面正是这种情况，
 * 不兜的话用户会卡在一个空白页上。工作台不是 tabBar 页，所以用 reLaunch 而不是 switchTab。
 *
 * @param {string} message - 提示文案
 */
function denyAndLeave(message) {
  wx.showToast({ title: message, icon: 'none' });
  setTimeout(() => {
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({ url: HOME.COACH });
    }
  }, 1500);
}

/**
 * 校验参数里的 childId 是否属于当前教练；不属于就提示并退回上一页
 *
 * 页面 onLoad 里从 options 拿到 childId 后，**必须先过这里再拉数据或允许写入**。
 * 判定规则和「为什么刻意不给管理员开绿灯」见 helper.canViewChild 的注释。
 *
 * ⚠️ 这是前端拦截，只治标：它挡的是改 URL 参数、转发链接、以及传错 id 这类情况，
 *    挡不住拿 openid 直接调数据库接口。真正的修复是收紧云开发安全规则。
 *
 * 用法：
 *   auth.guardChildAccess(childId).then(ok => { if (ok) this.loadXxx(childId); });
 *
 * @param {string} childId
 * @returns {Promise<boolean>} true = 放行；false = 已提示并退回，调用方直接 return
 */
function guardChildAccess(childId) {
  if (!childId) {
    denyAndLeave('缺少学员参数');
    return Promise.resolve(false);
  }

  return wx.cloud.database().collection('children').doc(childId).get()
    .then(res => {
      if (canViewChild(res.data, getCoachId())) return true;

      console.warn('越权访问学员数据，已拦截 childId =', childId);
      denyAndLeave('无权查看该学员');
      return false;
    })
    .catch(err => {
      // 查不到（id 不存在）也走这里，一律不放行
      console.error('学员归属校验失败', err);
      denyAndLeave('学员不存在或无权查看');
      return false;
    });
}

module.exports = {
  K,
  getOpenid,
  isLoggedIn,
  getEntry,
  isAdmin,
  getCurrentCoach,
  getCoachId,
  cacheSession,
  clearSession,
  coachScope,
  globalScope,
  isScopeReady,
  guardChildAccess,
  denyAndLeave,
  // 透传纯函数，页面只 require 一个模块
  ENTRY,
  HOME,
  readIsAdmin,
  resolveLoginEntry,
  canViewChild
};
