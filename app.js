// --- CONFIGURAZIONE ENDPOINT (NESSUNA CHIAVE HARDCODED) ---
const SHEETS_API_URL = "https://script.google.com/macros/s/AKfycbxnhbY1MlxA0G6HswEoievtKY-tfuZ7pgJIZCE0ER44HnYy9m_4yX1CevLwfdZbyCMp/exec";

function getApiKey() {
  const params = new URLSearchParams(window.location.search);
  const urlKey = params.get('key');
  if (urlKey) return urlKey;

  const localKey = localStorage.getItem('cal_gemini_api_key');
  if (localKey && localKey.trim() !== '') return localKey.trim();

  return "";
}

// --- HASH PASSWORD SHA-256 (async) ---
async function hashPassword(raw) {
  const enc = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(raw));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// --- MAPPA LIVELLI ATTIVITÀ FISICA ---
const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725
};

const AVATAR_COLORS = [
  'linear-gradient(135deg, #6366f1, #a855f7)',
  'linear-gradient(135deg, #10b981, #059669)',
  'linear-gradient(135deg, #f59e0b, #d97706)',
  'linear-gradient(135deg, #ec4899, #be185d)',
  'linear-gradient(135deg, #3b82f6, #1d4ed8)',
  'linear-gradient(135deg, #8b5cf6, #6d28d9)'
];

// --- GESTIONE PROFILI ---
const FALLBACK_PROFILES = {
  "Emanuele": {
    gender: "male",
    age: 20,
    heightCm: 173,
    weightKg: 71,
    activityLevel: "sedentary",
    password: "",
    bioCred: "",
    apiKeyEncrypted: ""
  }
};

function getProfiles() {
  const stored = localStorage.getItem('cal_profiles_cloud');
  return stored ? JSON.parse(stored) : FALLBACK_PROFILES;
}

function saveProfilesLocally(profiles) {
  localStorage.setItem('cal_profiles_cloud', JSON.stringify(profiles));
}

let activeUser = localStorage.getItem('cal_active_user') || "Emanuele";
let pendingUserSwitch = null;

// --- VERIFICA SE PROFILO È PROTETTO ED È SBLOCCATO ---
function isUserProtected(username) {
  const profiles = getProfiles();
  const profile = profiles[username];
  if (!profile) return false;
  const hasPass = !!profile.password;
  const hasBio = !!localStorage.getItem(`bio_cred_${username.trim().toLowerCase()}`) || !!profile.bioCred;
  return hasPass || hasBio;
}

function isUserUnlocked(username) {
  if (!isUserProtected(username)) return true;
  return sessionStorage.getItem(`unlocked_${username}`) === "true";
}

function getUserSessionPassword(username) {
  const profiles = getProfiles();
  const profile = profiles[username];
  if (!profile) return "";
  const sessPass = sessionStorage.getItem(`pass_${username}`);
  if (sessPass !== null) return sessPass;
  if (profile.password) return profile.password;
  return `bio_protected_${username.trim().toLowerCase()}`;
}

// --- CRITTOGRAFIA ZERO-KNOWLEDGE (WEB CRYPTO API AES-GCM) ---
function bufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToBuffer(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function deriveCryptoKey(password, username) {
  const enc = new TextEncoder();
  const salt = enc.encode(`cal_tracker_salt_${username.toLowerCase()}`);
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password || "default_unlocked_pass"),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptData(dataObj, password, username) {
  try {
    const key = await deriveCryptoKey(password, username);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const encrypted = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      enc.encode(JSON.stringify(dataObj))
    );
    return JSON.stringify({
      cipher: bufferToBase64(encrypted),
      iv: bufferToBase64(iv)
    });
  } catch (err) {
    console.error("Errore crittografia:", err);
    return JSON.stringify(dataObj);
  }
}

async function decryptData(cipherText, password, username) {
  if (!cipherText) return null;
  try {
    let parsed;
    if (typeof cipherText === 'string') {
      try {
        parsed = JSON.parse(cipherText);
      } catch (e) {
        return null;
      }
    } else {
      parsed = cipherText;
    }

    if (Array.isArray(parsed)) return parsed;
    if (!parsed || !parsed.cipher || !parsed.iv) return parsed || null;

    const key = await deriveCryptoKey(password, username);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBuffer(parsed.iv) },
      key,
      base64ToBuffer(parsed.cipher)
    );
    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decrypted));
  } catch (err) {
    console.warn("Impossibile decifrare i dati:", err);
    return null;
  }
}

function calculateMetricsFor(profile) {
  if (!profile) return { bmr: 1700, tdee: 2040 };
  let bmr = (10 * profile.weightKg) + (6.25 * profile.heightCm) - (5 * profile.age);
  bmr = (profile.gender === "male") ? bmr + 5 : bmr - 161;
  const multiplier = ACTIVITY_MULTIPLIERS[profile.activityLevel] || 1.2;
  const tdee = Math.round(bmr * multiplier);
  return { bmr: Math.round(bmr), tdee };
}

// --- CALCOLO TARGET MACRONUTRIENTI ADATTATI AL PROFILO UTENTE ---
// Formule basate su linee guida WHO/EFSA, adattate a età/peso/sesso/altezza/attività.
function calculateMacroTargets(profile) {
  if (!profile) return { protein: 100, carbs: 250, fat: 70, fiber: 25, saturatedFat: 15 };
  const { tdee } = calculateMetricsFor(profile);
  const weight = profile.weightKg || 70;

  // Proteine: 1.8 g/kg peso (range 1.6-2.2 g/kg)
  const proteinTarget = Math.round(weight * 1.8);

  // Carboidrati: 50% del TDEE (4 kcal/g)
  const carbsTarget = Math.round((tdee * 0.50) / 4);

  // Grassi: 30% del TDEE (9 kcal/g)
  const fatTarget = Math.round((tdee * 0.30) / 9);

  // Fibre: 14g per 1000 kcal di TDEE (linea guida WHO)
  const fiberTarget = Math.round((tdee / 1000) * 14);

  // Grassi saturi: < 10% del TDEE da grassi saturi (9 kcal/g)
  const saturatedFatTarget = Math.round((tdee * 0.10) / 9);

  return {
    protein: proteinTarget,
    carbs: carbsTarget,
    fat: fatTarget,
    fiber: fiberTarget,
    saturatedFat: saturatedFatTarget
  };
}

// Restituisce i target effettivi: se il profilo ha valori personalizzati, usali, altrimenti calcolati
function getMacroTargets(profile) {
  if (!profile) return calculateMacroTargets(null);
  const calc = calculateMacroTargets(profile);
  return {
    protein: profile.proteinTarget != null ? Number(profile.proteinTarget) : calc.protein,
    carbs: profile.carbsTarget != null ? Number(profile.carbsTarget) : calc.carbs,
    fat: profile.fatTarget != null ? Number(profile.fatTarget) : calc.fat,
    fiber: profile.fiberTarget != null ? Number(profile.fiberTarget) : calc.fiber,
    saturatedFat: profile.saturatedFatTarget != null ? Number(profile.saturatedFatTarget) : calc.saturatedFat
  };
}

// --- SUPPORTO ED ESECUZIONE WEBAUTHN ---
async function isBiometricSupported() {
  return window.PublicKeyCredential &&
         typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function' &&
         await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
}

async function registerBiometric(username) {
  if (!await isBiometricSupported()) {
    alert("La biometria non è supportata su questo dispositivo o browser.");
    return false;
  }
  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);
    const userId = new TextEncoder().encode(username.toLowerCase());

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: challenge,
        rp: { name: "Calorie Tracker PWA" },
        user: {
          id: userId,
          name: username,
          displayName: username
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },
          { alg: -257, type: "public-key" }
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required"
        },
        timeout: 60000
      }
    });

    if (credential) {
      const credIdBase64 = bufferToBase64(credential.rawId);
      localStorage.setItem(`bio_cred_${username.trim().toLowerCase()}`, credIdBase64);
      
      const profiles = getProfiles();
      if (profiles[username]) {
        profiles[username].bioCred = credIdBase64;
        saveProfilesLocally(profiles);
        saveProfilesToCloud(profiles);
      }
      return true;
    }
  } catch (err) {
    console.warn("Registrazione biometrica non riuscita:", err);
  }
  return false;
}

async function verifyBiometric(username) {
  if (!await isBiometricSupported()) return false;
  const rawIdBase64 = localStorage.getItem(`bio_cred_${username.trim().toLowerCase()}`);
  
  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const allowCredentials = [];
    if (rawIdBase64) {
      const rawIdBuffer = base64ToBuffer(rawIdBase64);
      allowCredentials.push({
        id: rawIdBuffer,
        type: "public-key"
      });
    }

    const options = {
      publicKey: {
        challenge: challenge,
        userVerification: "required",
        timeout: 60000
      }
    };
    if (allowCredentials.length > 0) {
      options.publicKey.allowCredentials = allowCredentials;
    }

    const assertion = await navigator.credentials.get(options);
    return !!assertion;
  } catch (err) {
    console.warn("Verifica biometrica annullata o fallita:", err);
    return false;
  }
}

// --- GESTIONE STATO PASTI CON CRITTOGRAFIA E AGGIORNAMENTO AUTOMATICO DATA ---
function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

let currentDate = getTodayDateString();

function checkAndRefreshDate() {
  const today = getTodayDateString();
  if (today !== currentDate) {
    currentDate = today;
    const datePicker = document.getElementById('datePicker');
    if (datePicker) datePicker.value = currentDate;
    if (isUserUnlocked(activeUser)) {
      renderDashboard();
    }
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    checkAndRefreshDate();
  }
});
window.addEventListener('focus', checkAndRefreshDate);

function getStoredMealsKey() {
  return `calorie_tracker_meals_${activeUser.trim().toLowerCase()}`;
}

async function getStoredMeals() {
  const rawData = localStorage.getItem(getStoredMealsKey());
  if (!rawData) return [];
  const pass = getUserSessionPassword(activeUser);
  const dec = await decryptData(rawData, pass, activeUser);
  return Array.isArray(dec) ? dec : [];
}

async function saveMeals(meals) {
  const pass = getUserSessionPassword(activeUser);
  const encryptedPayload = await encryptData(meals, pass, activeUser);
  localStorage.setItem(getStoredMealsKey(), encryptedPayload);
}

// --- RIPRISTINO CHIAVE API DA PROFILE CLOUD CIFRATO ---
async function tryRestoreApiKeyFromProfile(username) {
  const profiles = getProfiles();
  const p = profiles[username];
  if (p && p.apiKeyEncrypted) {
    const pass = getUserSessionPassword(username);
    const decryptedKey = await decryptData(p.apiKeyEncrypted, pass, username);
    if (decryptedKey && typeof decryptedKey === 'string' && decryptedKey.trim() !== '') {
      localStorage.setItem('cal_gemini_api_key', decryptedKey.trim());
    }
  }
}

// --- SINCRONIZZAZIONE PROFILI E BIOMETRIA (CLOUD) ---
async function syncProfilesFromCloud() {
  if (!SHEETS_API_URL) return;
  try {
    const res = await fetch(`${SHEETS_API_URL}?type=profiles&t=${Date.now()}`, {
      method: "GET",
      redirect: "follow"
    });
    if (!res.ok) return;
    const result = await res.json();
    if (result.status === "success" && result.data && Object.keys(result.data).length > 0) {
      saveProfilesLocally(result.data);
      
      Object.keys(result.data).forEach(uName => {
        const p = result.data[uName];
        if (p && p.bioCred) {
          localStorage.setItem(`bio_cred_${uName.trim().toLowerCase()}`, p.bioCred);
        }
      });

      populateUserSelect();
      renderProfilesGrid();
    }
  } catch (err) {
    console.warn("Impossibile caricare i profili dal cloud:", err);
  }
}

async function saveProfilesToCloud(profiles) {
  if (!SHEETS_API_URL) return;
  try {
    await fetch(SHEETS_API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: "profiles", profiles: profiles })
    });
  } catch (err) {
    console.warn("Invio profili al cloud fallito:", err);
  }
}

// --- SINCRONIZZAZIONE PASTI (CLOUD) ---
async function syncFromGoogleSheets() {
  if (!SHEETS_API_URL || !isUserUnlocked(activeUser)) return;
  const statusEl = document.getElementById('syncStatus');
  if (statusEl) statusEl.innerText = `Sincronizzazione (${activeUser})...`;

  try {
    const fetchUrl = `${SHEETS_API_URL}?type=meals&user=${encodeURIComponent(activeUser)}&t=${Date.now()}`;
    const res = await fetch(fetchUrl, {
      method: "GET",
      redirect: "follow"
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const result = await res.json();
    if (result.status === "success" && Array.isArray(result.data)) {
      const pass = getUserSessionPassword(activeUser);
      let mealsToSave = [];

      if (result.data.length > 0 && result.data[0].encryptedBlob) {
        const dec = await decryptData(result.data[0].encryptedBlob, pass, activeUser);
        mealsToSave = Array.isArray(dec) ? dec : [];
      } else if (Array.isArray(result.data)) {
        mealsToSave = result.data;
      }

      await saveMeals(mealsToSave);
      await renderDashboard();
      if (statusEl) statusEl.innerText = `Sincronizzato: ${activeUser}`;
    }
  } catch (err) {
    console.warn("Sincronizzazione pasti non riuscita:", err);
    if (statusEl) statusEl.innerText = "Offline";
  }
}

async function syncToGoogleSheets(action, payload) {
  if (!SHEETS_API_URL || !isUserUnlocked(activeUser)) return;
  try {
    const pass = getUserSessionPassword(activeUser);
    const meals = payload.meals || (payload.meal ? [payload.meal] : []);
    const encryptedBlob = await encryptData(meals, pass, activeUser);

    await fetch(SHEETS_API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: "meals",
        action: action,
        user: activeUser,
        encryptedBlob: encryptedBlob,
        ...payload
      })
    });
  } catch (err) {
    console.warn("Invio dati pasti a Google Sheets fallito:", err);
  }
}

// --- SPUNTINI PROGRESSIVI ---
async function getNextSnackName(date) {
  const meals = (await getStoredMeals()).filter(m => m.date === date);
  const snackCount = meals.filter(m => m.type && m.type.startsWith("Spuntino")).length;
  return `Spuntino ${snackCount + 1}`;
}

// --- RENDERING DASHBOARD ---
async function renderDashboard() {
  if (!isUserUnlocked(activeUser)) {
    maskDashboardForLock();
    return;
  }

  const profiles = getProfiles();
  const profile = profiles[activeUser] || FALLBACK_PROFILES["Emanuele"];
  const { bmr, tdee } = calculateMetricsFor(profile);

  const allMeals = await getStoredMeals();
  const dayMeals = allMeals.filter(m => m.date === currentDate);

  let totalCal = 0, totalP = 0, totalC = 0, totalF = 0, totalFi = 0, totalSF = 0;
  dayMeals.forEach(m => {
    totalCal += m.calories || 0;
    totalP += m.protein || 0;
    totalC += m.carbs || 0;
    totalF += m.fat || 0;
    totalFi += m.fiber || 0;
    totalSF += m.saturatedFat || 0;
  });

  document.getElementById('totalCalories').innerText = totalCal;
  document.getElementById('totalProtein').innerText = totalP + "g";
  document.getElementById('totalCarbs').innerText = totalC + "g";
  document.getElementById('totalFat').innerText = totalF + "g";

  document.getElementById('targetTdee').innerText = tdee;
  document.getElementById('userBmrVal').innerText = bmr;

  const pctTdee = Math.min(Math.round((totalCal / tdee) * 100), 100);
  const pctBmr = Math.min(Math.round((bmr / tdee) * 100), 100);

  const progressBar = document.getElementById('calorieProgressBar');
  if (progressBar) {
    progressBar.style.width = pctTdee + "%";
    progressBar.style.backgroundColor = (totalCal > tdee) ? "var(--danger)" : "var(--accent)";
  }

  const bmrMarker = document.getElementById('bmrMarker');
  if (bmrMarker) {
    bmrMarker.style.left = pctBmr + "%";
  }

  // --- CIRCLE PROGRESS PER MACRONUTRIENTI ---
  const macroTargets = getMacroTargets(profile);
  const macroConsumed = {
    protein: totalP,
    carbs: totalC,
    fat: totalF,
    fiber: totalFi,
    saturatedFat: totalSF
  };
  renderMacroProgress(macroTargets, macroConsumed);

  const listContainer = document.getElementById('mealsList');
  listContainer.innerHTML = '';

  if (dayMeals.length === 0) {
    listContainer.innerHTML = '<div style="text-align:center; color: var(--text-muted); padding: 2rem;">Nessun pasto registrato per questa data.</div>';
    return;
  }

  dayMeals.forEach(meal => {
    const mealCard = document.createElement('div');
    mealCard.className = 'meal-card';
    const mealPct = ((meal.calories / tdee) * 100).toFixed(1);
    const gramsDisplay = meal.grams != null && meal.grams > 0 ? ` • ${meal.grams}g` : '';
    const macrosDisplay = `P: ${meal.protein}g | C: ${meal.carbs}g | G: ${meal.fat}g | Fibre: ${meal.fiber || 0}g | Gr.Sat: ${meal.saturatedFat || 0}g`;

    mealCard.innerHTML = `
      <div class="meal-info">
        <span class="meal-type">${meal.type || 'Pasto'} • ${mealPct}% TDEE</span>
        <span class="meal-name">${meal.name}${gramsDisplay}</span>
        <span class="meal-macros">${macrosDisplay}</span>
      </div>
      <div style="display:flex; align-items:center; gap: 8px;">
        <span class="meal-calories">${meal.calories} kcal</span>
        <button class="edit-btn" onclick="editMeal('${meal.id}')" title="Modifica pasto" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1rem;">✎</button>
        <button class="delete-btn" onclick="deleteMeal('${meal.id}')" title="Elimina pasto">✕</button>
      </div>
    `;
    listContainer.appendChild(mealCard);
  });
}

// --- CIRCLE PROGRESS PER MACRONUTRIENTI ---
function renderMacroProgress(targets, consumed) {
  const container = document.getElementById('macroProgressContainer');
  if (!container) return;

  const macros = [
    { key: 'protein', label: 'Proteine', color: '#60a5fa', consumed: consumed.protein, target: targets.protein },
    { key: 'carbs', label: 'Carboidrati', color: '#facc15', consumed: consumed.carbs, target: targets.carbs },
    { key: 'fat', label: 'Grassi', color: '#f87171', consumed: consumed.fat, target: targets.fat },
    { key: 'fiber', label: 'Fibre', color: '#fb923c', consumed: consumed.fiber, target: targets.fiber },
    { key: 'saturatedFat', label: 'Grassi Sat.', color: '#c084fc', consumed: consumed.saturatedFat, target: targets.saturatedFat }
  ];

  container.innerHTML = '';

  macros.forEach(macro => {
    const pct = macro.target > 0 ? Math.min(Math.round((macro.consumed / macro.target) * 100), 100) : 0;
    const circle = document.createElement('div');
    circle.className = 'macro-circle';
    circle.style.display = 'flex';
    circle.style.flexDirection = 'column';
    circle.style.alignItems = 'center';
    circle.style.gap = '4px';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '56');
    svg.setAttribute('height', '56');
    svg.setAttribute('viewBox', '0 0 56 56');

    const circumference = 2 * Math.PI * 26;
    const offset = circumference - (pct / 100) * circumference;

    const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bgCircle.setAttribute('cx', '28');
    bgCircle.setAttribute('cy', '28');
    bgCircle.setAttribute('r', '26');
    bgCircle.setAttribute('fill', 'none');
    bgCircle.setAttribute('stroke', '#334155');
    bgCircle.setAttribute('stroke-width', '6');

    const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    progressCircle.setAttribute('cx', '28');
    progressCircle.setAttribute('cy', '28');
    progressCircle.setAttribute('r', '26');
    progressCircle.setAttribute('fill', 'none');
    progressCircle.setAttribute('stroke', macro.color);
    progressCircle.setAttribute('stroke-width', '6');
    progressCircle.setAttribute('stroke-linecap', 'round');
    progressCircle.setAttribute('transform', 'rotate(-90 28 28)');
    progressCircle.setAttribute('stroke-dasharray', circumference);
    progressCircle.setAttribute('stroke-dashoffset', offset);
    progressCircle.style.transition = 'stroke-dashoffset 0.5s ease';

    svg.appendChild(bgCircle);
    svg.appendChild(progressCircle);

    const label = document.createElement('span');
    label.style.fontSize = '0.7rem';
    label.style.color = 'var(--text-muted)';
    label.textContent = macro.label;

    const value = document.createElement('span');
    value.style.fontSize = '0.75rem';
    value.style.fontWeight = '600';
    value.style.color = macro.color;
    value.textContent = pct + '%';

    circle.appendChild(svg);
    circle.appendChild(label);
    circle.appendChild(value);
    container.appendChild(circle);
  });
}

// --- MIGRAZIONE PASTI VECCHI (fibre e grassi saturi) ---
async function migrateTodayMeals() {
  const meals = await getStoredMeals();
  let changed = false;
  for (const m of meals) {
    if (m.fiber === undefined) {
      m.fiber = 0;
      changed = true;
    }
    if (m.saturatedFat === undefined) {
      m.saturatedFat = 0;
      changed = true;
    }
  }
  if (changed) {
    await saveMeals(meals);
    syncToGoogleSheets("syncAll", { meals: meals });
  }
}

async function deleteMeal(id) {
  if (!isUserUnlocked(activeUser)) return;
  let meals = await getStoredMeals();
  meals = meals.filter(m => m.id !== id);
  await saveMeals(meals);
  await renderDashboard();
  syncToGoogleSheets("syncAll", { meals: meals });
}

// --- MODIFICA PASTO (Opzione 1: ritocco testo + ricalcolo Gemini) ---
let editingMealId = null;

function openEditMealModal(meal) {
  editingMealId = meal.id;
  document.getElementById('editMealModalTitle').innerText = `Modifica Pasto: ${meal.type || 'Pasto'}`;
  document.getElementById('editMealTextInput').value = meal.name || '';
  document.getElementById('editMealStatus').innerText = '';
  document.getElementById('editMealModal').style.display = 'flex';
}

async function editMeal(id) {
  if (!isUserUnlocked(activeUser)) return;
  const meals = await getStoredMeals();
  const meal = meals.find(m => m.id === id);
  if (!meal) return;
  openEditMealModal(meal);
}

async function confirmEditMeal() {
  if (!editingMealId) return;
  const newText = document.getElementById('editMealTextInput').value.trim();
  if (!newText) {
    document.getElementById('editMealStatus').innerText = "Inserisci una descrizione del pasto.";
    document.getElementById('editMealStatus').style.color = "var(--danger)";
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    showMissingKeyWarning();
    return;
  }

  const statusEl = document.getElementById('editMealStatus');
  statusEl.innerText = "Ricalcolo nutrizionale in corso...";
  statusEl.style.color = "var(--accent)";

  try {
    const result = await analyzeMealWithGemini(newText);
    const meals = await getStoredMeals();
    const idx = meals.findIndex(m => m.id === editingMealId);
    if (idx === -1) return;

    meals[idx] = {
      ...meals[idx],
      type: result.mealType || meals[idx].type,
      name: result.mealDescription || newText,
      calories: Math.round(result.calories) || 0,
      protein: Math.round(result.protein) || 0,
      carbs: Math.round(result.carbs) || 0,
      fat: Math.round(result.fat) || 0,
      fiber: Math.round(result.fiber) || 0,
      saturatedFat: Math.round(result.saturatedFat) || 0,
      grams: result.grams != null ? Math.round(result.grams) : null
    };

    await saveMeals(meals);
    await renderDashboard();
    syncToGoogleSheets("syncAll", { meals: meals });

    statusEl.innerText = "Pasto modificato con successo!";
    statusEl.style.color = "var(--accent)";
    document.getElementById('editMealModal').style.display = 'none';
    editingMealId = null;
    setTimeout(() => { statusEl.innerText = ""; }, 3000);
  } catch (err) {
    if (err.message === "MISSING_API_KEY") {
      showMissingKeyWarning();
      return;
    }
    console.error(err);
    statusEl.innerText = "Errore: " + err.message;
    statusEl.style.color = "var(--danger)";
  }
}

function closeEditMealModal() {
  document.getElementById('editMealModal').style.display = 'none';
  editingMealId = null;
}

// --- MASCHERAMENTO DASHBOARD IN CASO DI BLOCCO ---
function maskDashboardForLock() {
  document.getElementById('totalCalories').innerText = "---";
  document.getElementById('totalProtein').innerText = "-";
  document.getElementById('totalCarbs').innerText = "-";
  document.getElementById('totalFat').innerText = "-";
  document.getElementById('targetTdee').innerText = "---";
  document.getElementById('userBmrVal').innerText = "---";
  const progressBar = document.getElementById('calorieProgressBar');
  if (progressBar) progressBar.style.width = "0%";
  document.getElementById('mealsList').innerHTML = '<div style="text-align:center; color: var(--text-muted); padding: 2rem;">🔒 Profilo bloccato. Autenticati per accedere ai dati.</div>';
}

// --- ELIMINAZIONE PROFILO ---
async function deleteProfile(targetUser) {
  if (!confirm(`Sei sicuro di voler eliminare definitivamente il profilo "${targetUser}" e tutti i suoi pasti? L'azione è irreversibile.`)) {
    return;
  }

  const profiles = getProfiles();
  delete profiles[targetUser];
  saveProfilesLocally(profiles);

  localStorage.removeItem(`calorie_tracker_meals_${targetUser.trim().toLowerCase()}`);
  localStorage.removeItem(`bio_cred_${targetUser.trim().toLowerCase()}`);
  sessionStorage.removeItem(`unlocked_${targetUser}`);
  sessionStorage.removeItem(`pass_${targetUser}`);

  if (SHEETS_API_URL) {
    try {
      await fetch(SHEETS_API_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "profiles", action: "deleteProfile", user: targetUser, profiles: profiles })
      });
    } catch (err) {
      console.warn("Richiesta eliminazione profilo al cloud fallita:", err);
    }
  }

  const remainingUsers = Object.keys(profiles);
  if (remainingUsers.length > 0) {
    activeUser = remainingUsers[0];
    localStorage.setItem('cal_active_user', activeUser);
  }

  document.getElementById('userModal').style.display = 'none';
  populateUserSelect();
  renderProfilesGrid();
  maskDashboardForLock();
  document.getElementById('landingScreen').style.display = 'flex';
}

// --- RENDERING GRID LANDING SCREEN (STILE NETFLIX) ---
function renderProfilesGrid() {
  const profiles = getProfiles();
  const grid = document.getElementById('profilesGrid');
  if (!grid) return;

  grid.innerHTML = '';
  const userNames = Object.keys(profiles);

  userNames.forEach((name, idx) => {
    const card = document.createElement('div');
    card.className = 'profile-card';

    const bgGradient = AVATAR_COLORS[idx % AVATAR_COLORS.length];
    const firstLetter = name.charAt(0).toUpperCase();
    const isProtected = isUserProtected(name);

    card.innerHTML = `
      <div class="profile-avatar" style="background: ${bgGradient};">
        ${firstLetter}
        ${isProtected ? '<div class="profile-badge-lock">🔒</div>' : ''}
      </div>
      <span class="profile-name">${name}</span>
    `;

    card.addEventListener('click', () => {
      selectProfileFromLanding(name);
    });

    grid.appendChild(card);
  });
}

async function selectProfileFromLanding(targetUser) {
  activeUser = targetUser;
  localStorage.setItem('cal_active_user', activeUser);
  populateUserSelect();

  const unlocked = await requestUserSwitch(targetUser);
  if (unlocked) {
    await onAuthenticationSuccess();
  }
}

async function onAuthenticationSuccess() {
  document.getElementById('landingScreen').style.display = 'none';
  await tryRestoreApiKeyFromProfile(activeUser);
  await renderDashboard();
  syncFromGoogleSheets();
}

// --- ESECUZIONE API GEMINI CON FALLBACK AUTOMATICO ---
async function callGeminiSingleModel(modelName, inputText, nextSnackLabel) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("MISSING_API_KEY");
  }

  const systemInstruction = `Sei un nutrizionista esperto. Analizza la descrizione del pasto fornita in italiano e restituisci ESCLUSIVAMENTE un JSON strutturato con le stime nutrizionali.
Se il pasto descritto è un generico snack/merenda/spuntino, imposta "mealType" con il valore "${nextSnackLabel}".
Se è Colazione, Pranzo o Cena, usa rispettivamente "Colazione", "Pranzo", "Cena".
Schema JSON richiesto:
{
  "mealType": "string",
  "mealDescription": "string",
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "fiber": number,
  "saturatedFat": number,
  "grams": number
}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: inputText }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: { responseMimeType: "application/json" }
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text);
}

async function analyzeMealWithGemini(inputText) {
  const nextSnackLabel = await getNextSnackName(currentDate);
  const primaryModel = localStorage.getItem('cal_primary_model') || "gemini-3.6-flash";
  const fallbackModel = localStorage.getItem('cal_fallback_model') || "gemini-3.1-flash-lite";

  try {
    return await callGeminiSingleModel(primaryModel, inputText, nextSnackLabel);
  } catch (primaryErr) {
    if (primaryErr.message === "MISSING_API_KEY") throw primaryErr;

    console.warn(`Modello primario (${primaryModel}) fallito:`, primaryErr);
    
    const statusEl = document.getElementById('inputStatus');
    if (statusEl) {
      statusEl.innerText = `Modello ${primaryModel} occupato. Passaggio a fallback (${fallbackModel})...`;
      statusEl.style.color = "#f59e0b";
    }

    try {
      return await callGeminiSingleModel(fallbackModel, inputText, nextSnackLabel);
    } catch (fallbackErr) {
      if (fallbackErr.message === "MISSING_API_KEY") throw fallbackErr;
      throw new Error(`Entrambi i modelli (${primaryModel} e ${fallbackModel}) non hanno risposto: ${fallbackErr.message}`);
    }
  }
}

function showMissingKeyWarning() {
  document.getElementById('missingKeyModal').style.display = 'flex';
}

// --- AGGIUNTA PASTO ---
async function handleMealSubmission(text) {
  if (!isUserUnlocked(activeUser)) {
    alert("Devi prima sbloccare il profilo per aggiungere un pasto.");
    requestUserSwitch(activeUser);
    return;
  }
  if (!text || text.trim() === '') return;

  const apiKey = getApiKey();
  if (!apiKey) {
    showMissingKeyWarning();
    return;
  }

  const statusEl = document.getElementById('inputStatus');
  statusEl.innerText = `Analisi per ${activeUser}...`;
  statusEl.style.color = "var(--accent)";

  try {
    const result = await analyzeMealWithGemini(text);

    const newMeal = {
      id: "meal_" + Date.now(),
      date: currentDate,
      type: result.mealType || "Pasto",
      name: result.mealDescription || text,
      calories: Math.round(result.calories) || 0,
      protein: Math.round(result.protein) || 0,
      carbs: Math.round(result.carbs) || 0,
      fat: Math.round(result.fat) || 0,
      fiber: Math.round(result.fiber) || 0,
      saturatedFat: Math.round(result.saturatedFat) || 0,
      grams: result.grams != null ? Math.round(result.grams) : null
    };

    const meals = await getStoredMeals();
    meals.push(newMeal);
    await saveMeals(meals);
    await renderDashboard();
    syncToGoogleSheets("add", { meal: newMeal, meals: meals });

    statusEl.innerText = "Pasto aggiunto con successo!";
    statusEl.style.color = "var(--accent)";
    document.getElementById('mealTextInput').value = '';
    setTimeout(() => { statusEl.innerText = ""; }, 3000);
  } catch (err) {
    if (err.message === "MISSING_API_KEY") {
      statusEl.innerText = "";
      showMissingKeyWarning();
      return;
    }
    console.error(err);
    statusEl.innerText = "Errore: " + err.message;
    statusEl.style.color = "var(--danger)";
  }
}

// --- GESTIONE SELETTORE, SBLOCCO E MODALI ---
function populateUserSelect() {
  const userSelect = document.getElementById('userSelect');
  const profiles = getProfiles();
  userSelect.innerHTML = '';

  Object.keys(profiles).forEach(user => {
    const opt = document.createElement('option');
    opt.value = user;
    const isProt = isUserProtected(user);
    const hasBio = !!localStorage.getItem(`bio_cred_${user.trim().toLowerCase()}`);
    opt.textContent = user + (isProt ? (hasBio ? " 🔒👆" : " 🔒") : "");
    if (user.toLowerCase() === activeUser.toLowerCase()) opt.selected = true;
    userSelect.appendChild(opt);
  });
}

function switchUser(targetUser) {
  activeUser = targetUser;
  localStorage.setItem('cal_active_user', activeUser);
  populateUserSelect();
}

async function requestUserSwitch(targetUser) {
  const profiles = getProfiles();
  const profile = profiles[targetUser];

  if (!profile) return false;

  if (!isUserProtected(targetUser) || sessionStorage.getItem(`unlocked_${targetUser}`) === "true") {
    switchUser(targetUser);
    return true;
  }

  maskDashboardForLock();

  pendingUserSwitch = targetUser;
  document.getElementById('unlockModalText').innerText = `Autenticati per accedere al profilo "${targetUser}".`;
  document.getElementById('unlockPasswordInput').value = "";
  document.getElementById('unlockError').innerText = "";

  const hasPass = !!profile.password;
  const passGroup = document.getElementById('unlockPasswordGroup');
  if (hasPass) {
    passGroup.style.display = "flex";
  } else {
    passGroup.style.display = "none";
  }

  const hasBio = !!localStorage.getItem(`bio_cred_${targetUser.trim().toLowerCase()}`) || !!profile.bioCred;
  const tryBioBtn = document.getElementById('tryBioBtn');
  if (hasBio && await isBiometricSupported()) {
    tryBioBtn.style.display = "block";
  } else {
    tryBioBtn.style.display = "none";
  }

  document.getElementById('unlockModal').style.display = "flex";
  return false;
}

function openProfileModal(isNew = false) {
  if (!isNew && !isUserUnlocked(activeUser)) {
    requestUserSwitch(activeUser);
    return;
  }

  const modal = document.getElementById('userModal');
  const profiles = getProfiles();
  const nameGroup = document.getElementById('userNameGroup');
  const modalTitle = document.getElementById('modalTitle');
  const bioStatusText = document.getElementById('bioStatusText');
  const deleteBtn = document.getElementById('deleteProfileBtn');

  if (isNew) {
    modalTitle.innerText = "Nuovo Profilo Utente";
    nameGroup.style.display = "flex";
    deleteBtn.style.display = "none";
    document.getElementById('profName').value = "";
    document.getElementById('profAge').value = "25";
    document.getElementById('profHeight').value = "175";
    document.getElementById('profWeight').value = "70";
    document.getElementById('profGender').value = "male";
    document.getElementById('profActivityLevel').value = "sedentary";
    document.getElementById('profPassword').value = "";
    bioStatusText.innerText = "";
  } else {
    modalTitle.innerText = `Modifica Profilo: ${activeUser}`;
    nameGroup.style.display = "none";
    deleteBtn.style.display = "block";
    const p = profiles[activeUser] || {};
    document.getElementById('profGender').value = p.gender || "male";
    document.getElementById('profAge').value = p.age || 20;
    document.getElementById('profHeight').value = p.heightCm || 173;
    document.getElementById('profWeight').value = p.weightKg || 71;
    document.getElementById('profActivityLevel').value = p.activityLevel || "sedentary";
    document.getElementById('profPassword').value = p.password || "";
    
    const hasBio = !!localStorage.getItem(`bio_cred_${activeUser.trim().toLowerCase()}`);
    bioStatusText.innerText = hasBio ? "Biometria registrata su questo dispositivo" : "Biometria non ancora configurata";
  }
  modal.style.display = "flex";
}

// --- INIZIALIZZAZIONE BLOCCANTE E CARICAMENTO DIFFERITO ---
document.addEventListener('DOMContentLoaded', async () => {
  checkAndRefreshDate();
  maskDashboardForLock();

  populateUserSelect();
  renderProfilesGrid();

  document.getElementById('landingScreen').style.display = 'flex';

  document.getElementById('landingAddUserBtn').addEventListener('click', () => {
    openProfileModal(true);
  });

  document.getElementById('deleteProfileBtn').addEventListener('click', () => {
    deleteProfile(activeUser);
  });

  document.getElementById('lockAppBtn').addEventListener('click', () => {
    sessionStorage.clear();
    maskDashboardForLock();
    renderProfilesGrid();
    document.getElementById('landingScreen').style.display = 'flex';
  });

  const userSelect = document.getElementById('userSelect');
  userSelect.addEventListener('change', async (e) => {
    const targetUser = e.target.value;
    userSelect.value = activeUser;
    const unlocked = await requestUserSwitch(targetUser);
    if (unlocked) {
      await onAuthenticationSuccess();
    }
  });

  document.getElementById('cancelUnlockBtn').addEventListener('click', () => {
    document.getElementById('unlockModal').style.display = 'none';
    pendingUserSwitch = null;
    populateUserSelect();
  });

  // AVVIO DIRETTO DELLA BIOMETRIA SU CLICK DELL'UTENTE
  document.getElementById('tryBioBtn').addEventListener('click', async () => {
    if (!pendingUserSwitch) return;
    const errorEl = document.getElementById('unlockError');
    errorEl.innerText = "Avvio della biometria in corso...";
    errorEl.style.color = "#38bdf8";

    const bioOk = await verifyBiometric(pendingUserSwitch);
    if (bioOk) {
      const profiles = getProfiles();
      const profile = profiles[pendingUserSwitch];
      sessionStorage.setItem(`unlocked_${pendingUserSwitch}`, "true");
      sessionStorage.setItem(`pass_${pendingUserSwitch}`, profile ? profile.password || "" : "");
      document.getElementById('unlockModal').style.display = 'none';
      switchUser(pendingUserSwitch);
      pendingUserSwitch = null;
      await onAuthenticationSuccess();
    } else {
      errorEl.innerText = "Riconoscimento biometrico annullato o fallito.";
      errorEl.style.color = "var(--danger)";
    }
  });

  document.getElementById('confirmUnlockBtn').addEventListener('click', async () => {
    if (!pendingUserSwitch) return;
    const profiles = getProfiles();
    const profile = profiles[pendingUserSwitch];
    const enteredPass = document.getElementById('unlockPasswordInput').value.trim();

    if (profile && profile.password) {
      const hashedInput = await hashPassword(enteredPass);
      if (hashedInput === profile.password) {
        sessionStorage.setItem(`unlocked_${pendingUserSwitch}`, "true");
        sessionStorage.setItem(`pass_${pendingUserSwitch}`, enteredPass);
        document.getElementById('unlockModal').style.display = 'none';
        switchUser(pendingUserSwitch);
        pendingUserSwitch = null;
        await onAuthenticationSuccess();
      } else {
        document.getElementById('unlockError').innerText = "Password errata. Riprova.";
        document.getElementById('unlockError').style.color = "var(--danger)";
      }
    } else {
      // No password set, rely on biometrics only
      sessionStorage.setItem(`unlocked_${pendingUserSwitch}`, "true");
      sessionStorage.setItem(`pass_${pendingUserSwitch}`, "");
      document.getElementById('unlockModal').style.display = 'none';
      switchUser(pendingUserSwitch);
      pendingUserSwitch = null;
      await onAuthenticationSuccess();
    }
  });

  document.getElementById('enrollBioBtn').addEventListener('click', async () => {
    const isNew = document.getElementById('userNameGroup').style.display !== "none";
    const targetName = isNew ? document.getElementById('profName').value.trim() : activeUser;

    if (!targetName) {
      alert("Inserisci prima un nome utente.");
      return;
    }

    const ok = await registerBiometric(targetName);
    const bioStatusText = document.getElementById('bioStatusText');
    if (ok) {
      bioStatusText.innerText = "Biometria registrata con successo su questo dispositivo!";
      bioStatusText.style.color = "var(--accent)";
      populateUserSelect();
      renderProfilesGrid();
    } else {
      bioStatusText.innerText = "Registrazione biometrica fallita o annullata.";
      bioStatusText.style.color = "var(--danger)";
    }
  });

  document.getElementById('editUserBtn').addEventListener('click', () => openProfileModal(false));
  document.getElementById('addUserBtn').addEventListener('click', () => openProfileModal(true));
  document.getElementById('cancelModalBtn').addEventListener('click', () => {
    document.getElementById('userModal').style.display = 'none';
  });

  // SALVATAGGIO PROFILO
  document.getElementById('saveProfileBtn').addEventListener('click', async () => {
    const profiles = getProfiles();
    const isNew = document.getElementById('userNameGroup').style.display !== "none";
    let targetName = activeUser;

    if (isNew) {
      const enteredName = document.getElementById('profName').value.trim();
      if (!enteredName) return alert("Inserisci un nome utente valido.");
      targetName = enteredName;
    }

    const currentMeals = await getStoredMeals();
    const enteredPass = document.getElementById('profPassword').value.trim();
    const hasBio = !!localStorage.getItem(`bio_cred_${targetName.trim().toLowerCase()}`);

    if (!enteredPass && !hasBio) {
      alert("⚠️ Per salvare il profilo è OBBLIGATORIO impostare almeno un metodo di autenticazione:\n\n1. Inserisci una Password\nOPPUR\n2. Registra la Biometria con il pulsante dedicato.");
      return;
    }

    if (isNew) {
      activeUser = targetName;
      localStorage.setItem('cal_active_user', activeUser);
    }

    const localApiKey = getApiKey();
    let encryptedKey = profiles[targetName]?.apiKeyEncrypted || "";
    if (localApiKey) {
      encryptedKey = await encryptData(localApiKey, enteredPass || `bio_protected_${targetName.trim().toLowerCase()}`, targetName);
    }

    profiles[targetName] = {
      gender: document.getElementById('profGender').value,
      age: Number(document.getElementById('profAge').value) || 20,
      heightCm: Number(document.getElementById('profHeight').value) || 170,
      weightKg: Number(document.getElementById('profWeight').value) || 70,
      activityLevel: document.getElementById('profActivityLevel').value,
      password: await hashPassword(enteredPass),
      bioCred: localStorage.getItem(`bio_cred_${targetName.trim().toLowerCase()}`) || profiles[targetName]?.bioCred || "",
      apiKeyEncrypted: encryptedKey
    };

    sessionStorage.setItem(`unlocked_${targetName}`, "true");
    sessionStorage.setItem(`pass_${targetName}`, enteredPass);

    saveProfilesLocally(profiles);
    await saveProfilesToCloud(profiles);

    if (currentMeals && Array.isArray(currentMeals) && currentMeals.length > 0) {
      await saveMeals(currentMeals);
      await syncToGoogleSheets("syncAll", { meals: currentMeals });
    }

    populateUserSelect();
    renderProfilesGrid();
    document.getElementById('userModal').style.display = 'none';

    await onAuthenticationSuccess();
  });

  // GESTIONE MODAL AI & CHIAVE API
  document.getElementById('openAiModalBtn').addEventListener('click', () => {
    document.getElementById('apiKeyInput').value = getApiKey();
    document.getElementById('primaryModelSelect').value = localStorage.getItem('cal_primary_model') || "gemini-3.6-flash";
    document.getElementById('fallbackModelSelect').value = localStorage.getItem('cal_fallback_model') || "gemini-3.1-flash-lite";
    document.getElementById('aiModal').style.display = "flex";
  });

  document.getElementById('closeAiModalBtn').addEventListener('click', async () => {
    const keyVal = document.getElementById('apiKeyInput').value.trim();
    if (keyVal) {
      localStorage.setItem('cal_gemini_api_key', keyVal);
      
      const profiles = getProfiles();
      if (profiles[activeUser]) {
        const pass = getUserSessionPassword(activeUser);
        profiles[activeUser].apiKeyEncrypted = await encryptData(keyVal, pass, activeUser);
        saveProfilesLocally(profiles);
        await saveProfilesToCloud(profiles);
      }
    } else {
      localStorage.removeItem('cal_gemini_api_key');
    }

    const primary = document.getElementById('primaryModelSelect').value;
    const fallback = document.getElementById('fallbackModelSelect').value;
    localStorage.setItem('cal_primary_model', primary);
    localStorage.setItem('cal_fallback_model', fallback);

    document.getElementById('aiModal').style.display = "none";
  });

  document.getElementById('openAiConfigFromWarningBtn').addEventListener('click', () => {
    document.getElementById('missingKeyModal').style.display = 'none';
    document.getElementById('openAiModalBtn').click();
  });

  const datePicker = document.getElementById('datePicker');
  if (datePicker) {
    datePicker.value = currentDate;
    datePicker.addEventListener('change', (e) => {
      currentDate = e.target.value;
      if (isUserUnlocked(activeUser)) {
        renderDashboard();
      }
    });
  }

  document.getElementById('submitTextBtn').addEventListener('click', () => {
    const text = document.getElementById('mealTextInput').value;
    handleMealSubmission(text);
  });

  document.getElementById('mealTextInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const text = document.getElementById('mealTextInput').value;
      handleMealSubmission(text);
    }
  });

  const voiceBtn = document.getElementById('voiceBtn');
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.lang = 'it-IT';
    recognition.continuous = false;
    recognition.interimResults = false;

    const startRecording = () => {
      if (!isUserUnlocked(activeUser)) {
        alert("Devi prima sbloccare il profilo!");
        requestUserSwitch(activeUser);
        return;
      }
      if (!getApiKey()) {
        showMissingKeyWarning();
        return;
      }
      try {
        recognition.start();
        voiceBtn.classList.add('recording');
        document.getElementById('inputStatus').innerText = "In ascolto... Parla ora.";
        document.getElementById('inputStatus').style.color = "var(--accent)";
      } catch (err) {
        console.warn("Avvio vocale:", err);
      }
    };

    voiceBtn.addEventListener('click', startRecording);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      document.getElementById('mealTextInput').value = transcript;
      handleMealSubmission(transcript);
    };

    recognition.onspeechend = () => {
      recognition.stop();
      voiceBtn.classList.remove('recording');
    };

    recognition.onerror = (event) => {
      voiceBtn.classList.remove('recording');
      document.getElementById('inputStatus').innerText = "Errore microfono: " + event.error;
      document.getElementById('inputStatus').style.color = "var(--danger)";
    };
  } else {
    voiceBtn.style.display = 'none';
  }

  // EVENT LISTENER MODAL MODIFICA PASTO
  document.getElementById('confirmEditMealBtn').addEventListener('click', confirmEditMeal);
  document.getElementById('cancelEditMealBtn').addEventListener('click', closeEditMealModal);

  await syncProfilesFromCloud();
await migrateTodayMeals();
});