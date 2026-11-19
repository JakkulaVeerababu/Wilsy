/*! WILSY jobs widget. Free to use on any website:
 *   <div data-wilsy-jobs data-stage="internship" data-country="India" data-limit="5"><a href="https://www.wilsy.in/jobs">Jobs on WILSY</a></div>
 *   <script src="https://www.wilsy.in/embed.js" async></script>
 * Options (all optional): data-q, data-stage, data-role, data-country, data-mode, data-company, data-limit (1-10),
 * data-theme (light, dark or auto) and data-title. It loads WILSY's public job search, sets no cookies and
 * collects nothing. If it can't load, the link inside the div stays. */
(function () {
  'use strict';
  var script = document.currentScript;
  var origin = 'https://www.wilsy.in';
  try { if (script && script.src) origin = new URL(script.src, location.href).origin; } catch (error) {}
  var FILTERS = ['q', 'stage', 'role', 'country', 'mode', 'company'];
  var host = String(location.hostname || 'embed').slice(0, 60);
  var CSS = ':host{all:initial;display:block;contain:content}' +
    '.w{--bg:#fff;--ink:#101828;--muted:#5d6779;--line:#e4e8ef;--soft:#f5f8ff;--blue:#0866ff;font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:14px;overflow:hidden;max-width:100%}' +
    '.w.dark{--bg:#0f1420;--ink:#eef2f8;--muted:#a3adbd;--line:#273043;--soft:#161d2c;--blue:#6ea1ff}' +
    '@media (prefers-color-scheme:dark){.w.auto{--bg:#0f1420;--ink:#eef2f8;--muted:#a3adbd;--line:#273043;--soft:#161d2c;--blue:#6ea1ff}}' +
    '.h{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid var(--line)}' +
    '.h strong{font-size:15px;font-weight:650}.h span{font-size:12px;color:var(--muted)}' +
    'ol{list-style:none;margin:0;padding:0}li+li{border-top:1px solid var(--line)}' +
    'a.j{display:block;padding:11px 16px;color:inherit;text-decoration:none}a.j:hover,a.j:focus-visible{background:var(--soft)}a.j:focus-visible{outline:2px solid var(--blue);outline-offset:-2px}' +
    '.t{display:block;font-weight:600;color:var(--ink)}.m{display:block;margin-top:2px;font-size:12.5px;color:var(--muted)}' +
    '.f{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 16px;border-top:1px solid var(--line);font-size:12.5px;background:var(--soft)}' +
    '.f a{color:var(--blue);font-weight:600;text-decoration:none}.f a:hover{text-decoration:underline}.f span{color:var(--muted)}' +
    '.e{padding:14px 16px;color:var(--muted)}.e a{color:var(--blue)}' +
    '.s{height:12px;margin:14px 16px;border-radius:6px;background:var(--soft)}';

  function slugify(value) {
    return String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/, '');
  }
  function tag(name, attrs, text) {
    var node = document.createElement(name);
    for (var key in attrs) if (attrs[key] != null) node.setAttribute(key, attrs[key]);
    if (text != null) node.textContent = text;
    return node;
  }
  function utm(url) {
    return url + (url.indexOf('?') < 0 ? '?' : '&') + 'utm_source=' + encodeURIComponent(host) + '&utm_medium=widget&utm_campaign=embed';
  }
  function ago(value) {
    var time = Date.parse(value || '');
    if (!isFinite(time)) return '';
    var days = Math.floor((Date.now() - time) / 864e5);
    return days <= 0 ? 'today' : days === 1 ? 'yesterday' : days < 30 ? days + ' days ago' : '';
  }
  function settings(el) {
    var query = [], limit = Math.min(10, Math.max(1, parseInt(el.getAttribute('data-limit'), 10) || 5));
    FILTERS.forEach(function (key) {
      var value = String(el.getAttribute('data-' + key) || '').trim().slice(0, 200);
      if (value) query.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
    });
    var theme = el.getAttribute('data-theme');
    return {query: query.join('&'), limit: limit, theme: theme === 'dark' || theme === 'auto' ? theme : 'light',
      title: String(el.getAttribute('data-title') || '').trim().slice(0, 40) || 'Latest jobs'};
  }
  function render(el) {
    if (!el || !el.attachShadow && !el.shadowRoot) return;
    var root = el.shadowRoot || el.attachShadow({mode: 'open'});
    var s = settings(el), token = String(Math.random());
    el.setAttribute('data-wilsy-render', token);
    var box = tag('div', {'class': 'w ' + s.theme, part: 'widget'});
    var head = tag('div', {'class': 'h'});
    head.append(tag('strong', null, s.title), tag('span', null, 'Live from WILSY'));
    var list = tag('ol', {'aria-busy': 'true'});
    for (var i = 0; i < Math.min(s.limit, 3); i++) { var row = tag('li', {'aria-hidden': 'true'}); row.append(tag('div', {'class': 's'})); list.append(row); }
    var foot = tag('div', {'class': 'f'});
    var all = tag('a', {href: utm(origin + '/jobs' + (s.query ? '?' + s.query : '')), target: '_blank', rel: 'noopener'}, 'See all jobs on WILSY →');
    foot.append(tag('span', null, 'Apply with the employer'), all);
    box.append(head, list, foot);
    var style = tag('style', null, CSS);
    root.replaceChildren ? root.replaceChildren(style, box) : (root.innerHTML = '', root.append(style, box));
    fetch(origin + '/api/search' + (s.query ? '?' + s.query : ''), {credentials: 'omit'}).then(function (response) {
      if (!response.ok) throw new Error('search');
      return response.json();
    }).then(function (data) {
      if (el.getAttribute('data-wilsy-render') !== token) return;
      var jobs = (data && data.jobs || []).filter(function (job) { return /^\d+$/.test(String(job && job.id)); }).slice(0, s.limit);
      list.textContent = '';
      list.removeAttribute('aria-busy');
      if (!jobs.length) { list.append(tag('li', {'class': 'e'}, 'No matching jobs right now. Check back soon.')); return; }
      jobs.forEach(function (job) {
        var path = '/jobs/' + job.id + '-' + (slugify(job.title + ' ' + job.company) || 'role');
        var where = /^(?:unknown|not specified|n\/a|none)?$/i.test(String(job.location || '').trim()) ? [job.city, job.country].filter(Boolean).join(', ') : String(job.location);
        var place = [where.length > 60 ? where.slice(0, 59) + '…' : where, {remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site'}[job.work_mode]].filter(Boolean);
        var when = ago(job.first_seen_at || job.discovered_at || job.posted_at);
        var link = tag('a', {'class': 'j', href: utm(origin + path), target: '_blank', rel: 'noopener'});
        link.append(tag('span', {'class': 't'}, job.title || 'Untitled role'), tag('span', {'class': 'm'}, [job.company].concat(place, when ? ['found ' + when] : []).filter(Boolean).join(' · ')));
        var item = tag('li');
        item.append(link);
        list.append(item);
      });
    }).catch(function () {
      if (el.getAttribute('data-wilsy-render') !== token) return;
      list.textContent = '';
      list.removeAttribute('aria-busy');
      var note = tag('li', {'class': 'e'}, 'Couldn’t load jobs right now. ');
      note.append(tag('a', {href: utm(origin + '/jobs'), target: '_blank', rel: 'noopener'}, 'See jobs on WILSY'));
      list.append(note);
    });
  }
  function start() { Array.prototype.forEach.call(document.querySelectorAll('[data-wilsy-jobs]'), render); }
  window.WilsyJobs = {render: render, start: start};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
