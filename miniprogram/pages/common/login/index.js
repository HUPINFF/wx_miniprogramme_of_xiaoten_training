// pages/common/login/index.js
Page({
  data:{
    selectedRole:'user',
    agree:false,
    loading:false,
    registerLoading: false  // 新增
  },

  onRoleSelect(e){
    const role = e.currentTarget.dataset.role
    this.setData({  
      selectedRole:role 
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
         // 用户不存在
         wx.showModal({
          title: '提示',
          content: '账号不存在，请先注册',
          showCancel: false
        });
        this.setData({ loading: false });
        return;
      }

      const user = res.data[0];

      // 检查角色是否匹配
      if(user.role !== this.data.selectedRole) {
        wx.showModal({
          title: '提示',
          content: `您是${user.role === 'user' ? '家长' : '教练'}账号，请切换到对应端登录`,
          showCancel: false
        });

        this.setData({loading:false});
        return;
      }

      // 保存用户信息
      wx.setStorageSync('userInfo', userInfo);
      wx.setStorageSync('userRole', user.role);
      wx.setStorageSync('openid', savedOpenid);
      wx.setStorageSync('token', 'logged_in');

      // 更新最后登录时间
      const db = wx.cloud.database();
      db.collection('users').doc(user._id).update({
        data:{
          lastLoginTime: new Date(),
          // nickName: userInfo.nickName,
          // avatarUrl: userInfo.avatarUrl
        }
      });

      // 跳转到对应首页
      this.navigateToHome(user.role);
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
        return db.collection('users').add({
          data:{
            // _openid: openid,
            nickName: userInfo.nickName,
            avatarUrl: userInfo.avatarUrl,
            role: this.data.selectedRole,
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
        wx.setStorageSync('userRole', user.role);
        wx.setStorageSync('openid',savedOpenid);
        wx.setStorageSync('token', 'logged_in');
        this.navigateToHome(user.role);
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

  // 根据角色跳转首页

  navigateToHome(role) {
    if(role === 'coach') {
      wx.reLaunch({ url: '/pages/coach/workbench/index' });
    }else {
      wx.reLaunch({url:'/pages/users/home/index'});
    }
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
    const token = wx.getStorageSync('token');
    if(token){
      // 已登录，直接跳转对应的首页
      const role = wx.getStorageSync('userRole') || 'user';
      if(role === 'coach') {
        wx.reLaunch({url:'/pages/coach/workbench/index'})
      }else {
        wx.reLaunch({url:"/pages/users/home/index"})
      }
    }
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