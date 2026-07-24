// Same-origin now that the frontend is served by Spring Boot from /static,
// so a relative path works and no CORS setup is required.
const API_BASE = '/api/employees';

let employees = [];
let editingId = null;
let sortKey = null;
let sortDir = 'asc';
let currentPage = 1;
const PAGE_SIZE = 8;

const themeToggle = document.getElementById('themeToggle');
const paginationBar = document.getElementById('pagination');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const pageInfo = document.getElementById('pageInfo');

const tableBody    = document.getElementById('tableBody');
const emptyState   = document.getElementById('emptyState');
const loadingState = document.getElementById('loadingState');
const empCount     = document.getElementById('empCount');
const statusDot    = document.getElementById('statusDot');
const statusText   = document.getElementById('statusText');
const form         = document.getElementById('empForm');
const formTitle    = document.getElementById('formTitle');
const submitBtn     = document.getElementById('submitBtn');
const submitBtnLabel = submitBtn.querySelector('.btn-label');
const cancelBtn     = document.getElementById('cancelEditBtn');
const searchInput   = document.getElementById('search');
const statusFilter  = document.getElementById('statusFilter');
const departmentFilter = document.getElementById('departmentFilter');
const toastStack    = document.getElementById('toastStack');
const confirmOverlay = document.getElementById('confirmOverlay');
const confirmMessage = document.getElementById('confirmMessage');
const confirmOkBtn   = document.getElementById('confirmOkBtn');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');

const nameInput     = document.getElementById('name');
const emailInput    = document.getElementById('email');
const deptInput     = document.getElementById('department');
const jobTitleInput = document.getElementById('jobTitle');
const hireDateInput = document.getElementById('hireDate');
const statusInput   = document.getElementById('status');
const salaryInput   = document.getElementById('salary');

const fields = {
  name:       { input: nameInput,     error: document.getElementById('nameError') },
  email:      { input: emailInput,    error: document.getElementById('emailError') },
  department: { input: deptInput,     error: document.getElementById('departmentError') },
  jobTitle:   { input: jobTitleInput, error: document.getElementById('jobTitleError') },
  hireDate:   { input: hireDateInput, error: document.getElementById('hireDateError') },
  salary:     { input: salaryInput,   error: document.getElementById('salaryError') }
};

const currency = new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 });
const dateFmt = new Intl.DateTimeFormat('en-US', { year:'numeric', month:'short', day:'numeric' });

const ICONS = {
  edit: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M13.5 3.5l3 3L7 16H4v-3L13.5 3.5z"/></svg>',
  del:  '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6h12M8 6V4.5h4V6M6 6l.6 10a1 1 0 001 1h4.8a1 1 0 001-1L14 6"/></svg>'
};

// ---------- Toasts ----------
function showToast(message, type = 'info'){
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  toastStack.appendChild(el);
  setTimeout(() => {
    el.classList.add('fade-out');
    setTimeout(() => el.remove(), 200);
  }, 3200);
}

// ---------- Confirm modal ----------
function askConfirm(message){
  return new Promise((resolve) => {
    confirmMessage.textContent = message;
    confirmOverlay.style.display = 'flex';

    const cleanup = (result) => {
      confirmOverlay.style.display = 'none';
      confirmOkBtn.removeEventListener('click', onOk);
      confirmCancelBtn.removeEventListener('click', onCancel);
      resolve(result);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);

    confirmOkBtn.addEventListener('click', onOk);
    confirmCancelBtn.addEventListener('click', onCancel);
  });
}

// ---------- Data loading ----------
async function loadEmployees(){
  loadingState.style.display = 'flex';
  emptyState.style.display = 'none';
  tableBody.innerHTML = '';
  try{
    const res = await fetch(API_BASE);
    if(!res.ok) throw new Error('Bad response');
    employees = await res.json();
    setStatus(true);
    populateDepartmentFilter();
    render();
  }catch(err){
    setStatus(false);
    showToast('Could not load employees from the API.', 'error');
    console.error(err);
  }finally{
    loadingState.style.display = 'none';
  }
}

function setStatus(ok){
  if(ok){
    statusDot.classList.remove('off');
    statusText.textContent = 'Connected — ' + API_BASE;
  }else{
    statusDot.classList.add('off');
    statusText.textContent = 'Could not reach API at ' + API_BASE + '. Is the backend running?';
  }
}

function populateDepartmentFilter(){
  const current = departmentFilter.value;
  const depts = [...new Set(employees.map(e => e.department).filter(Boolean))].sort();
  departmentFilter.innerHTML = '<option value="">All departments</option>' +
    depts.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
  if(depts.includes(current)) departmentFilter.value = current;
}

// ---------- Theme ----------
function applyTheme(theme){
  document.body.classList.toggle('dark', theme === 'dark');
}
const savedTheme = localStorage.getItem('staff-ledger-theme')
  || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
applyTheme(savedTheme);

themeToggle.addEventListener('click', () => {
  const next = document.body.classList.contains('dark') ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem('staff-ledger-theme', next);
});

// ---------- Sorting ----------
function applySort(list){
  if(!sortKey) return list;
  const sorted = [...list].sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if(av == null) av = '';
    if(bv == null) bv = '';
    if(sortKey === "salary"){
      return sortDir == "asc"
      ? a.salary - b.salary
      : b.salary - a.salary
    }
    if(typeof av === 'string'){ av = av.toLowerCase(); bv = bv.toLowerCase(); }
    if(av < bv) return sortDir === 'asc' ? -1 : 1;
    if(av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });
  return sorted;
}

document.querySelectorAll('th.sortable').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.dataset.sort;
    if(sortKey === key){
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    }else{
      sortKey = key;
      sortDir = 'asc';
    }
    document.querySelectorAll('th.sortable .sort-arrow').forEach(a => a.textContent = '');
    th.querySelector('.sort-arrow').textContent = sortDir === 'asc' ? '\u2191' : '\u2193';
    currentPage = 1;
    render();
  });
});

// ---------- Filtering + Render ----------
function getFiltered(){
  const term = searchInput.value.trim().toLowerCase();
  const statusVal = statusFilter.value;
  const deptVal = departmentFilter.value;

  let filtered = employees.filter(e => {
    const matchesTerm = !term ||
      e.name.toLowerCase().includes(term) ||
      e.email.toLowerCase().includes(term) ||
      e.department.toLowerCase().includes(term) ||
      (e.jobTitle || '').toLowerCase().includes(term);
    const matchesStatus = !statusVal || e.status === statusVal;
    const matchesDept = !deptVal || e.department === deptVal;
    return matchesTerm && matchesStatus && matchesDept;
  });

  return applySort(filtered);
}

function render(){
  const filtered = getFiltered();

  empCount.textContent = employees.length;
  tableBody.innerHTML = '';

  if(filtered.length === 0){
    emptyState.style.display = 'block';
    emptyState.textContent = employees.length === 0
      ? 'No employees on record yet.'
      : 'No matches for the current search or filters.';
    paginationBar.style.display = 'none';
    return;
  }
  emptyState.style.display = 'none';

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if(currentPage > totalPages) currentPage = totalPages;
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  pageItems.forEach((emp, i) => {
    const tr = document.createElement('tr');
    const isActive = emp.status !== 'INACTIVE';
    const hireDateDisplay = emp.hireDate ? dateFmt.format(new Date(emp.hireDate + 'T00:00:00')) : '—';
    tr.innerHTML = `
      <td class="idx">${String(startIdx + i + 1).padStart(2,'0')}</td>
      <td class="name">${escapeHtml(emp.name)}</td>
      <td class="email">${escapeHtml(emp.email)}</td>
      <td class="dept"><span class="tag">${escapeHtml(emp.department)}</span></td>
      <td>${escapeHtml(emp.jobTitle || '—')}</td>
      <td class="hire-date">${hireDateDisplay}</td>
      <td class="status"><span class="status-badge ${isActive ? 'active' : 'inactive'}">${isActive ? 'Active' : 'Inactive'}</span></td>
      <td class="salary">${currency.format(emp.salary)}</td>
      <td class="actions">
        <button class="icon-btn edit" data-id="${emp.id}" title="Edit" aria-label="Edit">${ICONS.edit}</button>
        <button class="icon-btn del" data-id="${emp.id}" title="Delete" aria-label="Delete">${ICONS.del}</button>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  if(totalPages > 1){
    paginationBar.style.display = 'flex';
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
  }else{
    paginationBar.style.display = 'none';
  }
}

prevPageBtn.addEventListener('click', () => {
  if(currentPage > 1){ currentPage--; render(); }
});
nextPageBtn.addEventListener('click', () => {
  currentPage++;
  render();
});

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// ---------- Validation ----------
function clearFieldErrors(){
  Object.values(fields).forEach(({ input, error }) => {
    input.closest('.field').classList.remove('has-error');
    error.textContent = '';
  });
}

function setFieldError(key, message){
  fields[key].input.closest('.field').classList.add('has-error');
  fields[key].error.textContent = message;
}

function validateForm(){
  clearFieldErrors();
  let valid = true;

  if(!nameInput.value.trim()){
    setFieldError('name', 'Name is required.');
    valid = false;
  }

  const email = emailInput.value.trim();
  if(!email){
    setFieldError('email', 'Email is required.');
    valid = false;
  }else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    setFieldError('email', 'Enter a valid email address.');
    valid = false;
  }

  if(!deptInput.value.trim()){
    setFieldError('department', 'Department is required.');
    valid = false;
  }

  if(!jobTitleInput.value.trim()){
    setFieldError('jobTitle', 'Job title is required.');
    valid = false;
  }

  if(!hireDateInput.value){
    setFieldError('hireDate', 'Hire date is required.');
    valid = false;
  }

  const salaryVal = salaryInput.value;
  if(salaryVal === ''){
    setFieldError('salary', 'Salary is required.');
    valid = false;
  }else if(isNaN(salaryVal) || parseFloat(salaryVal) <= 0){
    setFieldError('salary', 'Salary must be a positive number.');
    valid = false;
  }

  return valid;
}

function setSubmitting(isSubmitting){
  submitBtn.disabled = isSubmitting;
  if(isSubmitting){
    submitBtnLabel.innerHTML = '<span class="btn-spinner"></span>Saving\u2026';
  }else{
    submitBtnLabel.textContent = editingId ? 'Save changes' : 'Add employee';
  }
}

// ---------- Form submit ----------
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if(!validateForm()) return;
   //Email Validationn
   // Prevent duplicate email when adding a new employee
const emailExists = employees.some(emp =>
  emp.email.toLowerCase() === emailInput.value.trim().toLowerCase() &&
  emp.id !== editingId
);

if (emailExists) {
  setFieldError('email', 'Email already exists.');
  emailInput.focus();
  return;
}

  const payload = {
    name: nameInput.value.trim(),
    email: emailInput.value.trim(),
    department: deptInput.value.trim(),
    jobTitle: jobTitleInput.value.trim(),
    hireDate: hireDateInput.value,
    status: statusInput.value,
    salary: parseFloat(salaryInput.value)
  };

  setSubmitting(true);
  try{
    let res;
    if(editingId){
      res = await fetch(`${API_BASE}/${editingId}`, {
        method:'PUT',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(payload)
      });
    }else{
      res = await fetch(API_BASE, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(payload)
      });
    }
    if(!res.ok) throw new Error('Request failed');
    const wasEditing = !!editingId;
    exitEditMode();
    form.reset();
    clearFieldErrors();
    await loadEmployees();
    showToast(wasEditing ? 'Employee updated.' : 'Employee added.', 'success');
  }catch(err){
    showToast('Could not save. Check the API connection.', 'error');
    console.error(err);
  }finally{
    setSubmitting(false);
  }
});

// ---------- Row actions ----------
tableBody.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-id]');
  if(!btn) return;
  const id = btn.dataset.id;

  if(btn.classList.contains('edit')){
    const emp = employees.find(x => String(x.id) === id);
    if(!emp) return;
    enterEditMode(emp);
  }

  if(btn.classList.contains('del')){
    const emp = employees.find(x => String(x.id) === id);
    if(!emp) return;
    const confirmed = await askConfirm(`Remove ${emp.name} from the ledger? This can't be undone.`);
    if(!confirmed) return;
    try{
      const res = await fetch(`${API_BASE}/${id}`, { method:'DELETE' });
      if(!res.ok) throw new Error('Delete failed');
      await loadEmployees();
      showToast(`${emp.name} removed.`, 'success');
    }catch(err){
      showToast('Could not delete this record.', 'error');
      console.error(err);
    }
  }
});

function enterEditMode(emp){
  editingId = emp.id;
  nameInput.value = emp.name;
  emailInput.value = emp.email;
  deptInput.value = emp.department;
  jobTitleInput.value = emp.jobTitle || '';
  hireDateInput.value = emp.hireDate || '';
  statusInput.value = emp.status || 'ACTIVE';
  salaryInput.value = emp.salary;
  clearFieldErrors();
  formTitle.textContent = `Editing ${emp.name}`;
  submitBtnLabel.textContent = 'Save changes';
  cancelBtn.style.display = 'inline-block';
  window.scrollTo({ top:0, behavior:'smooth' });
}

function exitEditMode(){
  editingId = null;
  formTitle.textContent = 'Add an employee';
  submitBtnLabel.textContent = 'Add employee';
  cancelBtn.style.display = 'none';
  statusInput.value = 'ACTIVE';
}

cancelBtn.addEventListener('click', () => {
  exitEditMode();
  form.reset();
  clearFieldErrors();
});

searchInput.addEventListener('input', () => { currentPage = 1; render(); });
statusFilter.addEventListener('change', () => { currentPage = 1; render(); });
departmentFilter.addEventListener('change', () => { currentPage = 1; render(); });

loadEmployees();
