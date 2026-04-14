// pages/coach/feedback/write/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    // 孩子相关
    childId:'',
    childName:'',
    childAvatar:'',
    children:[],
    selectedChild:{},

    // 反馈内容
    weekRange:'',
    weekStart:'',
    weekEnd:'',
    rating:0,
    tagList:['速度进步', '耐力提升', '协调改善', '敏捷提高', '态度积极', '需要加强', '表现优秀', '专注力好'],
    selectedTags:[],
    content:'',

    // 本周表现数据
    weeklyPerformance:null,
    // 教练信息
    coachInfo:{},
    // 状态
    submitting: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const {childId} = options;
    const openid = wx.getStorageSync('openid');
    const db = wx.cloud.database();
    db.collection('users').where({
      _openid:openid
    }).get().then(res => {
      const coachInfo = res.data[0];
      this.setData({ coachInfo })
    })

    this.setWeekRange();

    if(childId) {
      // 传有孩子id，直接加载该孩子
      this.loadChildInfo(childId);
    }else{
      // 没有传，加载该教练的所有的孩子
        this.loadChildrenList();
    }
  },

  // 设置当前周范围
  setWeekRange() {
    const now = new Date();
    const monday = this.getMondayDate(now);
    const sunday = this.getSundayDate(now);
    
    const weekStart = `${now.getFullYear()}-${String(monday.month).padStart(2, '0')}-${String(monday.day).padStart(2, '0')}`; 

    const weekEnd = `${now.getFullYear()}-${String(sunday.month).padStart(2, '0')}-${String(sunday.day).padStart(2, '0')}`;

    this.setData({
      weekRange:`${monday.month}月${monday.day}日-${sunday.month}月${sunday.day}日`,
      weekStart,
      weekEnd
    })
  },

  // 获取周一日期
  getMondayDate(date) {
    const monday = new Date(date);
    const day = monday.getDay() || 7;
    monday.setDate(monday.getDate() - day + 1);
    return {
      month: monday.getMonth() + 1,
      day: monday.getDate()
    };
  },

  // 获取周日日期
  getSundayDate(date) {
    const sunday = new Date(date);
    const day = sunday.getDay() || 7;
    sunday.setDate(sunday.getDate() + (7 - day));
    return {
      month: sunday.getMonth() + 1,
      day: sunday.getDate()
    };
  },

  //加载孩子信息
  loadChildInfo(childId){
    const db = wx.cloud.database();
    db.collection('children').doc(childId).get().then(res => {
      const child = res.data
      this.setData({
        childId:child._id,
        childName:child.name,
        childAvatar:child.avatar,
        selectedChild:child
      });
      // 加载本周表现数据
      this.loadWeeklyPerformance(childId)
      // 检查是否已有本周反馈
      this.checkExistingFeedback(childId)
    });
  },

  // 加载该教练的所有孩子
  loadChildrenList() {
    const db = wx.cloud.database();
    const coachId = this.data.coachInfo._id;

    db.collection('children').where({
      coachId:coachId
    }).get().then(res => {
      this.setData({children:res.data})
    })
  },

  // 选择学员
  onChildChange(e) {
    const index = e.detail.value;
    const selectedChild = this.data.children[index]
    this.setData({
      childId:selectedChild._id,
      childName:selectedChild.name,
      childAvatar:selectedChild.avatar,
      selectedChild
    });
    // 加载本周表现数据
    this.loadWeeklyPerformance(selectedChild._id);
    // 检查是否已有本周反馈
    this.checkExistingFeedback(selectedChild._id);
  },

  //加载本周表现数据
  loadWeeklyPerformance(childId) {
    const db = wx.cloud.database();
    db.collection("performance").where({
      childId:childId,
      weekDate:this.data.weekStart
    }).get().then(res => {
      if(res.data.length > 0) {
        const performance = res.data[0]

        this.setData({
          weeklyPerformance: {
            fiftyMeter: performance.fiftyMeter,
            thousandMeter: performance.thousandMeter,
            coordination: performance.coordination,
            agility: performance.agility
          }
        });
      }else{
        this.setData({weeklyPerformance:null})
      }
    });
  },

  // 检查本周是否已有反馈
  checkExistingFeedback(childId) {
    const db = wx.cloud.database();
    db.collection('feedbacks').where({
      childId:childId,
      weekStart:this.data.weekStart
    }).get().then(res => {
      if(res.data.length > 0) {
        const feedback = res.data[0];
        wx.showModal({
          title:'提示',
          content:'本周已有反馈，是否继续编辑？',
          success:(res) => {
            if(res.confirm) {
              // 加载已有反馈数据
              this.setData({
                rating:feedback.rating || 0,
                selectedTags:feedback.tags || [],
                content:feedback.content || ''
              })
            }
          }
        })
      } 
    })
  },

  // 设置评分
  setRating(e) {
    const rating = e.currentTarget.dataset.rating;
    this.setData({rating})
  },

  //切换标签
  toggleTag(e) {
    console.log('===== toggleTag 被调用了 =====');  // 添加这行
    console.log('点击的标签:', e.currentTarget.dataset.tag);  // 添加这行
    
    const tag = e.currentTarget.dataset.tag;
    const selectedTags = [...this.data.selectedTags];
    const index = selectedTags.indexOf(tag);
    
    console.log('当前 selectedTags:', selectedTags);  // 添加这行
    console.log('index:', index);  // 添加这行
  
    if(index > -1) {
      selectedTags.splice(index, 1)
      console.log('取消选中');  // 添加这行
    } else {
      selectedTags.push(tag)
      console.log('添加选中');  // 添加这行
    }
    
    console.log('新的 selectedTags:', selectedTags);  // 添加这行
    this.setData({selectedTags})
  },

  // 输入反馈内容
  onContentInput(e) {
    this.setData({content:e.detail.value})
  },


  // 提交反馈
  onSubmit() {
    //验证
    if(!this.data.childId) {
      wx.showToast({title:'请选择学员',icon:'none'})
      return;
    }

    if(!this.data.content.trim()) {
      wx.showToast({title:'请输入反馈内容',icon:'none'})
      return;
    }

    if(this.data.rating === 0) {
      wx.showToast({title:'请选择评分',icon:'none' })
      return;
    }

    this.setData({submitting: true});

    const db = wx.cloud.database()
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2, '0')}`

    const feedbackData = {
      childId: this.data.childId,
      coachId: this.data.coachInfo._id,
      coachName: this.data.coachInfo.name,
      coachAvatar: this.data.coachInfo.avatar || '',
      weekRange: this.data.weekRange,
      weekStart: this.data.weekStart,
      weekEnd: this.data.weekEnd,
      rating: this.data.rating,
      tags: this.data.selectedTags,
      content: this.data.content,
      date: today,
      createdAt: now,
      updatedAt: now
    };

    // 检查是否有该周反馈
    db.collection('feedbacks').where({
      childId:this.data.childId,
      weekStart:this.data.weekStart
    }).get().then(res => {
      if(res.data.length > 0 ) {
        //更新已有反馈
        return db.collection('feedbacks').doc(res.data[0]._id).update({
          data:feedbackData 
        });
      } else {
        // 新增反馈
        return db.collection('feedbacks').add({
          data:feedbackData
        });
      } 
    }).then(() => {
      wx.showToast({title:'发布成功',icon:'success'});
      setTimeout(() => {
        wx.navigateBack();
      },1500);
    }).catch(err => {
      console.error('保存失败',err);
      wx.showToast({title:'发布失败',icon:'none'})
    }).finally(() => {
      this.setData({submitting: false})
    })
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