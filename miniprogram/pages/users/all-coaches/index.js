// pages/users/all-coaches/index.js
Page({
  data: {
    coaches: [],
    filteredCoaches: [],
    loading: true,
    currentCoachId: '',
    childId: '',
    childName: '',
    pendingCoachIds: [],
    statusBarHeight: 44,
    viewMode: 'grid',
    avatarPlaceholder: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 260'%3E%3Crect fill='%23e8f1ed' width='200' height='260'/%3E%3Ccircle fill='%23cbd5e1' cx='100' cy='90' r='40'/%3E%3Cpath fill='%23cbd5e1' d='M40 220 Q100 160 160 220Z'/%3E%3C/svg%3E",
  },

  onLoad() {
    const windowInfo = wx.getWindowInfo();
    this.setData({
      statusBarHeight: windowInfo.statusBarHeight || 44
    });
    this.loadChildInfo();
    this.loadCoaches();
  },

  // ==================== 加载数据 ====================

  loadChildInfo() {
    const openid = wx.getStorageSync('openid');
    const db = wx.cloud.database();

    db.collection('children').where({
      parentOpenId: openid
    }).get().then(res => {
      if (res.data.length > 0) {
        const childInfo = res.data[0];
        this.setData({
          currentCoachId: childInfo.coachId || '',
          childId: childInfo._id,
          childName: childInfo.name
        });
        this.loadPendingApplications();
      }
    }).catch(err => {
      console.error('加载孩子信息失败', err);
    });
  },

  loadPendingApplications() {
    const { childId } = this.data;
    if (!childId) return;

    const db = wx.cloud.database();
    db.collection('changeCoachNew')
      .where({
        childId: childId,
        status: 'pending'
      })
      .get({
        success: (res) => {
          const pendingCoachIds = res.data.map(item => item.newCoachId);
          this.setData({ pendingCoachIds: pendingCoachIds });

          if (this.data.coaches.length > 0) {
            const updatedCoaches = this.data.coaches.map(coach => ({
              ...coach,
              hasPending: pendingCoachIds.includes(coach._id)
            }));
            this.setData({
              coaches: updatedCoaches,
              filteredCoaches: updatedCoaches
            });
          }
        },
        fail: (err) => {
          console.error('加载待处理申请失败', err);
        }
      });
  },

  loadCoaches() {
    this.setData({ loading: true });
    const db = wx.cloud.database();

    db.collection('users')
      .where({ role: 'coach' })
      .get({
        success: (res) => {
          const enriched = (res.data || []).map(c => ({
            ...c,
            rank: c.rank || '教练',
            hasPending: false,
            gender: c.gender || '男',
            price: c.price || 240
          }));
          this.setData({
            coaches: enriched,
            filteredCoaches: enriched,
            loading: false
          });

          if (this.data.childId) {
            this.loadPendingApplications();
          }
        },
        fail: (err) => {
          console.error('加载教练列表失败', err);
          this.setData({ loading: false });
          wx.showToast({ title: '加载失败', icon: 'none' });
        }
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

  // ==================== 视图切换 ====================

  switchView(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode !== this.data.viewMode) {
      this.setData({ viewMode: mode });
    }
  },

  // ==================== 更换教练（原有逻辑） ====================

  requestChangeCoach(e) {
    const { coachId, coachName } = e.currentTarget.dataset;
    const { childId, childName, currentCoachId, pendingCoachIds } = this.data;

    if (!childId) {
      wx.showToast({ title: '请先绑定孩子', icon: 'none' });
      return;
    }

    if (!currentCoachId) {
      wx.showModal({
        title: '提示',
        content: '您还未加入我们，请联系教练加入我们',
        confirmText: '去联系',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/users/book-coach/index' });
          }
        }
      });
      return;
    }

    if (coachId === currentCoachId) {
      wx.showToast({ title: '这是您的当前教练', icon: 'none' });
      return;
    }

    if (pendingCoachIds.includes(coachId)) {
      this.cancelChangeCoachRequest(coachId);
      return;
    }

    wx.showModal({
      title: '更换教练',
      content: '更换教练可能导致训练风格变化，以系统规则为准',
      confirmText: '确认更换',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.submitChangeCoachRequest(coachId, coachName, childId, childName);
        }
      }
    });
  },

  submitChangeCoachRequest(coachId, coachName, childId, childName) {
    wx.showLoading({ title: '提交中...' });
    const db = wx.cloud.database();

    db.collection('changeCoachNew')
      .where({
        childId: childId,
        newCoachId: coachId,
        status: 'pending'
      })
      .get({
        success: (res) => {
          if (res.data.length > 0) {
            wx.hideLoading();
            wx.showToast({ title: '您已发送申请', icon: 'none' });
            return;
          }

          db.collection('changeCoachNew').add({
            data: {
              childId: childId,
              name: childName,
              newCoachId: coachId,
              newCoachName: coachName,
              status: 'pending',
              createdAt: new Date()
            }
          }).then(() => {
            wx.hideLoading();
            wx.showToast({ title: '申请已提交', icon: 'success' });

            const pendingCoachIds = [...this.data.pendingCoachIds, coachId];
            this.setData({ pendingCoachIds: pendingCoachIds });

            const updatedCoaches = this.data.coaches.map(coach => ({
              ...coach,
              hasPending: coach._id === coachId ? true : coach.hasPending
            }));
            this.setData({
              coaches: updatedCoaches,
              filteredCoaches: updatedCoaches
            });
          }).catch(err => {
            wx.hideLoading();
            console.error('提交更换教练申请失败', err);
            wx.showToast({ title: '提交失败', icon: 'none' });
          });
        },
        fail: (err) => {
          wx.hideLoading();
          console.error('查询申请失败', err);
          wx.showToast({ title: '查询失败', icon: 'none' });
        }
      });
  },

  cancelChangeCoachRequest(coachId) {
    const { childId } = this.data;
    if (!childId) return;

    wx.showModal({
      title: '撤销申请',
      content: '确定要撤销更换教练的申请吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '撤销中...' });
          const db = wx.cloud.database();

          db.collection('changeCoachNew')
            .where({
              childId: childId,
              newCoachId: coachId,
              status: 'pending'
            })
            .get({
              success: (queryRes) => {
                if (queryRes.data.length > 0) {
                  const recordId = queryRes.data[0]._id;
                  db.collection('changeCoachNew').doc(recordId).remove({
                    success: () => {
                      wx.hideLoading();
                      wx.showToast({ title: '已撤销申请', icon: 'success' });

                      const pendingCoachIds = this.data.pendingCoachIds.filter(id => id !== coachId);
                      this.setData({ pendingCoachIds: pendingCoachIds });

                      const updatedCoaches = this.data.coaches.map(coach => ({
                        ...coach,
                        hasPending: coach._id === coachId ? false : coach.hasPending
                      }));
                      this.setData({
                        coaches: updatedCoaches,
                        filteredCoaches: updatedCoaches
                      });
                    },
                    fail: (err) => {
                      wx.hideLoading();
                      console.error('撤销申请失败', err);
                      wx.showToast({ title: '撤销失败', icon: 'none' });
                    }
                  });
                } else {
                  wx.hideLoading();
                  wx.showToast({ title: '未找到申请记录', icon: 'none' });
                }
              },
              fail: (err) => {
                wx.hideLoading();
                console.error('查询申请失败', err);
                wx.showToast({ title: '查询失败', icon: 'none' });
              }
            });
        }
      }
    });
  }
});
