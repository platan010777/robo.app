import { supabase } from './db.js';
import * as db from './db.js';
import { el, toast, openModal, confirmDialog } from './ui.js';
import './export.js';

// ============================================
// НАВИГАЦИЯ ПО ВКЛАДКАМ
// ============================================
document.querySelectorAll('.tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');

    // Подгружаем данные при переключении
    if (btn.dataset.tab === 'students') renderStudents();
    if (btn.dataset.tab === 'lessons') renderLessons();
    if (btn.dataset.tab === 'settings') renderGroups();
    if (btn.dataset.tab === 'journal') renderJournal();
    if (btn.dataset.tab === 'reports') renderReports();
  });
});

// ============================================
// SERVICE WORKER
// ============================================
if ('serviceWorker' in navigator) {
   navigator.serviceWorker.register('./sw.js').catch(console.error);
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
    value: lesson?.teacher_name || (currentUser?.email || ''),
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
// ЭКСПОРТ ДЛЯ ОТЛАДКИ
// ============================================
window.__app = { 
  groupsCache, 
  studentsCache, 
  lessonsCache, 
  renderJournal, 
  renderReports,
  renderQRCodes,
  renderPasses,
};
