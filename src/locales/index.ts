import { createI18n } from 'vue-i18n';
import cn from './zh.json'; //引入中文语言包
import en from './en.json';
//引入的不同语言文件
const messages = {
  'zh-CN': cn,
  'en-US': en,
};
export const LOCALE_OPTIONS = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' },
  { label: '繁体中文', value: 'zh-TW' },
];
const supportedLanguages = ['zh-CN', 'en-US']; // 你支持的语言列表
// 获取浏览器语言或 localStorage 中的语言偏好
const getUserLanguage = () => {
  const savedLanguage = localStorage.getItem('lihaha-language');
  if (savedLanguage) {
    if (supportedLanguages.includes(savedLanguage)) {
      return savedLanguage;
    }
  }
  const browserLanguage = navigator.language;
  if (supportedLanguages.includes(browserLanguage)) {
    return browserLanguage;
  }
  if (browserLanguage.includes('zh')) {
    return 'zh-CN';
  } else {
    return 'en-US';
  }
};

//这个类型可以自己配置，毕竟每个人做的都不一样
const i18n = createI18n({
  legacy: false, // 使用 Composition API 模式，则需要将其设置为false
  globalInjection: true, //全局生效$t
  locale: getUserLanguage(), // 默认cn翻译
  messages, //ES6解构
});

export default i18n;
