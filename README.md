# 🥗 Voice Calorie Tracker PWA

Un'applicazione web progressiva (**PWA**) per il tracciamento quotidiano di calorie e macronutrienti. Sfrutta le API di **Google Gemini** per analizzare il cibo descritto a voce o in testo libero e impiega **Google Sheets** come database cloud personale e gratuito.

---

## ✨ Caratteristiche Principali

* 🧠 **Analisi Nutrizionale IA**: Trascrivi o descrivi cosa hai mangiato in italiano colloquiale (es. *"100g di riso con tonno e un cucchiaio d'olio"*). L'IA estrae automaticamente calorie, proteine, carboidrati e grassi.
* 🎙️ **Dettatura Vocale & Scorciatoie iOS/iPadOS**: Supporto per l'input vocale in-app e integrazione con **Comandi Rapidi (Siri)** tramite parametri URL (`?meal=...`).
* 📊 **Database Cloud su Google Sheets**: I dati risiedono nel tuo account Google Drive personale tramite Google Apps Script, garantendo la totale proprietà delle tue informazioni.
* 👥 **Architettura Multi-Utente**: Gestione di più profili separati sullo stesso foglio di calcolo, con calcolo personalizzato di **BMR** (Metabolismo Basale) e **TDEE** (Fabbisogno Energetico) tramite la formula di Mifflin-St Jeor e livelli di attività fisica (PAL).
* 🔒 **Sicurezza & Biometria**: Protezione dei singoli profili tramite password personalizzabile e sblocco biometrico locale (**Touch ID / Face ID / Impronta / Windows Hello**) tramite standard `WebAuthn`.
* ⚡ **Ridondanza e Fallback AI**: Sistema di resilienza che commuta automaticamente su un modello secondario (es. *Gemini 3.1 Flash Lite*) in caso di picchi di traffico o errori di quota del modello primario.
* 💻 **Esperienza Desktop & Mobile**: Installabile come PWA nativa su Windows, macOS, Linux, Android e iOS.

---

## 🛠️ Architettura e Stack Tecnologico

| Componente | Tecnologia | Descrizione |
| --- | --- | --- |
| **Frontend** | HTML5, CSS3, JavaScript (ES6+) | Interfaccia reattiva in modalità scura, senza framework pesanti. |
| **PWA Layer** | Service Worker & Web Manifest | Caching locale e installabilità su schermata home/desktop. |
| **AI Engine** | Google Gemini API | Modello LLM per il parsing dei dati nutrizionali in formato JSON. |
| **Backend / DB** | Google Apps Script + Google Sheets | API REST serverless personalizzata per la persistenza dei dati. |
| **Sicurezza** | WebAuthn API | Autenticazione biometrica hardware locale. |

---

## 🚀 Guida all'Installazione e Configurazione

### 1. Configurazione Backend (Google Sheets & Apps Script)

1. Crea un nuovo foglio di calcolo su **Google Sheets**.
2. Apri **Estensioni** → **Apps Script**.
3. Sostituisci il codice presente con il contenuto del file `Codice.gs`.
4. Seleziona la funzione `initDatabaseSheets` dal menu in alto e clicca **Esegui** per creare automaticamente le schede `Pasti` e `Profili` con le relative intestazioni.
5. Clicca su **Esegui deployment** → **Nuovo deployment** → seleziona **Applicazione Web**:
* **Esegui come**: *Utente corrente*
* **Chi può accedere**: *Chiunque*


6. Copia l'URL dell'applicazione web generato (`[https://script.google.com/macros/s/.../exec](https://script.google.com/macros/s/.../exec)`).

---

### 2. Configurazione ed Esecuzione Locale su PC

Per eseguire l'applicazione in locale sul proprio computer (Windows, macOS o Linux):

#### A. Clona il Repository

Apri il terminale e clona il progetto:

```bash
git clone https://github.com/TUO-USERNAME/NOME-REPO.git
cd NOME-REPO

```

#### B. Configura le Credenziali

Apri il file `app.js` con un editor di codice (es. VS Code) e aggiorna i seguenti campi alle righe 2 e 3:

```javascript
const HARDCODED_API_KEY = "LA_TUA_CHIAVE_API_GEMINI";
const SHEETS_API_URL = "IL_TUO_URL_DI_GOOGLE_APPS_SCRIPT";

```

#### C. Avvia un Server Locale

Trattandosi di una PWA che fa uso di Service Worker e WebAuthn, la pagina deve essere servita tramite protocollo `http://localhost` o `https://`.

* **Opzione 1 (VS Code - Consigliata):**
1. Installa l'estensione **Live Server** in VS Code.
2. Clicca con il tasto destro su `index.html` e seleziona **Open with Live Server**.


* **Opzione 2 (Python):**
Esegui nel terminale all'interno della cartella di progetto:
```bash
# Python 3
python -m http.server 8000

```


Apri il browser all'indirizzo `http://localhost:8000`.
* **Opzione 3 (Node.js / npx):**
Esegui nel terminale:
```bash
npx serve .

```



#### D. Installazione come App Desktop (PWA)

Una volta aperta la pagina su Google Chrome o Microsoft Edge:

1. Clicca sull'icona di installazione nella barra degli indirizzi (in alto a destra) oppure accedi al menu del browser (`⋮`) → **Salva e condividi** → **Installa Calorie Tracker**.
2. L'applicazione verrà aggiunta al menu Start / Dock e potrà essere avviata in una finestra indipendente.

---

### 3. Deploy Pubblico per Sincronizzazione Multi-Dispositivo

Se vuoi accedere alla PWA da smartphone o iPad senza mantenere il PC acceso:

1. Effettua il push del codice aggiornato su **GitHub**.
2. Abilita **GitHub Pages** nelle impostazioni della repository (`Settings` → `Pages` → Source: `main` branch).
3. Accedi all'URL pubblico fornito da GitHub Pages (`[https://TUO-USERNAME.github.io/NOME-REPO/](https://TUO-USERNAME.github.io/NOME-REPO/)`).

---

## 📲 Integrazione con Comandi Rapidi (iPadOS / iOS)

Puoi avviare la registrazione vocale da Siri o widget creando un Comando Rapido:

1. **Dettatura testo** (Lingua: Italiano).
2. **Codifica URL** dell'input dettato.
3. **Apri URL**:
```text
https://TUO-USERNAME.github.io/NOME-REPO/?meal=[TestoCodificato]

```



---

## ⚠️ Disclaimer sull'utilizzo e lo Sviluppo con Intelligenza Artificiale

> **Sviluppo assistito da IA**: Questa applicazione e la relativa struttura di codice (Frontend, PWA Service Worker, integrazione WebAuthn e script di backend Google Apps Script) sono state interamente concepite, architettate e sviluppate in collaborazione con modelli di intelligenza artificiale generativa (Google Gemini).

> **Disclaimer Nutrizionale e Medico**:
> * **Stime Approssimative**: I dati nutrizionali restituiti dall'IA sono calcolati sulla base di modelli probabilistici e descrizioni testuali. Non garantiscono precisione assoluta e possono variare rispetto ai valori reali delle etichette nutrizionali o della pesatura esatta.
> * **Nessun Valore Medico**: L'app **non fornisce consulenza medica o nutrizionale professionale**. I calcoli relativi al BMR, TDEE e bilancio calorico hanno scopo puramente informativo e di tracciamento personale.
> * **Consulta uno Specialista**: Per la stesura di piani alimentari, diete specifiche o per la gestione di patologie, fai sempre riferimento a un medico, nutrizionista o dietista qualificato.
> 
>
