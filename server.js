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

// Dog und Cat api urls
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

// horse api urls
const apiUrlOpSchutzBasis = "https://ssl.barmenia.de/api/oa-bff-tier/tarifierung/Basis"
const apiUrlOpSchutzTop = "https://ssl.barmenia.de/api/oa-bff-tier/tarifierung/Top"
const apiUrlOpSchutzPremium = "https://ssl.barmenia.de/api/oa-bff-tier/tarifierung/Premium"

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

    const [
      opOhneSb,
      opMitSb,

      basisOhneSb,
      basisMitSb,

      topOhneSbOhneZahn,
      topMitSbOhneZahn,
      topOhneSbMitZahn,
      topMitSbMitZahn,

      premiumOhneSbOhneZahn,
      premiumMitSbOhneZahn,
      premiumOhneSbMitZahn,
      premiumMitSbMitZahn,

      premiumPlusOhneSbOhneZahn,
      premiumPlusMitSbOhneZahn,
      premiumPlusOhneSbMitZahn,
      premiumPlusMitSbMitZahn
    ] = await Promise.all([
      // opSchutz
      fetchOp(opPayloadOhneSb),
      fetchOp(opPayloadMitSb),

      // Basis
      fetchBasis(kvPayloadOhneSb),
      fetchBasis(kvPayloadMitSb),

      // Top
      fetchTopOhneZahn(kvPayloadOhneSb),
      fetchTopOhneZahn(kvPayloadMitSb),
      fetchTopMitZahn(kvPayloadOhneSb),
      fetchTopMitZahn(kvPayloadMitSb),

      // Premium
      fetchPremiumOhneZahn(kvPayloadOhneSb),
      fetchPremiumOhneZahn(kvPayloadMitSb),
      fetchPremiumMitZahn(kvPayloadOhneSb),
      fetchPremiumMitZahn(kvPayloadMitSb),

      // Premium Plus
      fetchPremiumPlusOhneZahnMitKons(opPayloadOhneSb),
      fetchPremiumPlusOhneZahnMitKons(opPayloadMitSb),
      fetchPremiumPlusMitZahnMitKons(opPayloadOhneSb),
      fetchPremiumPlusMitZahnMitKons(opPayloadMitSb)
    ])

    const finalResponses = {
      opSchutz: {
        beitragOhneSb: opOhneSb,
        beitragMitSb: opMitSb
      },
      basis: {
        beitragOhneSb: basisOhneSb,
        beitragMitSb: basisMitSb
      },
      top: {
        beitragOhneSbOhneZahn: topOhneSbOhneZahn,
        beitragMitSbOhneZahn: topMitSbOhneZahn,
        beitragOhneSbMitZahn: topOhneSbMitZahn,
        beitragMitSbMitZahn: topMitSbMitZahn
      },
      premium: {
        beitragOhneSbOhneZahn: premiumOhneSbOhneZahn,
        beitragMitSbOhneZahn: premiumMitSbOhneZahn,
        beitragOhneSbMitZahn: premiumOhneSbMitZahn,
        beitragMitSbMitZahn: premiumMitSbMitZahn
      },
      premiumPlus: {
        beitragOhneSbOhneZahn: premiumPlusOhneSbOhneZahn,
        beitragMitSbOhneZahn: premiumPlusMitSbOhneZahn,
        beitragOhneSbMitZahn: premiumPlusOhneSbMitZahn,
        beitragMitSbMitZahn: premiumPlusMitSbMitZahn
      }
    }

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
    const label = "Basis"
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
      const beitrag = response.data.tarifBeitraege.Basis[0].beitrag
      console.log(`[✓] ${label} fetched successfully: ${beitrag} €`)
      return beitrag
    } catch (error) {
      console.error(`[✗] ${label} fetch failed: ${error.message}`)
      return "ERROR"
    }
  }

  async function fetchTopOhneZahn(payload) {
    const label = "TopOhneZahn"
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
      const beitrag = response.data.tarifBeitraege.Top_Akut[0].beitrag

      console.log(`[✓] ${label} fetched successfully: ${beitrag} €`)
      return beitrag
    } catch (error) {
      console.error(`[✗] ${label} fetch failed: ${error.message}`)
      return "ERROR"
    }
  }

  async function fetchTopMitZahn(payload) {
    const label = "TopMitZahn"
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

      const response = await axios.post(apiUrlTopMitZahn, newPayload, { headers })
      const beitrag = response.data.tarifBeitraege.Top[0].beitrag

      console.log(`[✓] ${label} fetched successfully: ${beitrag} €`)
      return beitrag
    } catch (error) {
      console.error(`[✗] ${label} fetch failed: ${error.message}`)
      return "ERROR"
    }
  }

  async function fetchPremiumOhneZahn(payload) {
    const label = "PremiumOhneZahn"
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

      const response = await axios.post(apiUrlPremiumOhneZahn, newPayload, { headers })
      const beitrag = response.data.tarifBeitraege.Premium_Akut_1200[0].beitrag

      console.log(`[✓] ${label} fetched successfully: ${beitrag} €`)
      return beitrag
    } catch (error) {
      console.error(`[✗] ${label} fetch failed: ${error.message}`)
      return "ERROR"
    }
  }

  async function fetchPremiumMitZahn(payload) {
    const label = "PremiumMitZahn"
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
      const beitrag = response.data.tarifBeitraege.Premium_1200[0].beitrag

      console.log(`[✓] ${label} fetched successfully: ${beitrag} €`)
      return beitrag
    } catch (error) {
      console.error(`[✗] ${label} fetch failed: ${error.message}`)
      return "ERROR"
    }
  }

  async function fetchOp(payload) {
    const label = "OpOhneSb"
    try {
      const response = await axios.post(apiUrl, payload, { headers })
      const beitrag = response.data.tarifBeitraege[1][0].beitrag

      console.log(`[✓] ${label} fetched successfully: ${beitrag} €`)
      return beitrag
    } catch (error) {
      console.error(`[✗] ${label} fetch failed: ${error.message}`)
      return "ERROR"
    }
  }

  async function fetchPremiumPlusOhneZahnMitKons(payload) {
    const label = "PremiumPlusOhneZahnMitKons"
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
      const beitrag = response.data.tarifBeitraege.Premium_Plus_Akut[0].beitrag

      console.log(`[✓] ${label} fetched successfully: ${beitrag} €`)
      return beitrag
    } catch (error) {
      console.error(`[✗] ${label} fetch failed: ${error.message}`)
      return "ERROR"
    }
  }

  async function fetchPremiumPlusMitZahnMitKons(payload) {
    const label = "PremiumPlusMitZahnMitKons"
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
      const beitrag = response.data.tarifBeitraege.Premium_Plus[0].beitrag

      console.log(`[✓] ${label} fetched successfully: ${beitrag} €`)
      return beitrag
    } catch (error) {
      console.error(`[✗] ${label} fetch failed: ${error.message}`)
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

    const [
      beitragOpOhneSb,
      beitragOpMitSb,

      beitragBasisOhneSb,
      beitragBasisMitSb,

      beitragTopOhneSbOhneZahn,
      beitragTopMitSbOhneZahn,
      beitragTopOhneSbMitZahn,
      beitragTopMitSbMitZahn,

      beitragPremiumOhneSbOhneZahn,
      beitragPremiumMitSbOhneZahn,
      beitragPremiumOhneSbMitZahn,
      beitragPremiumMitSbMitZahn,

      beitragPremiumPlusOhneSbOhneZahn,
      beitragPremiumPlusMitSbOhneZahn,
      beitragPremiumPlusOhneSbMitZahn,
      beitragPremiumPlusMitSbMitZahn
    ] = await Promise.all([
      fetchOp(opPayloadOhneSb),
      fetchOp(opPayloadMitSb),

      fetchBasis(kvPayloadOhneSb),
      fetchBasis(kvPayloadMitSb),

      fetchTopOhneZahn(kvPayloadOhneSb),
      fetchTopOhneZahn(kvPayloadMitSb),
      fetchTopMitZahn(kvPayloadOhneSb),
      fetchTopMitZahn(kvPayloadMitSb),

      fetchPremiumOhneZahn(kvPayloadOhneSb),
      fetchPremiumOhneZahn(kvPayloadMitSb),
      fetchPremiumMitZahn(kvPayloadOhneSb),
      fetchPremiumMitZahn(kvPayloadMitSb),

      fetchPremiumPlusOhneZahnMitKons(opPayloadOhneSb),
      fetchPremiumPlusOhneZahnMitKons(opPayloadMitSb),
      fetchPremiumPlusMitZahnMitKons(opPayloadOhneSb),
      fetchPremiumPlusMitZahnMitKons(opPayloadMitSb)
    ])

    const finalResponses = {
      opSchutz: {
        beitragOhneSb: beitragOpOhneSb,
        beitragMitSb: beitragOpMitSb
      },
      basis: {
        beitragOhneSb: beitragBasisOhneSb,
        beitragMitSb: beitragBasisMitSb
      },
      top: {
        beitragOhneSbOhneZahn: beitragTopOhneSbOhneZahn,
        beitragMitSbOhneZahn: beitragTopMitSbOhneZahn,
        beitragOhneSbMitZahn: beitragTopOhneSbMitZahn,
        beitragMitSbMitZahn: beitragTopMitSbMitZahn
      },
      premium: {
        beitragOhneSbOhneZahn: beitragPremiumOhneSbOhneZahn,
        beitragMitSbOhneZahn: beitragPremiumMitSbOhneZahn,
        beitragOhneSbMitZahn: beitragPremiumOhneSbMitZahn,
        beitragMitSbMitZahn: beitragPremiumMitSbMitZahn
      },
      premiumPlus: {
        beitragOhneSbOhneZahn: beitragPremiumPlusOhneSbOhneZahn,
        beitragMitSbOhneZahn: beitragPremiumPlusMitSbOhneZahn,
        beitragOhneSbMitZahn: beitragPremiumPlusOhneSbMitZahn,
        beitragMitSbMitZahn: beitragPremiumPlusMitSbMitZahn
      }
    }

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
      const beitrag = response.data.tarifBeitraege.Basis[0].beitrag
      console.log(`[✓] Basis fetched successfully: ${beitrag} €`)
      return beitrag
    } catch (error) {
      console.error(`[✗] Basis fetch failed: ${error.message}`)
      return "ERROR"
    }
  }

  async function fetchTopOhneZahn(payload) {
    const label = "TopOhneZahn"
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
      const beitrag = response.data.tarifBeitraege.Top_Akut[0].beitrag

      console.log(`[✓] ${label} fetched successfully: ${beitrag} €`)
      return beitrag
    } catch (error) {
      console.error(`[✗] ${label} fetch failed: ${error.message}`)
      return "ERROR"
    }
  }

  async function fetchTopMitZahn(payload) {
    const label = "TopMitZahn"
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
      const beitrag = response.data.tarifBeitraege.Top[0].beitrag

      console.log(`[✓] ${label} fetched successfully: ${beitrag} €`)
      return beitrag
    } catch (error) {
      console.error(`[✗] ${label} fetch failed: ${error.message}`)
      return "ERROR"
    }
  }

  async function fetchPremiumOhneZahn(payload) {
    const label = "PremiumOhneZahn"
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
      const beitrag = response.data.tarifBeitraege.Premium_Akut_1200[0].beitrag

      console.log(`[✓] ${label} fetched successfully: ${beitrag} €`)
      return beitrag
    } catch (error) {
      console.error(`[✗] ${label} fetch failed: ${error.message}`)
      return "ERROR"
    }
  }

  async function fetchPremiumMitZahn(payload) {
    const label = "PremiumMitZahn"
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
      const beitrag = response.data.tarifBeitraege.Premium_1200[0].beitrag

      console.log(`[✓] ${label} fetched successfully: ${beitrag} €`)
      return beitrag
    } catch (error) {
      console.error(`[✗] ${label} fetch failed: ${error.message}`)
      return "ERROR"
    }
  }

  async function fetchOp(payload) {
    const label = "OpOhneSb"
    try {
      const response = await axios.post(apiUrl, payload, { headers })
      const beitrag = response.data.tarifBeitraege[1][0].beitrag

      console.log(`[✓] ${label} fetched successfully: ${beitrag} €`)
      return beitrag
    } catch (error) {
      console.error(`[✗] ${label} fetch failed: ${error.message}`)
      return "ERROR"
    }
  }

  async function fetchPremiumPlusOhneZahnMitKons(payload) {
    const label = "PremiumPlusOhneZahnMitKons"
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
      const beitrag = response.data.tarifBeitraege.Premium_Plus_Akut[0].beitrag

      console.log(`[✓] ${label} fetched successfully: ${beitrag} €`)
      return beitrag
    } catch (error) {
      console.error(`[✗] ${label} fetch failed: ${error.message}`)
      return "ERROR"
    }
  }

  async function fetchPremiumPlusMitZahnMitKons(payload) {
    const label = "PremiumPlusMitZahnMitKons"
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
      const beitrag = response.data.tarifBeitraege.Premium_Plus[0].beitrag

      console.log(`[✓] ${label} fetched successfully: ${beitrag} €`)
      return beitrag
    } catch (error) {
      console.error(`[✗] ${label} fetch failed: ${error.message}`)
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
//
//
// HOSRE Tarifierung
app.post("/api/horse/tarifierung", async (req, res) => {
  console.log("Neue Pferd Anfrage eingetroffen!")
  console.log("Request-Body:", JSON.stringify(req.body, null, 2)) // Logge den gesamten Body

  // Frontend-Daten extrahieren
  const { geburtsdatum, versicherungsbeginn, zahlweise } = req.body

  // Überprüfe die Felder auf Validität

  if (!geburtsdatum || !versicherungsbeginn || !zahlweise) {
    console.error("Fehlende oder ungültige Felder im Request!")
    return res.status(400).json({ error: "Fehlende oder ungültige Felder im Request" })
  }

  // Alter des Pferdes berechnen
  const ageAtStart = berechneAlter(geburtsdatum, versicherungsbeginn)

  // Logge die Eingaben und Alter
  console.log(`Geburtsdatum (Raw): ${geburtsdatum}`)
  console.log(`Versicherungsbeginn (Raw): ${versicherungsbeginn}`)
  console.log(`Alter des Pferdes bei Versicherungsbeginn: ${ageAtStart} Jahre`)

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
      tierart: "Pferd",
      erstattungssatz: "PROZENT_100",
      geschlecht: "m",
      zahlweise: zahlweise,
      selbstbeteiligung: false,
      spezialTarif: "",
      tarif: "",
      isKV: false,
      showOP: true,
      pferd: true,
      versicherung: "op",
      vuz: true,
      disableSbCheckboxKv: false,
      disableSbCheckboxOp: false,
      showAbschlussButton: true,
      tierartParam: "Pferd",
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

  const finalResponses = {
    opSchutzBasis: {
      beitrag0sb: 0,
      beitrag250sb: 0,
      beitrag500sb: 0,
      beitrag1000sb: 0
    },
    opSchutzTop: {
      beitrag0sb: 0,
      beitrag250sb: 0,
      beitrag500sb: 0,
      beitrag1000sb: 0
    },
    opSchutzPremium: {
      beitrag0sb: 0,
      beitrag250sb: 0,
      beitrag500sb: 0,
      beitrag1000sb: 0
    }
  }

  try {
    // alle tarife fetches, standard

    // 1. und 2. fetch API KV ohne SB und mit sb

    console.log("Fetching Data from Barmenia API...")

    const [
      beitrag0sbBasis,
      beitrag250sbBasis,
      beitrag500sbBasis,
      beitrag1000sbBasis,
      beitrag0sbTop,
      beitrag250sbTop,
      beitrag500sbTop,
      beitrag1000sbTop,
      beitrag0sbPremium,
      beitrag250sbPremium,
      beitrag500sbPremium,
      beitrag1000sbPremium
    ] = await Promise.all([
      fetchOpSchutzBasis(basePayload, 0),
      fetchOpSchutzBasis(basePayload, 250),
      fetchOpSchutzBasis(basePayload, 500),
      fetchOpSchutzBasis(basePayload, 1000),
      fetchOpSchutzTop(basePayload, 0),
      fetchOpSchutzTop(basePayload, 250),
      fetchOpSchutzTop(basePayload, 500),
      fetchOpSchutzTop(basePayload, 1000),
      fetchOpSchutzPremium(basePayload, 0),
      fetchOpSchutzPremium(basePayload, 250),
      fetchOpSchutzPremium(basePayload, 500),
      fetchOpSchutzPremium(basePayload, 1000)
    ])

    finalResponses.opSchutzBasis = {
      beitrag0sb: beitrag0sbBasis,
      beitrag250sb: beitrag250sbBasis,
      beitrag500sb: beitrag500sbBasis,
      beitrag1000sb: beitrag1000sbBasis
    }

    finalResponses.opSchutzTop = {
      beitrag0sb: beitrag0sbTop,
      beitrag250sb: beitrag250sbTop,
      beitrag500sb: beitrag500sbTop,
      beitrag1000sb: beitrag1000sbTop
    }

    finalResponses.opSchutzPremium = {
      beitrag0sb: beitrag0sbPremium,
      beitrag250sb: beitrag250sbPremium,
      beitrag500sb: beitrag500sbPremium,
      beitrag1000sb: beitrag1000sbPremium
    }

    console.log("Successfully fetched all data from API. Final Response to client:")
    console.log(JSON.stringify(finalResponses, null, 2))

    return res.json(finalResponses)

    // Final return after fetching all data
  } catch (error) {
    console.error("Ein Fehler ist aufgetreten:", error.message)
    if (error.response) {
      console.error("Fehlerdetails:", error.response.data)
    }
    return res.status(500).json({ error: "Interner Serverfehler bei der Tarifierung" })
  }

  async function fetchOpSchutzBasis(payload, sbHöhe) {
    if (![0, 250, 500, 1000].includes(sbHöhe)) {
      console.error(`[!] Invalid SB-Höhe for OpSchutzBasis: ${sbHöhe}`)
      return new Error("API-Anfrage abgebrochen: SB-Höhe wurde nicht korrekt angegeben.")
    }
    try {
      const newPayload = {
        ...payload,
        oaSpezifisch: {
          ...payload.oaSpezifisch,
          selbstbeteiligungBeitrag: sbHöhe
        }
      }
      const response = await axios.post(apiUrlOpSchutzBasis, newPayload, { headers })
      const beitrag = response.data.tarifBeitraege.Basis[0].beitrag
      console.log(`[✓] OpSchutzBasis (SB: ${sbHöhe}) fetched successfully: ${beitrag} €`)
      return beitrag
    } catch (error) {
      console.error(`[✗] OpSchutzBasis (SB: ${sbHöhe}) failed: ${error.message}`)
      return "ERROR"
    }
  }

  async function fetchOpSchutzTop(payload, sbHöhe) {
    if (![0, 250, 500, 1000].includes(sbHöhe)) {
      console.error(`[!] Invalid SB-Höhe for OpSchutzTop: ${sbHöhe}`)
      return new Error("API-Anfrage abgebrochen: SB-Höhe wurde nicht korrekt angegeben.")
    }
    try {
      const newPayload = {
        ...payload,
        oaSpezifisch: {
          ...payload.oaSpezifisch,
          selbstbeteiligungBeitrag: sbHöhe
        }
      }
      const response = await axios.post(apiUrlOpSchutzTop, newPayload, { headers })
      const beitrag = response.data.tarifBeitraege.Top[0].beitrag
      console.log(`[✓] OpSchutzTop (SB: ${sbHöhe}) fetched successfully: ${beitrag} €`)
      return beitrag
    } catch (error) {
      console.error(`[✗] OpSchutzTop (SB: ${sbHöhe}) failed: ${error.message}`)
      return "ERROR"
    }
  }

  async function fetchOpSchutzPremium(payload, sbHöhe) {
    if (![0, 250, 500, 1000].includes(sbHöhe)) {
      console.error(`[!] Invalid SB-Höhe for OpSchutzPremium: ${sbHöhe}`)
      return new Error("API-Anfrage abgebrochen: SB-Höhe wurde nicht korrekt angegeben.")
    }
    try {
      const newPayload = {
        ...payload,
        oaSpezifisch: {
          ...payload.oaSpezifisch,
          selbstbeteiligungBeitrag: sbHöhe
        }
      }
      const response = await axios.post(apiUrlOpSchutzPremium, newPayload, { headers })
      const beitrag = response.data.tarifBeitraege.Premium[0].beitrag
      console.log(`[✓] OpSchutzPremium (SB: ${sbHöhe}) fetched successfully: ${beitrag} €`)
      return beitrag
    } catch (error) {
      console.error(`[✗] OpSchutzPremium (SB: ${sbHöhe}) failed: ${error.message}`)
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
