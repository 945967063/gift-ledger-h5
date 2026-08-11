<script setup lang="ts">
  import { computed, ref, onMounted } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import useStore from '@/store';
  import { showToast } from 'vant';
  import type { EventType, RelationType } from '@/types/gift';
  import { EVENT_TYPE_MAP } from '@/store/modules/giftStore';

  const route = useRoute();
  const router = useRouter();
  const { gift } = useStore();

  const currentTab = ref<'received' | 'given'>('received');

  onMounted(() => {
    if (route.query.tab === 'given') {
      currentTab.value = 'given';
    } else {
      currentTab.value = 'received';
    }

    if (route.query.contact) {
      givenForm.value.contactName = String(route.query.contact);
    }
  });

  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/home');
    }
  };

  // ---------------- 新增收礼 (Received) ----------------
  const receivedForm = ref({
    title: '小明婚礼',
    date: '2024-01-15',
    type: 'wedding' as EventType,
    guests: [
      { name: '王大力', amount: 500, relation: '同学' as RelationType },
      { name: '李小花', amount: 200, relation: '同事' as RelationType },
      { name: '张三丰', amount: 1000, relation: '合作伙伴' as RelationType },
    ],
  });

  const showReceivedDatePicker = ref(false);
  const receivedDateArray = ref(['2024', '01', '15']);

  const onConfirmReceivedDate = ({ selectedValues }: { selectedValues: string[] }) => {
    receivedForm.value.date = selectedValues.join('-');
    showReceivedDatePicker.value = false;
  };

  const showReceivedTypePicker = ref(false);
  const typeColumns = Object.entries(EVENT_TYPE_MAP).map(([key, val]) => ({
    text: val.label,
    value: key,
  }));

  const onConfirmReceivedType = ({ selectedOptions }: any) => {
    receivedForm.value.type = selectedOptions[0].value as EventType;
    showReceivedTypePicker.value = false;
  };

  // Add Guest Modal
  const showAddGuestPopup = ref(false);
  const newGuest = ref({
    name: '',
    amount: '' as string | number,
    relation: '朋友' as RelationType,
  });

  const quickAmounts = [200, 500, 600, 800, 1000, 2000];

  const openAddGuest = () => {
    newGuest.value = {
      name: '',
      amount: '',
      relation: '朋友',
    };
    showAddGuestPopup.value = true;
  };

  const selectExistingContact = (contactName: string, relation: RelationType) => {
    newGuest.value.name = contactName;
    newGuest.value.relation = relation;
  };

  const confirmAddGuest = () => {
    if (!newGuest.value.name.trim()) {
      showToast('请输入宾客姓名');
      return;
    }
    if (!newGuest.value.amount || Number(newGuest.value.amount) <= 0) {
      showToast('请输入有效的礼金金额');
      return;
    }
    receivedForm.value.guests.push({
      name: newGuest.value.name.trim(),
      amount: Number(newGuest.value.amount),
      relation: newGuest.value.relation,
    });
    showAddGuestPopup.value = false;
    showToast({ message: '添加成功', icon: 'passed' });
  };

  const removeGuest = (index: number) => {
    receivedForm.value.guests.splice(index, 1);
  };

  const receivedTotalAmount = computed(() => {
    return receivedForm.value.guests.reduce((sum, g) => sum + Number(g.amount || 0), 0);
  });

  const saveReceivedRecord = () => {
    if (!receivedForm.value.title.trim()) {
      showToast('请输入事件名称');
      return;
    }
    if (receivedForm.value.guests.length === 0) {
      showToast('请至少添加一位宾客礼金');
      return;
    }

    gift.addReceivedEventAndGifts({
      title: receivedForm.value.title.trim(),
      date: receivedForm.value.date,
      type: receivedForm.value.type,
      guests: receivedForm.value.guests,
    });

    showToast({ message: '收礼记录保存成功！', icon: 'success' });
    setTimeout(() => {
      router.push('/home');
    }, 500);
  };

  // ---------------- 新增送礼 (Given) ----------------
  const givenForm = ref({
    contactName: '王大力',
    eventTitle: '王大力婚礼',
    date: '2024-06-18',
    type: 'wedding' as EventType,
    amount: 600 as number | string,
    remark: '祝新婚快乐，百年好合！',
  });

  const showGivenDatePicker = ref(false);
  const onConfirmGivenDate = ({ selectedValues }: { selectedValues: string[] }) => {
    givenForm.value.date = selectedValues.join('-');
    showGivenDatePicker.value = false;
  };

  const showGivenTypePicker = ref(false);
  const onConfirmGivenType = ({ selectedOptions }: any) => {
    givenForm.value.type = selectedOptions[0].value as EventType;
    showGivenTypePicker.value = false;
  };

  const setGivenAmount = (val: number) => {
    givenForm.value.amount = val;
  };

  const saveGivenRecord = () => {
    if (!givenForm.value.contactName.trim()) {
      showToast('请输入对方姓名');
      return;
    }
    if (!givenForm.value.eventTitle.trim()) {
      showToast('请输入事件名称');
      return;
    }
    if (!givenForm.value.amount || Number(givenForm.value.amount) <= 0) {
      showToast('请输入有效的礼金金额');
      return;
    }

    gift.addGivenRecord({
      contactName: givenForm.value.contactName.trim(),
      eventTitle: givenForm.value.eventTitle.trim(),
      date: givenForm.value.date,
      type: givenForm.value.type,
      amount: Number(givenForm.value.amount),
      remark: givenForm.value.remark.trim(),
    });

    showToast({ message: '送礼记录保存成功！', icon: 'success' });
    setTimeout(() => {
      router.push('/home');
    }, 500);
  };
</script>

<template>
  <div class="record-page">
    <!-- Top Navigation Header -->
    <div class="record-header">
      <div class="header-left" @click="goBack">
        <van-icon name="arrow-left" />
      </div>
      <div class="header-title">
        {{ currentTab === 'received' ? '新增收礼记录' : '新增送礼记录' }}
      </div>
      <div class="header-right">
        <div
          class="type-switch-pill"
          @click="currentTab = currentTab === 'received' ? 'given' : 'received'"
        >
          <span>{{ currentTab === 'received' ? '切送礼' : '切收礼' }}</span>
        </div>
      </div>
    </div>

    <!-- Segmented Tab Bar -->
    <div class="mode-segment">
      <div
        class="segment-item"
        :class="{ active: currentTab === 'received' }"
        @click="currentTab = 'received'"
      >
        <span>收礼 (我办的)</span>
      </div>
      <div
        class="segment-item"
        :class="{ active: currentTab === 'given' }"
        @click="currentTab = 'given'"
      >
        <span>送礼 (参加的)</span>
      </div>
    </div>

    <!-- 1. 新增收礼记录 (Record-Received) -->
    <div v-if="currentTab === 'received'" class="form-container">
      <!-- 事件名称 -->
      <div class="form-item">
        <label class="form-label">事件名称</label>
        <div class="input-card">
          <input
            v-model="receivedForm.title"
            type="text"
            placeholder="请输入事件名称，如：小明婚礼"
          />
        </div>
      </div>

      <!-- 事件日期 -->
      <div class="form-item">
        <label class="form-label">事件日期</label>
        <div class="input-card picker-card" @click="showReceivedDatePicker = true">
          <span class="picker-val">{{ receivedForm.date }}</span>
          <van-icon name="arrow-down" class="dropdown-icon" />
        </div>
      </div>

      <!-- 事件类型 -->
      <div class="form-item">
        <label class="form-label">事件类型</label>
        <div class="input-card picker-card" @click="showReceivedTypePicker = true">
          <span class="picker-val">{{ EVENT_TYPE_MAP[receivedForm.type]?.label || '请选择' }}</span>
          <van-icon name="arrow-down" class="dropdown-icon" />
        </div>
      </div>

      <!-- 宾客与礼金名单 -->
      <div class="guests-section">
        <div class="guests-section-header">
          <span class="guests-title">宾客与礼金名单</span>
          <button class="add-guest-btn" @click="openAddGuest">
            <van-icon name="plus" />
            添加宾客
          </button>
        </div>

        <div class="guests-list">
          <div v-for="(guest, idx) in receivedForm.guests" :key="idx" class="guest-row-card">
            <div class="guest-name">{{ guest.name }}</div>
            <div class="guest-right">
              <span class="guest-amount">¥{{ Number(guest.amount).toLocaleString() }}</span>
              <div class="delete-icon-btn" @click="removeGuest(idx)">
                <van-icon name="delete-o" />
              </div>
            </div>
          </div>

          <div v-if="receivedForm.guests.length === 0" class="empty-guest-hint">
            点击上方“+ 添加宾客”添加收礼名单
          </div>
        </div>

        <!-- Summary Footer -->
        <div class="summary-footer-row">
          <div class="count-text">共 {{ receivedForm.guests.length }} 人送礼</div>
          <div class="total-box">
            <span class="total-label">合计:</span>
            <span class="total-amount">¥{{ receivedTotalAmount.toLocaleString() }}</span>
          </div>
        </div>
      </div>

      <!-- Save Button -->
      <button class="primary-save-btn" @click="saveReceivedRecord">保存记录</button>
    </div>

    <!-- 2. 新增送礼记录 (Record-Given) -->
    <div v-else class="form-container">
      <!-- 对方姓名 -->
      <div class="form-item">
        <label class="form-label">对方姓名</label>
        <div class="input-card">
          <input
            v-model="givenForm.contactName"
            type="text"
            placeholder="请输入对方姓名，如：王大力"
          />
        </div>
      </div>

      <!-- 事件名称 -->
      <div class="form-item">
        <label class="form-label">事件名称</label>
        <div class="input-card">
          <input
            v-model="givenForm.eventTitle"
            type="text"
            placeholder="请输入事件名称，如：王大力婚礼"
          />
        </div>
      </div>

      <!-- 事件日期 -->
      <div class="form-item">
        <label class="form-label">事件日期</label>
        <div class="input-card picker-card" @click="showGivenDatePicker = true">
          <span class="picker-val">{{ givenForm.date }}</span>
          <van-icon name="arrow-down" class="dropdown-icon" />
        </div>
      </div>

      <!-- 事件类型 -->
      <div class="form-item">
        <label class="form-label">事件类型</label>
        <div class="input-card picker-card" @click="showGivenTypePicker = true">
          <span class="picker-val">{{ EVENT_TYPE_MAP[givenForm.type]?.label || '请选择' }}</span>
          <van-icon name="arrow-down" class="dropdown-icon" />
        </div>
      </div>

      <!-- 礼金金额 -->
      <div class="form-item">
        <label class="form-label">礼金金额</label>
        <div class="input-card amount-input-card">
          <span class="currency-symbol">¥</span>
          <input v-model="givenForm.amount" type="number" placeholder="0" />
        </div>

        <!-- Quick Amount Chips -->
        <div class="quick-chip-bar">
          <div
            v-for="amt in quickAmounts"
            :key="amt"
            class="chip-item"
            :class="{ selected: Number(givenForm.amount) === amt }"
            @click="setGivenAmount(amt)"
          >
            ¥{{ amt }}
          </div>
        </div>
      </div>

      <!-- 备注 -->
      <div class="form-item">
        <label class="form-label">备注</label>
        <div class="input-card textarea-card">
          <textarea
            v-model="givenForm.remark"
            rows="3"
            placeholder="请输入祝福语或相关备注，如：祝新婚快乐，百年好合！"
          />
        </div>
      </div>

      <!-- Save Button -->
      <button class="primary-save-btn" @click="saveGivenRecord">保存记录</button>
    </div>

    <!-- Date Picker Popups -->
    <van-popup v-model:show="showReceivedDatePicker" position="bottom" round>
      <van-date-picker
        v-model="receivedDateArray"
        title="选择事件日期"
        @confirm="onConfirmReceivedDate"
        @cancel="showReceivedDatePicker = false"
      />
    </van-popup>

    <van-popup v-model:show="showGivenDatePicker" position="bottom" round>
      <van-date-picker
        title="选择事件日期"
        @confirm="onConfirmGivenDate"
        @cancel="showGivenDatePicker = false"
      />
    </van-popup>

    <!-- Event Type Pickers -->
    <van-popup v-model:show="showReceivedTypePicker" position="bottom" round>
      <van-picker
        :columns="typeColumns"
        title="选择事件类型"
        @confirm="onConfirmReceivedType"
        @cancel="showReceivedTypePicker = false"
      />
    </van-popup>

    <van-popup v-model:show="showGivenTypePicker" position="bottom" round>
      <van-picker
        :columns="typeColumns"
        title="选择事件类型"
        @confirm="onConfirmGivenType"
        @cancel="showGivenTypePicker = false"
      />
    </van-popup>

    <!-- Add Guest Bottom Popup -->
    <van-popup v-model:show="showAddGuestPopup" position="bottom" round class="add-guest-popup">
      <div class="popup-box">
        <div class="popup-header">
          <span class="popup-title">添加送礼宾客</span>
          <van-icon name="cross" @click="showAddGuestPopup = false" />
        </div>

        <div class="popup-form">
          <div class="form-item">
            <label class="form-label">宾客姓名</label>
            <div class="input-card">
              <input
                v-model="newGuest.name"
                type="text"
                placeholder="请输入姓名，或从下方快捷选择"
              />
            </div>

            <!-- Quick Contacts list -->
            <div class="quick-contacts-row">
              <span
                v-for="c in gift.contacts.slice(0, 6)"
                :key="c.id"
                class="contact-pill"
                @click="selectExistingContact(c.name, c.relation)"
              >
                {{ c.name }}
              </span>
            </div>
          </div>

          <div class="form-item">
            <label class="form-label">送礼金额 (¥)</label>
            <div class="input-card">
              <input
                v-model="newGuest.amount"
                type="number"
                placeholder="请输入礼金金额，如：500"
              />
            </div>
            <div class="quick-chip-bar popup-chips">
              <div
                v-for="amt in [200, 500, 600, 800, 1000, 2000]"
                :key="amt"
                class="chip-item"
                :class="{ selected: Number(newGuest.amount) === amt }"
                @click="newGuest.amount = amt"
              >
                ¥{{ amt }}
              </div>
            </div>
          </div>

          <button class="primary-save-btn" @click="confirmAddGuest">确认加入名单</button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style lang="scss" scoped>
  .record-page {
    padding: 10px 16px 20px 16px;
    background-color: var(--color-background-2);
    box-sizing: border-box;
    width: 100%;
    overflow-x: hidden;
  }

  .record-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0 14px 0;

    .header-left {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      font-size: 19px;
      color: var(--app-text-primary);
      cursor: pointer;
    }

    .header-title {
      font-size: 17px;
      font-weight: 700;
      color: var(--app-text-primary);
    }

    .header-right {
      width: 60px;
      display: flex;
      justify-content: flex-end;

      .type-switch-pill {
        font-size: 11px;
        background-color: var(--app-primary-light);
        color: var(--app-primary);
        padding: 3px 8px;
        border-radius: 10px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
      }
    }
  }

  /* Segmented control */
  .mode-segment {
    display: flex;
    background-color: rgba(0, 0, 0, 0.05);
    border-radius: 12px;
    padding: 3px;
    margin-bottom: 16px;
    width: 100%;
    box-sizing: border-box;

    .segment-item {
      flex: 1;
      text-align: center;
      padding: 7px 0;
      font-size: 13px;
      font-weight: 600;
      color: var(--app-text-secondary);
      border-radius: 9px;
      transition: all 0.2s ease;
      cursor: pointer;

      &.active {
        background-color: var(--app-card-bg);
        color: var(--app-primary);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
      }
    }
  }

  .form-container {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
  }

  .form-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;

    .form-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--app-text-primary);
    }

    .input-card {
      background-color: var(--app-card-bg);
      border-radius: 12px;
      border: 1px solid var(--app-border);
      padding: 10px 12px;
      display: flex;
      align-items: center;
      width: 100%;
      box-sizing: border-box;

      input {
        width: 100%;
        border: none;
        outline: none;
        background: transparent;
        font-size: 14px;
        color: var(--app-text-primary);

        &::placeholder {
          color: var(--app-text-muted);
          font-size: 13px;
        }
      }

      &.picker-card {
        justify-content: space-between;
        cursor: pointer;

        .picker-val {
          font-size: 14px;
          color: var(--app-text-primary);
        }

        .dropdown-icon {
          color: var(--app-text-secondary);
          font-size: 13px;
        }
      }

      &.amount-input-card {
        .currency-symbol {
          font-size: 15px;
          font-weight: 700;
          color: var(--app-text-primary);
          margin-right: 4px;
        }

        input {
          font-size: 16px;
          font-weight: 700;
        }
      }

      &.textarea-card {
        padding: 10px 12px;

        textarea {
          width: 100%;
          border: none;
          outline: none;
          background: transparent;
          font-size: 13px;
          color: var(--app-text-primary);
          resize: none;
          line-height: 1.4;

          &::placeholder {
            color: var(--app-text-muted);
          }
        }
      }
    }

    .quick-chip-bar {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 2px;

      .chip-item {
        padding: 4px 10px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        background-color: var(--app-card-bg);
        border: 1px solid var(--app-border);
        color: var(--app-text-secondary);
        cursor: pointer;

        &.selected {
          background-color: var(--app-primary-light);
          border-color: var(--app-primary);
          color: var(--app-primary);
        }
      }
    }
  }

  /* Guests List Section in Record-Received */
  .guests-section {
    margin-top: 4px;
    width: 100%;

    .guests-section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;

      .guests-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--app-text-primary);
      }

      .add-guest-btn {
        background: transparent;
        border: 1px solid #d4a373;
        color: #967139;
        font-size: 12px;
        font-weight: 600;
        padding: 3px 10px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        gap: 3px;
        cursor: pointer;

        &:active {
          background-color: rgba(212, 163, 115, 0.1);
        }
      }
    }

    .guests-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;

      .guest-row-card {
        background-color: var(--app-card-bg);
        border-radius: 12px;
        border: 1px solid var(--app-border);
        padding: 10px 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-sizing: border-box;

        .guest-name {
          font-size: 14px;
          font-weight: 700;
          color: var(--app-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .guest-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;

          .guest-amount {
            font-size: 14px;
            font-weight: 700;
            color: #27ae60;
          }

          .delete-icon-btn {
            font-size: 16px;
            color: #999;
            cursor: pointer;
            padding: 2px;

            &:active {
              color: #e53935;
            }
          }
        }
      }

      .empty-guest-hint {
        padding: 14px;
        text-align: center;
        font-size: 12px;
        color: var(--app-text-muted);
        background-color: var(--app-card-bg);
        border-radius: 12px;
        border: 1px dashed var(--app-border);
      }
    }

    .summary-footer-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 2px 4px 2px;

      .count-text {
        font-size: 13px;
        color: var(--app-text-secondary);
        font-weight: 500;
      }

      .total-box {
        display: flex;
        align-items: baseline;
        gap: 4px;

        .total-label {
          font-size: 14px;
          font-weight: 700;
          color: var(--app-text-primary);
        }

        .total-amount {
          font-size: 17px;
          font-weight: 800;
          color: #c3423f;
        }
      }
    }
  }

  /* Primary Save Button */
  .primary-save-btn {
    width: 100%;
    background-color: #c3423f;
    color: #ffffff;
    font-size: 15px;
    font-weight: 700;
    padding: 13px 0;
    border-radius: 12px;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(195, 66, 63, 0.25);
    transition: all 0.2s ease;
    margin-top: 8px;
    box-sizing: border-box;

    &:active {
      transform: scale(0.98);
      background-color: #a83431;
    }
  }

  /* Add Guest Popup */
  .add-guest-popup {
    .popup-box {
      padding: 16px;
      background-color: var(--color-background-2);

      .popup-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 14px;

        .popup-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--app-text-primary);
        }

        .van-icon {
          font-size: 17px;
          color: var(--app-text-secondary);
          cursor: pointer;
        }
      }

      .popup-form {
        display: flex;
        flex-direction: column;
        gap: 12px;

        .quick-contacts-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 4px;

          .contact-pill {
            padding: 3px 8px;
            background-color: var(--app-card-bg);
            border: 1px solid var(--app-border);
            border-radius: 10px;
            font-size: 12px;
            color: var(--app-text-primary);
            cursor: pointer;

            &:active {
              background-color: var(--app-primary-light);
              color: var(--app-primary);
            }
          }
        }

        .popup-chips {
          margin-top: 4px;
        }
      }
    }
  }
</style>
