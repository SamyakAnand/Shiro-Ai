const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let repositories = [];
let activeRepo = null;
let files = [];
let toastTimer;
let companionBusy = false;
let studioType = 'report';
let currentArtifact = null;
let flashcardIndex = 0;
let flashcardRevealed = false;
let tour = { active: false, step: 0, ready: false };
let authClient = null;
let accessToken = null;
let tourUserId = 'local';
const tourSteps = [
  { title: 'Start with a repository', copy: 'Select or connect a public repository. SHIRO indexes a bounded snapshot and records its commit.', action: 'repo', cta: 'Connect a repository' },
  { title: 'Open the source', copy: 'Browse the indexed files, then open a file to inspect its actual lines.', action: 'file', cta: 'Browse files' },
  { title: 'See how code connects', copy: 'Open Connections and switch between parser-derived imports and the folder/symbol mind map.', action: 'visual', cta: 'Open connections' },
  { title: 'Ask with evidence', copy: 'Ask a question in the conversation, then open one of the returned source citations.', action: 'citation', cta: 'Ask SHIRO' },
  { title: 'Make a study output', copy: 'Generate a cited report, flashcard set, or quiz from the same indexed commit.', action: 'artifact', cta: 'Open Studio' }
];

async function api(path, options = {}) {
  const headers=new Headers(options.headers||{});
  if(!headers.has('Content-Type'))headers.set('Content-Type','application/json');
  if(accessToken)headers.set('Authorization',`Bearer ${accessToken}`);
  const response = await fetch(path, { ...options, headers });
  let data = {};
  try { data = await response.json(); } catch { /* the server may return an empty body */ }
  if (!response.ok) throw Error(data.error || `Request failed (${response.status})`);
  return data;
}

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('visible'), 3200);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function repoIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 6h6l2 2h7v10.5h-15z"/><path d="M4.5 10h15"/></svg>';
}

async function refreshRepos() {
  try {
    const data = await api('/api/repositories');
    repositories = data.repositories;
    if (activeRepo && !repositories.some(repo => repo.id === activeRepo.id)) activeRepo = null;
    renderRepos();
    if (!activeRepo && repositories.length) await selectRepo(repositories[0].id);
    else if (!activeRepo) updateCompanionContext();
  } catch (error) {
    toast(`Workspace unavailable: ${error.message}`);
  }
}

function renderRepos() {
  const root = $('#repo-list');
  const query = $('#repo-filter').value.trim().toLowerCase();
  const visible = repositories.filter(repo => repo.name.toLowerCase().includes(query));
  if (!visible.length) {
    root.innerHTML = repositories.length
      ? '<p class="answer-hint">No repositories match that filter.</p>'
      : '<div class="empty-repos"><div class="empty-orbit" aria-hidden="true"><span></span><span></span><span></span></div><strong>No repository yet</strong><p>Connect a public GitHub repository and SHIRO will map its source locally.</p><button class="primary small" data-action="connect">Connect GitHub <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div>';
    return;
  }
  root.innerHTML = visible.map(repo => `<button class="repo-item ${activeRepo?.id === repo.id ? 'selected' : ''}" data-repo="${escapeHtml(repo.id)}" aria-current="${activeRepo?.id === repo.id ? 'true' : 'false'}"><span class="repo-symbol">${repoIcon()}</span><span><strong>${escapeHtml(repo.name)}</strong><small>${repo.status === 'ready' ? `${repo.file_count} files · ${escapeHtml(repo.branch)}` : escapeHtml(repo.status)}</small></span></button>`).join('');
}

async function selectRepo(id) {
  activeRepo = repositories.find(repo => repo.id === id) || null;
  if (!activeRepo) return;
  renderRepos();
  $('#explorer-title').textContent = activeRepo.name;
  $('#repo-breadcrumb').textContent = `SHIRO / ${activeRepo.name}`;
  $('#branch-chip').textContent = `${activeRepo.branch} · ${activeRepo.commit_sha.slice(0, 9)}`;
  $('#branch-commit').textContent = `${activeRepo.branch} · ${activeRepo.commit_sha.slice(0, 9)}`;
  $('.delete-repo').hidden = false;
  $('#stage-repo').textContent = activeRepo.name;
  $('#repo-panel').classList.remove('open');
  $('#repo-toggle').setAttribute('aria-expanded', 'false');
  updateCompanionContext();
  await Promise.all([loadFiles(), loadInvestigations()]);
  $('#studio-commit').textContent = `Snapshot ${activeRepo.commit_sha.slice(0, 9)}`;
  await loadArtifacts();
  if (tour.active && tourSteps[tour.step]?.action === 'repo') markTour('repo');
  if ($('.tab.selected')?.dataset.tab === 'graph') loadGraph();
}

async function loadFiles() {
  if (!activeRepo) return;
  try {
    const data = await api(`/api/repositories/${activeRepo.id}/files`);
    files = data.files;
    $('#file-count').textContent = `${files.length} indexed files`;
    renderFiles();
  } catch (error) { toast(error.message); }
}

function renderFiles() {
  const query = $('#file-filter').value.toLowerCase();
  const selected = $('.file-entry.selected')?.dataset.path;
  const filtered = files.filter(file => file.path.toLowerCase().includes(query));
  $('#file-list').innerHTML = filtered.length
    ? filtered.map(file => `<button class="file-entry ${selected === file.path ? 'selected' : ''}" data-path="${escapeHtml(file.path)}">${escapeHtml(file.path)}<br><span>${escapeHtml(file.language)} · ${file.bytes} bytes</span></button>`).join('')
    : '<p class="answer-hint">No files match this filter.</p>';
}

async function showFile(path, focusStart = null, focusEnd = focusStart) {
  if (!activeRepo) return;
  $$('.file-entry').forEach(entry => entry.classList.toggle('selected', entry.dataset.path === path));
  try {
    const data = await api(`/api/repositories/${activeRepo.id}/file?path=${encodeURIComponent(path)}`);
    const code=$('#file-source code');code.replaceChildren();const lines=data.content.split('\n');
    lines.forEach((line,index)=>{const number=index+1;const row=document.createElement('span');row.className='source-line';row.dataset.line=number;if(focusStart&&number>=focusStart&&number<=(focusEnd||focusStart))row.classList.add('citation-line');row.textContent=`${String(number).padStart(4,' ')}  ${line}${index<lines.length-1?'\n':''}`;code.append(row);});
    if(focusStart)code.querySelector(`[data-line="${focusStart}"]`)?.scrollIntoView({block:'center'});
    markTour('file');
  } catch (error) { toast(error.message); }
}

function setTab(name) {
  const titles = { ask: activeRepo?.name || 'Ask SHIRO', files: 'Source files', graph: 'Connections', investigations: 'Investigations', studio: 'Studio' };
  $$('[data-tab]').forEach(tab => {
    const selected = tab.dataset.tab === name;
    tab.classList.toggle('selected', selected);
    if (tab.getAttribute('role') === 'tab') tab.setAttribute('aria-selected', String(selected));
    if (tab.classList.contains('workspace-link')) {
      if (selected) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    }
  });
  $$('.view').forEach(view => view.classList.toggle('hidden', view.id !== `view-${name}`));
  $('#explorer-title').textContent = titles[name] || 'SHIRO';
  if (name === 'graph') { if($('[data-visual="mindmap"]')?.classList.contains('selected'))loadMindMap();else loadGraph(); }
  if (name === 'investigations') loadInvestigations();
  if (name === 'studio') loadArtifacts();
}

async function loadGraph() {
  if (!activeRepo) return;
  const root = $('#graph-view');
  root.innerHTML = '<p class="answer-hint">Reading parser-derived imports…</p>';
  try {
    const graph = await api(`/api/repositories/${activeRepo.id}/graph`);
    $('#graph-note').textContent = graph.note;
    if (!graph.nodes.length) {
      root.innerHTML = '<p class="answer-hint">No indexed source files were found.</p>';
      return;
    }
    const nodes = graph.nodes.slice(0, 28);
    const width = 760, height = 350, columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length))), positions = {};
    nodes.forEach((node, index) => {
      const column = index % columns, row = Math.floor(index / columns);
      positions[node.id] = { x: 70 + column * (width - 140) / Math.max(1, columns - 1), y: 55 + row * 90 };
    });
    const edges = graph.edges.filter(edge => positions[edge.source] && positions[edge.target]);
    root.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Import relationships between repository files">${edges.map(edge => `<line class="graph-edge" x1="${positions[edge.source].x}" y1="${positions[edge.source].y}" x2="${positions[edge.target].x}" y2="${positions[edge.target].y}"/>`).join('')}${nodes.map(node => `<g class="graph-node" tabindex="0" role="button" aria-label="Open ${escapeHtml(node.label)}" data-graph-path="${escapeHtml(node.id)}" transform="translate(${positions[node.id].x},${positions[node.id].y})"><circle r="25"/><text y="4">${escapeHtml(node.label.split('/').pop().slice(0, 13))}</text></g>`).join('')}</svg>${edges.length ? '' : '<p class="answer-hint">Files are indexed; no resolvable relative imports were found by the current parser.</p>'}`;
  } catch (error) {
    root.innerHTML = `<p class="error-message">${escapeHtml(error.message)}</p>`;
  }
}

async function loadMindMap() {
  if (!activeRepo) return;
  const root=$('#mindmap-view'); root.innerHTML='<p class="answer-hint">Mapping indexed folders and symbols…</p>';
  try {
    const map=await api(`/api/repositories/${activeRepo.id}/mindmap`); $('#graph-note').textContent=map.note;
    const levels={}; const depth={}; depth[`repo:${activeRepo.id}`]=0;
    for(let pass=0;pass<5;pass++) for(const edge of map.edges) if(edge.kind==='contains'||edge.kind==='defines') depth[edge.target]=Math.max(depth[edge.target]||0,(depth[edge.source]||0)+1);
    for(const node of map.nodes) { const d=depth[node.id]||0; (levels[d] ||= []).push(node); }
    const maxRows=Math.max(...Object.values(levels).map(rows=>rows.length),1), width=Math.max(900,(Math.max(...Object.keys(levels).map(Number))+1)*245+140), height=Math.max(430,maxRows*76+50), positions={};
    for(const [d,rows] of Object.entries(levels)) rows.forEach((node,i)=>{positions[node.id]={x:115+Number(d)*230,y:38+i*height/Math.max(1,rows.length)};});
    const treeEdges=map.edges.filter(edge=>edge.kind!=='imports'&&positions[edge.source]&&positions[edge.target]);
    const importEdges=map.edges.filter(edge=>edge.kind==='imports'&&positions[edge.source]&&positions[edge.target]);
    root.innerHTML=`<svg viewBox="0 0 ${width} ${height}" style="width:${width}px;height:${height}px;max-width:none;min-width:0;min-height:0" role="group" aria-label="Mind map of ${escapeHtml(activeRepo.name)}"><g aria-hidden="true">${treeEdges.map(edge=>`<path class="mind-tree-edge" d="M${positions[edge.source].x+70} ${positions[edge.source].y} C${positions[edge.source].x+130} ${positions[edge.source].y},${positions[edge.target].x-65} ${positions[edge.target].y},${positions[edge.target].x-60} ${positions[edge.target].y}"/>`).join('')}${importEdges.map(edge=>`<path class="mind-import-edge" d="M${positions[edge.source].x} ${positions[edge.source].y+18} Q${(positions[edge.source].x+positions[edge.target].x)/2} ${(positions[edge.source].y+positions[edge.target].y)/2+24} ${positions[edge.target].x} ${positions[edge.target].y+18}"/>`).join('')}</g>${map.nodes.map(node=>{const p=positions[node.id], canOpen=node.path&&node.type!=='folder'; return `<g class="mind-node mind-${node.type}" ${canOpen?`role="button" tabindex="0" data-graph-path="${escapeHtml(node.path)}" aria-label="Open ${escapeHtml(node.path)}${node.line?` at line ${node.line}`:''}"`:'role="group"'} transform="translate(${p.x},${p.y})"><rect x="-72" y="-20" width="144" height="40" rx="8"/><text y="4">${escapeHtml(node.label.length>22?node.label.slice(0,20)+'…':node.label)}</text><title>${escapeHtml(node.path||node.label)}${node.line?` · line ${node.line}`:''}</title></g>`;}).join('')}</svg><p class="map-legend"><span>Solid lines · folder and symbol structure</span><span>Dashed lines · parser-derived imports</span><span>${map.nodes.filter(node=>node.type==='file').length} files · commit ${map.commit.slice(0,9)}</span></p>`;
  } catch(error) { root.innerHTML=`<p class="error-message">${escapeHtml(error.message)}</p>`; }
}

function setVisual(kind) {
  const mindmap=kind==='mindmap';
  $$('[data-visual]').forEach(button=>{const selected=button.dataset.visual===kind;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});
  $('#graph-view').classList.toggle('hidden',mindmap); $('#mindmap-view').classList.toggle('hidden',!mindmap);
  $('#visual-title').textContent=mindmap?'Codebase mind map':'Import map';
  if(mindmap) loadMindMap(); else loadGraph();
  markTour('visual');
}

async function loadArtifacts() {
  if (!activeRepo) return;
  try {
    const data=await api(`/api/repositories/${activeRepo.id}/artifacts`);
    renderArtifactLibrary(data.artifacts||[]);
  } catch(error) { $('#studio-library-list').innerHTML=`<p class="error-message">${escapeHtml(error.message)}</p>`; }
}

function renderArtifactLibrary(items) {
  const root=$('#studio-library-list');
  if(!items.length){root.innerHTML='<p class="answer-hint">Your reports and study sets will appear here.</p>';return;}
  root.innerHTML=items.map(item=>`<div class="artifact-library-row"><button data-artifact="${escapeHtml(item.id)}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.type)} · ${escapeHtml(item.commit_sha.slice(0,9))}</span></button><button class="artifact-delete" data-delete-artifact="${escapeHtml(item.id)}" aria-label="Delete ${escapeHtml(item.title)}">×</button></div>`).join('');
}

function citationMarkup(citations=[]) {
  return citations.map(c=>`<button class="studio-citation" data-citation-path="${escapeHtml(c.path)}" data-citation-line="${c.start}">${escapeHtml(c.path)} · L${c.start}${c.end!==c.start?`–${c.end}`:''}</button>`).join(' ');
}

function renderArtifact(item) {
  currentArtifact=item; const p=item.payload; const root=$('#studio-result');
  const header=`<header class="artifact-header"><div><h4>${escapeHtml(p.title)}</h4><p>${escapeHtml(item.type)} · commit ${escapeHtml(item.commit_sha.slice(0,9))}</p></div>${item.type==='report'?'<button class="quiet small" data-action="export-report">Export Markdown</button>':''}</header>`;
  if(item.type==='report') root.innerHTML=header+`<p class="report-summary">${escapeHtml(p.summary||'')}</p>${p.sections.map(section=>`<section class="report-section"><h5>${escapeHtml(section.heading)}</h5><p>${escapeHtml(section.body)}</p><div>${citationMarkup(section.citations)}</div></section>`).join('')}<p class="report-caveats">${escapeHtml(p.caveats||'Check each cited range against the indexed source.')}</p>`;
  if(item.type==='flashcards'){flashcardIndex=0;flashcardRevealed=false;renderFlashcard();}
  if(item.type==='quiz'){root.innerHTML=header+`<div class="quiz-run"><form id="quiz-form"><div id="quiz-question"></div><button class="primary small" type="submit">Check answer</button></form><div id="quiz-feedback" role="status"></div><button class="quiet small" data-action="quiz-next">Next question</button></div>`;renderQuizQuestion();}
}

function renderFlashcard() {
  if(!currentArtifact)return;const cards=currentArtifact.payload.cards;const card=cards[flashcardIndex];
  $('#studio-result').innerHTML=`<header class="artifact-header"><div><h4>${escapeHtml(currentArtifact.payload.title)}</h4><p>Card ${flashcardIndex+1} of ${cards.length} · commit ${escapeHtml(currentArtifact.commit_sha.slice(0,9))}</p></div></header><article class="flashcard"><p>${flashcardRevealed?'Answer':'Prompt'}</p><strong>${escapeHtml(flashcardRevealed?card.back:card.front)}</strong><div>${citationMarkup(card.citations)}</div></article><div class="flashcard-controls"><button class="quiet small" data-action="card-prev" ${flashcardIndex===0?'disabled':''}>Previous</button><button class="primary small" data-action="card-reveal">${flashcardRevealed?'Show prompt':'Reveal answer'}</button><button class="quiet small" data-action="card-next" ${flashcardIndex===cards.length-1?'disabled':''}>Next</button></div>`;
}

function renderQuizQuestion() {
  if(!currentArtifact)return;const questions=currentArtifact.payload.questions;let index=Number($('#quiz-form').dataset.index||0);index=Math.min(index,questions.length-1);$('#quiz-form').dataset.index=index;
  const q=questions[index];$('#quiz-question').innerHTML=`<p>Question ${index+1} of ${questions.length}</p><strong>${escapeHtml(q.question)}</strong><div class="quiz-options">${q.options.map((option,i)=>`<label><input type="radio" name="answer" value="${i}" required><span>${escapeHtml(option)}</span></label>`).join('')}</div><div>${citationMarkup(q.citations)}</div>`;$('#quiz-feedback').textContent='';
}

function markTour(action) { if(!tour.active||tourSteps[tour.step]?.action!==action)return;tour.ready=true;renderTour(); }
function renderTour() {
  const panel=$('#tour-panel');if(!panel)return;
  if(!tour.active){panel.hidden=localStorage.getItem(`shiro-tour:${tourUserId}:skipped`)==='1'||localStorage.getItem(`shiro-tour:${tourUserId}:complete`)==='1';return;}
  const step=tourSteps[tour.step];panel.hidden=false;$('#tour-progress-label').textContent=`Guided tour · ${tour.step+1} of ${tourSteps.length}`;$('#tour-title').textContent=step.title;$('#tour-copy').textContent=step.copy;
  const start=panel.querySelector('[data-action="tour-start"]');start.textContent=step.cta;start.dataset.tourCta=step.action;
  panel.querySelector('[data-action="tour-next"]').disabled=!tour.ready;
}

function startTour() { tour={active:true,step:0,ready:Boolean(activeRepo)};localStorage.removeItem(`shiro-tour:${tourUserId}:skipped`);renderTour(); }
function tourCta(action) { if(action==='repo'){if(activeRepo)markTour('repo');else openConnect();}if(action==='file'){setTab('files');}if(action==='visual'){setTab('graph');setVisual('mindmap');}if(action==='citation'){setTab('ask');$('#companion-question').focus();}if(action==='artifact'){setTab('studio');} }

function setHostedAuthState(session, message='') {
  const locked=!session;
  const hosted=document.body.classList.contains('hosted-mode');
  document.body.classList.toggle('auth-locked',locked);
  $('#auth-gate').hidden=!locked;
  $('#auth-signout').hidden=locked||!document.body.classList.contains('hosted-mode');
  $('#rail-mode-label').textContent=hosted?'HOSTED':'LOCAL';
  $('#repo-storage-label').textContent=hosted?'Private to your account':'Index stays on this machine';
  $('#workspace-mode-label').textContent=hosted?'SUPABASE WORKSPACE':'LOCAL WORKSPACE';
  if(message)$('#auth-message').textContent=message;
  accessToken=session?.access_token||null;
  tourUserId=session?.user?.id||'local';
}

async function configureHostedAuth() {
  let config;
  try{config=await api('/api/config');}catch{return true;}
  if(config.mode!=='hosted'){setHostedAuthState({access_token:null});return true;}
  document.body.classList.add('hosted-mode');
  if(!config.auth_configured){setHostedAuthState(null,'Hosted SHIRO needs SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and DATABASE_URL in Vercel before sign-in can start.');$('#github-sign-in').disabled=true;return false;}
  try {
    const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.118.0');
    authClient=createClient(config.supabase_url,config.supabase_publishable_key,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    $('#github-sign-in').addEventListener('click',async()=>{const button=$('#github-sign-in');button.disabled=true;button.textContent='Redirecting to GitHub…';const {error}=await authClient.auth.signInWithOAuth({provider:'github',options:{redirectTo:window.location.origin}});if(error){setHostedAuthState(null,`GitHub sign-in failed: ${error.message}`);button.disabled=false;button.textContent='Continue with GitHub';}});
    $('#auth-signout').addEventListener('click',async()=>{const {error}=await authClient.auth.signOut();if(error)toast(`Sign out failed: ${error.message}`);});
    let wasSignedIn=false;
    authClient.auth.onAuthStateChange((_event,session)=>{
      accessToken=session?.access_token||null;
      setHostedAuthState(session);
      if(session&&!wasSignedIn){wasSignedIn=true;setTimeout(()=>{refreshRepos();health();},0);}
      if(!session)wasSignedIn=false;
    });
    const {data,error}=await authClient.auth.getSession();
    if(error)throw error;
    setHostedAuthState(data.session);
    return Boolean(data.session);
  } catch(error) {
    setHostedAuthState(null,`Could not initialize SHIRO sign-in. Check the deployment connection and retry. ${error.message||''}`);
    return false;
  }
}

async function loadInvestigations() {
  if (!activeRepo) return;
  try {
    const data = await api(`/api/repositories/${activeRepo.id}/investigations`);
    $('#investigation-list').innerHTML = data.investigations.length
      ? data.investigations.map(item => `<article class="investigation-item"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.question)}</p><small>${new Date(item.created_at).toLocaleString()}</small></article>`).join('')
      : '<p class="answer-hint">Saved investigations appear here.</p>';
  } catch (error) { toast(error.message); }
}

function conversationKey() { return `shiro-conversation:${activeRepo?.id || 'none'}`; }
function readConversation() {
  try { return JSON.parse(localStorage.getItem(conversationKey()) || '[]'); }
  catch { return []; }
}
function saveConversation(messages) {
  try { localStorage.setItem(conversationKey(), JSON.stringify(messages.slice(-40))); }
  catch { toast('Browser storage is full. This message may not be saved.'); }
}

function appendMessage(role, text, evidence = []) {
  const message = document.createElement('article');
  message.className = `companion-message ${role}`;
  const body = document.createElement('p');
  body.textContent = text;
  message.append(body);
  for (const item of evidence) {
    const reference = document.createElement('a');
    reference.href = '#workspace';
    reference.className = 'companion-reference';
    const lines = item.ranges?.map(range => range.start).filter(Boolean);
    reference.textContent = `${item.path}${lines?.length ? ` · line${lines.length > 1 ? 's' : ''} ${lines.join(', ')}` : ''}`;
    reference.addEventListener('click', () => {
      markTour('citation');
      setTab('files');
      $('#file-filter').value = item.path;
      renderFiles();
      showFile(item.path, item.ranges?.[0]?.start, item.ranges?.[0]?.end);
    });
    message.append(reference);
  }
  $('#companion-messages').append(message);
  $('#companion-messages').scrollTop = $('#companion-messages').scrollHeight;
}

function renderConversation() {
  const root = $('#companion-messages');
  if (!root) return;
  root.replaceChildren();
  const history = readConversation();
  if (!history.length) {
    appendMessage('assistant', activeRepo
      ? `I’m ready to inspect ${activeRepo.name}. Ask about a symbol, behavior, or file; I’ll show the source evidence I find.`
      : 'Connect a repository and I can trace your question to its indexed source.');
    return;
  }
  history.forEach(message => appendMessage(message.role, message.text, message.evidence || []));
}

function setCompanionState(state, label, activity) {
  const expressions = {
    idle: 'neutral', listening: 'neutral', thinking: 'thinking', searching_repository: 'thinking',
    analyzing_dependencies: 'focused', generating_answer: 'explaining', speaking: 'explaining',
    success: 'happy', warning: 'confused', error: 'concerned'
  };
  $('#workspace-shell').dataset.state = state;
  $$('.companion-state-label').forEach(element => { element.textContent = label; });
  $('#companion-activity-text').textContent = activity;
  const image = `assets/shiro-${expressions[state] || 'neutral'}.png`;
  ['#companion-launcher-portrait', '#shiro-portrait'].forEach(selector => {
    const portrait = $(selector);
    if (!portrait || portrait.getAttribute('src') === image) return;
    portrait.classList.add('is-changing');
    portrait.onload = () => portrait.classList.remove('is-changing');
    portrait.onerror = () => portrait.classList.remove('is-changing');
    portrait.src = image;
    setTimeout(() => portrait.classList.remove('is-changing'), 260);
  });
}

function updateCompanionContext() {
  $$('.companion-repo-label').forEach(label => {
    label.textContent = activeRepo ? ` · ${activeRepo.name}` : ' · Select a repository';
  });
  renderConversation();
  setCompanionState('idle', activeRepo ? 'Ready' : 'Waiting for repository', activeRepo
    ? `Questions are searched against the indexed snapshot ${activeRepo.commit_sha}.`
    : 'Connect a public repository to begin source-backed analysis.');
}

function openConnect() {
  const dialog = $('#connect-dialog');
  if (!dialog.open) dialog.showModal();
  setTimeout(() => $('#repo-url').focus(), 50);
}

document.addEventListener('click', async event => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'connect') openConnect();
  if (action === 'tour-start') {
    const cta=event.target.closest('[data-tour-cta]');
    if(cta) tourCta(cta.dataset.tourCta); else startTour();
  }
  if (action === 'tour-skip') { tour.active=false;localStorage.setItem(`shiro-tour:${tourUserId}:skipped`,'1');renderTour(); }
  if (action === 'tour-next' && tour.ready) {
    if(tour.step===tourSteps.length-1){tour.active=false;localStorage.setItem(`shiro-tour:${tourUserId}:complete`,'1');renderTour();toast('Walkthrough complete. Restart it from the Tour button.');}
    else {tour.step++;tour.ready=false;renderTour();}
  }
  if (action === 'export-report' && currentArtifact?.type==='report') {
    const p=currentArtifact.payload;const lines=[`# ${p.title}`,`\n> Source snapshot ${currentArtifact.commit_sha}`,`\n${p.summary||''}`];
    for(const section of p.sections)lines.push(`\n## ${section.heading}\n\n${section.body}\n\nSources: ${section.citations.map(c=>`${c.path}:L${c.start}-L${c.end}`).join(', ')}`);
    if(p.caveats)lines.push(`\n## Evidence notes\n\n${p.caveats}`);
    const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/markdown'}));link.download=`${p.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'shiro-report'}.md`;link.click();URL.revokeObjectURL(link.href);
  }
  if(action==='card-reveal'){flashcardRevealed=!flashcardRevealed;renderFlashcard();}
  if(action==='card-prev'){flashcardIndex=Math.max(0,flashcardIndex-1);flashcardRevealed=false;renderFlashcard();}
  if(action==='card-next'){flashcardIndex=Math.min(currentArtifact.payload.cards.length-1,flashcardIndex+1);flashcardRevealed=false;renderFlashcard();}
  if(action==='quiz-next'){const form=$('#quiz-form');if(Number(form.dataset.index)<currentArtifact.payload.questions.length-1){form.dataset.index=String(Number(form.dataset.index)+1);renderQuizQuestion();}}
  if (action === 'close-dialog') $('#connect-dialog').close();
  if (action === 'toggle-repositories') {
    const panel = $('#repo-panel'), toggle = $('#repo-toggle');
    const open = !panel.classList.contains('open');
    panel.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
  }
  if (action === 'focus-search') {
    event.preventDefault();
    setTab('files');
    setTimeout(() => $('#file-filter').focus(), 0);
  }
  if (action === 'show-graph') setTab('graph');

  if (action === 'delete-repo' && activeRepo && confirm(`Remove ${activeRepo.name} and its indexed source, investigations, and saved Studio outputs?`)) {
    try {
      await api(`/api/repositories/${activeRepo.id}`, { method: 'DELETE' });
      activeRepo = null;
      files = [];
      $('.delete-repo').hidden = true;
      $('#explorer-title').textContent = 'Ask SHIRO';
      $('#repo-breadcrumb').textContent = 'SHIRO / WORKSPACE';
      $('#branch-chip').textContent = 'LOCAL WORKSPACE';
      $('#branch-commit').textContent = 'Waiting for a repository';
      $('#stage-repo').textContent = 'No repository selected';
      $('#file-count').textContent = '0 files';
      $('#file-list').innerHTML = '<p class="answer-hint">Connect a repository to browse its files.</p>';
      $('#file-source code').textContent = 'Select a file to inspect its indexed source.';
      await refreshRepos();
      toast('Repository index and saved outputs removed.');
    } catch (error) { toast(error.message); }
  }

  const repository = event.target.closest('[data-repo]');
  if (repository) await selectRepo(repository.dataset.repo);
  const tab = event.target.closest('[data-tab]');
  if (tab) setTab(tab.dataset.tab);
  const visual=event.target.closest('[data-visual]');if(visual)setVisual(visual.dataset.visual);
  const output=event.target.closest('[data-output]');
  if(output){studioType=output.dataset.output;$$('[data-output]').forEach(button=>{const selected=button===output;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});if(studioType==='mindmap'){setTab('graph');setVisual('mindmap');}else{$('#report-format-wrap').hidden=studioType!=='report';$('#studio-generate').textContent=`Generate ${studioType==='report'?'report':studioType==='flashcards'?'flashcards':'quiz'}`;}}
  const saved=event.target.closest('[data-artifact]');
  if(saved&&activeRepo){const data=await api(`/api/repositories/${activeRepo.id}/artifacts`);const item=data.artifacts.find(artifact=>artifact.id===saved.dataset.artifact);if(item)renderArtifact(item);}
  const removeArtifact=event.target.closest('[data-delete-artifact]');
  if(removeArtifact&&activeRepo&&confirm('Delete this saved Studio output?')){try{await api(`/api/repositories/${activeRepo.id}/artifacts/${removeArtifact.dataset.deleteArtifact}`,{method:'DELETE'});await loadArtifacts();if(currentArtifact?.id===removeArtifact.dataset.deleteArtifact){currentArtifact=null;$('#studio-result').innerHTML='<p class="answer-hint">Select a saved output or create a new one.</p>';}}catch(error){toast(error.message);}}
  const citation=event.target.closest('[data-citation-path]');
  if(citation){setTab('files');$('#file-filter').value=citation.dataset.citationPath;renderFiles();await showFile(citation.dataset.citationPath,Number(citation.dataset.citationLine));markTour('citation');}
  const suggestion = event.target.closest('[data-question]');
  if (suggestion) {
    $('#companion-question').value = suggestion.dataset.question;
    $('#companion-question').focus();
  }
  const entry = event.target.closest('[data-path]');
  if (entry) await showFile(entry.dataset.path);
  const graphNode = event.target.closest('[data-graph-path]');
  if (graphNode) {
    setTab('files');
    $('#file-filter').value = graphNode.dataset.graphPath;
    renderFiles();
    showFile(graphNode.dataset.graphPath);
  }
});

document.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches('[data-graph-path][role="button"]')){event.preventDefault();event.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});

$('#repo-filter').addEventListener('input', renderRepos);
$('#file-filter').addEventListener('input', renderFiles);

$('#connect-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('#connect-submit'), error = $('#connect-error');
  error.textContent = '';
  button.disabled = true;
  button.innerHTML = 'Indexing archive…';
  try {
    const data = await api('/api/repositories', { method: 'POST', body: JSON.stringify({ url: $('#repo-url').value.trim() }) });
    $('#connect-dialog').close();
    $('#repo-url').value = '';
    await refreshRepos();
    await selectRepo(data.id);
    toast(`Indexed ${data.file_count} source files · ${data.commit_sha.slice(0, 9)}`);
  } catch (error) {
    $('#connect-error').textContent = error.message;
  } finally {
    button.disabled = false;
    button.innerHTML = 'Index repository <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  }
});

$('#companion-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (companionBusy) return;
  const question = $('#companion-question').value.trim();
  if (!question) return;
  if (!activeRepo) {
    setCompanionState('warning', 'Waiting for repository', 'Connect or select a repository before asking a codebase question.');
    $('#repo-panel').classList.add('open');
    $('#repo-toggle').setAttribute('aria-expanded', 'true');
    return;
  }
  const submit = event.submitter;
  const history = readConversation();
  history.push({ role: 'user', text: question });
  saveConversation(history);
  renderConversation();
  $('#companion-question').value = '';
  companionBusy = true;
  submit.disabled = true;
  setCompanionState('searching_repository', 'Searching repository', `Searching the indexed source for: “${question}”`);
  const repoId = activeRepo.id;
  try {
    const result = await api(`/api/repositories/${repoId}/ask`, { method: 'POST', body: JSON.stringify({ question }) });
    const response = { role: 'assistant', text: result.answer, evidence: result.evidence || [] };
    const latest = readConversation();
    latest.push(response);
    saveConversation(latest);
    renderConversation();
    if (response.evidence.length) {
      setCompanionState('success', 'Evidence found', result.provider === 'nvidia'
        ? `NVIDIA drafted an answer from ${response.evidence.length} matched source item(s). Check the cited lines.`
        : `Local retrieval found ${response.evidence.length} source item(s). Review the cited lines.`);
    } else {
      setCompanionState('warning', 'Limited evidence', result.uncertainties?.join(' ') || 'The indexed snapshot did not return a source match.');
    }
  } catch (error) {
    const response = { role: 'assistant', text: `I couldn’t complete that repository search: ${error.message}` };
    const latest = readConversation();
    latest.push(response);
    saveConversation(latest);
    renderConversation();
    setCompanionState('error', 'Request failed', error.message);
  } finally {
    companionBusy = false;
    submit.disabled = false;
    $('#companion-question').focus();
  }
});

$('#investigation-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!activeRepo) {
    toast('Connect a repository before saving an investigation.');
    return;
  }
  const title = $('#investigation-title').value.trim();
  const question = $('#investigation-question').value.trim();
  try {
    await api(`/api/repositories/${activeRepo.id}/investigations`, { method: 'POST', body: JSON.stringify({ title, question }) });
    event.target.reset();
    await loadInvestigations();
    toast('Investigation saved with source search results.');
  } catch (error) { toast(error.message); }
});

$('#studio-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!activeRepo){toast('Select or connect a repository before generating a Studio output.');return;}
  if(studioType==='mindmap'){setTab('graph');setVisual('mindmap');return;}
  const button=$('#studio-generate'),status=$('#studio-status');button.disabled=true;button.textContent='Finding source evidence…';status.textContent='Preparing a cited output from the indexed snapshot.';
  try{const item=await api(`/api/repositories/${activeRepo.id}/artifacts`,{method:'POST',body:JSON.stringify({type:studioType,focus:$('#studio-focus').value.trim(),format:$('#report-format').value})});renderArtifact(item);await loadArtifacts();status.textContent=`Saved to commit ${item.commit_sha.slice(0,9)}. Items link to indexed source lines.`;markTour('artifact');}
  catch(error){status.textContent=error.message;$('#studio-result').innerHTML=`<p class="error-message">${escapeHtml(error.message)}</p><p class="answer-hint">Try a specific file or symbol. SHIRO only saves outputs when their citations validate.</p>`;}
  finally{button.disabled=false;button.textContent=`Generate ${studioType==='report'?'report':studioType==='flashcards'?'flashcards':'quiz'}`;}
});

document.addEventListener('submit',event=>{if(event.target.id!=='quiz-form')return;event.preventDefault();const q=currentArtifact.payload.questions[Number(event.target.dataset.index)];const selected=event.target.querySelector('input[name="answer"]:checked');if(!selected)return;const correct=Number(selected.value)===q.answer_index;$('#quiz-feedback').innerHTML=`<strong class="${correct?'quiz-correct':'quiz-incorrect'}">${correct?'Correct':'Not quite'}</strong><p>${escapeHtml(q.explanation)}</p><div>${citationMarkup(q.citations)}</div>`;event.target.querySelectorAll('input').forEach(input=>{input.disabled=true;});});

async function health() {
  try {
    const data = await api('/api/health');
    if (data.status !== 'ok') throw Error('offline');
    $('.companion-footnote').textContent = data.provider === 'nvidia'
      ? `NVIDIA ${data.model} · Free endpoint · Matched excerpts are sent when asking`
      : 'Local source search · Evidence-linked · NVIDIA not configured';
  } catch {
    $('#stage-repo').textContent = 'Start the local server to connect';
  }
}

async function initializeWorkspace(){
  const ready=await configureHostedAuth();
  renderTour();
  if(ready){await refreshRepos();await health();}
}
initializeWorkspace();

