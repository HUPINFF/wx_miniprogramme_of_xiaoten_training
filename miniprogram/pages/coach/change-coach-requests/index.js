// pages/coach/change-coach-requests/index.js
const auth = require('../../../utils/auth');

Page({
  data: {
    requests: [],
    coachId: ''
  },

  onLoad() {
    this.loadCoachInfo();
  },

  onShow() {
    if (this.data.coachId) {
      this.loadRequests();
    }
  },

  loadCoachInfo() {
    wx.showLoading({ title: '加载中' });
    const openid = wx.getStorageSync('openid');
    const db = wx.cloud.database();

    db.collection('users').where({
      _openid: openid,
      role: 'coach'
    }).get({
      success: (res) => {
        wx.hideLoading();
        if (res.data.length > 0) {
          this.setData({ coachId: res.data[0]._id });
          this.loadRequests();
        } else {
          wx.showToast({ title: '未找到教练信息', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('获取教练信息失败', err);
        wx.showToast({ title: '获取信息失败', icon: 'none' });
      }
    });
  },

  // 管理员看全部换教练申请；普通教练只看转给自己的。
  // 放宽是安全的：同意时写的是 children.coachId = 申请里的 newCoachId（目标教练），
  // 不是管理员的 id，归属不会错。
  loadRequests() {
    const isGlobal = auth.globalScope({ allForAdmin: true });
    const coachId = auth.getCoachId();
    if (!isGlobal && !coachId) return;

    // 这个集合的字段叫 newCoachId 而不是 coachId，所以不能直接用 auth.coachScope()
    const where = isGlobal ? {} : { newCoachId: coachId };

    wx.showLoading({ title: '加载中' });
    const db = wx.cloud.database();

    db.collection('changeCoachNew')
      .where(where)
      .orderBy('createdAt', 'desc')
      .get({
        success: (res) => {
          wx.hideLoading();
          this.setData({ requests: res.data });
        },
        fail: (err) => {
          wx.hideLoading();
          console.error('加载申请列表失败', err);
          wx.showToast({ title: '加载失败', icon: 'none' });
        }
      });
  },

  formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  },

  getStatusText(status) {
    const statusMap = {
      'pending': '待处理',
      'approval': '已同意',
      'rejected': '已拒绝'
    };
    return statusMap[status] || status;
  },

  approveRequest(e) {
    const { id, childId, coachId } = e.currentTarget.dataset;

    wx.showModal({
      title: '确认同意',
      content: '确认同意该学员更换教练到您的名下？',
      success: (res) => {
        if (res.confirm) {
          this.processApproval(id, childId, coachId);
        }
      }
    });
  },

  processApproval(requestId, childId, coachId) {
    wx.showLoading({ title: '处理中...' });
    const db = wx.cloud.database();

    db.collection('changeCoachNew').doc(requestId).update({
      data: {
        status: 'approval',
        updatedAt: new Date()
      }
    }).then(() => {
      return db.collection('children').doc(childId).update({
        data: {
          coachId: coachId,
          updatedAt: new Date()
        }
      });
    }).then(() => {
      wx.hideLoading();
      wx.showToast({ title: '已同意', icon: 'success' });
      this.loadRequests();
    }).catch(err => {
      wx.hideLoading();
      console.error('处理申请失败', err);
      wx.showToast({ title: '处理失败', icon: 'none' });
    });
  },

  rejectRequest(e) {
    const { id } = e.currentTarget.dataset;

    wx.showModal({
      title: '确认拒绝',
      content: '确认拒绝该学员的更换教练申请？',
      success: (res) => {
        if (res.confirm) {
          this.processRejection(id);
        }
      }
    });
  },

  processRejection(requestId) {
    wx.showLoading({ title: '处理中...' });
    const db = wx.cloud.database();

    db.collection('changeCoachNew').doc(requestId).update({
      data: {
        status: 'rejected',
        updatedAt: new Date()
      }
    }).then(() => {
      wx.hideLoading();
      wx.showToast({ title: '已拒绝', icon: 'success' });
      this.loadRequests();
    }).catch(err => {
      wx.hideLoading();
      console.error('处理申请失败', err);
      wx.showToast({ title: '处理失败', icon: 'none' });
    });
  }
});