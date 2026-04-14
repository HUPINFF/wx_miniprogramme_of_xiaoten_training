// pages/users/moments/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    momentList:[],
    laoding:true,
    loadingMore:false,
    hasMore: true,
    pageSize: 10,
    lastDoc: null
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadMomentsList(); 
  },

  // 加载精彩瞬间列表
  loadMomentsList(isLoadMore = false) {
    if(isLoadMore) {
      this.setData({ loadingMore: true });
    }else {
      this.setData({ loading: true, momentsList: [], lastDoc: null, hasMore: true });
    }

    const db = wx.cloud.database();
    let query = db.collection('moments').where({
      status:true
    }).orderBy('sort','asc');

    if(isLoadMore && this.data.lastDoc) {
      query = query.orderBy('sort', 'asc').limit(this.data.pageSize).startAfter(this.data.lastDoc);
    }else {
      query = query.orderBy('sort', 'asc').limit(this.data.pageSize);
    }

    query.get().then(res => {
      const newList = res.data;
      if(isLoadMore) {
        this.setData({
          momentsList: [...this.data.momentsList, ...newList],
          loadingMore: false
        })
      }else {
        this.setData({
          momentsList: newList,
          loading: false
        });
      }

      if(newList.length < this.data.pageSize) {
        this.setData({ hasMore: false });
      }else if(newList.length > 0) {
        this.setData({ lastDoc: newList[newList.length - 1] });
      }
    }).catch(err => {
      console.error('加载精彩瞬间失败', err);
      this.setData({ loading: false, loadingMore: false });
    })
  },

  // 加载更多
  loadMore() {
    if (!this.data.hasMore || this.data.loadingMore) return;
    this.loadMomentsList(true);
  },

   // 查看精彩瞬间详情
   viewMomentDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/users/moment-detail/index?id=${id}`
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
    this.setData({ lastDoc: null, hasMore: true });
    this.loadMomentsList().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    this.loadMore();
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})