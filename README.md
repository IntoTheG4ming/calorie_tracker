# 🥗 Voice Calorie Tracker PWA

![PWA Ready](https://img.shields.io/badge/PWA-Ready-10b981?style=flat-square&logo=pwa)
![Gemini AI](https://img.shields.io/badge/AI-Gemini%203.6%20Flash-8e44ad?style=flat-square&logo=google)
![Zero-Knowledge Encryption](https://img.shields.io/badge/Security-AES--GCM%20256-blue?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

Un'applicazione web progressiva (**PWA**) open-source e completamente gratuita per il tracciamento quotidiano di calorie e macronutrienti. Sfrutta le API di **Google Gemini** per il parsing nutrizionale e **Google Sheets** come database cloud personale serverless.

---

## ✨ Novità Versione v1.9.1

* 🎬 **Landing Screen "Stile Netflix"**: Selezione visuale del profilo all'avvio con avatar cromatici dinamici e indicatori di blocco.
* 🔐 **Crittografia Zero-Knowledge Client-Side (AES-GCM)**: I pasti e le metriche vengono cifrati nel browser prima di essere salvati localmente o inviati a Google Sheets. Nessun dato nutrizionale risiede in chiaro.
* 🗑️ **Eliminazione Profilo**: Pulsante dedicato nel pannello impostazioni per cancellare un utente e la cronologia dei suoi pasti in modo definitivo con conferma esplicita.
* 👆 **Sblocco Biometrico Permanente (`WebAuthn`)**: Gestione duratura dei token biometrici legati al singolo profilo hardware (Face ID, Touch ID, Windows Hello).
* 🔄 **PWA Service Worker Auto-Update Layer**: Rilevamento automatico delle nuove versioni e ricaricamento trasparente dell'app.

---

## 🛠️ Stack Tecnologico

| Componente | Tecnologia | Descrizione |
| :--- | :--- | :--- |
| **Frontend** | HTML5, CSS3, JavaScript (ES6+) | Interfaccia responsive dark mode senza framework. |
| **Security Layer** | Web Crypto API (AES-GCM + PBKDF2) | Crittografia client-side a zero conoscenza. |
| **Biometria** | WebAuthn API | Autenticazione hardware locale tramite Touch ID / Face ID. |
| **AI Engine** | Google Gemini API | Modello LLM per estrazione macronutrienti da testo/voce. |
| **Backend / Cloud DB** | Google Apps Script + Google Sheets | API REST serverless gratuita su Google Drive. |

---

## 🚀 Guida Rapida all'Installazione (100% Gratuito)

1. Clona il repository GitHub.
2. Incolla il codice di `Codice.gs` in un nuovo progetto **Google Apps Script** collegato a un foglio Google Sheets ed effettua il deployment come **Web App** (Esegui come: *Utente corrente*, Chi può accedere: *Chiunque*).
3. Configura le variabili `HARDCODED_API_KEY` e `SHEETS_API_URL` nel file `app.js`.
4. Pubblica il sito su **GitHub Pages** per l'accesso PWA da desktop e smartphone.