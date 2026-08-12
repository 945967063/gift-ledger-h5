<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { contactsApi } from '@/api/contacts';
  import { mapContact, mapRecord } from '@/api/mappers';
  import useStore from '@/store';
  import { showConfirmDialog, showToast } from 'vant';
  import { getPaymentMethodLabel } from '@/store/modules/giftStore';
  import type { Contact, GiftRecord, RelationType } from '@/types/gift';

  const route = useRoute();
  const router = useRouter();
  const { gift } = useStore();

  const contactName = ref('');
  const contactIdentifier = ref('');
  const ledgerLoading = ref(false);
  const ledgerFinished = ref(false);
  const ledgerPage = ref(1);
  const PAGE_SIZE = 20;
  const ledger = ref<{
    contact: Contact | null;
    records: GiftRecord[];
    totalReceived: number;
    totalGiven: number;
    receivedCount: number;
    givenCount: number;
    diff: number;
    balanceBadge: string;
  }>({
    contact: null,
    records: [],
    totalReceived: 0,
    totalGiven: 0,
    receivedCount: 0,
    givenCount: 0,
    diff: 0,
    balanceBadge: '往来平衡',
  });
  const relationOptions: RelationType[] = [
    '亲戚',
    '朋友',
    '同学',
    '同事',
    '合作伙伴',
    '长辈',
    '其他',
  ];

  const loadLedger = async (reset = false) => {
    if (!contactIdentifier.value) return;
    if (reset) {
      ledgerPage.value = 1;
      ledgerFinished.value = false;
    }
    ledgerLoading.value = true;
    try {
      const response = await contactsApi.getLedger(contactIdentifier.value, {
        page: ledgerPage.value,
        pageSize: PAGE_SIZE,
      });
      const data = response.data.data;
      const records = data.records.map(mapRecord);
      ledger.value = {
        contact: data.contact ? mapContact(data.contact) : ledger.value.contact,
        records: reset ? records : [...ledger.value.records, ...records],
        totalReceived: Number(data.totalReceived || 0),
        totalGiven: Number(data.totalGiven || 0),
        receivedCount: Number(data.receivedCount || 0),
        givenCount: Number(data.givenCount || 0),
        diff: Number(data.diff || 0),
        balanceBadge: data.balanceBadge || '往来平衡',
      };
      if (ledger.value.contact) contactName.value = ledger.value.contact.name;
      ledgerFinished.value = !data.pagination.hasMore;
      if (!ledgerFinished.value) ledgerPage.value += 1;
    } catch (error) {
      showToast(error instanceof Error ? error.message : '联系人账本加载失败');
      ledgerFinished.value = true;
    } finally {
      ledgerLoading.value = false;
    }
  };

  onMounted(() => {
    const identifier = route.query.id || route.query.name;
    if (!identifier) {
      void router.replace('/contacts');
      return;
    }
    contactIdentifier.value = String(identifier);
    contactName.value = String(route.query.name || '');
    void loadLedger(true);
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
    name: '',
    relation: '朋友' as RelationType,
    tag: '',
    phone: '',
    remark: '',
  });

  const openEdit = () => {
    if (ledger.value.contact) {
      editForm.value = {
        name: ledger.value.contact.name,
        relation: ledger.value.contact.relation,
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
      const name = editForm.value.name.trim();
      if (!name) {
        showToast('请输入联系人姓名');
        return;
      }
      if (savingContact.value) return;
      savingContact.value = true;
      try {
        await gift.updateContact(ledger.value.contact.id, {
          ...editForm.value,
          name,
          tag: editForm.value.tag.trim(),
          phone: editForm.value.phone.trim(),
          remark: editForm.value.remark.trim(),
        });
        contactIdentifier.value = ledger.value.contact.id;
        contactName.value = name;
        await router.replace({
          path: '/contacts/detail',
          query: { id: contactIdentifier.value, name },
        });
        await loadLedger(true);
        showToast({ message: '修改成功', icon: 'passed' });
        showEditModal.value = false;
      } catch {
        // 请求层已统一提示错误，保留编辑内容方便重试。
      } finally {
        savingContact.value = false;
      }
    }
  };

  const deleteContact = async () => {
    const contact = ledger.value.contact;
    if (!contact) return;
    try {
      await showConfirmDialog({
        title: `删除联系人“${contact.name}”？`,
        message: '联系人资料会被删除，已有的人情往来记录仍会保留。',
        confirmButtonText: '确认删除',
        confirmButtonColor: '#c3423f',
      });
      savingContact.value = true;
      await gift.removeContact(contact.id);
      showEditModal.value = false;
      showToast({ type: 'success', message: '联系人已删除' });
      await router.replace('/contacts');
    } catch (error) {
      if (error !== 'cancel' && error !== 'close') {
        showToast(error instanceof Error ? error.message : '删除联系人失败');
      }
    } finally {
      savingContact.value = false;
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
        <van-list
          v-model:loading="ledgerLoading"
          :finished="ledgerFinished"
          finished-text="已显示全部往来记录"
          :immediate-check="false"
          @load="loadLedger()"
        >
          <div v-for="rec in ledger.records" :key="rec.id" class="history-item-card">
            <div class="history-left">
              <div class="type-circle" :class="rec.type === 'received' ? 'is-rec' : 'is-giv'">
                {{ rec.type === 'received' ? '收' : '送' }}
              </div>
              <div class="history-info">
                <div class="history-title">{{ rec.eventTitle }}</div>
                <div class="history-date">
                  {{ rec.eventDate }} · {{ getPaymentMethodLabel(rec) }}
                </div>
              </div>
            </div>

            <div
              class="history-amount"
              :class="rec.type === 'received' ? 'green-text' : 'red-text'"
            >
              {{ rec.type === 'received' ? '+' : '-' }}¥{{ Number(rec.amount).toLocaleString() }}
            </div>
          </div>
        </van-list>

        <div v-if="!ledgerLoading && ledger.records.length === 0" class="empty-history">
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
            <label class="form-label">姓名</label>
            <div class="input-card">
              <input v-model="editForm.name" type="text" maxlength="30" placeholder="联系人姓名" />
            </div>
          </div>

          <div class="form-item">
            <label class="form-label">关系</label>
            <div class="relation-options">
              <button
                v-for="relation in relationOptions"
                :key="relation"
                type="button"
                :class="{ active: editForm.relation === relation }"
                @click="editForm.relation = relation"
              >
                {{ relation }}
              </button>
            </div>
          </div>

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
          <button class="delete-contact-btn" :disabled="savingContact" @click="deleteContact">
            删除联系人
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

      :deep(.van-list) {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

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
      background-color: var(--app-popup-bg);
      max-height: 86vh;
      overflow-y: auto;

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

          .relation-options {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 6px;

            button {
              min-height: 36px;
              padding: 0 5px;
              border: 1px solid var(--app-border);
              border-radius: 10px;
              background: var(--app-card-bg);
              color: var(--app-text-secondary);
              font-size: 11px;

              &.active {
                border-color: color-mix(in srgb, var(--app-primary) 42%, var(--app-border));
                background: var(--app-primary-light);
                color: var(--app-primary);
                font-weight: 700;
              }
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

        .delete-contact-btn {
          width: 100%;
          padding: 11px 0;
          border: 1px solid color-mix(in srgb, var(--app-primary) 28%, var(--app-border));
          border-radius: 12px;
          background: transparent;
          color: var(--app-primary);
          font-size: 14px;
          font-weight: 700;
        }
      }
    }
  }
</style>
