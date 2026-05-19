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
    tagCheckedStatus: {} ,
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
    if(id) {
      this.loadExistingComment(id);
    }
  },

  loadExistingComment(trainingId) {
    const db = wx.cloud.database();
    db.collection('trainings').doc(trainingId).get().then(res => {
      const training = res.data;
      if(training.comment && training.comment.isCommented) {
        const selectedTags = training.comment.tags || [];
        const tagCheckedStatus = {};
        selectedTags.forEach(t => {
          tagCheckedStatus[t] = true;
        });
        this.setData({
          rating:training.comment.rating || 0,
          content:training.comment.content ||'',
          selectedTags:training.comment.tags || [],
          isAnonymous:training.comment.isAnonymous || false
        });
      }
    }).catch(err => {
      console.error('加载点评失败', err);
    });
  },

  setRating(e) {
    const rating = e.currentTarget.dataset.rating;
    this.setData({rating});
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value });
  },

  toggleTag(e) {
    const tag = e.currentTarget.dataset.tag;
    const selectedTags = [...this.data.selectedTags];
    const index = selectedTags.indexOf(tag);

    if (index > -1) {
      selectedTags.splice(index, 1);
    } else {
      selectedTags.push(tag);
    }
    const tagCheckedStatus = {};
    selectedTags.forEach(t => {
      tagCheckedStatus[t] = true;
    });

    this.setData({ selectedTags:selectedTags,
      tagCheckedStatus: tagCheckedStatus
    });
  },

  toggleAnonymous() {
    this.setData({ isAnonymous: !this.data.isAnonymous });
  },

  onSubmit() {
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

    // 先获取training信息，获取childId
    db.collection('trainings').doc(this.data.trainingId).get().then(trainingRes => {
      const training = trainingRes.data;
      const childId = training.childId || '';

      // 同时保存到comment集合
      const commentRecord = {
        trainingId: this.data.trainingId,
        childId: childId,
        courseName: this.data.courseName,
        coachName: this.data.coachName,
        content: this.data.content.trim(),
        rating: this.data.rating,
        tags: this.data.selectedTags,
        isAnonymous: this.data.isAnonymous,
        nickName: this.data.isAnonymous ? '匿名用户' : (userInfo.nickName || '家长'),
        avatarUrl: this.data.isAnonymous ? '' : (userInfo.avatarUrl || ''),
        createTime: new Date().toLocaleString(),
        createdAt: new Date()
      };

      return db.collection('comment').add({ data: commentRecord }).then(() => {
        // 更新trainings集合
        return db.collection('trainings').doc(this.data.trainingId).update({
          data: {
            comment: commentData,
            updatedAt: new Date()
          }
        });
      });
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
  }
})