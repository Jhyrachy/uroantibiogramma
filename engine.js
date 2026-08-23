/*
 * Motore di raccomandazione — logica pura, nessun contenuto clinico qui
 * (vive tutto in rules.js). Prende in input contesto paziente + eventuale
 * antibiogramma e restituisce una lista di raccomandazioni con avvisi.
 *
 * Principio: questo motore non "inventa" nulla, applica solo le regole di
 * rules.js e segnala sempre fonte + stato (bozza/confermata) + eventuali
 * avvisi di sicurezza. Nessuna correzione silenziosa di dati anomali.
 */

function calcolaClearanceCreatinina({ eta, peso_kg, sesso, creatinina_mg_dl }) {
  if (!eta || !peso_kg || !creatinina_mg_dl) return null;
  const fattore = sesso === 'F' ? 0.85 : 1;
  const clcr = ((140 - eta) * peso_kg * fattore) / (72 * creatinina_mg_dl);
  return Math.round(clcr * 10) / 10;
}

function classificaFunzioneRenale(clcr) {
  if (clcr == null) return null;
  if (clcr >= 60) return 'normale';
  if (clcr >= 30) return 'moderatamente_ridotta';
  if (clcr >= 15) return 'severamente_ridotta';
  return 'insufficienza_grave';
}

function elencoAllergie(contesto) {
  return (contesto.allergie && Array.isArray(contesto.allergie.elenco)) ? contesto.allergie.elenco : [];
}

/**
 * Confronta un farmaco candidato con l'elenco di allergie dichiarate.
 * Ritorna null se non c'è alcun rapporto, altrimenti un oggetto che
 * descrive il livello del match:
 *   'molecola_esatta'          — il farmaco stesso è l'allergene dichiarato
 *   'classe_esatta'             — l'intera classe del farmaco è dichiarata allergica
 *   'cross_famiglia_beta_lattamica' — allergia dichiarata su un'ALTRA classe
 *                                     della famiglia beta-lattamica (penicillina/
 *                                     cefalosporina/carbapenemico)
 */
function trovaAllergiaPerFarmaco(antibioticoId, contesto, RULES) {
  const def = RULES.ANTIBIOTICI.find((a) => a.id === antibioticoId);
  if (!def) return null;
  const elenco = elencoAllergie(contesto);

  const molecolaEsatta = elenco.find((a) => a.tipo === 'molecola' && a.valore === antibioticoId);
  if (molecolaEsatta) return { livello: 'molecola_esatta', gravita: molecolaEsatta.gravita, allergia: molecolaEsatta };

  const classeEsatta = elenco.find((a) => a.tipo === 'classe' && a.valore === def.classe);
  if (classeEsatta) return { livello: 'classe_esatta', gravita: classeEsatta.gravita, allergia: classeEsatta };

  if (RULES.FAMIGLIE_BETA_LATTAMICHE.includes(def.classe)) {
    const crossFamiglia = elenco.find((a) => a.tipo === 'classe' && RULES.FAMIGLIE_BETA_LATTAMICHE.includes(a.valore) && a.valore !== def.classe);
    if (crossFamiglia) return { livello: 'cross_famiglia_beta_lattamica', gravita: crossFamiglia.gravita, allergia: crossFamiglia };
  }
  return null;
}

/**
 * Decide se un'allergia trovata impone l'ESCLUSIONE del farmaco (non solo
 * un avviso). Molecola/classe esatta: sempre escluso. Cross-famiglia
 * beta-lattamica: escluso solo se la reazione indice è severa_ritardata
 * (SJS/TEN, DRESS, AGEP — si evita l'intera famiglia per prassi standard).
 * Per severa_immediata o lieve la cross-famiglia genera solo un avviso:
 * la decisione di escludere l'intera famiglia dopo un'anafilassi va presa
 * dal medico, non automatizzata da qui.
 */
function escludeAllergia(match) {
  if (!match) return false;
  if (match.livello === 'molecola_esatta' || match.livello === 'classe_esatta') return true;
  if (match.livello === 'cross_famiglia_beta_lattamica' && match.gravita === 'severa_ritardata') return true;
  return false;
}

function motivoAllergia(def, match) {
  if (match.livello === 'molecola_esatta') {
    return `allergia dichiarata proprio a ${def.nome} (gravità: ${match.gravita})`;
  }
  if (match.livello === 'classe_esatta') {
    return `allergia dichiarata all'intera classe "${def.classe}" a cui appartiene ${def.nome} (gravità: ${match.gravita})`;
  }
  return `reazione severa ritardata (SJS/TEN, DRESS, AGEP) dichiarata su un'altra classe beta-lattamica: per prassi si evita l'intera famiglia, incluso ${def.nome}`;
}

function avvisiFarmaco(antibioticoId, contesto, RULES) {
  const avvisi = [];
  const def = RULES.ANTIBIOTICI.find((a) => a.id === antibioticoId);
  if (!def) return avvisi;

  if (def.aggiustamento_renale) {
    const clcr = calcolaClearanceCreatinina(contesto);
    if (clcr != null && clcr < 60) {
      avvisi.push(`Funzione renale ridotta (ClCr stimata ${clcr} ml/min): verificare aggiustamento posologico per ${def.nome}.`);
    } else if (clcr == null) {
      avvisi.push(`${def.nome} richiede eventuale aggiustamento in insufficienza renale: dati antropometrici/creatinina non inseriti, verificare manualmente.`);
    }
  }

  const match = trovaAllergiaPerFarmaco(antibioticoId, contesto, RULES);
  if (match && match.livello === 'cross_famiglia_beta_lattamica' && !escludeAllergia(match)) {
    const forte = match.gravita === 'severa_immediata';
    avvisi.push(
      `${forte ? '⚠️ ' : ''}Allergia dichiarata a un'altra classe beta-lattamica (${match.allergia.valore}, gravità: ${match.gravita}): ` +
      `${def.nome} appartiene comunque alla famiglia beta-lattamica (classe: ${def.classe}). ${RULES.NOTA_CROSS_REATTIVITA_BETA_LATTAMICI}.` +
      (forte ? ' Reazione indice severa e immediata: valutazione allergologica/anestesiologica PRIMA della somministrazione, non procedere solo su questa indicazione.' : '')
    );
  } else if (match && escludeAllergia(match)) {
    // Non dovrebbe arrivare qui se il chiamante ha già filtrato i candidati,
    // ma se capita (es. schema di profilassi non filtrato) lo segnaliamo forte.
    avvisi.push(`⚠️ ESCLUDERE: ${motivoAllergia(def, match)}.`);
  }

  return avvisi;
}

/**
 * Dati un elenco di {antibioticoId, ...} con `def` già risolto, separa
 * quelli da escludere per allergia da quelli ammissibili, con motivo.
 */
function filtraPerAllergie(candidatiConDef, contesto, RULES) {
  const ammessi = [];
  const esclusi = [];
  candidatiConDef.forEach((c) => {
    const match = trovaAllergiaPerFarmaco(c.def.id, contesto, RULES);
    if (match && escludeAllergia(match)) {
      esclusi.push({ ...c, motivoAllergia: motivoAllergia(c.def, match) });
    } else {
      ammessi.push(c);
    }
  });
  return { ammessi, esclusi };
}

function trovaAntibioticoPerNomeLibero(nomeLibero, ANTIBIOTICI) {
  return ANTIBIOTICI.find((a) => nomeLibero.toLowerCase().includes(a.nome.toLowerCase()) || a.nome.toLowerCase().includes(nomeLibero.toLowerCase()));
}

function raccomandaProfilassi(procedureId, contesto, RULES) {
  const proc = RULES.PROCEDURE.find((p) => p.id === procedureId);
  if (!proc) return { errore: 'Procedura non riconosciuta.' };

  const regola = RULES.PROFILASSI_RULES[proc.categoria];
  if (!regola || regola.raccomandazione === null) {
    return {
      procedura: proc.nome,
      raccomandazione: null,
      nota: regola ? regola.nota : 'Nessuna regola disponibile per questa procedura.',
    };
  }

  const schemaEscluso = (schema) => schema.some((s) => {
    const match = trovaAntibioticoPerNomeLibero(s.farmaco, RULES.ANTIBIOTICI);
    if (!match) return false;
    const allergiaMatch = trovaAllergiaPerFarmaco(match.id, contesto, RULES);
    return escludeAllergia(allergiaMatch);
  });

  const principaleEscluso = schemaEscluso(regola.schema);
  const alternativaDisponibile = !!regola.alternativa_allergia_beta_lattamici;
  const usaAlternativa = principaleEscluso && alternativaDisponibile;

  const schema = usaAlternativa ? regola.alternativa_allergia_beta_lattamici : regola.schema;
  const avvisi = [];

  if (principaleEscluso && !alternativaDisponibile) {
    avvisi.push('⚠️ Lo schema di profilassi standard contiene un farmaco da escludere per allergia dichiarata e non è definita un\'alternativa in questa app: valutazione manuale del regime prima dell\'intervento.');
  } else if (usaAlternativa) {
    avvisi.push('Schema alternativo selezionato: quello standard conteneva un farmaco da escludere per allergia dichiarata.');
  }

  schema.forEach((s) => {
    const match = trovaAntibioticoPerNomeLibero(s.farmaco, RULES.ANTIBIOTICI);
    if (match) avvisi.push(...avvisiFarmaco(match.id, contesto, RULES));
  });

  return {
    procedura: proc.nome,
    schema,
    note: regola.note,
    fonte: regola.fonte,
    stato: regola.stato,
    avvisi,
  };
}

function raccomandaSindrome(sindromeId, contesto, RULES) {
  const regola = RULES.TERAPIA_SINDROME[sindromeId];
  if (!regola) return { errore: 'Sindrome non riconosciuta.' };

  if (regola.raccomandazione === 'NON TRATTARE') {
    return { raccomandazione: 'NON TRATTARE', note: regola.note, fonte: regola.fonte, stato: regola.stato, avvisi: [] };
  }

  const avvisi = [];
  const esclusiTotali = [];

  const filtraLinea = (elenco) => {
    const risultato = [];
    (elenco || []).forEach((s) => {
      const match = trovaAntibioticoPerNomeLibero(s.farmaco, RULES.ANTIBIOTICI);
      if (match) {
        const allergiaMatch = trovaAllergiaPerFarmaco(match.id, contesto, RULES);
        if (escludeAllergia(allergiaMatch)) {
          esclusiTotali.push({ farmaco: s.farmaco, motivo: motivoAllergia(match, allergiaMatch) });
          return; // escluso, non entra nella linea terapeutica
        }
        avvisi.push(...avvisiFarmaco(match.id, contesto, RULES));
      }
      risultato.push(s);
    });
    return risultato;
  };

  const primaLinea = filtraLinea(regola.prima_linea);
  const secondaLinea = filtraLinea(regola.seconda_linea);

  if (esclusiTotali.length) {
    avvisi.push(...esclusiTotali.map((e) => `⚠️ Escluso per allergia: ${e.farmaco} — ${e.motivo}.`));
  }
  if (primaLinea.length === 0 && (regola.prima_linea || []).length > 0) {
    avvisi.push('⚠️ Tutte le opzioni di prima linea sono state escluse per allergia dichiarata: valutazione infettivologica prima di trattare.');
  }

  return {
    prima_linea: primaLinea,
    seconda_linea: secondaLinea,
    note: regola.note,
    fonte: regola.fonte,
    stato: regola.stato,
    avvisi,
  };
}

/**
 * Determina quale distretto tissutale la terapia deve raggiungere,
 * combinando procedura selezionata e sindrome clinica. La procedura ha
 * priorità se compilata e diversa da "nessuno"/"altro"; altrimenti si usa
 * la sindrome.
 */
function determinaRequisitoTessutale(proceduraId, sindromeId, RULES) {
  const proc = RULES.PROCEDURE.find((p) => p.id === proceduraId);
  if (proc && proc.requisito_tessutale) return { distretto: proc.requisito_tessutale, origine: `intervento: ${proc.nome}` };
  const daSindrome = RULES.SINDROME_REQUISITO_TESSUTALE[sindromeId];
  if (daSindrome) {
    const s = RULES.SINDROMI.find((x) => x.id === sindromeId);
    return { distretto: daSindrome, origine: `sindrome: ${s ? s.nome : sindromeId}` };
  }
  return { distretto: null, origine: null };
}

/**
 * Data una lista di risultati antibiogramma [{antibioticoId, esito: 'S'|'I'|'R'}],
 * sceglie il farmaco sensibile più adatto. Non è una semplice tabella di
 * corrispondenza: applica in sequenza TRE vincoli distinti —
 *   1) sensibilità in vitro (dall'antibiogramma)
 *   2) nessuna controindicazione per allergia (molecola/classe/famiglia,
 *      vedi trovaAllergiaPerFarmaco) — vincolo di sicurezza, sempre prima
 *   3) capacità di raggiungere il distretto richiesto dal contesto clinico
 *      (es. prostata per una TURP, rene per una pielonefrite) —
 * e solo tra i farmaci che soddisfano tutti e tre sceglie quello a
 * spettro più stretto (con una preferenza leggera per la categoria WHO
 * AWaRe "Access" quando esiste un'alternativa equivalente). I farmaci
 * esclusi in ciascun passaggio restano visibili con la motivazione, non
 * vengono nascosti.
 *
 * Non decide da sola la sindrome clinica o la procedura: quelle sono
 * sempre scelte dal medico allo step 1.
 */
function scegliDaAntibiogramma(risultati, contesto, proceduraId, sindromeId, RULES) {
  if (!risultati || risultati.length === 0) {
    return { errore: 'Nessun risultato di antibiogramma inserito.' };
  }

  const sensibili = risultati.filter((r) => r.esito === 'S');
  const resistenti = risultati.filter((r) => r.esito === 'R');

  if (sensibili.length === 0) {
    return {
      raccomandazione: null,
      avvisi: ['Nessun antibiotico testato risulta sensibile (S) in questo antibiogramma: possibile pan-resistenza o dati incompleti. Valutazione infettivologica.'],
      resistenti: resistenti.map((r) => r.antibioticoId),
    };
  }

  const requisito = determinaRequisitoTessutale(proceduraId, sindromeId, RULES);
  const avvisi = [];

  const conDefinizione = sensibili
    .map((r) => ({ ...r, def: RULES.ANTIBIOTICI.find((a) => a.id === r.antibioticoId) }))
    .filter((r) => r.def);

  // Vincolo 1: allergia — è un vincolo di sicurezza, si applica per primo
  // e senza eccezioni sull'elenco completo dei sensibili.
  const { ammessi: dopoAllergia, esclusi: esclusiPerAllergia } = filtraPerAllergie(conDefinizione, contesto, RULES);

  if (dopoAllergia.length === 0) {
    return {
      raccomandazione: null,
      avvisi: [
        '⚠️ Tutti i farmaci sensibili in vitro sono esclusi per allergia dichiarata (a livello di molecola, classe o famiglia beta-lattamica). Valutazione allergologica/infettivologica prima di trattare.',
      ],
      esclusi_per_allergia: esclusiPerAllergia.map((r) => ({ farmaco: r.def.nome, motivo: r.motivoAllergia })),
    };
  }

  // Vincolo 2: penetrazione tissutale nel distretto richiesto.
  let candidati = dopoAllergia;
  let esclusiPerPenetrazione = [];
  let filtratoPerPenetrazione = false;

  if (requisito.distretto) {
    const idonei = dopoAllergia.filter((r) => r.def.penetrazione && r.def.penetrazione[requisito.distretto] === 'buona');
    esclusiPerPenetrazione = dopoAllergia.filter((r) => !idonei.includes(r));
    if (idonei.length > 0) {
      candidati = idonei;
      filtratoPerPenetrazione = true;
    } else {
      avvisi.push(
        `Nessuno dei farmaci sensibili e non esclusi per allergia ha buona penetrazione nel distretto richiesto (${requisito.distretto}, per ${requisito.origine}). ` +
        `La sensibilità in vitro non garantisce efficacia clinica in questo caso: valutazione infettivologica/urologica prima di trattare, considerare terapia combinata o via sistemica ad alte dosi.`
      );
      esclusiPerPenetrazione = [];
    }
  }

  const ordinati = candidati
    .map((r) => ({ ...r, rango: RULES.ORDINE_SPETTRO.indexOf(r.antibioticoId) }))
    .sort((a, b) => (a.rango === -1 ? 999 : a.rango) - (b.rango === -1 ? 999 : b.rango));

  const scelto = ordinati[0];
  avvisi.push(...avvisiFarmaco(scelto.antibioticoId, contesto, RULES));

  if (filtratoPerPenetrazione) {
    avvisi.push(`Farmaco scelto perché sensibile in vitro, senza controindicazione allergica e con buona penetrazione nel distretto richiesto (${requisito.distretto}, per ${requisito.origine}).`);
  }

  if (scelto.def.aware && scelto.def.aware !== 'Access') {
    const alternativaAccess = ordinati.slice(1).find((r) => r.def.aware === 'Access');
    if (alternativaAccess) {
      avvisi.push(`Nota di stewardship (OMS AWaRe): ${scelto.def.nome} è in categoria "${scelto.def.aware}". Se clinicamente equivalente, valutare ${alternativaAccess.def.nome} (categoria "Access") tra le alternative sensibili.`);
    }
  }

  if (resistenti.length >= 3) {
    avvisi.push(`Resistenza a ${resistenti.length} antibiotici testati: pattern compatibile con multi-resistenza (MDR/ESBL). Considerare valutazione infettivologica anche se un farmaco risulta sensibile e a buona penetrazione.`);
  }

  const formattaConMic = (r) => r.def.nome + (r.mic ? ` (MIC ${r.mic} mg/L)` : '');

  if (risultati.some((r) => r.mic)) {
    avvisi.push('I valori di MIC inseriti sono mostrati come riferimento grezzo: l\'app non applica breakpoint EUCAST/CLSI per interpretarli automaticamente (non ha una tabella di breakpoint per organismo+farmaco). La categoria S/I/R inserita resta l\'unico criterio usato dal motore — un MIC vicino al breakpoint di resistenza va valutato clinicamente anche se il referto lo classifica "S".');
  }

  return {
    scelto: scelto.def.nome,
    micScelto: scelto.mic || null,
    aware: scelto.def.aware,
    distretto_richiesto: requisito.distretto,
    origine_requisito: requisito.origine,
    alternative: ordinati.slice(1).map(formattaConMic),
    esclusi_per_allergia: esclusiPerAllergia.map((r) => ({ farmaco: r.def.nome, motivo: r.motivoAllergia })),
    esclusi_per_penetrazione: esclusiPerPenetrazione.map((r) => ({
      farmaco: r.def.nome,
      motivo: `sensibile in vitro (e non escluso per allergia) ma penetrazione ${r.def.penetrazione ? (r.def.penetrazione[requisito.distretto] || 'non nota') : 'non nota'} nel distretto "${requisito.distretto}"`,
    })),
    avvisi,
    fonte: 'Selezione automatica: incrocio tra sensibilità dell\'antibiogramma, sicurezza allergica e penetrazione tissutale nel distretto richiesto dal contesto clinico (criterio farmacologico generale, non da singola linea guida) — verificare sempre clinicamente.',
    stato: 'bozza',
  };
}

/**
 * Confronta una MIC inserita con il breakpoint EUCAST (solo copertura
 * "pulita", vedi rules.js) per un germe+farmaco+distretto, e valuta se
 * l'esito S/I/R inserito manualmente è coerente. Non decide nulla da
 * sola: ritorna solo `disponibile: false` se manca un dato qualsiasi
 * (germe non mappato, farmaco non coperto, contesto senza breakpoint
 * pulito, MIC non inserita/non numerica) — mai un valore inventato.
 */
function valutaBreakpoint(organismo, antibioticoId, distretto, mic, esito, RULES) {
  const tabella = RULES.BREAKPOINT_EUCAST[antibioticoId];
  if (!tabella || !organismo || !tabella[organismo]) return { disponibile: false };
  const contesto = distretto === 'urina' ? 'uti' : 'sistemico';
  const entry = tabella[organismo][contesto];
  if (!entry) return { disponibile: false };
  if (mic == null || mic === '') return { disponibile: false };
  const micNum = parseFloat(String(mic).replace(/[<>=]/g, ''));
  if (Number.isNaN(micNum)) return { disponibile: false };

  const atteso = micNum <= entry.s ? 'S' : (micNum > entry.r ? 'R' : 'I');
  const fragile = atteso === 'S' && micNum >= entry.r / 2;

  return {
    disponibile: true,
    atteso,
    coerente: esito ? atteso === esito : null,
    fragile,
    s: entry.s,
    r: entry.r,
    contesto,
  };
}

/**
 * Applica valutaBreakpoint a tutti i risultati dell'antibiogramma che
 * hanno una MIC inserita, e ritorna solo quelli con qualcosa da
 * segnalare: esito incoerente col breakpoint (possibile errore di
 * trascrizione, o resistenza non spiegata dalla sola MIC) oppure "S"
 * fragile (MIC vicina alla soglia di resistenza). Silenzioso — nessun
 * avviso — per tutto il resto, incluse le combinazioni non coperte.
 */
function controllaCoerenzaBreakpoint(risultati, organismo, distretto, RULES) {
  const esiti = [];
  (risultati || []).forEach((r) => {
    if (!r.mic) return;
    const def = RULES.ANTIBIOTICI.find((a) => a.id === r.antibioticoId);
    if (!def) return;
    const v = valutaBreakpoint(organismo, r.antibioticoId, distretto, r.mic, r.esito, RULES);
    if (!v.disponibile) return;
    const contestoLabel = v.contesto === 'uti' ? 'cistite non complicata' : 'infezione di origine urinaria (non solo cistite semplice)';
    if (v.coerente === false) {
      esiti.push({
        farmaco: def.nome,
        livello: 'incoerente',
        messaggio: `MIC ${r.mic} mg/L con breakpoint EUCAST S≤${v.s}/R>${v.r} mg/L (${organismo}, ${contestoLabel}) corrisponderebbe a "${v.atteso}", ma è stato inserito "${r.esito}". Verificare: possibile errore di trascrizione dal referto, oppure meccanismo di resistenza non riflesso dal solo valore di MIC.`,
      });
    } else if (v.fragile) {
      esiti.push({
        farmaco: def.nome,
        livello: 'fragile',
        messaggio: `MIC ${r.mic} mg/L vicina alla soglia di resistenza EUCAST (S≤${v.s}/R>${v.r} mg/L, ${organismo}): "S" formalmente corretto ma con margine ridotto, più a rischio di fallimento clinico di un "S" con MIC bassa.`,
      });
    }
  });
  return esiti;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calcolaClearanceCreatinina,
    classificaFunzioneRenale,
    raccomandaProfilassi,
    raccomandaSindrome,
    scegliDaAntibiogramma,
    determinaRequisitoTessutale,
    trovaAllergiaPerFarmaco,
    escludeAllergia,
    avvisiFarmaco,
    valutaBreakpoint,
    controllaCoerenzaBreakpoint,
  };
}
