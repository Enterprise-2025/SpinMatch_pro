# QPWON SpinMatch Pro

Single-page app per discovery, raccomandazione e chiusura trattative per poliambulatori.

## Novità principali
- Palette calmante (teal) + tipografia forte
- Sidebar con icone **Lucide**, barretta attiva e tick di completamento
- **Progress bar** complessiva
- Campi “Altro” intelligenti (tutte le sezioni, inclusa Survey)
- **SmartMatch 2.0**: 3 case study coerenti (caricati da `data/cases.json`, con fallback)
- **Grafici dinamici** (Chart.js): torta, trend con area, **ROI operativo** (€/mese & ore/mese)
- **Prossimi passi** con tono da venditore
- **Autosave** (LocalStorage) + ripristino
- **Export PDF** completo (screenshot robusto del riepilogo)
- **Recap**: copia negli appunti + mailto precompilata
- **Onboarding** con memoria “non mostrare più”
- **PWA** base (manifest + service worker)

## Avvio
1. Servi la cartella via HTTP (per fetch di `data/cases.json` e PWA). Es.:  
   ```bash
   npx serve .
   ```
2. Apri `http://localhost:3000` (o porta mostrata).
3. Compila gli step, clicca **Genera proposta**, poi **Valuta lead**.
4. Scarica il **PDF** o **copia/manda** il recap.

## Note tecniche
- Se `data/cases.json` non è raggiungibile, il matching usa un **catalogo interno**.
- I grafici si rigenerano ad ogni proposta.
- La stima ROI operativo usa:  
  - € recuperati ≈ `perdite_stimate × incremento%`  
  - ore risparmiate ≈ `tempo_compiti × 22 giorni × 0.4`

Buon closing!
