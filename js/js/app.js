import { supabase } from './db.js';
import * as db from './db.js';
import { el, toast, openModal, confirmDialog } from './ui.js';
import './export.js';

// ============================================
// НАВИГАЦИЯ ПО ВКЛАДКАМ (вкладки + меню)
// ============================================
function switchTab(tabName) {
  document.querySelectorAll('.tabs button, .side-menu-item').forEach(b => {
    if (b.dataset.tab === tabName) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });

  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const activeTab = document.getElementById('tab-' + tabName);
  if (activeTab) activeTab.classList.add('active');

  if (tabName === 'students') renderStudents();
  if (tabName === 'lessons') renderLessons();
  if (tabName === 'settings') renderGroups();
  if (tabName === 'journal') renderJournal();
  if (tabName === 'reports') renderReports();
  if (tabName === 'qrcodes') renderQRCodes();
  if (tabName === 'passes') renderPasses();
  if (tabName === 'requests') renderRequests();
  if (tabName === 'announcements') renderAnnouncements();
  if (tabName === 'chats') renderChats();
  if (tabName === 'homework') renderHomework();
  if (tabName === 'schedule') renderSchedule();

  closeMenu();
}

document.querySelectorAll('.tabs button').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

document.querySelectorAll('.side-menu-item').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ============================================
// БУРГЕР-МЕНЮ
// ============================================
const burgerBtn = document.getElementById('burger-btn');
const sideMenu = document.getElementById('side-menu');
const menuOverlay = document.getElementById('menu-overlay');

function openMenu() {
  sideMenu.classList.add('open');
  menuOverlay.classList.add('show');
  burgerBtn.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeMenu() {
  sideMenu.classList.remove('open');
  menuOverlay.classList.remove('show');
  burgerBtn.classList.remove('open');
  document.body.style.overflow = '';
}

burgerBtn.addEventListener('click', () => {
  if (sideMenu.classList.contains('open')) {
    closeMenu();
  } else {
    openMenu();
  }
});

menuOverlay.addEventListener('click', closeMenu);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeMenu();
});

// ============================================
// SERVICE WORKER
// ============================================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw2.js').catch(console.error);
}

// ============================================
// АУТЕНТИФИКАЦИЯ
// ============================================
const authScreen = document.getElementById('auth-screen');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authError = document.getElementById('auth-error');
const userInfo = document.getElementById('user-info');
let currentUser = null;

document.getElementById('auth-login').addEventListener('click', async () => {
  authError.textContent = '';
  const { data, error } = await supabase.auth.signInWithPassword({
    email: authEmail.value,
    password: authPassword.value,
  });
  if (error) {
    authError.textContent = 'Ошибка: ' + error.message;
    return;
  }
  showUser(data.user);
  authScreen.classList.remove('show');
  loadAll();
});

userInfo.addEventListener('click', async () => {
  if (confirm('Выйти из системы?')) {
    await supabase.auth.signOut();
    location.reload();
  }
});

function showUser(user) {
  currentUser = user;
  const name = user.user_metadata?.full_name
    || user.email.split('@')[0];

  userInfo.innerHTML = `<span style="cursor:pointer">👤 ${name} · выйти</span>`;

  const menuUserInfo = document.getElementById('menu-user-info');
  if (menuUserInfo) {
    menuUserInfo.innerHTML = `<span style="cursor:pointer">👤 ${name} · выйти</span>`;
    menuUserInfo.onclick = async () => {
      if (confirm('Выйти из системы?')) {
        await supabase.auth.signOut();
        location.reload();
      }
    };
  }
}

supabase.auth.getSession().then(({ data }) => {
  if (data.session) {
    showUser(data.session.user);
    loadAll();
  } else {
    authScreen.classList.add('show');
  }
});

supabase.auth.onAuthStateChange((_e, session) => {
  if (!session) {
    authScreen.classList.add('show');
    currentUser = null;
  } else {
    showUser(session.user);
    authScreen.classList.remove('show');
  }
});

// ============================================
// ЗАГРУЗКА ДАННЫХ
// ============================================
let groupsCache = [];
let studentsCache = [];
let lessonsCache = [];

async function loadAll() {
  try {
    groupsCache = await db.fetchGroups();
    studentsCache = await db.fetchStudents();
    lessonsCache = await db.fetchLessons();
  } catch (e) {
    toast('Ошибка загрузки: ' + e.message, 'err');
  }
}

// ============================================
// УЧЕНИКИ
// ============================================
async function renderStudents() {
  const root = document.getElementById('tab-students');
  root.innerHTML = '';

  const addBtn = el('button', {
    style: 'background:#22c55e;color:#fff;padding:12px 20px;border:none;border-radius:12px;font-size:1rem;cursor:pointer;margin-bottom:16px;',
    onclick: () => openStudentForm(),
  }, '➕ Добавить ученика');
  root.appendChild(addBtn);

  if (!studentsCache.length) {
    root.appendChild(el('p', {}, 'Пока нет учеников. Добавь первого! 👆'));
    return;
  }

  const list = el('div', { style: 'display:flex;flex-direction:column;gap:10px;' });

  studentsCache.forEach(s => {
    const group = groupsCache.find(g => g.id === s.group_id);
    const card = el('div', {
      style: `background:#fff;padding:14px;border-radius:12px;
              box-shadow:0 2px 8px rgba(0,0,0,.08);display:flex;
              justify-content:space-between;align-items:center;gap:10px;
              opacity:${s.is_active ? 1 : 0.5};`,
    });

    const info = el('div', { style: 'flex:1;' });
    info.appendChild(el('div', { style: 'font-weight:bold;font-size:1.05rem;' }, s.full_name));
    info.appendChild(el('div', { style: 'font-size:0.9rem;color:#666;' },
      `${group ? '🏫 ' + group.name : '🏫 без группы'} ${s.parent_phone ? '· 📞 ' + s.parent_phone : ''}`
    ));
    if (s.notes) info.appendChild(el('div', { style: 'font-size:0.85rem;color:#888;margin-top:4px;' }, '📝 ' + s.notes));
    card.appendChild(info);

    const actions = el('div', { style: 'display:flex;gap:6px;' });
    actions.appendChild(el('button', {
      style: 'background:#f59e0b;color:#fff;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;',
      onclick: () => openStudentForm(s),
    }, '✏️'));
    actions.appendChild(el('button', {
      style: 'background:#ef4444;color:#fff;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;',
      onclick: async () => {
        if (!confirmDialog(`Удалить "${s.full_name}"?`)) return;
        await db.deleteStudent(s.id);
        studentsCache = studentsCache.filter(x => x.id !== s.id);
        renderStudents();
        toast('Удалено', 'ok');
      },
    }, '🗑️'));
    card.appendChild(actions);

    list.appendChild(card);
  });

  root.appendChild(list);
}

function openStudentForm(student = null) {
  const isEdit = !!student;
  const form = el('div', { style: 'display:flex;flex-direction:column;gap:10px;' });

  const nameInput = el('input', {
    placeholder: 'ФИО ученика *',
    value: student?.full_name || '',
    style: 'padding:10px;border-radius:8px;border:2px solid #e5e7eb;font-size:1rem;',
  });
  const phoneInput = el('input', {
    placeholder: 'Телефон родителя',
    value: student?.parent_phone || '',
    style: 'padding:10px;border-radius:8px;border:2px solid #e5e7eb;font-size:1rem;',
  });
  const notesInput = el('textarea', {
    placeholder: 'Заметки',
    style: 'padding:10px;border-radius:8px;border:2px solid #e5e7eb;font-size:1rem;min-height:60px;',
  });
  notesInput.value = student?.notes || '';

  const groupSelect = el('select', {
    style: 'padding:10px;border-radius:8px;border:2px solid #e5e7eb;font-size:1rem;',
  });
  groupSelect.appendChild(el('option', { value: '' }, '— Без группы —'));
  groupsCache.forEach(g => {
    const opt = el('option', { value: g.id }, g.name);
    if (student?.group_id === g.id) opt.selected = true;
    groupSelect.appendChild(opt);
  });

  const activeCheck = el('input', { type: 'checkbox' });
  activeCheck.checked = student ? student.is_active : true;
  const activeLabel = el('label', { style: 'display:flex;align-items:center;gap:8px;' });
  activeLabel.appendChild(activeCheck);
  activeLabel.appendChild(el('span', {}, 'Активен'));

  form.appendChild(el('label', {}, 'ФИО*'));
  form.appendChild(nameInput);
  form.appendChild(el('label', {}, 'Группа'));
  form.appendChild(groupSelect);
  form.appendChild(el('label', {}, 'Телефон родителя'));
  form.appendChild(phoneInput);
  form.appendChild(el('label', {}, 'Заметки'));
  form.appendChild(notesInput);
  form.appendChild(activeLabel);

  openModal(isEdit ? 'Редактировать ученика' : 'Новый ученик', form, async () => {
    if (!nameInput.value.trim()) throw new Error('Введи ФИО');

    const payload = {
      full_name: nameInput.value.trim(),
      group_id: groupSelect.value || null,
      parent_phone: phoneInput.value.trim() || null,
      notes: notesInput.value.trim() || null,
      is_active: activeCheck.checked,
    };

    if (isEdit) {
      const updated = await db.updateStudent(student.id, payload);
      const idx = studentsCache.findIndex(x => x.id === student.id);
      studentsCache[idx] = updated;
    } else {
      const created = await db.createStudent(payload);
      studentsCache.push(created);
    }
    renderStudents();
    toast('Сохранено ✅', 'ok');
  });
}

// ============================================
// ЗАНЯТИЯ
// ============================================
async function renderLessons() {
  const root = document.getElementById('tab-lessons');
  root.innerHTML = '';

  const addBtn = el('button', {
    style: 'background:#22c55e;color:#fff;padding:12px 20px;border:none;border-radius:12px;font-size:1rem;cursor:pointer;margin-bottom:16px;',
    onclick: () => openLessonForm(),
  }, '➕ Добавить занятие');
  root.appendChild(addBtn);

  if (!lessonsCache.length) {
    root.appendChild(el('p', {}, 'Пока нет занятий.'));
    return;
  }

  const list = el('div', { style: 'display:flex;flex-direction:column;gap:10px;' });

  lessonsCache.forEach(l => {
    const group = groupsCache.find(g => g.id === l.group_id);
    const card = el('div', {
      style: 'background:#fff;padding:14px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08);display:flex;justify-content:space-between;align-items:center;gap:10px;',
    });

    const info = el('div', { style: 'flex:1;' });
    info.appendChild(el('div', { style: 'font-weight:bold;font-size:1.05rem;' },
      `📅 ${l.date} · ${group ? group.name : 'без группы'}`
    ));
    info.appendChild(el('div', { style: 'font-size:0.9rem;color:#666;' },
      l.topic ? '📖 ' + l.topic : '— без темы —'
    ));
    card.appendChild(info);

    const actions = el('div', { style: 'display:flex;gap:6px;' });
    actions.appendChild(el('button', {
      style: 'background:#f59e0b;color:#fff;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;',
      onclick: () => openLessonForm(l),
    }, '✏️'));
    actions.appendChild(el('button', {
      style: 'background:#ef4444;color:#fff;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;',
      onclick: async () => {
        if (!confirmDialog('Удалить занятие?')) return;
        await db.deleteLesson(l.id);
        lessonsCache = lessonsCache.filter(x => x.id !== l.id);
        renderLessons();
        toast('Удалено', 'ok');
      },
    }, '🗑️'));
    card.appendChild(actions);

    list.appendChild(card);
  });

  root.appendChild(list);
}

function openLessonForm(lesson = null) {
  const isEdit = !!lesson;
  const form = el('div', { style: 'display:flex;flex-direction:column;gap:10px;' });

  const groupSelect = el('select', {
    style: 'padding:10px;border-radius:8px;border:2px solid #e5e7eb;font-size:1rem;',
  });
  groupSelect.appendChild(el('option', { value: '' }, '— Выбери группу —'));
  groupsCache.forEach(g => {
    const opt = el('option', { value: g.id }, g.name);
    if (lesson?.group_id === g.id) opt.selected = true;
    groupSelect.appendChild(opt);
  });

  const dateInput = el('input', {
    type: 'date',
    value: lesson?.date || new Date().toISOString().slice(0, 10),
    style: 'padding:10px;border-radius:8px;border:2px solid #e5e7eb;font-size:1rem;',
  });
  const topicInput = el('input', {
    placeholder: 'Тема занятия',
    value: lesson?.topic || '',
    style: 'padding:10px;border-radius:8px;border:2px solid #e5e7eb;font-size:1rem;',
  });
  const teacherInput = el('input', {
    placeholder: 'Кто вёл (имя преподавателя)',
    value: lesson?.teacher_name
      || currentUser?.user_metadata?.full_name
      || (currentUser?.email?.split('@')[0] || ''),
    style: 'padding:10px;border-radius:8px;border:2px solid #e5e7eb;font-size:1rem;',
  });

  form.appendChild(el('label', {}, 'Группа *'));
  form.appendChild(groupSelect);
  form.appendChild(el('label', {}, 'Дата *'));
  form.appendChild(dateInput);
  form.appendChild(el('label', {}, 'Тема'));
  form.appendChild(topicInput);
  form.appendChild(el('label', {}, 'Преподаватель'));
  form.appendChild(teacherInput);

  openModal(isEdit ? 'Редактировать занятие' : 'Новое занятие', form, async () => {
    if (!groupSelect.value) throw new Error('Выбери группу');
    if (!dateInput.value) throw new Error('Укажи дату');

    const payload = {
      group_id: groupSelect.value,
      date: dateInput.value,
      topic: topicInput.value.trim() || null,
      teacher_name: teacherInput.value.trim() || null,
    };

    if (isEdit) {
      const updated = await db.updateLesson(lesson.id, payload);
      const idx = lessonsCache.findIndex(x => x.id === lesson.id);
      lessonsCache[idx] = updated;
    } else {
      const created = await db.createLesson(payload);
      lessonsCache.unshift(created);
    }
    renderLessons();
    toast('Сохранено ✅', 'ok');
  });
}

// ============================================
// СТАТИСТИКА ФАЙЛОВ (для очистки)
// ============================================
async function loadFilesStats() {
  const statsBox = document.getElementById('files-stats-box');
  if (!statsBox) return;

  try {
    const stats = await db.fetchFilesStats();

    const totalMB = (stats.totalSize / 1024 / 1024).toFixed(2);
    const oldMB = (stats.oldSize / 1024 / 1024).toFixed(2);

    statsBox.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:0.9rem;">
        <div>
          <div style="color:#9ca3af;font-size:0.8rem;">Всего файлов</div>
          <div style="font-weight:bold;color:#1f2937;font-size:1.1rem;">${stats.total}</div>
        </div>
        <div>
          <div style="color:#9ca3af;font-size:0.8rem;">Занято</div>
          <div style="font-weight:bold;color:#1f2937;font-size:1.1rem;">${totalMB} МБ</div>
        </div>
        <div style="grid-column:1/-1;border-top:1px dashed #e5e7eb;padding-top:10px;margin-top:6px;">
          <div style="color:#f59e0b;font-size:0.85rem;">
            🗑️ Старше 30 дней: <b>${stats.oldCount}</b> файл(ов) · <b>${oldMB} МБ</b>
          </div>
        </div>
      </div>
    `;
  } catch (e) {
    statsBox.innerHTML = `<div style="color:#ef4444;font-size:0.9rem;">Ошибка: ${e.message}</div>`;
  }
}

// ============================================
// ГРУППЫ (в настройках)
// ============================================
async function renderGroups() {
  const root = document.getElementById('tab-settings');
  root.innerHTML = '';

  root.appendChild(el('h2', {}, '🏫 Группы'));

  const addBtn = el('button', {
    style: 'background:#22c55e;color:#fff;padding:12px 20px;border:none;border-radius:12px;font-size:1rem;cursor:pointer;margin:10px 0 16px;',
    onclick: () => openGroupForm(),
  }, '➕ Добавить группу');
  root.appendChild(addBtn);

  if (!groupsCache.length) {
    root.appendChild(el('p', {}, 'Пока нет групп.'));
    return;
  }

  const list = el('div', { style: 'display:flex;flex-direction:column;gap:10px;' });
  groupsCache.forEach(g => {
    const card = el('div', {
      style: 'background:#fff;padding:14px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08);display:flex;justify-content:space-between;align-items:center;gap:10px;',
    });
    const info = el('div', { style: 'flex:1;' });
    info.appendChild(el('div', { style: 'font-weight:bold;font-size:1.05rem;' }, g.name));
    if (g.description) info.appendChild(el('div', { style: 'font-size:0.9rem;color:#666;' }, g.description));
    card.appendChild(info);

    const actions = el('div', { style: 'display:flex;gap:6px;' });
    actions.appendChild(el('button', {
      style: 'background:#f59e0b;color:#fff;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;',
      onclick: () => openGroupForm(g),
    }, '✏️'));
    actions.appendChild(el('button', {
      style: 'background:#ef4444;color:#fff;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;',
      onclick: async () => {
        if (!confirmDialog(`Удалить группу "${g.name}"?`)) return;
        await db.deleteGroup(g.id);
        groupsCache = groupsCache.filter(x => x.id !== g.id);
        renderGroups();
        toast('Удалено', 'ok');
      },
    }, '🗑️'));
    card.appendChild(actions);
    list.appendChild(card);
  });
  root.appendChild(list);

  // ============================================
  // БЛОК: ОЧИСТКА СТАРЫХ ФАЙЛОВ
  // ============================================
  const cleanupBox = el('div', {
    style: `background:#fff;padding:20px;border-radius:16px;
            box-shadow:0 2px 8px rgba(0,0,0,.08);margin-top:24px;
            border-left:5px solid #f59e0b;`,
  });

  cleanupBox.appendChild(el('h3', {
    style: 'color:#f59e0b;margin-bottom:12px;font-size:1.1rem;',
  }, '🧹 Очистка старых файлов'));

  cleanupBox.appendChild(el('p', {
    style: 'color:#6b7280;font-size:0.9rem;margin-bottom:16px;line-height:1.5;',
  }, 'Удаляет подгруженные файлы домашних заданий старше 30 дней. Сами домашки и оценки сохраняются.'));

  const statsBox = el('div', {
    id: 'files-stats-box',
    style: 'background:#f9fafb;border-radius:12px;padding:14px;margin-bottom:16px;',
  });
  statsBox.innerHTML = '<div style="color:#9ca3af;font-size:0.9rem;">⏳ Загружаю статистику...</div>';
  cleanupBox.appendChild(statsBox);

  const cleanupBtn = el('button', {
    style: `background:#f59e0b;color:#fff;padding:14px 24px;
            border:none;border-radius:12px;cursor:pointer;
            font-size:1rem;font-weight:bold;width:100%;`,
    onclick: async () => {
      const stats = await db.fetchFilesStats();
      if (stats.oldCount === 0) {
        toast('Нет файлов старше 30 дней ✅', 'ok');
        return;
      }

      const confirmed = confirm(
        `Удалить ${stats.oldCount} старый файл(ов)?\n\n` +
        `Это освободит ${(stats.oldSize / 1024 / 1024).toFixed(2)} МБ.\n\n` +
        `Домашки и оценки НЕ удаляются.`
      );
      if (!confirmed) return;

      cleanupBtn.disabled = true;
      cleanupBtn.textContent = '⏳ Удаляю...';
      cleanupBtn.style.opacity = '0.6';

      try {
        const deletedCount = await db.cleanupOldFiles();
        toast(`🧹 Удалено файлов: ${deletedCount}`, 'ok');
        await loadFilesStats();
      } catch (e) {
        toast('Ошибка: ' + e.message, 'err');
      } finally {
        cleanupBtn.disabled = false;
        cleanupBtn.textContent = '🧹 Запустить очистку';
        cleanupBtn.style.opacity = '1';
      }
    },
  }, '🧹 Запустить очистку');
  cleanupBox.appendChild(cleanupBtn);

  root.appendChild(cleanupBox);

  loadFilesStats();
}

function openGroupForm(group = null) {
  const isEdit = !!group;
  const form = el('div', { style: 'display:flex;flex-direction:column;gap:10px;' });

  const nameInput = el('input', {
    placeholder: 'Название группы *',
    value: group?.name || '',
    style: 'padding:10px;border-radius:8px;border:2px solid #e5e7eb;font-size:1rem;',
  });
  const descInput = el('input', {
    placeholder: 'Описание',
    value: group?.description || '',
    style: 'padding:10px;border-radius:8px;border:2px solid #e5e7eb;font-size:1rem;',
  });

  form.appendChild(el('label', {}, 'Название *'));
  form.appendChild(nameInput);
  form.appendChild(el('label', {}, 'Описание'));
  form.appendChild(descInput);

  openModal(isEdit ? 'Редактировать группу' : 'Новая группа', form, async () => {
    if (!nameInput.value.trim()) throw new Error('Введи название');
    const payload = {
      name: nameInput.value.trim(),
      description: descInput.value.trim() || null,
    };
    if (isEdit) {
      const updated = await db.updateGroup(group.id, payload);
      const idx = groupsCache.findIndex(x => x.id === group.id);
      groupsCache[idx] = updated;
    } else {
      const created = await db.createGroup(payload);
      groupsCache.push(created);
    }
    renderGroups();
    toast('Сохранено ✅', 'ok');
  });
}

// ============================================
// ЖУРНАЛ ПОСЕЩАЕМОСТИ
// ============================================
let currentAttendance = {};

async function renderJournal() {
  const root = document.getElementById('tab-journal');
  root.innerHTML = '';

  if (!groupsCache.length) {
    root.appendChild(el('p', {}, '⚠️ Сначала создай хотя бы одну группу в Настройках.'));
    return;
  }

  const groupSelect = el('select', {
    style: 'padding:10px;border-radius:8px;border:2px solid #e5e7eb;font-size:1rem;margin-bottom:10px;width:100%;',
    onchange: () => loadLessonsForGroup(groupSelect.value),
  });
  groupSelect.appendChild(el('option', { value: '' }, '— Выбери группу —'));
  groupsCache.forEach(g => {
    const opt = el('option', { value: g.id }, g.name);
    groupSelect.appendChild(opt);
  });

  const lessonSelect = el('select', {
    style: 'padding:10px;border-radius:8px;border:2px solid #e5e7eb;font-size:1rem;margin-bottom:10px;width:100%;',
    onchange: () => loadAttendance(lessonSelect.value),
  });
  lessonSelect.appendChild(el('option', { value: '' }, '— Сначала выбери группу —'));
  lessonSelect.id = 'journal-lesson-select';

  const quickAddBtn = el('button', {
    style: 'background:#22c55e;color:#fff;padding:10px 16px;border:none;border-radius:10px;cursor:pointer;font-size:0.95rem;margin-bottom:16px;',
    onclick: () => openLessonForm(),
  }, '➕ Создать занятие для этой группы');

  const listBox = el('div', { id: 'journal-list' });
  listBox.appendChild(el('p', {}, 'Выбери группу и занятие.'));

  root.appendChild(el('label', { style: 'font-weight:bold;display:block;margin-bottom:4px;' }, '🏫 Группа'));
  root.appendChild(groupSelect);
  root.appendChild(el('label', { style: 'font-weight:bold;display:block;margin-bottom:4px;' }, '📅 Занятие'));
  root.appendChild(lessonSelect);
  root.appendChild(quickAddBtn);
  root.appendChild(listBox);
}

async function loadLessonsForGroup(groupId) {
  const lessonSelect = document.getElementById('journal-lesson-select');
  lessonSelect.innerHTML = '';
  lessonSelect.appendChild(el('option', { value: '' }, '— Выбери занятие —'));
  document.getElementById('journal-list').innerHTML = '<p>Выбери занятие.</p>';

  if (!groupId) return;

  const lessons = lessonsCache
    .filter(l => l.group_id === groupId)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (!lessons.length) {
    lessonSelect.appendChild(el('option', { value: '' }, '— Нет занятий, создай новое →'));
    return;
  }

  lessons.forEach(l => {
    lessonSelect.appendChild(el('option', { value: l.id },
      `${l.date}${l.topic ? ' · ' + l.topic : ''}`));
  });
}

async function loadAttendance(lessonId) {
  const listBox = document.getElementById('journal-list');
  if (!lessonId) {
    listBox.innerHTML = '<p>Выбери занятие.</p>';
    return;
  }

  listBox.innerHTML = '<p>Загружаю...</p>';

  const lesson = lessonsCache.find(l => l.id === lessonId);
  if (!lesson) return;

  const students = studentsCache.filter(s => s.group_id === lesson.group_id && s.is_active);

  if (!students.length) {
    listBox.innerHTML = '<p>⚠️ В этой группе нет активных учеников.</p>';
    return;
  }

  const existing = await db.fetchAttendanceForLesson(lessonId);
  currentAttendance = {};
  existing.forEach(a => {
    currentAttendance[a.student_id] = {
      id: a.id,
      status: a.status,
      comment: a.comment || '',
    };
  });

  listBox.innerHTML = '';

  const lessonInfo = el('div', {
    style: 'background:#eef2ff;padding:12px;border-radius:10px;margin-bottom:12px;',
  });
  lessonInfo.appendChild(el('div', { style: 'font-weight:bold;' },
    `📅 ${lesson.date} · ${lesson.topic || 'без темы'}`));
  if (lesson.teacher_name) {
    lessonInfo.appendChild(el('div', { style: 'font-size:0.9rem;color:#666;' },
      `👨‍🏫 ${lesson.teacher_name}`));
  }
  listBox.appendChild(lessonInfo);

  const markAllBtn = el('button', {
    style: 'background:#4f46e5;color:#fff;padding:8px 14px;border:none;border-radius:10px;cursor:pointer;font-size:0.9rem;margin-bottom:12px;',
    onclick: async () => {
      if (!confirm('Отметить всех как "Был"?')) return;
      for (const s of students) {
        await markStudent(lessonId, s.id, 'present', '');
      }
      await loadAttendance(lessonId);
    },
  }, '✅ Все присутствуют');
  listBox.appendChild(markAllBtn);

  // --- Блок заявок от учеников ---
  try {
    const requests = await db.fetchRequestsForLesson(lessonId);
    if (requests.length) {
      const requestsBox = el('div', {
        style: `background:#fef3c7;border:2px dashed #f59e0b;
                border-radius:12px;padding:14px;margin-bottom:14px;`,
      });
      requestsBox.appendChild(el('div', {
        style: 'font-weight:bold;color:#92400e;margin-bottom:10px;',
      }, `📨 Заявки от учеников (${requests.length})`));

      requests.forEach(req => {
        const student = studentsCache.find(s => s.id === req.student_id);
        const studentName = student ? student.full_name : 'Неизвестный';
        const statusInfo = getRequestStatusInfo(req.status);

        const reqRow = el('div', {
          style: `background:#fff;padding:10px;border-radius:8px;
                  margin-bottom:8px;display:flex;justify-content:space-between;
                  align-items:center;gap:8px;flex-wrap:wrap;`,
        });

        const info = el('div', { style: 'flex:1;' });
        info.appendChild(el('div', { style: 'font-weight:bold;font-size:0.95rem;' }, studentName));
        info.appendChild(el('div', {
          style: `font-size:0.9rem;color:${statusInfo.color};margin-top:2px;`,
        }, `${statusInfo.emoji} ${statusInfo.label}${req.reason ? ' — ' + req.reason : ''}`));
        reqRow.appendChild(info);

        if (req.is_approved) {
          reqRow.appendChild(el('div', {
            style: 'background:#22c55e;color:#fff;padding:4px 10px;border-radius:999px;font-size:0.8rem;',
          }, '✅ Подтверждено'));
        } else {
          const btnBox = el('div', { style: 'display:flex;gap:6px;' });

          btnBox.appendChild(el('button', {
            style: 'background:#22c55e;color:#fff;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:0.85rem;',
            onclick: async () => {
              try {
                await db.approveRequest(req.id, currentUser?.user_metadata?.full_name || currentUser?.email || 'unknown');
                toast('Подтверждено! ✅', 'ok');
                await loadAttendance(lessonId);
              } catch (e) {
                toast('Ошибка: ' + e.message, 'err');
              }
            },
          }, '✅'));

          btnBox.appendChild(el('button', {
            style: 'background:#ef4444;color:#fff;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:0.85rem;',
            onclick: async () => {
              if (!confirm(`Отклонить заявку от ${studentName}?`)) return;
              try {
                await db.rejectRequest(req.id);
                toast('Отклонено', 'ok');
                await loadAttendance(lessonId);
              } catch (e) {
                toast('Ошибка: ' + e.message, 'err');
              }
            },
          }, '❌'));

          reqRow.appendChild(btnBox);
        }

        requestsBox.appendChild(reqRow);
      });

      const pendingReqs = requests.filter(r => !r.is_approved);
      if (pendingReqs.length > 1) {
        requestsBox.appendChild(el('button', {
          style: `background:#4f46e5;color:#fff;width:100%;padding:10px;
                  border:none;border-radius:8px;cursor:pointer;font-size:0.9rem;margin-top:8px;`,
          onclick: async () => {
            if (!confirm(`Подтвердить все заявки (${pendingReqs.length})?`)) return;
            try {
              for (const r of pendingReqs) {
                await db.approveRequest(r.id, currentUser?.user_metadata?.full_name || currentUser?.email || 'unknown');
              }
              toast('Все заявки подтверждены! ✅', 'ok');
              await loadAttendance(lessonId);
            } catch (e) {
              toast('Ошибка: ' + e.message, 'err');
            }
          },
        }, `✅ Подтвердить все (${pendingReqs.length})`));
      }

      listBox.appendChild(requestsBox);
    }
  } catch (e) {
    console.error('Ошибка загрузки заявок:', e);
  }

  // --- Список учеников ---
  const list = el('div', { style: 'display:flex;flex-direction:column;gap:10px;' });
  students.forEach(s => {
    list.appendChild(renderStudentAttendanceCard(lessonId, s));
  });
  listBox.appendChild(list);

  updateJournalSummary(lessonId, students);
}

function renderStudentAttendanceCard(lessonId, student) {
  const att = currentAttendance[student.id] || {};
  const status = att.status || null;

  const card = el('div', {
    style: 'background:#fff;padding:12px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08);',
  });

  card.appendChild(el('div', { style: 'font-weight:bold;margin-bottom:8px;' }, student.full_name));

  const btns = el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;' });

  const statuses = [
    { key: 'present', label: '✅ Был', color: '#22c55e' },
    { key: 'late', label: '⏰ Опоздал', color: '#f59e0b' },
    { key: 'absent', label: '❌ Не был', color: '#ef4444' },
    { key: 'excused', label: '📝 Уваж.', color: '#3b82f6' },
    { key: 'idle', label: '🥱 Бездельничал', color: '#a855f7' },
    { key: 'sabotage', label: '🤬 Саботировал', color: '#7f1d1d' },
  ];

  statuses.forEach(st => {
    const isActive = status === st.key;
    const btn = el('button', {
      style: `padding:8px 12px;border:2px solid ${st.color};
              background:${isActive ? st.color : '#fff'};
              color:${isActive ? '#fff' : st.color};
              border-radius:10px;cursor:pointer;font-size:0.9rem;
              transition:all .15s;`,
      onclick: async () => {
        const newStatus = isActive ? null : st.key;
        await markStudent(lessonId, student.id, newStatus, att.comment || '');
        await loadAttendance(lessonId);
      },
    }, st.label);
    btns.appendChild(btn);
  });

  card.appendChild(btns);

  const commentInput = el('input', {
    placeholder: '💬 Комментарий...',
    value: att.comment || '',
    style: 'width:100%;padding:8px;border-radius:8px;border:1px solid #e5e7eb;font-size:0.9rem;margin-top:8px;',
    onblur: async (e) => {
      if (!status) return;
      await markStudent(lessonId, student.id, status, e.target.value);
    },
  });
  card.appendChild(commentInput);

  return card;
}

async function markStudent(lessonId, studentId, status, comment) {
  if (!status) {
    const existing = currentAttendance[studentId];
    if (existing?.id) {
      await db.supabase.from('attendance').delete().eq('id', existing.id);
      delete currentAttendance[studentId];
    }
    return;
  }

  const record = {
    lesson_id: lessonId,
    student_id: studentId,
    status: status,
    comment: comment || null,
    marked_by: currentUser?.email || 'unknown',
  };

  const saved = await db.upsertAttendance(record);
  currentAttendance[studentId] = {
    id: saved.id,
    status: saved.status,
    comment: saved.comment || '',
  };
}

function updateJournalSummary(lessonId, students) {
  const counts = { present: 0, late: 0, absent: 0, excused: 0, idle: 0, sabotage: 0 };
  students.forEach(s => {
    const st = currentAttendance[s.id]?.status;
    if (st) counts[st]++;
  });

  const summary = el('div', {
    style: 'background:#fff;padding:12px;border-radius:12px;margin-top:16px;font-size:0.9rem;box-shadow:0 2px 8px rgba(0,0,0,.08);line-height:1.8;',
    html: `📊 <b>Итог занятия:</b><br>
      ✅ Был: <b>${counts.present}</b> ·
      ⏰ Опоздал: <b>${counts.late}</b> ·
      ❌ Не был: <b>${counts.absent}</b> ·
      📝 Уваж.: <b>${counts.excused}</b><br>
      🥱 Бездельничал: <b>${counts.idle}</b> ·
      🤬 Саботировал: <b>${counts.sabotage}</b>`,
  });

  const listBox = document.getElementById('journal-list');
  const old = listBox.querySelector('.summary-box');
  if (old) old.remove();
  summary.classList.add('summary-box');
  listBox.appendChild(summary);
}

// ============================================
// ОТЧЁТЫ
// ============================================
async function renderReports() {
  const root = document.getElementById('tab-reports');
  root.innerHTML = '';

  root.appendChild(el('h2', {}, '📊 Отчёты'));

  const today = new Date();
  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  const dateFrom = el('input', {
    type: 'date',
    value: monthAgo.toISOString().slice(0, 10),
    style: 'padding:10px;border-radius:8px;border:2px solid #e5e7eb;font-size:1rem;',
  });
  const dateTo = el('input', {
    type: 'date',
    value: today.toISOString().slice(0, 10),
    style: 'padding:10px;border-radius:8px;border:2px solid #e5e7eb;font-size:1rem;',
  });

  const groupSelect = el('select', {
    style: 'padding:10px;border-radius:8px;border:2px solid #e5e7eb;font-size:1rem;width:100%;',
  });
  groupSelect.appendChild(el('option', { value: '' }, '— Все группы —'));
  groupsCache.forEach(g => {
    groupSelect.appendChild(el('option', { value: g.id }, g.name));
  });

  const buildBtn = el('button', {
    style: 'background:#4f46e5;color:#fff;padding:12px 20px;border:none;border-radius:12px;font-size:1rem;cursor:pointer;',
    onclick: () => buildReport(dateFrom.value, dateTo.value, groupSelect.value),
  }, '🔍 Построить отчёт');

  const filterBox = el('div', {
    style: 'background:#fff;padding:16px;border-radius:12px;margin-bottom:16px;display:flex;flex-direction:column;gap:10px;box-shadow:0 2px 8px rgba(0,0,0,.08);',
  });
  filterBox.appendChild(el('label', {}, 'С даты:'));
  filterBox.appendChild(dateFrom);
  filterBox.appendChild(el('label', {}, 'По дату:'));
  filterBox.appendChild(dateTo);
  filterBox.appendChild(el('label', {}, 'Группа:'));
  filterBox.appendChild(groupSelect);
  filterBox.appendChild(buildBtn);
  root.appendChild(filterBox);

  const resultBox = el('div', { id: 'report-result' });
  resultBox.appendChild(el('p', {}, 'Настрой фильтры и нажми "Построить отчёт".'));
  root.appendChild(resultBox);
}

async function buildReport(dateFrom, dateTo, groupId) {
  const resultBox = document.getElementById('report-result');
  resultBox.innerHTML = '<p>Считаю...</p>';

  try {
    const allAttendance = await db.fetchAllAttendance();
    const allLessons = lessonsCache;

    const filteredLessons = allLessons.filter(l =>
      l.date >= dateFrom && l.date <= dateTo &&
      (!groupId || l.group_id === groupId)
    );

    if (!filteredLessons.length) {
      resultBox.innerHTML = '<p>😕 Нет занятий за выбранный период.</p>';
      return;
    }

    const lessonIds = new Set(filteredLessons.map(l => l.id));
    const relevantAttendance = allAttendance.filter(a => lessonIds.has(a.lesson_id));

    const stats = {};
    const relevantStudents = studentsCache.filter(s =>
      !groupId || s.group_id === groupId
    );

    relevantStudents.forEach(s => {
      stats[s.id] = { present: 0, late: 0, absent: 0, excused: 0, idle: 0, sabotage: 0, total: 0 };
    });

    relevantAttendance.forEach(a => {
      if (stats[a.student_id]) {
        stats[a.student_id][a.status] = (stats[a.student_id][a.status] || 0) + 1;
        stats[a.student_id].total++;
      }
    });

    const table = el('table', {
      style: 'width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);',
    });

    const thead = el('thead');
    const headRow = el('tr', { style: 'background:#4f46e5;color:#fff;' });
    ['Ученик', '✅', '⏰', '❌', '📝', '🥱', '🤬', 'Всего', '%'].forEach(h => {
      headRow.appendChild(el('th', { style: 'padding:10px;text-align:left;font-size:0.9rem;' }, h));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = el('tbody');
    let rowIdx = 0;
    relevantStudents.forEach(s => {
      const st = stats[s.id];
      if (st.total === 0) return;

      const percent = Math.round((st.present + st.late) / st.total * 100);
      const row = el('tr', {
        style: `background:${rowIdx % 2 ? '#f9fafb' : '#fff'};`,
      });
      row.appendChild(el('td', { style: 'padding:10px;font-size:0.95rem;' }, s.full_name));
      row.appendChild(el('td', { style: 'padding:10px;color:#22c55e;font-weight:bold;' }, String(st.present)));
      row.appendChild(el('td', { style: 'padding:10px;color:#f59e0b;font-weight:bold;' }, String(st.late)));
      row.appendChild(el('td', { style: 'padding:10px;color:#ef4444;font-weight:bold;' }, String(st.absent)));
      row.appendChild(el('td', { style: 'padding:10px;color:#3b82f6;font-weight:bold;' }, String(st.excused)));
      row.appendChild(el('td', { style: 'padding:10px;color:#a855f7;font-weight:bold;' }, String(st.idle)));
      row.appendChild(el('td', { style: 'padding:10px;color:#7f1d1d;font-weight:bold;' }, String(st.sabotage)));
      row.appendChild(el('td', { style: 'padding:10px;' }, String(st.total)));
      row.appendChild(el('td', {
        style: `padding:10px;font-weight:bold;color:${percent >= 80 ? '#22c55e' : percent >= 50 ? '#f59e0b' : '#ef4444'};`,
      }, percent + '%'));

      tbody.appendChild(row);
      rowIdx++;
    });
    table.appendChild(tbody);

    resultBox.innerHTML = '';
    const info = el('div', {
      style: 'background:#eef2ff;padding:12px;border-radius:10px;margin-bottom:12px;',
      html: `📅 Период: <b>${dateFrom}</b> — <b>${dateTo}</b><br>📚 Занятий: <b>${filteredLessons.length}</b>`,
    });
    resultBox.appendChild(info);

    const exportRow = el('div', { style: 'display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap;' });
    exportRow.appendChild(el('button', {
      style: 'background:#16a34a;color:#fff;padding:10px 16px;border:none;border-radius:10px;cursor:pointer;font-size:0.95rem;',
      onclick: () => window.__exportExcel(relevantStudents, stats, dateFrom, dateTo),
    }, '📥 Скачать Excel'));
    exportRow.appendChild(el('button', {
      style: 'background:#dc2626;color:#fff;padding:10px 16px;border:none;border-radius:10px;cursor:pointer;font-size:0.95rem;',
      onclick: () => window.__exportPDF(relevantStudents, stats, dateFrom, dateTo),
    }, '📥 Скачать PDF'));
    resultBox.appendChild(exportRow);
    resultBox.appendChild(table);

  } catch (e) {
    console.error('❌ Ошибка отчёта:', e);
    resultBox.innerHTML = `<div style="background:#fee2e2;padding:16px;border-radius:12px;">
      <b>❌ Ошибка отчёта:</b><br>
      <code style="color:#7f1d1d;word-break:break-all;">${e.message}</code>
    </div>`;
  }
}

// ============================================
// QR-КОДЫ ГРУПП
// ============================================
async function renderQRCodes() {
  const root = document.getElementById('tab-qrcodes');
  root.innerHTML = '';

  if (!groupsCache.length) {
    root.appendChild(el('p', {}, '⚠️ Сначала создай хотя бы одну группу в Настройках.'));
    return;
  }

  root.appendChild(el('p', {
    style: 'color:#666;margin-bottom:16px;',
  }, '📱 Скачай QR-код группы и распечатай. Ученики сканируют → видят занятия своей группы.'));

  const list = el('div', {
    style: 'display:flex;flex-direction:column;gap:20px;',
  });

  groupsCache.forEach(g => {
    list.appendChild(makeGroupQRCard(g));
  });

  root.appendChild(list);
}

function makeGroupQRCard(group) {
  const baseUrl = window.location.origin + window.location.pathname.replace('index.html', '');
  const studentUrl = `${baseUrl}student.html?group=${group.id}`;

  const card = el('div', {
    style: `background:#fff;padding:20px;border-radius:16px;
            box-shadow:0 4px 16px rgba(0,0,0,.1);
            display:flex;flex-direction:column;align-items:center;gap:12px;`,
  });

  card.appendChild(el('div', {
    style: 'font-size:1.2rem;font-weight:bold;color:#4f46e5;text-align:center;',
  }, `🏫 ${group.name}`));

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(studentUrl)}&color=4f46e5&bgcolor=ffffff&margin=10`;

  const qrImg = el('img', {
    src: qrUrl,
    alt: 'QR-код группы',
    style: 'width:220px;height:220px;border:2px solid #e5e7eb;border-radius:12px;padding:8px;background:#fff;',
  });
  card.appendChild(qrImg);

  const urlBox = el('div', {
    style: `font-size:0.8rem;color:#666;background:#f3f4f6;
            padding:8px 12px;border-radius:8px;
            word-break:break-all;text-align:center;
            max-width:100%;font-family:monospace;`,
  }, studentUrl);
  card.appendChild(urlBox);

  const btnRow = el('div', {
    style: 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center;',
  });

  btnRow.appendChild(el('button', {
    style: `background:#4f46e5;color:#fff;padding:10px 16px;
            border:none;border-radius:10px;cursor:pointer;font-size:0.9rem;`,
    onclick: async () => {
      try {
        await navigator.clipboard.writeText(studentUrl);
        toast('Ссылка скопирована! 📋', 'ok');
      } catch (e) {
        toast('Не удалось скопировать', 'err');
      }
    },
  }, '📋 Копировать ссылку'));

  btnRow.appendChild(el('button', {
    style: `background:#22c55e;color:#fff;padding:10px 16px;
            border:none;border-radius:10px;cursor:pointer;font-size:0.9rem;`,
    onclick: () => downloadQRFromUrl(qrUrl, group.name),
  }, '💾 Скачать PNG'));

  btnRow.appendChild(el('button', {
    style: `background:#f59e0b;color:#fff;padding:10px 16px;
            border:none;border-radius:10px;cursor:pointer;font-size:0.9rem;`,
    onclick: () => window.open(studentUrl, '_blank'),
  }, '👁️ Проверить'));

  card.appendChild(btnRow);

  return card;
}

async function downloadQRFromUrl(qrUrl, groupName) {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = qrUrl;
    });

    const size = 600;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size + 100;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#4f46e5';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(groupName, size / 2, 50);

    ctx.drawImage(img, 50, 80, size - 100, size - 100);

    ctx.fillStyle = '#666';
    ctx.font = '20px Arial';
    ctx.fillText('🤖 КЛАСС РОБОТОТЕХНИКИ', size / 2, size + 50);

    const link = document.createElement('a');
    const safeName = groupName.replace(/[^a-zа-я0-9]/gi, '_');
    link.download = `QR_${safeName}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    toast('QR-код скачан! 💾', 'ok');
  } catch (e) {
    console.error('Ошибка скачивания:', e);
    window.open(qrUrl, '_blank');
    toast('Скачай картинку вручную (правой кнопкой → Сохранить)', 'info');
  }
}

// ============================================
// ПРОПУСКА УЧЕНИКОВ (персональные QR)
// ============================================
async function renderPasses() {
  const root = document.getElementById('tab-passes');
  root.innerHTML = '';

  if (!studentsCache.length) {
    root.appendChild(el('p', {}, '⚠️ Сначала добавь учеников.'));
    return;
  }

  root.appendChild(el('p', {
    style: 'color:#666;margin-bottom:16px;',
  }, '🎫 Персональные QR-пропуска. Ученик сканирует → видит свои занятия и посещаемость.'));

  const groupFilter = el('select', {
    style: 'padding:10px;border-radius:8px;border:2px solid #e5e7eb;font-size:1rem;margin-bottom:16px;width:100%;',
    onchange: () => renderPassesList(groupFilter.value),
  });
  groupFilter.appendChild(el('option', { value: '' }, '— Все группы —'));
  groupsCache.forEach(g => {
    groupFilter.appendChild(el('option', { value: g.id }, g.name));
  });

  root.appendChild(el('label', { style: 'font-weight:bold;display:block;margin-bottom:4px;' }, '🏫 Фильтр по группе'));
  root.appendChild(groupFilter);

  const listBox = el('div', { id: 'passes-list' });
  listBox.appendChild(el('p', {}, 'Выбери группу или покажи всех.'));
  root.appendChild(listBox);

  renderPassesList('');
}

async function renderPassesList(groupId) {
  const listBox = document.getElementById('passes-list');
  listBox.innerHTML = '<p>Загружаю...</p>';

  try {
    const tokens = await db.fetchStudentsWithTokens();
    const tokenMap = {};
    tokens.forEach(t => tokenMap[t.student_id] = t.token);

    const filtered = studentsCache.filter(s =>
      s.is_active && (!groupId || s.group_id === groupId)
    );

    if (!filtered.length) {
      listBox.innerHTML = '<p>😕 Нет учеников в этой группе.</p>';
      return;
    }

    listBox.innerHTML = '';
    const grid = el('div', {
      style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;',
    });

    filtered.forEach(s => {
      const group = groupsCache.find(g => g.id === s.group_id);
      grid.appendChild(makePassCard(s, group, tokenMap[s.id]));
    });

    listBox.appendChild(grid);
  } catch (e) {
    console.error('Ошибка:', e);
    listBox.innerHTML = `<p style="color:#ef4444;">Ошибка: ${e.message}</p>`;
  }
}

function makePassCard(student, group, existingToken) {
  const card = el('div', {
    style: `background:#fff;padding:16px;border-radius:16px;
            box-shadow:0 4px 16px rgba(0,0,0,.08);
            display:flex;flex-direction:column;align-items:center;gap:10px;`,
  });

  card.appendChild(el('div', {
    style: 'font-weight:bold;font-size:1rem;color:#4f46e5;text-align:center;',
  }, student.full_name));

  if (group) {
    card.appendChild(el('div', {
      style: 'font-size:0.85rem;color:#666;',
    }, `🏫 ${group.name}`));
  }

  if (!existingToken) {
    card.appendChild(el('div', {
      style: 'background:#fef3c7;color:#92400e;padding:8px 12px;border-radius:8px;font-size:0.85rem;text-align:center;',
    }, '⚠️ Нет QR-пропуска. Нажми «Создать».'));

    card.appendChild(el('button', {
      style: 'background:#22c55e;color:#fff;padding:10px 20px;border:none;border-radius:10px;cursor:pointer;font-size:0.95rem;',
      onclick: async () => {
        try {
          await db.getOrCreateToken(student.id);
          toast('QR создан! 🎫', 'ok');
          renderPassesList(group?.id || '');
        } catch (e) {
          toast('Ошибка: ' + e.message, 'err');
        }
      },
    }, '🎫 Создать QR-пропуск'));
    return card;
  }

  const baseUrl = window.location.origin + window.location.pathname.replace('index.html', '');
  const studentUrl = `${baseUrl}student.html?token=${existingToken}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(studentUrl)}&color=4f46e5&bgcolor=ffffff&margin=10`;

  card.appendChild(el('img', {
    src: qrUrl,
    style: 'width:180px;height:180px;border:2px solid #e5e7eb;border-radius:12px;padding:6px;background:#fff;',
  }));

  const btnRow = el('div', {
    style: 'display:flex;gap:6px;flex-wrap:wrap;justify-content:center;width:100%;',
  });

  btnRow.appendChild(el('button', {
    style: 'background:#22c55e;color:#fff;padding:8px 12px;border:none;border-radius:8px;cursor:pointer;font-size:0.85rem;flex:1;',
    onclick: () => downloadStudentPass(qrUrl, student, group),
  }, '💾 Скачать'));

  btnRow.appendChild(el('button', {
    style: 'background:#f59e0b;color:#fff;padding:8px 12px;border:none;border-radius:8px;cursor:pointer;font-size:0.85rem;',
    onclick: () => window.open(studentUrl, '_blank'),
  }, '👁️'));

  btnRow.appendChild(el('button', {
    style: 'background:#ef4444;color:#fff;padding:8px 12px;border:none;border-radius:8px;cursor:pointer;font-size:0.85rem;',
    onclick: async () => {
      if (!confirm(`Перевыпустить QR для ${student.full_name}? Старый перестанет работать.`)) return;
      try {
        await db.rotateToken(student.id);
        toast('QR перевыпущен! 🔄', 'ok');
        renderPassesList(group?.id || '');
      } catch (e) {
        toast('Ошибка: ' + e.message, 'err');
      }
    },
  }, '🔄'));

  card.appendChild(btnRow);

  return card;
}

async function downloadStudentPass(qrUrl, student, group) {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = qrUrl;
    });

    const w = 600;
    const h = 800;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    gradient.addColorStop(0, '#4f46e5');
    gradient.addColorStop(1, '#9333ea');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, 100);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🤖 КЛАСС РОБОТОТЕХНИКИ', w / 2, 60);

    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 28px Arial';
    const fullName = student.full_name;
    let displayName = fullName;
    if (displayName.length > 26) {
      displayName = displayName.substring(0, 24) + '...';
    }
    ctx.fillText(displayName, w / 2, 180);

    if (group) {
      ctx.fillStyle = '#4f46e5';
      ctx.font = 'bold 22px Arial';
      ctx.fillText('🏫 ' + group.name, w / 2, 220);
    }

    ctx.drawImage(img, 100, 260, 400, 400);

    ctx.fillStyle = '#666';
    ctx.font = '16px Arial';
    ctx.fillText('🎫 Личный пропуск ученика', w / 2, 710);

    ctx.fillStyle = '#9ca3af';
    ctx.font = '14px Arial';
    ctx.fillText('Сканируй QR → открой свои занятия', w / 2, 740);

    const link = document.createElement('a');
    const safeName = fullName.replace(/[^a-zа-я0-9]/gi, '_');
    link.download = `Пропуск_${safeName}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    toast('Пропуск скачан! 💾', 'ok');
  } catch (e) {
    console.error('Ошибка:', e);
    window.open(qrUrl, '_blank');
    toast('Сохрани QR вручную', 'info');
  }
}

// ============================================
// ЗАЯВКИ ОТ УЧЕНИКОВ
// ============================================
async function renderRequests() {
  const root = document.getElementById('tab-requests');
  root.innerHTML = '';

  root.appendChild(el('p', {
    style: 'color:#666;margin-bottom:16px;',
  }, '📨 Заявки от учеников. Подтверди или отклони — данные попадут в журнал.'));

  const listBox = el('div', { id: 'requests-list' });
  listBox.appendChild(el('p', {}, 'Загружаю...'));
  root.appendChild(listBox);

  try {
    const requests = await db.fetchAllRequests();
    listBox.innerHTML = '';

    if (!requests.length) {
      listBox.innerHTML = '<p>😕 Пока нет заявок.</p>';
      return;
    }

    const byLesson = {};
    requests.forEach(r => {
      if (!byLesson[r.lesson_id]) byLesson[r.lesson_id] = [];
      byLesson[r.lesson_id].push(r);
    });

    const lessonsWithRequests = lessonsCache.filter(l => byLesson[l.id]);
    lessonsWithRequests.sort((a, b) => b.date.localeCompare(a.date));

    lessonsWithRequests.forEach(lesson => {
      const lessonRequests = byLesson[lesson.id];
      const group = groupsCache.find(g => g.id === lesson.group_id);

      const lessonHeader = el('div', {
        style: `background:linear-gradient(90deg,#4f46e5,#9333ea);
                color:#fff;padding:12px 16px;border-radius:12px;
                margin:20px 0 12px;`,
      });
      lessonHeader.appendChild(el('div', {
        style: 'font-weight:bold;font-size:1.05rem;',
      }, `📅 ${lesson.date} · ${group ? group.name : 'без группы'}`));
      if (lesson.topic) {
        lessonHeader.appendChild(el('div', {
          style: 'font-size:0.9rem;opacity:.9;margin-top:4px;',
        }, `📖 ${lesson.topic}`));
      }
      listBox.appendChild(lessonHeader);

      lessonRequests.forEach(req => {
        listBox.appendChild(makeRequestCard(req, lesson, group));
      });
    });

  } catch (e) {
    console.error('Ошибка:', e);
    listBox.innerHTML = `<p style="color:#ef4444;">Ошибка: ${e.message}</p>`;
  }
}

function makeRequestCard(request, lesson, group) {
  const student = studentsCache.find(s => s.id === request.student_id);
  const studentName = student ? student.full_name : 'Неизвестный';

  const statusInfo = getRequestStatusInfo(request.status);

  const card = el('div', {
    style: `background:#fff;padding:14px;border-radius:12px;
            box-shadow:0 2px 8px rgba(0,0,0,.08);margin-bottom:10px;
            border-left:5px solid ${statusInfo.color};`,
  });

  const infoRow = el('div', {
    style: 'display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;',
  });

  const info = el('div', { style: 'flex:1;min-width:200px;' });
  info.appendChild(el('div', {
    style: 'font-weight:bold;font-size:1rem;',
  }, studentName));
  info.appendChild(el('div', {
    style: `font-size:0.95rem;color:${statusInfo.color};margin-top:4px;`,
  }, `${statusInfo.emoji} ${statusInfo.label}`));
  if (request.reason) {
    info.appendChild(el('div', {
      style: 'font-size:0.85rem;color:#666;margin-top:4px;',
    }, `💬 ${request.reason}`));
  }

  const badge = el('div', {
    style: request.is_approved
      ? 'background:#22c55e;color:#fff;padding:4px 10px;border-radius:999px;font-size:0.8rem;'
      : 'background:#f59e0b;color:#fff;padding:4px 10px;border-radius:999px;font-size:0.8rem;',
  }, request.is_approved ? '✅ Подтверждено' : '⏳ На проверке');

  infoRow.appendChild(info);
  infoRow.appendChild(badge);
  card.appendChild(infoRow);

  if (!request.is_approved) {
    const btnRow = el('div', {
      style: 'display:flex;gap:8px;margin-top:12px;',
    });

    btnRow.appendChild(el('button', {
      style: `background:#22c55e;color:#fff;padding:8px 16px;
              border:none;border-radius:8px;cursor:pointer;font-size:0.9rem;flex:1;`,
      onclick: async () => {
        try {
          await db.approveRequest(request.id, currentUser?.user_metadata?.full_name || currentUser?.email || 'unknown');
          toast('Заявка подтверждена! ✅', 'ok');
          renderRequests();
        } catch (e) {
          toast('Ошибка: ' + e.message, 'err');
        }
      },
    }, '✅ Подтвердить'));

    btnRow.appendChild(el('button', {
      style: `background:#ef4444;color:#fff;padding:8px 16px;
              border:none;border-radius:8px;cursor:pointer;font-size:0.9rem;flex:1;`,
      onclick: async () => {
        if (!confirm(`Отклонить заявку от ${studentName}?`)) return;
        try {
          await db.rejectRequest(request.id);
          toast('Заявка отклонена', 'ok');
          renderRequests();
        } catch (e) {
          toast('Ошибка: ' + e.message, 'err');
        }
      },
    }, '❌ Отклонить'));

    card.appendChild(btnRow);
  }

  return card;
}

function getRequestStatusInfo(status) {
  const map = {
    present: { label: 'Буду', emoji: '✅', color: '#22c55e' },
    late: { label: 'Опоздаю', emoji: '⏰', color: '#f59e0b' },
    absent: { label: 'Не смогу', emoji: '❌', color: '#ef4444' },
    excused: { label: 'Болею', emoji: '📝', color: '#3b82f6' },
  };
  return map[status] || { label: status, emoji: '❓', color: '#666' };
}

// ============================================
// ОБЪЯВЛЕНИЯ
// ============================================
async function renderAnnouncements() {
  const root = document.getElementById('tab-announcements');
  root.innerHTML = '';

  root.appendChild(el('p', {
    style: 'color:#666;margin-bottom:16px;',
  }, '📢 Объявления для учеников. Можно адресовать всем, группе или лично.'));

  root.appendChild(el('button', {
    style: 'background:#22c55e;color:#fff;padding:12px 20px;border:none;border-radius:12px;font-size:1rem;cursor:pointer;margin-bottom:16px;',
    onclick: () => openAnnouncementForm(),
  }, '➕ Создать объявление'));

  const listBox = el('div', { id: 'announcements-list' });
  listBox.appendChild(el('p', {}, 'Загружаю...'));
  root.appendChild(listBox);

  try {
    const anns = await db.fetchAnnouncements();
    listBox.innerHTML = '';

    if (!anns.length) {
      listBox.innerHTML = '<p>😕 Пока нет объявлений.</p>';
      return;
    }

    anns.forEach(a => {
      listBox.appendChild(makeAnnouncementCard(a));
    });
  } catch (e) {
    console.error('Ошибка:', e);
    listBox.innerHTML = `<p style="color:#ef4444;">Ошибка: ${e.message}</p>`;
  }
}

function makeAnnouncementCard(ann) {
  let targetLabel = '🌍 Всем';
  let targetColor = '#4f46e5';

  if (ann.target_type === 'group') {
    const group = groupsCache.find(g => g.id === ann.target_id);
    targetLabel = '🏫 ' + (group ? group.name : 'группа');
    targetColor = '#9333ea';
  } else if (ann.target_type === 'student') {
    const student = studentsCache.find(s => s.id === ann.target_id);
    targetLabel = '👤 ' + (student ? student.full_name : 'ученик');
    targetColor = '#f59e0b';
  }

  const card = el('div', {
    style: `background:#fff;padding:16px;border-radius:12px;
            box-shadow:0 2px 8px rgba(0,0,0,.08);margin-bottom:12px;
            border-left:5px solid ${targetColor};`,
  });

  const header = el('div', {
    style: 'display:flex;justify-content:space-between;align-items:flex-start;gap:10px;',
  });

  const info = el('div', { style: 'flex:1;' });
  info.appendChild(el('div', {
    style: 'font-weight:bold;font-size:1.1rem;margin-bottom:6px;',
  }, '📢 ' + ann.title));
  info.appendChild(el('div', {
    style: `display:inline-block;background:${targetColor};color:#fff;
            padding:2px 10px;border-radius:999px;font-size:0.8rem;margin-bottom:8px;`,
  }, targetLabel));
  info.appendChild(el('div', {
    style: 'font-size:0.95rem;color:#1f2937;white-space:pre-wrap;margin-top:6px;',
  }, ann.text));
  info.appendChild(el('div', {
    style: 'font-size:0.8rem;color:#9ca3af;margin-top:10px;',
  }, `${ann.author || ''} · ${new Date(ann.created_at).toLocaleString('ru-RU')}`));

  header.appendChild(info);

  const delBtn = el('button', {
    style: 'background:#ef4444;color:#fff;border:none;padding:6px 10px;border-radius:8px;cursor:pointer;font-size:0.9rem;',
    onclick: async () => {
      if (!confirm('Удалить объявление?')) return;
      await db.deleteAnnouncement(ann.id);
      renderAnnouncements();
    },
  }, '🗑️');
  header.appendChild(delBtn);

  card.appendChild(header);
  return card;
}

function openAnnouncementForm() {
  const form = el('div', { style: 'display:flex;flex-direction:column;gap:10px;' });

  const titleInput = el('input', {
    placeholder: 'Заголовок *',
    style: 'padding:10px;border-radius:8px;border:2px solid #e5e7eb;font-size:1rem;',
  });

  const textInput = el('textarea', {
    placeholder: 'Текст объявления *',
    style: 'padding:10px;border-radius:8px;border:2px solid #e5e7eb;font-size:1rem;min-height:100px;',
  });

  const targetSelect = el('select', {
    style: 'padding:10px;border-radius:8px;border:2px solid #e5e7eb;font-size:1rem;',
    onchange: () => updateTargetOptions(targetSelect.value, targetOptions),
  });
  targetSelect.appendChild(el('option', { value: 'all' }, '🌍 Всем ученикам'));
  targetSelect.appendChild(el('option', { value: 'group' }, '🏫 Группе'));
  targetSelect.appendChild(el('option', { value: 'student' }, '👤 Конкретному ученику'));

  const targetOptions = el('select', {
    style: 'padding:10px;border-radius:8px;border:2px solid #e5e7eb;font-size:1rem;display:none;',
  });

  form.appendChild(el('label', {}, 'Заголовок *'));
  form.appendChild(titleInput);
  form.appendChild(el('label', {}, 'Текст *'));
  form.appendChild(textInput);
  form.appendChild(el('label', {}, 'Кому'));
  form.appendChild(targetSelect);
  form.appendChild(targetOptions);

  openModal('📢 Новое объявление', form, async () => {
    if (!titleInput.value.trim()) throw new Error('Введи заголовок');
    if (!textInput.value.trim()) throw new Error('Введи текст');

    const payload = {
      title: titleInput.value.trim(),
      text: textInput.value.trim(),
      target_type: targetSelect.value,
      target_id: targetSelect.value !== 'all' ? targetOptions.value || null : null,
      author: currentUser?.user_metadata?.full_name || currentUser?.email || 'Учитель',
    };

    if (payload.target_type !== 'all' && !payload.target_id) {
      throw new Error('Выбери получателя');
    }

    await db.createAnnouncement(payload);
    toast('Объявление создано! 📢', 'ok');
    renderAnnouncements();
  });
}

function updateTargetOptions(type, select) {
  select.innerHTML = '';
  if (type === 'all') {
    select.style.display = 'none';
    return;
  }
  select.style.display = 'block';

  if (type === 'group') {
    groupsCache.forEach(g => {
      select.appendChild(el('option', { value: g.id }, g.name));
    });
  } else if (type === 'student') {
    studentsCache.filter(s => s.is_active).forEach(s => {
      select.appendChild(el('option', { value: s.id }, s.full_name));
    });
  }
}

// ============================================
// ЧАТЫ (для учителя)
// ============================================
let chatRooms = {};
let currentChatRoom = null;
let chatChannel = null;

async function renderChats() {
  const root = document.getElementById('tab-chats');
  root.innerHTML = '';

  root.appendChild(el('p', {
    style: 'color:#666;margin-bottom:16px;',
  }, '💬 Чаты с учениками. Выбери комнату слева — читай и отвечай.'));

  chatRooms = {};

  chatRooms['global'] = {
    key: 'global',
    name: '🌍 Общий чат',
    type: 'global',
    id: null,
  };

  groupsCache.forEach(g => {
    const key = 'group:' + g.id;
    chatRooms[key] = {
      key: key,
      name: '🏫 ' + g.name,
      type: 'group',
      id: g.id,
    };
  });

  for (const key in chatRooms) {
    try {
      const unread = await db.getTeacherUnreadCount(key);
      chatRooms[key].unread = unread;
    } catch (e) {
      chatRooms[key].unread = 0;
    }
  }

  const layout = el('div', {
    style: 'display:grid;grid-template-columns:280px 1fr;gap:16px;min-height:600px;',
  });

  const sidebar = el('div', {
    style: 'background:#fff;border-radius:12px;padding:8px;box-shadow:0 2px 8px rgba(0,0,0,.08);overflow-y:auto;max-height:700px;',
  });
  sidebar.appendChild(el('div', {
    style: 'font-weight:bold;color:#4f46e5;padding:8px;font-size:0.95rem;',
  }, 'Комнаты'));

  Object.values(chatRooms).forEach(room => {
    sidebar.appendChild(makeRoomListItem(room));
  });

  const chatPanel = el('div', {
    id: 'teacher-chat-panel',
    style: 'background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08);display:flex;flex-direction:column;min-height:600px;max-height:700px;',
  });
  chatPanel.appendChild(el('div', {
    style: 'padding:40px;text-align:center;color:#9ca3af;font-size:1rem;',
  }, '👈 Выбери комнату слева'));

  layout.appendChild(sidebar);
  layout.appendChild(chatPanel);
  root.appendChild(layout);
}

function makeRoomListItem(room) {
  const item = el('div', {
    style: `padding:10px 12px;border-radius:10px;cursor:pointer;
            margin-bottom:4px;display:flex;justify-content:space-between;
            align-items:center;gap:8px;transition:background .15s;
            ${currentChatRoom === room.key ? 'background:#eef2ff;' : ''}`,
    onclick: () => openTeacherRoom(room.key),
    onmouseover: function() { if (currentChatRoom !== room.key) this.style.background = '#f3f4f6'; },
    onmouseout: function() { if (currentChatRoom !== room.key) this.style.background = ''; },
  });

  const name = el('div', {
    style: 'font-size:0.95rem;flex:1;',
  }, room.name);

  item.appendChild(name);

  if (room.unread > 0) {
    item.appendChild(el('span', {
      style: `background:#ef4444;color:#fff;border-radius:999px;
              padding:2px 8px;font-size:0.75rem;font-weight:bold;`,
    }, String(room.unread)));
  }

  return item;
}

async function openTeacherRoom(roomKey) {
  currentChatRoom = roomKey;
  const room = chatRooms[roomKey];

  const root = document.getElementById('tab-chats');
  const sidebar = root.querySelector('div[style*="grid-template-columns"] > div');
  if (sidebar) {
    const newSidebar = sidebar.cloneNode(false);
    newSidebar.appendChild(el('div', {
      style: 'font-weight:bold;color:#4f46e5;padding:8px;font-size:0.95rem;',
    }, 'Комнаты'));
    Object.values(chatRooms).forEach(r => {
      newSidebar.appendChild(makeRoomListItem(r));
    });
    sidebar.parentNode.replaceChild(newSidebar, sidebar);
  }

  const panel = document.getElementById('teacher-chat-panel');
  panel.innerHTML = '';

  const header = el('div', {
    style: `background:linear-gradient(90deg,#4f46e5,#9333ea);color:#fff;
            padding:14px 18px;border-radius:12px 12px 0 0;
            display:flex;justify-content:space-between;align-items:center;`,
  });
  header.appendChild(el('div', { style: 'font-weight:bold;' }, room.name));
  panel.appendChild(header);

  const messagesBox = el('div', {
    id: 'teacher-messages',
    style: 'flex:1;overflow-y:auto;padding:16px;background:#f9fafb;display:flex;flex-direction:column;gap:10px;',
  });
  messagesBox.innerHTML = '<div style="text-align:center;color:#9ca3af;padding:20px;">Загружаю...</div>';
  panel.appendChild(messagesBox);

  const form = el('div', {
    style: 'padding:12px;background:#fff;border-top:2px solid #e5e7eb;display:flex;gap:8px;border-radius:0 0 12px 12px;',
  });
  const input = el('textarea', {
    id: 'teacher-chat-input',
    placeholder: 'Написать сообщение...',
    rows: '1',
    style: `flex:1;padding:10px 14px;border:2px solid #e5e7eb;
            border-radius:14px;resize:none;font-family:inherit;
            font-size:0.95rem;max-height:120px;outline:none;`,
  });
  const sendBtn = el('button', {
    style: `background:#4f46e5;color:#fff;border:none;width:44px;height:44px;
            border-radius:50%;cursor:pointer;font-size:1.2rem;flex-shrink:0;`,
    onclick: () => sendTeacherMsg(),
  }, '📤');

  form.appendChild(input);
  form.appendChild(sendBtn);
  panel.appendChild(form);

  await loadTeacherMessages(room);
  setupTeacherRealtime(room);

  input.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendTeacherMsg();
    }
  };
  input.oninput = () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  };

  await db.markRoomReadTeacher(room.key);
  room.unread = 0;

  const roomItem = Object.values(chatRooms).find(r => r.key === room.key);
  if (roomItem) roomItem.unread = 0;
}

async function loadTeacherMessages(room) {
  const box = document.getElementById('teacher-messages');
  try {
    const messages = await db.fetchMessages(room.type, room.id, 100);

    box.innerHTML = '';
    if (!messages.length) {
      box.innerHTML = `
        <div style="text-align:center;color:#9ca3af;padding:40px 20px;">
          <div style="font-size:2rem;margin-bottom:8px;">💬</div>
          Пока нет сообщений.
        </div>`;
      return;
    }

    messages.forEach(m => {
      box.appendChild(makeTeacherMessageEl(m));
    });
    box.scrollTop = box.scrollHeight;
  } catch (e) {
    console.error('Ошибка загрузки:', e);
    box.innerHTML = `<div style="color:#ef4444;padding:20px;">Ошибка: ${e.message}</div>`;
  }
}

function makeTeacherMessageEl(msg) {
  const isTeacher = msg.author_type === 'teacher';
  const isDeleted = msg.is_deleted;

  const wrapper = el('div', {
    style: `display:flex;flex-direction:column;
            align-items:${isTeacher ? 'flex-end' : 'flex-start'};
            max-width:85%;${isTeacher ? 'align-self:flex-end;' : 'align-self:flex-start;'}
            ${isDeleted ? 'opacity:0.5;' : ''}`,
  });

  const name = el('div', {
    style: 'font-size:0.75rem;color:#9ca3af;margin-bottom:3px;padding:0 8px;',
  }, (isTeacher ? `👨‍🏫 ${msg.author_name}` : `👤 ${msg.author_name}`)
     + (isDeleted ? ' 🗑️ (удалено)' : ''));
  wrapper.appendChild(name);

  const bubble = el('div', {
    style: `background:${isDeleted ? '#f3f4f6' : (isTeacher ? '#4f46e5' : '#fff')};
            color:${isDeleted ? '#9ca3af' : (isTeacher ? '#fff' : '#1f2937')};
            padding:10px 14px;
            border-radius:16px;
            ${isTeacher ? 'border-bottom-right-radius:4px;' : 'border-bottom-left-radius:4px;'}
            font-size:0.95rem;
            line-height:1.4;
            word-break:break-word;
            white-space:pre-wrap;
            box-shadow:0 1px 3px rgba(0,0,0,.08);
            ${isDeleted ? 'text-decoration:line-through;' : ''}
            ${!isTeacher && !isDeleted ? 'border-left:3px solid #f59e0b;' : ''}`,
  }, msg.text);
  wrapper.appendChild(bubble);

  const footer = el('div', {
    style: 'display:flex;gap:8px;align-items:center;font-size:0.7rem;color:#9ca3af;margin-top:3px;padding:0 8px;',
  });

  footer.appendChild(el('span', {},
    new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })));

  if (msg.edited_at) {
    footer.appendChild(el('span', { style: 'font-style:italic;' }, '(изменено)'));
  }

  if (isDeleted) {
    footer.appendChild(el('span', {
      style: 'cursor:pointer;color:#22c55e;font-size:0.75rem;',
      title: 'Восстановить',
      onclick: async () => {
        if (!confirm('Восстановить это сообщение?')) return;
        try {
          await db.restoreMessage(msg.id);
          const room = chatRooms[currentChatRoom];
          if (room) loadTeacherMessages(room);
        } catch (e) {
          alert('Ошибка: ' + e.message);
        }
      },
    }, '♻️'));
  } else {
    footer.appendChild(el('span', {
      style: 'cursor:pointer;color:#ef4444;font-size:0.75rem;',
      title: 'Удалить сообщение',
      onclick: async () => {
        if (!confirm('Удалить это сообщение?')) return;
        try {
          await db.deleteMessage(msg.id);
          const room = chatRooms[currentChatRoom];
          if (room) loadTeacherMessages(room);
        } catch (e) {
          alert('Ошибка: ' + e.message);
        }
      },
    }, '🗑️'));
  }

  wrapper.appendChild(footer);
  return wrapper;
}

async function sendTeacherMsg() {
  const input = document.getElementById('teacher-chat-input');
  const text = input.value.trim();
  if (!text) return;

  const room = chatRooms[currentChatRoom];
  if (!room) return;

  input.disabled = true;
  try {
    const teacherName = currentUser?.user_metadata?.full_name || currentUser?.email || 'Учитель';
    await db.sendTeacherMessage(room.type, room.id, text, teacherName);
    input.value = '';
    input.style.height = 'auto';
  } catch (e) {
    alert('Ошибка отправки: ' + e.message);
  } finally {
    input.disabled = false;
    input.focus();
  }
}

function setupTeacherRealtime(room) {
  if (chatChannel) {
    db.unsubscribeFromMessages(chatChannel);
    chatChannel = null;
  }

  chatChannel = db.subscribeToMessages(room.type, room.id, (newMsg) => {
    if (room.type === 'global' && newMsg.room_type !== 'global') return;
    if (room.type === 'group' && newMsg.room_id !== room.id) return;
    if (newMsg.is_deleted) return;

    const box = document.getElementById('teacher-messages');
    if (!box) return;

    loadTeacherMessages(room);
  });
}

// ============================================
// ДОМАШКИ (для учителя)
// ============================================
async function renderHomework() {
  const root = document.getElementById('tab-homework');
  root.innerHTML = '';

  root.appendChild(el('p', {
    style: 'color:#666;margin-bottom:16px;',
  }, '📚 Домашки. Создавай задания — ученики отмечаются, ты ставишь баллы (0-10).'));

  root.appendChild(el('button', {
    style: 'background:#22c55e;color:#fff;padding:12px 20px;border:none;border-radius:12px;font-size:1rem;cursor:pointer;margin-bottom:16px;',
    onclick: () => openHomeworkForm(),
  }, '➕ Создать домашку'));

  const listBox = el('div', { id: 'homework-list' });
  listBox.appendChild(el('p', {}, 'Загружаю...'));
  root.appendChild(listBox);

  try {
    const { data: hwList, error } = await supabase
      .from('homework')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    listBox.innerHTML = '';

    if (!hwList.length) {
      listBox.innerHTML = '<p>😕 Пока нет домашек.</p>';
      return;
    }

    for (const hw of hwList) {
      listBox.appendChild(await makeHomeworkCard(hw));
    }
  } catch (e) {
    console.error('Ошибка:', e);
    listBox.innerHTML = `<p style="color:#ef4444;">Ошибка: ${e.message}</p>`;
  }
}

async function makeHomeworkCard(hw) {
  const card = el('div', {
    style: `background:#fff;padding:16px;border-radius:12px;
            box-shadow:0 2px 8px rgba(0,0,0,.08);margin-bottom:16px;
            border-left:5px solid #4f46e5;`,
  });

  const header = el('div', {
    style: 'display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:12px;',
  });

  const info = el('div', { style: 'flex:1;' });
  info.appendChild(el('div', {
    style: 'font-weight:bold;font-size:1.1rem;color:#4f46e5;',
  }, '📚 ' + hw.title));
  if (hw.description) {
    info.appendChild(el('div', {
      style: 'font-size:0.95rem;color:#4f46e5;margin-top:4px;white-space:pre-wrap;',
    }, hw.description));
  }
  if (hw.due_date) {
    info.appendChild(el('div', {
      style: 'font-size:0.85rem;color:#9ca3af;margin-top:6px;',
    }, `📅 Срок: ${new Date(hw.due_date).toLocaleDateString('ru-RU')}`));
  }
  header.appendChild(info);

  const delBtn = el('button', {
    style: 'background:#ef4444;color:#fff;border:none;padding:6px 10px;border-radius:8px;cursor:pointer;font-size:0.9rem;',
    onclick: async () => {
      if (!confirm(`Удалить домашку «${hw.title}»? Все сдачи тоже удалятся.`)) return;
  const { error } = await supabase.from('homework').delete().eq('id', hw.id);
      if (error) { alert('Ошибка: ' + error.message); return; }
      toast('Удалено', 'ok');
      renderHomework();
    },
  }, '🗑️');
  header.appendChild(delBtn);

  card.appendChild(header);

  const submissionsBox = el('div', {
    style: 'background:#f9fafb;border-radius:10px;padding:12px;',
  });
  submissionsBox.appendChild(el('div', {
    style: 'font-weight:bold;color:#4f46e5;font-size:0.95rem;margin-bottom:10px;',
  }, '👥 Сдачи учеников'));

  const { data: submissions } = await supabase
    .from('homework_submissions')
    .select('*')
    .eq('homework_id', hw.id);

    // Файлы, прикреплённые учителем
  const { data: teacherFiles } = await supabase
    .from('homework_files')
    .select('*')
    .eq('homework_id', hw.id)
    .eq('is_teacher_file', true);

    const subMap = {};
  (submissions || []).forEach(s => subMap[s.student_id] = s);

  // Все активные ученики группы
  const allStudents = studentsCache.filter(s => s.is_active);

  // Разделяем: кто сдал и кто нет
  const submittedStudents = allStudents.filter(s => subMap[s.id]);
  const notSubmittedCount = allStudents.length - submittedStudents.length;

  // Обновляем заголовок блока
  submissionsBox.innerHTML = '';
  submissionsBox.appendChild(el('div', {
    style: 'font-weight:bold;color:#4f46e5;font-size:0.95rem;margin-bottom:10px;',
  }, `👥 Сдали: ${submittedStudents.length}${notSubmittedCount > 0 ? ` · не сдало: ${notSubmittedCount}` : ''}`));

  if (!allStudents.length) {
    submissionsBox.appendChild(el('p', { style: 'color:#9ca3af;' }, 'Нет активных учеников'));
  } else if (!submittedStudents.length) {
    submissionsBox.appendChild(el('p', {
      style: 'color:#9ca3af;font-size:0.9rem;text-align:center;padding:12px;',
    }, '😕 Пока никто не сдал'));
  } else {
    // Сортируем: сначала проверенные, потом ждущие
    submittedStudents.sort((a, b) => {
      const sa = subMap[a.id], sb = subMap[b.id];
      if (sa.is_approved && !sb.is_approved) return -1;
      if (!sa.is_approved && sb.is_approved) return 1;
      return a.full_name.localeCompare(b.full_name);
    });

    for (const student of submittedStudents) {
      const sub = subMap[student.id];
      submissionsBox.appendChild(await makeStudentSubmissionRow(hw, student, sub));
    }
  }

  card.appendChild(submissionsBox);

    // Блок материалов от учителя
  if (teacherFiles && teacherFiles.length) {
    const tFilesBox = el('div', {
      style: 'background:#eef2ff;border-radius:10px;padding:12px;margin-top:12px;',
    });
    tFilesBox.appendChild(el('div', {
      style: 'font-weight:bold;color:#4f46e5;font-size:0.95rem;margin-bottom:10px;',
    }, `📚 Материалы (${teacherFiles.length})`));

    for (const f of teacherFiles) {
      const row = el('div', {
        style: 'display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 10px;background:#fff;border-radius:8px;margin-bottom:6px;',
      });

      row.appendChild(el('div', {
        style: 'font-size:0.9rem;flex:1;',
      }, `📄 ${f.file_name}`));

      const btnBox = el('div', { style: 'display:flex;gap:6px;' });

      btnBox.appendChild(el('button', {
        style: 'background:#4f46e5;color:#fff;border:none;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:0.85rem;',
        onclick: async () => {
          try {
            const url = await db.getFileUrl(f.file_path);
            window.open(url, '_blank');
          } catch (e) {
            alert('Ошибка: ' + e.message);
          }
        },
      }, '📥 Скачать'));

      btnBox.appendChild(el('button', {
        style: 'background:#ef4444;color:#fff;border:none;padding:6px 10px;border-radius:8px;cursor:pointer;font-size:0.85rem;',
        onclick: async () => {
          if (!confirm(`Удалить файл «${f.file_name}»?`)) return;
          try {
            await db.deleteHomeworkFile(f.id, f.file_path);
            toast('Удалено', 'ok');
            renderHomework();
          } catch (e) {
            alert('Ошибка: ' + e.message);
          }
        },
      }, '🗑️'));

      row.appendChild(btnBox);
      tFilesBox.appendChild(row);
    }

    card.appendChild(tFilesBox);
  }

  return card;
}

async function makeStudentSubmissionRow(hw, student, submission) {
  const row = el('div', {
    style: `display:flex;justify-content:space-between;align-items:center;gap:8px;
            padding:8px 10px;background:#fff;border-radius:8px;margin-bottom:6px;`,
  });

  const info = el('div', { style: 'flex:1;' });
  info.appendChild(el('div', {
    style: 'font-weight:bold;font-size:0.9rem;',
  }, student.full_name));

  if (submission) {
    if (submission.is_approved) {
      info.appendChild(el('div', {
        style: 'font-size:0.8rem;color:#22c55e;',
      }, `✅ Принято · ${submission.score}/10`));
    } else {
      info.appendChild(el('div', {
        style: 'font-size:0.8rem;color:#f59e0b;',
      }, '⏳ Сдал, ждёт проверки'));
    }
  } else {
    info.appendChild(el('div', {
      style: 'font-size:0.8rem;color:#9ca3af;',
    }, '— не сдал'));
  }

  // Загружаем файлы ученика (только если есть сдача)
  if (submission) {
    try {
      const { data: files } = await supabase
        .from('homework_files')
        .select('*')
        .eq('homework_id', hw.id)
        .eq('student_id', student.id);

      if (files && files.length) {
        const filesBtn = el('button', {
          style: 'background:#4f46e5;color:#fff;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:0.8rem;margin-top:4px;',
          onclick: () => showFilesModal(files, student.full_name),
        }, `📎 ${files.length} файл(ов)`);
        info.appendChild(filesBtn);
      }
    } catch (e) {
      console.error('Ошибка файлов:', e);
    }
  }

  row.appendChild(info);

  const btnBox = el('div', { style: 'display:flex;gap:6px;align-items:center;' });

  btnBox.appendChild(el('button', {
    style: `background:${submission?.is_approved ? '#f59e0b' : '#22c55e'};color:#fff;border:none;
            padding:6px 12px;border-radius:8px;cursor:pointer;font-size:0.85rem;`,
    onclick: async () => {
      const currentScore = submission?.score ?? '';
      const scoreStr = prompt(`Балл для ${student.full_name} (0-10):`, currentScore);
      if (scoreStr === null) return;

      const score = parseInt(scoreStr, 10);
      if (isNaN(score) || score < 0 || score > 10) {
        alert('Введи число от 0 до 10');
        return;
      }

      try {
        const teacherName = currentUser?.user_metadata?.full_name || currentUser?.email || 'Учитель';
        const { error } = await supabase
          .from('homework_submissions')
          .upsert({
            homework_id: hw.id,
            student_id: student.id,
            score: score,
            is_submitted: true,
            is_approved: true,
            approved_by: teacherName,
            approved_at: new Date().toISOString(),
          }, { onConflict: 'homework_id,student_id' });

        if (error) throw error;
        toast('Балл выставлен! ✅', 'ok');
        renderHomework();
      } catch (e) {
        alert('Ошибка: ' + e.message);
      }
    },
  }, submission?.is_approved ? '✏️ Изменить' : '✅ Поставить балл'));

  if (submission) {
    btnBox.appendChild(el('button', {
      style: 'background:#ef4444;color:#fff;border:none;padding:6px 10px;border-radius:8px;cursor:pointer;font-size:0.85rem;',
      onclick: async () => {
        if (!confirm(`Удалить сдачу ${student.full_name}?`)) return;
        const { error } = await supabase
          .from('homework_submissions')
          .delete()
          .eq('id', submission.id);
        if (error) { alert('Ошибка: ' + error.message); return; }
        toast('Удалено', 'ok');
        renderHomework();
      },
    }, '🗑️'));
  }

  row.appendChild(btnBox);
  return row;
}

async function showFilesModal(files, studentName) {
  const modal = el('div', {
    style: `position:fixed;inset:0;background:rgba(0,0,0,.6);
            z-index:9999;display:flex;align-items:center;justify-content:center;
            padding:16px;`,
  });

  const box = el('div', {
    style: `background:#fff;border-radius:20px;padding:24px;
            max-width:500px;width:100%;`,
  });

  box.appendChild(el('h3', {
    style: 'color:#4f46e5;margin-bottom:16px;',
  }, `📎 Файлы от ${studentName}`));

  for (const f of files) {
    const row = el('div', {
      style: `display:flex;justify-content:space-between;align-items:center;
              padding:10px;background:#f9fafb;border-radius:10px;margin-bottom:8px;`,
    });

    row.appendChild(el('div', {
      style: 'font-size:0.9rem;flex:1;',
    }, `📄 ${f.file_name}`));

    row.appendChild(el('button', {
      style: 'background:#4f46e5;color:#fff;border:none;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:0.85rem;',
      onclick: async () => {
        try {
          const url = await db.getFileUrl(f.file_path);
          window.open(url, '_blank');
        } catch (e) {
          alert('Ошибка: ' + e.message);
        }
      },
    }, '📥 Скачать'));

    box.appendChild(row);
  }

  box.appendChild(el('button', {
    style: 'background:#e5e7eb;color:#1f2937;border:none;padding:12px 24px;border-radius:12px;cursor:pointer;width:100%;margin-top:8px;',
    onclick: () => modal.remove(),
  }, 'Закрыть'));

  modal.appendChild(box);
  document.body.appendChild(modal);

  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
}

function openHomeworkForm() {
  const form = el('div', { style: 'display:flex;flex-direction:column;gap:10px;' });

  const titleInput = el('input', {
    placeholder: 'Название домашки *',
    style: 'padding:10px;border-radius:8px;border:2px solid #e5e7eb;font-size:1rem;',
  });

  const descInput = el('textarea', {
    placeholder: 'Описание / что сделать',
    style: 'padding:10px;border-radius:8px;border:2px solid #e5e7eb;font-size:1rem;min-height:100px;',
  });

  const dueInput = el('input', {
    type: 'date',
    style: 'padding:10px;border-radius:8px;border:2px solid #e5e7eb;font-size:1rem;',
  });

  // Блок прикрепления файлов
  const filesBox = el('div', {
    style: 'background:#f9fafb;border-radius:10px;padding:12px;',
  });
  filesBox.appendChild(el('div', {
    style: 'font-weight:bold;color:#4f46e5;font-size:0.95rem;margin-bottom:8px;',
  }, '📎 Материалы к заданию (необязательно)'));

  const fileInput = el('input', {
    type: 'file',
    multiple: true,
    accept: '*/*',
    style: 'display:none;',
  });

  const selectedFilesDiv = el('div', {
    style: 'font-size:0.9rem;color:#666;margin-bottom:8px;',
  });

  let selectedFiles = [];

  const chooseBtn = el('button', {
    type: 'button',
    style: 'background:#4f46e5;color:#fff;border:none;padding:10px 16px;border-radius:8px;cursor:pointer;font-size:0.95rem;width:100%;',
    onclick: () => fileInput.click(),
  }, '📁 Выбрать файлы');

  fileInput.onchange = () => {
    const files = Array.from(fileInput.files);
    if (selectedFiles.length + files.length > 5) {
      alert('Максимум 5 файлов');
      return;
    }
    for (const f of files) {
      if (f.size > 50 * 1024 * 1024) {
        alert('Файл слишком большой (макс 50 МБ): ' + f.name);
        return;
      }
      selectedFiles.push(f);
    }
    renderSelected();
  };

  function renderSelected() {
    selectedFilesDiv.innerHTML = '';
    if (!selectedFiles.length) return;
    selectedFiles.forEach((f, idx) => {
      const row = el('div', {
        style: 'display:flex;justify-content:space-between;align-items:center;padding:4px 0;',
      });
      row.appendChild(el('span', {}, `📄 ${f.name} (${(f.size / 1024).toFixed(1)} КБ)`));
      row.appendChild(el('span', {
        style: 'cursor:pointer;color:#ef4444;font-weight:bold;',
        onclick: () => {
          selectedFiles.splice(idx, 1);
          renderSelected();
        },
      }, '✕'));
      selectedFilesDiv.appendChild(row);
    });
  }

  filesBox.appendChild(fileInput);
  filesBox.appendChild(chooseBtn);
  filesBox.appendChild(selectedFilesDiv);

  form.appendChild(el('label', {}, 'Название *'));
  form.appendChild(titleInput);
  form.appendChild(el('label', {}, 'Описание'));
  form.appendChild(descInput);
  form.appendChild(el('label', {}, 'Срок сдачи'));
  form.appendChild(dueInput);
  form.appendChild(filesBox);

  openModal('📚 Новая домашка', form, async () => {
    if (!titleInput.value.trim()) throw new Error('Введи название');

    // 1. Создаём домашку
    const { data: newHw, error } = await supabase
      .from('homework')
      .insert({
        title: titleInput.value.trim(),
        description: descInput.value.trim() || null,
        due_date: dueInput.value || null,
      })
      .select()
      .single();

    if (error) throw error;

    // 2. Загружаем файлы (если выбраны)
    if (selectedFiles.length) {
      for (const file of selectedFiles) {
        await db.uploadTeacherHomeworkFile(file, newHw.id);
      }
    }

    toast('Домашка создана! 📚', 'ok');
    renderHomework();
  });
}

// ============================================
// РАСПИСАНИЕ НА НЕДЕЛЮ
// ============================================
let currentWeekStart = null;

function getMondayOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function renderSchedule() {
  const root = document.getElementById('tab-schedule');
  root.innerHTML = '';

  if (!currentWeekStart) {
    currentWeekStart = getMondayOfWeek(new Date());
  }

  // Заголовок
  const header = el('div', {
    style: 'display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap;',
  });

  header.appendChild(el('button', {
    style: 'background:#4f46e5;color:#fff;padding:10px 16px;border:none;border-radius:10px;cursor:pointer;font-size:0.95rem;',
    onclick: () => {
      currentWeekStart.setDate(currentWeekStart.getDate() - 7);
      renderSchedule();
    },
  }, '← Прошлая'));

  const friday = new Date(currentWeekStart);
  friday.setDate(friday.getDate() + 4);

  const dateStr = `${currentWeekStart.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} — ${friday.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;

  header.appendChild(el('div', {
    style: 'font-weight:bold;font-size:1.1rem;color:#4f46e5;text-align:center;flex:1;',
  }, `📅 ${dateStr}`));

  header.appendChild(el('button', {
    style: 'background:#4f46e5;color:#fff;padding:10px 16px;border:none;border-radius:10px;cursor:pointer;font-size:0.95rem;',
    onclick: () => {
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
      renderSchedule();
    },
  }, 'Следующая →'));

  const mondayThisWeek = getMondayOfWeek(new Date());
  if (currentWeekStart.getTime() !== mondayThisWeek.getTime()) {
    header.appendChild(el('button', {
      style: 'background:#22c55e;color:#fff;padding:10px 16px;border:none;border-radius:10px;cursor:pointer;font-size:0.95rem;',
      onclick: () => {
        currentWeekStart = getMondayOfWeek(new Date());
        renderSchedule();
      },
    }, '📍 На текущую'));
  }

  root.appendChild(header);

  const allLessons = await db.fetchLessons();

  // ЖЁСТКО: 5 дней, offset ОТ 0
  const days = [
    { name: 'Пн', offset: 0 },
    { name: 'Вт', offset: 1 },
    { name: 'Ср', offset: 2 },
    { name: 'Чт', offset: 3 },
    { name: 'Пт', offset: 4 },
  ];

  const todayStr = formatLocalDate(new Date());

  const table = el('div', {
    style: 'overflow-x:auto;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08);',
  });

  // Шапка
  const headerRow = el('div', {
    style: 'display:grid;grid-template-columns:120px repeat(5, 1fr);gap:1px;background:#e5e7eb;min-width:800px;',
  });

  headerRow.appendChild(el('div', {
    style: 'padding:12px;background:#4f46e5;color:#fff;font-weight:bold;',
  }, 'Группа'));

  days.forEach(day => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + day.offset);
    const dateStr = formatLocalDate(d);
    const isToday = dateStr === todayStr;

    headerRow.appendChild(el('div', {
      style: `padding:12px;background:${isToday ? '#22c55e' : '#4f46e5'};color:#fff;font-weight:bold;text-align:center;`,
    }, `${day.name} ${d.getDate()}`));
  });

  table.appendChild(headerRow);

  // Строки по группам
  groupsCache.forEach(group => {
    const row = el('div', {
      style: 'display:grid;grid-template-columns:120px repeat(5, 1fr);gap:1px;background:#e5e7eb;min-width:800px;',
    });

    row.appendChild(el('div', {
      style: 'padding:12px;background:#f9fafb;font-weight:bold;font-size:0.9rem;',
    }, group.name));

    days.forEach(day => {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() + day.offset);
      const dateStr = formatLocalDate(d);

      const dayLessons = allLessons.filter(l =>
        l.group_id === group.id && l.date === dateStr
      );

      const cell = el('div', {
        style: 'padding:8px;background:#fff;min-height:60px;font-size:0.85rem;',
      });

      if (dayLessons.length) {
        dayLessons.forEach(l => {
          cell.appendChild(el('div', {
            style: 'background:#eef2ff;border-left:3px solid #4f46e5;padding:6px 8px;border-radius:6px;margin-bottom:4px;',
          }, l.topic || '— без темы —'));
        });
      }

      row.appendChild(cell);
    });

    table.appendChild(row);
  });

  root.appendChild(table);

  // Отладка
  console.log('📅 currentWeekStart:', formatLocalDate(currentWeekStart));
  console.log('📅 Дни недели:', days.map(d => {
    const dd = new Date(currentWeekStart);
    dd.setDate(dd.getDate() + d.offset);
    return `${d.name}=${formatLocalDate(dd)}`;
  }));
  console.log('📅 Занятий 21.09:', allLessons.filter(l => l.date === '2026-09-21').length);
}

// Экспорт для отладки
window.__app = {
  groupsCache,
  studentsCache,
  lessonsCache,
  renderJournal,
  renderReports,
  renderQRCodes,
  renderPasses,
  renderRequests,
  renderAnnouncements,
  renderChats,
  renderHomework,
  renderSchedule,
};