// pages/users/profile/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    userInfo: {},
    childInfo: null,
    coachInfo: null,           // 【新增】教练信息
    showAddChildModal: false,
    editChildData: null,
    showEditProfileModal: false,  // 【新增】编辑资料弹窗
    editProfileData: null         // 【新增】编辑资料数据

  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadUserInfo();
    this.loadChildInfo();
    this.loadCoachInfo();      // 【新增】加载教练信息
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this.loadChildInfo();
    this.loadUserInfo();       // 【新增】刷新用户信息
  },

  // 加载用户信息
  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo') || {};
    this.setData({ userInfo });
  },

  // 加载孩子信息
  loadChildInfo() {
    const openid = wx.getStorageSync('openid');
    const db = wx.cloud.database();

    db.collection('children').where({
      parentOpenId: openid
    }).get().then(res => {
      if (res.data.length > 0) {
        const childInfo = res.data[0];
        this.setData({ childInfo: childInfo });
        // 加载教练信息
        this.loadCoachInfo(childInfo.coachId);
      } else {
        this.setData({ childInfo: null, coachInfo: null });
      }
    }).catch(err => {
      console.error('加载孩子信息失败', err);
    });
  },

  // 【新增】加载教练信息
  loadCoachInfo(coachId) {
    if (!coachId) {
      this.setData({ coachInfo: null });
      return;
    }

    const db = wx.cloud.database();
    db.collection('users').doc(coachId).get().then(res => {
      this.setData({ coachInfo: res.data });
    }).catch(err => {
      console.error('加载教练信息失败', err);
      this.setData({ coachInfo: null });
    });
  },

  // 【新增】编辑资料
  editProfile() {
    this.setData({
      showEditProfileModal: true,
      editProfileData: {
        nickName: this.data.userInfo.nickName || '',
        avatarUrl: this.data.userInfo.avatarUrl || ''
      }
    })
  },

  // 【新增】关闭编辑弹窗
  closeEditProfileModal() {
    this.setData({ showEditProfileModal: false });
  },

  // 确认保存资料
  onConfirmEditProfile(e) {
    const { nickName,avatarUrl } = e.detail;
    const openid = wx.getStorageSync('openid');
    const db = wx.cloud.database();

    // 更新本地缓存
    const userInfo = { ...this.data.userInfo, nickName, avatarUrl };
    wx.setStorageSync('userInfo', userInfo);
    this.setData({ userInfo, showEditProfileModal: false });

    // 更新数据库
    db.collection('users').where({
      _openid: openid
    }).get().then(res => {
      if (res.data.length > 0) {
        db.collection('users').doc(res.data[0]._id).update({
          data: {
            nickName: nickName,
            avatarUrl: avatarUrl,
            updatedAt: new Date()
          }
        });
      }
    }).catch(err => {
      console.error('更新用户信息失败', err);
    });
  },

  // 添加孩子
  addChild() {
    if (this.data.childInfo) {
      wx.showToast({ title: '只能添加一个孩子', icon: 'none' });
      return;
    }

    this.setData({
      showAddChildModal: true,
      editChildData: null
    });
  },

  // 编辑孩子
  editChild() {
    this.setData({
      showAddChildModal: true,
      editChildData: this.data.childInfo
    });
  },

  // 删除孩子
  deleteChild() {
    wx.showModal({
      title: "确认删除",
      content: `确定要删除孩子${this.data.childInfo.name}的信息吗？删除后无法恢复`,
      success: (res) => {
        if (res.confirm) {
          const db = wx.cloud.database();
          db.collection('children').doc(this.data.childInfo._id).remove().then(() => {
            wx.showToast({ title: '删除成功', icon: 'success' });
            this.setData({ childInfo: null, coachInfo: null });
            this.refreshOtherPages();
          }).catch(err => {
            console.error('删除失败', err);
            wx.showToast({ title: '删除失败', icon: 'none' });
          });
        }
      }
    });
  },

  // 刷新其他页面数据
  refreshOtherPages() {
    const pages = getCurrentPages();
    pages.forEach(page => {
      if (page.route === 'pages/users/home/index' && page.loadChildInfo) {
        page.loadChildInfo();
      }
      if (page.route === 'pages/users/class-records/index' && page.loadRecords) {
        page.loadRecords();
      }
      if (page.route === 'pages/users/class-comments/index' && page.loadClassList) {
        page.loadClassList();
      }
      if (page.route === 'pages/users/my-feedback/index' && page.loadFeedbackList) {
        page.loadFeedbackList();
      }
    });
  },

  // 关闭弹窗
  closeModal() {
    this.setData({ showAddChildModal: false });
  },

  // 确认添加/编辑孩子
  onConfirmChild(e) {
    const { isEdit, formData } = e.detail;
    const openid = wx.getStorageSync('openid');
    const db = wx.cloud.database();

    const childData = {
      name: formData.name.trim(),
      age: parseInt(formData.age),
      gender: formData.gender,
      birthday: formData.birthday || '',
      remark: formData.remark || '',
      parentOpenId: openid,
      avatar: '/images_1/6756593ba0eb6a537f7060da8ede3ca8.jpeg',  // 【新增】固定使用默认头像
      updatedAt: new Date()
    };

    if (isEdit) {
      db.collection('children').doc(this.data.childInfo._id).update({
        data: childData
      }).then(() => {
        wx.showToast({ title: '修改成功', icon: 'success' });
        this.setData({ showAddChildModal: false });
        this.loadChildInfo();
        this.refreshOtherPages();
      }).catch(err => {
        console.error('修改失败', err);
        wx.showToast({ title: '修改失败', icon: 'none' });
      });
    } else {
      childData.createdAt = new Date();
      childData.avatar = '/images/default-avatar.png';  // 【新增】默认头像
      db.collection('children').add({
        data: childData
      }).then(() => {
        wx.showToast({ title: '添加成功', icon: 'success' });
        this.setData({ showAddChildModal: false });
        this.loadChildInfo();
        this.refreshOtherPages();
      }).catch(err => {
        console.error('添加失败', err);
        wx.showToast({ title: '添加失败', icon: 'none' });
      });
    }
  },

  // 我的预约
  goToMyAppointments() {
    wx.navigateTo({
      url: '/pages/users/orders/index'
    });
  },

  // 我的反馈
  goToMyFeedbacks() {
    wx.navigateTo({
      url: '/pages/users/my-feedback/index'
    });
  },

  // 设置
  goToSettings() {
    wx.navigateTo({
      url: '/pages/users/settings/index'
    });
  },

  // 关于我们
  aboutUs() {
    wx.navigateTo({
      url: '/pages/users/coach-list/index'
    });
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          wx.removeStorageSync('openid');
          wx.removeStorageSync('userRole');
          wx.reLaunch({
            url: '/pages/common/login/index'
          });
        }
      }
    });
  },

  onHide() {},
  onUnload() {},
  onPullDownRefresh() {},
  onReachBottom() {},
  onShareAppMessage() {}
})