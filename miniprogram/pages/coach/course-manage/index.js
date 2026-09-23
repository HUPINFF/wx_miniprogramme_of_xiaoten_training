// pages/coach/course-manage/index.js
Page({
  data: {
    courseList: [],
    showModal: false,
    modalTitle: '',
    editId: null,
    formData: {
      courseName: '',
      coverImage: '',
      content: '',
      corePhilosophy: '',
      summary: '',
      parentAdvice: '',
      coachAdvice: '',
      trainingHours: '',
      customContent: [],
      sort: 0
    }
  },

  onLoad(options) {
    if (options.editId) {
      this.editCourseById(options.editId);
    }
    this.loadCourses();
  },

  onShow() {
    this.loadCourses();
  },

  /** 返回上一页；直接打开本页（无上一页）时回教练工作台（教练端 tab 页靠 reLaunch 清栈） */
  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({ url: '/pages/coach/workbench/index' });
    }
  },

  loadCourses() {
    const db = wx.cloud.database();
    db.collection('course').orderBy('sort', 'asc').get().then(res => {
      this.setData({ courseList: res.data });
    }).catch(err => {
      console.error('加载课程失败', err);
    });
  },

  addCourse() {
    this.setData({
      showModal: true,
      modalTitle: '添加课程',
      editId: null,
      formData: {
        courseName: '',
        coverImage: '',
        content: '',
        corePhilosophy: '',
        summary: '',
        parentAdvice: '',
        coachAdvice: '',
        trainingHours: '',
        customContent: [],
        sort: 0
      }
    });
  },

  editCourse(e) {
    const id = e.currentTarget.dataset.id;
    this.editCourseById(id);
  },

  editCourseById(id) {
    const db = wx.cloud.database();
    db.collection('course').doc(id).get().then(res => {
      const item = res.data;
      this.setData({
        showModal: true,
        modalTitle: '编辑课程',
        editId: id,
        formData: {
          courseName: item.courseName || '',
          coverImage: item.coverImage || '',
          content: item.content || '',
          corePhilosophy: item.corePhilosophy || '',
          summary: item.summary || '',
          parentAdvice: item.parentAdvice || '',
          coachAdvice: item.coachAdvice || '',
          trainingHours: item.trainingHours || '',
          customContent: item.customContent || [],
          sort: item.sort || 0
        }
      });
    }).catch(err => {
      console.error('获取课程详情失败', err);
    });
  },

  deleteCourse(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个课程吗？',
      success: (res) => {
        if (res.confirm) {
          const db = wx.cloud.database();
          db.collection('course').doc(id).remove().then(() => {
            wx.showToast({ title: '删除成功', icon: 'success' });
            this.loadCourses();
          }).catch(err => {
            console.error('删除失败', err);
            wx.showToast({ title: '删除失败', icon: 'none' });
          });
        }
      }
    });
  },

  chooseCoverImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFile = res.tempFiles[0];
        const tempFilePath = tempFile.tempFilePath;

        wx.showLoading({ title: '上传中...' });

        const cloudPath = `course_cover/${Date.now()}.jpg`;

        wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: tempFilePath
        }).then(uploadRes => {
          wx.hideLoading();
          this.setData({ 'formData.coverImage': uploadRes.fileID });
        }).catch(err => {
          wx.hideLoading();
          console.error('上传失败', err);
          wx.showToast({ title: '上传失败', icon: 'none' });
        });
      }
    });
  },

  addCustomItem(e) {
    const type = e.currentTarget.dataset.type;
    this.chooseCustomMedia(type);
  },

  chooseCustomMedia(type) {
    wx.chooseMedia({
      count: 1,
      mediaType: type === 'video' ? ['video'] : ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFile = res.tempFiles[0];
        const tempFilePath = tempFile.tempFilePath;

        if (type === 'video' && tempFile.size > 50 * 1024 * 1024) {
          wx.showModal({
            title: '提示',
            content: '视频大小不能超过50MB',
            showCancel: false
          });
          return;
        }

        wx.showLoading({ title: '上传中...' });

        let fileExt = '.jpg';
        if (type === 'video') {
          const extMatch = tempFilePath.match(/\.(\w+)$/);
          fileExt = extMatch ? `.${extMatch[1]}` : '.mp4';
        }

        const cloudPath = `course_custom/${Date.now()}${fileExt}`;

        wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: tempFilePath
        }).then(uploadRes => {
          wx.hideLoading();
          const currentItems = this.data.formData.customContent || [];
          this.setData({
            'formData.customContent': [...currentItems, {
              url: uploadRes.fileID,
              description: '',
              mediaType: type
            }]
          });
        }).catch(err => {
          wx.hideLoading();
          console.error('上传失败', err);
          wx.showToast({ title: '上传失败', icon: 'none' });
        });
      }
    });
  },

  updateCustomItemDescription(e) {
    const index = e.currentTarget.dataset.index;
    const value = e.detail.value;
    const customContent = [...this.data.formData.customContent];
    if (customContent[index]) {
      customContent[index].description = value;
      this.setData({ 'formData.customContent': customContent });
    }
  },

  removeCustomItem(e) {
    const index = e.currentTarget.dataset.index;
    const customContent = [...this.data.formData.customContent];
    customContent.splice(index, 1);
    this.setData({ 'formData.customContent': customContent });
  },

  onCourseNameInput(e) {
    this.setData({ 'formData.courseName': e.detail.value });
  },

  onContentInput(e) {
    this.setData({ 'formData.content': e.detail.value });
  },

  onCorePhilosophyInput(e) {
    this.setData({ 'formData.corePhilosophy': e.detail.value });
  },

  onSummaryInput(e) {
    this.setData({ 'formData.summary': e.detail.value });
  },

  onParentAdviceInput(e) {
    this.setData({ 'formData.parentAdvice': e.detail.value });
  },

  onCoachAdviceInput(e) {
    this.setData({ 'formData.coachAdvice': e.detail.value });
  },

  onTrainingHoursInput(e) {
    this.setData({ 'formData.trainingHours': e.detail.value });
  },

  onSortInput(e) {
    this.setData({ 'formData.sort': parseInt(e.detail.value) || 0 });
  },

  closeModal() {
    this.setData({ showModal: false });
  },

  stopPropagation() { },

  confirmSubmit() {
    const { formData, editId } = this.data;

    if (!formData.courseName.trim()) {
      wx.showToast({ title: '请输入课程名称', icon: 'none' });
      return;
    }
    if (!formData.coverImage) {
      wx.showToast({ title: '请上传标题图片', icon: 'none' });
      return;
    }
    if (!formData.trainingHours) {
      wx.showToast({ title: '请输入训练课时', icon: 'none' });
      return;
    }

    const db = wx.cloud.database();
    const data = {
      courseName: formData.courseName,
      coverImage: formData.coverImage,
      content: formData.content,
      corePhilosophy: formData.corePhilosophy,
      summary: formData.summary,
      parentAdvice: formData.parentAdvice,
      coachAdvice: formData.coachAdvice,
      trainingHours: formData.trainingHours,
      customContent: formData.customContent || [],
      sort: formData.sort,
      status: true,
      updatedAt: new Date()
    };

    if (editId) {
      db.collection('course').doc(editId).update({ data }).then(() => {
        wx.showToast({ title: '修改成功', icon: 'success' });
        this.closeModal();
        this.loadCourses();
      }).catch(err => {
        console.error('修改失败', err);
        wx.showToast({ title: '修改失败', icon: 'none' });
      });
    } else {
      data.createdAt = new Date();
      db.collection('course').add({ data }).then(() => {
        wx.showToast({ title: '添加成功', icon: 'success' });
        this.closeModal();
        this.loadCourses();
      }).catch(err => {
        console.error('添加失败', err);
        wx.showToast({ title: '添加失败', icon: 'none' });
      });
    }
  }
});