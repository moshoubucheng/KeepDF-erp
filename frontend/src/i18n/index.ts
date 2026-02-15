import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ja from './locales/ja.json'
import en from './locales/en.json'
import zh from './locales/zh.json'

const savedLang = localStorage.getItem('erp_lang') || 'ja'

i18n.use(initReactI18next).init({
  resources: {
    ja: { translation: ja },
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: savedLang,
  fallbackLng: 'ja',
  keySeparator: false,
  interpolation: {
    escapeValue: false,
    prefix: '{',
    suffix: '}',
  },
})

export default i18n

export function changeLanguage(lang: string) {
  i18n.changeLanguage(lang)
  localStorage.setItem('erp_lang', lang)
  // Save to server silently
  const token = localStorage.getItem('erp_token')
  if (token) {
    fetch('/api/v1/auth/language', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ language: lang }),
    }).catch(() => {})
  }
}
