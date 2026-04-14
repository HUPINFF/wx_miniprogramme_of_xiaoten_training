// pages/coach/assessment/edit/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    childId:'',
    childName:'',
    childAge:'',
    childAvatar:'',
    gender:'男',
    formData:{
      height:'',
      weight:'',
      bmi:'',
      coreStrength:'',
      siteAndReach:'',
      standingLongJump: '',
      plank: '',
      wallSit: '',
      fiveMeterShuttle: '',
      ropeSkipping: '',
      // 专项动作模式 （强/中/弱）
      running:'',
      longJump:'',
      ropeJumping:'',
      squat:'',
      hurdleStep:'',
      lunge:'',
      shoulderFlexibility: '',
      legRaise:'',
      trunkPushup: '',
      rotationStability: '',
       // 综合评定
       overallRating: '',
       overallComment: ''
  },

  actionList: [
    { label: '跑步动作', field: 'running' },
    { label: '立定跳远动作', field: 'longJump' },
    { label: '跳绳动作', field: 'ropeJumping' },
    { label: '深蹲测试', field: 'squat' },
    { label: '跨栏步测试', field: 'hurdleStep' },
    { label: '直线弓步测试', field: 'lunge' },
    { label: '肩部灵活性', field: 'shoulderFlexibility' },
    { label: '主动直腿上抬', field: 'legRaise' },
    { label: '躯干稳定俯卧撑', field: 'trunkPushup' },
    { label: '旋转稳定性', field: 'rotationStability' }
  ],
  submitting: false
},
  

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const {childId,childName,childAge,childAvatar } = options;
    this.setData({
      childId: childId || '',
      childName: childName || '',
      childAge: childAge || '',
      childAvatar: childAvatar || ''
    });

     // 加载孩子信息获取性别
     this.loadChildInfo(childId);
      // 加载历史测评数据
    this.loadHistoryAssessment(childId);
  },

  //  加载孩子信息
  loadChildInfo(childId) {
    if(!childId) return;

    const db = wx.cloud.database();
    db.collection('children').doc(childId).get().then(res => {
      const child = res.data;
      this.setData({
        gender: child.gender === 'male' ? '男' : '女',
        childAge: child.age || ''
      });
    }).catch(err => {
      console.error('加载孩子信息失败', err);
    })
  },

  // 加载历史测评数据（用于编辑）
  loadHistoryAssessment(childId) {
    if(!childId) return;
    
    const db = wx.cloud.database();
    db.collection('assessments').where({
      childId:childId
    }).orderBy('createdAt','desc').limit(1).get().then(res => {
      if(res.data.length > 0) {
        const assessment = res.data[0];
        this.setData({
          'formData.height': assessment.basicInfo?.height || '',
          'formData.weight': assessment.basicInfo?.weight || '',
          'formData.bmi': assessment.basicInfo?.bmi || '',
          'formData.coreStrength': assessment.coreStrength?.value || '',
          'formData.sitAndReach': assessment.physicalFitness?.sitAndReach || '',
          'formData.standingLongJump': assessment.physicalFitness?.standingLongJump || '',
          'formData.plank': assessment.physicalFitness?.plank || '',
          'formData.wallSit': assessment.physicalFitness?.wallSit || '',
          'formData.fiveMeterShuttle': assessment.physicalFitness?.fiveMeterShuttle || '',
          'formData.ropeSkipping': assessment.physicalFitness?.ropeSkipping || '',
          'formData.running': assessment.actionPatterns?.running || '',
          'formData.longJump': assessment.actionPatterns?.longJump || '',
          'formData.ropeJumping': assessment.actionPatterns?.ropeJumping || '',
          'formData.squat': assessment.actionPatterns?.squat || '',
          'formData.hurdleStep': assessment.actionPatterns?.hurdleStep || '',
          'formData.lunge': assessment.actionPatterns?.lunge || '',
          'formData.shoulderFlexibility': assessment.actionPatterns?.shoulderFlexibility || '',
          'formData.legRaise': assessment.actionPatterns?.legRaise || '',
          'formData.trunkPushup': assessment.actionPatterns?.trunkPushup || '',
          'formData.rotationStability': assessment.actionPatterns?.rotationStability || '',
          'formData.overallRating': assessment.overallRating || '',
          'formData.overallComment': assessment.overallComment || ''
        });
        
        // 重新计算BMI
        if (this.data.formData.height && this.data.formData.weight) {
          this.calculateBMI();
        }
      }
    }).catch(err => {
      console.error('加载历史测评失败', err);
    });
  },

  // 输入框变化

  onInput(e) {
    const {field} = e.currentTarget.dataset;
    const value = e.detail.value;
    this.setData({ [`formData.${field}`]: value });
    console.log(value);
    // 实时计算BMI
    if(field === 'height' || field === 'weight') {
      // console.log('---------------');
      this.calculateBMI();
    }
  },

  // 计算BMI
  calculateBMI() {
    const { height, weight } = this.data.formData;
    console.log(height,weight);
    if (height && weight) {
      const heightM = parseFloat(height) / 100;
      const bmi = (parseFloat(weight) / (heightM * heightM)).toFixed(1);
      this.setData({ 'formData.bmi': bmi });
    }
  },

   // 选择动作评分
   selectAction(e) {
    const { field, value } = e.currentTarget.dataset;
    this.setData({ [`formData.${field}`]: value });
  },

   // 选择综合评级
   selectRating(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({ 'formData.overallRating': value });
  },

  // 提交表单
  onSubmit() {
    // // 验证必填项
    if(!this.data.formData.overallRating) {
      wx.showToast({ title: '请选择综合评定等级', icon: 'none' });
      return;
    }

    this.setData({submitting: true});

    const db = wx.cloud.database();
    const coachInfo = wx.getStorageSync('coachInfo') || {};
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const today = `${year}-${String(month).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // 构建数据
    const assessmentData = {
      childId: this.data.childId,
      childName: this.data.childName,
      coachId: coachInfo._id,
      coachName: coachInfo.name,
      year: year,                    // 【新增】年份
      month: month,                  // 【新增】月份
      assessmentDate: today,
      assessmentMonth: `${year}年${month}月`,
      basicInfo: {
        name: this.data.childName,
        gender: this.data.gender === '男' ? 'male' : 'female',
        age: parseInt(this.data.childAge) || 0,
        height: parseFloat(this.data.formData.height) || 0,
        weight: parseFloat(this.data.formData.weight) || 0,
        bmi: this.data.formData.bmi ? parseFloat(this.data.formData.bmi) : 0
      },
      coreStrength: {
        value: parseInt(this.data.formData.coreStrength) || 0
      },
      physicalFitness: {
        sitAndReach: parseFloat(this.data.formData.sitAndReach) || 0,
        standingLongJump: parseInt(this.data.formData.standingLongJump) || 0,
        plank: parseInt(this.data.formData.plank) || 0,
        wallSit: parseInt(this.data.formData.wallSit) || 0,
        fiveMeterShuttle: parseFloat(this.data.formData.fiveMeterShuttle) || 0,
        ropeSkipping: parseInt(this.data.formData.ropeSkipping) || 0
      },
      actionPatterns: {
        running: this.data.formData.running || '',
        longJump: this.data.formData.longJump || '',
        ropeJumping: this.data.formData.ropeJumping || '',
        squat: this.data.formData.squat || '',
        hurdleStep: this.data.formData.hurdleStep || '',
        lunge: this.data.formData.lunge || '',
        shoulderFlexibility: this.data.formData.shoulderFlexibility || '',
        legRaise: this.data.formData.legRaise || '',
        trunkPushup: this.data.formData.trunkPushup || '',
        rotationStability: this.data.formData.rotationStability || ''
      },
      overallRating: this.data.formData.overallRating,
      overallComment: this.data.formData.overallComment || '',
      createdAt: now,
      updatedAt: now
    };

    db.collection('assessments').where({
      childId: this.data.childId,
      year: year,
      month: month
    }).get().then(res => {
      if(res.data.length > 0) {
         // 存在，更新
         const docId = res.data[0]._id
         return db.collection('assessments').doc(docId).update({
          data:assessmentData
         });
      }else {
        assessmentData.createdAt = now;
        return db.collection('assessments').add({
          data:assessmentData
        });
      }
    }).then(() => {
      wx.showToast({ title: '测评保存成功', icon: 'success' });
      setTimeout(()=> {
        wx.navigateBack();
      },1500)
    }).catch(err => {
      console.error('保存失败', err);
      wx.showToast({ title: '保存失败', icon: 'none' });
    }).finally(() => {
      this.setData({ submitting: false });
    })
  },


  // 跳转到历史数据页面
goToHistory() {
  wx.navigateTo({
    url: `/pages/coach/assessment/history/index?childId=${this.data.childId}&childName=${this.data.childName}`
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