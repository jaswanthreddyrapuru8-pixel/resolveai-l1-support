const $ = (id) => document.getElementById(id);
let tickets = [];
let activeTicket = null;
let toastTimer;

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}
function prettyDate(value) {
  try { return new Date(value).toLocaleDateString(undefined, {month:'short', day:'numeric'}); }
  catch { return '—'; }
}
function statusClass(status) { return status.replace(/\s+/g, '-'); }
function showToast(message) {
  const toast = $('toast'); toast.textContent = message; toast.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}
async function api(path, options = {}) {
  const response = await fetch(path, {headers:{'Content-Type':'application/json', ...(options.headers || {})}, ...options});
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try { const data = await response.json(); message = data.detail || data.error || message; } catch {}
    throw new Error(message);
  }
  return response.json();
}
async function loadTickets() {
  const query = $('searchInput').value.trim();
  try {
    tickets = await api('/api/tickets' + (query ? `?q=${encodeURIComponent(query)}` : ''));
    renderTickets(); updateStats();
  } catch (error) {
    $('ticketRows').innerHTML = `<tr><td colspan="5" class="empty">Could not load tickets. Start the FastAPI server and refresh.</td></tr>`;
    showToast(error.message);
  }
}
function updateStats() {
  $('totalCount').textContent = tickets.length;
  $('openCount').textContent = tickets.filter(t => ['Open','In Progress','Escalated'].includes(t.status)).length;
  $('highCount').textContent = tickets.filter(t => t.priority === 'High' && t.status !== 'Resolved').length;
  $('resolvedCount').textContent = tickets.filter(t => t.status === 'Resolved').length;
  $('navCount').textContent = tickets.length;
}
function renderTickets() {
  const filter = $('statusFilter').value;
  const visible = tickets.filter(t => filter === 'All' || t.status === filter);
  $('resultCount').textContent = `Showing ${visible.length} ticket${visible.length === 1 ? '' : 's'}`;
  if (!visible.length) {
    $('ticketRows').innerHTML = '<tr><td colspan="5" class="empty">No matching tickets. Create a new ticket to get started.</td></tr>'; return;
  }
  $('ticketRows').innerHTML = visible.map(t => `<tr data-id="${t.id}" tabindex="0" aria-label="Open ticket ${t.id}">
    <td><span class="ticket-id">#INC-${String(t.id).padStart(4,'0')}</span><div class="issue-sub">${escapeHtml(prettyDate(t.created_at))}</div></td>
    <td><div class="issue-title">${escapeHtml(t.subject)}</div><div class="issue-sub">${escapeHtml(t.category)} · ${escapeHtml(t.requester)}</div></td>
    <td><span class="priority ${escapeHtml(t.priority)}">${escapeHtml(t.priority)}</span></td>
    <td><span class="status ${statusClass(escapeHtml(t.status))}">${escapeHtml(t.status)}</span></td>
    <td><button class="arrow-btn" aria-label="View ticket">›</button></td></tr>`).join('');
  $('ticketRows').querySelectorAll('tr[data-id]').forEach(row => {
    row.addEventListener('click', () => openTicket(Number(row.dataset.id)));
    row.addEventListener('keydown', (event) => { if (event.key === 'Enter') openTicket(Number(row.dataset.id)); });
  });
}
function openNewTicket() {
  $('formError').textContent = '';
  $('ticketForm').reset();
  $('ticketModal').classList.remove('hidden');
  $('ticketModal').querySelector('input[name="requester"]').focus();
}
function closeNewTicket() { $('ticketModal').classList.add('hidden'); }
function openTicket(id) {
  const t = tickets.find(item => item.id === id); if (!t) return;
  activeTicket = t;
  $('detailTicketId').textContent = `TICKET #INC-${String(t.id).padStart(4,'0')} · ${prettyDate(t.created_at)}`;
  $('detailTitle').textContent = t.subject;
  $('ticketDetail').innerHTML = `
    <div class="detail-meta"><span class="priority ${escapeHtml(t.priority)}">${escapeHtml(t.priority)} priority</span><span class="status ${statusClass(escapeHtml(t.status))}">${escapeHtml(t.status)}</span><span class="status">${escapeHtml(t.category)}</span></div>
    <div class="detail-section"><h3>Requester</h3><div class="detail-value">${escapeHtml(t.requester)}</div></div>
    <div class="detail-section"><h3>User's description</h3><p>${escapeHtml(t.description)}</p></div>
    <div class="detail-section"><h3>AI-assisted diagnosis · likely cause, not confirmed</h3><p>${escapeHtml(t.diagnosis)}</p></div>
    <div class="detail-section"><h3>Recommended next steps</h3><p>${escapeHtml(t.recommendation)}</p></div>
    <div class="reply-editor"><h3>Engineer response</h3><p class="reply-note">Review and edit this draft. Nothing is sent until you click <b>Send reply</b>.</p><label for="replyBody">Reply to ${escapeHtml(t.requester)}</label><textarea id="replyBody">${escapeHtml(t.draft_reply || 'Hello, thanks for contacting IT support. We are reviewing your issue and will follow up shortly.')}</textarea><div class="reply-actions"><button class="primary-btn" id="sendReply">Send reply via Gmail</button></div></div>
    <div class="detail-actions"><label for="detailStatus" class="detail-label">Update status</label><select id="detailStatus"><option ${t.status==='Open'?'selected':''}>Open</option><option ${t.status==='In Progress'?'selected':''}>In Progress</option><option ${t.status==='Waiting for User'?'selected':''}>Waiting for User</option><option ${t.status==='Resolved'?'selected':''}>Resolved</option><option ${t.status==='Escalated'?'selected':''}>Escalated</option></select><button class="primary-btn" id="saveStatus">Save status</button></div>`;
  $('detailModal').classList.remove('hidden');
  $('sendReply').addEventListener('click', async () => {
    const body = $('replyBody').value.trim();
    if (!body) { showToast('Please write a reply before sending.'); return; }
    if (!confirm(`Send this reply to ${t.requester} using Gmail?`)) return;
    const button = $('sendReply'); button.disabled = true; button.textContent = 'Sending…';
    try { await api(`/api/tickets/${t.id}/reply`, {method:'POST', body:JSON.stringify({body})}); $('detailModal').classList.add('hidden'); await loadTickets(); showToast('Engineer-approved reply sent.'); }
    catch (error) { showToast(error.message); }
    finally { button.disabled = false; button.textContent = 'Send reply via Gmail'; }
  });
  $('saveStatus').addEventListener('click', async () => {
    try {
      await api(`/api/tickets/${t.id}`, {method:'PATCH', body:JSON.stringify({status:$('detailStatus').value})});
      $('detailModal').classList.add('hidden'); await loadTickets(); showToast('Ticket status updated.');
    } catch (error) { showToast(error.message); }
  });
}
$('newTicketBtn').addEventListener('click', openNewTicket);
$('closeModal').addEventListener('click', closeNewTicket);
$('cancelModal').addEventListener('click', closeNewTicket);
$('closeDetail').addEventListener('click', () => $('detailModal').classList.add('hidden'));
$('refreshBtn').addEventListener('click', loadTickets);
$('syncGmailBtn').addEventListener('click', async () => {
  const button = $('syncGmailBtn'); button.disabled = true; button.textContent = 'Connecting / syncing…';
  try { const result = await api('/api/gmail/sync', {method:'POST'}); await loadTickets(); showToast(`Imported ${result.imported} email(s); no replies sent.`); }
  catch (error) { showToast(error.message); alert(`Gmail sync: ${error.message}\n\nFollow the Gmail setup steps in README.md.`); }
  finally { button.disabled = false; button.textContent = '↻ Sync Gmail'; }
});
$('statusFilter').addEventListener('change', renderTickets);
let searchTimer;
$('searchInput').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadTickets, 220); });
$('allTicketsNav').addEventListener('click', () => { $('statusFilter').value = 'All'; $('searchInput').value = ''; loadTickets(); });
$('ticketForm').addEventListener('submit', async (event) => {
  event.preventDefault(); $('formError').textContent = '';
  const button = $('submitTicket'); button.disabled = true; button.textContent = 'Analyzing…';
  const form = new FormData(event.currentTarget);
  const payload = Object.fromEntries(form.entries());
  try {
    const ticket = await api('/api/tickets', {method:'POST', body:JSON.stringify(payload)});
    closeNewTicket(); $('searchInput').value = ''; $('statusFilter').value = 'All'; await loadTickets(); showToast(`Ticket #INC-${String(ticket.id).padStart(4,'0')} created.`); openTicket(ticket.id);
  } catch (error) { $('formError').textContent = error.message; }
  finally { button.disabled = false; button.textContent = 'Analyze & create ticket'; }
});
for (const modalId of ['ticketModal','detailModal']) {
  $(modalId).addEventListener('click', event => { if (event.target === $(modalId)) $(modalId).classList.add('hidden'); });
}
document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeNewTicket(); $('detailModal').classList.add('hidden'); } });
loadTickets();
