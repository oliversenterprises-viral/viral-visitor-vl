/**
 * Compact Phase 1 locale detect + apply for TE splash / embed widgets.
 * Same storage key and locales as the Site Drops SPA (`vr_locale`).
 */

import { EDGE_LOCALES, EDGE_MESSAGES, type EdgeLocale } from './i18n-edge-catalog';

export { EDGE_LOCALES, type EdgeLocale };

const TE = EDGE_MESSAGES;
const RTL = ['ar', 'ur'] as const;

const LABELS: Record<EdgeLocale, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  pt: 'Português',
  de: 'Deutsch',
  hi: 'हिन्दी',
  ar: 'العربية',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  ru: 'Русский',
  id: 'Bahasa Indonesia',
  tr: 'Türkçe',
  it: 'Italiano',
  nl: 'Nederlands',
  pl: 'Polski',
  vi: 'Tiếng Việt',
  th: 'ไทย',
  uk: 'Українська',
  bn: 'বাংলা',
  ur: 'اردو',
  ms: 'Bahasa Melayu',
  fil: 'Filipino',
  sw: 'Kiswahili',
  sv: 'Svenska',
  ro: 'Română',
};

export function edgeI18nSnippet(opts?: { picker?: boolean }): string {
  const picker = opts?.picker ? '1' : '';
  return `<script>
(function(){
  var M=${JSON.stringify(TE)};
  var labels=${JSON.stringify(LABELS)};
  var rtl=${JSON.stringify(RTL)};
  function pick(){
    try{
      var q=new URLSearchParams(location.search||'');
      var ql=(q.get('lang')||q.get('locale')||'').toLowerCase();
      if(M[ql]) return ql;
      if(ql==='tl'&&M.fil) return 'fil';
    }catch(e){}
    try{var s=localStorage.getItem('vr_locale'); if(M[s]) return s;}catch(e){}
    var list=(navigator.languages&&navigator.languages.length)?navigator.languages:(navigator.language?[navigator.language]:['en']);
    for(var i=0;i<list.length;i++){
      var n=String(list[i]||'').toLowerCase().replace('_','-');
      if(M[n]) return n;
      var b=n.split(/[-_]/)[0];
      if(b==='tl'&&M.fil) return 'fil';
      if(M[b]) return b;
    }
    return 'en';
  }
  function apply(loc){
    var d=M[loc]||M.en;
    try{
      document.documentElement.lang=loc;
      document.documentElement.setAttribute('data-vr-locale',loc);
      document.documentElement.dir=(rtl.indexOf(loc)>=0)?'rtl':'ltr';
    }catch(e){}
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
  const table = TE[locale] || TE.en;
  let out = table[key] ?? TE.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return out;
}
