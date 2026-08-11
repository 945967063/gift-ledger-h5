<script setup lang="ts">
  import { computed, ref, onMounted } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import useStore from '@/store';
  import { showToast } from 'vant';
  import { getPaymentMethodLabel } from '@/store/modules/giftStore';

  const route = useRoute();
  const router = useRouter();
  const { gift } = useStore();

  const contactName = ref('王大力');

  onMounted(() => {
    if (route.query.name) {
      contactName.value = String(route.query.name);
    }
  });

  const ledger = computed(() => {
    return gift.getContactDetail(contactName.value);
  });

  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/contacts');
    }
  };

  const showEditModal = ref(false);
  const savingContact = ref(false);
  const editForm = ref({
    tag: '',
    phone: '',
    remark: '',
  });

  const openEdit = () => {
    if (ledger.value.contact) {
      editForm.value = {
        tag: ledger.value.contact.tag || '',
        phone: ledger.value.contact.phone || '',
        remark: ledger.value.contact.remark || '',
      };
      showEditModal.value = true;
    } else {
      showToast('暂无该联系人信息');
    }
  };

  const saveContactEdit = async () => {
    if (ledger.value.contact) {
      if (savingContact.value) return;
      savingContact.value = true;
      try {
        await gift.updateContact(ledger.value.contact.id, editForm.value);
        showToast({ message: '修改成功', icon: 'passed' });
        showEditModal.value = false;
      } catch {
        // 请求层已统一提示错误，保留编辑内容方便重试。
      } finally {
        savingContact.value = false;
      }
    }
  };

  const goToRecordForContact = () => {
    router.push({
      path: '/record',
      query: { contact: contactName.value, tab: 'given' },
    });
  };
</script>

<template>
  <div class="contact-detail-page">
    <!-- Header -->
    <div class="detail-top-nav">
      <div class="nav-left" @click="goBack">
        <van-icon name="arrow-left" />
      </div>
      <div class="nav-title">联系人详情</div>
      <div class="nav-right" @click="openEdit">
        <van-icon name="edit" />
      </div>
    </div>

    <!-- Contact Profile Section -->
    <div class="profile-card-section">
      <div class="large-avatar-box">
        <span>{{ contactName.slice(0, 1) }}</span>
      </div>
      <div class="profile-name">{{ contactName }}</div>
      <div class="profile-subtitle">
        {{ ledger.contact?.tag || ledger.contact?.relation || '暂无标签' }}
      </div>
    </div>

    <!-- Human Relationship Balance Card -->
    <div class="ledger-card">
      <div class="ledger-card-header">
        <span class="header-label">人情对账</span>
        <span
          class="badge-pill"
          :class="{
            'is-green': ledger.diff > 0,
            'is-red': ledger.diff < 0,
          }"
        >
          {{ ledger.balanceBadge }}
        </span>
      </div>

      <div class="ledger-card-divider" />

      <div class="ledger-metrics-grid">
        <div class="metric-block">
          <div class="m-title">他送我 (共{{ ledger.receivedCount }}笔)</div>
          <div class="m-val green-val">¥{{ ledger.totalReceived.toLocaleString() }}</div>
        </div>

        <div class="metric-block">
          <div class="m-title">我送他 (共{{ ledger.givenCount }}笔)</div>
          <div class="m-val red-val">¥{{ ledger.totalGiven.toLocaleString() }}</div>
        </div>
      </div>
    </div>

    <!-- Exchange History Timeline List -->
    <div class="history-section">
      <div class="section-title">往来记录</div>

      <div class="history-list">
        <div v-for="rec in ledger.records" :key="rec.id" class="history-item-card">
          <div class="history-left">
            <div class="type-circle" :class="rec.type === 'received' ? 'is-rec' : 'is-giv'">
              {{ rec.type === 'received' ? '收' : '送' }}
            </div>
            <div class="history-info">
              <div class="history-title">{{ rec.eventTitle }}</div>
              <div class="history-date">{{ rec.eventDate }} · {{ getPaymentMethodLabel(rec) }}</div>
            </div>
          </div>

          <div class="history-amount" :class="rec.type === 'received' ? 'green-text' : 'red-text'">
            {{ rec.type === 'received' ? '+' : '-' }}¥{{ Number(rec.amount).toLocaleString() }}
          </div>
        </div>

        <div v-if="ledger.records.length === 0" class="empty-history">
          <van-empty description="暂无该联系人的往来记录" image="search" />
        </div>
      </div>
    </div>

    <!-- Quick Add Record Action Button -->
    <div class="bottom-action-container">
      <button class="add-exchange-btn" @click="goToRecordForContact">
        <van-icon name="plus" />
        为 {{ contactName }} 记一笔
      </button>
    </div>

    <!-- Edit Contact Modal -->
    <van-popup v-model:show="showEditModal" position="bottom" round class="edit-popup">
      <div class="edit-modal-box">
        <div class="edit-modal-header">
          <span>编辑联系人信息</span>
          <van-icon name="cross" @click="showEditModal = false" />
        </div>

        <div class="edit-modal-form">
          <div class="form-item">
            <label class="form-label">个性标签</label>
            <div class="input-card">
              <input v-model="editForm.tag" type="text" placeholder="如：大学同学" />
            </div>
          </div>

          <div class="form-item">
            <label class="form-label">联系电话</label>
            <div class="input-card">
              <input v-model="editForm.phone" type="tel" placeholder="请输入电话" />
            </div>
          </div>

          <div class="form-item">
            <label class="form-label">备注信息</label>
            <div class="input-card">
              <input v-model="editForm.remark" type="text" placeholder="请输入备注" />
            </div>
          </div>

          <button class="primary-save-btn" :disabled="savingContact" @click="saveContactEdit">
            {{ savingContact ? '正在保存…' : '保存修改' }}
          </button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style lang="scss" scoped>
  .contact-detail-page {
    padding: 10px 16px 20px 16px;
    background-color: var(--color-background-2);
    box-sizing: border-box;
    width: 100%;
    overflow-x: hidden;
  }

  .detail-top-nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0 14px 0;

    .nav-left,
    .nav-right {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      font-size: 19px;
      color: var(--app-text-primary);
      cursor: pointer;
    }

    .nav-left {
      justify-content: flex-start;
    }

    .nav-right {
      justify-content: flex-end;
    }

    .nav-title {
      font-size: 17px;
      font-weight: 700;
      color: var(--app-text-primary);
    }
  }

  /* Profile Avatar Section */
  .profile-card-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10px 0 18px 0;

    .large-avatar-box {
      width: 68px;
      height: 68px;
      border-radius: 50%;
      background-color: #faf4ee;
      border: 1.5px solid #e8d8c8;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: 700;
      color: #b08968;
      box-shadow: 0 3px 10px rgba(176, 137, 104, 0.12);
      margin-bottom: 10px;
    }

    .profile-name {
      font-size: 19px;
      font-weight: 800;
      color: var(--app-text-primary);
    }

    .profile-subtitle {
      font-size: 12px;
      color: var(--app-text-secondary);
      margin-top: 3px;
    }
  }

  /* Relationship Ledger Card */
  .ledger-card {
    background-color: var(--app-card-bg);
    border-radius: 16px;
    padding: 16px;
    border: 1px solid var(--app-border);
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.02);
    margin-bottom: 20px;
    width: 100%;
    box-sizing: border-box;

    .ledger-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;

      .header-label {
        font-size: 14px;
        font-weight: 700;
        color: var(--app-text-primary);
      }

      .badge-pill {
        font-size: 12px;
        font-weight: 600;
        padding: 3px 10px;
        border-radius: 10px;
        background-color: #faf4ee;
        color: #b08968;
        white-space: nowrap;

        &.is-green {
          background-color: #faf4ee;
          color: #b08968;
        }

        &.is-red {
          background-color: #fdf0ee;
          color: #c3423f;
        }
      }
    }

    .ledger-card-divider {
      height: 1px;
      background-color: var(--app-border);
      margin-bottom: 14px;
    }

    .ledger-metrics-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;

      .metric-block {
        .m-title {
          font-size: 11px;
          color: var(--app-text-secondary);
          margin-bottom: 4px;
        }

        .m-val {
          font-size: 18px;
          font-weight: 800;

          &.green-val {
            color: #27ae60;
          }

          &.red-val {
            color: #c3423f;
          }
        }
      }
    }
  }

  /* History Timeline Section */
  .history-section {
    width: 100%;

    .section-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--app-text-primary);
      margin-bottom: 10px;
    }

    .history-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: 100%;

      .history-item-card {
        background-color: var(--app-card-bg);
        border-radius: 14px;
        padding: 12px 14px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border: 1px solid var(--app-border);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
        box-sizing: border-box;
        width: 100%;

        .history-left {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          min-width: 0;

          .type-circle {
            width: 34px;
            height: 34px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 700;
            flex-shrink: 0;

            &.is-rec {
              background-color: #eaf7ee;
              color: #27ae60;
            }

            &.is-giv {
              background-color: #fdf0ee;
              color: #c3423f;
            }
          }

          .history-info {
            display: flex;
            flex-direction: column;
            min-width: 0;

            .history-title {
              font-size: 14px;
              font-weight: 700;
              color: var(--app-text-primary);
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }

            .history-date {
              font-size: 11px;
              color: var(--app-text-muted);
              margin-top: 2px;
            }
          }
        }

        .history-amount {
          font-size: 15px;
          font-weight: 800;
          flex-shrink: 0;
          margin-left: 8px;

          &.green-text {
            color: #27ae60;
          }

          &.red-text {
            color: #c3423f;
          }
        }
      }
    }
  }

  .bottom-action-container {
    margin-top: 20px;
    width: 100%;

    .add-exchange-btn {
      width: 100%;
      background-color: var(--app-card-bg);
      border: 1px dashed #c3423f;
      color: #c3423f;
      font-size: 14px;
      font-weight: 700;
      padding: 12px 0;
      border-radius: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      transition: all 0.2s ease;
      box-sizing: border-box;

      &:active {
        background-color: var(--app-primary-light);
      }
    }
  }

  /* Edit Modal */
  .edit-popup {
    .edit-modal-box {
      padding: 16px;
      background-color: var(--color-background-2);

      .edit-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 14px;
        font-size: 15px;
        font-weight: 700;
        color: var(--app-text-primary);

        .van-icon {
          font-size: 17px;
          color: var(--app-text-secondary);
          cursor: pointer;
        }
      }

      .edit-modal-form {
        display: flex;
        flex-direction: column;
        gap: 12px;

        .form-item {
          display: flex;
          flex-direction: column;
          gap: 5px;

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

            input {
              width: 100%;
              border: none;
              outline: none;
              background: transparent;
              font-size: 14px;
              color: var(--app-text-primary);
            }
          }
        }

        .primary-save-btn {
          width: 100%;
          background-color: #c3423f;
          color: #ffffff;
          font-size: 15px;
          font-weight: 700;
          padding: 12px 0;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          margin-top: 6px;
        }
      }
    }
  }
</style>
