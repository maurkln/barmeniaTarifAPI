const express = require("express")
const bodyParser = require("body-parser")
const axios = require("axios")
const cors = require("cors")
const dayjs = require("dayjs")

const app = express()
const PORT = 5000

// Middleware
app.use(bodyParser.json())
// app.use(cors({ origin: ["http://localhost:5173", "null", "https://pfoteplus.de", "http://31.17.172.189:5173"] })) // Erlaubt Zugriff vom Frontend und File index.html
app.use(cors({ origin: "*" })) // Erlaubt Zugriff uberall

const apiUrl = "https://ssl.barmenia.de/api/oa-bff-tier/tarifierung/"
const apiUrlTopMitZahn = "https://ssl.barmenia.de/api/oa-bff-tier/tarifierung/Top"
const apiUrlPremiumMitZahn = "https://ssl.barmenia.de/api/oa-bff-tier/tarifierung/Premium_1200"

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
    }
  }

  try {
    // alle tarife fetches, standard

    // 1. und 2. fetch API KV ohne SB und mit sb

    console.log("Fetching Data from Barmenia API...")

    let kvResponseOhneSb
    let kvResponseMitSb
    let tarifBeitraegeKvOhneSb
    let tarifBeitraegeKvMitSb

    try {
      kvResponseOhneSb = await axios.post(apiUrl, kvPayloadOhneSb, { headers })
      console.log("Fetch from ", apiUrl, " for kvResponseOhneSb was successfull.")
    } catch (error) {
      console.log(error.message)
    }

    try {
      kvResponseMitSb = await axios.post(apiUrl, kvPayloadMitSb, { headers })
      console.log("Fetch from ", apiUrl, " for kvResponseMitSb was successfull.")
    } catch (error) {
      console.log(error.message)
    }

    // 3. und 4. fetch an /Top für Zahn mit sb ohne sb
    finalResponses.top.beitragOhneSbMitZahn = await fetchTopOhneSbMitZahn(kvPayloadOhneSb)
    finalResponses.top.beitragMitSbMitZahn = await fetchTopMitSbMitZahn(kvPayloadMitSb)

    // 5. und 6. fetch an /Premium für Zahn mit sb ohne sb

    finalResponses.premium.beitragOhneSbMitZahn = await fetchPremiumOhneSbMitZahn(kvPayloadOhneSb)
    finalResponses.premium.beitragMitSbMitZahn = await fetchPremiumMitSbMitZahn(kvPayloadMitSb)

    // Zuletzt die fetches an op schutz

    finalResponses.opSchutz.beitragOhneSb = await fetchOpOhneSb(opPayloadOhneSb)
    finalResponses.opSchutz.beitragMitSb = await fetchOpMitSb(opPayloadMitSb)

    // fill into finalResponses
    try {
      tarifBeitraegeKvOhneSb = kvResponseOhneSb.data.tarifBeitraege[1]

      tarifBeitraegeKvOhneSb.forEach((element) => {
        switch (element.tarifInfo.name) {
          case "Basis":
            finalResponses.basis.beitragOhneSb = element.beitrag
            break
          case "Top":
            finalResponses.top.beitragOhneSbOhneZahn = element.beitrag
            break
          case "Premium":
            finalResponses.premium.beitragOhneSbOhneZahn = element.beitrag
            break
          case "Premium Plus":
            break
          default:
            console.log("Konnte Tarif", element.tarifInfo.name, "nicht zuordnen.")
            break
        }
      })
    } catch (error) {
      console.log(error.message)
    }

    try {
      tarifBeitraegeKvMitSb = kvResponseMitSb.data.tarifBeitraege[1]

      tarifBeitraegeKvMitSb.forEach((element) => {
        switch (element.tarifInfo.name) {
          case "Basis":
            finalResponses.basis.beitragMitSb = element.beitrag
            break
          case "Top":
            finalResponses.top.beitragMitSbOhneZahn = element.beitrag
            break
          case "Premium":
            finalResponses.premium.beitragMitSbOhneZahn = element.beitrag
            break
          case "Premium Plus":
            break
          default:
            console.log("Konnte Tarif", element.tarifInfo.name, "nicht zuordnen.")
            break
        }
      })
    } catch (error) {
      console.log(error)
    }

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
  async function fetchPremiumMitSbMitZahn(payload) {
    try {
      const premiumResponseMitSbMitZahn = await axios.post(apiUrlPremiumMitZahn, payload, { headers })
      const tarifBeitragPremiumMitSbMitZahn = premiumResponseMitSbMitZahn.data.tarifBeitraege.Premium_1200
      console.log("Fetch from ", apiUrlPremiumMitZahn, " for PremiumMitSbMitZahn was successfull.")
      return tarifBeitragPremiumMitSbMitZahn[0].beitrag
    } catch (error) {
      return "ERROR"
    }
  }

  async function fetchPremiumOhneSbMitZahn(payload) {
    try {
      const premiumResponseOhneSbMitZahn = await axios.post(apiUrlPremiumMitZahn, payload, { headers })
      const tarifBeitragPremiumOhneSbMitZahn = premiumResponseOhneSbMitZahn.data.tarifBeitraege.Premium_1200
      console.log("Fetch from ", apiUrlPremiumMitZahn, " for PremiumOhneSbMitZahn was successfull.")
      return tarifBeitragPremiumOhneSbMitZahn[0].beitrag
    } catch (error) {
      return "ERROR"
    }
  }

  async function fetchTopMitSbMitZahn(payload) {
    try {
      const topResponseMitSbMitZahn = await axios.post(apiUrlTopMitZahn, payload, { headers })
      const tarifBeitragTopMitSbMitZahn = topResponseMitSbMitZahn.data.tarifBeitraege.Top
      console.log("Fetch from ", apiUrlTopMitZahn, " for TopMitSbMitZahn was successfull.")
      return tarifBeitragTopMitSbMitZahn[0].beitrag
    } catch (error) {
      return "ERROR"
    }
  }

  async function fetchTopOhneSbMitZahn(payload) {
    try {
      const topResponseOhneSbMitZahn = await axios.post(apiUrlTopMitZahn, payload, { headers })
      const tarifBeitragTopOhneSbMitZahn = topResponseOhneSbMitZahn.data.tarifBeitraege.Top
      console.log("Fetch from ", apiUrlTopMitZahn, " for TopOhneSbMitZahn was successfull.")
      return tarifBeitragTopOhneSbMitZahn[0].beitrag
    } catch (error) {
      return "ERROR"
    }
  }

  async function fetchOpOhneSb(payload) {
    try {
      const opResponseOhneSB = await axios.post(apiUrl, payload, { headers })
      const tarifBeitragOpOhneSb = opResponseOhneSB.data.tarifBeitraege[1][0].beitrag
      console.log("Fetch from ", apiUrl, " for OpOhneSb was successfull.")
      return tarifBeitragOpOhneSb
    } catch (error) {
      return "ERROR"
    }
  }

  async function fetchOpMitSb(payload) {
    try {
      const opResponseMitSB = await axios.post(apiUrl, payload, { headers })
      const tarifBeitragOpMitSb = opResponseMitSB.data.tarifBeitraege[1][0].beitrag
      console.log("Fetch from ", apiUrl, " for OpMitSb was successfull.")
      return tarifBeitragOpMitSb
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
    }
  }

  try {
    // alle tarife fetches, standard

    // 1. und 2. fetch API KV ohne SB und mit sb

    console.log("Fetching Data from Barmenia API...")

    let kvResponseOhneSb
    let kvResponseMitSb
    let tarifBeitraegeKvOhneSb
    let tarifBeitraegeKvMitSb

    try {
      kvResponseOhneSb = await axios.post(apiUrl, kvPayloadOhneSb, { headers })
      console.log("Fetch from ", apiUrl, " for kvResponseOhneSb was successfull.")
    } catch (error) {
      console.log(error.message)
    }

    try {
      kvResponseMitSb = await axios.post(apiUrl, kvPayloadMitSb, { headers })
      console.log("Fetch from ", apiUrl, " for kvResponseMitSb was successfull.")
    } catch (error) {
      console.log(error.message)
    }

    // 3. und 4. fetch an /Top für Zahn mit sb ohne sb
    finalResponses.top.beitragOhneSbMitZahn = await fetchTopOhneSbMitZahn(kvPayloadOhneSb)
    finalResponses.top.beitragMitSbMitZahn = await fetchTopMitSbMitZahn(kvPayloadMitSb)

    // 5. und 6. fetch an /Premium für Zahn mit sb ohne sb

    finalResponses.premium.beitragOhneSbMitZahn = await fetchPremiumOhneSbMitZahn(kvPayloadOhneSb)
    finalResponses.premium.beitragMitSbMitZahn = await fetchPremiumMitSbMitZahn(kvPayloadMitSb)

    // Zuletzt die fetches an op schutz

    finalResponses.opSchutz.beitragOhneSb = await fetchOpOhneSb(opPayloadOhneSb)
    finalResponses.opSchutz.beitragMitSb = await fetchOpMitSb(opPayloadMitSb)

    // fill into finalResponses
    try {
      tarifBeitraegeKvOhneSb = kvResponseOhneSb.data.tarifBeitraege[1]

      tarifBeitraegeKvOhneSb.forEach((element) => {
        switch (element.tarifInfo.name) {
          case "Basis":
            finalResponses.basis.beitragOhneSb = element.beitrag
            break
          case "Top":
            finalResponses.top.beitragOhneSbOhneZahn = element.beitrag
            break
          case "Premium":
            finalResponses.premium.beitragOhneSbOhneZahn = element.beitrag
            break
          case "Premium Plus":
            break
          default:
            console.log("Konnte Tarif", element.tarifInfo.name, "nicht zuordnen.")
            break
        }
      })
    } catch (error) {
      console.log(error.message)
    }

    try {
      tarifBeitraegeKvMitSb = kvResponseMitSb.data.tarifBeitraege[1]

      tarifBeitraegeKvMitSb.forEach((element) => {
        switch (element.tarifInfo.name) {
          case "Basis":
            finalResponses.basis.beitragMitSb = element.beitrag
            break
          case "Top":
            finalResponses.top.beitragMitSbOhneZahn = element.beitrag
            break
          case "Premium":
            finalResponses.premium.beitragMitSbOhneZahn = element.beitrag
            break
          case "Premium Plus":
            break
          default:
            console.log("Konnte Tarif", element.tarifInfo.name, "nicht zuordnen.")
            break
        }
      })
    } catch (error) {
      console.log(error)
    }

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
  async function fetchPremiumMitSbMitZahn(payload) {
    try {
      const premiumResponseMitSbMitZahn = await axios.post(apiUrlPremiumMitZahn, payload, { headers })
      const tarifBeitragPremiumMitSbMitZahn = premiumResponseMitSbMitZahn.data.tarifBeitraege.Premium_1200
      console.log("Fetch from ", apiUrlPremiumMitZahn, " for PremiumMitSbMitZahn was successfull.")
      return tarifBeitragPremiumMitSbMitZahn[0].beitrag
    } catch (error) {
      return "ERROR"
    }
  }

  async function fetchPremiumOhneSbMitZahn(payload) {
    try {
      const premiumResponseOhneSbMitZahn = await axios.post(apiUrlPremiumMitZahn, payload, { headers })
      const tarifBeitragPremiumOhneSbMitZahn = premiumResponseOhneSbMitZahn.data.tarifBeitraege.Premium_1200
      console.log("Fetch from ", apiUrlPremiumMitZahn, " for PremiumOhneSbMitZahn was successfull.")
      return tarifBeitragPremiumOhneSbMitZahn[0].beitrag
    } catch (error) {
      return "ERROR"
    }
  }

  async function fetchTopMitSbMitZahn(payload) {
    try {
      const topResponseMitSbMitZahn = await axios.post(apiUrlTopMitZahn, payload, { headers })
      const tarifBeitragTopMitSbMitZahn = topResponseMitSbMitZahn.data.tarifBeitraege.Top
      console.log("Fetch from ", apiUrlTopMitZahn, " for TopMitSbMitZahn was successfull.")
      return tarifBeitragTopMitSbMitZahn[0].beitrag
    } catch (error) {
      return "ERROR"
    }
  }

  async function fetchTopOhneSbMitZahn(payload) {
    try {
      const topResponseOhneSbMitZahn = await axios.post(apiUrlTopMitZahn, payload, { headers })
      const tarifBeitragTopOhneSbMitZahn = topResponseOhneSbMitZahn.data.tarifBeitraege.Top
      console.log("Fetch from ", apiUrlTopMitZahn, " for TopOhneSbMitZahn was successfull.")
      return tarifBeitragTopOhneSbMitZahn[0].beitrag
    } catch (error) {
      return "ERROR"
    }
  }

  async function fetchOpOhneSb(payload) {
    try {
      const opResponseOhneSB = await axios.post(apiUrl, payload, { headers })
      const tarifBeitragOpOhneSb = opResponseOhneSB.data.tarifBeitraege[1][0].beitrag
      console.log("Fetch from ", apiUrl, " for OpOhneSb was successfull.")
      return tarifBeitragOpOhneSb
    } catch (error) {
      return "ERROR"
    }
  }

  async function fetchOpMitSb(payload) {
    try {
      const opResponseMitSB = await axios.post(apiUrl, payload, { headers })
      const tarifBeitragOpMitSb = opResponseMitSB.data.tarifBeitraege[1][0].beitrag
      console.log("Fetch from ", apiUrl, " for OpMitSb was successfull.")
      return tarifBeitragOpMitSb
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
app.listen(PORT, () => console.log(`Server läuft auf http://localhost:${PORT}`))
