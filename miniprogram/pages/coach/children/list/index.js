// pages/coach/children/list/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    children:[],
    allChildren:[],
    coachInfo:{},
    showAddModal: false,
    loading: true,
    editChildData: null,
    childId: '',
    previewChild: null,
    errorMsg: '',
    submitting: false
  },

  /** 
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadCoachInfo();
  },

  // 获取教练信息，从数据库查询
  loadCoachInfo() {
    // const coachInfo = wx.getStorageSync('userInfo') || {};
    // this.setData({coachInfo:coachInfo})
    // this.loadChildren();
    const openid = wx.getStorageSync('openid');
    const db = wx.cloud.database();
    console.log('dd',openid);
    db.collection('users').where({
      _openid:openid,
      role:'coach'
    }).get().then(res => {
      if(res.data.length > 0) {
        const coachInfo = res.data[0];
        this.setData({coachInfo});
        // 缓存教练信息,下次直接用
        wx.setStorageSync('coachInfo',coachInfo);
        this.loadChildren();
      }else {
        wx.showToast({title:'未找到教练信息',icon:'none'})
      }
    }).catch(err => {
      console.error('获取教练信息失败',err);
      wx.showToast({title:'加载失败',icon:'none'})
    })
  },

  // 只加载该教练负责的孩子
  loadChildren() {
    const db = wx.cloud.database();
    const coachId = this.data.coachInfo._id;

    if(!coachId) {
      wx.showToast({title:'请先登录',icon:'none'});
      return;
    }

    db.collection('children').where({
      coachId:coachId
    }).get().then(res => {
      const children = res.data;
      this.loadLatestPerformance(children);
    }).catch(err => {
      console.error('加载学员失败',err);
      this.setData({children:[],allChildren:[]})
    })
  },

  // ???
  loadLatestPerformance(children) {
    const db = wx.cloud.database();
    const promises = children.map(child => {
      return db.collection('performance').where({
        childId:child._id
      }).orderBy('weekDate','desc').limit(1).get().then(res => {
        if(res.data.length > 0) {
          child.latestFifty = res.data[0].fiftyMeter;
          child.latestPerformance = res.data[0]
        }
        return child;
      })
    })
    Promise.all(promises).then(children => {
      this.setData({children,allChildren:children})
    });
  },


  onSearch(e) {
    const keyword = e.detail.value;
    if(!keyword) {
      this.setData({children:this.data.allChildren})
      return;
    }
    const filtered = this.data.allChildren.filter(child =>{
       return child.name.includes(keyword)
    });
    
    this.setData({children:filtered})
  },

  viewDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({url:`/pages/coach/children/detail/index?id=${id}`});
  },

  addChild() {
    this.setData({
      showAddModal: true,
      childId: '',
      previewChild: null,
      errorMsg: ''
    })
  },

  // 关闭弹窗
  closeModal() {
    this.setData({ showAddModal: false });
  },

   // 阻止冒泡
   stopPropagation() {},

   onChildIdInput(e) {
    const childId = e.detail.value;
    this.setData({childId, errorMsg: '', previewChild: null})

    // 输入后自动查询
    if(childId.length >= 20) {
      this.searchChildById(childId);
    }
   },

   searchChildById() {
    const db = wx.cloud.database();
    db.collection('children').doc(this.data.childId).get().then(res => {
      const child = res.data;

      // 检查是否已经被其他教练关联
      if (child.coachId && child.coachId !== '') {
        this.setData({
          errorMsg: '该学员已被其他教练关联',
          previewChild: null,
          loading: false
        });
      }else {
        this.setData({
          previewChild:child,
          errorMsg: '',
          loading: false
        })
      }
    }).catch(err => {
      console.error('查询学员失败', err);
      this.setData({
        errorMsg: '未找到该学员，请检查ID是否正确',
        previewChild: null
      });
    });
   },   

  //  确认关联
  confirmAdd() {
    if(!this.data.previewChild) {
      wx.showToast({ title: '请先输入正确的学员ID', icon: 'none' });
      return;
    }

    this.setData({submitting:true});

    const coachInfo = wx.getStorageSync('coachInfo') || {};
    console.log('------------------',coachInfo._id);
    const db = wx.cloud.database();

    console.log(this.data.previewChild._id);
    db.collection('children').doc(this.data.previewChild._id).update({
      data:{
        coachId:coachInfo._id,
        updatedAt:new Date()
      }
    }).then(() => {
      wx.showToast({ title: '关联成功', icon: 'success' });
      console.log('=----------anjffjjk');
      this.setData({ showAddModal: false, submitting: false });
      this.loadChildren();  // 刷新列表
    }).catch(err => {
      console.error('关联失败', err);
      wx.showToast({ title: '关联失败', icon: 'none' });
      this.setData({ submitting: false });
    });
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