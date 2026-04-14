// components/add-child-modal/index.js
Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    editData: {
      type: Object,
      value: null
    }
  },
  
  data: {
    isEdit: false,
    formData: {
      name: '',
      age: '',
      gender: 'male',
      birthday: '',
      remark: ''
    }
  },
  
  observers: {
    'editData': function(editData) {
      console.log('editData 变化:', editData);
      if (editData && editData._id) {
        this.setData({
          isEdit: true,
          formData: {
            name: editData.name || '',
            age: editData.age || '',
            gender: editData.gender || 'male',
            birthday: editData.birthday || '',
            remark: editData.remark || ''
          }
        });
      } else {
        this.setData({
          isEdit: false,
          formData: {
            name: '',
            age: '',
            gender: 'male',
            birthday: '',
            remark: ''
          }
        });
      }
    }
  },
  
  methods: {
    // 关闭弹窗
    close() {
      this.triggerEvent('close');
    },
    
    // 阻止冒泡
    stopPropagation() {},
    
    // 输入姓名
    onNameInput(e) {
      this.setData({ 'formData.name': e.detail.value });
    },
    
    // 输入年龄
    onAgeInput(e) {
      this.setData({ 'formData.age': e.detail.value });
    },
    
    // 选择性别
    selectGender(e) {
      const gender = e.currentTarget.dataset.gender;
      this.setData({ 'formData.gender': gender });
    },
    
    // 选择生日
    onBirthdayChange(e) {
      this.setData({ 'formData.birthday': e.detail.value });
    },
    
    // 输入备注
    onRemarkInput(e) {
      this.setData({ 'formData.remark': e.detail.value });
    },
    
    // 确认提交
    confirm() {
      const { name, age, gender } = this.data.formData;
      
      // 验证
      if (!name.trim()) {
        wx.showToast({ title: '请填写孩子姓名', icon: 'none' });
        return;
      }
      if (!age) {
        wx.showToast({ title: '请填写年龄', icon: 'none' });
        return;
      }
      const ageNum = parseInt(age);
      if (isNaN(ageNum) || ageNum < 0 || ageNum > 25) {
        wx.showToast({ title: '请输入有效年龄(0-18岁)', icon: 'none' });
        return;
      }
      
      this.triggerEvent('confirm', {
        isEdit: this.data.isEdit,
        formData: this.data.formData
      });
    }
  }
});