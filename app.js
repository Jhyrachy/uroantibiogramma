/*
 * Wiring dell'interfaccia. Nessun dato paziente identificativo viene
 * chiesto o salvato: solo dati clinici (germe, antibiogramma, contesto).
 * Nulla viene inviato in rete — l'unica eccezione è il primo utilizzo
 * dell'OCR, che scarica il modello lingua italiana la prima volta (poi
 * resta in cache nel browser per gli usi successivi offline).
 */

const RULES = {
  STATO, ORGANISMI, ANTIBIOTICI, CLASSI_ANTIBIOTICI, GRAVITA_ALLERGIA,
  FAMIGLIE_BETA_LATTAMICHE, NOTA_CROSS_REATTIVITA_BETA_LATTAMICI,
  SINDROMI, PROCEDURE, SINDROME_REQUISITO_TESSUTALE, PROFILASSI_RULES,
  TERAPIA_SINDROME, ORDINE_SPETTRO, BREAKPOINT_EUCAST, FONTE_BREAKPOINT_EUCAST,
};

const state = {
  antibiogramma: {}, // { antibioticoId: { esito: 'S'|'I'|'R', mic: string|null } }
  allergie: [], // [{ tipo: 'molecola'|'classe', valore, gravita, note }]
  nonConfermati: new Set(), // antibioticoId compilati da OCR e non ancora toccati dall'utente
  germeNonConfermato: false,
};

function el(id) { return document.getElementById(id); }

function popolaSelect(selectEl, items, { valueKey = 'id', labelKey = 'nome' } = {}) {
  selectEl.innerHTML = '';
  items.forEach((item) => {
    const opt = document.createElement('option');
    const isStringa = typeof item === 'string';
    opt.value = isStringa ? item : item[valueKey];
    opt.textContent = isStringa ? item : item[labelKey];
    selectEl.appendChild(opt);
  });
}

function contestoCorrente() {
  return {
    eta: Number(el('eta').value) || null,
    peso_kg: Number(el('peso').value) || null,
    sesso: el('sesso').value,
    creatinina_mg_dl: Number(el('creatinina').value) || null,
    allergie: { elenco: state.allergie },
  };
}

function aggiornaClcr() {
  const ctx = contestoCorrente();
  const clcr = calcolaClearanceCreatinina(ctx);
  const out = el('clcr-out');
  if (clcr == null) {
    out.textContent = 'Inserisci età, peso, sesso e creatinina per stimare la clearance (Cockcroft-Gault).';
  } else {
    const classe = classificaFunzioneRenale(clcr);
    out.textContent = `ClCr stimata: ${clcr} ml/min (${classe.replace(/_/g, ' ')}).`;
  }
}

// ---------------------------------------------------------------------
// Allergie — lista dinamica: molecola specifica o intera classe, con
// gravità della reazione indice (determina se le altre classi
// beta-lattamiche vengono solo segnalate o escluse, vedi engine.js).
// ---------------------------------------------------------------------
function aggiornaOpzioniValoreAllergia() {
  const tipo = el('allergia-tipo').value;
  const sel = el('allergia-valore');
  if (tipo === 'molecola') {
    popolaSelect(sel, ANTIBIOTICI);
  } else {
    popolaSelect(sel, CLASSI_ANTIBIOTICI);
  }
}

function renderListaAllergie() {
  const cont = el('allergie-lista');
  if (state.allergie.length === 0) {
    cont.innerHTML = '<p class="hint">Nessuna allergia inserita.</p>';
    return;
  }
  cont.innerHTML = state.allergie.map((a, i) => {
    const nomeValore = a.tipo === 'molecola'
      ? (ANTIBIOTICI.find((x) => x.id === a.valore) || {}).nome
      : (CLASSI_ANTIBIOTICI.find((x) => x.id === a.valore) || {}).nome;
    const nomeGravita = (GRAVITA_ALLERGIA.find((g) => g.id === a.gravita) || {}).nome;
    return `<div class="allergia-item">
      <div><strong>${nomeValore || a.valore}</strong> <span class="hint">(${a.tipo === 'molecola' ? 'molecola' : 'classe'})</span></div>
      <div class="hint">${nomeGravita || a.gravita}${a.note ? ' — ' + a.note : ''}</div>
      <button type="button" class="rimuovi-allergia" data-idx="${i}">Rimuovi</button>
    </div>`;
  }).join('');
  cont.querySelectorAll('.rimuovi-allergia').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.allergie.splice(Number(btn.dataset.idx), 1);
      renderListaAllergie();
    });
  });
}

function initAllergieUi() {
  popolaSelect(el('allergia-tipo'), [{ id: 'molecola', nome: 'Molecola specifica' }, { id: 'classe', nome: 'Intera classe' }]);
  popolaSelect(el('allergia-valore'), ANTIBIOTICI);
  popolaSelect(el('allergia-gravita'), GRAVITA_ALLERGIA);
  el('allergia-tipo').addEventListener('change', aggiornaOpzioniValoreAllergia);

  el('allergia-aggiungi').addEventListener('click', () => {
    state.allergie.push({
      tipo: el('allergia-tipo').value,
      valore: el('allergia-valore').value,
      gravita: el('allergia-gravita').value,
      note: el('allergia-note').value.trim(),
    });
    el('allergia-note').value = '';
    renderListaAllergie();
  });

  renderListaAllergie();
}

// ---------------------------------------------------------------------
// Tabella antibiogramma — esito S/I/R + MIC opzionale (mg/L) per farmaco.
// ---------------------------------------------------------------------
function aggiornaAntibiogrammaDaCampi(id, sel, micInput) {
  if (sel.value) {
    state.antibiogramma[id] = { esito: sel.value, mic: micInput.value.trim() || null };
  } else if (micInput.value.trim()) {
    state.antibiogramma[id] = { esito: null, mic: micInput.value.trim() };
  } else {
    delete state.antibiogramma[id];
  }
}

function costruisciTabellaAntibiogramma() {
  const container = el('antibiogramma-table');
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Antibiotico</th><th>Esito</th><th>MIC (mg/L)</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');

  ANTIBIOTICI.forEach((ab) => {
    const tr = document.createElement('tr');
    const tdNome = document.createElement('td');
    tdNome.textContent = ab.nome;

    const tdSel = document.createElement('td');
    const sel = document.createElement('select');
    sel.dataset.antibiotico = ab.id;
    ['—', 'S', 'I', 'R'].forEach((v) => {
      const opt = document.createElement('option');
      opt.value = v === '—' ? '' : v;
      opt.textContent = v;
      sel.appendChild(opt);
    });
    tdSel.appendChild(sel);

    const tdMic = document.createElement('td');
    const micInput = document.createElement('input');
    micInput.type = 'text';
    micInput.inputMode = 'decimal';
    micInput.placeholder = '-';
    micInput.className = 'mic-input';
    micInput.dataset.antibiotico = ab.id;
    tdMic.appendChild(micInput);

    // Un vero interazione dell'utente (non l'auto-compilazione da OCR, che
    // imposta .value senza sparare questi eventi) rimuove lo stato
    // "da confermare" — vedi compilaAutomaticamenteDaOcr più sotto.
    const confermaTocco = () => {
      sel.classList.remove('auto-ocr');
      micInput.classList.remove('auto-ocr');
      state.nonConfermati.delete(ab.id);
    };
    sel.addEventListener('change', () => { confermaTocco(); aggiornaAntibiogrammaDaCampi(ab.id, sel, micInput); });
    micInput.addEventListener('input', () => { confermaTocco(); aggiornaAntibiogrammaDaCampi(ab.id, sel, micInput); });

    tr.appendChild(tdNome);
    tr.appendChild(tdSel);
    tr.appendChild(tdMic);
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.innerHTML = '';
  container.appendChild(table);
}

// ---------------------------------------------------------------------
// Compilazione automatica da testo OCR — best-effort, riga per riga:
// cerca il nome di un antibiotico e, sulla stessa riga, un esito S/I/R
// isolato e/o un valore di MIC. Imposta i campi SENZA sparare gli eventi
// change/input (li lascia con classe "auto-ocr" = non ancora confermati
// dall'utente): l'antibiogramma calcolato li usa comunque per mostrare
// subito una raccomandazione, ma un banner in cima al risultato elenca
// cosa va riverificato, ed evidenzia i campi corrispondenti in arancio.
// ---------------------------------------------------------------------
function estraiRisultatiDaOcr(testoOcr) {
  const risultati = []; // { antibioticoId, esito, mic }
  const righe = (testoOcr || '').split(/\n/);
  righe.forEach((riga) => {
    const rigaLower = riga.toLowerCase();
    ANTIBIOTICI.forEach((ab) => {
      const chiave = ab.nome.toLowerCase().split(/[-\s]/)[0];
      if (chiave.length < 4) return;
      const idx = rigaLower.indexOf(chiave);
      if (idx === -1) return;
      const resto = riga.slice(idx);
      const esitoMatch = resto.match(/\b(S|I|R)\b/);
      const micMatch = resto.match(/(?:MIC[:\s]*)?((?:[<>]=?\s?)?\d+(?:[.,]\d+)?)\s*(?:mg\/l|µg\/ml|ug\/ml)?/i);
      if (esitoMatch || micMatch) {
        risultati.push({
          antibioticoId: ab.id,
          esito: esitoMatch ? esitoMatch[1].toUpperCase() : null,
          mic: micMatch ? micMatch[1].replace(',', '.').replace(/\s/g, '') : null,
        });
      }
    });
  });
  return risultati;
}

function trovaGermeInTesto(testoOcr) {
  const testoLower = (testoOcr || '').toLowerCase();
  return ORGANISMI.find((nome) => nome !== 'Altro / non elencato' && testoLower.includes(nome.toLowerCase()));
}

function compilaAutomaticamenteDaOcr(testoOcr) {
  const trovati = estraiRisultatiDaOcr(testoOcr);
  trovati.forEach((t) => {
    const sel = document.querySelector(`#antibiogramma-table select[data-antibiotico="${t.antibioticoId}"]`);
    const micInput = document.querySelector(`#antibiogramma-table input[data-antibiotico="${t.antibioticoId}"]`);
    if (!sel || !micInput) return;
    if (t.esito) sel.value = t.esito;
    if (t.mic) micInput.value = t.mic;
    sel.classList.add('auto-ocr');
    micInput.classList.add('auto-ocr');
    state.nonConfermati.add(t.antibioticoId);
    state.antibiogramma[t.antibioticoId] = { esito: t.esito || null, mic: t.mic || null };
  });

  const germe = trovaGermeInTesto(testoOcr);
  if (germe) {
    const selGerme = el('germe');
    selGerme.value = germe;
    selGerme.classList.add('auto-ocr');
    state.germeNonConfermato = true;
  }

  return { farmaciTrovati: trovati.length, germeTrovato: !!germe };
}

function cambiaStep(n) {
  document.querySelectorAll('.step').forEach((s) => s.classList.remove('active'));
  document.querySelectorAll('.step-btn').forEach((b) => b.classList.remove('active'));
  el(`step-${n}`).classList.add('active');
  document.querySelector(`.step-btn[data-step="${n}"]`).classList.add('active');
  if (n === 2) renderRisultato();
}

function renderSchema(schema) {
  return schema.map((s) => `
    <div class="schema-item">
      <div class="farmaco">${s.farmaco}</div>
      <div>${s.dose} — ${s.via}${s.condizione ? ` <em>(${s.condizione})</em>` : ''}</div>
      <div class="hint">${s.timing || ''} · durata: ${s.durata || '-'}</div>
    </div>`).join('');
}

function renderAvvisi(avvisi) {
  return (avvisi || []).map((a) => `<div class="avviso">⚠ ${a}</div>`).join('');
}

function renderEsclusi(titolo, esclusi) {
  if (!esclusi || !esclusi.length) return '';
  return `<p class="hint"><strong>${titolo}</strong></p><ul class="hint">` +
    esclusi.map((e) => `<li>${e.farmaco} — ${e.motivo}</li>`).join('') + '</ul>';
}

function renderBannerNonConfermati() {
  if (state.nonConfermati.size === 0 && !state.germeNonConfermato) return '';
  const nomiFarmaci = [...state.nonConfermati].map((id) => (ANTIBIOTICI.find((a) => a.id === id) || {}).nome).filter(Boolean);
  const voci = [...(state.germeNonConfermato ? ['germe isolato'] : []), ...nomiFarmaci];
  return `<div class="avviso avviso-forte">⚠️ Compilati automaticamente dall'OCR e NON ANCORA CONFERMATI: ${voci.join(', ')}.
    La raccomandazione sotto li usa così come letti dall'OCR — controllali nella tabella allo step precedente
    (evidenziati in arancio) prima di fidarti di questo risultato.</div>`;
}

function renderControlloBreakpoint(controlli) {
  if (!controlli || !controlli.length) return '';
  let html = '<div class="card">';
  html += '<span class="stato-bozza">BOZZA — copertura parziale</span>';
  html += '<h3>Controllo di coerenza MIC / breakpoint EUCAST</h3>';
  html += '<p class="hint">Confronto automatico, solo dove disponibile un breakpoint EUCAST "pulito" (vedi fonte) — non copre tutti i farmaci.</p>';
  controlli.forEach((c) => {
    const cls = c.livello === 'incoerente' ? 'avviso-incoerente' : 'avviso';
    html += `<div class="${cls}">${c.livello === 'incoerente' ? '⚠️' : '⚠'} <strong>${c.farmaco}</strong> — ${c.messaggio}</div>`;
  });
  html += `<div class="fonte">Fonte: ${FONTE_BREAKPOINT_EUCAST}</div>`;
  html += '</div>';
  return html;
}

function renderRisultato() {
  const ctx = contestoCorrente();
  const proceduraId = el('procedura').value;
  const sindromeId = el('sindrome').value;
  const risultatiAntibiogramma = Object.entries(state.antibiogramma)
    .filter(([, v]) => v.esito)
    .map(([antibioticoId, v]) => ({ antibioticoId, esito: v.esito, mic: v.mic }));

  const out = el('risultato');
  let html = renderBannerNonConfermati();

  // --- Controllo di coerenza MIC/breakpoint EUCAST, se ci sono MIC inserite ---
  if (risultatiAntibiogramma.some((r) => r.mic)) {
    const germeSelezionato = el('germe').value;
    const requisito = determinaRequisitoTessutale(proceduraId, sindromeId, RULES);
    const controlli = controllaCoerenzaBreakpoint(risultatiAntibiogramma, germeSelezionato, requisito.distretto, RULES);
    html += renderControlloBreakpoint(controlli);
  }

  // --- Terapia mirata da antibiogramma, se compilato ---
  if (risultatiAntibiogramma.length > 0) {
    const r = scegliDaAntibiogramma(risultatiAntibiogramma, ctx, proceduraId, sindromeId, RULES);
    html += '<div class="card">';
    html += '<span class="stato-bozza">BOZZA — da validare</span>';
    html += '<h3>Terapia mirata (da antibiogramma)</h3>';
    if (r.errore) {
      html += `<p>${r.errore}</p>`;
    } else if (r.raccomandazione === null) {
      html += renderEsclusi('Esclusi per allergia:', r.esclusi_per_allergia);
      html += renderAvvisi(r.avvisi);
    } else {
      if (r.distretto_richiesto) {
        html += `<p class="hint">Distretto da coprire: <strong>${r.distretto_richiesto}</strong> (${r.origine_requisito}).</p>`;
      }
      html += `<div class="schema-item"><div class="farmaco">${r.scelto}${r.micScelto ? ` <span class="hint">(MIC ${r.micScelto} mg/L)</span>` : ''}${r.aware ? ` <span class="badge-aware badge-aware-${r.aware.toLowerCase()}">${r.aware}</span>` : ''}</div></div>`;
      if (r.alternative && r.alternative.length) {
        html += `<p class="hint">Altre opzioni sensibili: ${r.alternative.join(', ')}</p>`;
      }
      html += renderEsclusi('Esclusi per allergia dichiarata (pur sensibili in vitro):', r.esclusi_per_allergia);
      html += renderEsclusi('Esclusi per penetrazione insufficiente nel distretto richiesto (pur sensibili e non allergici):', r.esclusi_per_penetrazione);
      html += renderAvvisi(r.avvisi);
      html += `<div class="fonte">Fonte: ${r.fonte}</div>`;
    }
    html += '</div>';
  }

  // --- Terapia empirica per sindrome, se niente antibiogramma o sindrome != pre_procedura ---
  if (risultatiAntibiogramma.length === 0 && sindromeId !== 'pre_procedura') {
    const r = raccomandaSindrome(sindromeId, ctx, RULES);
    html += '<div class="card">';
    html += '<span class="stato-bozza">BOZZA — da validare</span>';
    html += `<h3>Terapia empirica — ${SINDROMI.find((s) => s.id === sindromeId).nome}</h3>`;
    if (r.raccomandazione === 'NON TRATTARE') {
      html += '<p><strong>Non trattare.</strong></p>';
      html += `<p class="hint">${r.note}</p>`;
    } else if (r.errore) {
      html += `<p>${r.errore}</p>`;
    } else {
      if (r.prima_linea && r.prima_linea.length) {
        html += '<p class="hint">Prima linea:</p>' + renderSchema(r.prima_linea);
      }
      if (r.seconda_linea && r.seconda_linea.length) {
        html += '<p class="hint">Seconda linea:</p>' + renderSchema(r.seconda_linea);
      }
      html += `<p class="hint">${r.note}</p>`;
      html += renderAvvisi(r.avvisi);
    }
    html += `<div class="fonte">Fonte: ${r.fonte}</div>`;
    html += '</div>';
  }

  // --- Profilassi perioperatoria, se è selezionato un intervento ---
  if (proceduraId !== 'nessuno') {
    const r = raccomandaProfilassi(proceduraId, ctx, RULES);
    html += '<div class="card">';
    html += '<span class="stato-bozza">BOZZA — da validare</span>';
    html += `<h3>Profilassi perioperatoria — ${r.procedura}</h3>`;
    if (!r.schema) {
      html += `<p class="hint">${r.nota}</p>`;
    } else {
      html += renderSchema(r.schema);
      html += `<p class="hint">${r.note}</p>`;
      html += renderAvvisi(r.avvisi);
      html += `<div class="fonte">Fonte: ${r.fonte}</div>`;
    }
    html += '</div>';
  }

  if (!html) {
    html = '<p class="hint">Nessun dato sufficiente per una raccomandazione. Torna indietro e compila almeno la sindrome clinica o l\'antibiogramma.</p>';
  }

  out.innerHTML = html;
}

// ---------------------------------------------------------------------
// OCR
// ---------------------------------------------------------------------
let ultimoFile = null;

async function eseguiOcr() {
  if (!ultimoFile) return;
  const status = el('ocr-status');
  const btn = el('ocr-run');
  btn.disabled = true;
  status.textContent = 'Inizializzazione motore OCR...';
  try {
    // Path assoluti: dentro il Web Worker, i path relativi si risolvono
    // rispetto alla posizione dello script del worker stesso (già dentro
    // lib/), non rispetto alla pagina. Usiamo inoltre la build
    // "wasm.js" autocontenuta (wasm incorporato in base64) invece della
    // coppia .js+.wasm separata: quest'ultima fa sì che il loader
    // provi a recuperare il file .wasm con un secondo fetch interno al
    // worker la cui risoluzione dell'URL falliva ("is not a valid URL")
    // anche con corePath assoluto — bug riprodotto e verificato il
    // 2026-08-23. Costo: ~1.3 MB in più per l'overhead del base64.
    const worker = await Tesseract.createWorker('ita', 1, {
      workerPath: new URL('lib/worker.min.js', document.baseURI).href,
      corePath: new URL('lib/tesseract-core-simd.wasm.js', document.baseURI).href,
      langPath: new URL('lib/lang', document.baseURI).href,
      gzip: true,
      logger: (m) => {
        if (m.status) {
          const pct = m.progress != null ? ` ${Math.round(m.progress * 100)}%` : '';
          status.textContent = `${m.status}${pct}`;
        }
      },
    });
    const { data: { text } } = await worker.recognize(ultimoFile);
    await worker.terminate();
    el('ocr-text').value = text;
    const { farmaciTrovati, germeTrovato } = compilaAutomaticamenteDaOcr(text);
    status.textContent = farmaciTrovati || germeTrovato
      ? `Estrazione completata: ${farmaciTrovati} valore/i e ${germeTrovato ? 'il germe' : 'nessun germe'} compilati automaticamente (evidenziati in arancio) — DA CONFERMARE uno per uno prima di fidarti del risultato.`
      : 'Estrazione completata, ma non ho riconosciuto automaticamente farmaci o germe nel testo: compila i campi a mano confrontandoli col testo qui sopra.';
  } catch (e) {
    status.textContent = `Errore OCR: ${e.message}. Puoi comunque compilare i campi manualmente.`;
  } finally {
    btn.disabled = false;
  }
}

function initOcrInput() {
  el('foto-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    ultimoFile = file;
    const preview = el('foto-preview');
    preview.src = URL.createObjectURL(file);
    preview.classList.remove('hidden');
    el('ocr-run').disabled = false;
    el('ocr-status').textContent = '';
  });
  el('ocr-run').addEventListener('click', eseguiOcr);
}

// ---------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------
function init() {
  popolaSelect(el('sindrome'), SINDROMI);
  popolaSelect(el('procedura'), PROCEDURE);
  popolaSelect(el('germe'), ORGANISMI);
  costruisciTabellaAntibiogramma();
  initAllergieUi();
  initOcrInput();

  el('germe').addEventListener('change', () => {
    el('germe').classList.remove('auto-ocr');
    state.germeNonConfermato = false;
  });

  ['eta', 'peso', 'sesso', 'creatinina'].forEach((id) => el(id).addEventListener('input', aggiornaClcr));
  aggiornaClcr();

  el('disclaimer-ok').addEventListener('click', () => {
    el('disclaimer').classList.add('hidden');
    el('app').classList.remove('hidden');
  });

  el('go-step-2').addEventListener('click', () => cambiaStep(2));
  el('back-step-1').addEventListener('click', () => cambiaStep(1));
  document.querySelectorAll('.step-btn').forEach((b) => b.addEventListener('click', () => cambiaStep(Number(b.dataset.step))));

  el('stampa').addEventListener('click', () => window.print());
  el('nuovo-caso').addEventListener('click', () => {
    if (!confirm('Cancellare tutti i dati inseriti e iniziare un nuovo caso?')) return;
    state.antibiogramma = {};
    state.allergie = [];
    state.nonConfermati.clear();
    state.germeNonConfermato = false;
    document.querySelectorAll('#antibiogramma-table select').forEach((s) => { s.value = ''; s.classList.remove('auto-ocr'); });
    document.querySelectorAll('#antibiogramma-table input.mic-input').forEach((i) => { i.value = ''; i.classList.remove('auto-ocr'); });
    el('germe').selectedIndex = 0;
    el('germe').classList.remove('auto-ocr');
    renderListaAllergie();
    el('ocr-text').value = '';
    el('foto-preview').classList.add('hidden');
    el('foto-input').value = '';
    ultimoFile = null;
    el('eta').value = '';
    el('peso').value = '';
    el('creatinina').value = '';
    aggiornaClcr();
    cambiaStep(1);
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
