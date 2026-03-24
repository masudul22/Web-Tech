// ── Part 2: Select DOM elements ───────────────────────────────────────────
const taskInput  = document.querySelector('#task-input');
const addBtn     = document.querySelector('#add-btn');
const taskList   = document.querySelector('#task-list');
const errorMsg   = document.querySelector('#error-msg');
const statsBar   = document.querySelector('#stats');
const countTotal = document.querySelector('#count-total');
const countDone  = document.querySelector('#count-done');
const countLeft  = document.querySelector('#count-left');
const emptyState = document.querySelector('#empty-state');

// ── Internal state ────────────────────────────────────────────────────────
let taskCount = 0; // used for unique IDs

// ── Helper: update stats bar ──────────────────────────────────────────────
const updateStats = () => {
  const all   = taskList.querySelectorAll('.task-item');
  const done  = taskList.querySelectorAll('.task-item.completed');
  const total = all.length;

  if (total === 0) {
    statsBar.style.display = 'none';
    if (!emptyState.isConnected) taskList.appendChild(emptyState);
  } else {
    statsBar.style.display = 'flex';
    if (emptyState.isConnected) emptyState.remove();
    countTotal.textContent = total;
    countDone.textContent  = done.length;
    countLeft.textContent  = total - done.length;
  }
};

// ── Helper: show/clear error ──────────────────────────────────────────────
const showError = (msg) => {
  errorMsg.textContent = msg;
  setTimeout(() => { errorMsg.textContent = ''; }, 2500);
};

// ── Part 4 + 5: Create and append a task element ──────────────────────────
const createTask = (text) => {
  taskCount++;

  // Part 4: Create elements
  const li        = document.createElement('li');
  const checkBox  = document.createElement('button');
  const taskText  = document.createElement('span');
  const deleteBtn = document.createElement('button');

  li.classList.add('task-item');
  li.dataset.id = taskCount;

  checkBox.classList.add('task-check');
  checkBox.title = 'Mark complete';
  checkBox.setAttribute('aria-label', 'Toggle complete');
  checkBox.textContent = '✓';

  // Part 4: Set text using textContent
  taskText.classList.add('task-text');
  taskText.textContent = text;

  deleteBtn.classList.add('delete-btn');
  deleteBtn.textContent = 'rm';
  deleteBtn.title = 'Delete task';
  deleteBtn.setAttribute('aria-label', `Delete task: ${text}`);

  // ── Part 8: Mark as completed (toggle CSS class) ──────────────────────
  const toggleComplete = () => {
    li.classList.toggle('completed');
    updateStats();
  };

  checkBox.addEventListener('click', toggleComplete);
  taskText.addEventListener('click', toggleComplete);

  // ── Part 6: Delete task ───────────────────────────────────────────────
  deleteBtn.addEventListener('click', () => {
    li.style.animation  = 'none';
    li.style.transition = 'opacity 0.2s, transform 0.2s';
    li.style.opacity    = '0';
    li.style.transform  = 'translateX(10px) scale(0.97)';
    setTimeout(() => {
      li.remove();
      updateStats();
    }, 200);
  });

  li.appendChild(checkBox);
  li.appendChild(taskText);
  li.appendChild(deleteBtn);

  // Part 5: Append to DOM
  taskList.appendChild(li);
  updateStats();
};

// ── Part 3: Add task handler ──────────────────────────────────────────────
const handleAddTask = () => {
  const raw  = taskInput.value;
  const text = raw.trim();

  // Part 3: Prevent empty tasks
  if (!text) {
    showError('⚠ task cannot be empty.');
    taskInput.focus();
    return;
  }

  // Part 7: Template literal for logging (also demonstrates ES6+)
  console.log(`[task-manager] Added task #${taskCount + 1}: "${text}"`);

  createTask(text);

  // Part 8: Clear the input after adding
  taskInput.value = '';
  taskInput.focus();
};

// Part 3: Button click listener
addBtn.addEventListener('click', handleAddTask);

// Part 8: Keyboard support — Enter key
taskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleAddTask();
});
