<script setup lang="ts">
  import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
  import { useRouter } from 'vue-router';
  import { contactsApi } from '@/api/contacts';
  import { mapContact } from '@/api/mappers';
  import useStore from '@/store';
  import type { Contact, RelationType } from '@/types/gift';
  import { showToast } from 'vant';

  const router = useRouter();
  const { gift } = useStore();

  const searchKeyword = ref('');
  const selectedRelation = ref<string>('全部');
  const contacts = ref<Array<Contact & { diff: number; balanceBadge: string }>>([]);
  const contactsLoading = ref(false);
  const contactsFinished = ref(false);
  const contactsPage = ref(1);
  const contactsTotal = ref(0);
  const PAGE_SIZE = 20;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let contactsRequestId = 0;

  const relationTabs = ['全部', '亲戚', '朋友', '同学', '同事', '合作伙伴', '长辈', '其他'];

  const showAddContactPopup = ref(false);
  const savingContact = ref(false);
  const newContactForm = ref({
    name: '',
    relation: '朋友' as RelationType,
    tag: '',
    phone: '',
    remark: '',
  });

  const loadContacts = async (reset = false) => {
    if (reset) {
      contactsPage.value = 1;
      contactsFinished.value = false;
      contacts.value = [];
      contactsRequestId += 1;
    }
    const requestId = contactsRequestId;
    contactsLoading.value = true;
    try {
      const response = await contactsApi.getAll({
        page: contactsPage.value,
        pageSize: PAGE_SIZE,
        keyword: searchKeyword.value.trim() || undefined,
        relation:
          selectedRelation.value === '全部' ? undefined : (selectedRelation.value as RelationType),
      });
      const items = response.data.data.map((item) => ({
        ...mapContact(item),
        diff: Number(item.diff || 0),
        balanceBadge: item.balance_badge || '往来平衡',
      }));
      if (requestId !== contactsRequestId) return;
      contacts.value = reset ? items : [...contacts.value, ...items];
      contactsTotal.value = response.data.pagination.total;
      contactsFinished.value = !response.data.pagination.hasMore;
      if (!contactsFinished.value) contactsPage.value += 1;
    } catch (error) {
      if (requestId === contactsRequestId) {
        showToast(error instanceof Error ? error.message : '联系人加载失败');
        contactsFinished.value = true;
      }
    } finally {
      if (requestId === contactsRequestId) contactsLoading.value = false;
    }
  };

  const goToDetail = (contact: Contact) => {
    router.push({ path: '/contacts/detail', query: { id: contact.id, name: contact.name } });
  };

  const openAddContact = () => {
    newContactForm.value = {
      name: '',
      relation: '朋友',
      tag: '',
      phone: '',
      remark: '',
    };
    showAddContactPopup.value = true;
  };

  const saveNewContact = async () => {
    if (!newContactForm.value.name.trim()) {
      showToast('请输入联系人姓名');
      return;
    }
    if (savingContact.value) return;
    savingContact.value = true;
    try {
      await gift.addContact({
        name: newContactForm.value.name.trim(),
        relation: newContactForm.value.relation,
        tag: newContactForm.value.tag.trim() || newContactForm.value.relation,
        phone: newContactForm.value.phone.trim(),
        remark: newContactForm.value.remark.trim(),
      });
      await loadContacts(true);
      showToast({ message: '联系人添加成功', icon: 'passed' });
      showAddContactPopup.value = false;
    } catch {
      // 请求层已统一提示错误，弹窗保持打开以便修正。
    } finally {
      savingContact.value = false;
    }
  };

  watch([searchKeyword, selectedRelation], () => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => void loadContacts(true), 300);
  });

  onMounted(() => void loadContacts(true));
  onBeforeUnmount(() => {
    if (searchTimer) clearTimeout(searchTimer);
  });
</script>

<template>
  <div class="contacts-page">
    <!-- Top Header -->
    <div class="contacts-header">
      <div class="header-title">通讯录</div>
      <div class="add-contact-header-btn" @click="openAddContact">
        <van-icon name="plus" />
        <span>添加</span>
      </div>
    </div>

    <!-- Search Box -->
    <div class="search-box">
      <van-search
        v-model="searchKeyword"
        placeholder="搜索联系人姓名、关系或电话"
        shape="round"
        clearable
      />
    </div>

    <!-- Relation Filter Tabs -->
    <div class="relation-filter-scroll">
      <div
        v-for="rel in relationTabs"
        :key="rel"
        class="filter-chip"
        :class="{ active: selectedRelation === rel }"
        @click="selectedRelation = rel"
      >
        {{ rel }}
      </div>
    </div>

    <!-- Contacts List -->
    <div class="contacts-list">
      <van-list
        v-model:loading="contactsLoading"
        :finished="contactsFinished"
        :finished-text="contacts.length ? `已加载全部 ${contactsTotal} 位联系人` : ''"
        :immediate-check="false"
        @load="loadContacts()"
      >
        <div
          v-for="contact in contacts"
          :key="contact.id"
          class="contact-card"
          @click="goToDetail(contact)"
        >
          <div class="contact-left">
            <div class="avatar-box">
              <span>{{ contact.name.slice(0, 1) }}</span>
            </div>

            <div class="contact-info">
              <div class="name-row">
                <span class="contact-name">{{ contact.name }}</span>
                <span v-if="contact.relation" class="relation-tag">{{ contact.relation }}</span>
              </div>
              <div class="contact-sub">{{ contact.tag || contact.remark || '暂无备注' }}</div>
            </div>
          </div>

          <div class="contact-right">
            <!-- Ledger Balance Badge -->
            <div
              class="ledger-badge"
              :class="{
                'is-positive': contact.diff > 0,
                'is-negative': contact.diff < 0,
              }"
            >
              {{ contact.balanceBadge }}
            </div>
            <van-icon name="arrow" class="arrow-icon" />
          </div>
        </div>
      </van-list>

      <div v-if="!contactsLoading && contacts.length === 0" class="empty-hint">
        <van-empty description="未找到相关联系人" image="search" />
      </div>
    </div>

    <!-- Add Contact Popup -->
    <van-popup v-model:show="showAddContactPopup" position="bottom" round class="add-contact-popup">
      <div class="popup-container">
        <div class="popup-header">
          <span class="popup-title">新建联系人</span>
          <van-icon name="cross" @click="showAddContactPopup = false" />
        </div>

        <div class="popup-form">
          <div class="form-item">
            <label class="form-label">联系人姓名</label>
            <div class="input-card">
              <input
                v-model="newContactForm.name"
                type="text"
                maxlength="30"
                placeholder="请输入姓名，如：王大力"
              />
            </div>
          </div>

          <div class="form-item">
            <label class="form-label">关系分类</label>
            <div class="relation-select-chips">
              <div
                v-for="rel in ['亲戚', '朋友', '同学', '同事', '合作伙伴', '长辈', '其他']"
                :key="rel"
                class="rel-chip"
                :class="{ selected: newContactForm.relation === rel }"
                @click="newContactForm.relation = rel as RelationType"
              >
                {{ rel }}
              </div>
            </div>
          </div>

          <div class="form-item">
            <label class="form-label">个性标签 / 备注关系</label>
            <div class="input-card">
              <input
                v-model="newContactForm.tag"
                type="text"
                placeholder="如：大学同学、研发部同事、大舅家"
              />
            </div>
          </div>

          <div class="form-item">
            <label class="form-label">手机号码 (选填)</label>
            <div class="input-card">
              <input
                v-model="newContactForm.phone"
                type="tel"
                maxlength="30"
                placeholder="请输入联系电话"
              />
            </div>
          </div>

          <div class="form-item">
            <label class="form-label">备注信息 (选填)</label>
            <div class="input-card textarea-card">
              <textarea
                v-model="newContactForm.remark"
                rows="2"
                maxlength="200"
                placeholder="记录称呼、家庭或其他重要信息"
              />
            </div>
          </div>

          <button class="primary-save-btn" :disabled="savingContact" @click="saveNewContact">
            {{ savingContact ? '正在保存…' : '保存联系人' }}
          </button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style lang="scss" scoped>
  .contacts-page {
    padding: 10px 16px 20px 16px;
    background-color: var(--color-background-2);
    box-sizing: border-box;
    width: 100%;
    overflow-x: hidden;
  }

  .contacts-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0 14px 0;

    .header-title {
      font-size: 18px;
      font-weight: 800;
      color: var(--app-text-primary);
    }

    .add-contact-header-btn {
      background-color: var(--app-primary-light);
      color: var(--app-primary);
      padding: 4px 12px;
      border-radius: 14px;
      font-size: 12px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 3px;
      cursor: pointer;
      flex-shrink: 0;
    }
  }

  .search-box {
    margin-bottom: 10px;

    :deep(.van-search) {
      padding: 0;
      background: transparent;

      .van-search__content {
        background-color: var(--app-card-bg);
        border: 1px solid var(--app-border);
        border-radius: 12px;
      }
    }
  }

  .relation-filter-scroll {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 12px;
    width: 100%;

    .filter-chip {
      padding: 5px 12px;
      background-color: var(--app-card-bg);
      border: 1px solid var(--app-border);
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      color: var(--app-text-secondary);
      white-space: nowrap;
      cursor: pointer;
      flex-shrink: 0;
      transition: all 0.2s ease;

      &.active {
        background-color: #c3423f;
        color: #ffffff;
        border-color: #c3423f;
        font-weight: 600;
      }
    }
  }

  .contacts-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;

    :deep(.van-list) {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .contact-card {
      background-color: var(--app-card-bg);
      border-radius: 14px;
      padding: 12px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 1px solid var(--app-border);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
      cursor: pointer;
      box-sizing: border-box;
      width: 100%;

      &:active {
        background-color: rgba(0, 0, 0, 0.02);
      }

      .contact-left {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
        min-width: 0;

        .avatar-box {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background-color: #faf4ee;
          border: 1.5px solid #e8d8c8;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 700;
          color: #b08968;
          flex-shrink: 0;
        }

        .contact-info {
          display: flex;
          flex-direction: column;
          min-width: 0;

          .name-row {
            display: flex;
            align-items: center;
            gap: 6px;

            .contact-name {
              font-size: 15px;
              font-weight: 700;
              color: var(--app-text-primary);
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }

            .relation-tag {
              font-size: 10px;
              background-color: var(--app-border);
              color: var(--app-text-secondary);
              padding: 1px 5px;
              border-radius: 4px;
              white-space: nowrap;
              flex-shrink: 0;
            }
          }

          .contact-sub {
            font-size: 11px;
            color: var(--app-text-secondary);
            margin-top: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }
      }

      .contact-right {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
        margin-left: 6px;

        .ledger-badge {
          font-size: 11px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 10px;
          background-color: var(--color-background-2);
          color: var(--app-text-secondary);
          white-space: nowrap;

          &.is-positive {
            background-color: #faf4ee;
            color: #b08968;
          }

          &.is-negative {
            background-color: #fdf0ee;
            color: #c3423f;
          }
        }

        .arrow-icon {
          font-size: 13px;
          color: var(--app-text-muted);
        }
      }
    }
  }

  /* Add Contact Popup */
  .add-contact-popup {
    .popup-container {
      padding: 16px;
      background-color: var(--app-popup-bg);
      max-height: 86vh;
      overflow-y: auto;

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
            box-sizing: border-box;

            input,
            textarea {
              width: 100%;
              border: none;
              outline: none;
              background: transparent;
              font-size: 14px;
              font-family: inherit;
              color: var(--app-text-primary);
              resize: none;

              &::placeholder {
                color: var(--app-text-muted);
              }
            }
          }

          .relation-select-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;

            .rel-chip {
              padding: 4px 10px;
              background-color: var(--app-card-bg);
              border: 1px solid var(--app-border);
              border-radius: 8px;
              font-size: 12px;
              font-weight: 500;
              color: var(--app-text-secondary);
              cursor: pointer;

              &.selected {
                background-color: var(--app-primary-light);
                color: var(--app-primary);
                border-color: var(--app-primary);
                font-weight: 600;
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
      }
    }
  }
</style>
