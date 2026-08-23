# UroAntibiogramma

Prototipo di supporto decisionale, locale e offline, per la scelta di
antibiotico e posologia da urinocoltura/antibiogramma — con o senza un
intervento urologico programmato.

## ⚠️ Stato: bozza, non validata clinicamente

Tutto il contenuto clinico (quale antibiotico, quale dose, quale via, quale
durata) è uno **scaffold** basato su:

- EAU Guidelines on Urological Infections 2026 (PDF originale in
  `books/`, letto integralmente e incrociato con `rules.js` il
  2026-08-23 — vedi "Incrocio bibliografico" sotto)
- Kucers' *The Use of Antibiotics* (7th ed.) e Mandell-Douglas-Bennett's
  *Principles and Practice of Infectious Diseases*, in `books/` —
  scansionati per parola chiave (non letti integralmente) per i dati di
  penetrazione tissutale e i regimi di profilassi/terapia
- WHO AWaRe classification 2023 (`books/WHO-MHP-HPS-EML-2023.04-eng.xlsx`)
  per la categoria Access/Watch/Reserve di ogni antibiotico — fonte
  primaria diretta, non stimata
- farmacologia clinica generale per i punti che le tre fonti sopra non
  coprono (marcati esplicitamente nei commenti di `rules.js`)
- la rassegna di C. Rhee linkata dall'utente come riscontro iniziale
  (dati di penetrazione tissutale e spettro per classe)

**Non è stato controllato da un infettivologo o dal relatore** — l'incrocio
con le tre fonti in `books/` è un passo di validazione automatizzata, non
sostituisce una revisione clinica umana. Ogni raccomandazione mostra un
badge di stato ("BOZZA — da validare" o "CONFERMATA — vedi fonte") e una
riga "Fonte" con pagina/sezione dove disponibile. Se aggiungi un'altra
fonte (protocollo locale, linee guida AMCLI/IDSA, AUA/SUFU per la protesi
peniena), aggiungila come `fonte` sulla regola specifica — le regole non
hanno una fonte unica globale di proposito, così puoi validarle una alla
volta.

### Incrocio bibliografico del 2026-08-23 — punti aperti principali

Un agente di ricerca ha incrociato `rules.js` con le tre fonti sopra
(report completo nella cronologia della sessione). Punti che meritano
attenzione prioritaria del relatore:

1. **Correzione di sicurezza già applicata**: lo schema di profilassi per
   la biopsia prostatica transrettale usava ciprofloxacina — i
   fluorochinoloni sono VIETATI per questa procedura (restrizione EMA
   2019, confermata da EAU 2026). Sostituito con cotrimoxazolo + avviso
   esplicito; EAU raccomanda in realtà un approccio "culture-directed"
   (tampone rettale) quando disponibile.
2. **Lacuna importante**: nessuna delle tre fonti copre la profilassi per
   protesi peniena/AUS (EAU 2026 non menziona questi dispositivi in tutto
   il documento, verificato). Lo schema vancomicina+gentamicina presente
   in `rules.js` non è confermato da queste fonti — priorità alta per la
   validazione, essendo il tema della tesi.
3. **EAU 2026 non raccomanda farmaci specifici per procedura** (solo
   sì/no e classi, per eterogeneità di resistenze in Europa) — gli
   schemi di `PROFILASSI_RULES` sono quindi esempi nelle classi
   indicate, non citazioni testuali EAU. Riportato esplicitamente in ogni
   voce.
4. **EAU 2026 §3.9 (urosepsi) è vuota**, in revisione per l'edizione
   2027, rimanda alla Surviving Sepsis Campaign 2021 (non ancora
   consultata). Lo schema attuale si appoggia su Mandell/IDSA 2025.
5. **Fosfomicina, penetrazione prostatica**: corretta da "scarsa" a
   "intermedia" — Kucers e Mandell concordano nel contraddire la stima
   iniziale (dettagli e citazioni in `rules.js`).
6. **Batteriuria asintomatica e cistite non complicata**: doppia fonte
   concordante, passate a stato "confermata".

L'app non è un dispositivo medico. Nessuna informazione lascia il
dispositivo: non c'è backend, non c'è invio dati in rete (eccetto il
download una tantum del modello OCR italiano, la prima volta che si usa
la scansione — poi resta in cache per gli usi successivi offline).

## Come è organizzata la logica (non è una tabella di corrispondenza)

Il punto centrale, per come l'ha chiesto l'utente, è che la scelta
dell'antibiotico "mirato" da antibiogramma non è un semplice lookup
germe→farmaco. `engine.js` applica in sequenza TRE vincoli distinti:

1. **Sensibilità in vitro** — dai risultati S/I/R inseriti.
2. **Sicurezza allergica** — nessuna allergia dichiarata (a livello di
   molecola specifica, di classe, o di famiglia beta-lattamica quando la
   reazione indice è severa ritardata) sul farmaco candidato. Questo è un
   vincolo di sicurezza e viene applicato PRIMA di tutto il resto.
3. **Penetrazione tissutale nel distretto richiesto dal contesto clinico**
   — ricavato dalla procedura selezionata (es. TURP → serve buona
   penetrazione prostatica) o, in assenza di procedura, dalla sindrome
   clinica (es. pielonefrite → serve buona penetrazione renale).

Solo tra i farmaci che soddisfano tutti e tre i vincoli sceglie quello a
spettro più stretto (con una preferenza leggera per la categoria WHO
AWaRe "Access" quando esiste un'alternativa equivalente sensibile). I
farmaci esclusi in ciascun passaggio restano visibili con il motivo —
non vengono nascosti, per trasparenza e audit manuale.

Esempio concreto (quello indicato dall'utente): urinocoltura positiva a
*E. coli* sensibile sia a cefuroxime sia a ciprofloxacina, paziente deve
fare una TURP. Cefuroxime è un beta-lattamico: penetrazione prostatica
scarsa nonostante la sensibilità in vitro → l'app lo mostra tra gli
esclusi e propone ciprofloxacina, spiegando il perché.

### Allergie: molecola, classe, e gravità della reazione

Non è un checkbox "allergico ai beta-lattamici sì/no". Ogni allergia
dichiarata ha un **tipo** (molecola specifica o intera classe) e una
**gravità**, perché la gravità cambia cosa è sicuro escludere:

- **lieve/non immediata** → si esclude solo la molecola/classe dichiarata;
  su altre classi beta-lattamiche correlate, solo un avviso informativo
  (la cross-reattività riportata in letteratura è generalmente bassa).
- **severa immediata** (anafilassi, angioedema, orticaria/broncospasmo) →
  si esclude quanto dichiarato; sulle altre classi beta-lattamiche un
  avviso FORTE che richiede valutazione allergologica/anestesiologica
  prima di somministrare — non un'esclusione automatica, perché quella
  decisione dopo un'anafilassi non va delegata a una tabella.
- **severa ritardata** (SJS/TEN, DRESS, AGEP) → si esclude l'INTERA
  famiglia beta-lattamica (penicilline + cefalosporine + carbapenemici),
  non solo la classe dichiarata: è la prassi standard, nessuna eccezione
  automatica.

La stessa logica di esclusione si applica sia alla terapia mirata da
antibiogramma sia agli schemi di profilassi perioperatoria (che passano
automaticamente allo schema alternativo quando quello standard contiene
un farmaco da escludere) sia alla terapia empirica per sindrome.

Le tabelle di `rules.js` (profilassi per procedura, terapia per sindrome,
penetrazione per farmaco) sono comunque il punto di ingresso per
correggere/aggiornare i contenuti: la logica in `engine.js` non contiene
alcun dato clinico, solo il modo di combinarli.

## Uso

1. Apri `index.html` in un browser mobile (Chrome/Safari). Per l'OCR e il
   service worker offline serve HTTPS o `localhost` — non funziona aprendo
   il file con `file://`. Due opzioni semplici:
   - `python3 -m http.server 8000` nella cartella, poi apri
     `http://<ip-del-pc>:8000` dal telefono sulla stessa rete;
   - pubblicarla su un hosting statico qualsiasi (GitHub Pages, Netlify...).
2. "Aggiungi a schermata Home" dal browser del telefono per usarla come app.
3. Step 1 "Caso clinico" — contesto (sindrome clinica, intervento, funzione
   renale, allergie) e referto nella stessa schermata: fotografa/carica
   l'immagine e premi "Estrai testo" (la prima volta scarica ~7 MB di
   modello lingua italiana, poi resta in cache), oppure compila a mano. Le
   righe della tabella con un possibile riscontro nel testo OCR si
   evidenziano in giallo come promemoria "da controllare" — il valore
   S/I/R va sempre impostato manualmente.
4. Step 2 "Risultato" — raccomandazione, con badge di stato e fonte.
   "Stampa/esporta PDF" per il referto ambulatoriale.

## Struttura

- `rules.js` — tutto il contenuto clinico (organismi, antibiotici con
  penetrazione tissutale, procedure, regole di profilassi, regole di
  terapia per sindrome). Nessuna logica qui, solo dati con `fonte` e
  `stato`.
- `engine.js` — funzioni pure che applicano le regole al contesto del
  paziente. Nessun contenuto clinico qui, solo il "come combinare".
- `app.js` — wiring dell'interfaccia, integrazione OCR.
- `index.html`, `style.css` — struttura e stile, mobile-first.
- `lib/` — Tesseract.js vendorizzato per l'OCR offline (motore +
  dati lingua italiana).
- `manifest.json`, `sw.js` — installabilità come PWA e cache offline.
- `books/` — testi di riferimento per validare i contenuti clinici (EAU
  Guidelines 2026, Kucers, Mandell-Douglas-Bennett, WHO AWaRe). **Solo per
  consultazione locale**: sono file protetti da copyright, non fanno parte
  dell'app e non vanno mai pubblicati, committati in un repository o
  copiati insieme al resto quando distribuisci l'app (es. su GitHub
  Pages) — deploya solo `index.html`, `style.css`, `app.js`, `rules.js`,
  `engine.js`, `lib/`, `manifest.json`, `sw.js`, `icons/`.

## Privacy

Nessun campo per nome, cognome o codice fiscale del paziente: l'app
gestisce solo dati clinici (germe, antibiogramma, età/peso/creatinina in
forma numerica, allergie). Non salva nulla su server: tutto lo stato vive
in memoria nella pagina e si perde al refresh (nessun localStorage con
dati clinici, di proposito).

## Prossimi passi suggeriti

- Trovare una fonte urologica specifica (AUA/SUFU o protocollo locale)
  per la profilassi di protesi peniena/AUS — priorità più alta, vedi
  punto 2 dell'incrocio bibliografico sopra.
- Validare col relatore/infettivologo di riferimento i punti aperti
  segnalati nell'incrocio bibliografico (in particolare piperacillina-
  tazobactam→prostata, un giudizio di soglia non ancora deciso) e i
  farmaci senza dato puntuale (marcati "non verificato" nei commenti di
  `rules.js`), poi passare `stato` da `bozza` a `confermata` caso per
  caso.
- Se emerge tempo, incrociare anche la Surviving Sepsis Campaign 2021 per
  colmare il vuoto di EAU 2026 §3.9 sull'urosepsi.
- Aggiungere altre fonti quando identificate (protocollo locale del
  centro, antibiogramma cumulativo locale se disponibile, linee guida
  AMCLI/IDSA) — ogni regola può avere la propria fonte specifica.
- Rivedere la tabella di cross-reattività allergica beta-lattamica in
  `rules.js` (`NOTA_CROSS_REATTIVITA_BETA_LATTAMICI`) con un allergologo:
  è volutamente conservativa (avviso, non esclusione automatica, per le
  reazioni severe immediate su classe diversa) ma i numeri citati sono
  generici, non specifici del paziente.
- Se utile, estendere l'OCR con un parser più strutturato per i formati
  di referto più frequenti nel tuo laboratorio (oggi resta volutamente
  "assistivo": mostra il testo, non compila da sola S/I/R).
