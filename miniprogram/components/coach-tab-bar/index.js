// components/coach-tab-bar/index.js
// 教练端底部 tab：原生 tabBar 只能有一份且已被家长端 4 个 tab 占满（上限 5 项），
// 所以教练端用页面内 fixed 组件实现。
//
// 管理端复用同一套底栏，只在中间多插一个「管理」tab（仅 isAdmin 可见）。

const auth = require('../../utils/auth');

const TAB_WORKBENCH = {
  key: 'workbench',
  text: '工作台',
  icon: '/images_1/workbench.png',
  activeIcon: '/images_1/workbench_active.png',
  url: '/pages/coach/workbench/index'
};

const TAB_SCHEDULE = {
  key: 'schedule',
  text: '今日课',
  icon: '/images_1/schedule.png',
  activeIcon: '/images_1/schedule_active.png',
  url: '/pages/coach/schedule/index'
};

// images_1/ 下没有管理端图标，先用 emoji 顶上，零资源依赖即可上线。
// 补了 admin.png / admin_active.png 后，把 emoji 换成 icon/activeIcon 两个字段即可，
// wxml 已有分支，不用改。
const TAB_ADMIN = {
  key: 'admin',
  text: '管理',
  emoji: '🛠',
  url: '/pages/admin/dashboard/index'
};

const TAB_PROFILE = {
  key: 'profile',
  text: '我的',
  icon: '/images_1/my.png',
  activeIcon: '/images_1/my_active.png',
  url: '/pages/coach/profile/index'
};

/** 全部可能的 tab，用于按路由反推当前项（必须包含管理 tab） */
const ALL_TABS = [TAB_WORKBENCH, TAB_SCHEDULE, TAB_ADMIN, TAB_PROFILE];

/** 普通教练 3 项；管理员 4 项 */
function buildTabs(isAdmin) {
  return isAdmin
    ? [TAB_WORKBENCH, TAB_SCHEDULE, TAB_ADMIN, TAB_PROFILE]
    : [TAB_WORKBENCH, TAB_SCHEDULE, TAB_PROFILE];
}

Component({
  properties: {
    // 当前激活项：'workbench' | 'schedule' | 'admin' | 'profile'
    current: { type: String, value: '' }
  },

  data: { tabs: buildTabs(false) },

  lifetimes: {
    attached() {
      this.refreshTabs();
      // 兜底：页面漏传 current 时按当前路由推导
      if (this.data.current) return;
      const hit = ALL_TABS.find(t => t.url === this.getCurrentRoute());
      if (hit) this.setData({ current: hit.key });
    }
  },

  // 每次页面 show 都重算：在「我的」页回写 isAdmin 缓存后，管理 tab 会自动补上
  pageLifetimes: {
    show() {
      this.refreshTabs();
    }
  },

  methods: {
    refreshTabs() {
      const tabs = buildTabs(auth.isAdmin());
      // 数量没变说明 admin 状态没变，跳过 setData 避免每次 show 都重建列表
      if (tabs.length === this.data.tabs.length) return;
      this.setData({ tabs });
    },

    getCurrentRoute() {
      const pages = getCurrentPages();
      return pages.length ? `/${pages[pages.length - 1].route}` : '';
    },

    onTap(e) {
      const key = e.currentTarget.dataset.key;
      if (!key) return;
      const hit = this.data.tabs.find(t => t.key === key);
      if (!hit) return;

      // 已经是当前 tab：绝不 reLaunch（否则整页重建 + 白屏闪烁）
      // 双重判断：prop 命中（快路径）+ 实际路由命中（对 prop 失同步免疫）
      if (key === this.data.current || this.getCurrentRoute() === hit.url) {
        wx.pageScrollTo({ scrollTop: 0, duration: 200 });
        return;
      }

      // 这些页面都不是 tabBar 页，必须 reLaunch 清栈。
      // navigateTo 会无限堆栈；switchTab 只对 tabBar 页有效，会直接 fail。
      wx.reLaunch({ url: hit.url });
    }
  }
});
