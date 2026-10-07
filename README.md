# 🥗 Voice Calorie Tracker PWA

Un'applicazione web progressiva (**PWA**) leggera, veloce e orientata alla privacy per il tracciamento quotidiano di calorie e macronutrienti. Sfrutta l'intelligenza artificiale di **Google Gemini** per analizzare il cibo descritto a voce o in testo libero e utilizza **Google Sheets** come database cloud personale e gratuito.

---

## ✨ Caratteristiche Principali

* 🧠 **Analisi Nutrizionale IA**: Trascrivi o descrivi cosa hai mangiato in italiano colloquiale (es. *"100g di riso con tonno e un cucchiaio d'olio"*). L'IA estrae automaticamente calorie, proteine, carboidrati e grassi.
* 🎙️ **Dettatura Vocale & Scorciatoie iOS/iPadOS**: Supporto nativo per l'input vocale in-app e integrazione con **Comandi Rapidi (Siri)** per registrare i pasti tramite URL parametrizzati (`?meal=...`).
* 📊 **Database Cloud su Google Sheets**: Tutti i dati risiedono nel tuo account Google Drive personale tramite Google Apps Script. Nessun servizio terzodi terze parti a pagamento.
* 👥 **Architettura Multi-Utente**: Gestione di più profili separati sullo stesso foglio di calcolo, con calcolo personalizzato di **BMR** (Metabolismo Basale) e **TDEE** (Fabbisogno Energetico) tramite la formula di Mifflin-St Jeor e livelli di attività fisica (PAL).
* 🔒 **Sicurezza & Biometria**: Protezione dei singoli profili tramite password personalizzabile e sblocco biometrico locale (**Touch ID / Face ID / Impronta**) tramite standard `WebAuthn`.
* ⚡ **Ridondanza e Fallback AI**: Sistema di resilienza che commuta automaticamente su un modello secondario (es. *Gemini 3.1 Flash Lite*) in caso di picchi di traffico o errori di quota del modello primario.
* 📱 **Esperienza PWA Offline-First**: Installabile come app nativa su iOS, Android, Windows e macOS con gestione delle risorse in cache tramite Service Worker.

---

## 🛠️ Architettura e Stack Tecnologico

| Componente | Tecnologia | Descrizione |
| --- | --- | --- |
| **Frontend** | HTML5, CSS3, JavaScript (ES6+) | Interfaccia reattiva in modalità scura, senza framework pesanti. |
| **PWA Layer** | Service Worker & Web Manifest | Caching locale e installabilità su schermata home. |
| **AI Engine** | Google Gemini API | Modello LLM per il parsing dei dati nutrizionali in formato JSON. |
| **Backend / DB** | Google Apps Script + Google Sheets | API REST serverless personalizzata per la persistenza dei dati. |
| **Sicurezza** | WebAuthn API | Autenticazione biometrica hardware locale su dispositivi supportati. |

---

## 🚀 Guida all'Installazione

### 1. Configurazione Backend (Google Sheets & Apps Script)

1. Crea un nuovo foglio di calcolo su **Google Sheets**.
2. Apri **Estensioni** → **Apps Script**.
3. Incolla il codice fornito nel file `Codice.gs`.
4. Esegui una volta la funzione `initDatabaseSheets` per creare automaticamente le schede `Pasti` e `Profili`.
5. Clicca su **Esegui deployment** → **Nuovo deployment** → seleziona **Applicazione Web**:
* **Esegui come**: *Utente corrente*
* **Chi può accedere**: *Chiunque*


6. Copia l'URL dell'applicazione web generato (`[https://script.google.com/macros/s/.../exec](https://script.google.com/macros/s/.../exec)`).

### 2. Configurazione Frontend

1. Clona questa repository sul tuo computer:
```bash
git clone https://github.com/TUO-USERNAME/NOME-REPO.git

```


2. In `app.js`, aggiorna le costanti con i tuoi endpoint:
```javascript
const HARDCODED_API_KEY = "LA_TUA_CHIAVE_API_GEMINI";
const SHEETS_API_URL = "IL_TUO_URL_DI_GOOGLE_APPS_SCRIPT";

```


3. Pubblica i file su **GitHub Pages** o qualsiasi hosting statico HTTPS.

---

## 📲 Integrazione con Comandi Rapidi (iPadOS / iOS)

Puoi avviare la registrazione vocale da Siri o widget creando un Comando Rapido con la seguente struttura:

1. **Dettatura testo** (Lingua: Italiano).
2. **Codifica URL** dell'input dettato.
3. **Apri URL**:
```text
https://TUO-USERNAME.github.io/NOME-REPO/?meal=[TestoCodificato]

```



---

## ⚠️ Disclaimer sull'utilizzo dell'Intelligenza Artificiale

> **IMPORTANTE**: Questa applicazione utilizza modelli di intelligenza artificiale generativa (Google Gemini) per la stima dei valori nutrizionali e calorici degli alimenti.
> * **Stime Approssimative**: I dati nutrizionali restituiti dall'IA sono calcolati sulla base di modelli probabilistici e descrizioni testuali. Non garantiscono precisione assoluta e possono variare rispetto ai valori reali delle etichette nutrizionali o della pesatura esatta.
> * **Nessun Valore Medico**: L'app **non fornisce consulenza medica o nutrizionale professionali**. I calcoli relativi al BMR, TDEE e bilancio calorico hanno scopo puramente informativo e di tracciamento personale.
> * **Integrazione**: Consulta sempre un medico, un nutrizionista o un dietista qualificato per la stesura di piani alimentari o per la gestione di patologie e condizioni di salute specifiche.
> 
>
