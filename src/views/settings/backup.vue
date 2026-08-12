<script setup lang="ts">
  import { computed, ref } from 'vue';
  import { useRouter } from 'vue-router';
  import { showConfirmDialog, showToast } from 'vant';
  import useStore from '@/store';
  import { backupsApi, type BackupPreview } from '@/api/backups';

  const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
  const router = useRouter();
  const { gift } = useStore();

  const fileInput = ref<HTMLInputElement>();
  const exporting = ref(false);
  const validating = ref(false);
  const importing = ref(false);
  const selectedFileName = ref('');
  const selectedBackup = ref<unknown>();
  const preview = ref<BackupPreview>();
  const password = ref('');
  const replaceConfirmed = ref(false);

  const canImport = computed(
    () =>
      Boolean(preview.value && selectedBackup.value && password.value && replaceConfirmed.value) &&
      !importing.value
  );

  const formatBackupTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  };

  const parseDownloadFilename = (contentDisposition?: string) => {
    const match = contentDisposition?.match(/filename="?([^";]+)"?/i);
    return match?.[1] || `gift-ledger-${new Date().toISOString().slice(0, 10)}.giftledger`;
  };

  const downloadBackup = async () => {
    if (exporting.value) return;
    exporting.value = true;
    try {
      const response = await backupsApi.export();
      const blob =
        response.data instanceof Blob
          ? response.data
          : new Blob([response.data], {
              type: 'application/vnd.gift-ledger.backup+json;charset=utf-8',
            });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = parseDownloadFilename(response.headers['content-disposition']);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast({ message: '备份文件已导出', icon: 'passed' });
    } catch {
      // 请求层统一提示错误。
    } finally {
      exporting.value = false;
    }
  };

  const chooseBackupFile = () => {
    if (!validating.value && !importing.value) fileInput.value?.click();
  };

  const clearSelection = () => {
    selectedFileName.value = '';
    selectedBackup.value = undefined;
    preview.value = undefined;
    password.value = '';
    replaceConfirmed.value = false;
    if (fileInput.value) fileInput.value.value = '';
  };

  const handleFileChange = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    clearSelection();
    selectedFileName.value = file.name;
    if (file.size > MAX_BACKUP_BYTES) {
      showToast({ message: '备份文件不能超过 10MB', icon: 'fail' });
      return;
    }

    validating.value = true;
    try {
      const text = await file.text();
      const backup = JSON.parse(text) as unknown;
      const response = await backupsApi.validateImport(backup);
      selectedBackup.value = backup;
      preview.value = response.data.data;
      showToast({ message: '备份文件校验通过', icon: 'passed' });
    } catch (error) {
      selectedBackup.value = undefined;
      preview.value = undefined;
      if (error instanceof SyntaxError) {
        showToast({ message: '备份文件内容不是有效 JSON', icon: 'fail' });
      }
    } finally {
      validating.value = false;
    }
  };

  const restoreBackup = async () => {
    if (!canImport.value || !preview.value || !selectedBackup.value) return;
    try {
      await showConfirmDialog({
        title: '确认覆盖当前账簿？',
        message: `恢复后当前账号的现有数据将被替换为备份中的 ${preview.value.summary.records} 条礼金记录，该操作不可撤销。`,
        confirmButtonText: '确认恢复',
        confirmButtonColor: '#b33d39',
      });
    } catch {
      return;
    }

    importing.value = true;
    try {
      await backupsApi.import({
        backup: selectedBackup.value,
        checksum: preview.value.checksum,
        password: password.value,
      });
      gift.resetData();
      await gift.loadAll(true);
      clearSelection();
      showToast({ message: '账簿数据已恢复', icon: 'passed', duration: 2200 });
    } catch {
      // 请求层统一提示错误，保留备份和密码以便用户修正后重试。
    } finally {
      importing.value = false;
    }
  };
</script>

<template>
  <div class="backup-page">
    <header class="backup-header">
      <button type="button" aria-label="返回" @click="router.back()">
        <van-icon name="arrow-left" />
      </button>
      <div>
        <span>账户与数据</span>
        <h1>备份与恢复</h1>
      </div>
    </header>

    <section class="backup-hero">
      <span class="backup-hero__icon"><van-icon name="shield-o" /></span>
      <div>
        <strong>只处理当前账号数据</strong>
        <p>备份包含联系人、事件、礼金记录和操作日志，不包含密码和登录凭据。</p>
      </div>
    </section>

    <section class="backup-card export-card">
      <div class="section-heading">
        <span class="section-heading__index">01</span>
        <div>
          <h2>导出账簿</h2>
          <p>下载一份可跨设备恢复的备份文件</p>
        </div>
      </div>
      <button type="button" class="primary-action" :disabled="exporting" @click="downloadBackup">
        <van-loading v-if="exporting" size="18" color="currentColor" />
        <van-icon v-else name="down" />
        <span>{{ exporting ? '正在生成备份…' : '导出当前账簿' }}</span>
      </button>
      <p class="card-note">
        <van-icon name="info-o" />
        备份文件包含隐私数据，请妥善保管。
      </p>
    </section>

    <section class="backup-card import-card">
      <div class="section-heading">
        <span class="section-heading__index">02</span>
        <div>
          <h2>恢复账簿</h2>
          <p>先校验和预览，再覆盖当前账号数据</p>
        </div>
      </div>

      <input
        ref="fileInput"
        class="visually-hidden"
        type="file"
        tabindex="-1"
        aria-hidden="true"
        accept=".giftledger,.json,application/json,application/vnd.gift-ledger.backup+json"
        @change="handleFileChange"
      />
      <button
        type="button"
        class="file-picker"
        :class="{ 'file-picker--selected': preview }"
        :disabled="validating || importing"
        @click="chooseBackupFile"
      >
        <span class="file-picker__icon">
          <van-loading v-if="validating" size="24" color="#b33d39" />
          <van-icon v-else :name="preview ? 'passed' : 'upgrade'" />
        </span>
        <span>
          <strong>
            {{ validating ? '正在校验文件…' : preview ? selectedFileName : '选择备份文件' }}
          </strong>
          <small>
            {{ preview ? '文件已校验，点击可重新选择' : '支持 .giftledger 或 .json，最大 10MB' }}
          </small>
        </span>
        <van-icon name="arrow" />
      </button>

      <div v-if="preview" class="preview-panel">
        <div class="preview-title">
          <div>
            <span>备份来源</span>
            <strong>{{ preview.accountName }}</strong>
          </div>
          <span class="valid-badge">
            <van-icon name="passed" />
            已校验
          </span>
        </div>
        <dl class="preview-meta">
          <div>
            <dt>备份时间</dt>
            <dd>{{ formatBackupTime(preview.exportedAt) }}</dd>
          </div>
          <div>
            <dt>数据版本</dt>
            <dd>v{{ preview.appVersion }}</dd>
          </div>
        </dl>
        <div class="summary-grid">
          <div>
            <strong>{{ preview.summary.contacts }}</strong>
            <span>联系人</span>
          </div>
          <div>
            <strong>{{ preview.summary.events }}</strong>
            <span>事件</span>
          </div>
          <div>
            <strong>{{ preview.summary.records }}</strong>
            <span>礼金记录</span>
          </div>
          <div>
            <strong>{{ preview.summary.operationLogs }}</strong>
            <span>操作日志</span>
          </div>
        </div>

        <div class="restore-confirmation">
          <van-field
            v-model="password"
            type="password"
            label="当前密码"
            maxlength="72"
            autocomplete="current-password"
            placeholder="用于确认本次覆盖恢复"
            clearable
          />
          <van-checkbox v-model="replaceConfirmed" shape="square" checked-color="#b33d39">
            我已了解：恢复会覆盖当前账号的现有账簿数据
          </van-checkbox>
        </div>

        <button type="button" class="danger-action" :disabled="!canImport" @click="restoreBackup">
          <van-loading v-if="importing" size="18" color="currentColor" />
          <van-icon v-else name="replay" />
          <span>{{ importing ? '正在恢复数据…' : '覆盖恢复当前账簿' }}</span>
        </button>
      </div>
    </section>

    <section class="backup-tips">
      <h2>备份建议</h2>
      <ol>
        <li>
          <span>1</span>
          <p>重要数据变更后及时导出新备份。</p>
        </li>
        <li>
          <span>2</span>
          <p>恢复前先导出当前账簿，保留一份回退副本。</p>
        </li>
        <li>
          <span>3</span>
          <p>不要通过公开网盘或群聊分享备份文件。</p>
        </li>
      </ol>
    </section>
  </div>
</template>

<style lang="scss" scoped>
  .backup-page {
    min-height: 100vh;
    padding: 20px 16px 120px;
    color: var(--app-text-primary);
    background:
      radial-gradient(circle at 100% 0, rgba(179, 61, 57, 0.11), transparent 34%),
      var(--app-shell-bg);
  }

  .backup-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 18px;

    > button {
      display: grid;
      flex: 0 0 42px;
      width: 42px;
      height: 42px;
      place-items: center;
      border: 1px solid var(--app-border);
      border-radius: 14px;
      background: var(--app-card-bg);
      color: var(--app-text-primary);
      font-size: 20px;
    }

    span {
      color: var(--app-text-secondary);
      font-size: 11px;
      letter-spacing: 0.12em;
    }

    h1 {
      margin: 2px 0 0;
      font-size: 25px;
      line-height: 1.2;
    }
  }

  .backup-hero {
    display: flex;
    gap: 13px;
    align-items: flex-start;
    padding: 17px;
    margin-bottom: 14px;
    border: 1px solid color-mix(in srgb, #b33d39 25%, var(--app-border));
    border-radius: 20px;
    background: color-mix(in srgb, #b33d39 7%, var(--app-card-bg));

    &__icon {
      display: grid;
      flex: 0 0 42px;
      width: 42px;
      height: 42px;
      place-items: center;
      border-radius: 14px;
      background: #b33d39;
      color: #fff;
      font-size: 23px;
      box-shadow: 0 8px 18px rgba(179, 61, 57, 0.24);
    }

    strong {
      display: block;
      margin: 1px 0 5px;
      font-size: 14px;
    }

    p {
      margin: 0;
      color: var(--app-text-secondary);
      font-size: 12px;
      line-height: 1.65;
    }
  }

  .backup-card {
    padding: 19px;
    margin-bottom: 14px;
    border: 1px solid var(--app-border);
    border-radius: 22px;
    background: var(--app-card-bg);
    box-shadow: 0 10px 30px rgba(35, 25, 22, 0.06);
  }

  .section-heading {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    margin-bottom: 17px;

    &__index {
      padding-top: 3px;
      color: #b33d39;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      font-weight: 700;
    }

    h2 {
      margin: 0 0 4px;
      font-size: 17px;
    }

    p {
      margin: 0;
      color: var(--app-text-secondary);
      font-size: 12px;
      line-height: 1.5;
    }
  }

  .primary-action,
  .danger-action {
    display: flex;
    width: 100%;
    min-height: 48px;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 0;
    border-radius: 15px;
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    transition:
      transform 0.18s ease,
      opacity 0.18s ease;

    &:active:not(:disabled) {
      transform: scale(0.985);
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.46;
    }
  }

  .primary-action {
    background: #28373d;
    box-shadow: 0 10px 20px rgba(40, 55, 61, 0.18);
  }

  .danger-action {
    margin-top: 16px;
    background: #b33d39;
    box-shadow: 0 10px 20px rgba(179, 61, 57, 0.2);
  }

  .card-note {
    display: flex;
    gap: 6px;
    align-items: center;
    margin: 12px 0 0;
    color: var(--app-text-secondary);
    font-size: 11px;
  }

  .file-picker {
    display: grid;
    width: 100%;
    grid-template-columns: 44px 1fr auto;
    gap: 12px;
    align-items: center;
    padding: 14px;
    border: 1px dashed var(--app-border-strong);
    border-radius: 16px;
    background: color-mix(in srgb, var(--app-shell-bg) 72%, var(--app-card-bg));
    color: var(--app-text-primary);
    text-align: left;

    &--selected {
      border-style: solid;
      border-color: color-mix(in srgb, #488865 55%, var(--app-border));
      background: color-mix(in srgb, #488865 7%, var(--app-card-bg));
    }

    &__icon {
      display: grid;
      width: 44px;
      height: 44px;
      place-items: center;
      border-radius: 14px;
      background: var(--app-card-bg);
      color: #b33d39;
      font-size: 23px;
      box-shadow: inset 0 0 0 1px var(--app-border);
    }

    strong,
    small {
      display: block;
    }

    strong {
      max-width: 240px;
      overflow: hidden;
      font-size: 13px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    small {
      margin-top: 4px;
      color: var(--app-text-secondary);
      font-size: 10px;
      line-height: 1.4;
    }
  }

  .preview-panel {
    padding-top: 17px;
    margin-top: 17px;
    border-top: 1px solid var(--app-border);
  }

  .preview-title {
    display: flex;
    align-items: center;
    justify-content: space-between;

    span,
    strong {
      display: block;
    }

    > div > span {
      color: var(--app-text-secondary);
      font-size: 10px;
    }

    strong {
      margin-top: 3px;
      font-size: 15px;
    }
  }

  .valid-badge {
    display: inline-flex !important;
    align-items: center;
    gap: 4px;
    padding: 5px 8px;
    border-radius: 999px;
    background: rgba(72, 136, 101, 0.12);
    color: #3e7e5b;
    font-size: 10px;
    font-weight: 700;
  }

  .preview-meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin: 14px 0 10px;

    div {
      padding: 10px;
      border-radius: 12px;
      background: var(--app-shell-bg);
    }

    dt {
      color: var(--app-text-secondary);
      font-size: 9px;
    }

    dd {
      margin: 4px 0 0;
      font-size: 11px;
      font-weight: 600;
    }
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;

    div {
      padding: 11px 4px;
      border: 1px solid var(--app-border);
      border-radius: 12px;
      text-align: center;
    }

    strong,
    span {
      display: block;
    }

    strong {
      color: #b33d39;
      font-size: 17px;
    }

    span {
      margin-top: 3px;
      color: var(--app-text-secondary);
      font-size: 9px;
    }
  }

  .restore-confirmation {
    padding: 13px;
    margin-top: 14px;
    border-radius: 16px;
    background: color-mix(in srgb, #b33d39 6%, var(--app-shell-bg));

    :deep(.van-cell) {
      padding: 10px 0 13px;
      background: transparent;
    }

    :deep(.van-checkbox) {
      align-items: flex-start;
      font-size: 11px;
      line-height: 1.55;
    }
  }

  .backup-tips {
    padding: 18px 4px 0;

    h2 {
      margin: 0 0 12px;
      font-size: 14px;
    }

    ol {
      display: grid;
      gap: 10px;
      padding: 0;
      margin: 0;
      list-style: none;
    }

    li {
      display: flex;
      gap: 9px;
      align-items: flex-start;
      color: var(--app-text-secondary);
      font-size: 11px;
      line-height: 1.55;

      > span {
        display: grid;
        flex: 0 0 20px;
        width: 20px;
        height: 20px;
        place-items: center;
        border-radius: 50%;
        background: var(--app-card-bg);
        color: #b33d39;
        font-size: 9px;
        font-weight: 700;
        box-shadow: inset 0 0 0 1px var(--app-border);
      }

      p {
        margin: 1px 0 0;
      }
    }
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
