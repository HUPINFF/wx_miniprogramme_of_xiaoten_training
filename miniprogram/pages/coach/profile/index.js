// pages/coach/profile/index.js — 教练端「我的」
// 结构对齐 pages/users/profile/index.js（信息卡 + 分组菜单 + 退出登录）
const auth = require('../../../utils/auth');
const db = wx.cloud.database();

// 项目里没有 miniprogram/images/ 目录，coach-card 内置的 '/images/default-avatar.png'
// 兜底是死链；这里统一补云端默认头像（同 pages/coach/children/list/index.wxml:23）
const DEFAULT_AVATAR = 'cloud://hupin255-5gfbw856b1c861ef.6875-hupin255-5gfbw856b1c861ef-1410552194/default_avatar/6756593ba0eb6a537f7060da8ede3ca8.jpeg';

const MENU_GROUPS = [
  {
    title: '教学管理',
    items: [
      { icon: '👥', title: '学员管理', url: '/pages/coach/children/list/index' },
      { icon: '📅', title: '预约审批', url: '/pages/coach/appointments/index' },
      { icon: '📊', title: '周表现录入', url: '/pages/coach/performance/weekly/index' },
      { icon: '💬', title: '训练反馈', url: '/pages/coach/feedback/list/index' },
      { icon: '📝', title: '训练记录', url: '/pages/coach/trainings/list/index' }
    ]
  },
  {
    title: '内容与评价',
    items: [
      { icon: '📚', title: '课程管理', url: '/pages/coach/course-manage/index' },
      { icon: '🗂', title: '内容管理', url: '/pages/coach/content-manage/index' },
      { icon: '⭐', title: '家长点评', url: '/pages/coach/all-comments/index' },
      { icon: '🚀', title: '学员成长记录', url: '/pages/coach/all-growth/index' },
      { icon: '🔄', title: '更换教练申请', url: '/pages/coach/change-coach-requests/index' }
    ]
  }
];

Page({
  data: {
    coachInfo: {},
    menuGroups: MENU_GROUPS,
    loading: true
  },

  onLoad() {
    this.loadCoachInfo();
  },

  loadCoachInfo() {
    // 先用缓存快速上屏（coachInfo 缓存键已在多处使用）
    const cached = wx.getStorageSync('coachInfo');
    if (cached && cached._id) this.setData({ coachInfo: cached, loading: false });

    return db.collection('users').where({
      _openid: wx.getStorageSync('openid'),
      role: 'coach'
    }).get().then(res => {
      if (!res.data.length) {
        this.setData({ loading: false });
        return;
      }
      const coachInfo = { ...res.data[0] };
      if (!coachInfo.avatarUrl) coachInfo.avatarUrl = DEFAULT_AVATAR;
      wx.setStorageSync('coachInfo', coachInfo);
      // 顺手把服务端的 isAdmin 同步回缓存：在控制台改完权限后，
      // 访问一次「我的」即可生效，底栏的管理 tab 会自动补上
      wx.setStorageSync('isAdmin', auth.readIsAdmin(coachInfo));
      this.setData({ coachInfo, loading: false });
    }).catch(err => {
      console.error('加载教练信息失败', err);
      this.setData({ loading: false });
    });
  },

  // coach-card 保存后回传最新教练信息
  onCoachUpdate(e) {
    const { coachInfo } = e.detail;
    if (coachInfo) this.setData({ coachInfo });
  },

  onMenuTap(e) {
    const { url } = e.currentTarget.dataset;
    if (url) wx.navigateTo({ url });
  },

  // 与 pages/users/profile/index.js 一致，统一走 auth.clearSession
  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (!res.confirm) return;
        // clearSession 比原来多清 isAdmin / entry，否则换账号后底栏会串味
        auth.clearSession();
        wx.reLaunch({ url: '/pages/common/login/index' });
      }
    });
  }
});
