/* Chambre 214 · Mode Démontage
   ──────────────────────────────
   Trois appareils en vue technique : la chasse d’eau, la climatisation de la chambre
   (un ventilo-convecteur caché dans le faux plafond, le même que dans le jeu) et le
   tableau électrique. On les voit fonctionner en coupe, on démonte, on règle, on répare.

   Ce fichier est chargé après le script principal d’index.html et utilise ses fonctions
   globales : $, esc, toast, sfx, show, renderStart.

   Organisation :
   - petits outils (texte SVG, couleurs, animation des flux) ;
   - un objet par appareil : WC, CLIM, ELEC. Chacun fournit init() (état neuf), tick()
     (simulation), bg/dyn/fg (dessin), hot() (zones cliquables), parts (fiches pièces),
     act() (gestes), faults (pannes) et les textes d’explication ;
   - le moteur commun : onglets, boucle d’animation, pannes surprises, rendu HTML. */
(function () {
  'use strict';
  if (!document.getElementById('scr-demo')) return;

  /* ---------- Outils ---------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const f1 = (n) => (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const FONT = 'Atkinson Hyperlegible,system-ui,sans-serif';
  const MONOF = 'IBM Plex Mono,ui-monospace,monospace';
  const REDUCE = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  /* Décalage des pointillés qui avancent le long d’un tuyau ou d’un fil. */
  const dash = (t, speed, period) => (REDUCE ? 0 : -((t * speed) % period)).toFixed(1);
  const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  function mix(a, b, k) {
    k = clamp(k, 0, 1); const A = hex(a), B = hex(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('');
  }
  function T(x, y, txt, o) {
    o = o || {};
    return `<text x="${x}" y="${y}" font-family="${o.mono ? MONOF : FONT}" font-size="${o.s || 11}"${o.a ? ` text-anchor="${o.a}"` : ''}${o.w ? ` font-weight="${o.w}"` : ''} fill="${o.c || '#36434a'}">${txt}</text>`;
  }
  /* Résultat d’un geste : kind = good | bad | info ; safety = erreur de sécurité. */
  const R = (kind, msg, extra) => Object.assign({ kind, msg }, extra || {});
  const good = (m, x) => R('good', m, x);
  const bad = (m, x) => R('bad', m, x);
  const info = (m, x) => R('info', m, x);
  const danger = (m, x) => R('bad', m, Object.assign({ safety: true }, x || {}));
  const real = (m) => !!(m && !m.visible);

  /* =====================================================================
     CHASSE D’EAU : réservoir posé sur la cuvette, mécanisme double chasse à cloche
     ===================================================================== */
  const WK = 0.46;              // litres par cm de hauteur d’eau dans ce réservoir
  const WOVER = 15;             // haut du trop-plein, en cm au-dessus du fond
  const WY0 = 250, WSC = 10.5;  // dessin : y du fond, unités par cm
  const wy = (cm) => WY0 - cm * WSC;
  const wcFloatY = (s) => clamp(s.level > 0.3 ? wy(s.level) : WY0 - 11, 101, 239);
  const wcSmallStop = (s) => clamp(s.floatSet - s.smallVol / WK, 0.6, 14);

  function wcMech(lift, seal, sy) {
    const bt = 166 - lift * 26, jy = bt + 30;
    let g = `<rect x="-15" y="0" width="30" height="12" rx="3" fill="#d3dadc" stroke="#8f9ca1" stroke-width="1.5"/>`;
    g += `<path d="M-12 12V${bt.toFixed(1)}M12 12V${bt.toFixed(1)}" stroke="#a3aeb2" stroke-width="3"/>`;
    g += `<rect x="-5" y="42.5" width="10" height="157.5" fill="#ffffff" stroke="#8f9ca1" stroke-width="1.2"/><ellipse cx="0" cy="42.5" rx="6.5" ry="2" fill="#e8eef0" stroke="#8f9ca1"/>`;
    if (sy != null) g += `<rect x="12" y="${(sy - 4).toFixed(1)}" width="12" height="8" rx="2" fill="#4f9fd6" stroke="#2c6d99"/>`;
    g += `<rect x="-22" y="${bt.toFixed(1)}" width="44" height="30" rx="7" fill="#cfd8dc" stroke="#8f9ca1" stroke-width="1.5"/>`;
    g += `<rect x="-24" y="${jy.toFixed(1)}" width="48" height="4" rx="2" fill="${seal === 'use' ? '#6f2a22' : '#d64f43'}"/>`;
    if (seal === 'tartre') g += [-18, -9, 0, 9, 18].map((x) => `<circle cx="${x}" cy="${(jy + 2).toFixed(1)}" r="1.7" fill="#f3f0e6"/>`).join('');
    if (seal === 'use') g += `<path d="M-15 ${jy.toFixed(1)}l2 4M2 ${jy.toFixed(1)}l-2 4M15 ${jy.toFixed(1)}l2 4" stroke="#f2ddd5" stroke-width="1.1"/>`;
    return g;
  }
  function wcSound(s) {
    if (s.out > 0.3) return 'la chasse';
    if (s.q > 0.05 && s.over > 0.01) return 'un sifflement continu';
    if (s.q > 0.05) return s.q < 0.5 ? 'un filet qui siffle' : 'le remplissage';
    if (s.leak > 0) return 'un léger écoulement';
    return 'rien';
  }
  function wcBowl(s) {
    const blue = s.bowlDye > 0.3;
    if (s.out > 0.3) return 'La chasse rince la cuvette.';
    if (s.over > 0.01) return 'Un filet d’eau coule en continu au fond de la cuvette' + (blue ? ', bleu : le colorant passe.' : '.');
    if (s.leak > 0) return 'Un tout petit filet coule sans arrêt' + (blue ? ', bleu : le colorant passe.' : '.');
    return 'Rien ne coule.';
  }
  function wcBowlShort(s) {
    const blue = s.bowlDye > 0.3 ? ' (bleu)' : '';
    if (s.out > 0.3) return 'rinçage';
    if (s.over > 0.01) return 'filet continu' + blue;
    if (s.leak > 0) return 'petit filet' + blue;
    return 'rien ne coule';
  }
  function wcFloatMsg(s) {
    const v = s.floatSet;
    const tip = v >= WOVER ? 'Trop haut : l’eau partira dans le trop-plein.'
      : v > 14 ? 'Un peu haut : vise environ 2 cm sous le haut du trop-plein.'
      : v >= 12 ? 'Bon réglage : environ 2 cm sous le haut du trop-plein.'
      : `Bas : la grande chasse ne fera que ${f1(v * WK)} L.`;
    return `Butée du flotteur à ${f1(v)} cm (trop-plein à 15 cm). ${tip}` + (s.level > v + 0.3 ? ' Tire la chasse pour voir le nouveau niveau.' : '');
  }
  function wcHeadOut(s) {
    const dirty = s.filter === 'tartre', worn = s.membrane === 'usee';
    let o = `<rect x="304" y="270" width="30" height="18" rx="4" fill="#c9d1d6" stroke="#8f9ca1" stroke-width="1.5"/>`;
    o += `<circle cx="352" cy="279" r="8.5" fill="${dirty ? '#d8d2bf' : '#eef3f5'}" stroke="#8f9ca1"/>`;
    for (let x = 346; x <= 358; x += 3) o += `<path d="M${x} 272v14" stroke="${dirty ? '#b9b19a' : '#c9d3d7'}"/>`;
    if (dirty) o += `<circle cx="349" cy="277" r="2" fill="#f4f1e6"/><circle cx="355" cy="282" r="2.4" fill="#f4f1e6"/><circle cx="352" cy="274" r="1.6" fill="#f4f1e6"/>`;
    o += `<ellipse cx="378" cy="279" rx="9" ry="${worn ? 4.5 : 6.5}" fill="#2b2f33"/>`;
    if (worn) o += `<path d="M372 277l4 3M381 276l-2 4" stroke="#9aa6aa" stroke-width="1"/>`;
    return o + T(346, 302, 'tête · filtre · membrane', { s: 8.5, a: 'middle' });
  }

  const WC = {
    title: 'Chasse d’eau',
    aria: 'Vue en coupe d’un réservoir de chasse d’eau posé sur la cuvette',
    intro: 'Réservoir posé sur la cuvette, mécanisme double chasse à cloche. Tire une chasse pour voir le cycle, puis touche une pièce pour la manipuler.',
    realNote: 'Trouve la cause, répare et teste. On ne voit l’intérieur du réservoir qu’après avoir retiré le couvercle.',
    order: ['robinet', 'rf', 'flotteur', 'meca', 'tropplein', 'joint', 'bouton', 'couvercle', 'eau', 'cuvette'],
    init() {
      return { supply: true, level: 13, floatSet: 13, smallVol: 3, ring: true, lid: true, mech: true, head: true,
        filter: 'ok', membrane: 'ok', seal: 'ok', flush: null, lift: 0, valve: false, q: 0, out: 0, leak: 0, over: 0,
        dye: 0, bowlDye: 0, last: null, refilling: false, sawHead: false, sawSeal: false };
    },
    tick(s, dt) {
      // Robinet flotteur : il s’ouvre quand l’eau descend 0,5 cm sous la butée, il se ferme à la butée.
      if (s.level <= s.floatSet - 0.5) s.valve = true;
      if (s.level >= s.floatSet - 0.01) s.valve = false;
      let q = 0;
      if (s.supply && s.head) {
        const qmax = s.filter === 'tartre' ? 0.3 : 2.6;
        if (s.valve) q = qmax * clamp((s.floatSet - s.level) / 0.5 + 0.25, 0.25, 1);
        if (s.membrane === 'usee') q = Math.max(q, 0.16);   // membrane usée : ne ferme plus complètement
      }
      s.lift = s.flush ? Math.min(1, s.lift + dt * 7) : Math.max(0, s.lift - dt * 5);
      let out = 0, leak = 0, over = 0;
      if (!s.mech) out = s.level > 0 || q > 0 ? 8 : 0;
      else {
        out = 8 * s.lift;
        if (s.lift < 0.02 && s.seal !== 'ok' && s.level > 0.05) leak = s.seal === 'use' ? 0.075 : 0.04;
      }
      let lv = s.level + (q - out - leak) * dt;
      if (s.mech && lv > WOVER) { over = (lv - WOVER) / Math.max(dt, 1e-3); lv = WOVER; }
      lv = Math.max(0, lv);
      if (s.flush && lv <= s.flush.stopAt + 0.01) {
        s.last = { kind: s.flush.kind, vol: Math.max(0, (s.flush.start - lv) * WK) };
        s.flush = null; s.refilling = true;
        s.dye *= 0.1; s.bowlDye = s.dye;
      }
      if (s.refilling && !s.flush && s.lift === 0 && !s.valve && q < 0.2) s.refilling = false;
      // Colorant : l’eau qui passe dans la cuvette sans chasse la colore.
      if (s.lift > 0.05 || !s.mech) s.bowlDye = Math.max(s.bowlDye, s.dye);
      else if ((leak > 0 || over > 0) && s.dye > 0) s.bowlDye = Math.min(1, s.bowlDye + dt * 0.45 * s.dye);
      if (lv < 0.3) s.dye = 0;
      else if (q > 0.05 && s.dye > 0) s.dye = Math.max(0, s.dye - q * dt * 0.05);
      s.level = lv; s.q = q; s.out = out; s.leak = leak; s.over = over;
    },
    sig: (s) => [s.level.toFixed(2), s.lift.toFixed(2), s.dye.toFixed(2), s.bowlDye.toFixed(2), s.floatSet, s.smallVol].join('|'),
    anim: (s) => s.q > 0.01 || s.out > 0.01 || s.leak > 0 || s.over > 0.01,
    bg(s) {
      let o = `<rect width="400" height="316" fill="#e4ecee"/>`;
      for (let x = 36; x < 400; x += 36) o += `<path d="M${x} 0V316" stroke="#d6e0e3"/>`;
      for (let y = 36; y < 316; y += 36) o += `<path d="M0 ${y}H400" stroke="#d6e0e3"/>`;
      o += `<rect y="316" width="400" height="14" fill="#c4cfd3"/>`;
      o += T(10, 18, 'COUPE DU RÉSERVOIR', { s: 9.5, mono: true, c: '#5d6b71' });
      o += `<rect x="40" y="58" width="246" height="198" rx="10" fill="#fbfbf8" stroke="#c3ccd0" stroke-width="2"/>`;
      o += `<rect x="47" y="64" width="232" height="186" rx="3" fill="#eef3f5"/>`;
      // cuvette (vue de face) et tuyau de chasse
      o += `<rect x="182" y="254" width="16" height="12" fill="#e3e8ea" stroke="#c3ccd0"/>`;
      o += `<path d="M108 262H272C272 290 252 304 224 308H156C128 304 108 290 108 262Z" fill="#fbfbf8" stroke="#c3ccd0" stroke-width="2"/><path d="M168 308L162 316H218L212 308Z" fill="#f2f4f2" stroke="#c3ccd0" stroke-width="1.5"/>`;
      // arrivée d’eau et robinet d’arrêt
      o += `<path d="M0 266H14M30 266H86V254" fill="none" stroke="#c9d1d6" stroke-width="6" stroke-linejoin="round"/>`;
      o += `<circle cx="22" cy="266" r="9" fill="#b7c0c5" stroke="#75868b" stroke-width="1.5"/>`;
      o += s.supply ? `<rect x="8" y="261" width="28" height="7" rx="3" fill="#2f6fb0"/>` : `<rect x="18.5" y="252" width="7" height="28" rx="3" fill="#2f6fb0"/>`;
      o += T(4, 292, 'robinet', { s: 9.5 }) + T(4, 303, 'd’arrêt', { s: 9.5 });
      // plan de travail : les pièces démontées s’y posent
      o += `<rect x="296" y="62" width="100" height="246" rx="8" fill="#d9e2e5" stroke="#bcc8cc"/>` + T(346, 77, 'POSÉ À CÔTÉ', { s: 9, a: 'middle', mono: true, c: '#5d6b71' });
      if (s.lid && s.ring && s.mech && s.head) o += T(346, 156, 'Les pièces', { s: 10, a: 'middle', c: '#7c8a90' }) + T(346, 170, 'démontées', { s: 10, a: 'middle', c: '#7c8a90' }) + T(346, 184, 'se posent ici.', { s: 10, a: 'middle', c: '#7c8a90' });
      if (!s.lid) o += `<rect x="304" y="88" width="84" height="11" rx="4" fill="#fdfdfb" stroke="#c3ccd0"/>` + T(346, 111, 'couvercle', { s: 10, a: 'middle' });
      if (!s.ring) o += `<circle cx="322" cy="128" r="8" fill="none" stroke="#a9b4b8" stroke-width="4"/>` + T(336, 132, 'bague', { s: 10 });
      if (!s.mech) o += `<g transform="translate(346 142) scale(.52)">${wcMech(0, s.seal, null)}</g>` + T(346, 260, 'mécanisme', { s: 10, a: 'middle' });
      if (!s.head) o += wcHeadOut(s);
      return o;
    },
    dyn(s, t, m) {
      let o = '';
      const ly = wy(s.level);
      if (s.level > 0.03) {
        o += `<rect x="47" y="${ly.toFixed(1)}" width="232" height="${(WY0 - ly).toFixed(1)}" fill="${mix('#9fd0ec', '#6f86dc', s.dye)}" opacity=".82"/>`;
        const wv = (s.q > 0.05 || s.out > 0.05) && !REDUCE ? 1.6 * Math.sin(t * 9) : 0;
        o += `<path d="M47 ${ly.toFixed(1)}q14.5 ${wv.toFixed(1)} 29 0t29 0t29 0t29 0t29 0t29 0t29 0t29 0" fill="none" stroke="#3f8fc4" stroke-width="1.6"/>`;
      }
      // butée de réglage du flotteur (orange) et repère du trop-plein
      const by = wy(s.floatSet);
      o += `<path d="M96 ${by.toFixed(1)}H158" stroke="#c98a1e" stroke-width="1.5" stroke-dasharray="4 3"/>` + T(110, (by - 4).toFixed(1), `butée ${f1(s.floatSet)} cm`, { s: 9.5, c: '#94600e', w: 700 });
      if (s.mech) o += `<path d="M198 ${wy(WOVER)}H230" stroke="#7d8a8f" stroke-dasharray="2 3"/>` + T(232, wy(WOVER) + 3, 'trop-plein', { s: 9, c: '#56636a' });
      // robinet flotteur : corps, clip de réglage, tête
      o += `<rect x="82" y="88" width="8" height="${WY0 - 88}" fill="#e9edef" stroke="#9aa6aa"/>`;
      o += `<rect x="77" y="${(by - 2).toFixed(1)}" width="18" height="4" rx="1.5" fill="#e2a541" stroke="#94600e" stroke-width=".6"/>`;
      if (s.head) o += `<rect x="70" y="70" width="34" height="18" rx="4" fill="#c9d1d6" stroke="#8f9ca1" stroke-width="1.5"/><rect x="103" y="78" width="5" height="6" rx="1" fill="#aab5ba"/>`;
      else o += `<rect x="79" y="83" width="14" height="6" rx="2" fill="#9aa6aa"/>`;
      const fc = wcFloatY(s);
      o += `<rect x="72" y="${(fc - 11).toFixed(1)}" width="28" height="22" rx="5" fill="#ffffff" stroke="#8f9ca1" stroke-width="1.5"/><path d="M76 ${(fc - 3).toFixed(1)}h20" stroke="#dfe5e7"/>`;
      if (s.head && s.q > 0.01) {
        const ty = s.level > 0.2 ? Math.max(ly, 100) : WY0 - 2;
        o += `<path d="M108 81C120 83 122 ${(ty - 16).toFixed(1)} 122 ${ty.toFixed(1)}" fill="none" stroke="#2f7fc0" stroke-width="${(1.2 + s.q * 0.8).toFixed(2)}" stroke-dasharray="5 4" stroke-dashoffset="${dash(t, 36, 9)}" stroke-linecap="round"/>`;
      }
      // siège, mécanisme, trop-plein
      o += `<rect x="164" y="248" width="52" height="4" rx="2" fill="#6f7c81"/>`;
      if (s.mech) {
        const sealShown = real(m) && !s.sawSeal ? 'ok' : s.seal;
        const sy = wy(wcSmallStop(s)) - 50;
        o += `<g transform="translate(190 50)">${wcMech(s.lift, sealShown, sy)}</g>`;
        o += T(218, (sy + 53).toFixed(1), `petite ${f1(s.smallVol)} L`, { s: 9, c: '#2c6d99', w: 700 });
        if (s.over > 0.01) {
          const top = wy(WOVER), bt = 216 - s.lift * 26;
          o += `<path d="M181 ${(top + 1).toFixed(1)}q9 -6 18 0" fill="none" stroke="#2f7fc0" stroke-width="2.4"/>`;
          o += `<path d="M190 ${(top + 3).toFixed(1)}V${bt.toFixed(1)}" stroke="#2f7fc0" stroke-width="3" stroke-dasharray="5 4" stroke-dashoffset="${dash(t, 30, 9)}"/>`;
        }
      } else {
        o += `<ellipse cx="190" cy="250" rx="17" ry="3.5" fill="#1f2a30"/>` + T(190, 240, 'siège', { s: 9.5, a: 'middle', c: '#56636a' });
      }
      // vers la cuvette
      if (s.out > 0.05) o += `<path d="M190 254V270" stroke="#2f7fc0" stroke-width="${(4 + s.out * 0.6).toFixed(1)}" stroke-dasharray="7 4" stroke-dashoffset="${dash(t, 60, 11)}"/>`;
      else if (s.leak > 0 || s.over > 0.01) o += `<path d="M196 254V268" stroke="#2f7fc0" stroke-width="1.6" stroke-dasharray="3 3" stroke-dashoffset="${dash(t, 24, 6)}"/>`;
      o += `<ellipse cx="190" cy="285" rx="56" ry="7" fill="${mix('#cfe6f2', '#6f86dc', s.bowlDye)}"/>`;
      if (s.out > 0.3) {
        for (let i = 0; i < 5; i++) { const x = 146 + i * 22; o += `<path d="M${x} 267Q${x + 4} 277 ${x + 8} 283" fill="none" stroke="#2f7fc0" stroke-width="2" stroke-dasharray="4 3" stroke-dashoffset="${dash(t, 40, 7)}"/>`; }
      } else if (s.leak > 0 || s.over > 0.01) {
        o += `<path d="M198 267Q200 277 202 283" fill="none" stroke="#2f7fc0" stroke-width="1.4" stroke-dasharray="3 3" stroke-dashoffset="${dash(t, 22, 6)}"/>`;
      }
      return o;
    },
    fg(s, m) {
      let o = '';
      if (real(m) && s.lid) {
        o += `<rect x="40" y="58" width="246" height="198" rx="10" fill="#f7f7f4" stroke="#c3ccd0" stroke-width="2"/>`;
        o += T(163, 150, 'Réservoir fermé', { s: 13, a: 'middle', c: '#7d8a8f', w: 700 }) + T(163, 168, 'retire le couvercle pour voir dedans', { s: 10.5, a: 'middle', c: '#8c989d' });
      }
      if (s.lid) o += `<rect x="34" y="44" width="258" height="15" rx="6" fill="#fdfdfb" stroke="#c3ccd0" stroke-width="2"/>`;
      if (s.mech) {
        o += `<path d="M190 33a11 11 0 0 0 0 22z" fill="#f4f5f2" stroke="#a9b4b8"/><path d="M190 33a11 11 0 0 1 0 22z" fill="#e6eaea" stroke="#a9b4b8"/>`;
        if (s.ring) o += `<circle cx="190" cy="44" r="14.5" fill="none" stroke="#a9b4b8" stroke-width="3"/>`;
      }
      return o;
    },
    hot(s, m) {
      const inside = !(real(m) && s.lid);
      const H = [['cuvette', 'Cuvette', 106, 262, 168, 50, 262, 300], ['robinet', 'Robinet d’arrêt', 2, 246, 44, 40, 40, 252]];
      H.push(s.lid ? ['couvercle', 'Couvercle', 34, 38, 128, 22, 44, 46] : ['couvercle', 'Couvercle posé à côté', 300, 82, 92, 34, 304, 90]);
      if (!s.ring) H.push(['bouton', 'Bague posée à côté', 304, 114, 60, 28, 306, 120]);
      if (inside) {
        H.push(['eau', 'Eau du réservoir', 226, 150, 52, 92, 270, 152]);
        H.push(s.head ? ['rf', 'Robinet flotteur', 64, 62, 48, 28, 64, 66] : ['rf', 'Tête du robinet flotteur posée à côté', 300, 264, 92, 42, 304, 268]);
        H.push(['flotteur', 'Flotteur et butée de réglage', 64, 90, 34, 158, 64, wcFloatY(s)]);
        if (s.mech) {
          H.push(['meca', 'Mécanisme de chasse', 152, 104, 76, 104, 156, 150]);
          H.push(['tropplein', 'Trop-plein', 176, 82, 30, 22, 176, 88]);
          H.push(['joint', 'Cloche et joint', 156, 208, 70, 46, 156, 236]);
        } else {
          H.push(['meca', 'Mécanisme posé à côté', 314, 136, 64, 98, 380, 168]);
          H.push(['joint', 'Joint de cloche', 314, 232, 64, 24, 384, 240]);
        }
      }
      if (s.mech) H.push(['bouton', 'Bouton-poussoir et bague', 170, 26, 40, 30, 212, 32]);
      return H;
    },
    paintHot(s) {
      const mk = document.getElementById('dm-mk-flotteur');
      if (mk) mk.setAttribute('transform', `translate(64 ${wcFloatY(s).toFixed(1)})`);
    },
    now(s, m) {
      if (!s.mech) return 'Mécanisme déposé : on voit le siège, le trou par où part l’eau de la chasse.';
      if (s.flush || s.lift > 0.05) return s.flush && s.flush.kind === 'small' ? 'Petite chasse : la cloche se soulève puis retombe tôt, environ 3 litres partent.' : 'Grande chasse : la cloche se soulève, le réservoir se vide dans la cuvette.';
      if (real(m) && s.lid) return s.over > 0.01 || s.leak > 0 || s.q > 0.05 ? 'Couvercle en place : on entend de l’eau, mais on ne voit pas dedans.' : 'Couvercle en place : on ne voit pas l’intérieur.';
      if (!s.head) return 'Tête du robinet flotteur ouverte : filtre et membrane sont posés à côté.';
      if (s.over > 0.01) return 'L’eau atteint le haut du trop-plein et part dans la cuvette sans arrêt : le robinet flotteur ne ferme pas.';
      if (s.q > 0.05) return s.level < s.floatSet - 1 ? 'Remplissage : le flotteur est en bas, le robinet flotteur est ouvert.' : 'Le flotteur remonte jusqu’à la butée : le robinet flotteur se referme.';
      if (s.leak > 0) return 'L’eau passe sous la cloche : le joint n’est plus étanche. Le niveau baisse, puis le flotteur relance un remplissage.';
      if (!s.supply) return s.level < 0.5 ? 'Arrivée fermée, réservoir vide : rien ne se remplit.' : 'Arrivée fermée : après la prochaine chasse, le réservoir restera vide.';
      return 'Au repos : réservoir plein, flotteur en haut, robinet flotteur fermé, cloche posée sur son joint.';
    },
    status(s, m) {
      const hidden = real(m) && s.lid, L = s.last, snd = wcSound(s);
      let last = '—', tone = '';
      if (L) {
        last = `${L.kind === 'big' ? 'grande' : 'petite'} · ${f1(L.vol)} L`;
        const lo = L.kind === 'big' ? 5.2 : 2.4, hi = L.kind === 'big' ? 6.7 : 3.6;
        tone = L.vol < lo || L.vol > hi ? 'warn' : 'ok';
      }
      return [
        ['Arrivée', s.supply ? 'ouverte' : 'fermée', s.supply ? '' : 'warn'],
        ['Niveau', hidden ? 'couvercle fermé' : `${f1(s.level)} cm · ${f1(s.level * WK)} L`, !hidden && s.over > 0.01 ? 'bad' : ''],
        ['On entend', snd, /siffl|écoulement/.test(snd) ? 'bad' : ''],
        ['Cuvette', wcBowlShort(s), s.leak > 0 || s.over > 0.01 ? 'bad' : ''],
        ['Dernière chasse', last, tone],
      ];
    },
    quick: (s) => [['flush_small', 'Petite chasse'], ['flush_big', 'Grande chasse'], s.supply ? ['supply_close', 'Fermer l’arrivée'] : ['supply_open', 'Ouvrir l’arrivée']],
    parts: {
      robinet: { name: 'Robinet d’arrêt', role: 'Il coupe l’eau qui arrive au WC. Quart de tour : poignée dans l’axe du tuyau = ouvert, en travers = fermé. C’est toujours le premier geste avant de démonter.',
        state: (s) => s.supply ? 'Ouvert' : 'Fermé', acts: (s) => [s.supply ? ['supply_close', 'Fermer'] : ['supply_open', 'Rouvrir doucement']] },
      rf: { name: 'Robinet flotteur', role: 'Il laisse entrer l’eau quand le flotteur descend et la coupe quand il remonte. Dans sa tête : un filtre (contre le calcaire et les impuretés) et une membrane qui ferme l’arrivée.',
        state: (s, m) => {
          const seen = !real(m) || s.sawHead;
          const inside = seen ? ` · filtre ${s.filter === 'tartre' ? 'bouché par le calcaire' : 'propre'} · membrane ${s.membrane === 'usee' ? 'usée, déformée' : 'souple'}` : ' · filtre et membrane à contrôler (ouvre la tête)';
          return (s.head ? 'Tête en place' : 'Tête ouverte, posée à côté') + inside;
        },
        acts: (s) => s.head ? [['head_off', 'Ouvrir la tête (quart de tour)']] : [['filter_clean', 'Rincer et brosser le filtre'], ['membrane_new', 'Changer la membrane'], ['head_on', 'Remonter la tête']] },
      flotteur: { name: 'Flotteur et butée de réglage', role: 'Le flotteur suit la surface de l’eau. Quand il arrive à la butée orange, il ferme le robinet flotteur. Monter ou baisser la butée règle le niveau : environ 2 cm sous le haut du trop-plein.',
        state: (s, m) => real(m) && s.lid ? 'Sous le couvercle : retire-le pour le voir.' : `Butée à ${f1(s.floatSet)} cm · trop-plein à 15 cm · eau à ${f1(s.level)} cm`,
        acts: () => [['float_down', 'Baisser la butée (−0,5 cm)'], ['float_up', 'Monter la butée (+0,5 cm)']] },
      meca: { name: 'Mécanisme de chasse', role: 'Quand on appuie, il soulève la cloche : l’eau part dans la cuvette. Le curseur bleu règle le volume de la petite chasse. Il se dépose d’un quart de tour, sans démonter le réservoir.',
        state: (s) => (s.mech ? 'En place' : 'Déposé, posé à côté') + ` · petite chasse ${f1(s.smallVol)} L`,
        acts: (s) => s.mech ? [['small_down', 'Petite chasse −0,5 L'], ['small_up', 'Petite chasse +0,5 L'], ['mech_out', 'Déposer (quart de tour)']] : [['mech_in', 'Reposer et verrouiller']] },
      tropplein: { name: 'Trop-plein', role: 'La sécurité du réservoir : si l’eau monte trop, elle passe par ce tube et part dans la cuvette au lieu de déborder sur le sol. Si elle y coule sans arrêt, le flotteur est réglé trop haut ou le robinet flotteur ne ferme plus.',
        state: (s, m) => real(m) && s.lid ? 'Sous le couvercle.' : s.over > 0.01 ? 'L’eau passe par-dessus : elle part en continu dans la cuvette.' : 'Rien ne passe.', acts: () => [] },
      joint: { name: 'Cloche et joint', role: 'La cloche est posée sur le siège ; le joint dessous fait l’étanchéité. Usé ou entartré, il laisse filer l’eau dans la cuvette et le réservoir se remplit tout seul de temps en temps.',
        state: (s, m) => {
          if (real(m) && !s.sawSeal) return 'Sous la cloche : dépose le mécanisme pour le voir.';
          return { ok: 'Joint souple et propre', use: 'Joint usé : dur, fissuré', tartre: 'Joint couvert de calcaire' }[s.seal];
        },
        acts: () => [['seal_clean', 'Nettoyer (vinaigre blanc)'], ['seal_new', 'Poser un joint neuf']] },
      bouton: { name: 'Bouton-poussoir double', role: 'Grand bouton : grande chasse (environ 6 L). Petit bouton : petite chasse (environ 3 L). Il est fixé sur le mécanisme ; la bague vissée autour tient le couvercle.',
        state: (s) => s.ring ? 'Bague vissée' : 'Bague dévissée, posée à côté',
        acts: (s) => [['flush_small', 'Petite chasse'], ['flush_big', 'Grande chasse'], s.ring ? ['ring_off', 'Dévisser la bague'] : ['ring_on', 'Revisser la bague']] },
      couvercle: { name: 'Couvercle', role: 'Il protège le mécanisme. Il ne s’enlève qu’une fois la bague du bouton dévissée. Pose-le à plat, à l’écart : il casse facilement.',
        state: (s) => s.lid ? 'En place' : 'Posé à côté', acts: (s) => [s.lid ? ['lid_off', 'Soulever le couvercle'] : ['lid_on', 'Reposer le couvercle']] },
      eau: { name: 'Eau du réservoir', role: 'Le test du colorant : quelques gouttes dans le réservoir, puis on attend sans tirer la chasse. Si la cuvette se colore, l’eau passe du réservoir à la cuvette.',
        state: (s, m) => real(m) && s.lid ? 'Sous le couvercle.' : `${f1(s.level)} cm, soit ${f1(s.level * WK)} L` + (s.dye > 0.05 ? ' · colorée' : ''), acts: () => [['dye', 'Verser du colorant']] },
      cuvette: { name: 'Cuvette', role: 'C’est là qu’on voit les fuites : un filet d’eau continu au fond, sans avoir tiré la chasse, veut dire que le réservoir fuit.',
        state: (s) => wcBowl(s), acts: () => [['look_bowl', 'Observer de près']] }
    },
    adjust: [
      { id: 'float', label: 'Hauteur du flotteur (niveau d’eau)', val: (s) => `${f1(s.floatSet)} cm`, hint: 'Environ 2 cm sous le haut du trop-plein (15 cm).', minus: 'float_down', plus: 'float_up',
        lock: (s) => s.lid ? 'Retire le couvercle pour y accéder.' : null },
      { id: 'small', label: 'Volume de la petite chasse', val: (s) => `${f1(s.smallVol)} L`, hint: 'Environ 3 L ; la grande chasse fait environ 6 L.', minus: 'small_down', plus: 'small_up',
        lock: (s) => s.lid ? 'Retire le couvercle pour y accéder.' : !s.mech ? 'Remonte d’abord le mécanisme.' : null }
    ],
    how: [
      ['Au repos.', 'Le réservoir est plein, le flotteur est en haut et ferme le robinet flotteur. La cloche est posée sur son joint.', (s) => !s.flush && s.lift === 0 && s.q < 0.05 && s.level > 1 && s.leak === 0 && s.over === 0],
      ['On appuie.', 'Le bouton soulève la cloche : l’eau part dans la cuvette. Grand bouton ≈ 6 L, petit bouton ≈ 3 L.', (s) => !!s.flush || s.lift > 0],
      ['Le flotteur descend.', 'Avec le niveau qui baisse, il ouvre le robinet flotteur : l’eau arrive.', (s) => !s.flush && s.q > 0.05 && s.level < s.floatSet - 1],
      ['Il remonte et ferme.', 'Arrivé à la butée orange, le flotteur referme l’arrivée d’eau.', (s) => !s.flush && s.q > 0.05 && s.level >= s.floatSet - 1 && s.over === 0],
      ['Sécurité : le trop-plein.', 'Si l’eau monte trop, elle part par le trop-plein dans la cuvette au lieu de déborder.', (s) => s.over > 0.01]
    ],
    hideHow: (s, m) => real(m) && s.lid,
    gamme: { title: 'Démontage, dans l’ordre', steps: [
      ['Fermer le robinet d’arrêt.', (s) => !s.supply],
      ['Vider le réservoir : grande chasse.', (s) => s.level < 1],
      ['Dévisser la bague du bouton.', (s) => !s.ring],
      ['Soulever le couvercle, le poser à plat.', (s) => !s.lid],
      ['Déposer le mécanisme d’un quart de tour, ou ouvrir la tête du robinet flotteur.', (s) => !s.mech || !s.head]
    ], note: 'Remontage dans l’ordre inverse, puis rouvrir doucement, régler le niveau et tester les deux chasses.' },
    act(s, id, m) {
      const lidMsg = 'Retire d’abord le couvercle : dévisse la bague du bouton, puis soulève-le.';
      switch (id) {
        case 'flush_small': case 'flush_big': {
          if (!s.mech) return bad('Le mécanisme est déposé : il n’y a plus rien à actionner.');
          if (s.flush || s.lift > 0) return info('Une chasse est déjà en cours.');
          if (s.level < 0.4) return info(s.supply ? 'Le réservoir est vide : attends qu’il se remplisse.' : 'Réservoir vide et arrivée fermée : rien ne part.');
          const big = id === 'flush_big';
          s.flush = { kind: big ? 'big' : 'small', start: s.level, stopAt: big ? 0.15 : Math.max(0.15, s.level - s.smallVol / WK) };
          return R('water', null);
        }
        case 'supply_close':
          if (!s.supply) return info('Il est déjà fermé.');
          s.supply = false; return info('Robinet d’arrêt fermé : plus d’arrivée d’eau. Une grande chasse videra le réservoir.');
        case 'supply_open':
          if (s.supply) return info('Il est déjà ouvert.');
          if (!s.head) return danger('La tête du robinet flotteur est démontée : l’eau giclerait partout. Remonte-la d’abord.');
          if (!s.mech) return bad('Le mécanisme est déposé : l’eau filerait directement dans la cuvette. Remonte-le d’abord.');
          s.supply = true; return good('Arrivée rouverte doucement : le réservoir se remplit.');
        case 'ring_off':
          if (!s.ring) return info('La bague est déjà dévissée.');
          s.ring = false; return info('Bague dévissée à la main (sens inverse des aiguilles d’une montre). Le couvercle est libre.');
        case 'ring_on':
          if (s.ring) return info('Elle est déjà vissée.');
          if (!s.lid) return bad('Repose d’abord le couvercle : c’est lui que la bague maintient.');
          s.ring = true; return good('Bague revissée à la main, sans forcer.');
        case 'lid_off':
          if (!s.lid) return info('Le couvercle est déjà posé à côté.');
          if (s.ring) return bad('Le couvercle est tenu par la bague du bouton : dévisse-la d’abord, sinon tu forces et tu casses le couvercle.');
          s.lid = false; return info('Couvercle soulevé et posé à plat, à l’écart. On voit l’intérieur du réservoir.');
        case 'lid_on':
          if (s.lid) return info('Il est déjà en place.');
          if (!s.mech) return bad('Remonte d’abord le mécanisme : le bouton se fixe dessus.');
          if (!s.head) return bad('Remonte d’abord la tête du robinet flotteur.');
          s.lid = true; return good('Couvercle reposé. Revisse la bague pour le bloquer.');
        case 'float_up': case 'float_down':
          if (s.lid) return bad(lidMsg);
          s.floatSet = clamp(s.floatSet + (id === 'float_up' ? 0.5 : -0.5), 8, 17.5);
          return info(wcFloatMsg(s));
        case 'small_up': case 'small_down':
          if (s.lid) return bad(lidMsg);
          if (!s.mech) return bad('Remonte d’abord le mécanisme : le réglage est dessus.');
          s.smallVol = clamp(s.smallVol + (id === 'small_up' ? 0.5 : -0.5), 1.5, 5);
          return info(`Petite chasse réglée à ${f1(s.smallVol)} L. ` + (s.smallVol < 2.5 ? 'Trop peu : la cuvette sera mal rincée.' : s.smallVol > 3.5 ? 'C’est beaucoup : la petite chasse gaspille de l’eau.' : 'Bon réglage, autour de 3 L.'));
        case 'mech_out': {
          if (!s.mech) return info('Il est déjà déposé.');
          if (s.lid) return bad(lidMsg);
          if (s.supply) return bad('Ferme d’abord le robinet d’arrêt : sans mécanisme, l’eau coulerait en continu dans la cuvette.');
          if (s.flush || s.lift > 0) return info('Attends la fin de la chasse.');
          const had = s.level > 0.5;
          s.mech = false; s.flush = null; s.lift = 0; s.sawSeal = true;
          const word = { ok: 'souple et propre', use: 'dur et fissuré', tartre: 'couvert de calcaire' }[s.seal];
          return info((had ? 'L’eau restante part d’un coup dans la cuvette (astuce : vide le réservoir avant). ' : '') + `Mécanisme déposé d’un quart de tour. Sous la cloche, le joint est ${word}.`);
        }
        case 'mech_in':
          if (s.mech) return info('Il est déjà en place.');
          s.mech = true; return good('Mécanisme reposé et verrouillé d’un quart de tour.');
        case 'seal_clean':
          if (s.mech) return bad('Le joint est sous la cloche : dépose d’abord le mécanisme (quart de tour).');
          if (s.seal === 'tartre') { s.seal = 'ok'; return good('Calcaire retiré au vinaigre blanc et à l’éponge douce : le joint est de nouveau souple et lisse.'); }
          if (s.seal === 'use') return bad('Nettoyé, mais il reste dur et fissuré : il ne sera plus étanche. Il faut le remplacer.');
          return info('Il était déjà propre et souple.');
        case 'seal_new':
          if (s.mech) return bad('Le joint est sous la cloche : dépose d’abord le mécanisme (quart de tour).');
          s.seal = 'ok'; return good('Joint neuf mis en place, bien à plat dans sa gorge.');
        case 'head_off': {
          if (!s.head) return info('La tête est déjà ouverte.');
          if (s.lid) return bad(lidMsg);
          if (s.supply) return danger('Eau sous pression : si tu ouvres la tête maintenant, ça gicle partout. Ferme d’abord le robinet d’arrêt.');
          s.head = false; s.sawHead = true;
          return info(`Tête ouverte d’un quart de tour. Filtre : ${s.filter === 'tartre' ? 'bouché par le calcaire' : 'propre'}. Membrane : ${s.membrane === 'usee' ? 'usée, déformée' : 'souple, en bon état'}.`);
        }
        case 'head_on':
          if (s.head) return info('Elle est déjà en place.');
          s.head = true; return good('Tête remontée et verrouillée.');
        case 'filter_clean':
          if (s.head) return bad('Le filtre est dans la tête : ferme l’arrivée, puis ouvre la tête du robinet flotteur.');
          if (s.filter === 'ok') return info('Il était déjà propre.');
          s.filter = 'ok'; return good('Filtre rincé et brossé : les trous sont dégagés.');
        case 'membrane_new':
          if (s.head) return bad('La membrane est dans la tête : ferme l’arrivée, puis ouvre la tête du robinet flotteur.');
          s.membrane = 'ok'; return good('Membrane neuve en place, bien centrée.');
        case 'dye':
          if (s.lid) return bad(lidMsg);
          if (s.level < 1) return info('Il n’y a pas assez d’eau dans le réservoir.');
          s.dye = 1; s.bowlDye = 0;
          return info('Quelques gouttes de colorant dans le réservoir. Ne tire pas la chasse : regarde si la cuvette se colore.');
        case 'look_bowl':
          return info(wcBowl(s) + (s.q > 0.05 && !s.flush ? ' On entend aussi l’eau arriver dans le réservoir.' : ''));
      }
      return null;
    },
    faults: [
      { id: 'float', name: 'Flotteur réglé trop haut', listen: '« Ça coule en continu dans la cuvette, et on entend un petit sifflement toute la nuit. »',
        setup: (s) => { s.floatSet = 15.5; s.level = 15; },
        truth: 'La butée du flotteur était réglée au-dessus du trop-plein : le robinet flotteur ne fermait jamais et l’eau partait sans arrêt dans la cuvette. Un réglage suffisait.',
        method: ['Soulever le couvercle : l’eau est au ras du trop-plein et s’y déverse.', 'Baisser la butée du flotteur vers 13 cm, 2 cm sous le trop-plein.', 'Tirer la chasse : le remplissage s’arrête avant le trop-plein.', 'Reposer le couvercle, revisser la bague.'],
        hint: 'Retire le couvercle et regarde où s’arrête l’eau par rapport au haut du trop-plein.' },
      { id: 'membrane', name: 'Membrane du robinet flotteur usée', listen: '« Ça coule en continu dans la cuvette, et on entend un petit sifflement toute la nuit. »',
        setup: (s) => { s.membrane = 'usee'; s.level = 15; },
        truth: 'La membrane du robinet flotteur était usée : même flotteur en haut, l’eau passait encore. Le niveau montait jusqu’au trop-plein.',
        method: ['Soulever le couvercle : l’eau coule dans le trop-plein.', 'Baisser le flotteur : ça coule toujours, ce n’est pas le réglage.', 'Fermer le robinet d’arrêt, ouvrir la tête du robinet flotteur.', 'Changer la membrane, remonter la tête.', 'Rouvrir doucement, tirer la chasse, contrôler le niveau.'],
        hint: 'Si l’eau coule dans le trop-plein même flotteur baissé, c’est le robinet flotteur lui-même qui ne ferme plus.' },
      { id: 'seal', name: 'Joint de cloche usé', listen: '« Ça coule doucement dans la cuvette, et de temps en temps le réservoir se remplit tout seul. »',
        setup: (s) => { s.seal = 'use'; },
        truth: 'Le joint de la cloche était usé, dur et fissuré : l’eau fuyait doucement dans la cuvette et le flotteur relançait un remplissage de temps en temps.',
        method: ['Colorant dans le réservoir : la cuvette se colore sans tirer la chasse.', 'Fermer l’arrivée, vider par une grande chasse.', 'Dévisser la bague, soulever le couvercle, déposer le mécanisme (quart de tour).', 'Poser un joint neuf, reposer le mécanisme.', 'Rouvrir, tirer la chasse : plus rien ne coule.'],
        hint: 'Le test du colorant dit si l’eau passe du réservoir à la cuvette.' },
      { id: 'tartre', name: 'Joint de cloche entartré', listen: '« Ça coule doucement dans la cuvette, et de temps en temps le réservoir se remplit tout seul. »',
        setup: (s) => { s.seal = 'tartre'; },
        truth: 'Du calcaire s’était déposé sur le joint : la cloche ne fermait plus parfaitement. Un nettoyage au vinaigre blanc suffisait, pas besoin de joint neuf.',
        method: ['Colorant dans le réservoir : la cuvette se colore sans tirer la chasse.', 'Fermer l’arrivée, vider par une grande chasse.', 'Déposer le mécanisme : calcaire sur le joint.', 'Nettoyer le joint au vinaigre blanc, reposer.', 'Rouvrir, tirer la chasse : plus rien ne coule.'],
        hint: 'Le test du colorant dit si l’eau passe du réservoir à la cuvette. Ensuite, regarde l’état du joint avant de le changer.' },
      { id: 'filtre', name: 'Filtre du robinet flotteur bouché', listen: '« Après avoir tiré la chasse, le réservoir met des minutes à se remplir. »',
        setup: (s) => { s.filter = 'tartre'; },
        truth: 'Le filtre du robinet flotteur était bouché par le calcaire : l’eau n’entrait plus qu’en filet et le remplissage durait des minutes.',
        method: ['Tirer la chasse : le remplissage est très lent.', 'Fermer le robinet d’arrêt.', 'Ouvrir la tête du robinet flotteur, rincer et brosser le filtre.', 'Remonter la tête, rouvrir doucement, tirer la chasse : remplissage normal.'],
        hint: 'Un remplissage lent vient de l’arrivée d’eau : robinet d’arrêt, ou filtre du robinet flotteur.' },
      { id: 'petite', name: 'Petite chasse trop faible', listen: '« Avec le petit bouton, la cuvette ne se vide pas bien. »',
        setup: (s) => { s.smallVol = 1.5; },
        truth: 'La petite chasse était réglée à 1,5 L : pas assez pour rincer la cuvette. Le bon réglage tourne autour de 3 L.',
        method: ['Tirer la petite chasse : le volume est trop faible.', 'Dévisser la bague, soulever le couvercle.', 'Régler le curseur de la petite chasse vers 3 L.', 'Tester les deux chasses, reposer le couvercle.'],
        hint: 'Le volume de la petite chasse se règle sur le mécanisme.' }
    ],
    check(s, m) {
      return [
        ['Plus d’eau qui part dans la cuvette au repos', s.mech && s.seal === 'ok' && s.membrane === 'ok' && s.floatSet < WOVER - 0.4 && s.over === 0 && s.leak === 0],
        ['Remplissage rapide et complet', s.supply && s.head && s.filter === 'ok' && s.membrane === 'ok'],
        ['Chasses bien réglées (≈ 3 L et ≈ 6 L)', s.floatSet >= 12 && s.floatSet <= 14 && s.smallVol >= 2.5 && s.smallVol <= 3.5],
        ['Essai : grande chasse puis remplissage complet', !!m.flags.test],
        ['Couvercle et bague remis', s.lid && s.ring]
      ];
    },
    missionTick(s, m) {
      const healthy = s.mech && s.seal === 'ok' && s.membrane === 'ok' && s.filter === 'ok' && s.supply && s.head && s.floatSet >= 12 && s.floatSet <= 14;
      if (!healthy) { m.flags.test = false; m.flags.armed = false; return; }
      if (s.flush && s.flush.kind === 'big') m.flags.armed = true;
      if (m.flags.armed && !s.flush && !s.refilling && s.lift === 0) m.flags.test = true;
    }
  };

  /* =====================================================================
     CLIMATISATION : ventilo-convecteur en faux plafond, installation 2 tubes
     ===================================================================== */
  const MODES = { arret: 'ARRÊT', froid: 'FROID', chaud: 'CHAUD', ventil: 'VENTIL' };
  const clRun = (s) => s.breaker && s.mode !== 'arret' && !s.window && !s.grille && !s.trappe && !s.box;
  function clFilter(x, y, w, h, dirty) {
    let o = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${dirty ? '#8b8e86' : '#eef2ef'}" stroke="#7d8a8f"/>`;
    for (let i = x + 4; i < x + w; i += 5) o += `<path d="M${i} ${y + 1}v${h - 2}" stroke="${dirty ? '#73766e' : '#cfd8d3'}"/>`;
    if (dirty) o += `<ellipse cx="${x + w * 0.3}" cy="${y + h / 2}" rx="${(w * 0.14).toFixed(1)}" ry="${(h * 0.35).toFixed(1)}" fill="#6a6c64" opacity=".75"/><ellipse cx="${x + w * 0.72}" cy="${y + h / 2}" rx="${(w * 0.17).toFixed(1)}" ry="${(h * 0.38).toFixed(1)}" fill="#6a6c64" opacity=".65"/>`;
    return o;
  }
  function clPipe(d, col, flow, t) {
    return `<path d="${d}" fill="none" stroke="#33393c" stroke-width="7" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="3.2" stroke-linejoin="round"${flow ? ` stroke-dasharray="6 4" stroke-dashoffset="${dash(t, 22, 10)}"` : ' opacity=".55"'}/>`;
  }
  function clNoises(s) {
    const n = [];
    if (s.fanSpd) n.push(`le ventilateur (vitesse ${s.fanSpd})`);
    if (s.coilAir && s.valve) n.push('un glouglou dans l’appareil');
    if (s.pumpOn) n.push('la pompe qui ronronne');
    if (s.alarm) n.push('un bip régulier là-haut');
    if (s.drip > 0.05) n.push('des gouttes qui tombent');
    return n;
  }
  const CLIM = {
    title: 'Climatisation',
    aria: 'Vue en coupe d’un ventilo-convecteur dans le faux plafond d’une chambre',
    intro: 'Le même appareil que dans le jeu : un ventilo-convecteur caché dans le faux plafond, alimenté en eau glacée (installation 2 tubes). Règle le thermostat, puis ouvre et démonte en sécurité. Le temps est accéléré.',
    realNote: 'Trouve la cause, répare et teste. On ne voit l’intérieur de l’appareil qu’après avoir ouvert la grille, puis la trappe.',
    order: ['thermo', 'fenetre', 'grille', 'filtre', 'ventilateur', 'batterie', 'purgeur', 'vanne', 'trappe', 'bac', 'pompe', 'tuyau', 'boitier', 'soufflage'],
    init() {
      return { mode: 'froid', set: 21, fan: 'auto', roomT: 24.5, outT: 24.5, building: 'ete', window: false,
        breaker: true, lock: false, vat: false, ladder: false, grille: false, filterOut: false, filter: 'ok', trappe: false, box: false,
        bac: 12, drain: 'ok', pump: 'ok', hose: 'ok', coilAir: false, purge: false, purgeT: 0, bucket: false, bucketL: 0, puddle: 0,
        probe: false, demand: false, valve: false, fanSpd: 0, A: 0, pumpOn: false, alarm: false, ang: 0, cond: 0, drip: 0,
        sawFilter: false, sawDrain: false, sawHose: false };
    },
    tick(s, dt, m) {
      const run = clRun(s);
      // Thermostat : compare la chambre à la consigne (écart de 0,3 °C pour ne pas battre).
      if (!run) s.demand = false;
      else if (s.mode === 'froid') { if (s.roomT > s.set + 0.3) s.demand = true; else if (s.roomT < s.set - 0.3) s.demand = false; }
      else if (s.mode === 'chaud') { if (s.roomT < s.set - 0.3) s.demand = true; else if (s.roomT > s.set + 0.3) s.demand = false; }
      else s.demand = false;
      s.valve = run && s.demand;
      const gap = Math.abs(s.roomT - s.set);
      s.fanSpd = !run ? 0 : s.fan === 'auto' ? (s.demand ? (gap > 1.5 ? 3 : 2) : 1) : +s.fan;
      s.A = s.fanSpd ? [0, 0.45, 0.7, 1][s.fanSpd] * (s.filterOut ? 1.1 : s.filter === 'sale' ? 0.22 : 1) : 0;
      const tw = s.building === 'ete' ? 7 : 45, e = s.coilAir ? 0.2 : 1;
      const target = s.A > 0 ? (s.valve ? s.roomT + (tw - s.roomT) * 0.5 * e : s.roomT + 0.4) : s.roomT;
      s.outT += (target - s.outT) * Math.min(1, dt * 1.6);
      const gain = 0.02 * (31 - s.roomT) + (s.window ? 0.06 * (32 - s.roomT) : 0);
      s.roomT = clamp(s.roomT + (gain - 0.08 * s.A * (s.roomT - s.outT)) * dt, 12, 34);
      s.ang = (s.ang + s.fanSpd * 260 * dt) % 360;
      // Condensats : l’humidité de l’air se condense sur la batterie froide et tombe dans le bac.
      s.cond = s.valve && tw < 15 && s.A > 0 ? 1.5 * Math.min(1, s.A) * e : 0;
      let bac = s.bac + s.cond * dt + (s.purge && !s.coilAir ? 3 * dt : 0);
      // Pompe de relevage : alimentée par le disjoncteur clim, elle démarre quand l’eau monte.
      if (s.breaker && s.pump === 'ok' && s.drain === 'ok') { if (bac > 35) s.pumpOn = true; if (bac < 8) s.pumpOn = false; } else s.pumpOn = false;
      let pumped = 0;
      if (s.pumpOn) { pumped = Math.min(bac, 10 * dt); bac -= pumped; }
      s.alarm = s.breaker && s.pump === 'hs' && bac > 80;
      let spill = 0;
      if (bac > 100) { spill = (bac - 100) / Math.max(dt, 1e-3); bac = 100; }
      s.bac = bac;
      // Eau qui tombe dans la chambre : bac qui déborde, ou eau pompée qui sort du tuyau déboîté.
      const lost = spill + (s.hose === 'off' && pumped > 0 ? pumped / Math.max(dt, 1e-3) : 0);
      s.drip += (lost - s.drip) * Math.min(1, dt * 2);
      if (s.drip < 0.02) s.drip = 0;
      if (s.drip > 0) { if (s.bucket) s.bucketL = Math.min(1, s.bucketL + s.drip * dt * 0.004); else s.puddle = Math.min(1, s.puddle + s.drip * dt * 0.004); }
      if (s.purge) { s.purgeT += dt; if (s.coilAir && s.purgeT > 2.2) s.coilAir = false; }
      if (m && s.probe && s.valve && s.outT > s.roomT + 2) m.flags.hot = true;
    },
    sig: (s) => [s.roomT.toFixed(2), s.outT.toFixed(1), s.bac.toFixed(1), s.drip.toFixed(2), s.valve, s.pumpOn, s.alarm, s.puddle.toFixed(2)].join('|'),
    anim: (s) => s.fanSpd > 0 || s.pumpOn || s.drip > 0 || s.purge || s.window || s.alarm || s.cond > 0,
    bg(s) {
      let o = `<defs><radialGradient id="dmglow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff0c4" stop-opacity=".9"/><stop offset="1" stop-color="#fff0c4" stop-opacity="0"/></radialGradient></defs>`;
      o += `<rect width="400" height="330" fill="#efe5d6"/><rect width="400" height="146" fill="#2f3a3f"/><rect width="400" height="20" fill="#a3a39b"/>`;
      for (let x = -20; x < 400; x += 14) o += `<path d="M${x} 20L${x + 20} 0" stroke="#8f8f87" stroke-width="1.2"/>`;
      o += T(8, 14, 'DALLE', { s: 8, mono: true, c: '#3d3d38' });
      o += `<rect y="314" width="400" height="16" fill="#a8794e"/><path d="M0 322H400" stroke="#8d6440"/>`;
      // évacuation des eaux usées, le long de la dalle
      o += `<path d="M332 26H400" stroke="#8d969a" stroke-width="9"/>` + T(392, 44, 'évacuation', { s: 8.5, a: 'end', c: '#c7d0d3' });
      // faux plafond et ses ouvertures
      o += `<rect y="146" width="400" height="10" fill="#ece7dd" stroke="#cfc6b4"/>`;
      for (let x = 0; x < 400; x += 50) o += `<path d="M${x} 146v10" stroke="#d8d1c3"/>`;
      if (s.grille) o += `<rect x="60" y="146" width="92" height="10" fill="#1d2529"/><rect x="56" y="156" width="7" height="88" rx="2" fill="#f6f2ea" stroke="#bfb29c"/>`;
      else { o += `<rect x="60" y="146" width="92" height="10" fill="#f6f2ea" stroke="#bfb29c"/>`; for (let x = 66; x < 150; x += 7) o += `<path d="M${x} 147v8" stroke="#cbbfa8" stroke-width="2.5"/>`; }
      if (s.trappe) o += `<rect x="156" y="146" width="96" height="10" fill="#1d2529"/><rect x="250" y="156" width="7" height="86" rx="2" fill="#ece7dd" stroke="#bfb29c"/>`;
      else o += `<rect x="156" y="146" width="96" height="10" fill="#e6e0d4" stroke="#bfb29c"/><rect x="198" y="149" width="12" height="4" rx="2" fill="#9c9282"/>`;
      o += `<rect x="262" y="146" width="60" height="10" fill="#f6f2ea" stroke="#bfb29c"/>`;
      for (let x = 266; x < 320; x += 6) o += `<path d="M${x} 147l3 8" stroke="#bdb09a" stroke-width="2"/>`;
      // fenêtre
      o += `<rect x="4" y="176" width="40" height="96" fill="#cfe3ee" stroke="#9c8f7a" stroke-width="3"/>`;
      o += s.window ? `<path d="M44 176L64 186V262L44 272Z" fill="#e2f0f6" stroke="#9c8f7a" stroke-width="2"/>` : `<path d="M24 176V272" stroke="#9c8f7a" stroke-width="2"/>`;
      // boîtier du thermostat
      o += `<rect x="344" y="184" width="48" height="60" rx="7" fill="#f6f3ec" stroke="#cfc6b4" stroke-width="1.5"/>`;
      return o;
    },
    dyn(s, t) {
      let o = `<rect x="14" y="30" width="316" height="116" rx="4" fill="#dce2e3" stroke="#8f999c" stroke-width="2"/>`;
      // boîtier électrique
      o += `<rect x="20" y="46" width="38" height="50" rx="3" fill="${s.box ? '#2b3337' : '#f2f2ee'}" stroke="#8f999c" stroke-width="1.5"/>`;
      if (s.box) {
        o += `<path d="M20 46L8 40V102L20 96" fill="#f2f2ee" stroke="#8f999c"/><rect x="23" y="51" width="16" height="9" rx="1" fill="#e9e5dc"/>`;
        o += `<circle cx="27" cy="55.5" r="1.8" fill="#8a5a2b"/><circle cx="31" cy="55.5" r="1.8" fill="#2f6fb0"/><circle cx="35" cy="55.5" r="1.8" fill="#4cc38c"/>`;
        o += `<rect x="43" y="51" width="11" height="19" rx="5" fill="#3b6fb0"/><rect x="23" y="66" width="31" height="25" rx="2" fill="#2e7d4f"/><path d="M27 72h10M27 78h18M27 84h14" stroke="#9fd8b5" stroke-width="1.2"/>`;
      } else o += `<path d="M41 56l-6 11h7l-5 11" fill="none" stroke="#e2a541" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;
      // ventilateur (volute et gaine vers la batterie)
      o += `<rect x="98" y="56" width="68" height="22" fill="#c4cccf"/><circle cx="98" cy="86" r="30" fill="#c4cccf" stroke="#7f8a8e" stroke-width="1.5"/><path d="M98 56H166M126 78H166" stroke="#7f8a8e" stroke-width="1.5"/>`;
      o += `<circle cx="98" cy="86" r="23" fill="#e3e7e8" stroke="#8f9ca1"/>`;
      for (let k = 0; k < 10; k++) {
        const r = (s.ang + k * 36) * Math.PI / 180;
        o += `<path d="M${(98 + 9 * Math.cos(r)).toFixed(1)} ${(86 + 9 * Math.sin(r)).toFixed(1)}L${(98 + 21 * Math.cos(r + 0.4)).toFixed(1)} ${(86 + 21 * Math.sin(r + 0.4)).toFixed(1)}" stroke="#56636a" stroke-width="3" stroke-linecap="round"/>`;
      }
      o += `<circle cx="98" cy="86" r="7" fill="#7f8a8e"/>`;
      if (!s.filterOut) o += clFilter(64, 128, 88, 10, s.filter === 'sale');
      // batterie, purgeur, tuyaux d’eau, vanne et servomoteur
      const hot = s.building === 'hiver';
      const wcol = s.valve ? (hot ? '#e0624f' : '#3d8fd1') : (hot ? '#d9aaa1' : '#9fbfd8');
      o += clPipe('M178 20V46', hot ? '#d9614f' : '#3d8fd1', s.valve, t) + clPipe('M194 46V20', hot ? '#e39a8d' : '#8cbbe0', s.valve, t);
      o += `<rect x="168" y="46" width="36" height="84" rx="2" fill="#aab4b7" stroke="#7f8a8e" stroke-width="1.5"/>`;
      for (let x = 171; x < 204; x += 3.4) o += `<path d="M${x.toFixed(1)} 47V129" stroke="#c6cfd1" stroke-width=".9"/>`;
      for (let r = 0; r < 6; r++) for (let c = 0; c < 2; c++) o += `<circle cx="${178 + c * 16}" cy="${55 + r * 14}" r="4.2" fill="${s.coilAir && r < 3 ? '#f4f7f8' : wcol}" stroke="#5f6b70" stroke-width=".8"/>`;
      o += `<rect x="174" y="30" width="8" height="9" rx="1.5" fill="#9aa1a4" stroke="#5f6b70"/><rect x="154" y="24" width="18" height="14" rx="2" fill="#eceee9" stroke="#8f999c"/><circle cx="163" cy="31" r="2.6" fill="${s.valve ? '#4cc38c' : '#5a615f'}"/>`;
      o += `<rect x="196" y="37" width="9" height="9" rx="2" fill="#b0893c" stroke="#7a5d22"/><rect x="${s.purge ? 203 : 198}" y="33" width="6" height="5" rx="1" fill="#8a6a2a"/>`;
      if (s.purge) {
        for (let i = 0; i < 3; i++) {
          const k = (t * (s.coilAir ? 1.8 : 1.5) + i / 3) % 1;
          o += s.coilAir ? `<circle cx="${(209 + k * 12).toFixed(1)}" cy="${(36 - k * 10).toFixed(1)}" r="${(2 + k * 4).toFixed(1)}" fill="#ffffff" opacity="${(0.85 - k * 0.85).toFixed(2)}"/>`
            : `<ellipse cx="206" cy="${(42 + k * 90).toFixed(1)}" rx="1.8" ry="2.6" fill="#4f9fd6"/>`;
        }
      }
      // bac, pompe de relevage, tuyau vers l’évacuation
      o += `<path d="M160 132H212V144H160Z" fill="#cfd6d8" stroke="#7f8a8e" stroke-width="1.5"/>`;
      const h = 11 * clamp(s.bac / 100, 0, 1);
      if (h > 0.3) o += `<rect x="161.5" y="${(143.5 - h).toFixed(1)}" width="49" height="${h.toFixed(1)}" fill="#6cb9e7" opacity=".85"/>`;
      if (s.cond > 0) for (let i = 0; i < 3; i++) { const k = (t * 1.3 + i / 3) % 1; o += `<ellipse cx="${174 + i * 12}" cy="${(130 + k * 8).toFixed(1)}" rx="1.3" ry="2" fill="#4f9fd6" opacity="${(1 - k).toFixed(2)}"/>`; }
      if (s.bac >= 99.5) o += `<ellipse cx="161" cy="${(146 + ((t * 1.2) % 1) * 8).toFixed(1)}" rx="1.6" ry="2.4" fill="#4f9fd6"/>`;
      o += `<path d="M212 140H222" stroke="#c9d1d6" stroke-width="4"/>`;
      if (s.drain === 'bouche') o += `<circle cx="216" cy="140" r="3.6" fill="#6b4f2a"/>`;
      o += `<rect x="222" y="116" width="30" height="28" rx="4" fill="#e9edef" stroke="#7f8a8e" stroke-width="1.5"/>` + T(237, 139, 'POMPE', { s: 6.5, a: 'middle', mono: true, c: '#3a4652' });
      const led = s.pumpOn ? '#4cc38c' : s.alarm ? (Math.floor(t * 2) % 2 ? '#ef6152' : '#5a2a26') : '#5a615f';
      o += `<circle cx="246" cy="122" r="2.6" fill="${led}"/>`;
      const hp = 'M237 116V40H326V26H334';
      if (s.hose === 'ok') {
        o += `<path d="${hp}" fill="none" stroke="#e8ecee" stroke-width="5" stroke-linejoin="round"/><rect x="233" y="110" width="8" height="4" rx="1" fill="#e2a541"/>`;
        if (s.pumpOn) o += `<path d="${hp}" fill="none" stroke="#4f9fd6" stroke-width="2.2" stroke-dasharray="5 5" stroke-dashoffset="${dash(t, 40, 10)}" stroke-linejoin="round"/>`;
      } else {
        o += `<path d="M244 102V40H326V26H334" fill="none" stroke="#e8ecee" stroke-width="5" stroke-linejoin="round"/><rect x="234" y="111" width="6" height="5" fill="#c9d1d6"/>`;
        if (s.pumpOn) for (let i = 0; i < 4; i++) { const k = (t * 2 + i / 4) % 1; o += `<ellipse cx="${(237 + Math.sin(i * 2) * 3).toFixed(1)}" cy="${(116 + k * 30).toFixed(1)}" rx="1.6" ry="2.4" fill="#4f9fd6"/>`; }
      }
      // l’air : chambre → filtre → ventilateur → batterie → soufflage → chambre
      if (s.A > 0) {
        const op = clamp(0.25 + s.A * 0.6, 0.25, 0.9).toFixed(2), sp = 18 + s.A * 30, d = s.outT - s.roomT;
        const col = d < -2 ? '#6cb9e7' : d > 2 ? '#ef8a52' : '#c9c2b2';
        [82, 106, 130].forEach((x) => { o += `<path d="M${x} 236C${x} 204 ${x + 4} 180 ${x} 160" fill="none" stroke="#b39f7c" stroke-width="2" stroke-dasharray="6 6" stroke-dashoffset="${dash(t, sp, 12)}" opacity="${op}"/>`; });
        o += `<path d="M106 126C106 120 100 116 98 112" fill="none" stroke="#9a8a6a" stroke-width="2" stroke-dasharray="4 4" stroke-dashoffset="${dash(t, sp, 8)}" opacity="${op}"/>`;
        o += `<path d="M130 67H164" stroke="#9a8a6a" stroke-width="2.4" stroke-dasharray="6 5" stroke-dashoffset="${dash(t, sp, 11)}" opacity="${op}"/>`;
        o += `<path d="M207 88H262C282 88 292 108 292 142" fill="none" stroke="${col}" stroke-width="2.8" stroke-dasharray="6 5" stroke-dashoffset="${dash(t, sp, 11)}" opacity="${op}"/>`;
        [272, 292, 312].forEach((x, i) => { o += `<path d="M${x} 158C${x + (i - 1) * 6} 186 ${x + (i - 1) * 14} 208 ${x + (i - 1) * 22} 234" fill="none" stroke="${col}" stroke-width="2.4" stroke-dasharray="6 6" stroke-dashoffset="${dash(t, sp, 12)}" opacity="${op}"/>`; });
      }
      if (s.window) [198, 222, 246].forEach((y) => { o += `<path d="M8 ${y}H78" stroke="#ef8a52" stroke-width="2" stroke-dasharray="6 6" stroke-dashoffset="${dash(t, 20, 12)}" opacity=".75"/>`; });
      // thermostat : écran
      o += `<rect x="350" y="190" width="36" height="25" rx="3" fill="${s.breaker ? '#a9d8c6' : '#6f7774'}"/>`;
      if (s.breaker) {
        o += T(368, 199.5, MODES[s.mode], { s: 6.8, a: 'middle', mono: true, c: '#10302a', w: 600 }) + T(368, 211, `${f1(s.roomT)}°`, { s: 9, a: 'middle', mono: true, c: '#10302a', w: 600 });
        if (s.window && s.mode !== 'arret' && Math.floor(t * 2) % 2 === 0) o += `<rect x="378" y="192" width="6" height="6" fill="none" stroke="#9c2b20" stroke-width="1.3"/>`;
      }
      o += T(368, 228, `consigne ${f1(s.set)}°`, { s: 7, a: 'middle', c: '#3a4652' }) + `<circle cx="360" cy="236" r="3" fill="#d8d1c3"/><circle cx="376" cy="236" r="3" fill="#d8d1c3"/>`;
      // chambre
      o += T(8, 294, 'chambre', { s: 10, c: '#6b5f50' }) + T(8, 309, `${f1(s.roomT)} °C`, { s: 15, mono: true, w: 600, c: '#2f3a3f' });
      if (s.filterOut) o += clFilter(96, 302, 86, 8, s.filter === 'sale') + T(139, 297, 'filtre posé au sol', { s: 9, a: 'middle', c: '#6b5f50' });
      if (s.ladder) {
        o += `<path d="M188 314L206 198M232 314L214 198M204 198H216" stroke="#8a8f93" stroke-width="4" stroke-linecap="round" fill="none"/>`;
        [226, 254, 282].forEach((y) => { const k = (314 - y) / 116 * 18; o += `<path d="M${(188 + k).toFixed(1)} ${y}H${(232 - k).toFixed(1)}" stroke="#8a8f93" stroke-width="3"/>`; });
      }
      if (s.drip > 0.02) {
        const bottom = s.bucket ? 298 : 312;
        for (let i = 0; i < 3; i++) { const k = (t * 0.9 + i / 3) % 1; o += `<ellipse cx="200" cy="${(158 + k * (bottom - 158)).toFixed(1)}" rx="2" ry="3" fill="#4f9fd6"/>`; }
      }
      if (s.puddle > 0.01) o += `<ellipse cx="200" cy="318" rx="${(8 + s.puddle * 34).toFixed(1)}" ry="${(2 + s.puddle * 2).toFixed(1)}" fill="#6cb9e7" opacity=".55"/>`;
      if (s.bucket) {
        o += `<path d="M184 296H216L212 314H188Z" fill="#4c86a8" stroke="#2f5d78" stroke-width="1.5"/>`;
        if (s.bucketL > 0.01) o += `<rect x="188" y="${(312 - s.bucketL * 12).toFixed(1)}" width="24" height="${(s.bucketL * 12).toFixed(1)}" fill="#9fd0ec" opacity=".85"/>`;
      }
      if (s.probe) {
        o += `<rect x="290" y="160" width="4" height="16" rx="2" fill="#e9eef0" stroke="#7d8a8f"/><circle cx="292" cy="178" r="3.4" fill="#ef6152"/>`;
        o += `<rect x="300" y="160" width="40" height="20" rx="4" fill="#0f1a20" opacity=".9"/>` + T(320, 174, `${f1(s.outT)}°`, { s: 11, a: 'middle', mono: true, c: '#6cb9e7', w: 600 });
      }
      return o;
    },
    fg(s, m) {
      if (!real(m)) return '';
      const cover = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#d4dadb" stroke="#8f999c" stroke-width="1.5"/>`;
      if (!s.grille && !s.trappe) return cover(14, 30, 316, 116) + T(172, 84, 'Appareil fermé', { s: 13, a: 'middle', w: 700, c: '#5b676c' }) + T(172, 102, 'ouvre la grille de reprise pour voir dedans', { s: 10.5, a: 'middle', c: '#6b777c' });
      if (!s.trappe) return cover(156, 131, 58, 15) + cover(214, 104, 44, 42) + T(236, 122, 'trappe', { s: 8.5, a: 'middle', c: '#5b676c' }) + T(236, 133, 'fermée', { s: 8.5, a: 'middle', c: '#5b676c' });
      return '';
    },
    hot(s, m) {
      const open = !real(m) || s.grille || s.trappe;
      const H = [
        ['thermo', 'Thermostat', 342, 182, 52, 64, 342, 186],
        ['fenetre', 'Fenêtre', 2, 172, 66, 104, 30, 180],
        ['soufflage', 'Bouche de soufflage', 258, 140, 68, 26, 324, 150],
        s.grille ? ['grille', 'Grille de reprise (ouverte)', 50, 154, 20, 94, 70, 166] : ['grille', 'Grille de reprise', 58, 142, 96, 18, 58, 151],
        s.trappe ? ['trappe', 'Trappe de visite (ouverte)', 244, 154, 20, 92, 266, 166] : ['trappe', 'Trappe de visite', 154, 142, 100, 18, 154, 151],
        ['boitier', 'Boîtier électrique', 16, 42, 46, 58, 18, 44]
      ];
      if (s.filterOut) H.push(['filtre', 'Filtre posé au sol', 90, 290, 98, 26, 90, 306]);
      if (open) {
        if (!s.filterOut) H.push(['filtre', 'Filtre', 62, 122, 92, 22, 66, 126]);
        H.push(['ventilateur', 'Ventilateur', 66, 54, 64, 64, 128, 58]);
        H.push(['batterie', 'Batterie', 164, 48, 44, 80, 208, 96]);
        H.push(['purgeur', 'Purgeur d’air', 194, 28, 22, 20, 214, 32]);
        H.push(['vanne', 'Vanne et servomoteur', 152, 20, 34, 22, 150, 30]);
      }
      if (!real(m) || s.trappe) {
        H.push(['bac', 'Bac à condensats', 156, 128, 58, 20, 162, 128]);
        H.push(['pompe', 'Pompe de relevage', 218, 112, 38, 34, 256, 116]);
        H.push(['tuyau', 'Tuyau de la pompe', 228, 42, 20, 66, 248, 62]);
      }
      return H;
    },
    now(s, m) {
      const hid = real(m);
      if (!s.breaker) return 'Disjoncteur clim coupé : plus de courant, ni ventilateur, ni vanne, ni pompe.';
      if (s.window && s.mode !== 'arret') return 'Fenêtre ouverte : son contact coupe la clim. Le pictogramme fenêtre clignote sur le thermostat.';
      if (s.drip > 0.05) return 'De l’eau tombe du faux plafond dans la chambre !';
      if (s.mode === 'arret') return s.grille || s.trappe || s.box ? 'Clim arrêtée et ouverte : on peut travailler dedans.' : 'Clim arrêtée au thermostat. Attention : le courant, lui, est toujours là (la pompe peut tourner).';
      if (s.valve && s.building === 'hiver') return 'La vanne est ouverte, mais le bâtiment envoie de l’eau chaude : la clim souffle chaud, même en FROID.';
      if (s.valve && s.mode === 'chaud') return 'Mode CHAUD : la vanne laisse passer l’eau du bâtiment dans la batterie.';
      if (s.valve) {
        if (s.coilAir) return hid ? 'La vanne est ouverte et le ventilateur tourne, mais l’air sort à peine frais.' : 'La batterie est à moitié pleine d’air : l’eau glacée circule mal, l’air sort à peine frais.';
        if (s.filter === 'sale' && !s.filterOut) return hid ? 'Le ventilateur tourne, mais très peu d’air sort de la bouche de soufflage.' : 'Le filtre encrassé freine l’air : peu de débit, la chambre refroidit à peine.';
        return 'Vanne ouverte : l’eau glacée traverse la batterie, l’air ressort froid. L’humidité tombe en gouttes dans le bac.';
      }
      if (s.mode === 'ventil') return 'Ventilation seule : l’air est brassé, ni refroidi ni chauffé.';
      if (s.mode === 'chaud') return 'Mode CHAUD : la chambre est déjà plus chaude que la consigne, la vanne reste fermée. L’air soufflé est à température de la pièce.';
      return 'Consigne atteinte : la vanne se ferme, le ventilateur tourne au ralenti.';
    },
    status(s, m) {
      const hid = real(m), noise = clNoises(s);
      const L = [
        ['Chambre', `${f1(s.roomT)} °C`, s.roomT > s.set + 2 && s.mode === 'froid' ? 'warn' : ''],
        ['Thermostat', s.breaker ? `${MODES[s.mode]} · ${f1(s.set)} °C` : 'éteint', s.breaker ? '' : 'warn'],
        ['Air soufflé', s.probe ? `${f1(s.outT)} °C` : 'pose le thermomètre', ''],
        ['On entend', noise.length ? noise.join(', ') : 'rien', s.alarm || (s.coilAir && s.valve) ? 'bad' : ''],
        ['Gouttes', s.drip > 0.05 ? 'ça goutte !' : 'sec', s.drip > 0.05 ? 'bad' : 'ok']
      ];
      if (!hid || s.grille) L.splice(3, 0, ['Ventilateur', s.fanSpd ? `vitesse ${s.fanSpd}` : 'arrêté', ''], ['Vanne', s.valve ? 'ouverte' : 'fermée', '']);
      if (!hid || s.trappe) L.push(['Bac', `${Math.round(s.bac)} %`, s.bac >= 99 ? 'bad' : s.bac > 60 ? 'warn' : ''], ['Pompe', !s.breaker ? 'sans courant' : s.pumpOn ? 'en marche' : s.alarm ? 'alarme' : 'attend', s.alarm ? 'bad' : '']);
      return L;
    },
    quick: (s) => [['ladder', s.ladder ? 'Escabeau en place' : 'Escabeau', s.ladder], ['bucket', s.bucket ? 'Bassine posée' : 'Bassine', s.bucket], ['probe', 'Thermomètre au soufflage', s.probe], ['listen', 'Écouter l’appareil'],
      [s.breaker ? 'breaker_off' : 'breaker_on', s.breaker ? 'Couper le disjoncteur clim' : 'Réarmer le disjoncteur clim', !s.breaker], [s.lock ? 'lock_off' : 'lock_on', s.lock ? 'Retirer le cadenas' : 'Poser le cadenas', s.lock], ['vat', s.vat ? 'VAT : 0 V vérifié' : 'Vérifier au VAT', s.vat]],
    parts: {
      thermo: { name: 'Thermostat d’ambiance', role: 'Il compare la température de la chambre à la consigne et commande la vanne et le ventilateur. Modes : ARRÊT, FROID, CHAUD, VENTILATION. Le pictogramme fenêtre clignote si la fenêtre est ouverte.',
        state: (s) => s.breaker ? `${MODES[s.mode]} · consigne ${f1(s.set)} °C · chambre ${f1(s.roomT)} °C` : 'Écran éteint : disjoncteur coupé',
        acts: (s) => [[s.mode === 'arret' ? 'mode_froid' : 'mode_arret', s.mode === 'arret' ? 'Remettre en FROID' : 'Arrêter la clim'], ['set_down', 'Consigne −0,5 °C'], ['set_up', 'Consigne +0,5 °C']] },
      fenetre: { name: 'Fenêtre et son contact', role: 'Un contact sur la fenêtre coupe la clim dès qu’on l’ouvre, pour ne pas refroidir la rue.',
        state: (s) => s.window ? 'Ouverte : la clim est coupée' : 'Fermée', acts: (s) => [['window', s.window ? 'Fermer la fenêtre' : 'Ouvrir la fenêtre']] },
      grille: { name: 'Grille de reprise', role: 'L’air de la chambre est aspiré par ici. Elle s’ouvre sur une charnière : derrière, il y a le filtre. On n’ouvre qu’appareil arrêté.',
        state: (s) => s.grille ? 'Ouverte' : 'Fermée', acts: (s) => [s.grille ? ['grille_close', 'Refermer la grille'] : ['grille_open', 'Ouvrir la grille']] },
      filtre: { name: 'Filtre', role: 'Il retient la poussière avant la batterie. Encrassé, l’air passe mal : la clim souffle peu et ne refroidit plus la chambre. Il se nettoie à l’aspirateur.',
        state: (s, m) => {
          const seen = !real(m) || s.grille || s.filterOut;
          return (s.filterOut ? 'Sorti, posé au sol' : 'En place') + (seen ? (s.filter === 'sale' ? ' · gris de poussière' : ' · propre') : ' · derrière la grille');
        },
        acts: (s) => s.filterOut ? [['filter_clean', 'Aspirer le filtre'], ['filter_in', 'Remettre le filtre']] : [['filter_out', 'Sortir le filtre']] },
      ventilateur: { name: 'Ventilateur', role: 'Il aspire l’air de la chambre et le pousse à travers la batterie. Trois vitesses : plus vite, plus d’air et plus de bruit.',
        state: (s) => s.fanSpd ? `Tourne en vitesse ${s.fanSpd}` : 'À l’arrêt', acts: () => [['listen', 'Écouter']] },
      batterie: { name: 'Batterie (échangeur)', role: 'Des tubes de cuivre et des ailettes en aluminium. L’eau glacée passe dans les tubes, l’air passe entre les ailettes et se refroidit. Avec de l’air dans les tubes, l’eau circule mal.',
        state: (s, m) => (s.valve ? 'L’eau circule' : 'Pas de circulation') + (!real(m) && s.coilAir ? ' · de l’air en haut des tubes' : ''), acts: () => [['listen', 'Écouter (glouglou ?)']] },
      purgeur: { name: 'Purgeur d’air', role: 'Petite vis en haut de la batterie. On l’ouvre d’un quart de tour, chiffon dessous : l’air sort en sifflant, et on referme dès que l’eau sort sans bulles.',
        state: (s) => s.purge ? (s.coilAir ? 'Ouvert : de l’air sort' : 'Ouvert : de l’eau sort') : 'Fermé', acts: (s) => [s.purge ? ['purge_close', 'Refermer le purgeur'] : ['purge_open', 'Ouvrir le purgeur']] },
      vanne: { name: 'Vanne et servomoteur', role: 'Le thermostat commande le servomoteur, qui ouvre la vanne : l’eau du bâtiment entre dans la batterie. Voyant vert : vanne ouverte.',
        state: (s) => s.valve ? 'Ouverte (voyant vert)' : 'Fermée', acts: () => [] },
      trappe: { name: 'Trappe de visite', role: 'Elle donne accès au bac, à la pompe, au tuyau et au purgeur. Elle se déverrouille derrière la grille de reprise.',
        state: (s) => s.trappe ? 'Ouverte' : 'Fermée', acts: (s) => [s.trappe ? ['trappe_close', 'Refermer la trappe'] : ['trappe_open', 'Ouvrir la trappe']] },
      bac: { name: 'Bac à condensats', role: 'L’humidité de l’air se transforme en eau sur la batterie froide : les gouttes tombent dans ce bac, puis vers la pompe. S’il déborde, ça goutte dans la chambre.',
        state: (s, m) => real(m) && !s.trappe ? 'Derrière la trappe.' : `Rempli à ${Math.round(s.bac)} %` + (s.trappe || !real(m) ? (s.drain === 'bouche' ? ' · sortie bouchée par des dépôts' : ' · sortie libre') : ''),
        acts: () => [['bac_empty', 'Vider à l’éponge'], ['drain_clean', 'Déboucher l’évacuation'], ['pour', 'Verser de l’eau pour tester']] },
      pompe: { name: 'Pompe de relevage', role: 'Elle remonte l’eau du bac jusqu’à l’évacuation. Elle démarre seule quand l’eau monte. En panne, son alarme bipe. Elle se remplace par le frigoriste.',
        state: (s, m) => real(m) && !s.trappe ? 'Derrière la trappe.' : !s.breaker ? 'Sans courant' : s.pumpOn ? 'En marche' : s.alarm ? 'Arrêtée, alarme qui bipe' : 'En attente',
        acts: () => [['pump_look', 'Regarder et écouter la pompe'], ['pour', 'Verser de l’eau pour tester']] },
      tuyau: { name: 'Tuyau de la pompe', role: 'Il emmène l’eau pompée jusqu’à l’évacuation. Il est tenu par un collier sur la sortie de la pompe.',
        state: (s, m) => real(m) && !s.sawHose ? 'À contrôler.' : s.hose === 'off' ? 'Déboîté de la pompe' : 'Bien emboîté, collier serré',
        acts: () => [['hose_look', 'Contrôler le tuyau'], ['hose_fix', 'Rebrancher avec un collier neuf']] },
      boitier: { name: 'Boîtier électrique', role: 'Arrivée 230 V, condensateur du moteur et carte de régulation. On ne l’ouvre qu’après avoir coupé le disjoncteur clim, posé son cadenas et vérifié au VAT.',
        state: (s) => (s.box ? 'Ouvert' : 'Fermé') + ` · disjoncteur ${s.breaker ? 'enclenché' : 'coupé'}${s.lock ? ', cadenas posé' : ''}${s.vat ? ', 0 V vérifié' : ''}`,
        acts: (s) => s.box ? [['box_close', 'Refermer le boîtier']] : [[s.breaker ? 'breaker_off' : 'breaker_on', s.breaker ? 'Couper le disjoncteur clim' : 'Réarmer le disjoncteur'], [s.lock ? 'lock_off' : 'lock_on', s.lock ? 'Retirer le cadenas' : 'Poser le cadenas'], ['vat', 'Vérifier au VAT'], ['box_open', 'Ouvrir le boîtier']] },
      soufflage: { name: 'Bouche de soufflage', role: 'L’air traité ressort ici. Un thermomètre devant la bouche donne la température de l’air soufflé : en froid, 12 à 16 °C, c’est normal.',
        state: (s) => s.probe ? `Air soufflé : ${f1(s.outT)} °C` : 'Pas de thermomètre posé', acts: (s) => [['probe', s.probe ? 'Retirer le thermomètre' : 'Poser le thermomètre']] }
    },
    adjust: [
      { id: 'mode', label: 'Mode', seg: [['mode_arret', 'ARRÊT', (s) => s.mode === 'arret'], ['mode_froid', 'FROID', (s) => s.mode === 'froid'], ['mode_chaud', 'CHAUD', (s) => s.mode === 'chaud'], ['mode_ventil', 'VENTIL', (s) => s.mode === 'ventil']],
        lock: (s) => s.breaker ? null : 'Thermostat éteint : le disjoncteur clim est coupé.' },
      { id: 'set', label: 'Consigne', val: (s) => `${f1(s.set)} °C`, hint: '21 à 24 °C en été.', minus: 'set_down', plus: 'set_up',
        lock: (s) => s.breaker ? null : 'Thermostat éteint.' },
      { id: 'fan', label: 'Ventilation', seg: [['fan_auto', 'AUTO', (s) => s.fan === 'auto'], ['fan_1', '1', (s) => s.fan === '1'], ['fan_2', '2', (s) => s.fan === '2'], ['fan_3', '3', (s) => s.fan === '3']],
        lock: (s) => s.breaker ? null : 'Thermostat éteint.' },
      { id: 'season', label: 'Bâtiment (réglé en chaufferie)', seg: [['season_ete', 'Été : eau glacée', (s) => s.building === 'ete'], ['season_hiver', 'Hiver : eau chaude', (s) => s.building === 'hiver']],
        lock: (s, m) => m ? 'Pendant une panne, ce n’est pas réglable depuis la chambre.' : null, hint: 'Installation 2 tubes : tout l’hôtel reçoit la même eau.' }
    ],
    how: [
      ['Le thermostat compare.', 'Chambre plus chaude que la consigne en mode FROID : il demande du froid.', (s) => clRun(s) && s.demand],
      ['Aspiration et filtre.', 'Le ventilateur aspire l’air de la chambre par la grille de reprise ; le filtre retient la poussière.', (s) => s.A > 0],
      ['La batterie refroidit l’air.', 'La vanne s’ouvre : l’eau glacée (7 °C) traverse la batterie. L’air passe entre les ailettes et se refroidit.', (s) => s.valve],
      ['Soufflage.', 'L’air frais ressort par la bouche de soufflage, 12 à 16 °C environ.', (s) => s.A > 0 && s.valve],
      ['Les condensats.', 'L’humidité de l’air se condense sur la batterie froide. Les gouttes tombent dans le bac ; la pompe de relevage les envoie à l’évacuation.', (s) => s.cond > 0 || s.pumpOn],
      ['Installation 2 tubes.', 'Le bâtiment envoie soit de l’eau glacée (été), soit de l’eau chaude (hiver), pour tout l’hôtel.', (s) => s.building === 'hiver']
    ],
    gamme: { title: 'Avant d’ouvrir, dans l’ordre', steps: [
      ['Arrêter la clim au thermostat.', (s) => s.mode === 'arret' || !s.breaker],
      ['Installer l’escabeau.', (s) => s.ladder],
      ['Ouvrir la grille de reprise : filtre.', (s) => s.grille],
      ['Ouvrir la trappe : bac, pompe, tuyau, purgeur.', (s) => s.trappe],
      ['Boîtier électrique : couper le disjoncteur, cadenas, VAT, puis ouvrir.', (s) => s.box]
    ], note: 'Remontage dans l’ordre inverse, remise en marche, puis attendre et contrôler la température.' },
    act(s, id, m) {
      const stopped = s.mode === 'arret' || !s.breaker;
      const ladderMsg = 'Mets d’abord l’escabeau : la clim est dans le faux plafond.';
      const trappeMsg = 'C’est derrière la trappe de visite : ouvre-la d’abord.';
      if (id.startsWith('mode_')) {
        if (!s.breaker) return info('Écran éteint : le disjoncteur clim est coupé.');
        const md = id.slice(5);
        const open = [s.grille && 'la grille', s.trappe && 'la trappe', s.box && 'le boîtier électrique'].filter(Boolean);
        if (md !== 'arret' && open.length) return bad(`Referme d’abord ${open.join(', ')} avant de remettre en marche.`);
        s.mode = md; s.demand = false;
        return info({ arret: 'Clim arrêtée au thermostat : le ventilateur s’arrête, la vanne se ferme. Le courant, lui, est toujours là.', froid: 'Mode FROID : si la chambre est plus chaude que la consigne, la vanne s’ouvre et l’air est refroidi.', chaud: 'Mode CHAUD : l’appareil ne fait quelque chose que si la chambre est plus froide que la consigne.', ventil: 'Mode VENTILATION : le ventilateur brasse l’air, sans froid ni chaud.' }[md]);
      }
      if (id.startsWith('fan_')) {
        if (!s.breaker) return info('Écran éteint : le disjoncteur clim est coupé.');
        s.fan = id.slice(4); return info(s.fan === 'auto' ? 'Ventilation AUTO : vite quand l’écart est grand, doucement près de la consigne.' : `Ventilation forcée en vitesse ${s.fan}.`);
      }
      if (id.startsWith('season_')) {
        if (m) return info('Ça se règle en chaufferie, pour tout l’hôtel : pas depuis la chambre.');
        s.building = id.slice(7);
        return info(s.building === 'hiver' ? 'Bâtiment en hiver : l’eau qui circule est chaude (45 °C). En 2 tubes, aucune chambre ne peut faire du froid.' : 'Bâtiment en été : eau glacée (7 °C).');
      }
      switch (id) {
        case 'set_up': case 'set_down':
          if (!s.breaker) return info('Écran éteint : le disjoncteur clim est coupé.');
          s.set = clamp(s.set + (id === 'set_up' ? 0.5 : -0.5), 16, 30);
          return info(`Consigne ${f1(s.set)} °C.` + (s.set < 19 ? ' Très bas : inconfortable et gaspilleur ; 21 à 24 °C suffisent en été.' : ''));
        case 'window':
          s.window = !s.window;
          return info(s.window ? 'Fenêtre ouverte : son contact coupe la clim et le pictogramme clignote sur le thermostat.' : 'Fenêtre fermée : la clim peut redémarrer.');
        case 'ladder':
          if (s.ladder && (s.grille || s.trappe || s.box || s.purge || s.filterOut)) return bad('Referme tout et remets le filtre avant de ranger l’escabeau.');
          s.ladder = !s.ladder; return info(s.ladder ? 'Escabeau en place sous la clim, bien ouvert et calé.' : 'Escabeau rangé.');
        case 'bucket':
          s.bucket = !s.bucket; if (!s.bucket) s.bucketL = 0;
          return info(s.bucket ? 'Bassine posée sous les gouttes : le sol et le bureau sont protégés.' : 'Bassine vidée et retirée.');
        case 'probe':
          s.probe = !s.probe;
          return info(s.probe ? 'Thermomètre posé devant la bouche de soufflage. En froid, 12 à 16 °C, c’est normal.' : 'Thermomètre retiré.');
        case 'listen': {
          const n = clNoises(s);
          return info(n.length ? 'On entend : ' + n.join(', ') + '.' : 'Silence : l’appareil est à l’arrêt.');
        }
        case 'breaker_off':
          if (!s.breaker) return info('Il est déjà coupé.');
          s.breaker = false; s.vat = false;
          return info('Disjoncteur clim coupé au tableau de la chambre : plus de courant dans l’appareil, pompe comprise.');
        case 'breaker_on':
          if (s.breaker) return info('Il est déjà enclenché.');
          if (s.box) return danger('Referme le boîtier électrique avant de remettre le courant.');
          if (s.lock) return bad('Ton cadenas est encore sur le disjoncteur : retire-le d’abord.');
          s.breaker = true; s.vat = false; return good('Disjoncteur réarmé : l’appareil est de nouveau sous tension.');
        case 'lock_on':
          if (s.lock) return info('Le cadenas est déjà posé.');
          if (s.breaker) return bad('Coupe d’abord le disjoncteur : on condamne un appareil coupé.');
          s.lock = true; return info('Cadenas et étiquette posés : personne ne peut remettre le courant pendant que tu travailles.');
        case 'lock_off':
          if (!s.lock) return info('Il n’y a pas de cadenas.');
          if (s.box) return danger('Referme le boîtier avant de retirer ta consignation.');
          s.lock = false; s.vat = false; return info('Cadenas retiré.');
        case 'vat':
          if (s.breaker) { s.vat = false; return info('VAT : 230 V. L’appareil est sous tension : coupe d’abord le disjoncteur clim.'); }
          s.vat = true; return good('VAT testé sur une prise, 0 V au bornier, puis re-testé : absence de tension vérifiée.');
        case 'grille_open':
          if (s.grille) return info('Elle est déjà ouverte.');
          if (!s.ladder) return bad(ladderMsg);
          if (!stopped) return danger('Arrête d’abord la clim au thermostat : le ventilateur tourne juste derrière la grille.');
          s.grille = true; s.sawFilter = true;
          return info(`Grille de reprise ouverte, retenue par sa charnière. Le filtre est juste derrière : ${s.filter === 'sale' ? 'gris de poussière.' : 'propre.'}`);
        case 'grille_close':
          if (!s.grille) return info('Elle est déjà fermée.');
          if (s.filterOut) return bad('Remets le filtre avant de refermer : sans filtre, la poussière encrasse la batterie.');
          if (s.trappe) return bad('Referme d’abord la trappe : elle se verrouille derrière la grille.');
          s.grille = false; return good('Grille refermée et clipsée.');
        case 'filter_out':
          if (s.filterOut) return info('Il est déjà sorti.');
          if (!s.grille) return bad('Le filtre est derrière la grille de reprise : ouvre-la d’abord.');
          s.filterOut = true; return info('Filtre sorti, posé au sol sur une protection.');
        case 'filter_clean': {
          if (!s.filterOut) return bad('Sors d’abord le filtre.');
          const was = s.filter; s.filter = 'ok';
          return good(was === 'sale' ? 'Filtre aspiré des deux côtés : la poussière est partie.' : 'Filtre aspiré : il était déjà propre.');
        }
        case 'filter_in':
          if (!s.filterOut) return info('Il est déjà en place.');
          if (!s.grille) return bad('Ouvre la grille pour remettre le filtre.');
          s.filterOut = false; return good('Filtre remis dans ses glissières, dans le bon sens.');
        case 'trappe_open':
          if (s.trappe) return info('Elle est déjà ouverte.');
          if (!s.ladder) return bad(ladderMsg);
          if (!stopped) return danger('Arrête d’abord la clim au thermostat avant d’ouvrir.');
          if (!s.grille) return bad('Ouvre d’abord la grille de reprise : la trappe se déverrouille derrière.');
          s.trappe = true; s.sawDrain = true;
          return info(`Trappe ouverte : on voit le bac à condensats (rempli à ${Math.round(s.bac)} %), la pompe de relevage et son tuyau.`);
        case 'trappe_close':
          if (!s.trappe) return info('Elle est déjà fermée.');
          if (s.purge) return bad('Referme d’abord le purgeur.');
          s.trappe = false; return good('Trappe refermée.');
        case 'bac_empty':
          if (!s.trappe) return bad(trappeMsg);
          s.bac = 0; return info('Bac vidé à l’éponge, dans un seau.');
        case 'drain_clean': {
          if (!s.trappe) return bad(trappeMsg);
          const was = s.drain; s.drain = 'ok';
          return good(was === 'bouche' ? 'Sortie du bac débouchée au goupillon : un bouchon de dépôts et de boue est sorti.' : 'Sortie du bac contrôlée : elle était libre.');
        }
        case 'pour':
          if (!s.trappe) return bad(trappeMsg);
          s.bac = Math.min(100, s.bac + 45);
          return info('Tu verses un verre d’eau dans le bac : regarde si la pompe démarre et où part l’eau.');
        case 'pump_look':
          if (!s.trappe) return bad(trappeMsg);
          if (!s.breaker) return info('Pompe arrêtée : normal, le disjoncteur clim est coupé, elle n’a plus de courant.');
          if (s.pump === 'hs') {
            if (s.bac > 35) { if (m) m.flags.pumpSeen = true; return info('Le bac est plein, mais la pompe ne démarre pas et son alarme bipe : pompe hors service.'); }
            return info('La pompe ne bouge pas. Verse de l’eau dans le bac pour la tester.');
          }
          if (s.drain === 'bouche') return info('La pompe attend : l’eau du bac n’arrive pas jusqu’à elle. La sortie du bac serait-elle bouchée ?');
          return info(s.pumpOn ? 'Elle tourne : on l’entend ronronner et l’eau part dans le tuyau.' : 'Elle attend : elle démarre toute seule quand l’eau monte dans le bac.');
        case 'hose_look':
          if (!s.trappe) return bad(trappeMsg);
          s.sawHose = true;
          return info(s.hose === 'off' ? 'Le tuyau est déboîté à la sortie de la pompe : l’eau pompée tombe dans le faux plafond.' : 'Tuyau bien emboîté, collier serré.');
        case 'hose_fix':
          if (!s.trappe) return bad(trappeMsg);
          s.sawHose = true;
          if (s.hose === 'ok') return info('Il est déjà bien branché.');
          s.hose = 'ok'; return good('Tuyau rebranché sur la pompe avec un collier neuf, bien serré.');
        case 'purge_open':
          if (s.purge) return info('Il est déjà ouvert.');
          if (!s.ladder) return bad(ladderMsg);
          if (!s.trappe) return bad('Le purgeur est en haut de la batterie, derrière la trappe : ouvre-la.');
          s.purge = true; s.purgeT = 0;
          return info(s.coilAir ? 'Purgeur ouvert d’un quart de tour, chiffon dessous : pschhh… de l’air sort.' : 'Purgeur ouvert : de l’eau sort tout de suite, il n’y a pas d’air. Referme.');
        case 'purge_close':
          if (!s.purge) return info('Il est déjà fermé.');
          s.purge = false;
          return info(s.coilAir ? 'Purgeur refermé, mais il restait de l’air dans la batterie.' : 'Purgeur refermé dès que l’eau est sortie sans bulles.');
        case 'box_open':
          if (s.box) return info('Il est déjà ouvert.');
          if (!s.ladder) return bad(ladderMsg);
          if (s.breaker) return danger('Boîtier sous tension ! Coupe le disjoncteur clim, pose ton cadenas, vérifie au VAT.');
          if (!s.lock) return danger('Pose ton cadenas sur le disjoncteur avant d’ouvrir : quelqu’un pourrait le réarmer.');
          if (!s.vat) return danger('Vérifie l’absence de tension au VAT avant d’ouvrir.');
          s.box = true;
          return info('Boîtier ouvert : bornier d’arrivée, condensateur du moteur, carte de régulation. Ici, on regarde : une réparation électrique, c’est pour une personne habilitée.');
        case 'box_close':
          if (!s.box) return info('Il est déjà fermé.');
          s.box = false; return good('Boîtier refermé, vis remises.');
      }
      return null;
    },
    faults: [
      { id: 'filtre', name: 'Filtre encrassé', listen: '« La clim fait du bruit, mais on sent à peine l’air. »',
        setup: (s) => { s.filter = 'sale'; s.roomT = 26.5; },
        truth: 'Le filtre était encrassé : l’air sortait froid, mais trop peu pour rafraîchir la chambre.',
        method: ['Thermomètre et main devant le soufflage : très peu d’air.', 'Arrêter la clim, installer l’escabeau.', 'Ouvrir la grille, sortir et aspirer le filtre, le remettre.', 'Refermer, remettre en FROID, attendre et contrôler.'],
        hint: 'Peu d’air au soufflage alors que le ventilateur tourne : qu’est-ce qui peut freiner l’air ?' },
      { id: 'mode', name: 'Thermostat resté en mode chaud', listen: '« Hier soir j’avais froid, alors j’ai monté le chauffage. Là, j’étouffe. »',
        setup: (s) => { s.mode = 'chaud'; s.set = 26; s.roomT = 27.5; s.outT = 27.5; },
        truth: 'Le thermostat était resté en mode CHAUD à 26 °C : l’appareil ne faisait que brasser l’air de la pièce.',
        method: ['Lire le thermostat : CHAUD, 26 °C.', 'Passer en FROID, consigne vers 21 °C.', 'Attendre et contrôler.'],
        hint: 'Commence par lire le thermostat.' },
      { id: 'fenetre', name: 'Fenêtre ouverte', listen: '« J’ai ouvert un peu pour aérer, mais il fait toujours aussi chaud. »',
        setup: (s) => { s.window = true; s.roomT = 27; },
        truth: 'La fenêtre était entrouverte : son contact coupe la clim. Le pictogramme fenêtre clignotait sur le thermostat.',
        method: ['Thermostat : le pictogramme fenêtre clignote.', 'Fermer la fenêtre, expliquer au client.', 'Attendre et contrôler.'],
        hint: 'Regarde bien l’écran du thermostat.' },
      { id: 'evac', name: 'Sortie du bac à condensats bouchée', listen: '« Ça goutte du plafond, juste sur le bureau. »',
        setup: (s) => { s.drain = 'bouche'; s.bac = 100; s.roomT = 24; },
        truth: 'La sortie du bac à condensats était bouchée par des dépôts : la pompe ne recevait plus l’eau, le bac débordait dans la chambre.',
        method: ['Bassine sous les gouttes, clim à l’arrêt.', 'Escabeau, grille, trappe : le bac est plein.', 'Vider le bac, déboucher la sortie.', 'Verser de l’eau : la pompe démarre, l’eau part.', 'Refermer, remettre en marche, vérifier : plus une goutte.'],
        hint: 'Ouvre et regarde le bac : pourquoi l’eau ne part-elle pas ?' },
      { id: 'tuyau', name: 'Tuyau de la pompe déboîté', listen: '« Ça coule par gouttes du plafond, régulièrement, depuis ce matin. »',
        setup: (s) => { s.hose = 'off'; s.bac = 30; s.roomT = 24; },
        truth: 'Le tuyau s’était déboîté de la pompe : chaque fois qu’elle tournait, l’eau pompée retombait dans le faux plafond.',
        method: ['Bassine sous les gouttes : ça coule par à-coups.', 'Clim à l’arrêt, escabeau, grille, trappe.', 'Le tuyau est déboîté à la sortie de la pompe.', 'Le rebrancher avec un collier neuf.', 'Verser de l’eau, refermer, remettre en marche : plus une goutte.'],
        hint: 'L’eau tombe par à-coups : quand la pompe tourne. Suis le trajet de l’eau après la pompe.' },
      { id: 'air', name: 'Air dans la batterie', listen: '« La clim souffle bien, mais l’air est à peine frais. Et ça fait glouglou. »',
        setup: (s) => { s.coilAir = true; s.roomT = 26; },
        truth: 'De l’air était bloqué dans la batterie : l’eau glacée circulait mal et l’air ressortait à peine frais. Le glouglou venait de là.',
        method: ['Écouter : glouglou dans l’appareil.', 'Arrêter, escabeau, grille, trappe.', 'Chiffon sous le purgeur, l’ouvrir : l’air sort.', 'Refermer dès que l’eau sort sans bulles.', 'Refermer, remettre en FROID, contrôler l’air soufflé.'],
        hint: 'Un glouglou dans une installation à eau, c’est souvent de l’air.' },
      { id: 'pompe', name: 'Pompe de relevage en panne', signal: true, listen: '« Ça goutte du plafond depuis cette nuit, et on entend comme un bip là-haut. »',
        setup: (s) => { s.pump = 'hs'; s.bac = 100; s.roomT = 24; },
        truth: 'La pompe de relevage était en panne : le bac ne se vidait plus et son alarme bipait. Elle se remplace par le frigoriste.',
        manager: '« Pompe de relevage HS : j’appelle le frigoriste. Laisse la clim à l’arrêt et la bassine en place. »',
        method: ['Bassine sous les gouttes, clim à l’arrêt.', 'Escabeau, grille, trappe : bac plein, l’alarme bipe.', 'Regarder la pompe : elle ne démarre pas.', 'Prévenir le responsable : c’est pour le frigoriste.'],
        hint: 'Ce bip vient de quelque part. Une fois la trappe ouverte, regarde la pompe.' },
      { id: 'hiver', name: 'Bâtiment passé en chauffage', signal: true, listen: '« J’ai mis la clim à fond depuis une heure, et ça souffle chaud. »',
        setup: (s) => { s.building = 'hiver'; s.roomT = 27.5; s.set = 19; s.fan = '3'; },
        truth: 'Le bâtiment était passé en chauffage : en installation 2 tubes, l’eau qui circule est chaude pour tout l’hôtel. Aucun réglage en chambre ne donne du froid.',
        manager: '« Exact : on est passés en chauffage pour la saison, l’installation est en 2 tubes. Je propose un ventilateur au client. »',
        method: ['Thermostat : FROID, consigne basse, ventilation à fond.', 'Thermomètre au soufflage : l’air sort chaud.', 'C’est le mode du bâtiment, pas la chambre.', 'Prévenir le responsable.'],
        hint: 'Mesure la température de l’air soufflé.' }
    ],
    check(s, m) {
      if (m.fault.id === 'pompe') return [
        ['Bassine sous les gouttes', s.bucket],
        ['Clim arrêtée au thermostat', s.mode === 'arret'],
        ['Pompe contrôlée : elle ne démarre pas', !!m.flags.pumpSeen]
      ];
      if (m.fault.id === 'hiver') return [
        ['Thermostat contrôlé : il est bien en FROID', s.mode === 'froid'],
        ['Air soufflé mesuré : il sort chaud', !!m.flags.hot]
      ];
      return [
        ['Air frais et débit normal au soufflage', s.breaker && s.mode === 'froid' && !s.window && s.filter === 'ok' && !s.filterOut && !s.coilAir && s.building === 'ete' && s.set >= 19 && s.set <= 25],
        ['Plus d’eau qui goutte', s.drain === 'ok' && s.pump === 'ok' && s.hose === 'ok' && s.bac < 99.5 && s.drip === 0],
        ['Tout est refermé (grille, trappe, boîtier, purgeur)', !s.grille && !s.trappe && !s.box && !s.purge],
        ['Courant rétabli, cadenas retiré', s.breaker && !s.lock],
        ['La chambre redescend vers la consigne', s.roomT <= s.set + 1]
      ];
    }
  };

  /* =====================================================================
     TABLEAU ÉLECTRIQUE de la chambre : porte-carte → relais → différentiel → disjoncteurs
     ===================================================================== */
  const APPL = [['lampe', 'Lampe de chevet', 'lampe', 40], ['bouilloire', 'Bouilloire', 'bouilloire', 2000], ['seche', 'Sèche-cheveux', 'sèche-cheveux', 1600], ['radiateur', 'Radiateur d’appoint', 'radiateur', 2000]];
  const ANAME = Object.fromEntries(APPL.map((a) => [a[0], a[1]]));
  const BRK = { bl: ['Disjoncteur éclairage', 16], bp: ['Disjoncteur prises', 16], bc: ['Disjoncteur clim', 20] };
  const elRelay = (s) => s.card && (s.cardOK || s.service);
  const elWatts = (s) => APPL.reduce((w, a) => w + (s.plug[a[0]] && !s.retired[a[0]] ? a[3] : 0), 0);
  function elLever(cx, on) {
    return `<rect x="${cx - 6}" y="50" width="12" height="34" rx="3" fill="#2b2f33"/><rect x="${cx - 8}" y="${on ? 51 : 69}" width="16" height="14" rx="2.5" fill="#3d464b" stroke="#151a1d"/>`
      + T(cx, on ? 61.5 : 79.5, on ? 'I' : 'O', { s: 8, a: 'middle', c: '#e9eef0', w: 700, mono: true })
      + `<rect x="${cx - 7}" y="88" width="14" height="6" rx="1.5" fill="${on ? '#4cc38c' : '#ef6152'}"/>`;
  }
  function elModule(x, w, top, bottom, inner) {
    return `<rect x="${x}" y="32" width="${w}" height="82" rx="3" fill="#ffffff" stroke="#cfccc2"/>` + T(x + w / 2, 44, top, { s: 7.5, a: 'middle', w: 700, c: '#3a4044' }) + inner + T(x + w / 2, 109, bottom, { s: 8.5, a: 'middle', c: '#3a4044' });
  }
  function elHeat(cx, h) {
    if (h < 0.02) return '';
    return `<rect x="${cx - 12}" y="97" width="24" height="3.5" fill="#d6d3ca"/><rect x="${cx - 12}" y="97" width="${(24 * h).toFixed(1)}" height="3.5" fill="${mix('#f0a23b', '#ef6152', h)}"/>`;
  }
  function elWire(d, live, flow, t, w) {
    return `<path d="${d}" fill="none" stroke="${live ? '#e2a541' : '#3f4f57'}" stroke-width="${w || 3}" stroke-linejoin="round"/>`
      + (live && flow ? `<path d="${d}" fill="none" stroke="#fff2c9" stroke-width="1.3" stroke-dasharray="3 6" stroke-dashoffset="${dash(t, 34, 9)}" stroke-linejoin="round"/>` : '');
  }
  function elIcon(id, x, y, on, t) {
    const c = on ? '#f3efe4' : '#9db0b9';
    if (id === 'lampe') return `<path d="M${x - 9} ${y - 2}L${x - 5} ${y - 14}H${x + 5}L${x + 9} ${y - 2}Z" fill="${on ? '#fff0a8' : '#56666e'}" stroke="${c}" stroke-width="1.5"/><path d="M${x} ${y - 2}V${y + 10}M${x - 7} ${y + 11}H${x + 7}" stroke="${c}" stroke-width="2"/>` + (on ? `<circle cx="${x}" cy="${y - 8}" r="16" fill="url(#dmglow)"/>` : '');
    if (id === 'bouilloire') return `<path d="M${x - 9} ${y + 10}L${x - 7} ${y - 8}Q${x} ${y - 13} ${x + 7} ${y - 8}L${x + 9} ${y + 10}Z" fill="#56666e" stroke="${c}" stroke-width="1.5"/><path d="M${x + 8} ${y - 4}q6 2 4 9" fill="none" stroke="${c}" stroke-width="1.6"/>` + (on ? [0, 1].map((i) => `<path d="M${x - 3 + i * 6} ${y - 14}q-3 -4 0 -8" fill="none" stroke="#e9eef0" stroke-width="1.3" opacity="${(0.4 + 0.5 * Math.abs(Math.sin(t * 3 + i))).toFixed(2)}"/>`).join('') : '');
    if (id === 'seche') return `<rect x="${x - 10}" y="${y - 10}" width="16" height="11" rx="5" fill="#56666e" stroke="${c}" stroke-width="1.5"/><path d="M${x - 3} ${y + 1}L${x - 6} ${y + 11}" stroke="${c}" stroke-width="3" stroke-linecap="round"/>` + (on ? `<path d="M${x + 8} ${y - 6}h7M${x + 8} ${y - 2}h9" stroke="#ef8a52" stroke-width="1.4" stroke-dasharray="3 2" stroke-dashoffset="${dash(t, 16, 5)}"/>` : '');
    return `<rect x="${x - 11}" y="${y - 10}" width="22" height="20" rx="2" fill="#56666e" stroke="${c}" stroke-width="1.5"/><path d="M${x - 6} ${y - 7}V${y + 7}M${x - 1} ${y - 7}V${y + 7}M${x + 4} ${y - 7}V${y + 7}" stroke="${c}" stroke-width="1.5"/>` + (on ? `<path d="M${x - 6} ${y - 14}q2 -3 0 -6M${x + 2} ${y - 14}q2 -3 0 -6" fill="none" stroke="#ef8a52" stroke-width="1.3"/>` : '');
  }
  function elAppPart(id) {
    const a = APPL.find((x) => x[0] === id);
    return {
      name: a[1],
      role: `${a[1]} : ${a[3]} W, soit environ ${f1(a[3] / 230)} A sur le circuit des prises.` + (id === 'radiateur' ? ' Un radiateur d’appoint, c’est souvent lui qui fait sauter les prises.' : ''),
      state: (s) => s.retired[id] ? 'Retiré du service, étiqueté' : s.plug[id] ? 'Branché' : 'Débranché',
      acts: (s) => s.retired[id] ? [[`unretire:${id}`, 'Remettre en service']] : [[`plug:${id}`, s.plug[id] ? 'Débrancher' : 'Brancher'], [`inspect:${id}`, 'Regarder le cordon'], [`retire:${id}`, 'Retirer du service']]
    };
  }
  const BREAKER_ROLE = 'Il protège le câble de son circuit. Surcharge (trop d’appareils) : le bilame chauffe et coupe au bout d’un moment. Court-circuit : coupure immédiate. Levier en haut (I) = enclenché.';
  const ELEC = {
    title: 'Tableau électrique',
    aria: 'Tableau électrique de la chambre et ses circuits',
    intro: 'Le tableau de la chambre 214. Le porte-carte commande un relais, puis le différentiel protège les personnes et chaque disjoncteur protège son circuit. Branche des appareils et regarde où va le courant.',
    realNote: 'Trouve d’où vient le problème et remets la chambre en service. Rien ne t’indique quel appareil est en cause.',
    order: ['arrivee', 'relais', 'diff', 'bl', 'bp', 'bc', 'porte', 'plafonnier', 'lampe', 'bouilloire', 'seche', 'radiateur', 'clim'],
    init() {
      return { card: true, cardOK: true, service: false, diff: true, bl: true, bp: true, bc: true, lights: true, climOn: true,
        plug: { lampe: true, bouilloire: false, seche: false, radiateur: false }, retired: {}, defect: null, short: false,
        heat: { bl: 0, bp: 0, bc: 0 }, I: { bl: 0, bp: 0, bc: 0 }, leak: 0, flash: 0, spark: 0, faultRearm: 0, ev: null, evT: -99 };
    },
    tick(s, dt, m, now) {
      const ev = [];
      const relay = elRelay(s), feed = relay && s.diff;
      s.I.bl = feed && s.bl && s.lights ? 0.35 : 0;
      s.I.bp = feed && s.bp ? elWatts(s) / 230 : 0;
      s.I.bc = feed && s.bc && s.climOn ? 0.45 : 0;
      // Défaut d’isolement : l’appareil fuit vers la terre, le différentiel coupe au-delà de 30 mA.
      s.leak = feed && s.bp && s.defect && s.plug[s.defect] && !s.retired[s.defect] ? 0.12 : 0;
      if (s.leak > 0.03) {
        s.diff = false; s.flash = 1.4;
        s.ev = `Clac ! Le différentiel a coupé : environ ${Math.round(s.leak * 1000)} mA partaient à la terre. Plus rien n’est alimenté.`; s.evT = now;
        ev.push({ msg: s.ev, sfx: 'clac' });
      }
      // Court-circuit : coupure immédiate du disjoncteur (déclencheur magnétique).
      if (feed && s.bp && s.short && s.plug.lampe && !s.retired.lampe) {
        s.bp = false; s.spark = 1;
        s.ev = 'Étincelle à la lampe de chevet, et clac : le disjoncteur des prises a coupé tout de suite. C’est un court-circuit.'; s.evT = now;
        ev.push({ msg: s.ev, sfx: 'zap' });
      }
      // Surcharge : au-delà de 1,13 fois le calibre, le bilame chauffe puis déclenche.
      for (const b of ['bl', 'bp', 'bc']) {
        const r = s.I[b] / BRK[b][1];
        if (r > 1.13) s.heat[b] = Math.min(1, s.heat[b] + dt * (r - 1.05) * 0.45);
        else s.heat[b] = Math.max(0, s.heat[b] - dt * 0.12);
        if (s.heat[b] >= 1 && s[b]) {
          s[b] = false;
          s.ev = `Clac ! ${BRK[b][0]} : ${f1(s.I[b])} A pour un calibre de ${BRK[b][1]} A, le bilame a trop chauffé. Il protège le câble.`; s.evT = now;
          ev.push({ msg: s.ev, sfx: 'clac' });
        }
      }
      if (ev.length) { s.I.bp = elRelay(s) && s.diff && s.bp ? elWatts(s) / 230 : 0; }
      s.flash = Math.max(0, s.flash - dt); s.spark = Math.max(0, s.spark - dt * 1.5);
      return ev;
    },
    sig: (s) => [s.diff, s.bl, s.bp, s.bc, s.card, s.service, s.lights, JSON.stringify(s.plug), JSON.stringify(s.retired), s.heat.bp.toFixed(2), s.flash > 0, s.spark > 0].join('|'),
    anim: (s) => s.I.bl + s.I.bp + s.I.bc > 0 || s.flash > 0 || s.spark > 0 || s.heat.bp > 0.01,
    bg() {
      let o = `<defs><radialGradient id="dmglow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff0c4" stop-opacity=".9"/><stop offset="1" stop-color="#fff0c4" stop-opacity="0"/></radialGradient></defs>`;
      o += `<rect width="400" height="330" fill="#e9dcc6"/>`;
      o += `<rect x="6" y="8" width="282" height="118" rx="8" fill="#f1f0eb" stroke="#c9c6bc" stroke-width="2"/><rect x="12" y="26" width="270" height="94" rx="4" fill="#fbfaf6" stroke="#dedbd1"/>`;
      o += T(56, 20, 'TABLEAU · CHAMBRE 214', { s: 9.5, mono: true, c: '#5c6266' });
      o += `<rect x="294" y="18" width="100" height="100" rx="10" fill="#f6f4ef" stroke="#cfc8ba" stroke-width="2"/>` + T(344, 113, 'porte-carte', { s: 9, a: 'middle', c: '#5c6266' });
      o += `<rect x="6" y="134" width="388" height="190" rx="10" fill="#16232b"/>` + T(14, 150, 'OÙ VA LE COURANT', { s: 9.5, mono: true, c: '#9db0b9' });
      return o;
    },
    dyn(s, t) {
      const relay = elRelay(s), feed = relay && s.diff, Itot = s.I.bl + s.I.bp + s.I.bc;
      let o = `<path d="M24 8V58" stroke="#8a5a2b" stroke-width="4"/><path d="M32 8V58" stroke="#2f6fb0" stroke-width="4"/><path d="M40 8V58" stroke="#4cc38c" stroke-width="4"/><path d="M40 8V58" stroke="#f2c94c" stroke-width="4" stroke-dasharray="5 5"/>`;
      o += elModule(16, 36, 'ARRIVÉE', '230 V', `<rect x="20" y="58" width="28" height="22" rx="3" fill="#e3e1da" stroke="#c9c6bc"/><circle cx="26" cy="69" r="2.6" fill="#9aa1a4"/><circle cx="34" cy="69" r="2.6" fill="#9aa1a4"/><circle cx="42" cy="69" r="2.6" fill="#9aa1a4"/>`);
      o += elModule(58, 34, 'RELAIS', 'carte', `<circle cx="75" cy="68" r="6" fill="${relay ? '#4cc38c' : '#5a615f'}" stroke="#2b2f33"/>` + T(75, 90, relay ? 'fermé' : 'ouvert', { s: 7.5, a: 'middle', c: '#5c6266' }));
      o += elModule(98, 56, 'DIFF.', '30 mA', elLever(120, s.diff) + `<rect x="138" y="86" width="12" height="12" rx="2" fill="#f2c94c" stroke="#9c7a1d"/>` + T(144, 95, 'T', { s: 8, a: 'middle', w: 700, c: '#2b1d0c', mono: true }));
      o += elModule(160, 34, 'ÉCLAIR.', '16 A', elLever(177, s.bl) + elHeat(177, s.heat.bl));
      o += elModule(200, 34, 'PRISES', '16 A', elLever(217, s.bp) + elHeat(217, s.heat.bp));
      o += elModule(240, 34, 'CLIM', '20 A', elLever(257, s.bc) + elHeat(257, s.heat.bc));
      // peigne : le courant passe de l’arrivée au relais, au différentiel, puis aux disjoncteurs
      const seg = (x1, x2, live) => `<path d="M${x1} 117H${x2}" stroke="${live ? '#c98a3a' : '#a9a69c'}" stroke-width="3"/>` + (live && Itot > 0 ? `<path d="M${x1} 117H${x2}" stroke="#fff2c9" stroke-width="1.3" stroke-dasharray="3 5" stroke-dashoffset="${dash(t, 30, 8)}"/>` : '');
      o += seg(34, 75, true) + seg(75, 120, relay) + seg(120, 257, feed);
      // porte-carte
      o += `<rect x="314" y="58" width="60" height="7" rx="2" fill="#2b2f33"/>`;
      if (s.card) o += `<rect x="322" y="26" width="44" height="36" rx="3" fill="${s.service ? '#6cb9e7' : '#e2a541'}" stroke="#7a5d22"/>` + T(344, 48, s.service ? 'SERVICE' : '214', { s: s.service ? 8 : 12, a: 'middle', mono: true, w: 700, c: '#1c1406' });
      o += `<circle cx="344" cy="82" r="5.5" fill="${relay ? '#4cc38c' : s.card ? '#ef6152' : '#5a615f'}" stroke="#2b2f33"/>` + T(344, 99, s.card ? (relay ? 'carte reconnue' : 'non reconnue') : 'aucune carte', { s: 8.5, a: 'middle', c: '#5c6266' });
      // circuit éclairage : disjoncteur → interrupteur → plafonnier
      const Lb = feed && s.bl, lit = Lb && s.lights;
      o += elWire('M177 120V176H124', Lb, lit, t);
      o += s.lights ? `<path d="M124 176H98" stroke="${Lb ? '#e2a541' : '#3f4f57'}" stroke-width="3"/>` : `<path d="M124 176L103 165" stroke="${Lb ? '#e2a541' : '#3f4f57'}" stroke-width="3" stroke-linecap="round"/>`;
      o += `<circle cx="124" cy="176" r="3" fill="#9db0b9"/><circle cx="98" cy="176" r="3" fill="#9db0b9"/>` + elWire('M98 176H70', lit, lit, t);
      if (lit) o += `<circle cx="56" cy="176" r="24" fill="url(#dmglow)"/>`;
      o += `<circle cx="56" cy="176" r="11" fill="${lit ? '#fff0a8' : '#3b4a52'}" stroke="${lit ? '#e2a541' : '#6d7d85'}" stroke-width="2"/>`;
      o += T(56, 204, 'plafonnier', { s: 9.5, a: 'middle', c: '#9db0b9' }) + T(111, 196, 'interrupteur', { s: 9, a: 'middle', c: '#9db0b9' }) + T(182, 168, `${f1(s.I.bl)} A`, { s: 10, mono: true, c: '#e9eef0' });
      // circuit prises : disjoncteur → barrette → appareils
      const Pb = feed && s.bp, over = s.I.bp > 16;
      o += elWire('M217 120V232', Pb, s.I.bp > 0, t, 2 + Math.min(4, s.I.bp / 5)) + elWire('M100 232H384', Pb, s.I.bp > 0, t, 3);
      o += T(223, 210, `${f1(s.I.bp)} A / 16 A`, { s: 10, mono: true, c: over ? '#ef6152' : '#e9eef0', w: over ? 700 : 400 });
      APPL.forEach(([id, , short, w], i) => {
        const x = 130 + i * 70, plugged = s.plug[id] && !s.retired[id], on = Pb && plugged;
        o += `<rect x="${x - 9}" y="225" width="18" height="14" rx="3" fill="#e9e5dc" stroke="#9db0b9"/><circle cx="${x - 3}" cy="232" r="1.6" fill="#2b2f33"/><circle cx="${x + 3}" cy="232" r="1.6" fill="#2b2f33"/>`;
        o += plugged ? `<path d="M${x} 239V256" stroke="#cfd8dc" stroke-width="2.5"/>` : `<path d="M${x + 14} 262q-6 -8 -2 -14" fill="none" stroke="#cfd8dc" stroke-width="2.5"/><rect x="${x + 9}" y="243" width="8" height="6" rx="1" fill="#cfd8dc"/>`;
        o += elIcon(id, x, 270, on, t);
        o += T(x, 299, short, { s: 9.5, a: 'middle', c: '#cfd8dc' }) + T(x, 311, `${w} W`, { s: 9, a: 'middle', mono: true, c: '#9db0b9' });
        if (s.retired[id]) o += `<g transform="rotate(-12 ${x} 268)"><rect x="${x - 17}" y="261" width="34" height="13" rx="2" fill="#ef6152"/>` + T(x, 271, 'HS', { s: 9, a: 'middle', w: 700, c: '#ffffff' }) + `</g>`;
        if (s.flash > 0 && s.defect === id) o += `<circle cx="${x}" cy="270" r="${(16 + (1.4 - s.flash) * 10).toFixed(1)}" fill="none" stroke="#f0a23b" stroke-width="2.4" opacity="${(s.flash / 1.4).toFixed(2)}"/>`;
        if (s.spark > 0 && id === 'lampe') for (let k = 0; k < 6; k++) { const a = k * 60 * Math.PI / 180, r = 6 + (1 - s.spark) * 14; o += `<path d="M${(x + Math.cos(a) * r).toFixed(1)} ${(256 + Math.sin(a) * r).toFixed(1)}l${(Math.cos(a) * 5).toFixed(1)} ${(Math.sin(a) * 5).toFixed(1)}" stroke="#fff3b0" stroke-width="2" opacity="${s.spark.toFixed(2)}"/>`; }
      });
      // circuit clim
      const Cb = feed && s.bc, con = Cb && s.climOn;
      o += elWire('M257 120V176H306', Cb, con, t);
      o += `<rect x="306" y="162" width="56" height="28" rx="4" fill="#56666e" stroke="#9db0b9" stroke-width="1.5"/><circle cx="324" cy="176" r="9" fill="#3b4a52" stroke="#9db0b9"/>`;
      const fa = con ? (t * 400) % 360 : 0;
      o += `<g transform="rotate(${fa.toFixed(0)} 324 176)"><path d="M324 169V183M317 176H331" stroke="#cfd8dc" stroke-width="2"/></g><path d="M340 170h16M340 176h16M340 182h16" stroke="#9db0b9"/>`;
      o += T(334, 204, 'clim', { s: 9.5, a: 'middle', c: '#9db0b9' }) + T(262, 168, `${f1(s.I.bc)} A`, { s: 10, mono: true, c: '#e9eef0' });
      return o;
    },
    hot(s) {
      const H = [
        ['arrivee', 'Arrivée', 14, 28, 40, 90, 20, 30], ['relais', 'Relais du porte-carte', 56, 28, 38, 90, 62, 30], ['diff', 'Interrupteur différentiel', 96, 28, 60, 90, 102, 30],
        ['bl', 'Disjoncteur éclairage', 158, 28, 38, 90, 164, 30], ['bp', 'Disjoncteur prises', 198, 28, 38, 90, 204, 30], ['bc', 'Disjoncteur clim', 238, 28, 38, 90, 244, 30],
        ['porte', 'Porte-carte', 296, 20, 96, 96, 300, 22], ['plafonnier', 'Plafonnier et interrupteur', 36, 158, 96, 50, 34, 160], ['clim', 'Clim', 300, 156, 70, 52, 372, 160]
      ];
      APPL.forEach(([id, name], i) => { const x = 130 + i * 70; H.push([id, name, x - 22, 244, 44, 72, x - 20, 248]); });
      return H;
    },
    now(s) {
      if (s.ev && D.t - s.evT < 7) return s.ev;
      const relay = elRelay(s);
      if (!s.card) return 'Pas de carte : le relais du porte-carte est ouvert, toute la chambre est coupée.';
      if (!relay) return 'Carte en place, mais le porte-carte ne la reconnaît pas : le relais reste ouvert, tout est coupé.';
      if (!s.diff) return 'Le différentiel est en bas : plus rien n’est alimenté après lui.';
      const off = ['bl', 'bp', 'bc'].filter((b) => !s[b]);
      if (off.length) return `${off.map((b) => BRK[b][0]).join(', ')} en bas : ce circuit est coupé, les autres marchent.`;
      if (s.I.bp > 16 * 1.13) return `Prises : ${f1(s.I.bp)} A pour un disjoncteur de 16 A. Le bilame chauffe (barre orange)…`;
      if (s.I.bp > 16) return 'Prises un peu au-dessus de 16 A : ça tient encore, mais le câble chauffe. À éviter.';
      return 'Tout est alimenté : le courant passe par le relais, le différentiel, puis le disjoncteur de chaque circuit.';
    },
    status(s) {
      const relay = elRelay(s);
      return [
        ['Relais carte', relay ? 'fermé' : 'ouvert', relay ? 'ok' : 'bad'],
        ['Différentiel', s.diff ? 'enclenché' : 'déclenché', s.diff ? 'ok' : 'bad'],
        ['Éclairage', s.bl ? `${f1(s.I.bl)} A` : 'coupé', s.bl ? '' : 'bad'],
        ['Prises', s.bp ? `${f1(s.I.bp)} / 16 A` : 'coupé', !s.bp ? 'bad' : s.I.bp > 16 ? 'warn' : ''],
        ['Clim', s.bc ? `${f1(s.I.bc)} A` : 'coupé', s.bc ? '' : 'bad']
      ];
    },
    quick: (s) => APPL.map(([id, , short]) => [`plug:${id}`, short[0].toUpperCase() + short.slice(1), s.plug[id] && !s.retired[id]]).concat([['lights', 'Plafonnier', s.lights], ['test', 'Bouton test T'], ['card', s.card ? 'Retirer la carte' : 'Insérer la carte']]),
    parts: {
      arrivee: { name: 'Arrivée', role: 'Le courant arrive du tableau d’étage, en 230 V. Phase en marron, neutre en bleu, terre en vert et jaune.', state: () => 'Sous tension (230 V)', acts: () => [] },
      relais: { name: 'Relais du porte-carte', role: 'Le porte-carte commande ce relais. Sans carte reconnue, il reste ouvert : la chambre est coupée, pour économiser l’énergie.',
        state: (s) => elRelay(s) ? 'Fermé : la chambre est alimentée' : 'Ouvert : la chambre est coupée', acts: () => [] },
      diff: { name: 'Interrupteur différentiel 30 mA', role: 'Il protège les personnes. Il compare le courant qui part et celui qui revient : s’il manque plus de 30 mA, c’est que ça fuit (par la terre… ou par quelqu’un). Il coupe alors en une fraction de seconde. Le bouton T sert à le tester.',
        state: (s) => s.diff ? 'Enclenché' : 'Déclenché', acts: (s) => [['lever:diff', s.diff ? 'Couper' : 'Réarmer'], ['test', 'Appuyer sur le bouton test T']] },
      bl: { name: 'Disjoncteur éclairage 16 A', role: BREAKER_ROLE, state: (s) => s.bl ? `Enclenché · ${f1(s.I.bl)} A` : 'Déclenché', acts: (s) => [['lever:bl', s.bl ? 'Couper' : 'Réarmer']] },
      bp: { name: 'Disjoncteur prises 16 A', role: BREAKER_ROLE, state: (s) => s.bp ? `Enclenché · ${f1(s.I.bp)} A sur 16 A` : 'Déclenché' + (s.heat.bp > 0.6 ? ', encore chaud' : ''), acts: (s) => [['lever:bp', s.bp ? 'Couper' : 'Réarmer']] },
      bc: { name: 'Disjoncteur clim 20 A', role: BREAKER_ROLE, state: (s) => s.bc ? `Enclenché · ${f1(s.I.bc)} A` : 'Déclenché', acts: (s) => [['lever:bc', s.bc ? 'Couper' : 'Réarmer']] },
      porte: { name: 'Porte-carte', role: 'On y glisse la carte de la chambre. Carte reconnue : voyant vert, le relais se ferme. La carte de service du technicien marche dans toutes les chambres.',
        state: (s) => !s.card ? 'Vide' : s.service ? 'Carte de service' : s.cardOK ? 'Carte du client reconnue' : 'Carte du client non reconnue',
        acts: (s) => [['card', s.card ? 'Retirer la carte' : 'Insérer la carte du client'], ['service', 'Essayer la carte de service'], ['reception', 'Faire refaire la carte (réception)']] },
      plafonnier: { name: 'Plafonnier et interrupteur', role: 'Sur le circuit éclairage. L’interrupteur ouvre ou ferme le circuit de la lampe.',
        state: (s) => s.lights ? 'Interrupteur fermé : allumé' : 'Interrupteur ouvert : éteint', acts: (s) => [['lights', s.lights ? 'Éteindre' : 'Allumer']] },
      lampe: elAppPart('lampe'), bouilloire: elAppPart('bouilloire'), seche: elAppPart('seche'), radiateur: elAppPart('radiateur'),
      clim: { name: 'Clim (ventilo-convecteur)', role: 'Sur son propre circuit, protégé en 20 A. Ventilateur, vanne et pompe consomment peu : moins de 1 A.',
        state: (s) => s.climOn ? 'En marche' : 'Arrêtée au thermostat', acts: (s) => [['clim', s.climOn ? 'Arrêter au thermostat' : 'Remettre en marche']] }
    },
    adjust: [],
    how: [
      ['Arrivée.', 'Le courant vient du tableau d’étage, en 230 V.', () => true],
      ['Relais du porte-carte.', 'Carte reconnue : le relais se ferme et alimente la chambre.', (s) => elRelay(s)],
      ['Différentiel 30 mA.', 'Il compare l’aller et le retour. S’il manque plus de 30 mA, ça fuit (terre ou personne) : il coupe tout.', (s) => elRelay(s) && s.diff],
      ['Disjoncteurs.', 'Un par circuit. Surcharge : le bilame chauffe et coupe au bout d’un moment. Court-circuit : coupure immédiate.', (s) => s.I.bl + s.I.bp + s.I.bc > 0],
      ['Circuits.', 'Éclairage, prises, clim : chacun son disjoncteur, pour ne couper que la partie en défaut.', (s) => elRelay(s) && s.diff && (s.bl || s.bp || s.bc)]
    ],
    gamme: { title: 'Quand ça saute : la méthode', steps: [
      ['Repérer ce qui est en bas : le différentiel ou un disjoncteur ?'],
      ['Débrancher les appareils du circuit.'],
      ['Réarmer une seule fois.'],
      ['Rebrancher un par un : celui qui fait sauter est en cause.'],
      ['Le retirer du service et l’étiqueter. Si ça ressaute à vide : prévenir le responsable.']
    ] },
    act(s, id, m) {
      const [k, a] = id.split(':');
      switch (k) {
        case 'lever': {
          const name = a === 'diff' ? 'Différentiel' : BRK[a][0];
          if (s[a]) { s[a] = false; return info(`${name} coupé à la main.`); }
          if (a !== 'diff' && s.heat[a] > 0.6) return bad('Il est encore chaud : le bilame doit refroidir avant de pouvoir réarmer. Patiente quelques secondes.');
          s[a] = true;
          const feed = elRelay(s) && s.diff;
          const leak = feed && s.bp && s.defect && s.plug[s.defect] && !s.retired[s.defect];
          const shortC = feed && s.bp && s.short && s.plug.lampe && !s.retired.lampe;
          if (leak || shortC) {
            if (leak) { s.diff = false; s.flash = 1.4; } else { s.bp = false; s.spark = 1; }
            s.faultRearm++;
            return s.faultRearm >= 2 ? bad('Ça ressaute encore, aussitôt. Ne réarme pas en boucle : débranche les appareils et cherche la cause.', { sfx: 'clac' }) : info('Clac ! Ça ressaute aussitôt : le défaut est toujours là.', { sfx: 'clac' });
          }
          return good(`${name} réarmé : ça tient.` + (elRelay(s) ? '' : ' Mais la chambre n’est pas alimentée : regarde la carte.'));
        }
        case 'test':
          if (!elRelay(s)) return info('Rien ne se passe : la chambre n’est pas alimentée (carte).');
          if (!s.diff) return info('Le différentiel est déjà déclenché.');
          s.diff = false; return good('Bouton test : le différentiel déclenche, il fonctionne. Ce test se fait régulièrement.', { sfx: 'clac' });
        case 'plug':
          if (s.retired[a]) return info(`${ANAME[a]} est retiré du service et étiqueté : on ne le rebranche pas.`);
          s.plug[a] = !s.plug[a];
          return info(`${ANAME[a]} ${s.plug[a] ? 'branché' : 'débranché'}.`);
        case 'inspect':
          if (a === 'lampe' && s.short) return info('Le cordon de la lampe est écrasé et dénudé près de la prise : la phase touche le neutre. À retirer du service.');
          return info(`Le cordon de : ${ANAME[a]} a l’air en bon état. Un défaut d’isolement ne se voit pas toujours : teste en le branchant seul.`);
        case 'retire': {
          s.retired[a] = true; s.plug[a] = false;
          const guilty = a === s.defect || (a === 'lampe' && s.short);
          return guilty ? good(`${ANAME[a]} retiré du service, étiqueté « Ne pas utiliser ». On en remet un neuf au client.`) : info(`${ANAME[a]} retiré du service et étiqueté. S’il n’avait rien, le client en est privé pour rien.`);
        }
        case 'unretire':
          if (a === s.defect || (a === 'lampe' && s.short)) return bad(`Non : ${ANAME[a]} est bien en défaut, il reste hors service.`);
          delete s.retired[a];
          return info(`${ANAME[a]} remis en service : il n’avait rien.`);
        case 'card':
          s.card = !s.card; if (!s.card) s.service = false;
          return info(s.card ? 'Carte du client insérée dans le porte-carte.' : 'Carte retirée : le relais s’ouvre, toute la chambre est coupée.');
        case 'service':
          s.card = true; s.service = true; if (m) m.flags.service = true;
          return info(s.cardOK ? 'Carte de service : tout s’allume, comme avec la carte du client.' : 'Carte de service : tout se rallume ! Ce n’est donc pas l’installation, c’est la carte du client.');
        case 'reception':
          if (s.cardOK) return info('La carte du client fonctionne : inutile.');
          s.cardOK = true; s.service = false; s.card = true; if (m) m.flags.reception = true;
          return good('Le client passe à la réception : sa carte est refaite. Elle était démagnétisée, rangée contre son téléphone.');
        case 'lights':
          s.lights = !s.lights; return info(s.lights ? 'Interrupteur fermé : le plafonnier s’allume (si le circuit est alimenté).' : 'Interrupteur ouvert : le plafonnier s’éteint.');
        case 'clim':
          s.climOn = !s.climOn; return info(s.climOn ? 'Clim remise en marche.' : 'Clim arrêtée au thermostat.');
      }
      return null;
    },
    faults: [
      { id: 'defaut', name: 'Appareil en défaut d’isolement', listen: '« Tout s’est coupé d’un coup, juste après que j’ai branché mes affaires. »',
        setup: (s) => {
          s.defect = pick(['bouilloire', 'seche', 'radiateur']);
          const other = pick(['bouilloire', 'seche', 'radiateur'].filter((x) => x !== s.defect));
          s.plug = { lampe: true, bouilloire: false, seche: false, radiateur: false };
          s.plug[s.defect] = true; s.plug[other] = true; s.diff = false;
        },
        truth: (s) => `${ANAME[s.defect]} avait un défaut d’isolement : branché, il laissait fuir du courant vers la terre et le différentiel 30 mA coupait toute la chambre.`,
        method: ['Constater : tout est coupé, le différentiel est en bas.', 'Débrancher tous les appareils, réarmer une seule fois : il tient.', 'Rebrancher un par un : celui qui fait sauter le différentiel est en cause.', 'Le retirer du service, l’étiqueter, rebrancher les autres.'],
        hint: 'Réarmer avec tout branché ne sert à rien. Débranche tout, réarme, puis rebranche un par un.',
        check: (s) => [
          ['Courant rétabli dans toute la chambre', elRelay(s) && s.diff && s.bl && s.bp && s.bc],
          ['Appareil en défaut retiré du service', !!s.retired[s.defect]],
          ['Aucun appareil sain retiré pour rien', APPL.every(([id]) => id === s.defect || !s.retired[id])]
        ] },
      { id: 'surcharge', name: 'Surcharge sur les prises', listen: '« Plus rien ne marche sur les prises. Pourtant, j’ai juste branché mes appareils. »',
        setup: (s) => { s.plug = { lampe: true, bouilloire: true, seche: true, radiateur: true }; s.bp = false; s.heat.bp = 0.75; },
        truth: 'Trop d’appareils sur le même circuit : près de 25 A pour un disjoncteur de 16 A. Le bilame a chauffé et coupé : il protégeait le câble.',
        method: ['Constater : le disjoncteur des prises est en bas, le reste marche.', 'Additionner : radiateur + bouilloire + sèche-cheveux ≈ 24 A.', 'Débrancher le radiateur d’appoint (ou ne pas tout utiliser en même temps).', 'Réarmer, expliquer au client.'],
        hint: 'Additionne les puissances : combien d’ampères pour un disjoncteur de 16 A ?',
        check: (s) => [['Prises rétablies', elRelay(s) && s.diff && s.bp], ['Moins de 16 A sur les prises', elWatts(s) / 230 <= 16]] },
      { id: 'court', name: 'Court-circuit (lampe au fil abîmé)', listen: '« Quand j’ai allumé la lampe de chevet, il y a eu une étincelle et les prises ont lâché. »',
        setup: (s) => { s.short = true; s.plug.lampe = true; s.bp = false; },
        truth: 'Le cordon de la lampe de chevet était écrasé : la phase touchait le neutre. Court-circuit : le disjoncteur des prises a coupé instantanément.',
        method: ['Constater : prises coupées, étincelle à la lampe.', 'Débrancher la lampe, regarder son cordon : abîmé.', 'Réarmer : ça tient.', 'Retirer la lampe du service, l’étiqueter, en mettre une autre.'],
        hint: 'L’étincelle venait d’où ?',
        check: (s) => [['Prises rétablies', elRelay(s) && s.diff && s.bp], ['Lampe au cordon abîmé retirée du service', !!s.retired.lampe]] },
      { id: 'carte', name: 'Carte du client non reconnue', listen: '« Je suis rentrée, j’ai mis ma carte dans la fente comme d’habitude, et rien ne s’allume. »',
        setup: (s) => { s.cardOK = false; },
        truth: 'La carte n’était plus reconnue, souvent parce qu’elle a été rangée contre un téléphone : le porte-carte ne fermait pas son relais. L’installation n’avait rien.',
        method: ['Constater : carte en place, voyant du porte-carte rouge.', 'Essayer la carte de service : tout se rallume.', 'Ce n’est pas l’installation : faire refaire la carte à la réception.'],
        hint: 'Avant d’ouvrir le tableau, essaie une autre carte.',
        check: (s, m) => [['Installation testée avec la carte de service', !!m.flags.service], ['Carte du client refaite à la réception', !!m.flags.reception], ['Chambre alimentée', elRelay(s) && s.diff]] }
    ]
  };

  const APPS = { wc: WC, clim: CLIM, elec: ELEC };
  const TABS = [['wc', 'Chasse d’eau'], ['clim', 'Climatisation'], ['elec', 'Tableau électrique']];

  /* =====================================================================
     MOTEUR COMMUN
     ===================================================================== */
  const D = { tab: 'wc', sel: null, st: {}, mis: {}, lastFault: {}, msg: null, t: 0, last: 0, raf: 0, lastPaint: 0, lastSlow: 0, sig: '' };
  const app = () => APPS[D.tab];
  const st = () => D.st[D.tab];
  const mis = () => D.mis[D.tab] || null;
  const truthOf = (f, s) => typeof f.truth === 'function' ? f.truth(s) : f.truth;
  const checksOf = (A, s, m) => (m.fault.check || A.check).call(A, s, m);

  function hotHTML(A, s, m) {
    const seen = new Set();
    return A.hot(s, m).map(([id, label, x, y, w, h, mx, my]) => {
      const n = A.order.indexOf(id) + 1, mid = seen.has(id) ? '' : ` id="dm-mk-${id}"`;
      seen.add(id);
      return `<g class="dm-hs${D.sel === id ? ' sel' : ''}" data-part="${id}" tabindex="0" role="button" aria-label="${esc(n + '. ' + label)}">`
        + `<rect class="hit" x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="transparent"/>`
        + `<g class="dm-mk"${mid} transform="translate(${mx} ${Number(my).toFixed(1)})"><circle r="8"/><text y="3.4" text-anchor="middle">${n}</text></g></g>`;
    }).join('');
  }
  function statusHTML(A, s, m) {
    return A.status(s, m).map(([k, v, tone]) => `<span class="dm-stat ${tone || ''}"><small>${esc(k)}</small><b>${esc(v)}</b></span>`).join('');
  }
  function missionTop(A, s, m) {
    if (!m) {
      return `<div class="dm-mbar"><button class="btn small primary" data-dm="mission:new">Panne surprise</button>`
        + `<details class="dm-pick"><summary class="btn small">Voir une panne précise</summary><div class="dm-pick-list">${A.faults.map((f) => `<button class="btn small" data-dm="mission:show:${f.id}">${esc(f.name)}</button>`).join('')}</div></details>`
        + `<button class="btn small" data-dm="reset">Remettre à neuf</button></div>`;
    }
    const f = m.fault;
    if (m.solved) {
      return `<div class="dm-mission ok"><span class="eyebrow">${m.passed ? 'Sécurisé et transmis' : 'Réparé et testé'}</span><h3>${esc(f.name)}</h3>`
        + `<p>${esc(truthOf(f, s))}</p>${m.passed && f.manager ? `<p class="dm-quote">${esc(f.manager)}</p>` : ''}`
        + `<p class="eyebrow">La bonne méthode</p><ol>${f.method.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`
        + `<p class="muted">${m.errors ? `${m.errors} geste${m.errors > 1 ? 's' : ''} refusé${m.errors > 1 ? 's' : ''}` : 'Aucun geste refusé'}${m.safety ? `, dont ${m.safety} de sécurité` : ''}.</p>`
        + `<div class="dm-row"><button class="btn small primary" data-dm="mission:new">Nouvelle panne</button><button class="btn small" data-dm="mission:quit">Mode libre</button></div></div>`;
    }
    return `<div class="dm-mission"><span class="eyebrow">${m.visible ? 'Panne à observer · vue en coupe' : 'Panne surprise · vue réelle'}</span>`
      + `<p class="dm-quote">${esc(f.listen)}</p>`
      + (m.visible ? `<p><b>${esc(f.name)}.</b> ${esc(truthOf(f, s))}</p>` : `<p class="muted">${esc(A.realNote)}</p>`)
      + (m.hint ? `<p class="dm-hint">${esc(f.hint)}</p>` : '')
      + `<div class="dm-row">${!m.hint && !m.visible ? '<button class="btn small" data-dm="mission:hint">Un indice</button>' : ''}<button class="btn small" data-dm="mission:quit">Abandonner</button></div></div>`;
  }
  function partHTML(A, s, m) {
    const chips = `<div class="dm-chips">${A.order.map((id, i) => `<button class="dm-chip${D.sel === id ? ' on' : ''}" data-dm="sel:${id}"><b>${i + 1}</b>${esc(A.parts[id].name)}</button>`).join('')}</div>`;
    const P = D.sel && A.parts[D.sel];
    if (!P) {
      return `<div class="dm-card dm-part-empty" id="dm-part"><p>Touche une <b>pastille numérotée</b> sur le dessin pour voir une pièce et la manipuler.</p>`
        + `<details class="dm-allparts"><summary>Liste des pièces (${A.order.length})</summary>${chips}</details>`
        + (D.msg ? `<p class="dm-msg ${D.msg.kind}">${esc(D.msg.text)}</p>` : '') + `</div>`;
    }
    const acts = P.acts(s, m) || [];
    return `<div class="dm-card" id="dm-part"><div class="dm-part-head"><span class="dm-num">${A.order.indexOf(D.sel) + 1}</span><h3>${esc(P.name)}</h3><button class="btn small" data-dm="sel:">Fermer</button></div>`
      + `<p>${esc(P.role)}</p><p class="dm-state"><span class="eyebrow">État</span> <span data-live="part">${esc(P.state(s, m))}</span></p>`
      + (acts.length ? `<div class="dm-acts">${acts.map(([a, l]) => `<button class="btn small" data-dm="${a}">${esc(l)}</button>`).join('')}</div>` : '')
      + (D.msg ? `<p class="dm-msg ${D.msg.kind}">${esc(D.msg.text)}</p>` : '')
      + `<details class="dm-allparts"><summary>Toutes les pièces</summary>${chips}</details></div>`;
  }
  function adjustHTML(A, s, m) {
    if (!A.adjust.length) return '';
    return `<div class="dm-card"><h3>Réglages</h3>${A.adjust.map((a) => {
      const lock = a.lock ? a.lock(s, m) : null, dis = lock ? ' disabled' : '';
      const ctl = a.seg
        ? `<div class="dm-seg" role="group" aria-label="${esc(a.label)}">${a.seg.map(([act, l, on]) => `<button class="${on(s) ? 'on' : ''}" aria-pressed="${!!on(s)}" data-dm="${act}"${dis}>${esc(l)}</button>`).join('')}</div>`
        : `<div class="dm-step"><button class="btn small" data-dm="${a.minus}" aria-label="${esc(a.label)} : diminuer"${dis}>−</button><b data-live="adj-${a.id}">${lock && real(m) ? '—' : esc(a.val(s))}</b><button class="btn small" data-dm="${a.plus}" aria-label="${esc(a.label)} : augmenter"${dis}>+</button></div>`;
      return `<div class="dm-adj"><div><b>${esc(a.label)}</b><small>${esc(lock || a.hint || '')}</small></div>${ctl}</div>`;
    }).join('')}</div>`;
  }
  function checksHTML(A, s, m) {
    if (!m || m.solved) return '';
    const items = checksOf(A, s, m);
    return `<div class="dm-card"><h3>Pour clore l’intervention</h3><ul class="dm-checks" id="dm-checks">${items.map(([t, ok], i) => `<li data-i="${i}" class="${ok ? 'ok' : ''}">${esc(t)}</li>`).join('')}</ul>`
      + `<p class="muted">Quand tout est coché, l’intervention se clôt toute seule. Si ce n’est pas réparable par toi, sécurise puis :</p>`
      + `<div class="dm-row"><button class="btn small" data-dm="mission:signal">Prévenir le responsable</button></div></div>`;
  }
  function howHTML(A) {
    let o = `<div class="dm-card"><h3>Comment ça marche</h3><p class="dm-intro">${esc(A.intro)}</p><ol class="dm-how" id="dm-how">${A.how.map(([t, d], i) => `<li data-i="${i}"><b>${esc(t)}</b> ${esc(d)}</li>`).join('')}</ol>`;
    if (A.gamme) {
      o += `<h3>${esc(A.gamme.title)}</h3><ol class="dm-gamme" id="dm-gamme">${A.gamme.steps.map(([t], i) => `<li data-i="${i}">${esc(t)}</li>`).join('')}</ol>`;
      if (A.gamme.note) o += `<p class="muted">${esc(A.gamme.note)}</p>`;
    }
    return o + `</div>`;
  }

  function render() {
    const A = app(), s = st(), m = mis();
    const root = document.getElementById('demo-content');
    if (!root) return;
    root.innerHTML = `<div class="dm-tabs" role="tablist" aria-label="Appareil">${TABS.map(([id, n]) => `<button class="dm-tab" role="tab" aria-selected="${D.tab === id}" data-dmtab="${id}">${esc(n)}</button>`).join('')}</div>`
      + missionTop(A, s, m)
      + `<div class="dm-stage"><svg class="dm-svg" viewBox="0 0 400 330" role="img" aria-label="${esc(A.aria)}">`
      + `<g>${A.bg(s, m)}</g><g id="dm-dyn" pointer-events="none">${A.dyn(s, D.t, m)}</g><g pointer-events="none">${A.fg ? A.fg(s, m) : ''}</g><g>${hotHTML(A, s, m)}</g></svg>`
      + `<p class="dm-now" id="dm-now" aria-live="polite">${esc(A.now(s, m))}</p></div>`
      + partHTML(A, s, m)
      + `<div class="dm-quick">${A.quick(s, m).map(([a, l, on]) => `<button class="btn small" data-dm="${a}"${on !== undefined ? ` aria-pressed="${!!on}"` : ''}>${esc(l)}</button>`).join('')}</div>`
      + `<div class="dm-status" id="dm-status">${statusHTML(A, s, m)}</div>`
      + checksHTML(A, s, m) + adjustHTML(A, s, m) + howHTML(A);
    D.sig = '';
    paint(true);
  }

  function paint(force) {
    const A = app(), s = st(), m = mis(), now = performance.now();
    const sig = A.sig(s);
    if (force || A.anim(s) || sig !== D.sig) {
      const g = document.getElementById('dm-dyn');
      if (g) g.innerHTML = A.dyn(s, D.t, m);
      if (A.paintHot) A.paintHot(s);
      D.sig = sig;
    }
    if (!force && now - D.lastSlow < 220) return;
    D.lastSlow = now;
    const set = (id, html) => { const el = document.getElementById(id); if (el && el.innerHTML !== html) el.innerHTML = html; };
    set('dm-status', statusHTML(A, s, m));
    const nowEl = document.getElementById('dm-now'), nowTxt = A.now(s, m);
    if (nowEl && nowEl.textContent !== nowTxt) nowEl.textContent = nowTxt;
    const live = document.querySelector('#demo-content [data-live="part"]');
    if (live && D.sel && A.parts[D.sel]) { const v = A.parts[D.sel].state(s, m); if (live.textContent !== v) live.textContent = v; }
    A.adjust.forEach((a) => { const el = document.querySelector(`#demo-content [data-live="adj-${a.id}"]`); if (el && a.val && !(a.lock && a.lock(s, m) && real(m))) { const v = a.val(s); if (el.textContent !== v) el.textContent = v; } });
    const hide = A.hideHow && A.hideHow(s, m);
    document.querySelectorAll('#dm-how li').forEach((li) => { const h = A.how[+li.dataset.i]; li.classList.toggle('on', !!h && !(hide && h[0] !== 'On appuie.') && !!h[2](s)); });
    document.querySelectorAll('#dm-gamme li').forEach((li) => { const g = A.gamme.steps[+li.dataset.i]; li.classList.toggle('done', !!(g && g[1] && g[1](s))); });
    if (m && !m.solved) {
      const items = checksOf(A, s, m);
      document.querySelectorAll('#dm-checks li').forEach((li) => { const it = items[+li.dataset.i]; li.classList.toggle('ok', !!(it && it[1])); });
      if (!m.fault.signal && items.every((it) => it[1])) {
        if (!m.okSince) m.okSince = D.t;
        else if (D.t - m.okSince > 1.2) solve(m, false);
      } else m.okSince = 0;
    }
  }

  function solve(m, passed) {
    m.solved = true; m.passed = passed;
    sfx('fixed'); toast(passed ? 'Sécurisé et transmis au responsable.' : 'Réparé et testé !', 3000);
    render();
    const top = document.querySelector('#demo-content .dm-mission');
    if (top) top.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'nearest' });
  }

  function startMission(fid) {
    const A = app(), s = A.init();
    let f = fid ? A.faults.find((x) => x.id === fid) : null;
    if (!f) { const pool = A.faults.filter((x) => x.id !== D.lastFault[D.tab]); f = pick(pool.length ? pool : A.faults); }
    D.lastFault[D.tab] = f.id;
    f.setup(s);
    D.st[D.tab] = s;
    D.mis[D.tab] = { fault: f, visible: !!fid, errors: 0, safety: 0, flags: {}, solved: false, passed: false, hint: false, okSince: 0 };
    D.sel = null; D.msg = null;
    sfx('bip');
    render();
  }

  function say(r) {
    if (!r) return;
    if (r.msg) {
      D.msg = { text: r.msg, kind: r.kind === 'water' ? 'info' : r.kind };
      toast(r.msg, Math.min(7000, 2200 + r.msg.length * 40));
    }
    const m = mis();
    if (r.kind === 'bad') { sfx(r.sfx || 'bad'); if (m && !m.solved) { m.errors++; if (r.safety) m.safety++; } }
    else sfx(r.sfx || (r.kind === 'good' ? 'good' : r.kind === 'water' ? 'water' : 'tap'));
  }

  function doAct(id) {
    const A = app(), s = st(), m = mis();
    if (id === 'reset') { D.st[D.tab] = A.init(); D.mis[D.tab] = null; D.sel = null; D.msg = null; sfx('tap'); toast('Tout est remis à neuf.'); render(); return; }
    if (id === 'mission:new') { startMission(null); return; }
    if (id.startsWith('mission:show:')) { startMission(id.slice(13)); return; }
    if (id === 'mission:quit') { D.mis[D.tab] = null; D.st[D.tab] = A.init(); D.sel = null; D.msg = null; sfx('tap'); render(); return; }
    if (id === 'mission:hint') { if (m) m.hint = true; render(); return; }
    if (id === 'mission:signal') {
      if (!m || m.solved) return;
      if (!m.fault.signal) { say(bad('Le responsable : « Ça, c’est dans tes cordes. Regarde encore. »')); render(); return; }
      if (checksOf(A, s, m).every((it) => it[1])) { solve(m, true); return; }
      say(bad('Le responsable : « Qu’est-ce que tu as vérifié exactement ? Sécurise et fais tes constats d’abord. »')); render(); return;
    }
    if (id.startsWith('sel:')) { select(id.slice(4) || null); return; }
    say(A.act(s, id, m));
    render();
  }

  function select(id) {
    D.sel = id; D.msg = null; sfx('tap'); render();
    if (!id) return;
    const el = document.getElementById('dm-part');
    if (el) { const r = el.getBoundingClientRect(); if (r.top > window.innerHeight - 120 || r.bottom < 0) el.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'nearest' }); }
  }

  function frame(ts) {
    D.raf = 0;
    const scr = document.getElementById('scr-demo');
    if (!scr || scr.hidden) return;
    const dt = D.last ? Math.min(0.1, Math.max(0, (ts - D.last) / 1000)) : 0;
    D.last = ts; D.t += dt;
    const A = app(), s = st(), m = mis();
    const ev = A.tick(s, dt, m, D.t);
    if (m && !m.solved && A.missionTick) A.missionTick(s, m, dt);
    if (ev && ev.length) { ev.forEach((e) => { D.msg = { text: e.msg, kind: 'bad' }; toast(e.msg, 5200); sfx(e.sfx || 'clac'); }); render(); }
    else if (ts - D.lastPaint > 32) { D.lastPaint = ts; paint(false); }
    D.raf = requestAnimationFrame(frame);
  }

  function open() {
    show('demo');
    Object.keys(APPS).forEach((k) => { if (!D.st[k]) D.st[k] = APPS[k].init(); });
    render();
    D.last = 0;
    if (!D.raf) D.raf = requestAnimationFrame(frame);
  }
  /* Ouvre directement un appareil et une pièce (utilisé par l’onglet « Comprendre » de l’Atelier). */
  function openAt(tab, part) {
    if (APPS[tab]) { D.tab = tab; D.sel = part && APPS[tab].parts[part] ? part : null; D.msg = null; }
    open();
  }

  document.getElementById('mode-demo').addEventListener('click', open);
  document.getElementById('demo-home').addEventListener('click', () => { renderStart(); show('start'); });
  const root = document.getElementById('demo-content');
  root.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-dmtab]');
    if (tab) { if (D.tab !== tab.dataset.dmtab) { D.tab = tab.dataset.dmtab; D.sel = null; D.msg = null; sfx('tap'); render(); } return; }
    const b = e.target.closest('[data-dm]');
    if (b) { if (!b.disabled) doAct(b.dataset.dm); return; }
    const p = e.target.closest('[data-part]');
    if (p) select(p.dataset.part);
  });
  root.addEventListener('keydown', (e) => {
    const p = e.target.closest && e.target.closest('[data-part]');
    if (p && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(p.dataset.part); }
  });

  window.__ch214demo = { D, APPS, open, openAt, doAct, render };
})();
