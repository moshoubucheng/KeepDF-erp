import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// Create a SEPARATE i18n instance for tests (avoids conflict with real @/i18n module)
const testI18n = i18n.createInstance()
testI18n.use(initReactI18next).init({
  lng: 'cimode',
  resources: {},
  keySeparator: false,
  interpolation: { escapeValue: false },
})

export default testI18n
