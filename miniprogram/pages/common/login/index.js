// pages/common/login/index.js
const auth = require('../../../utils/auth');
const { ENTRY, resolveLoginEntry } = require('../../../utils/helper');

// 两个入口的显示名。注意这是「登录入口」，不是 users.role 的取值：
// 管理员的 role 仍是 'coach'，靠 isAdmin 字段区分。管理端入口已撤掉——
// 管理员从教练端登录，带 isAdmin 标识就自动进管理模式（见 onLogin）。
const ROLE_LABEL = { user: '家长', coach: '教练' };

Page({
  data:{
    selectedRole:'user',
    roleLabel: '家长',
    registerLabel: '家长',
    agree:false,
    loading:false,
    registerLoading: false  // 新增
  },

  onRoleSelect(e){
    const role = e.currentTarget.dataset.role;
    this.setData({
      selectedRole: role,
      roleLabel: ROLE_LABEL[role],
      registerLabel: ROLE_LABEL[role]
    })
  },
  
  // 同意协议
  onAgreeChange(e){
    console.log('触发了onAgreeChange', e.detail.value);
    this.setData({
      agree:!this.data.agree
    });
    // console.log('设置后的agree:', this.data.agree);
  },
 
  // 获取用户信息
  onLogin(e){
    if(!this.data.agree) {
      wx.showToast({title:'请先同意用户协议',icon:'none'});
      return;
    }
    const { userInfo } = e.detail
    if(!userInfo) {
      wx.showToast({ title: '您拒绝了授权', icon: 'none' });
      return;
    }

    this.setData({loading:true});
    let savedOpenid = null;
    // 获取openid
    this.getOpenid().then(openid => {
      savedOpenid = openid;  // 保存到外层变量
      const db = wx.cloud.database();
      return db.collection('users').where({_openid:openid}).get();
    }).then(res => {
      if(res.data.length === 0 ){
         // 用户不存在。把 openid 一起显示出来，方便和数据库里的 _openid 逐字对照
         console.error('[登录] 查不到 users 记录, openid =', savedOpenid);
         wx.showModal({
          title: '账号不存在',
          content: `数据库里没有 openid 为 ${savedOpenid} 的 users 记录，请先注册。\n（若确认已注册，请核对记录里的 _openid 是否与此完全一致）`,
          showCancel: false
        });
        this.setData({ loading: false });
        return;
      }

      const user = res.data[0];
      console.log('[登录] 命中 users 记录', res.data.length, '条，取第一条：', user);

      // 检查角色是否匹配（家长进不了教练端，判断逻辑集中在 resolveLoginEntry）
      const gate = resolveLoginEntry(user, this.data.selectedRole);
      if(!gate.ok) {
        console.error('[登录] 角色闸门拦截', user, gate);
        wx.showModal({
          title: '提示',
          content: gate.message,
          showCancel: false
        });

        this.setData({loading:false});
        return;
      }

      // 教练端登录的账号带 isAdmin 标识 → 直接进管理模式（驾驶舱）。
      // 登录页已撤掉管理端入口，这是管理员唯一的进入方式；
      // cacheSession 写入的 entry 也升级成 admin，冷启动按它回驾驶舱
      const entry = (this.data.selectedRole === ENTRY.COACH && auth.readIsAdmin(user))
        ? ENTRY.ADMIN
        : this.data.selectedRole;

      // 保存用户信息（cacheSession 会一并写入 coachInfo / isAdmin / entry）
      wx.setStorageSync('userInfo', userInfo);
      wx.setStorageSync('openid', savedOpenid);
      auth.cacheSession(user, entry);

      // 更新最后登录时间
      const db = wx.cloud.database();
      db.collection('users').doc(user._id).update({
        data:{
          lastLoginTime: new Date(),
          // nickName: userInfo.nickName,
          // avatarUrl: userInfo.avatarUrl
        }
      });

      // 跳转到对应首页（管理模式用 isAdmin 升级后的 entry）
      this.navigateToHome(user, entry);
   }).catch(err => {
    console.error('登录失败', err);
    wx.showToast({ title: '登录失败', icon: 'none' });
   }).finally(() => {
    this.setData({ loading: false });
   });
  },

  // 注册
  onRegister() {
    if(!this.data.agree) {
      wx.showToast({ title: '请先同意用户协议', icon: 'none' });
    }
    this.setData({registerLoading: true })

    // 获取用户信息
    wx.getUserProfile({
      desc: '用于完善用户信息',
      success: (res) => {
        const userInfo = res.userInfo;
        this.doRegister(userInfo);
      },
      fail:() => {
        wx.showToast({ title: '需要授权才能注册', icon: 'none' });
        this.setData({ registerLoading: false });
      }
    });
  },

  // 执行注册
  doRegister(userInfo) {
    this.getOpenid().then(openid => {
      const db = wx.cloud.database();

      // 检查是否已经注册
      return db.collection('users').where({_openid:openid}).get().then(res => {
        if(res.data.length > 0) {
          wx.showModal({
            title: '提示',
            content: '该微信已注册，请直接登录',
            showCancel: false
          });
          return Promise.reject('已注册');
        }

        // 注册新用户
        // 白名单兜底：即使 UI 被绕过，也绝不写出一条 role:'admin' 的记录。
        // 管理员的 role 仍是 'coach'，额外带 isAdmin 字段。
        const role = this.data.selectedRole === ENTRY.COACH ? ENTRY.COACH : ENTRY.USER;
        return db.collection('users').add({
          data:{
            // _openid: openid,
            nickName: userInfo.nickName,
            avatarUrl: userInfo.avatarUrl,
            role: role,
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      });
    }).then(() => {
      wx.showToast({ title: '注册成功', icon: 'success' });
       // 注册成功后自动登录
       this.autoLogin();
    }).catch(err => {
      if (err !== '已注册') {
        console.error('注册失败', err);
        wx.showToast({ title: '注册失败', icon: 'none' });
      }
    }).finally(() => {
      this.setData({ registerLoading: false });
    })
  },

  // 自动登录(注册成功后调用)
  autoLogin() {
    let savedOpenid = null;
    this.getOpenid().then(openid => {
      savedOpenid = openid
      const db = wx.cloud.database();
      return db.collection('users').where({_openid:openid}).get();
    }).then(res => {
      if(res.data.length > 0) {
        const user = res.data[0];
        wx.setStorageSync('openid', savedOpenid);
        auth.cacheSession(user, this.data.selectedRole);
        this.navigateToHome(user);
      }
    })
  },


  // 获取openid
  getOpenid() {
    return new Promise((resolve,reject) => {
      wx.cloud.callFunction({
        name:'Login'
      }).then(res => {
        resolve(res.result.openid);
      }).catch(err => {
        reject(err);
      });
    });
  },  

  // 根据入口跳转首页（不传 entry 时按当前选择的入口）
  navigateToHome(user, entry) {
    const gate = resolveLoginEntry(user, entry || this.data.selectedRole);
    wx.reLaunch({ url: gate.home });
  },
  /**
   * 页面的初始数据
   */
  // data: {

  // },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 检查是否已登录
    if(!auth.isLoggedIn()) return;

    // 冷启动只能信缓存。isAdmin 缓存可能过期（在控制台改了但没重登），
    // resolveLoginEntry 会安全降级到教练端；管理页自身另有服务端兜底校验。
    const user = {
      role: wx.getStorageSync('userRole') || 'user',
      isAdmin: auth.isAdmin()
    };
    // 按上次登录的入口跳转；带 isAdmin 的老会话（缓存 entry 还是 coach 的）
    // 也升级回管理模式，保证管理员冷启动永远落在驾驶舱
    const cachedEntry = auth.getEntry();
    const entry = cachedEntry === ENTRY.COACH && auth.isAdmin() ? ENTRY.ADMIN : cachedEntry;
    const gate = resolveLoginEntry(user, entry);
    wx.reLaunch({ url: gate.home });
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})