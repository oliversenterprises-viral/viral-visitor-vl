/**
 * Compact Phase 1 locale detect + apply for TE splash / embed widgets.
 * Same storage key and locales as the Site Drops SPA (`vr_locale`).
 */

export const EDGE_LOCALES = ['en', 'es', 'fr', 'pt', 'de', 'hi'] as const;
export type EdgeLocale = (typeof EDGE_LOCALES)[number];

const TE: Record<EdgeLocale, Record<string, string>> = {
  en: {
    'te.kicker': 'VIRALREFER · SITE DROPS',
    'te.title_direct': 'Paste a site. Climb.',
    'te.title_ref': 'A friend sent you',
    'te.lead': 'Visits do not count. Open Get my link — no email. TE hits never take #1.',
    'te.cta': 'Open — Get my link',
    'te.cta_open': 'Open',
    'te.fine': 'Tags stay on the URL if cookies are blocked.',
    'nav.lang': 'Language',
    'embed.help': 'Help {label} go viral',
    'embed.go': 'Get my link',
    'embed.locks': '{n} unique locks · {rung}',
  },
  es: {
    'te.kicker': 'VIRALREFER · SITE DROPS',
    'te.title_direct': 'Pega un sitio. Sube.',
    'te.title_ref': 'Un amigo te envió',
    'te.lead': 'Las visitas no cuentan. Abre Obtener mi enlace — sin email. Los hits TE nunca toman el #1.',
    'te.cta': 'Abrir — Obtener mi enlace',
    'te.cta_open': 'Abrir',
    'te.fine': 'Las etiquetas se quedan en la URL si las cookies están bloqueadas.',
    'nav.lang': 'Idioma',
    'embed.help': 'Ayuda a {label} a volverse viral',
    'embed.go': 'Obtener mi enlace',
    'embed.locks': '{n} bloqueos únicos · {rung}',
  },
  fr: {
    'te.kicker': 'VIRALREFER · SITE DROPS',
    'te.title_direct': 'Collez un site. Montez.',
    'te.title_ref': 'Un ami vous a envoyé',
    'te.lead': 'Les visites ne comptent pas. Ouvrez Obtenir mon lien — sans e-mail. Les hits TE ne prennent jamais le #1.',
    'te.cta': 'Ouvrir — Obtenir mon lien',
    'te.cta_open': 'Ouvrir',
    'te.fine': 'Les tags restent dans l’URL si les cookies sont bloqués.',
    'nav.lang': 'Langue',
    'embed.help': 'Aidez {label} à devenir viral',
    'embed.go': 'Obtenir mon lien',
    'embed.locks': '{n} verrous uniques · {rung}',
  },
  pt: {
    'te.kicker': 'VIRALREFER · SITE DROPS',
    'te.title_direct': 'Cole um site. Suba.',
    'te.title_ref': 'Um amigo te enviou',
    'te.lead': 'Visitas não contam. Abra Pegar meu link — sem e-mail. Hits TE nunca tomam o #1.',
    'te.cta': 'Abrir — Pegar meu link',
    'te.cta_open': 'Abrir',
    'te.fine': 'As tags ficam na URL se os cookies estiverem bloqueados.',
    'nav.lang': 'Idioma',
    'embed.help': 'Ajude {label} a viralizar',
    'embed.go': 'Pegar meu link',
    'embed.locks': '{n} locks únicos · {rung}',
  },
  de: {
    'te.kicker': 'VIRALREFER · SITE DROPS',
    'te.title_direct': 'Seite einfügen. Steigen.',
    'te.title_ref': 'Ein Freund hat dich geschickt',
    'te.lead': 'Besuche zählen nicht. Öffne Meinen Link holen — keine E-Mail. TE-Hits nehmen nie #1.',
    'te.cta': 'Öffnen — Meinen Link holen',
    'te.cta_open': 'Öffnen',
    'te.fine': 'Tags bleiben in der URL, wenn Cookies blockiert sind.',
    'nav.lang': 'Sprache',
    'embed.help': 'Hilf {label}, viral zu gehen',
    'embed.go': 'Meinen Link holen',
    'embed.locks': '{n} einzigartige Locks · {rung}',
  },
  hi: {
    'te.kicker': 'VIRALREFER · SITE DROPS',
    'te.title_direct': 'साइट पेस्ट करें। चढ़ें।',
    'te.title_ref': 'एक दोस्त ने भेजा',
    'te.lead': 'विज़िट नहीं गिनती। मेरा लिंक लें खोलें — बिना ईमेल। TE हिट कभी #1 नहीं लेते।',
    'te.cta': 'खोलें — मेरा लिंक लें',
    'te.cta_open': 'खोलें',
    'te.fine': 'कुकी ब्लॉक हों तो टैग URL पर रहते हैं।',
    'nav.lang': 'भाषा',
    'embed.help': '{label} को वायरल होने में मदद करें',
    'embed.go': 'मेरा लिंक लें',
    'embed.locks': '{n} यूनिक लॉक · {rung}',
  },
};

export function edgeI18nSnippet(opts?: { picker?: boolean }): string {
  const picker = opts?.picker ? '1' : '';
  return `<script>
(function(){
  var M=${JSON.stringify(TE)};
  var labels={en:'English',es:'Español',fr:'Français',pt:'Português',de:'Deutsch',hi:'हिन्दी'};
  function pick(){
    try{var s=localStorage.getItem('vr_locale'); if(M[s]) return s;}catch(e){}
    var n=(navigator.languages&&navigator.languages[0])||navigator.language||'en';
    var b=String(n).toLowerCase().split(/[-_]/)[0];
    return M[b]?b:'en';
  }
  function apply(loc){
    var d=M[loc]||M.en;
    try{document.documentElement.lang=loc;document.documentElement.setAttribute('data-vr-locale',loc);}catch(e){}
    document.querySelectorAll('[data-i18n]').forEach(function(el){
      var k=el.getAttribute('data-i18n'); if(!k||!d[k]) return;
      var out=d[k];
      var label=el.getAttribute('data-i18n-label');
      if(label) out=out.replace(/\\{label\\}/g,label);
      el.textContent=out;
    });
    var sel=document.querySelector('.vr-lang-select');
    if(sel&&sel.value!==loc) sel.value=loc;
  }
  var loc=pick();
  apply(loc);
  ${
    picker
      ? `var slot=document.getElementById('vr-embed-lang-slot');
  if(slot&&!slot.querySelector('select')){
    var lab=document.createElement('label');
    lab.className='vr-lang-picker vr-lang-picker--embed';
    var sel=document.createElement('select');
    sel.className='vr-lang-select';
    sel.setAttribute('aria-label',(M[loc]||M.en)['nav.lang']||'Language');
    Object.keys(labels).forEach(function(k){var o=document.createElement('option');o.value=k;o.textContent=labels[k];sel.appendChild(o);});
    sel.value=loc;
    sel.addEventListener('change',function(){
      var next=sel.value;
      if(!M[next]) next='en';
      try{localStorage.setItem('vr_locale',next);}catch(e){}
      apply(next);
    });
    lab.appendChild(sel);
    slot.appendChild(lab);
  }`
      : ''
  }
})();
</script>`;
}

export function edgeFill(key: string, locale: EdgeLocale, vars?: Record<string, string | number>): string {
  let out = TE[locale]?.[key] ?? TE.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return out;
}
