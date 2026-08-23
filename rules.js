/*
 * Contenuto clinico — BOZZA DA VALIDARE (anche le voci "confermata").
 *
 * Scaffold incrociato il 2026-08-23 con tre fonti in `books/`: EAU
 * Guidelines on Urological Infections 2026 (PDF originale, letto
 * integralmente), Kucers' The Use of Antibiotics 7th ed. e Mandell,
 * Douglas, and Bennett's Principles and Practice of Infectious Diseases
 * (scansionati per parola chiave con ricerca full-text mirata — non letti
 * integralmente). Vedi i commenti puntuali su ogni regola/farmaco per la
 * pagina esatta. "confermata" significa "confermata dalle fonti
 * consultate finché scritto", non "validata dal relatore" — resta da
 * fare comunque una revisione clinica umana prima di un uso reale.
 *
 * Punti aperti più importanti emersi dall'incrocio (dettagli nei commenti
 * puntuali sotto): (1) EAU 2026 dichiara esplicitamente di NON
 * raccomandare farmaci specifici per procedura — gli schemi di
 * PROFILASSI_RULES sono quindi esempi nelle classi indicate, non
 * citazioni testuali EAU; (2) nessuna delle tre fonti copre la profilassi
 * per protesi peniena/AUS (voce `impianto`), priorità alta per la
 * validazione essendo il tema della tesi; (3) EAU 2026 §3.9 (urosepsi) è
 * vuota, rimanda alla Surviving Sepsis Campaign 2021 non ancora
 * consultata; (4) fosfomicina è stata corretta da "scarsa" a "intermedia"
 * per la penetrazione prostatica, in disaccordo con la stima iniziale.
 *
 * Per aggiungere un'altra fonte (es. protocollo locale, linee guida AMCLI,
 * IDSA, AUA/SUFU per la protesi peniena): aggiungi la regola con il suo
 * `fonte` specifico.
 */

const STATO = {
  BOZZA: 'bozza',
  CONFERMATA: 'confermata',
};

// ---------------------------------------------------------------------
// Organismi uropatogeni comuni (per autocomplete / suggerimento da OCR)
// ---------------------------------------------------------------------
const ORGANISMI = [
  'Escherichia coli',
  'Klebsiella pneumoniae',
  'Proteus mirabilis',
  'Enterococcus faecalis',
  'Enterococcus faecium',
  'Pseudomonas aeruginosa',
  'Staphylococcus saprophyticus',
  'Staphylococcus aureus',
  'Enterobacter cloacae',
  'Citrobacter freundii',
  'Morganella morganii',
  'Serratia marcescens',
  'Candida (lievito)',
  'Altro / non elencato',
];

// ---------------------------------------------------------------------
// Antibiotici tipicamente in un antibiogramma urinario
// classe: usata per il controllo incrociato con le allergie
// aggiustamento_renale: true se la dose va rivista con eGFR ridotto
//
// penetrazione: valutazione qualitativa per distretto — 'buona' | 'scarsa'
// | 'intermedia' | null (non rilevante/non nota). Distretti:
//   urina      — livelli urinari (basta per cistite non complicata)
//   prostata   — attraversamento della barriera emato-prostatica
//   rene       — parenchima renale (serve per pielonefrite)
//   sistemico  — livelli ematici/tissutali per infezione sistemica
//   dispositivo — penetrazione in tessuto peri-protesico/biofilm
//
// Fonte per prostata/rene/urina: farmacologia clinica standard (barriera
// emato-prostatica: i farmaci lipofilici a basso legame ionico la
// attraversano, i beta-lattamici e gli aminoglicosidi no) — nozione da
// manuale, non da una singola citazione puntuale. DA VALIDARE col
// relatore prima di un uso clinico reale, soprattutto sui casi limite.
//
// aware: categoria WHO AWaRe 2023 (Access/Watch/Reserve) — da
// WHO-MHP-HPS-EML-2023.04-eng.xlsx (fonte primaria, non stimata). Usata
// dal motore per un avviso di stewardship, mai per escludere un farmaco.
// ---------------------------------------------------------------------
// Le note "fonte penetrazione" sotto vengono dalla ricerca full-text del
// 2026-08-23 su Kucers (2023, 4894 pagine) e Mandell-Douglas-Bennett
// (5534 pagine) — quando manca una nota specifica per un farmaco, la
// ricerca NON ha trovato un dato quantitativo puntuale (nessuna pagina
// con farmaco+distretto co-occorrenti): la stima resta quella da
// farmacologia generale già dichiarata sopra, non confermata né smentita.
const ANTIBIOTICI = [
  { id: 'amox_clav', nome: 'Amoxicillina-clavulanato', classe: 'beta-lattamico', aggiustamento_renale: true, aware: 'Access',
    // penetrazione: non verificata con dato puntuale (nessuna concentrazione tissutale prostatica/renale trovata in Kucers/Mandell per questa specifica combinazione)
    penetrazione: { urina: 'buona', prostata: 'scarsa', rene: 'buona', sistemico: 'buona', dispositivo: 'scarsa' } },
  { id: 'ampicillina', nome: 'Ampicillina', classe: 'beta-lattamico', aggiustamento_renale: true, aware: 'Access',
    // prostata "scarsa" confermata: Mandell p.386 "distribution of all the penicillins to eye, brain, CSF, or prostate is insufficient in the absence of inflammation"; Kucers p.337 (ampicillina-sulbactam) "high variability of penetration into the prostate"
    penetrazione: { urina: 'buona', prostata: 'scarsa', rene: 'buona', sistemico: 'buona', dispositivo: 'scarsa' } },
  { id: 'pip_tazo', nome: 'Piperacillina-tazobactam', classe: 'beta-lattamico', aggiustamento_renale: true, aware: 'Watch',
    // prostata: Kucers p.247 riporta un dato quantitativo reale — "prostate concentrations in uninflamed tissue are 36% of plasma concentrations throughout the dosing interval" — alzata da 'scarsa' a 'intermedia' su questa base, ma è un giudizio di soglia (36% resta lontano dai livelli "eccellenti" di fluorochinoloni/TMP-SMX): DA DISCUTERE col relatore
    penetrazione: { urina: 'buona', prostata: 'intermedia', rene: 'buona', sistemico: 'buona', dispositivo: 'scarsa' } },
  { id: 'cefazolina', nome: 'Cefazolina', classe: 'cefalosporina', aggiustamento_renale: true, aware: 'Access',
    // penetrazione: non verificata con dato puntuale (i risultati di ricerca per "cefazolina" hanno intercettato per prossimità pagine su ceftriaxone, non un dato specifico per cefazolina)
    penetrazione: { urina: 'buona', prostata: 'scarsa', rene: 'buona', sistemico: 'intermedia', dispositivo: 'scarsa' } },
  { id: 'cefuroxime', nome: 'Cefuroxime', classe: 'cefalosporina', aggiustamento_renale: true, aware: 'Watch',
    // penetrazione: non verificata con dato puntuale (solo citazioni d'uso come profilassi chirurgica, nessun dato di concentrazione tissutale)
    penetrazione: { urina: 'buona', prostata: 'scarsa', rene: 'buona', sistemico: 'buona', dispositivo: 'scarsa' } },
  { id: 'ceftriaxone', nome: 'Ceftriaxone', classe: 'cefalosporina', aggiustamento_renale: false, aware: 'Watch',
    // prostata "scarsa" confermata pur con nota importante: Kucers p.549 misura concentrazioni TISSUTALI reali (12.9-73.7 µg/g a 30min, fino a 0.6-5.6 µg/g a 48h dopo 2g EV) ma Mandell p.332 chiarisce che fluorochinoloni/TMP-SMX hanno "excellent prostatic penetration" nel FLUIDO prostatico, per esclusione i beta-lattamici restano clinicamente inferiori lì pur raggiungendo livelli tissutali misurabili — distinzione tessuto-vs-fluido, non contraddice "scarsa" ai fini clinici
    penetrazione: { urina: 'buona', prostata: 'scarsa', rene: 'buona', sistemico: 'buona', dispositivo: 'scarsa' } },
  { id: 'cefixime', nome: 'Cefixime', classe: 'cefalosporina', aggiustamento_renale: true, aware: 'Watch',
    // prostata "scarsa" confermata: Kucers p.595 — concentrazioni nel fluido prostatico 0.83 µg/ml o meno dopo dose orale 200-400mg
    penetrazione: { urina: 'buona', prostata: 'scarsa', rene: 'buona', sistemico: 'intermedia', dispositivo: 'scarsa' } },
  { id: 'ceftazidime', nome: 'Ceftazidime', classe: 'cefalosporina', aggiustamento_renale: true, aware: 'Watch',
    // prostata "scarsa" confermata con stessa nota di ceftriaxone: Kucers p.612 — tessuto prostatico 10.1→2.5 µg/g in 1-7h dopo 2g EV (dato tissutale, non di fluido/efficacia clinica)
    penetrazione: { urina: 'buona', prostata: 'scarsa', rene: 'buona', sistemico: 'buona', dispositivo: 'scarsa' } },
  { id: 'meropenem', nome: 'Meropenem', classe: 'carbapenemico', aggiustamento_renale: true, aware: 'Watch',
    // penetrazione: non verificata con dato puntuale (nessuna concentrazione prostatica/renale specifica reperita in Kucers/Mandell per questa ricerca) — NON presumere "scarsa" per sola analogia di classe senza fonte
    penetrazione: { urina: 'buona', prostata: 'scarsa', rene: 'buona', sistemico: 'buona', dispositivo: 'scarsa' } },
  { id: 'ertapenem', nome: 'Ertapenem', classe: 'carbapenemico', aggiustamento_renale: true, aware: 'Watch',
    // penetrazione: non verificata con dato puntuale, vedi nota su meropenem
    penetrazione: { urina: 'buona', prostata: 'scarsa', rene: 'buona', sistemico: 'buona', dispositivo: 'scarsa' } },
  { id: 'gentamicina', nome: 'Gentamicina', classe: 'aminoglicoside', aggiustamento_renale: true, aware: 'Access',
    // prostata: nessun dato quantitativo diretto, ma Mandell p.332 include aminoglicosidi tra i farmaci con alti livelli urinari senza includerli tra quelli con "excellent prostatic penetration" (riservato a fluorochinoloni+TMP-SMX) — conferma indiretta di "scarsa". Rene: nessun dato di concentrazione parenchimale, solo indizio indiretto da nefrotossicità (accumulo tubulare)
    penetrazione: { urina: 'buona', prostata: 'scarsa', rene: 'intermedia', sistemico: 'intermedia', dispositivo: 'scarsa' } },
  { id: 'amikacina', nome: 'Amikacina', classe: 'aminoglicoside', aggiustamento_renale: true, aware: 'Access',
    // penetrazione: stessa nota di gentamicina (classe aminoglicosidica)
    penetrazione: { urina: 'buona', prostata: 'scarsa', rene: 'intermedia', sistemico: 'intermedia', dispositivo: 'scarsa' } },
  { id: 'ciprofloxacina', nome: 'Ciprofloxacina', classe: 'fluorochinolone', aggiustamento_renale: true, aware: 'Watch',
    // prostata "buona" confermata: Mandell p.632 "concentrations in prostate tissue... usually exceed serum concentrations" (nel fluido prostatico invece inferiori al siero ma clinicamente efficaci per bassa MIC); EAU 2026 §3.11.5.a conferma fluorochinoloni come prima linea per prostatite cronica batterica
    penetrazione: { urina: 'buona', prostata: 'buona', rene: 'buona', sistemico: 'buona', dispositivo: 'intermedia' } },
  { id: 'levofloxacina', nome: 'Levofloxacina', classe: 'fluorochinolone', aggiustamento_renale: true, aware: 'Watch',
    // prostata "buona" confermata: stessa fonte di ciprofloxacina (Mandell p.632, classe fluorochinoloni)
    penetrazione: { urina: 'buona', prostata: 'buona', rene: 'buona', sistemico: 'buona', dispositivo: 'intermedia' } },
  { id: 'cotrimoxazolo', nome: 'Trimetoprim-sulfametoxazolo', classe: 'sulfamidico', aggiustamento_renale: true, aware: 'Access',
    // prostata "buona" confermata: Kucers p.1698 "level of TMP in prostatic tissue has been greater than that attained in sera" in alcuni casi; Mandell p.616 "trimethoprim accumulates in prostatic secretions"; Mandell p.332 lo include esplicitamente (con i fluorochinoloni) tra i due gruppi con "excellent prostatic penetration"
    penetrazione: { urina: 'buona', prostata: 'buona', rene: 'buona', sistemico: 'buona', dispositivo: 'intermedia' } },
  { id: 'nitrofurantoina', nome: 'Nitrofurantoina', classe: 'nitrofurano', aggiustamento_renale: true, aware: 'Access',
    // prostata "scarsa" confermata: Mandell p.671 "concentrations in prostatic secretions are too low for effective use in prostate infections" (Kucers p.1712 riporta un'ipotesi teorica opposta ma meno solida)
    penetrazione: { urina: 'buona', prostata: 'scarsa', rene: 'scarsa', sistemico: 'scarsa', dispositivo: 'scarsa' } },
  { id: 'fosfomicina', nome: 'Fosfomicina trometamolo', classe: 'fosfonico', aggiustamento_renale: false, aware: 'Watch',
    // CORRETTA da 'scarsa' a 'intermedia' il 2026-08-23: doppia fonte concordante in disaccordo con la stima precedente. Kucers p.1451 "penetrates reasonably well into prostatic tissue" (6.5 mg/l medi dopo 3g orale, "sufficient to treat prostatitis"); Kucers p.1454 "good effect in long-time treatment of chronic prostatitis"; Mandell p.1899 "achieves therapeutic levels in prostatic tissue" (dati da Gardiner et al. 2013). Resta comunque non adatta a pielonefrite/rene (vedi TERAPIA_SINDROME.ivu_complicata)
    penetrazione: { urina: 'buona', prostata: 'intermedia', rene: 'scarsa', sistemico: 'scarsa', dispositivo: 'scarsa' } },
  { id: 'vancomicina', nome: 'Vancomicina', classe: 'glicopeptide', aggiustamento_renale: true, aware: 'Watch',
    // rene "intermedia" confermata con dato debole: Mandell p.562 "documented high concentrations of vancomycin in the kidney, liver, and spleen" (soprattutto studi animali, dato umano limitato). Prostata: nessun dato specifico trovato
    penetrazione: { urina: 'buona', prostata: 'scarsa', rene: 'intermedia', sistemico: 'buona', dispositivo: 'intermedia' } },
  { id: 'teicoplanina', nome: 'Teicoplanina', classe: 'glicopeptide', aggiustamento_renale: true, aware: 'Watch',
    // penetrazione: non verificata con dato puntuale (solo voci d'indice e uso in profilassi chirurgica cardiaca, Kucers p.910)
    penetrazione: { urina: 'buona', prostata: 'scarsa', rene: 'intermedia', sistemico: 'buona', dispositivo: 'intermedia' } },
  { id: 'linezolid', nome: 'Linezolid', classe: 'ossazolidinone', aggiustamento_renale: false, aware: 'Reserve',
    // penetrazione: non verificata con dato puntuale su prostata/rene in questa ricerca (risultati intercettati riguardavano protesi articolari, non prostata) — stima "buona" resta da farmacologia generale (lipofilicità nota), non da fonte puntuale
    penetrazione: { urina: 'intermedia', prostata: 'buona', rene: 'buona', sistemico: 'buona', dispositivo: 'buona' } },
];

// Etichette leggibili per le classi usate sopra (per i menu di selezione
// dell'allergia "a livello di classe").
const CLASSI_ANTIBIOTICI = [
  { id: 'beta-lattamico', nome: 'Beta-lattamici (penicilline)' },
  { id: 'cefalosporina', nome: 'Cefalosporine' },
  { id: 'carbapenemico', nome: 'Carbapenemici' },
  { id: 'aminoglicoside', nome: 'Aminoglicosidi' },
  { id: 'fluorochinolone', nome: 'Fluorochinoloni' },
  { id: 'sulfamidico', nome: 'Sulfamidici (TMP-SMX)' },
  { id: 'nitrofurano', nome: 'Nitrofurani' },
  { id: 'fosfonico', nome: 'Fosfonici (fosfomicina)' },
  { id: 'glicopeptide', nome: 'Glicopeptidi' },
  { id: 'ossazolidinone', nome: 'Ossazolidinoni' },
];

// ---------------------------------------------------------------------
// Gestione allergie — a livello di molecola specifica O di intera classe,
// con gravità della reazione indice. La gravità determina se un farmaco
// di classe "imparentata" (stessa famiglia beta-lattamica) va solo
// segnalato o escluso del tutto:
//
//   lieve            → si esclude solo la molecola/classe dichiarata;
//                       sulle altre classi beta-lattamiche solo un avviso
//                       informativo (cross-reattività generalmente bassa).
//   severa_immediata → si esclude la molecola/classe dichiarata; sulle
//                       altre classi beta-lattamiche un avviso FORTE
//                       (valutazione allergologica/anestesiologica prima
//                       di somministrare), non esclusione automatica: la
//                       letteratura riporta cross-reattività bassa ma la
//                       decisione in un caso di anafilassi pregressa non
//                       va automatizzata.
//   severa_ritardata → reazioni cutanee severe non IgE-mediate (SJS/TEN,
//                       DRESS, AGEP): si esclude l'INTERA famiglia
//                       beta-lattamica, non solo la classe dichiarata —
//                       è la pratica standard, nessuna eccezione
//                       automatica, nessun "rechallenge".
// ---------------------------------------------------------------------
const GRAVITA_ALLERGIA = [
  { id: 'lieve', nome: 'Lieve / non immediata (es. rash isolato, sintomi GI)' },
  { id: 'severa_immediata', nome: 'Severa immediata (anafilassi, angioedema, orticaria/broncospasmo)' },
  { id: 'severa_ritardata', nome: 'Severa ritardata (SJS/TEN, DRESS, AGEP)' },
];

// Famiglie chimiche che condividono l'anello beta-lattamico. Rilevante
// solo per il controllo incrociato delle allergie, non per altro.
const FAMIGLIE_BETA_LATTAMICHE = ['beta-lattamico', 'cefalosporina', 'carbapenemico'];

const NOTA_CROSS_REATTIVITA_BETA_LATTAMICI =
  'cross-reattività riportata in letteratura generalmente bassa (~1-2% penicilline-cefalosporine, ~1% verso i carbapenemici), ' +
  'legata soprattutto alla somiglianza della catena laterale R1 più che all\'anello beta-lattamico in sé — non una certezza per il singolo paziente';

// ---------------------------------------------------------------------
// Sindromi cliniche selezionabili (usate anche per i casi ambulatoriali
// senza intervento chirurgico)
// ---------------------------------------------------------------------
const SINDROMI = [
  { id: 'asintomatica', nome: 'Batteriuria asintomatica (nessun sintomo)' },
  { id: 'cistite_non_complicata', nome: 'Cistite acuta non complicata' },
  { id: 'ivu_complicata', nome: 'IVU complicata / pielonefrite' },
  { id: 'urosepsi', nome: 'Urosepsi / quadro severo' },
  { id: 'pre_procedura', nome: 'Solo copertura pre-procedura (vedi intervento)' },
];

// ---------------------------------------------------------------------
// Procedure urologiche — lista chiusa curata
// categoria: usata per selezionare il regime di profilassi perioperatoria
// requisito_tessutale: distretto che l'eventuale TERAPIA (non la sola
// profilassi) deve raggiungere efficacemente — usato dal motore per
// scartare/deprioritizzare farmaci sensibili in vitro ma con scarsa
// penetrazione nel tessuto coinvolto (es. beta-lattamici per TURP con
// urinocoltura positiva: sensibili ma non sterilizzano il parenchima
// prostatico).
// ---------------------------------------------------------------------
const PROCEDURE = [
  { id: 'nessuno', nome: 'Nessuno (visita/consulto ambulatoriale)', categoria: 'nessuna', requisito_tessutale: null },
  { id: 'cistoscopia', nome: 'Cistoscopia diagnostica', categoria: 'basso_rischio', requisito_tessutale: 'urina' },
  { id: 'turp', nome: 'TURP (resezione transuretrale prostata)', categoria: 'endourologico_mucosale', requisito_tessutale: 'prostata' },
  { id: 'rirs', nome: 'RIRS / ureteroscopia', categoria: 'endourologico_mucosale', requisito_tessutale: 'rene' },
  { id: 'pcnl', nome: 'PCNL (nefrolitotrissia percutanea)', categoria: 'pcnl', requisito_tessutale: 'rene' },
  { id: 'biopsia_prostatica', nome: 'Biopsia prostatica transrettale', categoria: 'biopsia_prostatica', requisito_tessutale: 'prostata' },
  { id: 'biopsia_prostatica_transperineale', nome: 'Biopsia prostatica transperineale', categoria: 'biopsia_transperineale', requisito_tessutale: 'prostata' },
  { id: 'prostatectomia_radicale', nome: 'Prostatectomia radicale (aperta/laparoscopica/robotica)', categoria: 'chirurgia_maggiore_pulita', requisito_tessutale: 'prostata' },
  { id: 'cistectomia', nome: 'Cistectomia con derivazione intestinale', categoria: 'chirurgia_maggiore_intestino', requisito_tessutale: 'sistemico' },
  { id: 'protesi_peniena', nome: 'Impianto protesi peniena', categoria: 'impianto', requisito_tessutale: 'dispositivo' },
  { id: 'sfintere_urinario', nome: 'Impianto sfintere urinario artificiale (AUS)', categoria: 'impianto', requisito_tessutale: 'dispositivo' },
  { id: 'altro', nome: 'Altro (non in lista — solo nota, nessuna raccomandazione automatica)', categoria: 'non_gestito', requisito_tessutale: null },
];

// Distretto richiesto dalla sola sindrome clinica, quando non c'è un
// intervento (o l'intervento è "nessuno"). Usato come fallback.
const SINDROME_REQUISITO_TESSUTALE = {
  asintomatica: null,
  cistite_non_complicata: 'urina',
  ivu_complicata: 'rene',
  urosepsi: 'sistemico',
  pre_procedura: null, // usa quello della procedura selezionata
};

// ---------------------------------------------------------------------
// Regole di profilassi per categoria di procedura.
// Ogni regola: farmaco/i, dose, via, timing, durata, alternativa se
// allergia ai beta-lattamici, fonte, stato, avvisi.
// ---------------------------------------------------------------------
// NOTA GENERALE (da EAU Guidelines on Urological Infections 2026, §3.18,
// p.63): il panel EAU dichiara esplicitamente di NON raccomandare farmaci
// specifici per procedura, per l'eterogeneità delle resistenze batteriche
// in Europa — dà solo indicazione sì/no e, per la biopsia prostatica,
// la classe. Gli schemi farmacologici sotto sono quindi ESEMPI PLAUSIBILI
// nelle classi indicate dove disponibili (o dalla profilassi chirurgica
// generale quando EAU non tratta la procedura, vedi singole voci), non
// raccomandazioni EAU testuali — vanno adattati all'antibiogramma
// cumulativo locale. Verificato via ricerca full-text sul PDF EAU 2026
// (105 pagine) incrociata con Kucers (2023) e Mandell-Douglas-Bennett
// (cap. 317, tabella Bratzler et al. 2013 per la profilassi chirurgica
// generale) il 2026-08-23.
const PROFILASSI_RULES = {
  nessuna: {
    raccomandazione: null,
    nota: 'Nessuna procedura selezionata: nessuna profilassi chirurgica applicabile.',
  },
  basso_rischio: {
    schema: [{ farmaco: 'nessuna profilassi di routine', dose: '-', via: '-', timing: '-', durata: '-' }],
    alternativa_allergia_beta_lattamici: null,
    note: 'Cistoscopia/urodinamica senza fattori di rischio: EAU 2026 raccomanda esplicitamente NESSUNA profilassi (evidenza forte). Considerarla solo con fattori di rischio individuali (batteriuria, cateterismo, immunodepressione) — in quel caso valutare uno schema come per l\'endourologia con manipolazione mucosa.',
    fonte: 'EAU Guidelines on Urological Infections 2026, §3.18 p.63 ("no prophylaxis" per cistoscopia/urodinamica, evidenza forte)',
    stato: STATO.CONFERMATA,
  },
  endourologico_mucosale: {
    schema: [{ farmaco: 'cefuroxime', dose: '750 mg-1.5 g', via: 'EV', timing: 'unica dose all\'induzione', durata: 'dose singola' }],
    alternativa_allergia_beta_lattamici: [{ farmaco: 'gentamicina', dose: '3-5 mg/kg', via: 'EV', timing: 'unica dose all\'induzione', durata: 'dose singola' }],
    note: 'TURP / RIRS / ureteroscopia con manipolazione mucosa: EAU 2026 raccomanda la profilassi monodose (TURP: evidenza forte; ureteroscopia: evidenza debole) ma NON un farmaco specifico. Le classi che EAU cita per l\'ureteroscopia sono: trimethoprim, TMP-SMX, cefalosporina di 2a/3a generazione, aminopenicillina+inibitore beta-lattamasi — cefuroxime (cefalosporina 2a) rientra tra queste, ma è un esempio, non l\'unica opzione corretta. Urinocoltura preoperatoria raccomandata: se positiva, trattare come IVU e rimandare l\'intervento se possibile.',
    fonte: 'EAU Guidelines on Urological Infections 2026, §3.18 p.63 (indicazione sì/no e classi per ureteroscopia; nessun farmaco specifico raccomandato dal panel)',
    stato: STATO.BOZZA,
  },
  pcnl: {
    schema: [{ farmaco: 'cefuroxime', dose: '1.5 g', via: 'EV', timing: 'unica dose all\'induzione', durata: 'dose singola, valutare prosecuzione se drenaggio prolungato' }],
    alternativa_allergia_beta_lattamici: [{ farmaco: 'gentamicina', dose: '3-5 mg/kg', via: 'EV', timing: 'unica dose all\'induzione', durata: 'dose singola' }],
    note: 'PCNL: EAU 2026 raccomanda profilassi monodose con evidenza forte, ma senza indicare un farmaco specifico (stesso motivo dell\'endourologia sopra: eterogeneità di resistenze in Europa). Urinocoltura preoperatoria obbligatoria: se positiva, trattamento mirato completo prima dell\'intervento, non solo profilassi.',
    fonte: 'EAU Guidelines on Urological Infections 2026, §3.18 p.63 (PCNL: profilassi monodose, evidenza forte; nessun farmaco specifico raccomandato)',
    stato: STATO.BOZZA,
  },
  biopsia_prostatica: {
    schema: [{ farmaco: 'cotrimoxazolo', dose: '160/800 mg x2/die', via: 'orale', timing: 'iniziare il giorno prima, proseguire 1-3 giorni', durata: '1-3 giorni (variabile secondo protocollo locale)' }],
    alternativa_allergia_beta_lattamici: null,
    note: '⚠️ I FLUOROCHINOLONI SONO VIETATI per la profilassi di questa procedura (restrizione EMA 2019, confermata da EAU 2026) — non usare ciprofloxacina/levofloxacina qui, indipendentemente dall\'antibiogramma di un episodio precedente. EAU 2026 raccomanda: preparazione rettale con povidone-iodio PRIMA della biopsia, più un approccio "culture-directed" (tampone rettale preoperatorio, profilassi mirata sul suo antibiogramma) oppure profilassi "augmented" (2+ classi diverse) quando il tampone non è disponibile. Lo schema con cotrimoxazolo qui è un esempio di singola classe non-fluorochinolonica, NON uno schema "augmented" — se possibile preferire il tampone rettale preoperatorio. Nota EAU: la fosfomicina trometamolo per questa indicazione è stata ritirata in Germania per dati farmacocinetici insufficienti e un RCT svedese è stato interrotto precocemente per eccesso di ricoveri nel braccio fosfomicina — non usarla come alternativa di routine qui senza verifica. Valutare fortemente la via transperineale (vedi voce dedicata), approccio di prima scelta secondo EAU 2026.',
    fonte: 'EAU Guidelines on Urological Infections 2026, §3.18 p.63 (divieto fluorochinoloni, preparazione rettale, approccio culture-directed/augmented)',
    stato: STATO.BOZZA,
  },
  biopsia_transperineale: {
    schema: [{ farmaco: 'nessuna profilassi sistemica di routine', dose: '-', via: '-', timing: '-', durata: '-' }],
    alternativa_allergia_beta_lattamici: null,
    note: 'La via transperineale è l\'approccio di PRIMA SCELTA secondo EAU 2026 (riduce il rischio infettivo rispetto alla transrettale); la profilassi è omissibile se nessun fattore di rischio individuale. Valutare comunque il rischio individuale (fattori di rischio, colonizzazioni note).',
    fonte: 'EAU Guidelines on Urological Infections 2026, §3.18 p.63 (transperineale: prima scelta, profilassi omissibile senza fattori di rischio)',
    stato: STATO.CONFERMATA,
  },
  chirurgia_maggiore_pulita: {
    schema: [{ farmaco: 'cefazolina', dose: '1-2 g', via: 'EV', timing: 'unica dose all\'induzione, ripetere se intervento >4h', durata: 'dose singola +/- una ripetizione' }],
    alternativa_allergia_beta_lattamici: [{ farmaco: 'vancomicina', dose: '15 mg/kg', via: 'EV', timing: 'infusione lenta prima dell\'induzione', durata: 'dose singola' }],
    note: '⚠️ EAU 2026 dichiara esplicitamente "evidenza insufficiente per raccomandare pro o contro" la profilassi per nefrectomia/prostatectomia — questo NON è quindi uno schema EAU. Lo schema qui (cefazolina monodose) segue invece la profilassi chirurgica generale per "clean surgery" (Mandell-Douglas-Bennett, cap. 317, tabella basata su Bratzler et al. 2013), applicata per analogia alla chirurgia maggiore pulita urologica.',
    fonte: 'Mandell, Douglas, and Bennett\'s Principles and Practice of Infectious Diseases, cap. 317, tabella di profilassi chirurgica generale (Bratzler et al. 2013) — NON EAU, vedi nota',
    stato: STATO.BOZZA,
  },
  chirurgia_maggiore_intestino: {
    schema: [{ farmaco: 'cefuroxime + metronidazolo', dose: 'cefuroxime 1.5 g + metronidazolo 500 mg', via: 'EV', timing: 'unica dose all\'induzione', durata: 'dose singola, valutare prosecuzione 24h se rischio alto' }],
    alternativa_allergia_beta_lattamici: [{ farmaco: 'gentamicina + metronidazolo', dose: 'gentamicina 3-5 mg/kg + metronidazolo 500 mg', via: 'EV', timing: 'unica dose all\'induzione', durata: 'dose singola' }],
    note: 'Cistectomia con derivazione intestinale: copertura anaerobia aggiuntiva necessaria per l\'apertura del lume intestinale. Non trovata una voce EAU specifica per la cistectomia in questa ricerca: schema basato sul principio generale di profilassi chirurgica colo-rettale (copertura anaerobia), non su una tabella EAU dedicata.',
    fonte: 'Principio generale di profilassi chirurgica per apertura del lume intestinale (Mandell-Douglas-Bennett, cap. 317) — nessuna voce EAU specifica trovata per la cistectomia',
    stato: STATO.BOZZA,
  },
  impianto: {
    schema: [{ farmaco: 'vancomicina + gentamicina', dose: 'vancomicina 15 mg/kg + gentamicina 3-5 mg/kg', via: 'EV', timing: 'infusione vancomicina completata prima dell\'incisione, gentamicina all\'induzione', durata: 'dose singola, valutare irrigazione intraoperatoria con soluzione antibiotica' }],
    alternativa_allergia_beta_lattamici: null,
    note: '⚠️ LACUNA IMPORTANTE, priorità alta per la validazione col relatore: né EAU 2026 (nessuna menzione di "penile prosthesis"/"artificial urinary sphincter" in tutto il documento, verificato con ricerca full-text), né Kucers, né Mandell-Douglas-Bennett coprono specificamente la profilassi per protesi peniena/AUS. Mandell ha solo una tabella generica di profilassi chirurgica (Bratzler et al. 2013) che per "placement of prosthetic material" suggerisce piuttosto cefazolina ± aminoglicoside — uno schema più stretto di quello qui presente. Lo schema vancomicina+gentamicina riportato in questa app proviene verosimilmente da letteratura urologica specialistica (tipo AUA/SUFU) NON verificata nelle tre fonti consultate finora: copertura per stafilococchi (inclusi MRSA/coag-negativi, alto costo di un\'infezione di impianto) e Gram-negativi. Verificare protocollo locale, colonizzazioni note (screening MRSA se disponibile) e — dato che questo è il tema della tesi — la fonte urologica specifica prima di usarlo clinicamente.',
    fonte: 'NON verificato in EAU 2026 / Kucers / Mandell-Douglas-Bennett (ricerca 2026-08-23) — fonte originaria da identificare, verosimilmente linee guida urologiche specialistiche (AUA/SUFU) non ancora consultate',
    stato: STATO.BOZZA,
  },
  non_gestito: {
    raccomandazione: null,
    nota: 'Procedura non in lista: nessuna raccomandazione automatica. Valutazione clinica manuale.',
  },
};

// ---------------------------------------------------------------------
// Terapia empirica/mirata per sindrome clinica (usata per i casi
// ambulatoriali, con o senza antibiogramma disponibile)
// ---------------------------------------------------------------------
const TERAPIA_SINDROME = {
  asintomatica: {
    raccomandazione: 'NON TRATTARE',
    note: 'La batteriuria asintomatica non va trattata, salvo eccezioni: gravidanza (evidenza debole nonostante grading storico 1a — gli studi disponibili sono perlopiù anni \'60-\'80, uno studio più recente e di qualità migliore ridimensiona il beneficio), oppure prima di una procedura urologica con rischio di sanguinamento/trauma mucosale (evidenza forte, vedi scheda "intervento"). Fuori da queste eccezioni il trattamento è definito "harmful" da EAU nelle IVU ricorrenti, non solo inutile. Confermato con evidenza forte anche da Mandell-Douglas-Bennett (cap. 74): sconsigliate anche le urinocolture preoperatorie di routine fuori dalla chirurgia urologica.',
    fonte: 'EAU Guidelines on Urological Infections 2026, §3.3.7 p.15; Mandell-Douglas-Bennett, cap. 74 p.1243-1247 (doppia fonte concordante)',
    stato: STATO.CONFERMATA,
  },
  cistite_non_complicata: {
    prima_linea: [
      { farmaco: 'fosfomicina', dose: '3 g', via: 'orale', timing: 'dose singola', durata: 'dose singola' },
      { farmaco: 'nitrofurantoina', dose: '100 mg x2/die', via: 'orale', timing: '-', durata: '5 giorni' },
    ],
    seconda_linea: [
      { farmaco: 'cotrimoxazolo', dose: '160/800 mg x2/die', via: 'orale', timing: '-', durata: '3 giorni', condizione: 'solo se resistenza locale <20%' },
    ],
    note: 'Preferire sempre il farmaco a spettro più stretto attivo, secondo antibiogramma se disponibile. Evitare fluorochinoloni in prima linea per cistite non complicata (restrizione EMA 2019). Amoxicillina/amoxi-clav NON raccomandate per empirismo: EAU la sconsiglia per "collateral damage" ecologico, Mandell la definisce "not recommended" per resistenza elevata ed efficacia scarsa (non solo seconda linea). Nell\'uomo: nitrofurantoina solo se esclusa localizzazione prostatica (EAU p.20).',
    fonte: 'EAU Guidelines on Urological Infections 2026 p.19-20; Mandell-Douglas-Bennett, Tabella 74.3 (allineata a IDSA 2011/2025) — piena concordanza tra le due fonti',
    stato: STATO.CONFERMATA,
  },
  ivu_complicata: {
    prima_linea: [
      { farmaco: 'ceftriaxone', dose: '1-2 g/die', via: 'EV (o IM)', timing: '-', durata: '7 giorni nei pazienti responder, poi step-down orale su antibiogramma' },
      { farmaco: 'ciprofloxacina', dose: '500-750 mg x2/die', via: 'orale', timing: '-', durata: '5-7 giorni nei pazienti responder', condizione: 'solo se germe sensibile documentato; ambulatoriale: anche levofloxacina 500 mg/die' },
    ],
    note: 'IVU complicata/pielonefrite: durata aggiornata secondo IDSA 2025 (via Mandell) a 5-7 giorni (fluorochinolone) o 7 giorni (non-fluorochinolone) nei pazienti che rispondono clinicamente — più corta delle vecchie 10-14 giorni. ECCEZIONI che allungano la durata: catetere a permanenza, immunocompromissione, ascesso, ostruzione completa non risolta, paziente chirurgico, e soprattutto prostatite batterica acuta (10-14 giorni). ⚠️ Nitrofurantoina, fosfomicina orale e pivmecillinam sono CONTROINDICATI per la pielonefrite ("Do not use", EAU p.28-29) — non usarli qui anche se compaiono nello schema di cistite non complicata. EV/ricovero: alternative equivalenti sono aminoglicoside (± ampicillina), cefalosporina ad ampio spettro, o piperacillina-tazobactam; ceftolozano-tazobactam/ceftazidime-avibactam per ceppi resistenti (non in lista in questa app). Considerare ricovero se instabilità clinica, vomito, sospetta ostruzione.',
    fonte: 'EAU Guidelines on Urological Infections 2026, Tabelle 5-6 p.28-29; Mandell-Douglas-Bennett cap. 74 (algoritmo IDSA 2025 a 4 step: gravità, rischio di resistenza, controindicazioni, antibiogramma locale)',
    stato: STATO.BOZZA,
  },
  urosepsi: {
    prima_linea: [
      { farmaco: 'piperacillina-tazobactam', dose: '4.5 g x3-4/die', via: 'EV', timing: '-', durata: 'da rivalutare su clinica e antibiogramma' },
      { farmaco: 'ceftazidime', dose: '2 g x3/die', via: 'EV', timing: '-', durata: 'da rivalutare su clinica e antibiogramma', condizione: 'opzione di pari rango secondo IDSA 2025 (cefalosporina ad ampio spettro)' },
      { farmaco: 'ciprofloxacina', dose: '400 mg x2/die', via: 'EV', timing: '-', durata: 'da rivalutare su clinica e antibiogramma', condizione: 'opzione di pari rango secondo IDSA 2025, solo se germe sensibile documentato' },
      { farmaco: 'meropenem', dose: '1 g x3/die', via: 'EV', timing: '-', durata: 'da rivalutare su clinica e antibiogramma', condizione: 'se sospetto ESBL/MDR o shock settico' },
    ],
    note: '⚠️ LACUNA nella fonte primaria: la sezione 3.9 "Urosepsis" di EAU 2026 è vuota ("under review, updated version will be published in the 2027 edition"; rimanda alla Surviving Sepsis Campaign 2021, non consultata in questa ricerca) — EAU non fornisce quindi uno schema terapeutico proprio per l\'urosepsi in questa edizione. Mandell-Douglas-Bennett colma parzialmente il vuoto (basato su IDSA 2025): nota terminologica, "urosepsi" non andrebbe più usato in documentazione clinica (non è sinonimo di sepsi ai fini della codifica), preferire "sepsi secondaria a pielonefrite/prostatite". Le 4 classi empiriche (cefalosporina ampio spettro, carbapenemico, piperacillina-tazobactam, fluorochinolone) sono di PARI RANGO secondo IDSA 2025 — non solo piperacillina-tazobactam/meropenem come nella versione precedente di questa scheda. Antibiogramma locale richiesto con soglia di copertura ≥80-90% secondo gravità solo se sepsi/shock settico documentati. Escalation empirica, poi de-escalation su antibiogramma appena disponibile. Ricovero, escludere e trattare ostruzione delle vie urinarie (drenaggio urgente se presente).',
    fonte: 'EAU Guidelines on Urological Infections 2026 §3.9 p.35 (sezione vuota, rimanda a Surviving Sepsis Campaign 2021); Mandell-Douglas-Bennett p.1238 (nota terminologica) e cap. 74 (algoritmo IDSA 2025) — fonte più aggiornata reperita per questa sindrome',
    stato: STATO.BOZZA,
  },
};

// ---------------------------------------------------------------------
// Ordine di preferenza per la scelta del farmaco più stretto attivo,
// quando è disponibile un antibiogramma con più farmaci sensibili.
// Più basso = spettro più stretto / preferito.
// ---------------------------------------------------------------------
const ORDINE_SPETTRO = [
  'nitrofurantoina', 'fosfomicina', 'amox_clav', 'cefazolina', 'cefuroxime',
  'cotrimoxazolo', 'cefixime', 'ciprofloxacina', 'levofloxacina',
  'ceftriaxone', 'ceftazidime', 'pip_tazo', 'ertapenem', 'meropenem',
  'gentamicina', 'amikacina', 'vancomicina', 'teicoplanina', 'linezolid',
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STATO, ORGANISMI, ANTIBIOTICI, CLASSI_ANTIBIOTICI, GRAVITA_ALLERGIA,
    FAMIGLIE_BETA_LATTAMICHE, NOTA_CROSS_REATTIVITA_BETA_LATTAMICI,
    SINDROMI, PROCEDURE, SINDROME_REQUISITO_TESSUTALE, PROFILASSI_RULES,
    TERAPIA_SINDROME, ORDINE_SPETTRO,
  };
}
