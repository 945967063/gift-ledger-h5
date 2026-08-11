<script setup lang="ts">
  import { ref, reactive } from 'vue';
  import { useRouter } from 'vue-router';
  import { showToast, showLoadingToast, closeToast } from 'vant';
  import { authApi } from '@/api/auth';
  import useStore from '@/store';
  import AppSvgIcon from '@/components/AppSvgIcon.vue';

  const router = useRouter();
  const { appearance, darkMode, gift } = useStore();

  const mode = ref<'login' | 'register'>('login');
  const loading = ref(false);
  const refreshingBackground = ref(false);

  const loginForm = reactive({ phone: '', password: '' });
  const registerForm = reactive({ name: '', phone: '', password: '', confirm: '' });

  const refreshBackground = async () => {
    if (refreshingBackground.value) return;
    refreshingBackground.value = true;
    const loaded = appearance.backgroundEnabled
      ? await appearance.refreshBackground()
      : await appearance.setBackgroundEnabled(true);
    refreshingBackground.value = false;
    showToast(loaded ? '背景已更换' : '背景加载失败，请稍后重试');
  };

  const handleLogin = async () => {
    if (!loginForm.phone || !loginForm.password) {
      showToast('请输入手机号和密码');
      return;
    }
    loading.value = true;
    showLoadingToast({ message: '登录中...', forbidClick: true });
    try {
      const res = await authApi.login({ phone: loginForm.phone, password: loginForm.password });
      const { token, user } = res.data.data;
      localStorage.setItem('gift_ledger_token', token);
      localStorage.setItem('gift_ledger_user', JSON.stringify(user));
      gift.resetData();
      gift.setUserName(user.name);
      await gift.loadAll();
      closeToast();
      showToast({ message: '登录成功', icon: 'passed' });
      await router.replace('/home');
    } catch {
      closeToast();
      gift.resetData();
    } finally {
      loading.value = false;
    }
  };

  const handleRegister = async () => {
    if (!registerForm.name || !registerForm.phone || !registerForm.password) {
      showToast('请填写姓名、手机号和密码');
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(registerForm.phone)) {
      showToast('请输入有效的 11 位手机号');
      return;
    }
    if (registerForm.password.length < 8) {
      showToast('密码至少需要 8 位');
      return;
    }
    if (registerForm.password !== registerForm.confirm) {
      showToast('两次密码不一致');
      return;
    }
    loading.value = true;
    showLoadingToast({ message: '注册中...', forbidClick: true });
    try {
      const res = await authApi.register({
        name: registerForm.name,
        phone: registerForm.phone,
        password: registerForm.password,
      });
      const { token, user } = res.data.data;
      localStorage.setItem('gift_ledger_token', token);
      localStorage.setItem('gift_ledger_user', JSON.stringify(user));
      gift.resetData();
      gift.setUserName(user.name);
      await gift.loadAll();
      closeToast();
      showToast({ message: '注册成功，欢迎使用人情簿！', icon: 'passed' });
      await router.replace('/home');
    } catch {
      closeToast();
      gift.resetData();
    } finally {
      loading.value = false;
    }
  };
</script>

<template>
  <div class="auth-page">
    <div class="auth-tools" aria-label="外观设置">
      <button type="button" aria-label="切换明暗模式" @click="darkMode.toggleDarkMode($event)">
        <AppSvgIcon :name="darkMode.darkMode ? 'sun' : 'moon'" />
      </button>
      <button
        type="button"
        aria-label="更换随机背景"
        :disabled="refreshingBackground"
        @click="refreshBackground"
      >
        <van-loading v-if="refreshingBackground" size="16" />
        <van-icon v-else name="replay" />
      </button>
    </div>

    <main class="auth-shell">
      <Transition name="auth-fade" mode="out-in">
        <section v-if="mode === 'login'" key="login" class="auth-panel login-panel">
          <header class="brand-block">
            <div class="brand-mark" aria-hidden="true">情</div>
            <h1>人情簿</h1>
            <p>人情往来，心中有数</p>
          </header>

          <form class="auth-form login-form" @submit.prevent="handleLogin">
            <div class="form-group">
              <label for="login-phone">手机号</label>
              <div class="field-control phone-control">
                <span class="phone-prefix">+86</span>
                <input
                  id="login-phone"
                  v-model="loginForm.phone"
                  type="tel"
                  inputmode="numeric"
                  autocomplete="tel"
                  maxlength="11"
                  placeholder="请输入手机号"
                />
              </div>
            </div>

            <div class="form-group">
              <label for="login-password">密码</label>
              <div class="field-control">
                <input
                  id="login-password"
                  v-model="loginForm.password"
                  type="password"
                  autocomplete="current-password"
                  placeholder="请输入密码"
                />
              </div>
            </div>

            <button class="submit-btn" type="submit" :disabled="loading">登录</button>
          </form>

          <p class="security-tip">你的记录将按账号独立保存</p>
        </section>

        <section v-else key="register" class="auth-panel register-panel">
          <header class="page-header">
            <button type="button" class="back-btn" aria-label="返回登录" @click="mode = 'login'">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <h1>注册账号</h1>
            <span class="header-spacer" aria-hidden="true"></span>
          </header>

          <form class="auth-form register-form" @submit.prevent="handleRegister">
            <div class="form-group">
              <label for="register-name">您的姓名</label>
              <div class="field-control">
                <input
                  id="register-name"
                  v-model="registerForm.name"
                  type="text"
                  autocomplete="name"
                  maxlength="30"
                  placeholder="请输入姓名"
                />
              </div>
            </div>

            <div class="form-group">
              <label for="register-phone">手机号</label>
              <div class="field-control phone-control">
                <span class="phone-prefix">+86</span>
                <input
                  id="register-phone"
                  v-model="registerForm.phone"
                  type="tel"
                  inputmode="numeric"
                  autocomplete="tel"
                  maxlength="11"
                  placeholder="请输入手机号"
                />
              </div>
            </div>

            <div class="form-group">
              <label for="register-password">设置密码</label>
              <div class="field-control">
                <input
                  id="register-password"
                  v-model="registerForm.password"
                  type="password"
                  autocomplete="new-password"
                  placeholder="至少 8 位字符"
                />
              </div>
            </div>

            <div class="form-group">
              <label for="register-confirm">确认密码</label>
              <div class="field-control">
                <input
                  id="register-confirm"
                  v-model="registerForm.confirm"
                  type="password"
                  autocomplete="new-password"
                  placeholder="请再次输入密码"
                />
              </div>
            </div>

            <button class="submit-btn" type="submit" :disabled="loading">注册</button>
          </form>

          <p class="security-tip">注册即代表创建独立的人情记录空间</p>
        </section>
      </Transition>
    </main>

    <footer class="mode-footer">
      <span>{{ mode === 'login' ? '还没有账号？' : '已有账号？' }}</span>
      <button type="button" @click="mode = mode === 'login' ? 'register' : 'login'">
        {{ mode === 'login' ? '立即注册' : '立即登录' }}
      </button>
    </footer>
  </div>
</template>

<style lang="scss" scoped>
  .auth-page {
    --auth-red: #d34d4f;
    --auth-red-dark: #bc3d40;
    --auth-gold: #bf914b;
    --auth-ink: var(--app-text-primary);
    --auth-muted: var(--app-text-secondary);
    --auth-line: var(--app-border);
    min-height: 100vh;
    min-height: 100svh;
    background: transparent;
    color: var(--auth-ink);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: max(18px, env(safe-area-inset-top)) 16px max(18px, env(safe-area-inset-bottom));
    box-sizing: border-box;
    overflow-x: hidden;
  }

  .auth-tools {
    position: fixed;
    z-index: 5;
    top: max(14px, env(safe-area-inset-top));
    right: max(14px, calc((100vw - 520px) / 2 + 14px));
    display: flex;
    gap: 7px;

    button {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      padding: 0;
      border: 1px solid var(--app-border);
      border-radius: 12px;
      background: var(--app-card-bg);
      color: var(--app-text-primary);
      font-size: 17px;
      box-shadow: 0 6px 16px rgba(24, 24, 27, 0.1);
      backdrop-filter: blur(16px);
    }
  }

  .auth-shell {
    width: min(100%, 440px);
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .auth-panel {
    width: 100%;
    padding: 26px;
    border: 1px solid color-mix(in srgb, var(--app-border-strong) 74%, transparent);
    border-radius: 28px;
    background: color-mix(in srgb, var(--app-card-bg) 92%, transparent);
    box-shadow: 0 24px 54px rgba(24, 24, 27, 0.16);
    backdrop-filter: blur(22px) saturate(1.12);
  }

  .login-panel {
    padding-top: clamp(44px, 7svh, 68px);
  }

  .brand-block {
    text-align: center;
    margin-bottom: clamp(42px, 7svh, 64px);

    .brand-mark {
      width: 76px;
      height: 76px;
      margin: 0 auto 24px;
      border: 4px solid #c9a05e;
      border-radius: 25px;
      background: var(--auth-red);
      color: #fff;
      display: grid;
      place-items: center;
      font-family: STKaiti, KaiTi, serif;
      font-size: 42px;
      font-weight: 700;
      line-height: 1;
      box-shadow: 0 12px 24px rgba(157, 76, 53, 0.17);
      animation: brand-arrive 0.55s cubic-bezier(0.2, 0.75, 0.25, 1) both;
    }

    h1 {
      margin: 0;
      color: var(--auth-ink);
      font-size: 32px;
      font-weight: 800;
      line-height: 1.2;
      letter-spacing: 0.08em;
    }

    p {
      margin: 10px 0 0;
      color: var(--auth-muted);
      font-size: 15px;
      font-weight: 500;
      letter-spacing: 0.08em;
    }
  }

  .page-header {
    min-height: 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 34px;

    h1 {
      margin: 0;
      font-size: 23px;
      font-weight: 750;
      letter-spacing: 0.04em;
    }
  }

  .back-btn,
  .header-spacer {
    width: 42px;
    height: 42px;
  }

  .back-btn {
    border: 0;
    border-radius: 50%;
    background: transparent;
    display: grid;
    place-items: center;
    cursor: pointer;
    transition:
      background-color 0.2s ease,
      transform 0.2s ease;

    svg {
      width: 26px;
      height: 26px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.3;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    &:active {
      background: rgba(49, 45, 42, 0.06);
      transform: translateX(-2px);
    }
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 22px;

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 9px;

      label {
        color: var(--auth-muted);
        font-size: 15px;
        font-weight: 650;
        line-height: 1.4;
      }
    }
  }

  .register-form {
    gap: 18px;
  }

  .field-control {
    height: 58px;
    border: 1px solid var(--auth-line);
    border-radius: 17px;
    background: color-mix(in srgb, var(--app-surface-solid) 86%, transparent);
    display: flex;
    align-items: center;
    box-shadow: 0 4px 14px rgba(65, 49, 38, 0.025);
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease,
      transform 0.2s ease;

    &:focus-within {
      border-color: rgba(191, 145, 75, 0.8);
      box-shadow: 0 0 0 3px rgba(191, 145, 75, 0.1);
      transform: translateY(-1px);
    }

    input {
      min-width: 0;
      height: 100%;
      flex: 1;
      box-sizing: border-box;
      border: 0;
      outline: 0;
      background: transparent;
      padding: 0 19px;
      color: var(--auth-ink);
      font: inherit;
      font-size: 16px;

      &::placeholder {
        color: var(--app-text-muted);
      }
    }
  }

  .phone-control input {
    padding-left: 16px;
  }

  .phone-prefix {
    position: relative;
    flex: none;
    padding-left: 19px;
    padding-right: 16px;
    color: var(--auth-gold);
    font-size: 16px;
    font-weight: 600;

    &::after {
      position: absolute;
      top: 50%;
      right: 0;
      width: 1px;
      height: 20px;
      background: var(--auth-line);
      content: '';
      transform: translateY(-50%);
    }
  }

  .submit-btn {
    width: 100%;
    height: 58px;
    margin-top: 12px;
    border: 0;
    border-radius: 18px;
    background: var(--auth-red);
    box-shadow: 0 10px 22px rgba(189, 58, 61, 0.19);
    color: #fff;
    font-size: 17px;
    font-weight: 750;
    letter-spacing: 0.16em;
    cursor: pointer;
    transition:
      background-color 0.2s ease,
      box-shadow 0.2s ease,
      transform 0.2s ease;

    &:active:not(:disabled) {
      background: var(--auth-red-dark);
      box-shadow: 0 5px 12px rgba(189, 58, 61, 0.18);
      transform: translateY(2px);
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }
  }

  .security-tip {
    margin: 20px 0 0;
    color: var(--app-text-muted);
    font-size: 12px;
    text-align: center;
    line-height: 1.6;
  }

  .mode-footer {
    width: min(100%, 440px);
    margin-top: 10px;
    padding: 10px 16px;
    border: 1px solid var(--app-border);
    border-radius: 18px;
    background: color-mix(in srgb, var(--app-card-bg) 88%, transparent);
    text-align: center;
    color: var(--auth-muted);
    font-size: 15px;

    button {
      margin-left: 8px;
      border: 0;
      background: transparent;
      padding: 8px 0;
      color: var(--auth-red);
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }
  }

  .auth-fade-enter-active,
  .auth-fade-leave-active {
    transition:
      opacity 0.2s ease,
      transform 0.2s ease;
  }

  .auth-fade-enter-from {
    opacity: 0;
    transform: translateY(8px);
  }

  .auth-fade-leave-to {
    opacity: 0;
    transform: translateY(-5px);
  }

  @keyframes brand-arrive {
    from {
      opacity: 0;
      transform: translateY(12px) scale(0.94);
    }

    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (max-height: 720px) {
    .login-panel {
      padding-top: 42px;
    }

    .brand-block {
      margin-bottom: 28px;

      .brand-mark {
        width: 64px;
        height: 64px;
        margin-bottom: 16px;
        border-radius: 21px;
        font-size: 36px;
      }
    }

    .auth-form,
    .register-form {
      gap: 14px;
    }

    .field-control,
    .submit-btn {
      height: 52px;
    }

    .page-header {
      margin-bottom: 18px;
    }

    .security-tip {
      margin-top: 12px;
    }

    .mode-footer {
      padding-top: 12px;
    }
  }

  @media (min-width: 720px) {
    .auth-page {
      justify-content: center;
    }

    .auth-shell,
    .mode-footer {
      box-sizing: border-box;
    }

    .auth-shell {
      flex: 0 1 760px;
    }

    .mode-footer {
      box-shadow: 0 14px 34px rgba(24, 24, 27, 0.12);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
</style>
