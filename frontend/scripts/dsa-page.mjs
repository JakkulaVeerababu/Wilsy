import fs from 'node:fs/promises';
import vm from 'node:vm';
import {escapeHtml as e} from '../js/directory-core.js';
import {icon} from '../js/icons.js';

const sourceRoot = new URL('../../DSA RM/', import.meta.url);
export async function loadDsaProject() {
  // Only the public learning data is evaluated, in an isolated, time-bounded context.
  // Never copy the project directory: it also contains .env, .git and node_modules.
  const source = await fs.readFile(new URL('js/data.js',sourceRoot),'utf8');
  const context = {window:{}};
  vm.runInNewContext(source,context,{timeout:1000,contextCodeGeneration:{strings:false,wasm:false}});
  const data = JSON.parse(JSON.stringify(context.window.dsaData));
  const patterns=[];
  const walk=(node,category)=>{if(node.isPattern)patterns.push({...node,category});for(const child of node.children||[])walk(child,category);};
  for(const category of data.categories)walk(category,category.name);
  if(new Set(patterns.map(p=>p.id)).size!==patterns.length)throw new Error('Duplicate DSA pattern IDs');
  for(const p of patterns)if(!/^[a-z0-9-]+$/.test(p.id)||!p.name||!p.desc||!Array.isArray(p.problems)||typeof p.snippet!=='string')throw new Error('Invalid DSA pattern');
  return {data,patterns,stats:{categories:data.categories.length,patterns:patterns.length,problems:new Set(patterns.flatMap(p=>p.problems)).size}};
}

export async function writeDsaAssets(out,project) {
  await fs.mkdir(`${out}/dsa`,{recursive:true});
  // Explicit allowlist: the original data and interaction engine only.
  await fs.writeFile(`${out}/dsa/data.js`,'window.dsaData = '+JSON.stringify(project.data).replace(/</g,'\\u003c')+';\n');
  await fs.copyFile(new URL('js/app.js',sourceRoot),`${out}/dsa/app.js`);
  const config = publicDsaConfig(process.env);
  await fs.writeFile(`${out}/dsa/config.js`,'window.wilsyDsaConfig = '+JSON.stringify(config).replace(/</g,'\\u003c')+';\n');
  if(config.enabled)await fs.copyFile(new URL('../../node_modules/@supabase/supabase-js/dist/umd/supabase.js',import.meta.url),`${out}/dsa/supabase-sdk.js`);
}

export function publicDsaConfig(env) {
  const url=env.WILSY_DSA_SUPABASE_URL,key=env.WILSY_DSA_SUPABASE_ANON_KEY;
  if(!url&&!key)return {enabled:false};
  let publicKey=false;
  try{publicKey=key?.startsWith('sb_publishable_')||JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon';}catch{}
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url||'')||!publicKey)throw new Error('DSA cloud sync requires an HTTPS Supabase project URL and a PUBLIC anon/publishable key, never a service or secret key.');
  return {enabled:true,url,key};
}

function dsaDialogs() {
  return `<div class="drawer-overlay" id="drawerOverlay"></div><section class="drawer-content" id="drawerContent" role="dialog" aria-modal="true" aria-labelledby="drawerTitle" inert>
    <div class="drawer-header"><div><span class="drawer-category-label" id="drawerCategory"></span><h2 id="drawerTitle">Pattern details</h2></div><button type="button" id="closeDrawerBtn" aria-label="Close pattern details">Close</button></div>
    <div class="drawer-scroll-area"><section><h3>Understand the pattern</h3><p id="drawerDescription"></p></section><section><h3>Practise the idea</h3><p class="dsa-external-note">Practice links open an external platform or search.</p><div id="drawerProblems"></div></section><section><div class="code-header"><h3>Python template</h3><button type="button" id="copyCodeBtn">Copy code</button></div><pre><code id="drawerCode"></code></pre><p class="dsa-external-note">A starting point for learning. Some source templates contain placeholders; complete and test them on your own.</p></section></div>
  </section>
  <div class="auth-modal-overlay" id="authModalOverlay" role="dialog" aria-modal="true" aria-labelledby="authModalTitle" inert><div class="auth-modal-content"><div class="auth-modal-header"><h2 id="authModalTitle">Sign in</h2><button type="button" id="closeAuthBtn" aria-label="Close sign in">Close</button></div><p>Optional cloud progress. Learning never requires an account.</p><p id="authWarningMessage" role="status" style="display:none"></p><form id="authForm"><label class="auth-input-group">Email address<input type="email" id="authEmail" autocomplete="email" required></label><label class="auth-input-group">Password<input type="password" id="authPassword" autocomplete="current-password" minlength="6" required></label><label class="auth-input-group" id="confirmPasswordGroup" style="display:none">Confirm password<input type="password" id="authConfirmPassword" autocomplete="new-password" minlength="6"></label><p id="authErrorMessage" role="status" style="display:none"></p><button type="submit" id="btnSubmitAuth">Sign in</button></form><div class="auth-toggle-prompt"><span id="authToggleText">Don’t have an account?</span> <button type="button" id="authToggleLink">Sign up</button></div><a href="/privacy">How your progress is stored</a></div></div>`;
}

export function dsaPage(project) {
  const {stats,data,patterns}=project;
  return `<main id="main-content" class="dsa-shell">
    <section class="dsa-intro" aria-labelledby="dsa-title"><div><a class="dsa-eyebrow" href="/">WILSY / LEARN</a><h1 id="dsa-title">Understand the pattern.<br><span>Solve the next problem.</span></h1><p>Your DSA roadmap, with room to think. Explore the connections, practise the essentials and build a record of what you have mastered.</p><div class="dsa-intro-actions"><a class="dsa-primary" href="#roadmapApp">Start exploring ${icon('arrow')}</a><a href="/jobs">Put your preparation to work ${icon('external')}</a></div></div><aside class="dsa-intro-note"><span class="dsa-eyebrow">A STRUCTURED PATH</span><dl><div><dt>Core topics</dt><dd>${stats.categories}</dd></div><div><dt>Patterns</dt><dd>${stats.patterns}</dd></div><div><dt>Practice references</dt><dd>${stats.problems}</dd></div></dl><p>Python templates, not a code runner.<br>Learn here. Practise on the linked platforms.</p></aside></section>
    <section class="dsa-start" aria-label="How to use the roadmap"><article><span>01</span><div><h2>Find a pattern</h2><p>Follow a branch or search the explorer.</p></div></article><article><span>02</span><div><h2>Practise with context</h2><p>Read the idea, then open a recommended problem.</p></div></article><article><span>03</span><div><h2>Build your progress</h2><p>Mark what you understand. Come back to the rest.</p></div></article></section>
    <section class="dsa-workspace" id="roadmapApp" aria-labelledby="roadmap-title">
      <div class="dsa-workspace-header"><div><p class="dsa-eyebrow">YOUR LEARNING WORKSPACE</p><h2 id="roadmap-title">The DSA roadmap</h2></div><div class="dsa-progress-summary"><span id="globalMasteredCount">0 / ${stats.patterns}</span><span>mastered</span><strong id="masteryPercentText">0%</strong></div><div id="authSection"><button id="btnShowAuth" type="button" hidden>Cloud sign in</button><div id="userProfileMenu" hidden><span id="userEmailDisplay"></span><button type="button" id="btnLogout">Sign out</button></div></div></div>
      <p class="dsa-storage-note" id="dsa-storage-status" role="status">Progress is saved in this browser. No account needed to learn.</p>
      <nav class="dsa-topic-nav" aria-label="Roadmap topics"><button type="button" data-dsa-topic="all" aria-pressed="true">All topics</button>${data.categories.map(c=>`<button type="button" data-dsa-topic="${e(c.name)}" aria-pressed="false">${e(c.name)}</button>`).join('')}</nav>
      <div class="dsa-view-switch" role="group" aria-label="Roadmap view"><button type="button" id="dockBtnMap" aria-pressed="false">Mind-map</button><button type="button" id="dockBtnExplorer" class="active" aria-pressed="true">Pattern explorer</button></div>
      <div class="dsa-layout">
        <div class="mindmap-container" id="mindmapContainer" tabindex="0" role="region" aria-label="Interactive DSA mind-map. Drag to pan, use arrow keys to move, and use the zoom buttons.">
          <div class="canvas-controls" aria-label="Mind-map controls"><button type="button" class="control-btn" id="btnZoomIn" aria-label="Zoom in">+</button><button type="button" class="control-btn" id="btnZoomOut" aria-label="Zoom out">−</button><button type="button" class="control-btn" id="btnZoomReset">Reset view</button><button type="button" class="control-btn" id="btnExpandAll">Expand all</button><button type="button" class="control-btn" id="btnCollapseAll">Collapse all</button></div>
          <div class="mindmap-canvas" id="mindmapCanvas"><svg class="mindmap-svg" id="mindmapSvg" aria-hidden="true"></svg><div class="mindmap-tree-wrapper" id="mindmapTreeWrapper"><button type="button" id="centralNode" class="central-node">DSA Patterns<span>Start with a connection</span></button></div></div>
          <p class="dsa-map-hint">Drag to explore · Ctrl + scroll to zoom</p>
        </div>
        <div class="explorer-container" id="explorerContainer">
          <div class="explorer-header"><div class="progress-info"><h3>Mastery progress</h3><div class="progress-bar-container"><div class="progress-bar-fill" id="progressBarFill"></div></div><p id="progressBarPercent">0 of ${stats.patterns} completed (0%)</p></div><div class="circle-progress-container"><svg viewBox="0 0 70 70" class="circle-svg" aria-hidden="true"><circle class="circle-bg" cx="35" cy="35" r="30"></circle><circle class="circle-fill" id="circleProgressFill" cx="35" cy="35" r="30"></circle></svg><span id="circleProgressText">0%</span></div></div>
          <div class="controls-section"><label class="dsa-search">${icon('search')}<span class="sr-only">Search patterns, code and practice references</span><input type="search" id="searchInput" placeholder="Pattern, problem or code…" maxlength="200"></label><div class="filter-row"><div class="difficulty-filters" id="difficultyFilters" role="group" aria-label="Pattern difficulty">${['all','easy','medium','hard'].map(v=>`<button type="button" class="filter-btn ${v==='all'?'active':''}" data-filter="${v}" aria-pressed="${v==='all'}">${v==='all'?'All levels':v[0].toUpperCase()+v.slice(1)}</button>`).join('')}</div><div class="difficulty-filters" id="statusFilters" role="group" aria-label="Mastery status"><button type="button" class="filter-btn active" data-status="all" aria-pressed="true">All patterns</button><button type="button" class="filter-btn" data-status="mastered" aria-pressed="false">Mastered</button><button type="button" class="filter-btn" data-status="unmastered" aria-pressed="false">Remaining</button></div></div></div>
          <div class="category-indicator"><h3 id="selectedCategoryTitle">All categories</h3><span id="selectedCategoryCount">${stats.patterns}</span></div><div class="patterns-list" id="patternsList"></div>
        </div>
      </div>
    </section>
    <section class="dsa-library"><details><summary>Browse the complete pattern reference without the mind-map</summary><div class="dsa-library-grid">${patterns.map(p=>`<details><summary>${e(p.name)} <span>${e(p.category)}</span></summary><p>${e(p.desc)}</p><ul>${p.problems.map(problem=>`<li>${e(problem)}</li>`).join('')}</ul><pre><code>${e(p.snippet)}</code></pre></details>`).join('')}</div></details><p>Based on the DSA RM project by <a href="https://github.com/JakkulaVeerababu" target="_blank" rel="noopener noreferrer">Jakkula Veerababu / THFLSH9Z</a>. Code examples are learning templates; some are intentionally incomplete. No hiring outcome or company endorsement is implied.</p></section>
  </main>${dsaDialogs()}
  <noscript><div class="noscript">The mind-map and progress tracking need JavaScript. The complete pattern reference above remains available.</div></noscript>
  <script src="/dsa/config.js" defer></script><script src="/js/dsa-cloud.js" defer></script><script src="/dsa/data.js" defer></script><script src="/dsa/app.js" defer></script><script src="/js/dsa-enhancements.js" defer></script>`;
}
