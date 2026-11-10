/* Public-site interaction analytics. Never read form values or private page content. */
(function () {
  if (window.__lawvetterEvents || navigator.doNotTrack === '1' || navigator.globalPrivacyControl) return;
  window.__lawvetterEvents = true;
  var seen = new Set(), last = '', pending = false, startedForms = new WeakSet();
  function page() {
    var path = location.pathname, view = new URLSearchParams(location.search).get('view');
    if (/^\/(admin|admin-login|account|dashboard|client-reviews|forgot-password|reset-password|confirm-profile-email|firm-access|firm-message)(\/|$)/.test(path) || view === 'shortlist') return '';
    return path === '/' && /^(charts|discover)$/.test(view || '') ? path + '?view=' + view : path;
  }
  function clean(value) {
    var text = String(value || '').trim().replace(/\s+/g, ' ');
    return !text || text.length > 100 || /@|https?:|\d{3}|[<>{}]|\b(my|i am|i was|myself|social security)\b/i.test(text) ? '[redacted]' : text;
  }
  function emit(name, params) {
    var path = page();
    if (!path || typeof window.gtag !== 'function' || navigator.doNotTrack === '1' || navigator.globalPrivacyControl) return;
    window.gtag('event', name, Object.assign({page_location:location.origin + path,page_path:path,page_title:'LawVetter',page_referrer:'',transport_type:'beacon'}, params));
  }
  function section(el) {
    return el.closest('header') ? 'header' : el.closest('footer') ? 'footer' : el.closest('.charts-page') ? 'charts' : el.closest('.search-results') ? 'search_results' : el.closest('.discovery-search') ? 'search' : 'page';
  }
  document.addEventListener('click', function (event) {
    var el = event.target instanceof Element && event.target.closest('a,button,summary,[role="button"]');
    if (!el || !page() || el.closest('[data-analytics-exclude="true"],dialog,form:not(#attorney-search form)') || el.disabled) return;
    var label = clean(el.getAttribute('aria-label') || el.textContent || el.querySelector('img')?.alt || el.tagName.toLowerCase());
    var name = 'button_click', params = {button_name:label,interaction_section:section(el)};
    if (el.tagName === 'A') {
      var raw = el.getAttribute('href') || '', url;
      if (/^tel:/i.test(raw)) name = 'phone_click';
      else if (/^mailto:/i.test(raw)) name = 'email_click';
      else {
        try { url = new URL(raw, location.href); } catch (_) { return; }
        if (!/^https?:$/.test(url.protocol)) return;
        if (url.origin !== location.origin) { name = /\.(pdf|docx?|xlsx?|csv|zip)$/i.test(url.pathname) ? 'document_download' : 'outbound_click'; params.link_domain = url.hostname; }
        else {
          params.destination_path = url.pathname;
          name = /^\/(lawyers\/|attorney$|firm$)/.test(url.pathname) ? 'profile_click' : 'navigation_click';
          if (/^\/(hire-lawyer|firm\/contact|firm-message)$/.test(url.pathname)) name = 'contact_click';
        }
      }
    }
    emit(name,params);
  }, true);
  document.addEventListener('change', function (event) {
    var el = event.target;
    if (!(el instanceof HTMLSelectElement) || !el.closest('.charts-page,.discovery-search,.search-radius-controls') || el.closest('[data-analytics-exclude="true"]')) return;
    emit('filter_change',{button_name:clean(el.name || el.getAttribute('aria-label') || 'filter'),filter_value:clean(el.selectedOptions[0]?.textContent),interaction_section:section(el)});
  });
  document.addEventListener('focusin', function (event) {
    var form = event.target instanceof Element && event.target.closest('form[data-analytics-form]');
    if (!form || startedForms.has(form)) return;
    var name = form.getAttribute('data-analytics-form');
    if (!/^(legal_inquiry|general_contact)$/.test(name || '')) return;
    startedForms.add(form); emit('inquiry_start',{form_name:name});
  });
  document.addEventListener('submit', function (event) {
    var form = event.target, name = form instanceof HTMLFormElement && form.getAttribute('data-analytics-form');
    if (/^(legal_inquiry|general_contact)$/.test(name || '')) emit('inquiry_submit_attempt',{form_name:name});
  },true);
  function scroll() {
    pending = false;
    var current = page();
    if (current !== last) { seen.clear(); last = current; }
    var height = document.documentElement.scrollHeight, viewport = window.innerHeight;
    if (!current || height <= viewport + 20 || window.scrollY <= 0) return;
    var depth = Math.min(100, Math.round((window.scrollY + viewport) / height * 100));
    [25,50,75,90,100].forEach(function (n) { if (depth >= n && !seen.has(n)) { seen.add(n); emit('scroll_depth',{percent_scrolled:n}); } });
  }
  window.addEventListener('scroll', function () { if (!pending) { pending = true; window.requestAnimationFrame(scroll); } }, {passive:true});
  window.addEventListener('lawvetter:search-results', function (event) {
    var d = event.detail || {};
    emit('view_search_results',{search_term:clean(d.term || '(browse)'),search_category:d.kind === 'firms' ? 'firms' : 'attorneys',search_city:clean(d.city || '(any)'),results_count:Math.max(0,Number(d.total)||0),results_page:Math.max(1,Number(d.page)||1)});
  });
})();
