// pages/users/profile/index.js
const auth = require('../../../utils/auth');

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
    editProfileData: null,        // 【新增】编辑资料数据

    // 【搬入】以下为原首页内容版块的数据（v1.03 信息架构重做，自 pages/users/home 搬来）
    loading: true,      // 控制搬来版块的骨架屏
    newList: [],        // 最新动态
    moments: [],        // 精彩瞬间
    comments: [],       // 家长点评
    growthList: [],     // 成长案例
    courseList: []      // 课程体系
  },

  checkLogin() {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.navigateTo({ url: '/pages/common/login/index' });
      return false;
    }
    return true;
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    if (!this.checkLogin()) return;
    this.loadUserInfo();
    this.loadChildInfo();
    this.loadCoachInfo();
    this.loadContentSections();   // 【搬入】原首页的内容版块
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    if (!this.checkLogin()) return;
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

  // ==================== 内容版块（v1.03 自首页搬入） ====================
  //
  // 这些版块原先在 pages/users/home，首页重做成「孩子信息 + 当前情况」后整体搬到这里。
  // 只在 onLoad 拉一次，不放进 onShow —— 切 tab 回来没必要重拉内容型数据。

  /**
   * 一次加载全部内容版块
   *
   * 用 allSettled 而不是 all：五个集合里任何一个挂了（比如集合还没建），
   * 不该把其它版块一起拖没。各 loadXxx 内部已把失败的那份置空，页面照常渲染。
   */
  loadContentSections() {
    this.setData({ loading: true });

    return Promise.allSettled([
      this.loadNews(),
      this.loadMoments(),
      this.loadComments(),
      this.loadGrowthList(),
      this.loadCourseList()
    ]).then(results => {
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      console.log(`「我的」内容版块加载完成: ${successCount}/${results.length} 成功`);
      this.setData({ loading: false });
    }).catch(err => {
      console.error('加载内容版块失败:', err);
      this.setData({ loading: false });
    });
  },

  /**
   * 加载最新动态
   */
  loadNews() {
    const db = wx.cloud.database();
    return db.collection('news')
      .where({
        status: true
      })
      .orderBy('sort', 'asc')
      .orderBy('time', 'desc')
      .limit(5)
      .get()
      .then(res => {
        if (res.data && res.data.length > 0) {
          this.setData({ newList: res.data });
          console.log('最新动态加载成功:', res.data.length, '条');
        } else {
          console.log('暂无最新动态');
          this.setData({ newList: [] });
        }
      })
      .catch(err => {
        console.error('加载最新动态失败:', err);
        this.setData({ newList: [] });
        throw err;
      });
  },

  /**
   * 加载精彩瞬间
   */
  loadMoments() {
    const db = wx.cloud.database();
    return db.collection('moments')
      .where({
        status: true
      })
      .orderBy('sort', 'asc')
      .limit(10)
      .get()
      .then(res => {
        if (res.data && res.data.length > 0) {
          this.setData({ moments: res.data });
          console.log('精彩瞬间加载成功:', res.data.length, '条');
        } else {
          console.log('暂无精彩瞬间');
          this.setData({ moments: [] });
        }
      })
      .catch(err => {
        console.error('加载精彩瞬间失败:', err);
        this.setData({ moments: [] });
        throw err;
      });
  },

  /**
   * 加载家长点评
   */
  loadComments() {
    const db = wx.cloud.database();
    return db.collection('comment')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get()
      .then(res => {
        if (res.data && res.data.length > 0) {
          // 格式化时间
          const comments = res.data.map(item => ({
            ...item,
            createTime: item.createdAt ? this.formatTime(item.createdAt) : ''
          }));
          this.setData({ comments });
          console.log('家长点评加载成功:', comments.length, '条');
        } else {
          console.log('暂无家长点评');
          this.setData({ comments: [] });
        }
      })
      .catch(err => {
        console.error('加载点评失败:', err);
        this.setData({ comments: [] });
        throw err;
      });
  },

  /**
   * 加载成长案例
   */
  loadGrowthList() {
    const db = wx.cloud.database();
    return db.collection('growth_exp')
      .where({ status: true })
      .orderBy('sort', 'asc')
      .limit(5)
      .get()
      .then(res => {
        if (res.data && res.data.length > 0) {
          const growthList = res.data.map(item => {
            // 计算案例数量
            let itemCount = 0;
            let coverImage = '';

            if (item.items && item.items.length > 0) {
              itemCount = item.items.length;
              coverImage = item.items[0].url || '';
            }

            // 格式化创建时间
            let createdAt = '';
            if (item.createdAt) {
              createdAt = this.formatTime(item.createdAt);
            }

            return {
              ...item,
              itemCount,
              coverImage,
              createdAt
            };
          });

          this.setData({ growthList });
          console.log('成长案例加载成功:', growthList.length, '条');
        } else {
          console.log('暂无成长案例');
          this.setData({ growthList: [] });
        }
      })
      .catch(err => {
        console.error('加载成长案例失败:', err);
        this.setData({ growthList: [] });
        throw err;
      });
  },

  /**
   * 加载课程列表
   */
  loadCourseList() {
    const db = wx.cloud.database();
    return db.collection('course')
      .where({ status: true })
      .orderBy('sort', 'asc')
      .limit(10)
      .get()
      .then(res => {
        if (res.data && res.data.length > 0) {
          this.setData({ courseList: res.data });
          console.log('课程列表加载成功:', res.data.length, '条');
        } else {
          console.log('暂无课程数据');
          this.setData({ courseList: [] });
        }
      })
      .catch(err => {
        console.error('加载课程列表失败:', err);
        this.setData({ courseList: [] });
        throw err;
      });
  },

  /**
   * 格式化时间
   */
  formatTime(date) {
    if (!date) return '';

    try {
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error('时间格式化失败:', error);
      return '';
    }
  },

  // 【新增】编辑资料
  editProfile() {
    this.setData({
      showEditProfileModal: true,
      editProfileData: {
        name: this.data.userInfo.name || this.data.userInfo.nickName || '',
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
    const { name, avatarUrl } = e.detail;
    const openid = wx.getStorageSync('openid');
    const db = wx.cloud.database();

    // 更新本地缓存
    const userInfo = { ...this.data.userInfo, name, avatarUrl };
    wx.setStorageSync('userInfo', userInfo);
    this.setData({ userInfo, showEditProfileModal: false });

    // 更新数据库
    db.collection('users').where({
      _openid: openid
    }).get().then(res => {
      if (res.data.length > 0) {
        db.collection('users').doc(res.data[0]._id).update({
          data: {
            name: name,
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

  // 跳转到课时明细页面
  goToHoursDetail() {
    const { childInfo } = this.data;
    if (!childInfo || !childInfo._id) {
      wx.showToast({ title: '孩子信息有误', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/users/hours-detail/index?childId=${childInfo._id}&childName=${childInfo.name}`
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

  // ==================== 快捷入口 / 版块跳转（v1.03 自首页搬入） ====================
  //
  // 原先「我的预约」「我的反馈」「关于我们」三个菜单项已删除 —— 搬来的八宫格
  // 和「关于我们」版块指向同样的页面，留着是重复入口。

  /**
   * 快捷入口 - 训练数据
   */
  goToTrainingData() {
    if (!this.checkLogin()) return;
    wx.navigateTo({ url: "/pages/users/children/index" });
  },

  /**
   * 快捷入口 - 课程表
   */
  goToSchedule() {
    if (!this.checkLogin()) return;
    const childId = this.data.childInfo && this.data.childInfo._id;
    if (!childId) {
      wx.showToast({ title: '请先添加孩子信息', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/users/trainings/index?childId=${childId}` });
  },

  /**
   * 快捷入口 - 预约上课
   */
  goToBookClass() {
    if (!this.checkLogin()) return;
    wx.switchTab({ url: "/pages/users/orders/index" });
  },

  /**
   * 快捷入口 - 上课记录
   */
  goToClassRecords() {
    if (!this.checkLogin()) return;
    wx.navigateTo({ url: '/pages/users/class-records/index' });
  },

  /**
   * 快捷入口 - 课堂点评
   */
  goToClassComments() {
    if (!this.checkLogin()) return;
    wx.navigateTo({ url: '/pages/users/class-comments/index' });
  },

  /**
   * 快捷入口 - 成长案例
   */
  goToChildProfile() {
    wx.navigateTo({ url: "/pages/users/all-growth/index" });
  },

  /**
   * 快捷入口 - 联系教练
   */
  contactCoach() {
    wx.navigateTo({ url: "/pages/users/coach-list/index" });
  },

  /**
   * 快捷入口 - 我的反馈
   */
  goToFeedback() {
    if (!this.checkLogin()) return;
    const childId = this.data.childInfo && this.data.childInfo._id;
    if (!childId) {
      wx.showToast({ title: '请先添加孩子信息', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/users/my-feedback/index?childId=${childId}` });
  },

  /**
   * 加入我们 - 预约教练
   */
  goToBookCoach() {
    if (!this.checkLogin()) return;
    wx.navigateTo({ url: '/pages/users/book-coach/index' });
  },

  // ==================== 查看详情 ====================

  /**
   * 查看全部动态
   */
  viewAllNews() {
    wx.navigateTo({ url: "/pages/users/news/index" });
  },

  /**
   * 查看动态详情
   */
  viewNews(e) {
    const { id } = e.currentTarget.dataset;
    if (id) {
      wx.navigateTo({ url: `/pages/users/news-detail/index?id=${id}` });
    }
  },

  /**
   * 查看全部点评
   */
  viewAllComments() {
    wx.navigateTo({ url: '/pages/coach/all-comments/index' });
  },

  /**
   * 查看点评详情
   */
  viewCommentDetail(e) {
    const { id } = e.currentTarget.dataset;
    if (id) {
      wx.navigateTo({ url: `/pages/coach/comment-detail/index?id=${id}` });
    }
  },

  /**
   * 查看全部成长案例
   */
  viewAllGrowth() {
    wx.navigateTo({ url: '/pages/users/all-growth/index' });
  },

  /**
   * 查看成长案例详情
   */
  viewGrowthDetail(e) {
    const { id } = e.currentTarget.dataset;
    if (id) {
      wx.navigateTo({ url: `/pages/users/growth-detail/index?id=${id}` });
    }
  },

  /**
   * 查看全部课程
   */
  viewAllCourses() {
    wx.navigateTo({ url: '/pages/users/all-courses/index' });
  },

  /**
   * 查看课程详情
   */
  viewCourseDetail(e) {
    const { id } = e.currentTarget.dataset;
    if (id) {
      wx.navigateTo({ url: `/pages/users/course-detail/index?id=${id}` });
    }
  },

  /**
   * 查看更多精彩瞬间
   */
  viewMoreMoments() {
    wx.navigateTo({ url: "/pages/users/moments/index" });
  },

  /**
   * 查看精彩瞬间详情
   */
  viewMoment(e) {
    const { id } = e.currentTarget.dataset;
    if (id) {
      wx.navigateTo({ url: `/pages/users/moment-detail/index?id=${id}` });
    } else {
      console.warn('精彩瞬间 ID 为空');
    }
  },

  // ==================== 联系功能 ====================

  /**
   * 拨打电话
   */
  callPhone() {
    wx.makePhoneCall({
      phoneNumber: "19212218300",
      fail(err) {
        console.error('拨打电话失败:', err);
        wx.showToast({ title: '拨号失败', icon: 'none' });
      }
    });
  },

  /**
   * 查看地址
   */
  viewAddress() {
    wx.openLocation({
      latitude: 39.1024,   // 天津师范大学纬度
      longitude: 117.1256, // 天津师范大学经度
      name: '天津师范大学',
      address: '天津市西青区宾水西道393号',
      scale: 15,
      fail(err) {
        console.error('打开地图失败:', err);
        wx.showToast({ title: '打开地图失败', icon: 'none' });
      }
    });
  },

  /**
   * 查看微信
   */
  viewWechat() {
    wx.showModal({
      title: '官方微信',
      content: '微信号：The120307\n\n请添加微信了解更多详情',
      confirmText: '复制微信号',
      cancelText: '取消',
      success(res) {
        if (res.confirm) {
          wx.setClipboardData({
            data: 'The120307',
            success() {
              wx.showToast({
                title: '已复制微信号',
                icon: 'success',
                duration: 2000
              });
            },
            fail() {
              wx.showToast({
                title: '复制失败',
                icon: 'none'
              });
            }
          });
        }
      }
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

  // 所有教练
  goToAllCoaches() {
    wx.navigateTo({
      url: '/pages/users/all-coaches/index'
    });
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          auth.clearSession();
          wx.reLaunch({
            url: '/pages/common/login/index'
          });
        }
      }
    });
  },

  onHide() { },
  onUnload() { },
  onPullDownRefresh() { },
  onReachBottom() { },
  onShareAppMessage() { }
})