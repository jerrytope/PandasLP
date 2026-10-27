// Light / dark theme. The palette lives in app/globals.css (:root is light, :root[data-theme="dark"]
// is dark); this file only decides which one <html> gets.
//
// Light first (docs/frontend-revamp-plan.md, changed 27 Oct 2026: dark read as a tech product, not
// a law firm): every visitor starts on the light parchment, whatever their device uses, until
// they pick dark with the switch. What is stored: nothing (light), or 'dark'.

export type Theme = 'light' | 'dark'

export const DEFAULT_THEME: Theme = 'light'

export const THEME_STORAGE_KEY = 'pandaslp-theme'

// Browser bar colour per theme: the canvas colour (--bg-0) of each.
export const THEME_COLOR: Record<Theme, string> = { light: '#F4F1EA', dark: '#0B0A09' }

// Runs inline in <head> before the first paint (app/layout.jsx), so nobody sees the wrong theme
// flash. Kept as plain ES5 in a string: it runs before React and any bundle.
export const THEME_INIT_SCRIPT = `(function(){
  var k=${JSON.stringify(THEME_STORAGE_KEY)}, c=${JSON.stringify(THEME_COLOR)}, d=${JSON.stringify(DEFAULT_THEME)};
  var t=d;
  try { var v=localStorage.getItem(k); if(v==='light'||v==='dark') t=v } catch(e){}
  document.documentElement.setAttribute('data-theme',t);
  var m=document.querySelectorAll('meta[name="theme-color"]');
  for(var i=0;i<m.length;i++) m[i].setAttribute('content',c[t]);
})();`

export function currentTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
}

export function setTheme(theme: Theme) {
  try {
    if (theme === DEFAULT_THEME) localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Private mode or blocked storage: the switch still works for this page view.
  }
  document.documentElement.setAttribute('data-theme', theme)
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', THEME_COLOR[theme]))
}
