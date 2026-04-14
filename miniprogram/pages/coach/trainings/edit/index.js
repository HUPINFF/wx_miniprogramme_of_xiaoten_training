// pages/coach/trainings/edit/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    // 孩子相关
    nonthing:'',
    childId:'',
    childName:'',
    childAvatar:'',
    children:[],
    selectedChild:{},

    // 训练数据
    date:'',
    startTime:'',        // 【新增】训练开始时间
    duration:'',         // 【新增】训练时长
    durationList: ['30分钟', '45分钟', '60分钟', '90分钟', '120分钟'],
    typeList:['速度训练','耐力训练','协调性训练','力量训练','柔韧训练'],
    selectedType:'',
    name:'',
    focus:'',
    difficulty:'',
    photoUrls :[], //存储上传的照片临时路径

    // 教练信息
    coachInfo:{},

    // 状态
    submitting:false,
    isEdit:false, //  是否编辑模式
    recordId:'',  //编辑时的记录id
    trainingHoursDisplay:'' //【新增】课时显示文本
  },

  // 在 onDurationChange 中更新
// onDurationChange(e) {
//   const index = e.detail.value;
//   const duration = this.data.durationList[index];
//   const minutes = parseInt(duration);
//   const trainingHours = !isNaN(minutes) ? Math.round((minutes / 60) * 2) / 2 : 0;
//   const trainingHoursDisplay = `约 ${duration}，扣减 ${trainingHours} 课时`;
  
//   this.setData({ 
//     duration: duration,
//     trainingHoursDisplay: trainingHoursDisplay
//   });
// },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const { childId, id } = options;
    const coachInfo = wx.getStorageSync('coachInfo') || {};
    this.setData({coachInfo});

    if(id) {
      // 编辑模式
      this.setData({isEdit:true, recordId:id});
      this.loadTrainingRecord(id);
    }

    if(childId) {
      // 传有孩子ID，直接加载改孩子
      this.loadChildInfo(childId);
    }else {
      // 没有传，加载该教练所有孩子
      this.loadChildrenList();
    }

    // 设置默认日期为今天
    this.setDefaultDate();
    // 设置默认时间为当前时间
    this.setDefaultTime();
  },

  // 设置默认日期为今天
  setDefaultDate() {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    this.setData({date:today})
  },

  // 【新增】设置默认时间为当前时间
  setDefaultTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    this.setData({startTime: `${hours}:${minutes}`});
  },

  //加载孩子信息
  loadChildInfo(childId) {
    const db = wx.cloud.database()
    db.collection('children').doc(childId).get().then(res => {
      const child = res.data;
      this.setData({
        childId:child._id,
        childName:child.name,
        childAvatar:child.avatar,
        selectedChild:child
      });
    });
  },

  // 加载该教练的所有孩子
  loadChildrenList() {
    const db = wx.cloud.database();
    const coachId = this.data.coachInfo._id;
    db.collection('children').where({coachId:coachId}).get().then(res => {
      this.setData({children:res.data});
    });
  },

  // 加载训练记录(编辑模式)

    loadTrainingRecord() {
      const db = wx.cloud.database();
      db.collection('trainings').doc(this.data.recordId).get().then(res => {
        const record = res.data;
        this.setData({
          childId:record.childId,
          childName:record.childName || '',
          childAvatar:record.childAvatar || '',
          date:record.date,
          startTime: this.data.startTime || '',           // 【新增】训练开始时间
          duration: this.data.duration || '',              // 【新增】训练时长
          selectedType:record.type,
          name:record.name,
          focus:record.focus,
          difficulty:record.difficulty,
          photoUrls:record.photos || []
        });
        // 如果有孩子id，加载孩子详细信息
        if(record.childId) {
          this.loadChildInfo(record.childId);
        }
      });
    },

    // 选择学员
    onChildChange(e) {
      const index = e.detail.value;
      const selectedChild = this.data.children[index];
      this.setData({
        childId:selectedChild._id,
        childName:selectedChild.name,
        childAvatar:selectedChild.avatar,
        selectedChild
      });
    },

    // 选择日期
    onDateChange(e) {
      this.setData({date:e.detail.value})
    },

    // 【新增】选择时间
  onTimeChange(e) {
    this.setData({startTime: e.detail.value})
  },


  // 在 onDurationChange 中更新
  onDurationChange(e) {
    const index = e.detail.value;
    const duration = this.data.durationList[index];
    const minutes = parseInt(duration);
    const trainingHours = !isNaN(minutes) ? Math.round((minutes / 60) * 2) / 2 : 0;
    const trainingHoursDisplay = `约 ${duration}，扣减 ${trainingHours} 课时`;
    
    this.setData({ 
      duration: duration,
      trainingHoursDisplay: trainingHoursDisplay
    });
  },
  // // // 【新增】选择时长
  // onDurationChange(e) {
  //   const index = e.detail.value;
  //   this.setData({duration: this.data.durationList[index]});

  // },


    // 选择训练类型
    onTypeChange(e) {
      const index = e.detail.value;
      this.setData({selectedType:this.data.typeList[index]});
    },

    // 输入训练名称
    onNameInput(e) {
      this.setData({name:e.detail.value});
    },

    // 输入训练重点
    onFocusInput(e) {
      this.setData({focus:e.detail.value});
    },

    // 输入训练难点
    onDifficultyInput(e){
      this.setData({difficulty: e.detail.value});
    },

    // 上传照片
    uploadPhotos() {
      const maxCount = 9 - this.data.photoUrls.length;
      if(maxCount <= 0) {
        wx.showToast({title:'最多上传9张图片',icon:'none'});
        return;
      }

      wx.chooseMedia({
        count: maxCount,
        mediaType: ['image'],
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          // chooseMedia 返回的是 tempFiles 数组
          const tempFiles = res.tempFiles;
          // 提取每个文件的临时路径
          console.log("dada",tempFiles);
          const tempFilePaths = tempFiles.map(file => file.tempFilePath);
          const newPhotos = [...this.data.photoUrls, ...tempFilePaths];
          this.setData({ photoUrls: newPhotos });
        },
        fail: (err) => {
          console.error('选择照片失败', err);
          wx.showToast({ title: '选择照片失败', icon: 'none' });
        }
      });
    },

    // 删除照片
    deletePhoto(e) {
      const index = e.currentTarget.dataset.index;
      const photoUrls = [...this.data.photoUrls]
      photoUrls.splice(index,1);
      this.setData({photoUrls})
    },

      // 【新增】计算训练课时（根据时长）
  calculateTrainingHours() {
    const { duration } = this.data;
    if (!duration) return 1;
    const minutes = parseInt(duration);
    if (isNaN(minutes)) return 1;
    const hours = minutes / 60;
    return Math.round(hours * 2) / 2;  // 保留0.5的精度
  },

   // 【新增】扣减学员学时
   deductChildHours(childId, trainingHours) {
    const db = wx.cloud.database();
    return db.collection('children').doc(childId).get().then(res => {
      const child = res.data;
      const currentHours = child.remainingHours || 0;
      const newHours = currentHours - trainingHours;
      
      if (newHours < 0) {
        wx.showToast({ title: '学时不足，请及时充值', icon: 'none' });
      }
      
      return db.collection('children').doc(childId).update({
        data: {
          remainingHours: newHours,
          updatedAt: new Date()
        }
      });
    });
  },

    // 提交保存
    onSubmit() {
      // 验证
      if(!this.data.childId) {
        wx.showToast({
          title: '请选择学员',
          icon:'none'
        });
        return;
      }

      if(!this.data.date) {
        wx.showToast({title:'请选择训练日期',icon:'none'})
        return;
      }

      if(!this.data.selectedType) {
        wx.showToast({title:'请选择训练类型',icon:'none'})
        return;
      }

      if(!this.data.name.trim()) {
        wx.showToast({title:'请选择训练名称',icon:'none'});
        return;
      }

      if(!this.data.focus.trim()) {
        wx.showToast({title:'请选择训练重点',icon:'none'})
        return;
      }

      if(!this.data.difficulty.trim()) {
        wx.showToast({title:'请选择训练难点',icon:'none'})
        return;
      }

      this.setData({ submitting: true });

      // 计算训练课时
      const trainingHours = this.calculateTrainingHours();

      // 如果有照片需要上传到云存储
      const uploadTasks = this.uploadPhotosToCloud();
      console.log('_______',this.data.photoUrls);
      Promise.all(uploadTasks).then(photoUrls => {
        // 构建训练记录数据
        const db = wx.cloud.database();
        const trainingData = {
          childId: this.data.childId,
          childName: this.data.childName,
          childAvatar: this.data.childAvatar,
          coachId: this.data.coachInfo._id,
          coachName: this.data.coachInfo.name,
          date: this.data.date,
          startTime: this.data.startTime,           // 【新增】训练开始时间
          duration: this.data.duration,              // 【新增】训练时长
          endTime: this.calculateEndTime(),          // 【新增】计算结束时间
          day: this.getWeekday(this.data.date),
          time: '',  // 可根据需要添加时间字段
          type: this.data.selectedType,
          name: this.data.name,
          focus: this.data.focus,
          difficulty: this.data.difficulty,
          photos: photoUrls,
          photoCount: photoUrls.length,
          trainingHours: trainingHours,           // 【新增】记录本次训练的课时
          updatedAt: new Date()
        };

        let savePromise;
        if(this.data.isEdit) {
          // 编辑模式：只更新训练记录，不扣减学时
        savePromise = db.collection('trainings').doc(this.data.recordId).update({
          data: trainingData
        });
        }else {
            // 新增模式：添加训练记录并扣减学时
          trainingData.createdAt = new Date();
          savePromise = db.collection('trainings').add({ data: trainingData }).then(res => {
            // 【新增】扣减学员学时
            return this.deductChildHours(this.data.childId, trainingHours).then(() => res);
          });
        }
        return savePromise; 
      }).then(() => {
        wx.showToast({title:'保存成功',icon:"success"});
        setTimeout(() => {
          wx.navigateBack();
        },1500);
      }).catch(err => {
        console.error('保存失败', err);
        wx.showToast({ title: '保存失败', icon: 'none' });
      }).finally(() => {
        this.setData({submitting:false});
      })
    },

    // 【新增】计算结束时间
  calculateEndTime() {
    const { startTime, duration } = this.data;
    if (!startTime || !duration) return '';
    
    const [hours, minutes] = startTime.split(':').map(Number);
    const durationMinutes = parseInt(duration);
    
    const endDate = new Date();
    endDate.setHours(hours);
    endDate.setMinutes(minutes + durationMinutes);
    
    const endHours = String(endDate.getHours()).padStart(2, '0');
    const endMinutes = String(endDate.getMinutes()).padStart(2, '0');
    
    return `${endHours}:${endMinutes}`;
  },


    // 上传照片到云存储（返回Promise数组）
    uploadPhotosToCloud() {
      const tasks = [];
      for(let i=0 ;i < this.data.photoUrls.length ;i++) {
        const filePath = this.data.photoUrls[i];
          // 如果已经是云存储路径，跳过上传
          if (filePath.startsWith('cloud://')) {
            tasks.push(Promise.resolve(filePath));
            continue;
          }
          const cloudPath = `trainings/${this.data.childId}/${Date.now()}_${i}.jpg`;
          const task = wx.cloud.uploadFile({
            cloudPath,
            filePath
          }).then(res => res.fileID);
          tasks.push(task);
      } 
      return tasks;
    },

    // 根据日期获取星期几
    getWeekday(dateStr) {
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      const date = new Date(dateStr);
      return weekdays[date.getDay()];
  },

  // 【新增】获取课时显示文本
getTrainingHoursDisplay() {
  const { duration } = this.data;
  if (!duration) return '';
  const minutes = parseInt(duration);
  if (isNaN(minutes)) return '';
  const hours = minutes / 60;
  const trainingHours = Math.round(hours * 2) / 2;
  return `约 ${duration}，扣减 ${trainingHours} 课时`;
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