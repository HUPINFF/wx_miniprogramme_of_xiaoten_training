// pages/admin/coaches/index.js — 教练列表（仅 isAdmin 可见）
//
// 这里是管理端「看到全部学员」的入口：每位教练可展开，按教练分组列出其名下学员。
// 之所以不做成一张扁平的「全部学员」列表，是因为小程序端单次查询上限 20 条，
// 全量扁平列表需要分页 + 服务端搜索 + 所属教练映射，成本约等于多做一个页面；
// 分组视图既能看全，又顺带给出了「谁的学员课时快用完了」。

const auth = require('../../../utils/auth');
const { fetchAll } = require('../../../utils/db');
const { getWeekRange, readIsAdmin } = require('../../../utils/helper');

const LOW_HOURS = 5;   // 与 pages/coach/children/detail 保持一致
const BATCH_SIZE = 5;  // wx.request 并发上限 10，每批 2 个请求，按 5 个教练一批推进

Page({
  data: {
    loading: true,
    coaches: [],
    weekRangeText: ''
  },

  onLoad() {
    this.assertAdmin().then(me => {
      if (me) this.loadCoaches();
    });
  },

  onPullDownRefresh() {
    this.loadCoaches().then(() => wx.stopPullDownRefresh());
  },

  /** 服务端兜底鉴权，同驾驶舱 */
  assertAdmin() {
    const db = wx.cloud.database();
    return db.collection('users')
      .where({ _openid: auth.getOpenid() })
      .get()
      .then(res => {
        const me = res.data[0];
        if (!me || !readIsAdmin(me)) {
          wx.showModal({
            title: '无权限',
            content: '您没有管理员权限',
            showCancel: false,
            success: () => wx.reLaunch({ url: '/pages/coach/workbench/index' })
          });
          return null;
        }
        auth.cacheSession(me, 'admin');
        return me;
      })
      .catch(err => {
        console.error('鉴权失败', err);
        wx.showToast({ title: '网络异常', icon: 'none' });
        return null;
      });
  },

  loadCoaches() {
    const db = wx.cloud.database();
    const week = getWeekRange();

    this.setData({ loading: true });

    // users.where({role:'coach'}) 单次也只有 20 条，必须分页
    return fetchAll(db.collection('users').where({ role: 'coach' }))
      .then(list => {
        const coaches = list.map(c => ({
          _id: c._id,
          // doRegister 只写了 nickName，name 常为空
          name: c.nickName || c.name || '未命名教练',
          avatarUrl: c.avatarUrl || '',
          phone: c.phone || '',
          isAdmin: readIsAdmin(c),
          childCount: null,
          weekCount: null,
          expanded: false,
          students: null
        }));

        // 先上屏：姓名/电话立即可见，统计随后补
        this.setData({
          coaches,
          loading: false,
          weekRangeText: week ? week.start + ' ~ ' + week.end : ''
        });

        return this.fillStats(coaches, week);
      })
      .catch(err => {
        console.error('加载教练失败', err);
        this.setData({ loading: false });
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },

  /** 分批补统计：每位教练 2 次 count，不能让 N 个请求同时挤爆 wx.request */
  fillStats(coaches, week) {
    const db = wx.cloud.database();
    const _ = db.command;

    const batches = [];
    for (let i = 0; i < coaches.length; i += BATCH_SIZE) {
      batches.push(coaches.slice(i, i + BATCH_SIZE));
    }

    // 串行推进每一批，批内并发
    return batches.reduce((chain, batch, batchIndex) => {
      return chain.then(() => Promise.all(
        batch.map((coach, k) => {
          const index = batchIndex * BATCH_SIZE + k;
          return Promise.all([
            db.collection('children').where({ coachId: coach._id }).count(),
            db.collection('trainings').where({
              coachId: coach._id,
              date: _.gte(week.start).and(_.lte(week.end))
            }).count()
          ]).then(([childRes, weekRes]) => {
            // 局部更新，避免整表 setData 触发全部重渲染
            this.setData({
              ['coaches[' + index + '].childCount']: childRes.total,
              ['coaches[' + index + '].weekCount']: weekRes.total
            });
          }).catch(err => {
            console.error('统计失败', coach.name, err);
            this.setData({
              ['coaches[' + index + '].childCount']: 0,
              ['coaches[' + index + '].weekCount']: 0
            });
          });
        })
      ));
    }, Promise.resolve()).then(() => {
      this.sortByWeekCount();
    });
  },

  /** 统计补完后按本周课次倒序重排，空值排最后 */
  sortByWeekCount() {
    const coaches = this.data.coaches.slice().sort((a, b) => {
      const av = a.weekCount === null ? -1 : a.weekCount;
      const bv = b.weekCount === null ? -1 : b.weekCount;
      if (av === bv) return 0;
      return bv - av;
    });
    this.setData({ coaches });
  },

  /** 展开某位教练的学员清单（懒加载，点过就缓存） */
  onExpand(e) {
    const index = e.currentTarget.dataset.index;
    const coach = this.data.coaches[index];
    if (!coach) return;

    if (coach.students) {
      this.setData({ ['coaches[' + index + '].expanded']: !coach.expanded });
      return;
    }

    const db = wx.cloud.database();
    db.collection('children').where({ coachId: coach._id }).get().then(res => {
      const students = res.data
        .map(c => ({
          _id: c._id,
          name: c.name || '未命名学员',
          hours: typeof c.remainingHours === 'number' ? c.remainingHours : null
        }))
        // 课时少的排前面，没填课时的排最后
        .sort((a, b) => {
          const av = a.hours === null ? Infinity : a.hours;
          const bv = b.hours === null ? Infinity : b.hours;
          return av - bv;
        });

      this.setData({
        ['coaches[' + index + '].students']: students,
        ['coaches[' + index + '].expanded']: true
      });
    }).catch(err => {
      console.error('加载学员失败', err);
      wx.showToast({ title: '加载学员失败', icon: 'none' });
    });
  },

  onCallTap(e) {
    const phone = e.currentTarget.dataset.phone;
    if (!phone) {
      wx.showToast({ title: '该教练未填写电话', icon: 'none' });
      return;
    }
    wx.makePhoneCall({ phoneNumber: String(phone) });
  }
});
