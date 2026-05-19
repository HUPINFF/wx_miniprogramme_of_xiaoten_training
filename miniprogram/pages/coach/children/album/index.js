// pages/coach/children/album/index.js
Page({

  data: {
    childId: '',
    childName: '',
    yearMonthList: [],
    selectedYearMonth: '',
    currentData: {
      photos: [],
      photoCount: 0,
      videos: [],
      videoCount: 0
    },
    loading: true
  },

  onLoad(options) {
    const { childId, childName } = options;
    if (childId) {
      this.setData({ childId, childName: childName || '' });
      this.loadAlbumData(childId);
    }
  },

  loadAlbumData(childId) {
    this.setData({ loading: true });
    const db = wx.cloud.database();

    db.collection('photosAvideos')
      .where({ childId: childId })
      .orderBy('yearMonth', 'desc')
      .get()
      .then(res => {
        const list = res.data || [];
        const yearMonthList = list.map(item => item.yearMonth);
        
        let currentData = {
          photos: [],
          photoCount: 0,
          videos: [],
          videoCount: 0
        };
        let selectedYearMonth = '';

        if (yearMonthList.length > 0) {
          selectedYearMonth = yearMonthList[0];
          const selectedData = list.find(item => item.yearMonth === selectedYearMonth);
          if (selectedData) {
            currentData = {
              photos: selectedData.photos || [],
              photoCount: selectedData.photoCount || 0,
              videos: selectedData.videos || [],
              videoCount: selectedData.videoCount || 0
            };
          }
        }

        this.setData({
          yearMonthList,
          selectedYearMonth,
          currentData,
          loading: false
        });
      })
      .catch(err => {
        console.error('加载相册数据失败', err);
        this.setData({ loading: false });
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },

  selectMonth(e) {
    const yearMonth = e.currentTarget.dataset.month;
    if (yearMonth === this.data.selectedYearMonth) return;

    this.setData({ loading: true, selectedYearMonth: yearMonth });

    const db = wx.cloud.database();
    db.collection('photosAvideos')
      .where({ 
        childId: this.data.childId,
        yearMonth: yearMonth
      })
      .get()
      .then(res => {
        if (res.data && res.data.length > 0) {
          const data = res.data[0];
          this.setData({
            currentData: {
              photos: data.photos || [],
              photoCount: data.photoCount || 0,
              videos: data.videos || [],
              videoCount: data.videoCount || 0
            },
            loading: false
          });
        } else {
          this.setData({
            currentData: {
              photos: [],
              photoCount: 0,
              videos: [],
              videoCount: 0
            },
            loading: false
          });
        }
      })
      .catch(err => {
        console.error('加载月份数据失败', err);
        this.setData({ loading: false });
      });
  },

  previewPhoto(e) {
    const index = e.currentTarget.dataset.index;
    const photos = this.data.currentData.photos;
    wx.previewImage({
      current: photos[index],
      urls: photos
    });
  }
})
