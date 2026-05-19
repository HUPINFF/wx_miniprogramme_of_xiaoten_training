// pages/users/book-coach/index.js
const DEMO_COACHES = [
  {
    _id: 'demo_1',
    name: '肖文欣',
    avatarUrl: '',
    bio: '资深私人教练，擅长减脂塑形与体态调整',
    rank: 'PT2',
    certificates: 4,
    totalClasses: 286,
    price: 240,
    trialPrice: 69,
    gender: '女',
    tags: ['减脂', '增肌', '塑形', '美臀', '体能', '拉伸', '康复']
  },
  {
    _id: 'demo_2',
    name: '张浩然',
    avatarUrl: '',
    bio: 'PT3认证教练，专注增肌训练与运动康复',
    rank: 'PT3',
    certificates: 6,
    totalClasses: 512,
    price: 299,
    trialPrice: 69,
    gender: '男',
    tags: ['增肌', '体能', '康复', '拉伸']
  },
  {
    _id: 'demo_3',
    name: '林雨桐',
    avatarUrl: '',
    bio: '擅长女性减脂塑形与产后恢复训练',
    rank: 'PT2',
    certificates: 3,
    totalClasses: 198,
    price: 220,
    trialPrice: 69,
    gender: '女',
    tags: ['减脂', '塑形', '拉伸', '康复']
  },
  {
    _id: 'demo_4',
    name: '王俊杰',
    avatarUrl: '',
    bio: '体能训练专家，帮助学员突破运动瓶颈',
    rank: 'PT2',
    certificates: 5,
    totalClasses: 367,
    price: 260,
    trialPrice: 69,
    gender: '男',
    tags: ['增肌', '减脂', '体能', '康复']
  },
  {
    _id: 'demo_5',
    name: '陈思琪',
    avatarUrl: '',
    bio: 'PT3高级教练，十年教学经验，主攻美臀塑形',
    rank: 'PT3',
    certificates: 7,
    totalClasses: 624,
    price: 320,
    trialPrice: 69,
    gender: '女',
    tags: ['减脂', '塑形', '美臀', '体能', '拉伸']
  },
  {
    _id: 'demo_6',
    name: '刘子轩',
    avatarUrl: '',
    bio: '新生代教练，亲和力强，专注于入门学员指导',
    rank: 'PT1',
    certificates: 2,
    totalClasses: 89,
    price: 180,
    trialPrice: 49,
    gender: '男',
    tags: ['减脂', '增肌', '体能']
  }
];

Page({
  data: {
    coaches: [],
    filteredCoaches: [],
    loading: true,
    statusBarHeight: 44,
    viewMode: 'grid',
    avatarPlaceholder: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 260'%3E%3Crect fill='%23e8f1ed' width='200' height='260'/%3E%3Ccircle fill='%23cbd5e1' cx='100' cy='90' r='40'/%3E%3Cpath fill='%23cbd5e1' d='M40 220 Q100 160 160 220Z'/%3E%3C/svg%3E",
  },

  onLoad() {
    const windowInfo = wx.getWindowInfo();
    this.setData({
      statusBarHeight: windowInfo.statusBarHeight || 44
    });
    this.loadCoaches();
  },

  loadCoaches() {
    this.setData({ loading: true });

    wx.cloud.database().collection('users')
      .where({ role: 'coach' })
      .get()
      .then(res => {
        const raw = res.data;
        if (raw && raw.length > 0) {
          const enriched = raw.map(c => this.enrichCoach(c));
          this.setData({
            coaches: enriched,
            filteredCoaches: enriched,
            loading: false
          });
        } else {
          this.useDemoData();
        }
      })
      .catch(() => {
        this.useDemoData();
      });
  },

  enrichCoach(c) {
    return {
      ...c,
      rank: c.rank || 'PT2',
      certificates: c.certificates || Math.floor(Math.random() * 3) + 2,
      totalClasses: c.totalClasses || Math.floor(Math.random() * 300) + 50,
      price: c.price || 240,
      trialPrice: c.trialPrice || 69,
      tags: Array.isArray(c.tags) && c.tags.length ? c.tags : ['减脂', '增肌', '塑形'],
      gender: c.gender || '男'
    };
  },

  useDemoData() {
    this.setData({
      coaches: DEMO_COACHES,
      filteredCoaches: DEMO_COACHES,
      loading: false
    });
  },

  // ==================== 导航 ====================

  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.switchTab({ url: '/pages/users/home/index' });
    }
  },

  viewCoachDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (id) {
      wx.navigateTo({
        url: `/pages/users/coach-detail/index?id=${id}`,
        fail: () => {
          wx.showToast({ title: '页面跳转失败', icon: 'none' });
        }
      });
    }
  },

  bookCoach(e) {
    const id = e.currentTarget.dataset.id;
    if (id) {
      wx.navigateTo({
        url: `/pages/users/coach-detail/index?id=${id}`,
        fail: () => {
          wx.showToast({ title: '页面跳转失败', icon: 'none' });
        }
      });
    }
  },

  // ==================== 视图切换 ====================

  switchView(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode !== this.data.viewMode) {
      this.setData({ viewMode: mode });
    }
  },

  // ==================== 视图切换 ====================
});
