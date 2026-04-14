// pages/coach/content-manage/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    currentTab:'banner',
    bannerList:[],
    newsList:[],
    momentList:[],
    showModal:false,
    modalTitle:'',
    editId:null,
    formData :{
      image:'',
      text:'',
      sort:0,
      time:''
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadAllData();
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
    this.loadAllData();
  },

    // 加载所有数据
    loadAllData() {
      this.loadBanners();
      this.loadNews();
      this.loadMoments();
    },

    // 加载轮播图
    loadBanners() {
      const db = wx.cloud.database();
      db.collection('banners').orderBy('sort','asc').get().then(res => {
        this.setData({bannerList:res.data});
      }).catch(err => {
        console.error('加载轮播图失败', err);
      });
    },

    // 加载最新动态
    loadNews() {
      const db =wx.cloud.database();
      db.collection('news').orderBy('sort','asc').get().then(res =>{
        this.setData({newsList:res.data});
      }).catch(err => {
        console.error('加载动态失败', err);
      });
    },

    // 加载精彩瞬间
    loadMoments() {
      const db = wx.cloud.database();
      db.collection('moments').orderBy('sort','asc').get().then(res => {
        this.setData({momentList:res.data});
      }).catch(err => {
        console.error('加载精彩瞬间失败', err);
      });
    },

    // 切换Tab 
    switchTab(e) {
      const tab =  e.currentTarget.dataset.tab;
      this.setData({currentTab:tab});
    },

    // 添加轮播图
    addBanner() {
      this.setData({
        showModal:true,
        modalTitle:'添加轮播图',
        editId:null,
        formData:{
          image: '',
          text: '',
          sort: 0,
          time: ''
        }
      });
    },

    // 编辑轮播图
    editBanner(e) {
      const id = e.currentTarget.dataset.id;
      const item = this.data.bannerList.find(i => i._id === id);
      this.setData({
        showModal:true,
        modalTitle:'编辑轮播图',
        editId:id,
        formData:{
          image: item.image,
          text: item.text || '',
          sort: item.sort,
          time: ''
        }
      });
    },

    // 删除轮播图
    deleteBanner(e) {
      const id = e.currentTarget.dataset.id;
      wx.showModal({
        title:'确认删除',
        content: '确定要删除这个轮播图吗？',
        success:(res) => {
          if(res.confirm) {
            const db = wx.cloud.database();
            db.collection('banners').doc(id).remove().then(() => {
              wx.showToast({title:'删除成功',icon:"success"});
              this.loadBanners();
            }).catch(err => {
              console.error('删除失败', err);
            wx.showToast({ title: '删除失败', icon: 'none' });
            })
          }
        }
      })
    },

    // 添加动态
    addNews() {
      const today = this.getTodayString();
      this.setData({
        showModal:true,
        modalTitle:'添加动态',
        editId:null,
        formData:{
          image:'',
          text:'',
          sort:0,
          time:today
        }
      });
    },

    // 编辑动态

    editNews(e) {
      const id = e.currentTarget.dataset.id;
      const item = this.data.newsList.find(i => i._id === id);
      this.setData({
        showModal:true,
        modalTitle:'编辑动态',
        editId:id,
        formData:{
          image:'',
          text:item.title,
          sort:item.sort,
          time:item.time
        }
      });
    },

    // 删除动态
    deleteNews(e) {
      const id = e.currentTarget.dataset.id;
      wx.showModal({
        title: '确认删除',
        content: '确定要删除这个动态吗？',
        success: (res) => {
          if (res.confirm) {
            const db = wx.cloud.database();
            db.collection('news').doc(id).remove().then(() => {
              wx.showToast({ title: '删除成功', icon: 'success' });
              this.loadNews();
            }).catch(err => {
              console.error('删除失败', err);
              wx.showToast({ title: '删除失败', icon: 'none' });
            });
          }
        }
      });
    },

    // 添加精彩瞬间
    addMoment() {
      this.setData({
        showModal: true,
        modalTitle: '添加精彩瞬间',
        editId: null,
        formData: {
          image: '',
          text: '',
          sort: 0,
          time: ''
        }
      });
    },

    // 编辑精彩瞬间
    editMoment(e) {
      const id = e.currentTarget.dataset.id;
      const item = this.data.momentList.find(i => i._id === id);
      this.setData({
        showModal: true,
        modalTitle: '编辑精彩瞬间',
        editId: id,
        formData: {
          image: item.image,
          text: item.title,
          sort: item.sort,
          time: ''
        }
      });
    },

      // 删除精彩瞬间
  deleteMoment(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个精彩瞬间吗？',
      success: (res) => {
        if (res.confirm) {
          const db = wx.cloud.database();
          db.collection('moments').doc(id).remove().then(() => {
            wx.showToast({ title: '删除成功', icon: 'success' });
            this.loadMoments();
          }).catch(err => {
            console.error('删除失败', err);
            wx.showToast({ title: '删除失败', icon: 'none' });
          });
        }
      }
    });
  },

  // 准备图片
  chooseImage() {
    wx.chooseMedia({
      count:1,
      sizeType:['compressed'],
      sourceType: ['album', 'camera'],
      success:(res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        wx.showLoading({title: '上传中...',});

        const cloudPath = `content/${Date.now()}.jpg`;
        wx.cloud.uploadFile({
          cloudPath:cloudPath,
          filePath:tempFilePath
        }).then(uploadRes => {
          wx.hideLoading();
          this.setData({ 'formData.image': uploadRes.fileID });
        }).catch(err => {
          wx.hideLoading();
          console.error('上传失败', err);
          wx.showToast({ title: '上传失败', icon: 'none' });
        });
      }
    });
  },

   // 输入文字
   onTextInput(e) {
    this.setData({ 'formData.text': e.detail.value });
  },

  // 输入排序
  onSortInput(e) {
    this.setData({ 'formData.sort': parseInt(e.detail.value) || 0 });
  },

   // 选择时间
   onTimeChange(e) {
    this.setData({ 'formData.time': e.detail.value });
  },

   // 获取今天的日期
   getTodayString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 关闭弹窗
  closeModal() {
    this.setData({ showModal: false });
  },

  // 阻止冒泡
  stopPropagation() {},

  // 确认提交
  confirmSubmit() {
    const { currentTab , formData ,editId} = this.data;
    const openid = wx.getStorageSync('openid');
    // 验证
    if(currentTab !== 'news' && !formData.image) {
      wx.showToast({ title: '请上传图片', icon: 'none' });
      return;
    }

    if(!formData.text.trim()) {
      wx.showToast({ title: '请输入内容', icon: 'none' });
      return;
    }

    const db = wx.cloud.database();
    let collection = '';
    let data = {};

    if(currentTab === 'banner') {
      collection = 'banners';
      data = {
        image: formData.image,
        text: formData.text,
        sort: formData.sort,
        status: true,
        // _openid: openid,  // 添加这一行
        updatedAt: new Date()
      };
    } else if(currentTab ===  'news') {
      collection = 'news';
      data = {
        title: formData.text,
        time: formData.time,
        sort: formData.sort,
        status: true,
        // _openid: openid,  // 添加这一行
        updatedAt: new Date()
      };
    }else {
      collection = 'moments';
      data = {
        image: formData.image,
        title: formData.text,
        sort: formData.sort,
        status: true,
        // _openid: openid,  // 添加这一行
        updatedAt: new Date()
      };
    }

    if(editId) {
      // 更新
      db.collection(collection).doc(editId).update({data}).then(() => {
        wx.showToast({title: '修改成功',icon:'success'});
        this.closeModal();
        this.loadAllData();
      }).catch(err => {
        console.error('添加失败', err);
        wx.showToast({ title: '添加失败', icon: 'none' });
      })
    }else {
      // 新增
      data.createdAt = new Date();
      db.collection(collection).add({ data }).then(() => {
        wx.showToast({ title: '添加成功', icon: 'success' });
        this.closeModal();
        this.loadAllData();
      }).catch(err => {
        console.error('添加失败', err);
        wx.showToast({ title: '添加失败', icon: 'none' });
      });
    }
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