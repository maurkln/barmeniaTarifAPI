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

  const apiUrl = "https://ssl.barmenia.de/api/oa-bff-tier/tarifierung/"
  const apiUrlTopMitZahn = "https://ssl.barmenia.de/api/oa-bff-tier/tarifierung/Top"
  const apiUrlPremiumMitZahn = "https://ssl.barmenia.de/api/oa-bff-tier/tarifierung/Premium_1200"

  let premiumMitZahnBeitrag = 0
  let topMitZahnBeitrag = 0

  // Frontend-Daten extrahieren
  const { hunderasse, geburtsdatum, versicherungsbeginn, zahlweise, hunderassenList, selbstbeteiligung } = req.body

  // Überprüfe die Felder auf Validität
  if (
    !hunderasse ||
    !geburtsdatum ||
    !versicherungsbeginn ||
    !zahlweise ||
    !hunderassenList ||
    !Array.isArray(hunderassenList) ||
    hunderassenList.length === 0
  ) {
    console.error("Fehlende oder ungültige Felder im Request!")
    return res.status(400).json({ error: "Fehlende oder ungültige Felder im Request" })
  }

  // Alter des Hundes berechnen
  const ageAtStart = berechneAlter(geburtsdatum, versicherungsbeginn)
  const isOlderDog = ageAtStart >= 4 // Setze älter als 4 Jahre als Grenzwert
  const isDogTooOldForKv = ageAtStart > 5 // Hunde älter als 5 Jahre erhalten keine KV-Versicherung

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
        tarife: isOlderDog ? [] : null,
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
      zahlweise,
      selbstbeteiligungBeitrag: 0,
      spezialTarif: "", // Premium_Akut_1200 für mit Vorsorge & Zahn, leer für gar nichts
      tarif: "",
      isKV: false,
      showOP: true,
      pferd: true,
      vuz: true,
      disableSbCheckboxKv: isOlderDog,
      disableSbCheckboxOp: false,
      showAbschlussButton: true,
      tierartParam: "Hund",
      selbstbeteiligung: isOlderDog ? true : selbstbeteiligung,
      hunderasse,
      hunderassenList,
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

  const kvPayload = {
    ...basePayload,
    oaSpezifisch: {
      ...basePayload.oaSpezifisch,
      versicherung: "kv"
    }
  }

  const opPayload = {
    ...basePayload,
    oaSpezifisch: {
      ...basePayload.oaSpezifisch,
      versicherung: "op"
    }
  }

  console.log(kvPayload)

  //   INFO

  //   Es werden mehrere fetches an die BarmeniaAPI gemacht.
  //   Der erste ist mit der normalen Payload and die url /tarifierung
  //   Die gibt dann alle base Preise etc aus.

  //   Es wird dann eine zweite and /tarifierung/Top gemacht
  //   Dort bekommt man dann den preis für die Top inkl Vorsorge und Zahn

  //   Zuletzt eine dritte and /tarifierung/Premium_Akut_1200
  //   für den Preis von Premium inkl Vorsorge und Zahn

  try {
    let gefilterteKvTarife = []

    // KV fetch from Barmenia server
    if (!isDogTooOldForKv) {
      // Erstes senden von base payload für ersten fetch
      console.log("Senden von KV-Payload an /tarifierung:")
      const kvResponseMain = await axios.post(apiUrl, kvPayload, { headers })
      console.log("KV Response für Basis Preise erfolgreich erhalten:", kvResponseMain.data)

      // Zweite payload an /taifierung/Top
      console.log("Senden von KV-Payload an /tarifierung/Top")
      try {
        const kvResponseTopMitZahn = await axios.post(apiUrlTopMitZahn, kvPayload, { headers })
        console.log("KV Response für TOP mit Zahn erfolgreich erhalten:", kvResponseTopMitZahn.data)
        topMitZahnBeitrag = kvResponseTopMitZahn.data.tarifBeitraege.Top[0].beitrag
      } catch (error) {
        console.log("Ein Fehler beim Abrufen von TopMitZahn ist aufgetreten:", error.message)
      }

      // dritte payload für Premium mit Zahn an tarifierung/Premium_1200
      try {
        console.log("Senden von KV-Payload an /tarifierung/Premium_1200")
        const kvResponsePremiumMitZahn = await axios.post(apiUrlPremiumMitZahn, kvPayload, { headers })
        console.log("KV Response für Premium mit Zahn erfolgreich erhalten:", kvResponsePremiumMitZahn.data)
        premiumMitZahnBeitrag = kvResponsePremiumMitZahn.data.tarifBeitraege.Premium_1200[0].beitrag
      } catch (error) {
        console.log("Ein Fehler beim Abrufen von PremiumMitZahn ist aufgetreten:", error.message)
      }

      gefilterteKvTarife = kvResponseMain.data.tarifBeitraege?.["1"]
        ? kvResponseMain.data.tarifBeitraege["1"].filter((tarif) => ["Basis", "Top", "Premium"].includes(tarif.tarifInfo?.name))
        : []
    } else {
      console.log("Hund ist älter als 5 Jahre, KV-Abfrage übersprungen.")
    }

    // OP fetch from Barmenia Server
    console.log("Senden von OP-Payload:")
    const opResponse = await axios.post(apiUrl, opPayload, { headers })
    console.log("OP Response erfolgreich erhalten:", opResponse.data)

    const gefilterteOpTarife = opResponse.data.tarifBeitraege?.["1"]
      ? opResponse.data.tarifBeitraege["1"].filter((tarif) => tarif.tarifInfo?.name === "Premium")
      : []

    const umbenannteOpTarife = gefilterteOpTarife.map((tarif) => ({
      name: "OPSchutz",
      beitrag: tarif.beitrag
    }))

    // Zusammenführen der Tarife
    const tarife = [
      ...(isDogTooOldForKv
        ? []
        : gefilterteKvTarife.map((tarif) => ({
            name: tarif.tarifInfo.name,
            beitrag: tarif.beitrag
          }))),
      ...umbenannteOpTarife
    ]
    topMitZahnBeitrag ? tarife.push({ name: "TopMitZahn", beitrag: topMitZahnBeitrag }) : null
    premiumMitZahnBeitrag ? tarife.push({ name: "PremiumMitZahn", beitrag: premiumMitZahnBeitrag }) : null

    console.log("Finale Tarife:", tarife)
    return res.json(tarife)
  } catch (error) {
    console.error("Ein Fehler ist aufgetreten:", error.message)
    if (error.response) {
      console.error("Fehlerdetails:", error.response.data)
    }
    return res.status(500).json({ error: "Interner Serverfehler bei der Tarifierung" })
  }
})

// Starte den Server
app.listen(PORT, () => console.log(`Server läuft auf http://localhost:${PORT}`))

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

  const apiUrl = "https://ssl.barmenia.de/api/oa-bff-tier/tarifierung/"
  const apiUrlTopMitZahn = "https://ssl.barmenia.de/api/oa-bff-tier/tarifierung/Top"
  const apiUrlPremiumMitZahn = "https://ssl.barmenia.de/api/oa-bff-tier/tarifierung/Premium_1200"

  let premiumMitZahnBeitrag = 0
  let topMitZahnBeitrag = 0

  // Frontend-Daten extrahieren
  const { geburtsdatum, versicherungsbeginn, zahlweise, selbstbeteiligung } = req.body

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

  // Alter des Hundes berechnen
  const ageAtStart = berechneAlter(geburtsdatum, versicherungsbeginn)
  const isOlderCat = ageAtStart >= 4 // Setze älter als 4 Jahre als Grenzwert
  const isCatTooOldForKv = ageAtStart > 5 // Hunde älter als 5 Jahre erhalten keine KV-Versicherung

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
        tarife: isOlderCat ? [] : null,
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
      disableSbCheckboxKv: isOlderCat,
      disableSbCheckboxOp: false,
      showAbschlussButton: true,
      tierartParam: "Katze",
      selbstbeteiligung: isOlderCat ? true : selbstbeteiligung,
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

  const kvPayload = {
    ...basePayload,
    oaSpezifisch: {
      ...basePayload.oaSpezifisch,
      versicherung: "kv"
    }
  }

  const opPayload = {
    ...basePayload,
    oaSpezifisch: {
      ...basePayload.oaSpezifisch,
      versicherung: "op"
    }
  }

  console.log(kvPayload)

  //   INFO

  //   Es werden mehrere fetches an die BarmeniaAPI gemacht.
  //   Der erste ist mit der normalen Payload and die url /tarifierung
  //   Die gibt dann alle base Preise etc aus.

  //   Es wird dann eine zweite and /tarifierung/Top gemacht
  //   Dort bekommt man dann den preis für die Top inkl Vorsorge und Zahn

  //   Zuletzt eine dritte and /tarifierung/Premium_Akut_1200
  //   für den Preis von Premium inkl Vorsorge und Zahn

  try {
    let gefilterteKvTarife = []

    // KV fetch from Barmenia server
    if (!isCatTooOldForKv) {
      // Erstes senden von base payload für ersten fetch
      console.log("Senden von KV-Payload an /tarifierung:")
      const kvResponseMain = await axios.post(apiUrl, kvPayload, { headers })
      console.log("KV Response für Basis Preise erfolgreich erhalten:", kvResponseMain.data)

      // Zweite payload an /taifierung/Top
      console.log("Senden von KV-Payload an /tarifierung/Top")
      try {
        const kvResponseTopMitZahn = await axios.post(apiUrlTopMitZahn, kvPayload, { headers })
        console.log("KV Response für TOP mit Zahn erfolgreich erhalten:", kvResponseTopMitZahn.data)
        topMitZahnBeitrag = kvResponseTopMitZahn.data.tarifBeitraege.Top[0].beitrag
      } catch (error) {
        console.log("Ein Fehler beim Abrufen von TopMitZahn ist aufgetreten:", error.message)
      }

      // dritte payload für Premium mit Zahn an tarifierung/Premium_1200
      try {
        console.log("Senden von KV-Payload an /tarifierung/Premium_1200")
        const kvResponsePremiumMitZahn = await axios.post(apiUrlPremiumMitZahn, kvPayload, { headers })
        console.log("KV Response für Premium mit Zahn erfolgreich erhalten:", kvResponsePremiumMitZahn.data)
        premiumMitZahnBeitrag = kvResponsePremiumMitZahn.data.tarifBeitraege.Premium_1200[0].beitrag
      } catch (error) {
        console.log("Ein Fehler beim Abrufen von PremiumMitZahn ist aufgetreten:", error.message)
      }

      gefilterteKvTarife = kvResponseMain.data.tarifBeitraege?.["1"]
        ? kvResponseMain.data.tarifBeitraege["1"].filter((tarif) => ["Basis", "Top", "Premium"].includes(tarif.tarifInfo?.name))
        : []
    } else {
      console.log("Hund ist älter als 5 Jahre, KV-Abfrage übersprungen.")
    }

    // OP fetch from Barmenia Server
    console.log("Senden von OP-Payload:")
    const opResponse = await axios.post(apiUrl, opPayload, { headers })
    console.log("OP Response erfolgreich erhalten:", opResponse.data)

    const gefilterteOpTarife = opResponse.data.tarifBeitraege?.["1"]
      ? opResponse.data.tarifBeitraege["1"].filter((tarif) => tarif.tarifInfo?.name === "Premium")
      : []

    const umbenannteOpTarife = gefilterteOpTarife.map((tarif) => ({
      name: "OPSchutz",
      beitrag: tarif.beitrag
    }))

    // Zusammenführen der Tarife
    const tarife = [
      ...(isCatTooOldForKv
        ? []
        : gefilterteKvTarife.map((tarif) => ({
            name: tarif.tarifInfo.name,
            beitrag: tarif.beitrag
          }))),
      ...umbenannteOpTarife
    ]
    topMitZahnBeitrag ? tarife.push({ name: "TopMitZahn", beitrag: topMitZahnBeitrag }) : null
    premiumMitZahnBeitrag ? tarife.push({ name: "PremiumMitZahn", beitrag: premiumMitZahnBeitrag }) : null

    console.log("Finale Tarife:", tarife)
    return res.json(tarife)
  } catch (error) {
    console.error("Ein Fehler ist aufgetreten:", error.message)
    if (error.response) {
      console.error("Fehlerdetails:", error.response.data)
    }
    return res.status(500).json({ error: "Interner Serverfehler bei der Tarifierung" })
  }
})
