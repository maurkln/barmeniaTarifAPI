const express = require("express")
const bodyParser = require("body-parser")
const axios = require("axios")
const cors = require("cors")
const dayjs = require("dayjs")

const app = express()

// Middleware
app.use(bodyParser.json())
// app.use(cors({ origin: ["http://localhost:5173", "null", "https://pfoteplus.de", "http://31.17.172.189:5173"] })) // Erlaubt Zugriff vom Frontend und File index.html
app.use(cors({ origin: "*" })) // Erlaubt Zugriff uberall

const apiUrl = "https://ssl.barmenia.de/api/oa-bff-tier/tarifierung/"
const apiUrlBasis = "https://ssl.barmenia.de/api/oa-bff-tier/tarifierung/Basis"
const apiUrlTopMitZahn = "https://ssl.barmenia.de/api/oa-bff-tier/tarifierung/Top"
const apiUrlTopOhneZahn = "https://ssl.barmenia.de/api/oa-bff-tier/tarifierung/Top_Akut"
const apiUrlPremiumMitZahn = "https://ssl.barmenia.de/api/oa-bff-tier/tarifierung/Premium_1200"
const apiUrlPremiumOhneZahn = "https://ssl.barmenia.de/api/oa-bff-tier/tarifierung/Premium_Akut_1200"
const apiUrlPremiumPlusOhneZahnOhneKons = "https://ssl.barmenia.de/api/oa-bff-tier/tarifierung/Premium_Plus_Akut_1200"
const apiUrlPremiumPlusOhneZahnMitKons = "https://ssl.barmenia.de/api/oa-bff-tier/tarifierung/Premium_Plus_Akut"
const apiUrlPremiumPlusMitZahnMitKons = "https://ssl.barmenia.de/api/oa-bff-tier/tarifierung/Premium_Plus"
const apiUrlPremiumPlusMitZahnOhneKons = "https://ssl.barmenia.de/api/oa-bff-tier/tarifierung/Premium_Plus_1200"

// Altersberechnung
function berechneAlter(geburtsdatum, versicherungsbeginn) {
  const birthDate = new Date(geburtsdatum)
  const insuranceStartDate = new Date(versicherungsbeginn)
  let ageAtStart = insuranceStartDate.getFullYear() - birthDate.getFullYear()
  const monthDiff = insuranceStartDate.getMonth() - birthDate.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && insuranceStartDate.getDate() < birthDate.getDate())) {
    ageAtStart-- // Alter um 1 reduzieren, falls Geburtsmonat im Versicherungsjahr nicht erreicht wurde
  }
  return ageAtStart
}

// Tarifierungs-API-Schnittstelle
app.post("/api/dog/tarifierung", async (req, res) => {
  console.log("Neue Dog Anfrage eingetroffen!")
  console.log("Request-Body:", JSON.stringify(req.body, null, 2)) // Logge den gesamten Body

  // Frontend-Daten extrahieren
  const { hunderasse, geburtsdatum, versicherungsbeginn, zahlweise } = req.body

  // Überprüfe die Felder auf Validität
  if (!hunderasse || !geburtsdatum || !versicherungsbeginn || !zahlweise) {
    console.error("Fehlende oder ungültige Felder im Request!")
    return res.status(400).json({ error: "Fehlende oder ungültige Felder im Request" })
  }

  // Alter des Hundes berechnen
  const ageAtStart = berechneAlter(geburtsdatum, versicherungsbeginn)
  const isOlderDog = ageAtStart >= 4 // Setze älter als 4 Jahre als Grenzwert
  const isDogTooOldForKv = ageAtStart > 5 // Hunde älter als 5 Jahre erhalten keine KV-Versicherung
  const isDogTooOldForAll = ageAtStart >= 9

  // Logge die Eingaben und Alter
  console.log(`Hunderasse: ${hunderasse}`)
  console.log(`Geburtsdatum (Raw): ${geburtsdatum}`)
  console.log(`Versicherungsbeginn (Raw): ${versicherungsbeginn}`)
  console.log(`Alter des Hundes bei Versicherungsbeginn: ${ageAtStart} Jahre`)

  // Datumswerte ins ursprüngliche ISO-Format bringen
  const formattedGeburtsdatum = dayjs(geburtsdatum).format("YYYY-MM-DDTHH:mm:ssZ")
  const formattedVersicherungsbeginn = dayjs(versicherungsbeginn).format("YYYY-MM-DDTHH:mm:ssZ")

  console.log("Formatierte Werte:")
  console.log("   Formatiertes Geburtsdatum:", formattedGeburtsdatum)
  console.log("   Formatierter Versicherungsbeginn:", formattedVersicherungsbeginn)

  // Basis-Payload erstellen und basierend auf Alter anpassen
  const basePayload = {
    personenIdCounter: 1,
    bankdaten: { iban: "" },
    kreditkarte: {},
    pspDaten: {},
    personen: [
      {
        vorbelegungAnrede: false,
        isDateValid: false,
        isVornameValid: true,
        isNachnameValid: true,
        anrede: "Herr",
        vorvertrag: "Kein Vorvertrag",
        versicherungsbeginn: formattedVersicherungsbeginn,
        gesundheitsdaten: { koerpergroesse: null, koerpergewicht: null },
        gesundheitsfragen: {},
        tarife: null,
        rollen: ["VERSICHERUNGSNEHMER"],
        id: "vn",
        geburtsdatum: formattedGeburtsdatum
      }
    ],
    zahlungsart: "bankdaten",
    paypalEmailAdresse: null,
    angebotsnummer: null,
    angebotstechnummer: null,
    pdf: null,
    device: "Desktop",
    oaName: "tier",
    sparte: "BA",
    oaSpezifisch: {
      tierart: "Hund",
      erstattungssatz: "PROZENT_100",
      geschlecht: "m",
      zahlweise: zahlweise,
      selbstbeteiligungBeitrag: 0,
      spezialTarif: "",
      tarif: "",
      isKV: true,
      showOP: true,
      pferd: true,
      vuz: true,
      disableSbCheckboxKv: false,
      disableSbCheckboxOp: false,
      showAbschlussButton: true,
      tierartParam: "Hund",
      hunderasse: hunderasse,
      hunderassenList: [hunderasse],
      geburtsdatum: formattedGeburtsdatum,
      operationskosten: false
    },
    browser: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.0.0 Safari/537.36",
    aktionsnummer: "334003",
    emid: null
  }

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/plain, */*",
    Origin: "https://ssl.barmenia.de",
    Referer: "https://ssl.barmenia.de/online-versichern/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.0.0 Safari/537.36"
  }

  const kvPayloadOhneSb = {
    ...basePayload,
    oaSpezifisch: {
      ...basePayload.oaSpezifisch,
      versicherung: "kv",
      selbstbeteiligung: false
    }
  }

  const kvPayloadMitSb = {
    ...basePayload,
    oaSpezifisch: {
      ...basePayload.oaSpezifisch,
      versicherung: "kv",
      selbstbeteiligung: true
    }
  }

  const opPayloadOhneSb = {
    ...basePayload,
    oaSpezifisch: {
      ...basePayload.oaSpezifisch,
      versicherung: "op",
      selbstbeteiligung: false
    }
  }

  const opPayloadMitSb = {
    ...basePayload,
    oaSpezifisch: {
      ...basePayload.oaSpezifisch,
      versicherung: "op",
      selbstbeteiligung: true
    }
  }

  const finalResponses = {
    opSchutz: {
      beitragOhneSb: 0,
      beitragMitSb: 0
    },
    basis: {
      beitragOhneSb: 0,
      beitragMitSb: 0
    },
    top: {
      beitragOhneSbOhneZahn: 0,
      beitragMitSbOhneZahn: 0,
      beitragOhneSbMitZahn: 0,
      beitragMitSbMitZahn: 0
    },
    premium: {
      beitragOhneSbOhneZahn: 0,
      beitragMitSbOhneZahn: 0,
      beitragOhneSbMitZahn: 0,
      beitragMitSbMitZahn: 0
    },
    premiumPlus: {
      beitragOhneSbOhneZahn: 0,
      beitragMitSbOhneZahn: 0,
      beitragOhneSbMitZahn: 0,
      beitragMitSbMitZahn: 0
    }
  }

  try {
    // 1. und 2. fetch API KV ohne SB und mit sb

    console.log("Fetching Data from Barmenia API...")

    // Zuletzt die fetches an op schutz
    finalResponses.opSchutz.beitragOhneSb = await fetchOp(opPayloadOhneSb)
    finalResponses.opSchutz.beitragMitSb = await fetchOp(opPayloadMitSb)

    finalResponses.basis.beitragOhneSb = await fetchBasis(kvPayloadOhneSb)
    finalResponses.basis.beitragMitSb = await fetchBasis(kvPayloadMitSb)

    // 3. und 4. fetch an /Top für Zahn mit sb ohne sb
    finalResponses.top.beitragOhneSbOhneZahn = await fetchTopOhneZahn(kvPayloadOhneSb)
    finalResponses.top.beitragMitSbOhneZahn = await fetchTopOhneZahn(kvPayloadMitSb)
    finalResponses.top.beitragOhneSbMitZahn = await fetchTopMitZahn(kvPayloadOhneSb)
    finalResponses.top.beitragMitSbMitZahn = await fetchTopMitZahn(kvPayloadMitSb)

    // 5. und 6. fetch an /Premium für Zahn mit sb ohne sb

    finalResponses.premium.beitragOhneSbOhneZahn = await fetchPremiumOhneZahn(kvPayloadOhneSb)
    finalResponses.premium.beitragMitSbOhneZahn = await fetchPremiumOhneZahn(kvPayloadMitSb)
    finalResponses.premium.beitragOhneSbMitZahn = await fetchPremiumMitZahn(kvPayloadOhneSb)
    finalResponses.premium.beitragMitSbMitZahn = await fetchPremiumMitZahn(kvPayloadMitSb)

    // Danach alle neuen Premium_Plus fetches

    finalResponses.premiumPlus.beitragOhneSbOhneZahn = await fetchPremiumPlusOhneZahnMitKons(opPayloadOhneSb)
    finalResponses.premiumPlus.beitragMitSbOhneZahn = await fetchPremiumPlusOhneZahnMitKons(opPayloadMitSb)
    finalResponses.premiumPlus.beitragOhneSbMitZahn = await fetchPremiumPlusMitZahnMitKons(opPayloadOhneSb)
    finalResponses.premiumPlus.beitragMitSbMitZahn = await fetchPremiumPlusMitZahnMitKons(opPayloadMitSb)

    // fill into finalResponses

    // Final return after fetching all data

    console.log("Successfully fetched all data from API. Final Response to client:")
    console.log(JSON.stringify(finalResponses, null, 2))

    return res.json(finalResponses)
  } catch (error) {
    console.error("Ein Fehler ist aufgetreten:", error.message)
    if (error.response) {
      console.error("Fehlerdetails:", error.response.data)
    }
    return res.status(500).json({ error: "Interner Serverfehler bei der Tarifierung" })
  }

  async function fetchBasis(payload) {
    try {
      const newPayload = {
        ...payload,
        oaSpezifisch: {
          ...payload.oaSpezifisch,

          versicherung: "kv",
          tierart: "Hund",
          erstattungssatz: "PROZENT_100",
          geschlecht: "m",
          selbstbeteiligungBeitrag: 0,
          spezialTarif: "",
          tarif: "Basis",
          isKV: false,
          showOP: false,
          pferd: true,
          vuz: true,
          disableSbCheckboxKv: false,
          disableSbCheckboxOp: false,
          showAbschlussButton: true
        }
      }
      const response = await axios.post(apiUrlBasis, newPayload, { headers })
      const tarif = response.data.tarifBeitraege.Basis
      console.log("Fetch from ", apiUrlBasis, " for Basis was successfull.")
      return tarif[0].beitrag
    } catch (error) {
      return "ERROR"
    }
  }

  async function fetchTopOhneZahn(payload) {
    try {
      const newPayload = {
        ...payload,
        oaSpezifisch: {
          ...payload.oaSpezifisch,

          versicherung: "kv",
          tierart: "Hund",
          erstattungssatz: "PROZENT_100",
          geschlecht: "m",
          selbstbeteiligungBeitrag: 0,
          spezialTarif: "Top_Akut",
          tarif: "Top_Akut",
          isKV: false,
          showOP: false,
          pferd: true,
          vuz: true,
          disableSbCheckboxKv: false,
          disableSbCheckboxOp: false,
          showAbschlussButton: true
        }
      }
      const response = await axios.post(apiUrlTopOhneZahn, newPayload, { headers })
      const tarif = response.data.tarifBeitraege.Top_Akut
      console.log("Fetch from ", apiUrlTopOhneZahn, " for TopOhneZahn was successfull.")
      return tarif[0].beitrag
    } catch (error) {
      return "ERROR"
    }
  }

  async function fetchTopMitZahn(payload) {
    try {
      const newPayload = {
        ...payload,
        oaSpezifisch: {
          ...payload.oaSpezifisch,

          versicherung: "kv",
          tierart: "Hund",
          erstattungssatz: "PROZENT_100",
          geschlecht: "m",
          selbstbeteiligungBeitrag: 0,
          spezialTarif: "",
          tarif: "Top",
          isKV: false,
          showOP: false,
          pferd: true,
          vuz: true,
          disableSbCheckboxKv: false,
          disableSbCheckboxOp: false,
          showAbschlussButton: true
        }
      }
      const topResponseOhneSbMitZahn = await axios.post(apiUrlTopMitZahn, newPayload, { headers })
      const tarif = topResponseOhneSbMitZahn.data.tarifBeitraege.Top
      console.log("Fetch from ", apiUrlTopMitZahn, " for TopMitZahn was successfull.")
      return tarif[0].beitrag
    } catch (error) {
      return "ERROR"
    }
  }

  async function fetchPremiumOhneZahn(payload) {
    try {
      const newPayload = {
        ...payload,
        oaSpezifisch: {
          ...payload.oaSpezifisch,

          versicherung: "kv",
          tierart: "Hund",
          erstattungssatz: "PROZENT_100",
          geschlecht: "m",
          selbstbeteiligungBeitrag: 0,
          spezialTarif: "Premium_Akut_1200",
          tarif: "Premium_Akut_1200",
          isKV: false,
          showOP: false,
          pferd: true,
          vuz: true,
          disableSbCheckboxKv: false,
          disableSbCheckboxOp: false,
          showAbschlussButton: true
        }
      }
      const premiumResponseOhneSbMitZahn = await axios.post(apiUrlPremiumOhneZahn, newPayload, { headers })
      const tarif = premiumResponseOhneSbMitZahn.data.tarifBeitraege.Premium_Akut_1200
      console.log("Fetch from ", apiUrlPremiumOhneZahn, " for PremiumOhneZahn was successfull.")
      return tarif[0].beitrag
    } catch (error) {
      return "ERROR"
    }
  }

  async function fetchPremiumMitZahn(payload) {
    try {
      const newPayload = {
        ...payload,
        oaSpezifisch: {
          ...payload.oaSpezifisch,

          versicherung: "kv",
          tierart: "Hund",
          erstattungssatz: "PROZENT_100",
          geschlecht: "m",
          selbstbeteiligungBeitrag: 0,
          spezialTarif: "",
          tarif: "Premium_Akut_1200",
          isKV: false,
          showOP: false,
          pferd: true,
          vuz: true,
          disableSbCheckboxKv: false,
          disableSbCheckboxOp: false,
          showAbschlussButton: true
        }
      }
      const response = await axios.post(apiUrlPremiumMitZahn, newPayload, { headers })
      const tarif = response.data.tarifBeitraege.Premium_1200
      console.log("Fetch from ", apiUrlPremiumMitZahn, " for PremiumMitZahn was successfull.")
      return tarif[0].beitrag
    } catch (error) {
      return "ERROR"
    }
  }

  async function fetchOp(payload) {
    try {
      const response = await axios.post(apiUrl, payload, { headers })
      const tarif = response.data.tarifBeitraege[1][0].beitrag
      console.log("Fetch from ", apiUrl, " for OpOhneSb was successfull.")
      return tarif
    } catch (error) {
      return "ERROR"
    }
  }

  async function fetchPremiumPlusOhneZahnMitKons(payload) {
    try {
      const newPayload = {
        ...payload,
        oaSpezifisch: {
          ...payload.oaSpezifisch,

          versicherung: "kv",
          tierart: "Hund",
          erstattungssatz: "PROZENT_100",
          geschlecht: "m",
          spezialTarif: "Premium_Plus_Akut",
          tarif: "Premium_Plus_Akut_1200",
          isKV: false,
          showOP: false,
          pferd: true,
          vuz: true,
          disableSbCheckboxKv: false,
          disableSbCheckboxOp: false,
          showAbschlussButton: true
        }
      }
      const response = await axios.post(apiUrlPremiumPlusOhneZahnMitKons, newPayload, { headers })
      const tarif = response.data.tarifBeitraege.Premium_Plus_Akut
      console.log("Fetch from ", apiUrlPremiumPlusOhneZahnMitKons, " for PremiumPlusOhneZahnMitKons was successfull.")
      return tarif[0].beitrag
    } catch (error) {
      return "ERROR"
    }
  }

  async function fetchPremiumPlusMitZahnMitKons(payload) {
    try {
      const newPayload = {
        ...payload,
        oaSpezifisch: {
          ...payload.oaSpezifisch,

          versicherung: "kv",
          tierart: "Hund",
          erstattungssatz: "PROZENT_100",
          geschlecht: "m",
          spezialTarif: "Premium_Plus_Akut_1200",
          tarif: "Premium_Plus_Akut_1200",
          isKV: false,
          showOP: false,
          pferd: true,
          vuz: true,
          disableSbCheckboxKv: false,
          disableSbCheckboxOp: false,
          showAbschlussButton: true
        }
      }
      const response = await axios.post(apiUrlPremiumPlusMitZahnMitKons, newPayload, { headers })
      const tarif = response.data.tarifBeitraege.Premium_Plus[0].beitrag
      console.log("Fetch from ", apiUrlPremiumPlusMitZahnMitKons, " for PremiumPlusMitZahnMitKons was successfull.")
      return tarif
    } catch (error) {
      return "ERROR"
    }
  }
})

//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
// CAT Tarifierung

app.post("/api/cat/tarifierung", async (req, res) => {
  console.log("Neue Cat Anfrage eingetroffen!")
  console.log("Request-Body:", JSON.stringify(req.body, null, 2)) // Logge den gesamten Body

  // Frontend-Daten extrahieren
  const { geburtsdatum, versicherungsbeginn, zahlweise } = req.body

  // Überprüfe die Felder auf Validität

  // {
  //   geburtsdatum: formData.catBirthDate,
  //   versicherungsbeginn: formData.insuranceStart,
  //   zahlweise: formData.zahlweise,
  //   selbstbeteiligung: formData.selfbeteiligung,
  // }

  if (!geburtsdatum || !versicherungsbeginn || !zahlweise) {
    console.error("Fehlende oder ungültige Felder im Request!")
    return res.status(400).json({ error: "Fehlende oder ungültige Felder im Request" })
  }

  // Alter der Katze berechnen
  const ageAtStart = berechneAlter(geburtsdatum, versicherungsbeginn)
  const isOlderCatOnlySB = ageAtStart >= 4 // Setze älter als 4 Jahre als Grenzwert
  const isCatTooOldForKv = ageAtStart >= 5 // Hunde älter als 5 Jahre erhalten keine KV-Versicherung
  const isCatTooOldForOp = ageAtStart >= 5 // Hunde älter als 5 Jahre erhalten keine KV-Versicherung

  // Logge die Eingaben und Alter
  console.log(`Geburtsdatum (Raw): ${geburtsdatum}`)
  console.log(`Versicherungsbeginn (Raw): ${versicherungsbeginn}`)
  console.log(`Alter der Katze bei Versicherungsbeginn: ${ageAtStart} Jahre`)

  // Datumswerte ins ursprüngliche ISO-Format bringen
  const formattedGeburtsdatum = dayjs(geburtsdatum).format("YYYY-MM-DDTHH:mm:ssZ")
  const formattedVersicherungsbeginn = dayjs(versicherungsbeginn).format("YYYY-MM-DDTHH:mm:ssZ")

  console.log("Formatierte Werte:")
  console.log("   Formatiertes Geburtsdatum:", formattedGeburtsdatum)
  console.log("   Formatierter Versicherungsbeginn:", formattedVersicherungsbeginn)

  // Basis-Payload erstellen und basierend auf Alter anpassen
  const basePayload = {
    personenIdCounter: 1,
    bankdaten: { iban: "" },
    kreditkarte: {},
    pspDaten: {},
    personen: [
      {
        vorbelegungAnrede: false,
        isDateValid: false,
        isVornameValid: true,
        isNachnameValid: true,
        anrede: "Herr",
        vorvertrag: "Kein Vorvertrag",
        versicherungsbeginn: formattedVersicherungsbeginn,
        gesundheitsdaten: { koerpergroesse: null, koerpergewicht: null },
        gesundheitsfragen: {},
        tarife: null,
        rollen: ["VERSICHERUNGSNEHMER"],
        id: "vn",
        geburtsdatum: formattedGeburtsdatum
      }
    ],
    zahlungsart: "bankdaten",
    paypalEmailAdresse: null,
    angebotsnummer: null,
    angebotstechnummer: null,
    pdf: null,
    device: "Desktop",
    oaName: "tier",
    sparte: "BA",
    oaSpezifisch: {
      tierart: "Katze",
      erstattungssatz: "PROZENT_100",
      geschlecht: "m",
      zahlweise: zahlweise,
      selbstbeteiligungBeitrag: 0,
      spezialTarif: "",
      tarif: "",
      isKV: false,
      showOP: true,
      pferd: true,
      vuz: true,
      disableSbCheckboxKv: false,
      disableSbCheckboxOp: false,
      showAbschlussButton: true,
      tierartParam: "Katze",
      hunderasse: "",
      hunderassenList: "",
      geburtsdatum: formattedGeburtsdatum,
      operationskosten: false
    },
    browser: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.0.0 Safari/537.36",
    aktionsnummer: "334003",
    emid: null
  }

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/plain, */*",
    Origin: "https://ssl.barmenia.de",
    Referer: "https://ssl.barmenia.de/online-versichern/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.0.0 Safari/537.36"
  }

  const kvPayloadOhneSb = {
    ...basePayload,
    oaSpezifisch: {
      ...basePayload.oaSpezifisch,
      versicherung: "kv",
      selbstbeteiligung: false
    }
  }

  const kvPayloadMitSb = {
    ...basePayload,
    oaSpezifisch: {
      ...basePayload.oaSpezifisch,
      versicherung: "kv",
      selbstbeteiligung: true
    }
  }

  const opPayloadOhneSb = {
    ...basePayload,
    oaSpezifisch: {
      ...basePayload.oaSpezifisch,
      versicherung: "op",
      selbstbeteiligung: false
    }
  }

  const opPayloadMitSb = {
    ...basePayload,
    oaSpezifisch: {
      ...basePayload.oaSpezifisch,
      versicherung: "op",
      selbstbeteiligung: true
    }
  }

  const finalResponses = {
    opSchutz: {
      beitragOhneSb: 0,
      beitragMitSb: 0
    },
    basis: {
      beitragOhneSb: 0,
      beitragMitSb: 0
    },
    top: {
      beitragOhneSbOhneZahn: 0,
      beitragMitSbOhneZahn: 0,
      beitragOhneSbMitZahn: 0,
      beitragMitSbMitZahn: 0
    },
    premium: {
      beitragOhneSbOhneZahn: 0,
      beitragMitSbOhneZahn: 0,
      beitragOhneSbMitZahn: 0,
      beitragMitSbMitZahn: 0
    },
    premiumPlus: {
      beitragOhneSbOhneZahn: 0,
      beitragMitSbOhneZahn: 0,
      beitragOhneSbMitZahn: 0,
      beitragMitSbMitZahn: 0
    }
  }

  try {
    // alle tarife fetches, standard

    // 1. und 2. fetch API KV ohne SB und mit sb

    console.log("Fetching Data from Barmenia API...")

    // Zuletzt die fetches an op schutz
    finalResponses.opSchutz.beitragOhneSb = await fetchOp(opPayloadOhneSb)
    finalResponses.opSchutz.beitragMitSb = await fetchOp(opPayloadMitSb)

    finalResponses.basis.beitragOhneSb = await fetchBasis(kvPayloadOhneSb)
    finalResponses.basis.beitragMitSb = await fetchBasis(kvPayloadMitSb)

    // 3. und 4. fetch an /Top für Zahn mit sb ohne sb
    finalResponses.top.beitragOhneSbOhneZahn = await fetchTopOhneZahn(kvPayloadOhneSb)
    finalResponses.top.beitragMitSbOhneZahn = await fetchTopOhneZahn(kvPayloadMitSb)
    finalResponses.top.beitragOhneSbMitZahn = await fetchTopMitZahn(kvPayloadOhneSb)
    finalResponses.top.beitragMitSbMitZahn = await fetchTopMitZahn(kvPayloadMitSb)

    // 5. und 6. fetch an /Premium für Zahn mit sb ohne sb

    finalResponses.premium.beitragOhneSbOhneZahn = await fetchPremiumOhneZahn(kvPayloadOhneSb)
    finalResponses.premium.beitragMitSbOhneZahn = await fetchPremiumOhneZahn(kvPayloadMitSb)
    finalResponses.premium.beitragOhneSbMitZahn = await fetchPremiumMitZahn(kvPayloadOhneSb)
    finalResponses.premium.beitragMitSbMitZahn = await fetchPremiumMitZahn(kvPayloadMitSb)

    // Danach alle neuen Premium_Plus fetches

    finalResponses.premiumPlus.beitragOhneSbOhneZahn = await fetchPremiumPlusOhneZahnMitKons(opPayloadOhneSb)
    finalResponses.premiumPlus.beitragMitSbOhneZahn = await fetchPremiumPlusOhneZahnMitKons(opPayloadMitSb)
    finalResponses.premiumPlus.beitragOhneSbMitZahn = await fetchPremiumPlusMitZahnMitKons(opPayloadOhneSb)
    finalResponses.premiumPlus.beitragMitSbMitZahn = await fetchPremiumPlusMitZahnMitKons(opPayloadMitSb)

    // Final return after fetching all data

    console.log("Successfully fetched all data from API. Final Response to client:")
    console.log(JSON.stringify(finalResponses, null, 2))

    return res.json(finalResponses)
  } catch (error) {
    console.error("Ein Fehler ist aufgetreten:", error.message)
    if (error.response) {
      console.error("Fehlerdetails:", error.response.data)
    }
    return res.status(500).json({ error: "Interner Serverfehler bei der Tarifierung" })
  }
  async function fetchBasis(payload) {
    try {
      const newPayload = {
        ...payload,
        oaSpezifisch: {
          ...payload.oaSpezifisch,

          versicherung: "kv",
          erstattungssatz: "PROZENT_100",
          geschlecht: "m",
          selbstbeteiligungBeitrag: 0,
          spezialTarif: "",
          tarif: "Basis",
          isKV: false,
          showOP: false,
          pferd: true,
          vuz: true,
          disableSbCheckboxKv: false,
          disableSbCheckboxOp: false,
          showAbschlussButton: true
        }
      }
      const response = await axios.post(apiUrlBasis, newPayload, { headers })
      const tarif = response.data.tarifBeitraege.Basis
      console.log("Fetch from ", apiUrlBasis, " for Basis was successfull.")
      return tarif[0].beitrag
    } catch (error) {
      return "ERROR"
    }
  }

  async function fetchTopOhneZahn(payload) {
    try {
      const newPayload = {
        ...payload,
        oaSpezifisch: {
          ...payload.oaSpezifisch,

          versicherung: "kv",
          erstattungssatz: "PROZENT_100",
          geschlecht: "m",
          selbstbeteiligungBeitrag: 0,
          spezialTarif: "Top_Akut",
          tarif: "Top_Akut",
          isKV: false,
          showOP: false,
          pferd: true,
          vuz: true,
          disableSbCheckboxKv: false,
          disableSbCheckboxOp: false,
          showAbschlussButton: true
        }
      }
      const response = await axios.post(apiUrlTopOhneZahn, newPayload, { headers })
      const tarif = response.data.tarifBeitraege.Top_Akut
      console.log("Fetch from ", apiUrlTopOhneZahn, " for TopOhneZahn was successfull.")
      return tarif[0].beitrag
    } catch (error) {
      return "ERROR"
    }
  }

  async function fetchTopMitZahn(payload) {
    try {
      const newPayload = {
        ...payload,
        oaSpezifisch: {
          ...payload.oaSpezifisch,

          versicherung: "kv",
          erstattungssatz: "PROZENT_100",
          geschlecht: "m",
          selbstbeteiligungBeitrag: 0,
          spezialTarif: "",
          tarif: "Top",
          isKV: false,
          showOP: false,
          pferd: true,
          vuz: true,
          disableSbCheckboxKv: false,
          disableSbCheckboxOp: false,
          showAbschlussButton: true
        }
      }
      const response = await axios.post(apiUrlTopMitZahn, newPayload, { headers })
      const tarif = response.data.tarifBeitraege.Top
      console.log("Fetch from ", apiUrlTopMitZahn, " for TopMitZahn was successfull.")
      return tarif[0].beitrag
    } catch (error) {
      return "ERROR"
    }
  }

  async function fetchPremiumOhneZahn(payload) {
    try {
      const newPayload = {
        ...payload,
        oaSpezifisch: {
          ...payload.oaSpezifisch,

          versicherung: "kv",
          erstattungssatz: "PROZENT_100",
          geschlecht: "m",
          selbstbeteiligungBeitrag: 0,
          spezialTarif: "Premium_Akut_1200",
          tarif: "Premium_Akut_1200",
          isKV: false,
          showOP: false,
          pferd: true,
          vuz: true,
          disableSbCheckboxKv: false,
          disableSbCheckboxOp: false,
          showAbschlussButton: true
        }
      }
      const response = await axios.post(apiUrlPremiumOhneZahn, newPayload, { headers })
      const tarif = response.data.tarifBeitraege.Premium_Akut_1200
      console.log("Fetch from ", apiUrlPremiumOhneZahn, " for PremiumOhneZahn was successfull.")
      return tarif[0].beitrag
    } catch (error) {
      return "ERROR"
    }
  }

  async function fetchPremiumMitZahn(payload) {
    try {
      const newPayload = {
        ...payload,
        oaSpezifisch: {
          ...payload.oaSpezifisch,

          versicherung: "kv",
          erstattungssatz: "PROZENT_100",
          geschlecht: "m",
          selbstbeteiligungBeitrag: 0,
          spezialTarif: "",
          tarif: "Premium_Akut_1200",
          isKV: false,
          showOP: false,
          pferd: true,
          vuz: true,
          disableSbCheckboxKv: false,
          disableSbCheckboxOp: false,
          showAbschlussButton: true
        }
      }
      const response = await axios.post(apiUrlPremiumMitZahn, newPayload, { headers })
      const tarif = response.data.tarifBeitraege.Premium_1200
      console.log("Fetch from ", apiUrlPremiumMitZahn, " for PremiumMitZahn was successfull.")
      return tarif[0].beitrag
    } catch (error) {
      return "ERROR"
    }
  }

  async function fetchOp(payload) {
    try {
      const opResponseOhneSB = await axios.post(apiUrl, payload, { headers })
      const tarif = opResponseOhneSB.data.tarifBeitraege[1][0].beitrag
      console.log("Fetch from ", apiUrl, " for OpOhneSb was successfull.")
      return tarif
    } catch (error) {
      return "ERROR"
    }
  }

  async function fetchPremiumPlusOhneZahnMitKons(payload) {
    try {
      const newPayload = {
        ...payload,
        oaSpezifisch: {
          ...payload.oaSpezifisch,

          versicherung: "kv",
          erstattungssatz: "PROZENT_100",
          geschlecht: "m",
          spezialTarif: "Premium_Plus_Akut",
          tarif: "Premium_Plus_Akut_1200",
          isKV: false,
          showOP: false,
          pferd: true,
          vuz: true,
          disableSbCheckboxKv: false,
          disableSbCheckboxOp: false,
          showAbschlussButton: true
        }
      }
      const response = await axios.post(apiUrlPremiumPlusOhneZahnMitKons, newPayload, { headers })
      const tarif = response.data.tarifBeitraege.Premium_Plus_Akut[0].beitrag
      console.log("Fetch from ", apiUrlPremiumPlusOhneZahnMitKons, " for PremiumPlusOhneZahnMitKons was successfull.")
      return tarif
    } catch (error) {
      return "ERROR"
    }
  }

  async function fetchPremiumPlusMitZahnMitKons(payload) {
    try {
      const newPayload = {
        ...payload,
        oaSpezifisch: {
          ...payload.oaSpezifisch,

          versicherung: "kv",
          erstattungssatz: "PROZENT_100",
          geschlecht: "m",
          spezialTarif: "Premium_Plus_Akut_1200",
          tarif: "Premium_Plus_Akut_1200",
          isKV: false,
          showOP: false,
          pferd: true,
          vuz: true,
          disableSbCheckboxKv: false,
          disableSbCheckboxOp: false,
          showAbschlussButton: true
        }
      }
      const response = await axios.post(apiUrlPremiumPlusMitZahnMitKons, newPayload, { headers })
      const tarif = response.data.tarifBeitraege.Premium_Plus[0].beitrag
      console.log("Fetch from ", apiUrlPremiumPlusMitZahnMitKons, " for PremiumPlusMitZahnMitKons was successfull.")
      return tarif
    } catch (error) {
      return "ERROR"
    }
  }
})

//
//
//
//
//
//
//
//
//
//
//
// Server listening
const fs = require("fs")
const https = require("https")
const http = require("http")

const HTTPS_PORT = 443
const HTTP_PORT = 80

const httpsOptions = {
  key: fs.readFileSync("cert/key.pem"),
  cert: fs.readFileSync("cert/cert.pem"),
  ca: fs.readFileSync("cert/ca.pem") // optional, aber empfohlen
}

// HTTPS-Server starten
https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
  console.log(`HTTPS läuft auf https://api.pfoteplus.de`)
})

// HTTP → HTTPS Weiterleitung
http
  .createServer((req, res) => {
    const host = req.headers.host.replace(/:\d+$/, "")
    res.writeHead(301, { Location: `https://${host}${req.url}` })
    res.end()
  })
  .listen(HTTP_PORT, () => {
    console.log(`HTTP-Umleitung auf HTTPS aktiv`)
  })
