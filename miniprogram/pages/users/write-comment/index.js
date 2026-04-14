// pages/users/write-comment/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    trainingId:'',
    courseName:'',
    coachName:'',
    rating:0,
    content:'',
    tagList:['教练专业','讲解细致','氛围很好','进步明显','孩子喜欢','耐心负责','课程有趣','效果显著'],
    tagCheckedStatus: {} , // 例如: { '教练专业': true, '讲解细致': false }
    selectedTags : [],
    isAnonymous:false,
    submitting:false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const {id , name, coach} = options
    this.setData({
      trainingId:id,
      courseName:name || '训练课程',
      coachName: coach || '教练'
    });
    // 如果有点评记录，加载点评记录
    if(id) {
      this.loadExistingComment(id);
    }
  },

  // 加载已有点评记录
  loadExistingComment(trainingId) {
    const db = wx.cloud.database();
    db.collection('trainings').doc(trainingId).get().then(res => {
      const training = res.data;
      if(training.commemt && training.comment.isCommented) {
        const selectedTags = training.comment.tags || [];
        const tagCheckedStatus = {};
        selectedTags.forEach(t => {
          tagCheckedStatus[t] = true;
        });
        this.setData({
          rating:training.commemt.rating || 0,
          content:training.commemt.content ||'',
          selectedTags:training.comment.tags || [],
          isAnonymous:training.comment.isAnonymous || false
        });
      }
    }).catch(err => {
      console.error('加载点评失败', err);
    });
  },

  // 设置评分
  setRating(e) {
    const rating = e.currentTarget.dataset.rating;
    this.setData({rating}); 

  },


   // 输入内容
   onContentInput(e) {
    this.setData({ content: e.detail.value });
    const content = e.detail.value;
  
  this.setData({ content });
  

  },

  // 切换标签
  toggleTag(e) {
    const tag = e.currentTarget.dataset.tag;
    const selectedTags = [...this.data.selectedTags];
    const index = selectedTags.indexOf(tag);

    
    if (index > -1) {
      selectedTags.splice(index, 1);
    } else {
      selectedTags.push(tag);
    }
     // 同时更新 tagCheckedStatus
  const tagCheckedStatus = {};
  selectedTags.forEach(t => {
    tagCheckedStatus[t] = true;
  });


    console.log(selectedTags);
    this.setData({ selectedTags:selectedTags,
      tagCheckedStatus: tagCheckedStatus
    });
  },


  // 切换匿名
  toggleAnonymous() {
    this.setData({ isAnonymous: !this.data.isAnonymous });
  },

  // 提交点评
  onSubmit() {
    
    // 验证
    if(this.data.rating === 0) {
      wx.showToast({ title: '请选择评分', icon: 'none' });
      return;
    }
    if (!this.data.content.trim()) {
      wx.showToast({ title: '请输入点评内容', icon: 'none' });
      return;
    }
    this.setData({submitting:true})

    const db = wx.cloud.database();
    const userInfo = wx.getStorageSync('userInfo');

    // 构建点评数据
    const commentData = {
      content: this.data.content.trim(),
      rating: this.data.rating,
      tags: this.data.selectedTags,
      isAnonymous: this.data.isAnonymous,
      isCommented: true,
      nickName: this.data.isAnonymous ? '匿名用户' : (userInfo.nickName || '家长'),
      avatarUrl: this.data.isAnonymous ? '' : (userInfo.avatarUrl || ''),
      createTime: new Date().toLocaleString(),
      createdAt: new Date()
    }

    // 更新trainings集合
    db.collection('trainings').doc(this.data.trainingId).update({
      data: {
        comment: commentData,
        updatedAt: new Date()
      }
    }).then(() => {
      wx.showToast({ title: '点评成功', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      },1500)
    }).catch(err => {
      console.error('提交点评失败', err);
      wx.showToast({ title: '提交失败', icon: 'none' });

    }).finally(() => {
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