# Foto delle specie

Come sono state fatte le immagini in `public/specie/` (una volta sola, non serve per la build).

1. Foto originali da Unsplash (id nel campo `unsplash` di `src/specie.js`), scaricate a 1400 px.
2. `scontorna.py <modello> <nomi…>`: rembg con `isnet-general-use` o `u2net`, una maschera per foto in `cut/`.
3. `sam.py <nome>`: SAM (rembg `sam`) con un riquadro e qualche punto, per le foto con le mani o con il vaso bianco
   su fondo bianco. Serve circa 4 GB di RAM: un'immagine per processo.
4. `processa.py`: per ogni specie sceglie la maschera (`src`), toglie le mani (`pelle`, colore della pelle),
   taglia sotto il vaso (`taglio`), tiene solo i pezzi grandi, sfuma il bordo, ritaglia e salva
   `<specie>.webp` (lato massimo 900 px) e `<specie>-mini.webp` (220 px), trasparenti.

Dipendenze: `pip install "rembg[cpu]" scipy pillow`.
