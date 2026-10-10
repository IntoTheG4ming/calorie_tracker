// --- INIZIALIZZAZIONE AUTOMATICA SCHEDE E INTESTAZIONI ---
function initDatabaseSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Foglio 'Pasti'
  var mealsSheet = ss.getSheetByName("Pasti");
  if (!mealsSheet) {
    var defaultSheet = ss.getSheets()[0];
    if (defaultSheet && defaultSheet.getName() !== "Profili") {
      defaultSheet.setName("Pasti");
      mealsSheet = defaultSheet;
    } else {
      mealsSheet = ss.insertSheet("Pasti");
    }
  }

  // Header corretto per v1.9.8 (12 colonne)
  var header = [
    "Utente", "ID", "Data", "Tipo", "Descrizione",
    "Calorie", "Proteine", "Carboidrati", "Grassi",
    "Fibre", "Grassi Saturi", "BlobCifrato"
  ];

  if (mealsSheet.getLastRow() === 0) {
    mealsSheet.appendRow(header);
  } else {
    // Aggiorna l'header se il foglio è vecchio (meno di 12 colonne)
    var currentHeader = mealsSheet
      .getRange(1, 1, 1, mealsSheet.getLastColumn())
      .getValues()[0];
    if (currentHeader.length < 12) {
      mealsSheet
        .insertColumnsAfter(currentHeader.length, 12 - currentHeader.length);
      mealsSheet.getRange(1, 1, 1, 12).setValues([header]);
    }
  }

  // 2. Foglio 'Profili'
  var profilesSheet = ss.getSheetByName("Profili");
  if (!profilesSheet) {
    profilesSheet = ss.insertSheet("Profili");
  }
  if (profilesSheet.getLastRow() === 0) {
    profilesSheet.appendRow([
      "Nome", "Genere", "Eta", "Altezza", "Peso", "LivelloAttivita", "Password", "BioCred"
    ]);
    profilesSheet.appendRow([
      "Emanuele", "male", 20, 173, 71, "sedentary", "", ""
    ]);
  }

  return { mealsSheet: mealsSheet, profilesSheet: profilesSheet };
}

function getOrInitSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    initDatabaseSheets();
    sheet = ss.getSheetByName(name);
  }
  return sheet;
}

// --- Helper per hash password SHA-256 ---
function hashPasswordSHA256(pwd) {
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    Utilities.newBlob(pwd).getBytes()
  );
  var hex = digest.map(function (b) {
    var h = ('0' + b.toString(16)).slice(-2);
    return h;
  }).join('');
  return hex;
}

// --- GESTIONE LETTURA (GET) ---
function doGet(e) {
  initDatabaseSheets();

  var target = (e && e.parameter && e.parameter.type) ? e.parameter.type : "meals";
  var targetUser = (e && e.parameter && e.parameter.user) ? e.parameter.user.trim().toLowerCase() : "";

  // 1. Lettura Profili
  if (target === "profiles") {
    var pSheet = getOrInitSheet("Profili");
    var pData = pSheet.getDataRange().getDisplayValues();
    var profiles = {};
    for (var i = 1; i < pData.length; i++) {
      var name = String(pData[i][0]).trim();
      if (name) {
        profiles[name] = {
          gender: String(pData[i][1]).trim() || "male",
          age: Number(pData[i][2]) || 20,
          heightCm: Number(pData[i][3]) || 170,
          weightKg: Number(pData[i][4]) || 70,
          activityLevel: String(pData[i][5]).trim() || "sedentary",
          password: String(pData[i][6] || "").trim(),
          bioCred: String(pData[i][7] || "").trim(),
        };
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "success", data: profiles }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 2. Lettura Pasti
  var mSheet = getOrInitSheet("Pasti");
  var mData = mSheet.getDataRange().getDisplayValues();
  var meals = [];

  for (var j = 1; j < mData.length; j++) {
    var rowUser = String(mData[j][0]).trim().toLowerCase();
    if (!targetUser || rowUser === targetUser) {
      // Controlla sia la nuova posizione (colonna 11) sia quella vecchia (colonna 9) per compatibilità
      var blobValue = mData[j][11] || mData[j][9];
      if (blobValue) {
        meals.push({
          user: String(mData[j][0]).trim(),
          encryptedBlob: String(blobValue).trim(),
        });
      } else if (mData[j][1]) {
        meals.push({
          user: String(mData[j][0]).trim(),
          id: String(mData[j][1]).trim(),
          date: String(mData[j][2]).trim(),
          type: String(mData[j][3]).trim(),
          name: String(mData[j][4]).trim(),
          calories: Number(mData[j][5]) || 0,
          protein: Number(mData[j][6]) || 0,
          carbs: Number(mData[j][7]) || 0,
          fat: Number(mData[j][8]) || 0,
          fiber: Number(mData[j][9]) || 0,
          saturatedFat: Number(mData[j][10]) || 0,
        });
      }
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ status: "success", data: meals }))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- GESTIONE SCRITTURA ED ELIMINAZIONE (POST) ---
function doPost(e) {
  initDatabaseSheets();

  try {
    var contents = JSON.parse(e.postData.contents);
    var target = contents.target || "meals";
    var action = contents.action;
    var user = (contents.user || "").trim();

    // 1. Salvataggio ed Eliminazione Profili
    if (target === "profiles") {
      var pSheet = getOrInitSheet("Profili");

      if (action === "deleteProfile" && user) {
        var pData = pSheet.getDataRange().getDisplayValues();
        var newPData = [];
        if (pData.length > 0) newPData.push(pData[0]);
        for (var i = 1; i < pData.length; i++) {
          if (String(pData[i][0]).trim().toLowerCase() !== user.toLowerCase()) {
            newPData.push(pData[i]);
          }
        }
        pSheet.clearContents();
        if (newPData.length > 0) {
          pSheet.getRange(1, 1, newPData.length, 8).setValues(newPData);
        }

        var mSheet = getOrInitSheet("Pasti");
        var mData = mSheet.getDataRange().getDisplayValues();
        var newMData = [];
        if (mData.length > 0) newMData.push(mData[0]);
        for (var j = 1; j < mData.length; j++) {
          if (String(mData[j][0]).trim().toLowerCase() !== user.toLowerCase()) {
            newMData.push(mData[j]);
          }
        }
        mSheet.clearContents();
        if (newMData.length > 0) {
          mSheet.getRange(1, 1, newMData.length, 12).setValues(newMData);
        }

        return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      var profilesObj = contents.profiles || {};
      var rows = [
        [
          "Nome",
          "Genere",
          "Eta",
          "Altezza",
          "Peso",
          "LivelloAttivita",
          "Password",
          "BioCred",
        ],
      ];

      Object.keys(profilesObj).forEach(function (uName) {
        var p = profilesObj[uName];
        var pwHash = p.password ? hashPasswordSHA256(p.password) : "";
        rows.push([
          uName,
          p.gender,
          p.age,
          p.heightCm,
          p.weightKg,
          p.activityLevel,
          pwHash,
          p.bioCred || "",
        ]);
      });

      pSheet.clearContents();
      pSheet.getRange(1, 1, rows.length, 8).setValues(rows);

      return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Gestione Pasti
    if (!user) throw new Error("Utente non specificato");
    var mSheet = getOrInitSheet("Pasti");

    if (action === "syncAll") {
      var data = mSheet.getDataRange().getDisplayValues();
      var rowsToKeep = [];
      if (data.length > 0) rowsToKeep.push(data[0]);

      for (var k = 1; k < data.length; k++) {
        if (String(data[k][0]).trim().toLowerCase() !== user.toLowerCase()) {
          rowsToKeep.push(data[k]);
        }
      }

      if (contents.encryptedBlob) {
        rowsToKeep.push([
          user,
          "blob",
          "",
          "",
          "",
          0,
          0,
          0,
          0,
          0,
          0,
          contents.encryptedBlob,
        ]);
      } else {
        var userMeals = contents.meals || [];
        userMeals.forEach(function (m) {
          rowsToKeep.push([
            user,
            m.id,
            m.date,
            m.type,
            m.name,
            m.calories,
            m.protein,
            m.carbs,
            m.fat,
            m.fiber || 0,
            m.saturatedFat || 0,
            "",
          ]);
        });
      }

      mSheet.clearContents();
      if (rowsToKeep.length > 0) {
        mSheet.getRange(1, 1, rowsToKeep.length, 12).setValues(rowsToKeep);
      }

      return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "add") {
      if (contents.encryptedBlob) {
        var allData = mSheet.getDataRange().getDisplayValues();
        var updatedRows = [];
        if (allData.length > 0) updatedRows.push(allData[0]);

        for (var x = 1; x < allData.length; x++) {
          if (String(allData[x][0]).trim().toLowerCase() !== user.toLowerCase()) {
            updatedRows.push(allData[x]);
          }
        }
        updatedRows.push([
          user,
          "blob",
          "",
          "",
          "",
          0,
          0,
          0,
          0,
          0,
          0,
          contents.encryptedBlob,
        ]);

        mSheet.clearContents();
        mSheet.getRange(1, 1, updatedRows.length, 12).setValues(updatedRows);
      } else {
        var m = contents.meal;
        mSheet.appendRow([
          user,
          m.id,
          m.date,
          m.type,
          m.name,
          m.calories,
          m.protein,
          m.carbs,
          m.fat,
          m.fiber || 0,
          m.saturatedFat || 0,
          "",
        ]);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: err.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
