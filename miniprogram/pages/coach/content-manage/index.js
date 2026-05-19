// pages/coach/content-manage/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    currentTab: 'banner',
    bannerList: [],
    newsList: [],
    momentList: [],
    growthList: [],
    showModal: false,
    modalTitle: '',
    editId: null,
    formData: {
      image: '',
      video: '',
      mediaType: 'image',
      text: '',
      sort: 0,
      time: '',
      title: '',
      description: '',
      items: [],
      category: 'fitness'
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
    this.loadGrowth();
  },

  // 加载轮播图
  loadBanners() {
    const db = wx.cloud.database();
    db.collection('banners').orderBy('sort', 'asc').get().then(res => {
      this.setData({ bannerList: res.data });
    }).catch(err => {
      console.error('加载轮播图失败', err);
    });
  },

  // 加载最新动态
  loadNews() {
    const db = wx.cloud.database();
    db.collection('news').orderBy('sort', 'asc').get().then(res => {
      this.setData({ newsList: res.data });
    }).catch(err => {
      console.error('加载动态失败', err);
    });
  },

  // 加载精彩瞬间
  loadMoments() {
    const db = wx.cloud.database();
    db.collection('moments').orderBy('sort', 'asc').get().then(res => {
      console.log('加载的精彩瞬间:', res.data);
      this.setData({ momentList: res.data });
    }).catch(err => {
      console.error('加载精彩瞬间失败', err);
    });
  },

  // 加载成长案例
  loadGrowth() {
    const db = wx.cloud.database();
    db.collection('growth_exp').orderBy('sort', 'asc').get().then(res => {
      console.log('加载的成长案例:', res.data);
      const growthList = res.data.map(item => {
        let itemCount = 0;
        let coverImage = '';
        if (item.items && item.items.length > 0) {
          itemCount = item.items.length;
          coverImage = item.items[0].url;
        }
        return {
          ...item,
          itemCount,
          coverImage
        };
      });
      this.setData({ growthList });
    }).catch(err => {
      console.error('加载成长案例失败', err);
    });
  },

  // 切换Tab
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
  },

  // 切换媒体类型
  switchMediaType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      'formData.mediaType': type,
      'formData.image': type === 'image' ? '' : this.data.formData.image,
      'formData.video': type === 'video' ? '' : this.data.formData.video
    });
  },

  // 添加轮播图
  addBanner() {
    this.setData({
      showModal: true,
      modalTitle: '添加轮播图',
      editId: null,
      formData: {
        image: '',
        video: '',
        mediaType: 'image',
        text: '',
        sort: 0,
        time: '',
        title: '',
        description: '',
        items: [],
        category: 'fitness'
      }
    });
  },

  // 编辑轮播图
  editBanner(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.bannerList.find(i => i._id === id);
    this.setData({
      showModal: true,
      modalTitle: '编辑轮播图',
      editId: id,
      formData: {
        image: item.image,
        video: '',
        mediaType: 'image',
        text: item.text || '',
        sort: item.sort,
        time: '',
        title: '',
        description: '',
        items: [],
        category: 'fitness'
      }
    });
  },

  // 删除轮播图
  deleteBanner(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个轮播图吗？',
      success: (res) => {
        if (res.confirm) {
          const db = wx.cloud.database();
          db.collection('banners').doc(id).remove().then(() => {
            wx.showToast({ title: '删除成功', icon: "success" });
            this.loadBanners();
          }).catch(err => {
            console.error('删除失败，你没有权限删除该轮播图', err);
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
      showModal: true,
      modalTitle: '添加动态',
      editId: null,
      formData: {
        image: '',
        video: '',
        mediaType: 'image',
        text: '',
        sort: 0,
        time: today,
        title: '',
        description: '',
        items: [],
        category: 'fitness'
      }
    });
  },

  // 编辑动态
  editNews(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.newsList.find(i => i._id === id);
    this.setData({
      showModal: true,
      modalTitle: '编辑动态',
      editId: id,
      formData: {
        image: item.image || '',
        video: '',
        mediaType: 'image',
        text: item.title,
        sort: item.sort,
        time: item.time,
        title: '',
        description: '',
        items: [],
        category: 'fitness'
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
        video: '',
        mediaType: 'image',
        text: '',
        sort: 0,
        time: '',
        title: '',
        description: '',
        items: [],
        category: 'fitness'
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
        image: item.image || '',
        video: item.video || '',
        mediaType: item.mediaType || 'image',
        text: item.title,
        sort: item.sort,
        time: '',
        title: '',
        description: '',
        items: [],
        category: 'fitness'
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

  // 添加成长案例
  addGrowth() {
    this.setData({
      showModal: true,
      modalTitle: '添加成长案例',
      editId: null,
      formData: {
        image: '',
        video: '',
        mediaType: 'image',
        text: '',
        sort: 0,
        time: '',
        title: '',
        description: '',
        items: [],
        category: 'fitness'
      }
    });
  },

  // 编辑成长案例
  editGrowth(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.growthList.find(i => i._id === id);
    console.log('编辑成长案例:', item);
    this.setData({
      showModal: true,
      modalTitle: '编辑成长案例',
      editId: id,
      formData: {
        image: '',
        video: '',
        mediaType: 'image',
        text: '',
        sort: item.sort || 0,
        time: '',
        title: item.title || '',
        description: item.description || '',
        items: item.items || [],
        category: item.category || 'fitness'
      }
    });
  },

  // 删除成长案例
  deleteGrowth(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个成长案例吗？',
      success: (res) => {
        if (res.confirm) {
          const db = wx.cloud.database();
          db.collection('growth_exp').doc(id).remove().then(() => {
            wx.showToast({ title: '删除成功', icon: 'success' });
            this.loadGrowth();
          }).catch(err => {
            console.error('删除失败', err);
            wx.showToast({ title: '删除失败', icon: 'none' });
          });
        }
      }
    });
  },

  // 添加成长案例的媒体
  addGrowthMedia() {
    wx.showActionSheet({
      itemList: ['添加图片', '添加视频'],
      success: (res) => {
        const type = res.tapIndex === 0 ? 'image' : 'video';
        this.chooseGrowthMedia(type);
      }
    });
  },

  // 选择成长案例的媒体
  chooseGrowthMedia(type) {
    wx.chooseMedia({
      count: 1,
      mediaType: type === 'video' ? ['video'] : ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        console.log('选择的媒体:', res);
        const tempFile = res.tempFiles[0];
        const tempFilePath = tempFile.tempFilePath;

        // 检查视频大小
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

        const cloudPath = `growth_exp/${Date.now()}${fileExt}`;

        wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: tempFilePath
        }).then(uploadRes => {
          wx.hideLoading();
          console.log('上传成功:', uploadRes.fileID);

          const currentItems = this.data.formData.items || [];
          this.setData({
            'formData.items': [...currentItems, {
              url: uploadRes.fileID,
              discrip: '',
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

  // 更新成长案例项的描述
  updateItemDiscrip(e) {
    const index = e.currentTarget.dataset.index;
    const value = e.detail.value;
    const items = [...this.data.formData.items];
    if (items[index]) {
      items[index].discrip = value;
      this.setData({ 'formData.items': items });
    }
  },

  // 移除成长案例项
  removeGrowthItem(e) {
    const index = e.currentTarget.dataset.index;
    const items = [...this.data.formData.items];
    items.splice(index, 1);
    this.setData({ 'formData.items': items });
  },

  // 输入成长案例标题
  onTitleInput(e) {
    this.setData({ 'formData.title': e.detail.value });
  },

  // 输入成长案例描述
  onDescriptionInput(e) {
    this.setData({ 'formData.description': e.detail.value });
  },

  // 选择成长案例分类
  selectCategory(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({ 'formData.category': category });
  },

  // 选择媒体（图片或视频）
  chooseMedia() {
    const { currentTab, formData } = this.data;
    const isVideo = currentTab === 'moment' && formData.mediaType === 'video';

    wx.chooseMedia({
      count: 1,
      mediaType: isVideo ? ['video'] : ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        console.log('选择的文件:', res);
        const tempFile = res.tempFiles[0];
        const tempFilePath = tempFile.tempFilePath;

        // 如果是视频，检查文件大小
        if (isVideo && tempFile.size > 50 * 1024 * 1024) {
          wx.showModal({
            title: '提示',
            content: '视频大小不能超过50MB',
            showCancel: false
          });
          return;
        }

        wx.showLoading({ title: '上传中...' });

        // 根据文件实际类型获取扩展名
        let fileExt = '.jpg';
        if (isVideo) {
          const extMatch = tempFilePath.match(/\.(\w+)$/);
          fileExt = extMatch ? `.${extMatch[1]}` : '.mp4';
        }

        const cloudPath = `content/${Date.now()}${fileExt}`;
        console.log('上传路径:', cloudPath);

        wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: tempFilePath
        }).then(uploadRes => {
          wx.hideLoading();
          console.log('上传成功:', uploadRes);
          if (isVideo) {
            this.setData({ 'formData.video': uploadRes.fileID });
          } else {
            this.setData({ 'formData.image': uploadRes.fileID });
          }
        }).catch(err => {
          wx.hideLoading();
          console.error('上传失败', err);
          wx.showToast({ title: '上传失败，请重试', icon: 'none' });
        });
      },
      fail: (err) => {
        console.error('选择文件失败', err);
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
  stopPropagation() { },

  // 确认提交
  confirmSubmit() {
    const { currentTab, formData, editId } = this.data;

    // 成长案例验证
    if (currentTab === 'growth') {
      if (!formData.category) {
        wx.showToast({ title: '请选择分类', icon: 'none' });
        return;
      }
      if (!formData.title.trim()) {
        wx.showToast({ title: '请输入标题', icon: 'none' });
        return;
      }
      if (!formData.items || formData.items.length === 0) {
        wx.showToast({ title: '请添加至少一张图片或视频', icon: 'none' });
        return;
      }
    }

    const openid = wx.getStorageSync('openid');
    // 验证
    if (currentTab === 'banner') {
      if (!formData.image) {
        wx.showToast({ title: '请上传图片', icon: 'none' });
        return;
      }
    }

    if (currentTab !== 'news' && currentTab !== 'growth') {
      const isVideo = currentTab === 'moment' && formData.mediaType === 'video';
      if (isVideo && !formData.video) {
        wx.showToast({ title: '请上传视频', icon: 'none' });
        return;
      }
      if (!isVideo && !formData.image) {
        wx.showToast({ title: '请上传图片', icon: 'none' });
        return;
      }
    }

    if (currentTab !== 'growth' && !formData.text.trim()) {
      wx.showToast({ title: '请输入内容', icon: 'none' });
      return;
    }

    const db = wx.cloud.database();
    let collection = '';
    let data = {};

    if (currentTab === 'banner') {
      collection = 'banners';
      data = {
        image: formData.image,
        text: formData.text,
        sort: formData.sort,
        status: true,
        updatedAt: new Date()
      };
    } else if (currentTab === 'news') {
      collection = 'news';
      data = {
        image: formData.image || '',
        title: formData.text,
        time: formData.time,
        sort: formData.sort,
        status: true,
        updatedAt: new Date()
      };
    } else if (currentTab === 'moment') {
      collection = 'moments';
      const isVideo = formData.mediaType === 'video';
      data = {
        image: isVideo ? '' : formData.image,
        video: isVideo ? formData.video : '',
        mediaType: isVideo ? 'video' : 'image',
        title: formData.text,
        sort: formData.sort,
        status: true,
        updatedAt: new Date()
      };
    } else if (currentTab === 'growth') {
      collection = 'growth_exp';
      data = {
        title: formData.title,
        description: formData.description,
        items: formData.items || [],
        sort: formData.sort,
        category: formData.category,
        status: true,
        updatedAt: new Date()
      };
    }

    if (editId) {
      // 更新
      db.collection(collection).doc(editId).update({ data }).then(() => {
        wx.showToast({ title: '修改成功', icon: 'success' });
        this.closeModal();
        this.loadAllData();
      }).catch(err => {
        console.error('修改失败', err);
        wx.showToast({ title: '修改失败', icon: 'none' });
      })
    } else {
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

  onHide() { },
  onUnload() { },
  onPullDownRefresh() { },
  onReachBottom() { },
  onShareAppMessage() { }
})
