const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let repositories = [];
let activeRepo = null;
let files = [];
let toastTimer;
let companionBusy = false;

async function api(path, options = {}) {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
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

async function showFile(path) {
  if (!activeRepo) return;
  $$('.file-entry').forEach(entry => entry.classList.toggle('selected', entry.dataset.path === path));
  try {
    const data = await api(`/api/repositories/${activeRepo.id}/file?path=${encodeURIComponent(path)}`);
    $('#file-source code').textContent = data.content.split('\n').map((line, index) => `${String(index + 1).padStart(4, ' ')}  ${line}`).join('\n');
  } catch (error) { toast(error.message); }
}

function setTab(name) {
  const titles = { ask: activeRepo?.name || 'Ask SHIRO', files: 'Source files', graph: 'Import map', investigations: 'Investigations' };
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
  if (name === 'graph') loadGraph();
  if (name === 'investigations') loadInvestigations();
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
      setTab('files');
      $('#file-filter').value = item.path;
      renderFiles();
      showFile(item.path);
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

  if (action === 'delete-repo' && activeRepo && confirm(`Remove ${activeRepo.name} and its local index? This also deletes saved investigations.`)) {
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
      toast('Local index removed.');
    } catch (error) { toast(error.message); }
  }

  const repository = event.target.closest('[data-repo]');
  if (repository) await selectRepo(repository.dataset.repo);
  const tab = event.target.closest('[data-tab]');
  if (tab) setTab(tab.dataset.tab);
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

refreshRepos();
health();

