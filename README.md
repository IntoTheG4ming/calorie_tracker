# 🥗 Voice Calorie Tracker PWA

![PWA Ready](https://img.shields.io/badge/PWA-Ready-10b981?style=flat-square&logo=pwa)
![Gemini AI](https://img.shields.io/badge/AI-Gemini%20Flash-8e44ad?style=flat-square&logo=google)
![Zero-Knowledge Encryption](https://img.shields.io/badge/Security-AES--GCM%20256-blue?style=flat-square)
![Database](https://img.shields.io/badge/Database-Google%20Sheets-34a853?style=flat-square&logo=googlesheets)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

**Voice Calorie Tracker PWA** è un'applicazione web progressiva moderna, open-source e totalmente gratuita per il tracciamento quotidiano di calorie e macronutrienti. Combina la potenza dell'Intelligenza Artificiale di **Google Gemini** con la riservatezza della crittografia **Zero-Knowledge (AES-GCM 256)** e la versatilità di **Google Sheets** come database cloud personale serverless.

---

## 🎯 Scopo del Progetto e Architettura

L'obiettivo principale dell'applicazione è offrire un'esperienza di tracciamento alimentare rapida, priva di tracciamenti di terze parti e completamente gratuita, eliminando la complessità dell'inserimento manuale dei singoli ingredienti.

### 🌟 Caratteristiche Chiave

* 🧠 **Parsing Nutrizionale guidato da IA**: Trascrivi o descrivi a voce cosa hai mangiato in italiano colloquiale (es. *"100g di riso con tonno e un cucchiaio d'olio d'oliva"*). L'IA estrae ed elabora istantaneamente calorie, proteine, carboidrati e grassi.
* 🔐 **Gestione Sicura e Riservata della Chiave API**: Nessuna chiave API viene mai inserita nel codice sorgente pubblico. La tua chiave API Gemini personale viene memorizzata privatamente nel browser e sincronizzata sul cloud in forma **completamente cifrata** col tuo profilo, resistendo alla cancellazione dei dati locali.
* ⚡ **Resilienza e Fallback AI Automatico**: Utilizzo del modello primario (`gemini-3.6-flash`) con commutazione automatica su un modello secondario di backup (`gemini-3.1-flash-lite`) in caso di picchi di traffico o saturazione della quota API gratuita.
* 🔒 **Crittografia Zero-Knowledge Client-Side (AES-GCM 256)**: Tutti i dati nutrizionali, le informazioni del profilo e le chiavi API vengono cifrati direttamente all'interno del browser con una chiave derivata via **PBKDF2**. I dati salvati localmente o inviati a Google Sheets sono del tutto illeggibili a terzi.
* 🎬 **Landing Screen Multi-Profilo "Stile Netflix"**: Selezione visiva e intuitive del profilo utente all'avvio dell'applicazione con avatar cromatici e indicatori dello stato di protezione.
* 👆 **Autenticazione Biometrica Hardware (`WebAuthn`) & Password**: Protezione di ciascun profilo tramite password e/o sblocco biometrico locale con impronta digitale, Face ID, Touch ID o Windows Hello.
* 📊 **Database Cloud Serverless su Google Sheets**: Archiviazione dati isolata per utente su fogli di calcolo personali tramite Google Apps Script con protezione anti-sovrascrittura automatica.
* 📅 **Gestione Intelligente della Data**: Rilevamento automatico del cambio di data a mezzanotte e al ripristino dell'app da background.
* 📲 **Integrazione iOS / iPadOS**: Avvio diretto del tracciamento vocale da Comandi Rapidi o Siri tramite parametri URL integrati.
* 💻 **Esperienza Cross-Platform & PWA Installabile**: Installabile come app nativa su Windows, macOS, Linux, Android, iOS e iPadOS con gestione automatica degli aggiornamenti via Service Worker.

---

## 🛠️ Stack Tecnologico

| Componente | Tecnologia | Descrizione |
| :--- | :--- | :--- |
| **Frontend** | HTML5, CSS3, JavaScript (ES6+) | Interfaccia responsive dark mode ad alte prestazioni senza framework pesanti. |
| **Security Layer** | Web Crypto API (`AES-GCM 256` + `PBKDF2`) | Crittografia client-side a zero conoscenza per dati nutrizionali e credenziali. |
| **Biometria** | WebAuthn API | Autenticazione hardware locale (Face ID, Touch ID, impronte, Windows Hello). |
| **AI Engine** | Google Gemini API (`v1beta`) | Modello LLM per la conversione del linguaggio naturale in JSON nutrizionale. |
| **Backend / DB** | Google Apps Script + Google Sheets | REST API serverless personalizzata per la persistenza e la sincronizzazione cloud. |
| **PWA Layer** | Service Worker & Web Manifest | Caching offline, installabilità nativa e aggiornamento automatico background. |

---

## 🚀 Guida all'Installazione e Configurazione Dettagliata

Sia che tu voglia eseguire l'applicazione in locale sul tuo computer, sia che tu voglia pubblicarla gratuitamente online per la sincronizzazione multi-dispositivo, segui questa guida passo-passo.

---

### PASSO 1: Configurazione del Backend Cloud (Google Sheets & Apps Script)

Questa procedura va eseguita una sola volta e permette di creare il tuo database cloud gratuito su Google Drive.

1. Apri il tuo browser e accedi a [Google Sheets](https://sheets.google.com).
2. Crea un **nuovo foglio di calcolo vuoto** e assegna un nome a tua scelta (es. `Calorie Tracker DB`).
3. Nel menu in alto, clicca su **Estensioni** ➔ **Apps Script**.
4. Cancella qualsiasi codice presente nell'editor di Apps Script e incolla integralmente il codice contenuto nel file `Codice.gs` del progetto.
5. In alto nell'interfaccia, seleziona la funzione `initDatabaseSheets` dal menu a tendina delle funzioni e clicca su **Esegui**.
   * *Nota*: Se Google richiede l'autorizzazione all'accesso, clicca su *Rivedi autorizzazioni*, seleziona il tuo account Google, clicca su *Avanzate* e infine su *Apri (nome progetto) (non sicura)*.
6. Clicca sul pulsante blu **Esegui deployment** (in alto a destra) ➔ **Nuovo deployment**.
7. Clicca sull'icona a ingranaggio ⚙️ accanto a "Seleziona tipo" e scegli **Applicazione Web**.
8. Configura i campi come segue:
   * **Descrizione**: `Backend Calorie Tracker`
   * **Esegui come**: `Utente corrente (me@gmail.com)`
   * **Chi può accedere**: `Chiunque`
9. Clicca su **Esegui deployment**, autorizza nuovamente se richiesto, e **copia l'URL dell'applicazione web** fornito (avrà una struttura del tipo `https://script.google.com/macros/s/.../exec`).

---

### PASSO 2A: Esecuzione ed Hosting in Locale su PC

Se desideri utilizzare l'app esclusivamente sul tuo computer senza pubblicarla su internet:

#### 1. Clona o Scarica il Repository
Apri il terminale del tuo sistema operativo o Git Bash ed esegui:
```bash
git clone [https://github.com/IntoTheG4ming/calorie_tracker.git](https://github.com/IntoTheG4ming/calorie_tracker.git)
cd calorie_tracker

```

*(In alternativa, scarica lo ZIP del repository da GitHub ed estrailo in una cartella).*

#### 2. Configura l'URL di Google Apps Script

Apri la cartella del progetto con un editor di testo (es. VS Code) e apri il file `app.js`. Inserisci l'URL di Google Apps Script ottenuto al PASSO 1 alla riga 2:

```javascript
const SHEETS_API_URL = "[https://script.google.com/macros/s/IL_TUO_SCRIPT_ID/exec](https://script.google.com/macros/s/IL_TUO_SCRIPT_ID/exec)";

```

#### 3. Avvia un Server Web Locale

Poiché l'applicazione fa uso di Service Worker e WebAuthn (biometria), deve essere servita tramite protocollo `http://localhost`.

Scegli una delle seguenti opzioni:

* **Opzione 1 (VS Code con Live Server - Consigliata)**:
1. Installa l'estensione **Live Server** in VS Code.
2. Clicca con il tasto destro sul file `index.html`.
3. Seleziona **Open with Live Server**.


* **Opzione 2 (Python)**:
Apri il terminale all'interno della cartella di progetto ed esegui:
```bash
python -m http.server 8000

```


Apri il browser all'indirizzo `http://localhost:8000`.
* **Opzione 3 (Node.js / npx)**:
Apri il terminale ed esegui:
```bash
npx serve .

```



---

### PASSO 2B: Deploy Pubblico su GitHub Pages (Sincronizzazione Multi-Dispositivo)

Per accedere all'app da qualsiasi dispositivo ovunque ti trovi:

1. Assicurati di aver aggiornato `app.js` con l'URL del tuo Apps Script.
2. Carica ed effettua il push dei file del progetto sul tuo repository GitHub:
```bash
git add .
git commit -m "deploy: configurazione iniziale"
git push origin main

```


3. Vai sulla pagina del tuo repository su **GitHub.com**.
4. Clicca su **Settings** (Impostazioni) ➔ nel menu laterale seleziona **Pages**.
5. Nella sezione **Build and deployment**:
* **Source**: seleziona `Deploy from a branch`.
* **Branch**: seleziona `main` e cartella `/ (root)`.


6. Clicca su **Save**. Dopo 1-2 minuti, GitHub fornirà l'URL pubblico del tuo sito (es. `https://intotheg4ming.github.io/calorie_tracker/`).

---

### PASSO 3: Configurazione della Chiave API Google Gemini

Per motivi di sicurezza e conformità con i termini di Google, la chiave API non è inclusa nel codice sorgente e deve essere configurata dall'utente nell'interfaccia dell'app.

1. Apri l'applicazione nel browser o PWA.
2. Clicca sul pulsante **🤖 Modelli AI** nella barra superiore.
3. Se non possiedi ancora una chiave API, clicca sul link **🔑 Ottieni Chiave API GRATIS su Google AI Studio ➔** che ti reindirizzerà direttamente alla console ufficiale di Google.
4. Genera una nuova API Key (gratuita) e copiala.
5. Incolla la chiave nel campo **Chiave API Google Gemini** e clicca su **Salva e Chiudi**.

> 💡 **Nota sulla Persistenza**: La tua chiave API verrà cifrata con la password del tuo profilo e salvata sia localmente sia sul tuo Google Sheets. Rimarrà attiva anche in caso di aggiornamenti dell'app o pulizia della memoria del browser.

---

## 📱 Installazione PWA e Integrazione iOS / iPadOS

### Installazione come App (Android / iOS / Desktop)

* **iPhone / iPad (Safari)**: Apri l'URL della tua PWA in Safari, tocca il pulsante **Condividi** (quadrato con freccia ⬆️), scorri in basso e seleziona **Aggiungi alla schermata Home**.
* **Android (Chrome)**: Apri l'URL della tua PWA, tocca il menu con i tre puntini (`⋮`) in alto a destra e seleziona **Aggiungi a schermata Home** o **Installa app**.
* **PC / Mac (Chrome / Edge)**: Clicca sull'icona di installazione nella barra degli indirizzi o nel menu del browser.

### Integrazione Comandi Rapidi (Siri su iOS / iPadOS)

Puoi registrare un pasto a voce tramite Siri o widget creando un Comando Rapido personalizzato:

1. Apri l'app **Comandi Rapidi** su iOS/iPadOS.
2. Clicca sul tasto **+** per creare un nuovo comando rapido.
3. Aggiungi le seguenti azioni in ordine:
* **Dettatura testo**: Imposta la lingua su *Italiano*.
* **Codifica URL**: Imposta come input il *Testo Dettato*.
* **Apri URL**: Inserisci l'URL della tua PWA (sostituendo l'indirizzo di esempio con quello del tuo hosting) seguito dal parametro `?meal=`:
```text
[https://tuo-username.github.io/calorie_tracker/?meal=](https://tuo-username.github.io/calorie_tracker/?meal=)[URL Codificato]

```


*(Esempio: `https://intotheg4ming.github.io/calorie_tracker/?meal=[URL Codificato]`)*


4. Assegna un nome al Comando Rapido (es. *"Registra Pasto"*).
5. Pronuncia *"Ehi Siri, Registra Pasto"* per avviare la dettatura automatica.

---

## ⚠️ Disclaimer sull'utilizzo e lo Sviluppo con IA

> **Sviluppo assistito da IA**: Questa applicazione e l'intera architettura software (Frontend, PWA Service Worker, crittografia client-side AES-GCM, integrazione WebAuthn e backend Google Apps Script) sono state interamente concepite, progettate e sviluppate in collaborazione con modelli di intelligenza artificiale generativa (Google Gemini).

> **Disclaimer Nutrizionale e Medico**:
> * **Stime Approssimative**: I dati nutrizionali e le stime di calorie, proteine, carboidrati e grassi restituiti dall'IA sono calcolati sulla base di modelli probabilistici e descrizioni testuali colloquiali. Non garantiscono precisione assoluta e possono differire dai valori reali o dalle tabelle nutrizionali ufficiali.
> * **Nessun Valore Medico**: L'applicazione **non fornisce consulenza medica, nutrizionale o dietetica professionale**. I calcoli relativi al BMR (Metabolismo Basale), TDEE (Fabbisogno Energetico) e al bilancio calorico hanno scopo puramente informativo e di tracciamento personale.
> * **Consulta uno Specialista**: Per la stesura di piani alimentari, diete per la gestione del peso o per qualsiasi patologia, fai sempre riferimento a un medico, nutrizionista o dietista qualificato.
> 
> 

---

## 📄 Licenza

Questo progetto è distribuito sotto licenza **MIT**. Libero per uso personale e modifiche.

