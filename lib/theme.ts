// Light / dark theme. The palette lives in app/globals.css (:root and :root[data-theme="dark"]);
// this file only decides which one <html> gets.
//
// What is stored: nothing (follow the device), or an explicit 'light' / 'dark'. Picking the
// theme the device already uses clears the stored choice, so the site goes back to following
// the device (see components/ThemeToggle.tsx).

export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'pandaslp-theme'

// Browser bar colour per theme: the canvas colour (--bg-0) of each.
export const THEME_COLOR: Record<Theme, string> = { light: '#FAFAF8', dark: '#121110' }

// Runs inline in <head> before the first paint (app/layout.jsx), so a dark-theme visitor never
// sees a white flash. Kept as plain ES5 in a string: it runs before React and any bundle.
// Also follows the device live (e.g. phone switching to dark at sunset) while nothing is stored.
export const THEME_INIT_SCRIPT = `(function(){
  var k=${JSON.stringify(THEME_STORAGE_KEY)}, c=${JSON.stringify(THEME_COLOR)};
  var mq=window.matchMedia('(prefers-color-scheme: dark)');
  function stored(){ try { var v=localStorage.getItem(k); return v==='light'||v==='dark'?v:null } catch(e){ return null } }
  function apply(){
    var t=stored()||(mq.matches?'dark':'light');
    document.documentElement.setAttribute('data-theme',t);
    var m=document.querySelectorAll('meta[name="theme-color"]');
    for(var i=0;i<m.length;i++) m[i].setAttribute('content',c[t]);
  }
  apply();
  if(mq.addEventListener) mq.addEventListener('change',function(){ if(!stored()) apply() });
})();`

export function deviceTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function currentTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

export function setTheme(theme: Theme) {
  try {
    if (theme === deviceTheme()) localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Private mode or blocked storage: the switch still works for this page view.
  }
  document.documentElement.setAttribute('data-theme', theme)
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', THEME_COLOR[theme]))
}
