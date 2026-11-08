// Task Manager – Supabase REST API (no backend, plain fetch)

let config = null;      // loaded from config.json
let editingId = null;   // null = create mode, number = edit mode

const form = document.getElementById('task-form');
const titleInput = document.getElementById('task-title');
const descInput = document.getElementById('task-description');
const submitBtn = document.getElementById('task-submit');
const cancelBtn = document.getElementById('cancel-edit');
const taskList = document.getElementById('task-list');
const statusMessage = document.getElementById('status-message');

// ---------- helpers ----------

function showStatus(text, isError = false) {
  statusMessage.textContent = text;
  statusMessage.className = isError ? 'error' : 'success';
}

function apiUrl(query = '') {
  return `${config.supabaseUrl}/rest/v1/${config.tableName}${query}`;
}

// Sends a request to Supabase and throws a readable error if it fails
async function api(query, options = {}) {
  const response = await fetch(apiUrl(query), {
    ...options,
    headers: {
      apikey: config.supabasePublishableKey,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    let details = response.statusText;
    try {
      const body = await response.json();
      details = body.message || details;
    } catch (_) { /* response had no JSON body */ }
    throw new Error(`${response.status}: ${details}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// ---------- CRUD ----------

async function loadTasks() {
  try {
    const tasks = await api('?select=*&order=id.asc');
    renderTasks(tasks);
  } catch (err) {
    showStatus(`Could not load tasks (${err.message})`, true);
  }
}

async function createTask(title, description) {
  await api('', {
    method: 'POST',
    body: JSON.stringify({ title, description, completed: false })
  });
}

async function updateTask(id, fields) {
  const result = await api(`?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify(fields)
  });
  // Empty result usually means the RLS UPDATE policy is missing
  if (!result || result.length === 0) {
    throw new Error('task was not updated (check RLS UPDATE policy)');
  }
}

async function deleteTask(id) {
  const result = await api(`?id=eq.${id}`, { method: 'DELETE' });
  if (!result || result.length === 0) {
    throw new Error('task was not deleted (check RLS DELETE policy)');
  }
}

// ---------- rendering ----------

function renderTasks(tasks) {
  taskList.innerHTML = '';

  if (tasks.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No tasks yet.';
    taskList.appendChild(empty);
    return;
  }

  for (const task of tasks) {
    const item = document.createElement('div');
    item.className = 'task-item' + (task.completed ? ' completed' : '');
    item.dataset.id = task.id;

    const title = document.createElement('h3');
    title.className = 'task-title';
    title.textContent = task.title;

    const description = document.createElement('p');
    description.className = 'task-description';
    description.textContent = task.description || '';

    const status = document.createElement('span');
    status.className = 'task-status';
    status.textContent = task.completed ? 'Completed' : 'Incomplete';

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-task';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => startEdit(task));

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'toggle-task';
    toggleBtn.textContent = task.completed ? 'Mark incomplete' : 'Mark complete';
    toggleBtn.addEventListener('click', () => handleToggle(task));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-task';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => handleDelete(task.id));

    const actions = document.createElement('div');
    actions.className = 'task-actions';
    actions.append(editBtn, toggleBtn, deleteBtn);

    item.append(title, description, status, actions);
    taskList.appendChild(item);
  }
}

// ---------- event handlers ----------

function startEdit(task) {
  editingId = task.id;
  titleInput.value = task.title;
  descInput.value = task.description || '';
  submitBtn.textContent = 'Save Changes';
  cancelBtn.hidden = false;
  titleInput.focus();
}

function resetForm() {
  editingId = null;
  form.reset();
  submitBtn.textContent = 'Add Task';
  cancelBtn.hidden = true;
}

async function handleSubmit(event) {
  event.preventDefault();
  const title = titleInput.value.trim();
  const description = descInput.value.trim();

  if (!title) {
    showStatus('Title is required.', true);
    return;
  }

  try {
    if (editingId === null) {
      await createTask(title, description);
      showStatus('Task added.');
    } else {
      await updateTask(editingId, { title, description });
      showStatus('Task updated.');
    }
    resetForm();
    await loadTasks();
  } catch (err) {
    showStatus(`Could not save task (${err.message})`, true);
  }
}

async function handleToggle(task) {
  try {
    await updateTask(task.id, { completed: !task.completed });
    showStatus('Task status changed.');
    await loadTasks();
  } catch (err) {
    showStatus(`Could not change status (${err.message})`, true);
  }
}

async function handleDelete(id) {
  try {
    await deleteTask(id);
    if (editingId === id) resetForm();
    showStatus('Task deleted.');
    await loadTasks();
  } catch (err) {
    showStatus(`Could not delete task (${err.message})`, true);
  }
}

// ---------- start ----------

async function init() {
  try {
    const response = await fetch('config.json');
    if (!response.ok) throw new Error(`config.json: ${response.status}`);
    config = await response.json();
  } catch (err) {
    showStatus(`Could not load configuration (${err.message})`, true);
    return;
  }

  form.addEventListener('submit', handleSubmit);
  cancelBtn.addEventListener('click', resetForm);
  await loadTasks();
}

init();
