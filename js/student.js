// Страница ученика — публичный доступ
// Открывается: student.html?group=UUID  ИЛИ  student.html?token=XXX

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import * as db from './db.js';

// ⚠️ ВСТАВЬ СВОИ ЗНАЧЕНИЯ ИЗ SUPABASE
const SUPABASE_URL = 'https://wyldhqsbgyhqcdmsjeud.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5bGRocXNiZ3locWNkbXNqZXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0OTA4ODcsImV4cCI6MjEwNTA2Njg4N30.haCb0Ihyfq3UxJ02cP-iOQ-kF35Gbd5D6hzZwMt5hSw';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabase = supabase;

// Глобальные переменные
let chatState = {
  currentRoom: 'group',
  groupId: null,
  studentName: null,
  channel: null,
  messages: [],
};

let myRequests = {};
let myStudentId = null;

// Получаем параметры из URL
const params = new URLSearchParams(window.location.search);
const groupId = params.get('group');
const studentToken = params.get('token');

// ============================================
// РАСПИСАНИЕ НА НЕДЕЛЮ (ученик) — ОБЪЯВЛЯЕМ ЗДЕСЬ, ВЫШЕ
// ============================================
async function loadScheduleTab() {
  const container = document.getElementById('schedule-content');
  if (!container) return;

  container.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:40px;">Загружаю...</p>';

  try {
    if (!chatState.groupId) {
      container.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:40px;">Группа не найдена.</p>';
      return;
    }

    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(monday.getDate() + diff);
    monday.setHours(0, 0, 0, 0);

    const weekEnd = new Date(monday);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const { data: lessons, error } = await supabase
      .from('lessons')
      .select('id, date, topic, teacher_name')
      .eq('group_id', chatState.groupId)
      .gte('date', monday.toISOString().slice(0, 10))
      .lte('date', weekEnd.toISOString().slice(0, 10))
      .order('date', { ascending: true });

    if (error) throw error;

    container.innerHTML = '';

    const days = [
      { key: 1, name: 'Понедельник' },
      { key: 2, name: 'Вторник' },
      { key: 3, name: 'Среда' },
      { key: 4, name: 'Четверг' },
      { key: 5, name: 'Пятница' },
      { key: 6, name: 'Суббота' },
    ];

    let hasAny = false;

    days.forEach(dItem => {
      const d = new Date(monday);
      d.setDate(d.getDate() + dItem.key - 1);
      const dateStr = d.toISOString().slice(0, 10);
      const isToday = d.toDateString() === new Date().toDateString();

      const dayLessons = (lessons || []).filter(l => l.date === dateStr);
      if (!dayLessons.length) return;

      hasAny = true;

      const dayHeader = document.createElement('div');
      dayHeader.style.cssText = `
        font-weight:bold;
        font-size:1.05rem;
        color:${isToday ? '#16a34a' : '#4f46e5'};
        margin:16px 0 8px;
        display:flex;
        align-items:center;
        gap:8px;
      `;
      dayHeader.innerHTML = `
        📅 ${dItem.name} ${d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
        ${isToday ? '<span style="background:#22c55e;color:#fff;padding:2px 8px;border-radius:999px;font-size:0.75rem;">СЕГОДНЯ</span>' : ''}
      `;
      container.appendChild(dayHeader);

      dayLessons.forEach(l => {
        const card = document.createElement('div');
        card.style.cssText = `
          background:${isToday ? '#f0fdf4' : '#fafafa'};
          padding:14px;
          border-radius:12px;
          box-shadow:0 2px 8px rgba(0,0,0,.08);
          margin-bottom:8px;
          border-left:4px solid ${isToday ? '#22c55e' : '#4f46e5'};
        `;
        card.innerHTML = `
          <div style="font-size:1rem;color:#1f2937;font-weight:bold;margin-bottom:4px;">
            📖 ${l.topic || '— без темы —'}
          </div>
          ${l.teacher_name && !l.teacher_name.includes('@') ? `<div style="font-size:0.85rem;color:#6b7280;">👨‍🏫 ${l.teacher_name}</div>` : ''}
        `;
        container.appendChild(card);
      });
    });

    if (!hasAny) {
      container.innerHTML = `
        <div style="text-align:center;color:#9ca3af;padding:40px 20px;">
          <div style="font-size:2rem;margin-bottom:8px;">📭</div>
          На этой неделе занятий нет.<br>
          <small>Отдыхай!</small>
        </div>
      `;
    }
  } catch (e) {
    console.error('Ошибка расписания:', e);
    container.innerHTML = `<p style="color:#ef4444;text-align:center;padding:20px;">Ошибка: ${e.message}</p>`;
  }
}

// ============================================
// ГЛАВНАЯ ЗАГРУЗКА
// ============================================
async function loadLessons() {
  if (groupId) { await loadByGroup(); return; }
  if (studentToken) { await loadByToken(); return; }

  document.getElementById('lessons-list').innerHTML = `
    <div class="error-state">
      <span class="robot-emoji">🤖</span>
      Группа не указана.<br>
      <small>Отсканируй QR-код ещё раз.</small>
    </div>`;
}

async function loadByGroup() {
  try {
    const { data: group, error } = await supabase
      .from('groups')
      .select('name, description')
      .eq('id', groupId)
      .single();

    if (error || !group) {
      document.getElementById('lessons-list').innerHTML = `
        <div class="error-state">
          <span class="robot-emoji">😕</span>
          Группа не найдена.
        </div>`;
      return;
    }

    document.getElementById('group-info').innerHTML =
      `<div class="group-badge">🏫 ${group.name}</div>`;

    const { data: lessons } = await supabase
      .from('lessons')
      .select('id, date, topic, teacher_name')
      .eq('group_id', groupId)
      .order('date', { ascending: false });

    renderLessonsList(lessons || []);
  } catch (e) {
    console.error('Ошибка:', e);
  }
}

async function loadByToken() {
  try {
    const { data: studentData, error } = await supabase
      .rpc('get_student_by_token', { p_token: studentToken });

    if (error || !studentData || !studentData.length) {
      document.getElementById('lessons-list').innerHTML = `
        <div class="error-state">
          <span class="robot-emoji">😕</span>
          Пропуск не найден.
        </div>`;
      return;
    }

    const student = studentData[0];
    myStudentId = student.student_id;
    chatState.groupId = student.group_id;

    document.getElementById('group-info').innerHTML = `
      <div class="group-badge">👤 ${student.full_name}</div>
      ${student.group_name ? `<div style="font-size:0.95rem;color:#666;margin-top:8px;">🏫 ${student.group_name}</div>` : ''}
    `;

    const menuInfo = document.getElementById('student-menu-info');
    if (menuInfo) {
      menuInfo.innerHTML = `👤 ${student.full_name}<br>🏫 ${student.group_name || 'без группы'}`;
    }

    initStudentMenu();

    await loadMainTab(student);
    await loadMyHomework();
    await loadGlobalTop();
    await loadMyRequests();
    await loadMyAnnouncements();
    await loadMyComments();

    const { data: lessons } = await supabase
      .from('lessons')
      .select('id, date, topic, teacher_name')
      .eq('group_id', student.group_id)
      .order('date', { ascending: false });

    renderLessonsList(lessons || []);

    initChat(student.group_id, student.full_name);
  } catch (e) {
    console.error('Ошибка:', e);
  }
}

// ============================================
// ГЛАВНАЯ ВКЛАДКА
// ============================================
async function loadMainTab(student) {
  const stats = await loadMyAttendance(student.student_id);
  if (stats) {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.innerHTML = '';
      mainContent.appendChild(makeStatsBox(stats));
    }
    const attContent = document.getElementById('attendance-content');
    if (attContent) {
      attContent.innerHTML = '';
      attContent.appendChild(makeStatsBox(stats));
    }
  }
}

async function loadMyAttendanceTab() {
  if (!myStudentId) return;
  const container = document.getElementById('attendance-content');
  if (!container) return;
  const stats = await loadMyAttendance(myStudentId);
  if (stats) {
    container.innerHTML = '';
    container.appendChild(makeStatsBox(stats));
  }
}

async function loadLessonsTab() {
  if (!chatState.groupId) return;
  const container = document.getElementById('lessons-list');
  if (!container) return;
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, date, topic, teacher_name')
    .eq('group_id', chatState.groupId)
    .order('date', { ascending: false });
  renderLessonsList(lessons || []);
}

// ============================================
// ВКЛАДКА "МОЙ ДОСТУП" (ученик)
// ============================================
async function loadAccessTab() {
  const container = document.getElementById('access-content');
  if (!container) return;

  container.innerHTML = '';

  const fullUrl = window.location.href;

  // === БЛОК: QR-КОД ===
  const qrBox = document.createElement('div');
  qrBox.style.cssText = `
    background: #fff;
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 16px;
    box-shadow: 0 2px 12px rgba(0,0,0,.08);
    text-align: center;
  `;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(fullUrl)}&color=4f46e5&bgcolor=ffffff&margin=10`;

  qrBox.innerHTML = `
    <div style="font-size:1.1rem;font-weight:bold;color:#4f46e5;margin-bottom:12px;">
      📱 Мой QR-код
    </div>
    <div style="font-size:0.85rem;color:#6b7280;margin-bottom:16px;">
      Покажи этот QR — быстро войти в личный кабинет с телефона
    </div>
    <img src="${qrUrl}" alt="Мой QR-код" style="width:200px;height:200px;border:2px solid #e5e7eb;border-radius:12px;padding:8px;background:#fff;">
  `;

  container.appendChild(qrBox);

  // === БЛОК: КНОПКА "ПОДЕЛИТЬСЯ" ===
  const shareBox = document.createElement('div');
  shareBox.style.cssText = `
    background: linear-gradient(135deg, #eef2ff, #ddd6fe);
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 16px;
    border-left: 5px solid #4f46e5;
  `;

  shareBox.innerHTML = `
    <div style="font-size:1.05rem;font-weight:bold;color:#4f46e5;margin-bottom:8px;">
      📤 Поделиться ссылкой
    </div>
    <div style="font-size:0.85rem;color:#6b7280;margin-bottom:14px;">
      Отправь ссылку себе в Telegram / WhatsApp / Сохранёнки.<br>
      <b>Открой её на компьютере</b> — и работай с удобством.
    </div>
    <button
      id="access-share-btn"
      style="width:100%;background:#4f46e5;color:#fff;border:none;padding:14px 20px;border-radius:12px;cursor:pointer;font-size:1rem;font-weight:bold;"
    >
      📤 Поделиться ссылкой
    </button>
  `;

  container.appendChild(shareBox);

  // === БЛОК: ИНСТРУКЦИЯ ===
  const helpBox = document.createElement('div');
  helpBox.style.cssText = `
    background: #fef3c7;
    border-radius: 16px;
    padding: 16px;
    border-left: 5px solid #f59e0b;
    font-size: 0.9rem;
    color: #92400e;
    line-height: 1.6;
  `;

  helpBox.innerHTML = `
    <div style="font-weight:bold;margin-bottom:8px;">💡 Как работать на ПК</div>
    1. Нажми <b>«📤 Поделиться ссылкой»</b><br>
    2. Отправь её себе в <b>Telegram</b> (или любой мессенджер)<br>
    3. Открой <b>Telegram на компьютере</b><br>
    4. Перейди по ссылке — <b>всё готово!</b>
  `;

  container.appendChild(helpBox);

  // === ОБРАБОТЧИК КНОПКИ ===
  const shareBtn = document.getElementById('access-share-btn');

  if (navigator.share) {
    shareBtn.onclick = async () => {
      try {
        await navigator.share({
          title: 'КЛАСС РОБОТОТЕХНИКИ',
          text: 'Моя ссылка на личный кабинет',
          url: fullUrl,
        });
      } catch (e) {
        // Отмена — не страшно
      }
    };
  } else {
    shareBtn.textContent = '📋 Скопировать ссылку';
    shareBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(fullUrl);
        showStudentToast('📋 Ссылка скопирована!', 'ok');
      } catch (e) {
        const temp = document.createElement('input');
        temp.value = fullUrl;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
        showStudentToast('📋 Ссылка скопирована!', 'ok');
      }
    };
  }
}

// ============================================
// СТАТИСТИКА (карточка)
// ============================================
async function loadMyAttendance(studentId) {
  try {
    const { data, error } = await supabase
      .rpc('get_my_attendance', { p_token: studentToken });
    if (error) throw error;
    if (!data || !data.length) return null;
    return data[0];
  } catch (e) {
    console.error('Ошибка статистики:', e);
    return null;
  }
}

function makeStatsBox(stats) {
  const box = document.createElement('div');
  box.style.cssText = `
    background: linear-gradient(135deg, #4f46e5, #9333ea);
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 20px;
    color: #fff;
    box-shadow: 0 4px 20px rgba(79,70,229,.3);
  `;

  const percent = stats.attendance_percent || 0;
  const rating = stats.rating || 0;

  let emoji = '🏆';
  let message = 'Ты супер!';
  if (percent < 50) { emoji = '😢'; message = 'Надо подтянуться!'; }
  else if (percent < 80) { emoji = '💪'; message = 'Хорошо, но можно лучше!'; }

  box.innerHTML = `
    <div style="font-size:1.1rem;font-weight:bold;margin-bottom:16px;">📊 Моя посещаемость</div>
    <div style="font-size:3rem;font-weight:bold;text-align:center;margin:12px 0;">${percent}%</div>
    <div style="text-align:center;font-size:1.1rem;margin-bottom:16px;">${emoji} ${message}</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;">
      <div style="background:rgba(255,255,255,.2);padding:10px;border-radius:10px;text-align:center;">
        <div style="font-size:1.5rem;">✅</div>
        <div style="font-size:1.3rem;font-weight:bold;">${stats.present}</div>
        <div style="font-size:0.8rem;opacity:.9;">Был</div>
      </div>
      <div style="background:rgba(255,255,255,.2);padding:10px;border-radius:10px;text-align:center;">
        <div style="font-size:1.5rem;">⏰</div>
        <div style="font-size:1.3rem;font-weight:bold;">${stats.late}</div>
        <div style="font-size:0.8rem;opacity:.9;">Опоздал</div>
      </div>
      <div style="background:rgba(255,255,255,.2);padding:10px;border-radius:10px;text-align:center;">
        <div style="font-size:1.5rem;">❌</div>
        <div style="font-size:1.3rem;font-weight:bold;">${stats.absent}</div>
        <div style="font-size:0.8rem;opacity:.9;">Не был</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;">
      <div style="background:rgba(255,255,255,.2);padding:8px;border-radius:10px;text-align:center;">
        <div style="font-size:1.2rem;">📝</div>
        <div style="font-size:1.1rem;font-weight:bold;">${stats.excused}</div>
        <div style="font-size:0.75rem;opacity:.9;">Уваж.</div>
      </div>
      <div style="background:rgba(255,255,255,.2);padding:8px;border-radius:10px;text-align:center;">
        <div style="font-size:1.2rem;">🥱</div>
        <div style="font-size:1.1rem;font-weight:bold;">${stats.idle}</div>
        <div style="font-size:0.75rem;opacity:.9;">Безд.</div>
      </div>
      <div style="background:rgba(255,255,255,.2);padding:8px;border-radius:10px;text-align:center;">
        <div style="font-size:1.2rem;">🤬</div>
        <div style="font-size:1.1rem;font-weight:bold;">${stats.sabotage}</div>
        <div style="font-size:0.75rem;opacity:.9;">Сабот.</div>
      </div>
    </div>
    <div style="background:rgba(255,255,255,.25);padding:12px;border-radius:12px;text-align:center;">
      <div style="font-size:0.9rem;opacity:.9;">🏆 Рейтинг</div>
      <div style="font-size:1.8rem;font-weight:bold;">${rating} очков</div>
      <div style="font-size:0.75rem;opacity:.8;">Всего занятий: ${stats.total_lessons}</div>
    </div>
  `;
  return box;
}

// ============================================
// ЗАНЯТИЯ
// ============================================
function renderLessonsList(lessons) {
  const list = document.getElementById('lessons-list');
  if (!list) return;

  if (!lessons || !lessons.length) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="robot-emoji">📭</span>
        Пока нет занятий.
      </div>`;
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const future = lessons.filter(l => l.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = lessons.filter(l => l.date < today).sort((a, b) => b.date.localeCompare(a.date));

  list.innerHTML = '';

  if (future.length) {
    list.appendChild(makeSectionTitle('📅 Ближайшие занятия'));
    future.forEach(l => list.appendChild(makeLessonCard(l, false)));
  }
  if (past.length) {
    list.appendChild(makeSectionTitle('📚 Прошедшие занятия'));
    past.forEach(l => list.appendChild(makeLessonCard(l, true)));
  }
}

function makeSectionTitle(text) {
  const div = document.createElement('div');
  div.className = 'section-title';
  div.textContent = text;
  return div;
}

function makeLessonCard(lesson, isPast) {
  const today = new Date().toISOString().slice(0, 10);
  const isToday = lesson.date === today;

  const card = document.createElement('div');
  card.className = 'lesson-card';
  if (isPast) card.classList.add('past');
  if (isToday) card.classList.add('today');

  const date = new Date(lesson.date + 'T00:00:00');
  const dateStr = date.toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric', weekday: 'short',
  });

  const request = myRequests[lesson.id];

  card.innerHTML = `
    <div class="lesson-date">
      📅 ${dateStr}
      ${isToday ? '<span class="today-badge">СЕГОДНЯ</span>' : ''}
    </div>
    <div class="lesson-topic">${lesson.topic || '— без темы —'}</div>
    ${lesson.teacher_name && !lesson.teacher_name.includes('@')
      ? `<div class="lesson-teacher">👨‍🏫 ${lesson.teacher_name}</div>` : ''}
  `;

  if (!isPast && studentToken) {
    const btnBox = document.createElement('div');
    btnBox.style.cssText = 'margin-top:12px;';

    if (request) {
      const si = getStatusInfo(request.status);
      const approvedBadge = request.is_approved
        ? '<span style="background:#22c55e;color:#fff;padding:2px 8px;border-radius:999px;font-size:0.75rem;margin-left:6px;">✅ Подтверждено</span>'
        : '<span style="background:#f59e0b;color:#fff;padding:2px 8px;border-radius:999px;font-size:0.75rem;margin-left:6px;">⏳ На проверке</span>';

      btnBox.innerHTML = `
        <div style="background:${si.color}22;border:2px solid ${si.color};border-radius:12px;padding:10px;text-align:center;">
          <div style="font-size:0.95rem;color:${si.color};font-weight:bold;">
            ${si.emoji} Твоя заявка: ${si.label} ${approvedBadge}
          </div>
          ${request.reason ? `<div style="font-size:0.85rem;color:#666;margin-top:4px;">💬 ${request.reason}</div>` : ''}
          <button class="change-request-btn" style="background:#fff;color:${si.color};border:2px solid ${si.color};padding:6px 12px;border-radius:8px;cursor:pointer;font-size:0.85rem;margin-top:8px;">✏️ Изменить</button>
        </div>
      `;

      btnBox.querySelector('.change-request-btn').onclick = () => {
        delete myRequests[lesson.id];
        const parent = card.parentNode;
        parent.replaceChild(makeLessonCard(lesson, isPast), card);
      };
    } else {
      btnBox.innerHTML = `
        <div style="font-size:0.85rem;color:#666;margin-bottom:8px;">✍️ Отметься заранее:</div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">
          <button data-status="present" style="background:#22c55e;color:#fff;border:none;padding:10px;border-radius:10px;cursor:pointer;font-size:0.9rem;">✅ Буду</button>
          <button data-status="late" style="background:#f59e0b;color:#fff;border:none;padding:10px;border-radius:10px;cursor:pointer;font-size:0.9rem;">⏰ Опоздаю</button>
          <button data-status="excused" style="background:#3b82f6;color:#fff;border:none;padding:10px;border-radius:10px;cursor:pointer;font-size:0.9rem;">📝 Болею</button>
          <button data-status="absent" style="background:#ef4444;color:#fff;border:none;padding:10px;border-radius:10px;cursor:pointer;font-size:0.9rem;">❌ Не смогу</button>
        </div>
      `;

      btnBox.querySelectorAll('button[data-status]').forEach(btn => {
        btn.onclick = async () => {
          const status = btn.dataset.status;
          let reason = null;
          if (status === 'excused' || status === 'absent') {
            reason = prompt(status === 'excused' ? 'Причина?' : 'Почему не сможешь?', '');
            if (reason === null) return;
          }
          const ok = await sendRequest(lesson.id, status, reason);
          if (ok) {
            const parent = card.parentNode;
            parent.replaceChild(makeLessonCard(lesson, isPast), card);
          }
        };
      });
    }
    card.appendChild(btnBox);
  }
  return card;
}

function getStatusInfo(status) {
  const map = {
    present: { label: 'Буду', emoji: '✅', color: '#22c55e' },
    late: { label: 'Опоздаю', emoji: '⏰', color: '#f59e0b' },
    absent: { label: 'Не смогу', emoji: '❌', color: '#ef4444' },
    excused: { label: 'Болею', emoji: '📝', color: '#3b82f6' },
  };
  return map[status] || { label: status, emoji: '❓', color: '#666' };
}

// ============================================
// ДОМАШКИ
// ============================================
async function loadMyHomework() {
  try {
    const { data: hwList, error: hwErr } = await supabase
      .from('homework')
      .select('*')
      .order('created_at', { ascending: false });

    if (hwErr) throw hwErr;

    const container = document.getElementById('homework-content');
    if (!container) return;

    if (!hwList || !hwList.length) {
      container.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:40px;">Пока нет домашек.</p>';
      return;
    }

    if (!myStudentId) return;

    const { data: submissions } = await supabase
      .from('homework_submissions')
      .select('*')
      .eq('student_id', myStudentId);

    const subMap = {};
    (submissions || []).forEach(s => subMap[s.homework_id] = s);

        // Мои файлы
    const { data: myFiles } = await supabase
      .from('homework_files')
      .select('*')
      .eq('student_id', myStudentId);

    // Файлы учителя
    const { data: teacherFiles } = await supabase
      .from('homework_files')
      .select('*')
      .eq('is_teacher_file', true);

    const allFiles = [...(myFiles || []), ...(teacherFiles || [])];

    const filesByHw = {};
    (allFiles || []).forEach(f => {
      if (!filesByHw[f.homework_id]) filesByHw[f.homework_id] = [];
      filesByHw[f.homework_id].push(f);
    });

    container.innerHTML = '';

    hwList.forEach(hw => {
      const sub = subMap[hw.id];
      const files = filesByHw[hw.id] || [];

      const card = document.createElement('div');
      card.style.cssText = `
        background:#fff;
        border-radius:12px;
        padding:14px;
        margin-bottom:10px;
        box-shadow:0 2px 8px rgba(0,0,0,.08);
        border-left:5px solid ${sub?.is_approved ? '#22c55e' : sub ? '#f59e0b' : '#e5e7eb'};
      `;

      let statusHtml = '';
      if (sub?.is_approved) {
        statusHtml = `<div style="margin-top:8px;padding:8px 12px;background:#dcfce7;color:#16a34a;border-radius:8px;font-size:0.9rem;font-weight:bold;">✅ Принято · ${sub.score}/10 баллов</div>`;
      } else if (sub) {
        statusHtml = `<div style="margin-top:8px;padding:8px 12px;background:#fef3c7;color:#92400e;border-radius:8px;font-size:0.9rem;">⏳ На проверке</div>`;
      } else {
        statusHtml = `<button class="hw-submit-btn" style="margin-top:8px;width:100%;background:#4f46e5;color:#fff;border:none;padding:10px;border-radius:8px;cursor:pointer;font-size:0.95rem;font-weight:bold;">📤 Сдать</button>`;
      }

      const teacherFs = files.filter(f => f.is_teacher_file);
      const myFs = files.filter(f => !f.is_teacher_file);

      let filesHtml = '';

      // 📚 Материалы от учителя
      if (teacherFs.length) {
        filesHtml += `
          <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #e5e7eb;">
            <div style="font-size:0.85rem;color:#4f46e5;font-weight:bold;margin-bottom:6px;">📚 Материалы от учителя:</div>
            ${teacherFs.map(f => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:#eef2ff;border-radius:8px;margin-bottom:4px;">
                <span style="font-size:0.85rem;color:#1f2937;flex:1;">📄 ${f.file_name}</span>
                <button class="download-teacher-file-btn" data-path="${f.file_path}" style="background:#4f46e5;color:#fff;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:0.8rem;">📥 Скачать</button>
              </div>
            `).join('')}
          </div>
        `;
      }

      // 📎 Твои файлы (сдачи)
      if (myFs.length) {
        filesHtml += `
          <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #e5e7eb;">
            <div style="font-size:0.8rem;color:#666;margin-bottom:6px;">📎 Твои файлы: ${myFs.length}</div>
            ${myFs.map(f => `<div style="font-size:0.85rem;color:#4f46e5;margin-bottom:4px;">📄 ${f.file_name}</div>`).join('')}
          </div>
        `;
      }

      // Мои файлы (сдачи)
      if (myFs.length) {
        filesHtml += `
          <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #e5e7eb;">
            <div style="font-size:0.8rem;color:#666;margin-bottom:6px;">📎 Твои файлы: ${myFs.length}</div>
            ${myFs.map(f => `<div style="font-size:0.85rem;color:#4f46e5;margin-bottom:4px;">📄 ${f.file_name}</div>`).join('')}
          </div>
        `;
      }

      card.innerHTML = `
        <div style="font-weight:bold;font-size:1rem;color:#4f46e5;">📚 ${hw.title}</div>
        ${hw.description ? `<div style="font-size:0.9rem;color:#6b7280;margin-top:6px;white-space:pre-wrap;">${hw.description}</div>` : ''}
        ${hw.due_date ? `<div style="font-size:0.8rem;color:#9ca3af;margin-top:6px;">📅 Срок: ${new Date(hw.due_date).toLocaleDateString('ru-RU')}</div>` : ''}
        ${statusHtml}
        ${filesHtml}
      `;

      const submitBtn = card.querySelector('.hw-submit-btn');
      if (submitBtn) {
        submitBtn.onclick = async () => {
          submitBtn.disabled = true;
          submitBtn.textContent = '⏳ Отправляю...';
          try {
            const { error } = await supabase
              .from('homework_submissions')
              .insert({
                homework_id: hw.id,
                student_id: myStudentId,
                score: null,
                is_submitted: true,
                is_approved: false,
              });
            if (error) throw error;
            showStudentToast('📚 Домашка отправлена! Теперь прикрепи файлы.', 'ok');
            openFileUploader(hw.id);
            loadMyHomework();
          } catch (e) {
            showStudentToast('Ошибка: ' + e.message, 'err');
            submitBtn.disabled = false;
            submitBtn.textContent = '📤 Сдать';
          }
        };
      }

            container.appendChild(card);
    });

    // Подключаем кнопки скачивания файлов учителя
    setTimeout(() => {
      container.querySelectorAll('.download-teacher-file-btn').forEach(btn => {
        btn.onclick = async () => {
          try {
            const url = await db.getFileUrl(btn.dataset.path);
            window.open(url, '_blank');
          } catch (e) {
            alert('Ошибка: ' + e.message);
          }
        };
      });
    }, 100);
  } catch (e) {
    console.error('Ошибка домашек:', e);
  }
}

// ============================================
// ТОП-10
// ============================================
async function loadGlobalTop() {
  try {
    const { data, error } = await supabase
      .rpc('get_global_top', { p_limit: 10 });
    if (error) throw error;
    if (!data || !data.length) return;

    const container = document.getElementById('top-content');
    if (!container) return;

    container.innerHTML = '';
    const medals = ['🥇', '🥈', '🥉'];

    data.forEach((s, idx) => {
      const isMe = s.student_id === myStudentId;
      const row = document.createElement('div');
      row.style.cssText = `
        display:flex;align-items:center;gap:10px;
        padding:8px 10px;border-radius:10px;margin-bottom:6px;
        background:${isMe ? '#eef2ff' : (idx < 3 ? '#fef9c3' : '#f9fafb')};
        ${isMe ? 'border:2px solid #4f46e5;' : ''}
      `;

      const place = idx < 3 ? medals[idx] : `${idx + 1}.`;

      row.innerHTML = `
        <div style="font-size:1.3rem;min-width:32px;text-align:center;">${place}</div>
        <div style="flex:1;">
          <div style="font-weight:bold;font-size:0.9rem;color:#1f2937;">${s.full_name}${isMe ? ' 👈' : ''}</div>
          <div style="font-size:0.75rem;color:#9ca3af;">🏫 ${s.group_name || '—'} · ✅ ${s.present} · 📚 ${s.homework_count || 0}</div>
        </div>
        <div style="font-weight:bold;font-size:1rem;color:#4f46e5;text-align:right;">
          ${s.rating}<div style="font-size:0.65rem;color:#9ca3af;font-weight:normal;">очков</div>
        </div>
      `;
      container.appendChild(row);
    });
  } catch (e) {
    console.error('Ошибка топа:', e);
  }
}

// ============================================
// ОБЪЯВЛЕНИЯ И КОММЕНТАРИИ
// ============================================
async function loadMyAnnouncements() {
  try {
    const { data, error } = await supabase.rpc('get_my_announcements', { p_token: studentToken });
    if (error) throw error;
    if (data && data.length) renderAnnouncementsBox(data);
  } catch (e) { console.error('Ошибка объявлений:', e); }
}

async function loadMyComments() {
  try {
    const { data, error } = await supabase.rpc('get_my_comments', { p_token: studentToken });
    if (error) throw error;
    if (data && data.length) renderCommentsBox(data);
  } catch (e) { console.error('Ошибка комментариев:', e); }
}

function renderAnnouncementsBox(anns) {
  const groupInfoEl = document.getElementById('group-info');
  if (!groupInfoEl) return;

  const old = document.getElementById('announcements-header');
  if (old) old.remove();

  const box = document.createElement('div');
  box.id = 'announcements-header';
  box.style.cssText = 'margin: 16px 0; animation: slideDown .5s ease-out;';

  const header = document.createElement('div');
  header.style.cssText = 'font-size:1rem;font-weight:bold;color:#4f46e5;margin-bottom:10px;';
  header.innerHTML = '📢 Объявления';
  box.appendChild(header);

  anns.forEach((a, idx) => {
    const card = document.createElement('div');
    card.style.cssText = `
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #fbbf24 100%);
      border-radius: 16px;
      padding: 16px 18px;
      margin-bottom: 12px;
      border-left: 6px solid #f59e0b;
      position: relative;
      overflow: hidden;
    `;
    const newBadge = idx === 0 ? '<span style="background:#ef4444;color:#fff;padding:2px 8px;border-radius:999px;font-size:0.7rem;font-weight:bold;margin-left:8px;">NEW</span>' : '';

    card.innerHTML = `
      <div style="font-weight:bold;font-size:1.1rem;color:#92400e;margin-bottom:8px;">📢 ${a.title}${newBadge}</div>
      <div style="font-size:1rem;color:#1f2937;white-space:pre-wrap;line-height:1.5;">${a.text}</div>
      <div style="font-size:0.75rem;color:#92400e;opacity:0.7;margin-top:10px;">${a.author || ''} · ${new Date(a.created_at).toLocaleDateString('ru-RU')}</div>
    `;
    box.appendChild(card);
  });

  groupInfoEl.parentNode.insertBefore(box, groupInfoEl.nextSibling);
}

function renderCommentsBox(comments) {
  const lessonsListEl = document.getElementById('lessons-list');
  if (!lessonsListEl) return;

  const box = document.createElement('div');
  box.style.cssText = 'margin-bottom:20px;';
  box.innerHTML = `<div style="font-size:1.1rem;font-weight:bold;color:#4f46e5;margin-bottom:12px;">💬 Комментарии учителя</div>`;

  comments.forEach(c => {
    const card = document.createElement('div');
    card.style.cssText = 'background:#eef2ff;border-radius:12px;padding:12px;margin-bottom:8px;border-left:4px solid #4f46e5;';
    card.innerHTML = `
      <div style="font-size:0.95rem;color:#1f2937;white-space:pre-wrap;">${c.text}</div>
      <div style="font-size:0.75rem;color:#9ca3af;margin-top:6px;">👨‍🏫 ${c.teacher_name || 'Учитель'} · ${new Date(c.created_at).toLocaleDateString('ru-RU')}</div>
    `;
    box.appendChild(card);
  });

  lessonsListEl.parentNode.insertBefore(box, lessonsListEl);
}

// ============================================
// ЗАЯВКИ
// ============================================
async function loadMyRequests() {
  try {
    const { data, error } = await supabase.rpc('get_my_requests', { p_token: studentToken });
    if (error) throw error;
    myRequests = {};
    (data || []).forEach(r => {
      myRequests[r.lesson_id] = { status: r.status, reason: r.reason, is_approved: r.is_approved };
    });
  } catch (e) { console.error('Ошибка заявок:', e); }
}

async function sendRequest(lessonId, status, reason = null) {
  try {
    const { data, error } = await supabase.rpc('submit_attendance_request', {
      p_token: studentToken, p_lesson_id: lessonId, p_status: status, p_reason: reason,
    });
    if (error) throw error;
    if (!data || !data.success) throw new Error(data?.error || 'Ошибка');
    myRequests[lessonId] = { status, reason, is_approved: false };
    return true;
  } catch (e) {
    console.error('Ошибка отправки:', e);
    alert('Ошибка: ' + e.message);
    return false;
  }
}

// ============================================
// МЕНЮ
// ============================================
function initStudentMenu() {
  const burger = document.getElementById('student-burger-btn');
  const menu = document.getElementById('student-side-menu');
  const overlay = document.getElementById('student-menu-overlay');

  function openMenu() {
    menu.classList.add('open');
    overlay.classList.add('show');
    burger.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeMenu() {
    menu.classList.remove('open');
    overlay.classList.remove('show');
    burger.classList.remove('open');
    document.body.style.overflow = '';
  }

  burger.onclick = () => menu.classList.contains('open') ? closeMenu() : openMenu();
  overlay.onclick = closeMenu;

  function switchTab(tab) {
    document.querySelectorAll('.side-menu-item, .student-tab-btn').forEach(b => {
      if (b.dataset.studentTab === tab) b.classList.add('active');
      else b.classList.remove('active');
    });
    document.querySelectorAll('.student-tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.getElementById('student-tab-' + tab);
    if (activeTab) activeTab.classList.add('active');
    closeMenu();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (tab === 'homework') loadMyHomework();
    if (tab === 'attendance') loadMyAttendanceTab();
    if (tab === 'top') loadGlobalTop();
    if (tab === 'lessons') loadLessonsTab();
    if (tab === 'schedule') loadScheduleTab();
    if (tab === 'access') loadAccessTab();
  }

  document.querySelectorAll('.side-menu-item').forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.studentTab);
  });
  document.querySelectorAll('.student-tab-btn').forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.studentTab);
  });
}

// ============================================
// ЧАТ (сокращённый)
// ============================================
function initChat(groupId, studentName) {
  chatState.groupId = groupId;
  chatState.studentName = studentName;

  const chatBtn = document.getElementById('chat-btn');
  const modal = document.getElementById('chat-modal');
  const closeBtn = document.getElementById('chat-close');
  const tabGroup = document.getElementById('chat-tab-group');
  const tabGlobal = document.getElementById('chat-tab-global');
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');

  chatBtn.onclick = () => {
    modal.style.display = 'flex';
    openRoom('group');
    updateUnreadBadges();
  };
  closeBtn.onclick = () => {
    modal.style.display = 'none';
    closeChannel();
  };
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
      closeChannel();
    }
  };
  tabGroup.onclick = () => { if (chatState.currentRoom !== 'group') openRoom('group'); };
  tabGlobal.onclick = () => { if (chatState.currentRoom !== 'global') openRoom('global'); };
  sendBtn.onclick = sendMessage;
  input.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };
  input.oninput = () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  };

  setInterval(updateUnreadBadges, 30000);
  updateUnreadBadges();
}

function openRoom(roomType) {
  chatState.currentRoom = roomType;
  const tg = document.getElementById('chat-tab-group');
  const tgl = document.getElementById('chat-tab-global');

  if (roomType === 'group') {
    tg.style.color = '#4f46e5'; tg.style.borderBottomColor = '#4f46e5'; tg.style.fontWeight = 'bold';
    tgl.style.color = '#6b7280'; tgl.style.borderBottomColor = 'transparent'; tgl.style.fontWeight = 'normal';
  } else {
    tgl.style.color = '#4f46e5'; tgl.style.borderBottomColor = '#4f46e5'; tgl.style.fontWeight = 'bold';
    tg.style.color = '#6b7280'; tg.style.borderBottomColor = 'transparent'; tg.style.fontWeight = 'normal';
  }
  loadMessages();
  setupRealtime();
  markRoomRead();
}

async function loadMessages() {
  const box = document.getElementById('chat-messages');
  box.innerHTML = '<div style="text-align:center;color:#9ca3af;padding:20px;">Загружаю...</div>';

  try {
    const roomType = chatState.currentRoom;
    const roomId = roomType === 'group' ? chatState.groupId : null;

    const { data, error } = await supabase.rpc('get_my_messages', {
      p_token: studentToken, p_room_type: roomType, p_room_id: roomId, p_limit: 100,
    });

    if (error) throw error;
    chatState.messages = data || [];
    renderMessages();
  } catch (e) {
    box.innerHTML = `<div style="color:#ef4444;text-align:center;padding:20px;">Ошибка: ${e.message}</div>`;
  }
}

function renderMessages() {
  const box = document.getElementById('chat-messages');
  box.innerHTML = '';

  if (!chatState.messages.length) {
    box.innerHTML = `<div style="text-align:center;color:#9ca3af;padding:40px 20px;"><div style="font-size:2rem;margin-bottom:8px;">💬</div>Пока нет сообщений.<br>Напиши первым!</div>`;
    return;
  }

  chatState.messages.forEach(m => box.appendChild(makeMessageEl(m)));
  box.scrollTop = box.scrollHeight;
}

function makeMessageEl(msg) {
  const isMine = msg.is_mine;
  const isTeacher = msg.author_type === 'teacher';

  const wrapper = document.createElement('div');
  wrapper.style.cssText = `display:flex;flex-direction:column;align-items:${isMine ? 'flex-end' : 'flex-start'};max-width:85%;${isMine ? 'align-self:flex-end;' : 'align-self:flex-start;'}`;

  const name = document.createElement('div');
  name.style.cssText = 'font-size:0.75rem;color:#9ca3af;margin-bottom:3px;padding:0 8px;';
  name.textContent = isTeacher ? `👨‍🏫 ${msg.author_name}` : msg.author_name;
  wrapper.appendChild(name);

  const bubble = document.createElement('div');
  bubble.style.cssText = `
    background:${isMine ? '#4f46e5' : (isTeacher ? '#fef3c7' : '#fff')};
    color:${isMine ? '#fff' : '#1f2937'};
    padding:10px 14px;
    border-radius:16px;
    ${isMine ? 'border-bottom-right-radius:4px;' : 'border-bottom-left-radius:4px;'}
    font-size:0.95rem;
    line-height:1.4;
    word-break:break-word;
    white-space:pre-wrap;
    box-shadow:0 1px 3px rgba(0,0,0,.08);
    ${isTeacher ? 'border-left:3px solid #f59e0b;' : ''}
    ${isMine ? 'cursor:pointer;' : ''}
  `;
  bubble.textContent = msg.text;
  wrapper.appendChild(bubble);

  const footer = document.createElement('div');
  footer.style.cssText = 'font-size:0.7rem;color:#9ca3af;margin-top:3px;padding:0 8px;display:flex;gap:6px;align-items:center;';

  const time = document.createElement('span');
  time.textContent = new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  footer.appendChild(time);

  if (msg.edited_at) {
    const ed = document.createElement('span');
    ed.textContent = '(изменено)';
    ed.style.cssText = 'font-style:italic;';
    footer.appendChild(ed);
  }

  if (isMine) {
    const age = Date.now() - new Date(msg.created_at).getTime();
    if (age < 15 * 60 * 1000) {
      const eb = document.createElement('span');
      eb.textContent = '✏️';
      eb.style.cssText = 'cursor:pointer;';
      eb.onclick = () => editMyMessage(msg, wrapper);
      footer.appendChild(eb);
    }
  }
  wrapper.appendChild(footer);
  return wrapper;
}

function editMyMessage(msg, wrapper) {
  const bubble = wrapper.querySelector('div:nth-child(2)');
  const oldText = msg.text;

  const textarea = document.createElement('textarea');
  textarea.value = oldText;
  textarea.style.cssText = 'background:#fff;color:#1f2937;padding:10px 14px;border:2px solid #4f46e5;border-radius:16px;font-size:0.95rem;font-family:inherit;width:100%;min-width:200px;resize:none;outline:none;';

  bubble.replaceWith(textarea);
  textarea.focus();
  textarea.style.height = textarea.scrollHeight + 'px';

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:6px;margin-top:6px;';

  const saveBtn = document.createElement('button');
  saveBtn.textContent = '💾 Сохранить';
  saveBtn.style.cssText = 'background:#4f46e5;color:#fff;border:none;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:0.85rem;';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '✕ Отмена';
  cancelBtn.style.cssText = 'background:#e5e7eb;color:#1f2937;border:none;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:0.85rem;';

  btnRow.appendChild(saveBtn);
  btnRow.appendChild(cancelBtn);
  textarea.after(btnRow);

  saveBtn.onclick = async () => {
    const newText = textarea.value.trim();
    if (!newText || newText === oldText) { cancelBtn.onclick(); return; }

    try {
      const { data, error } = await supabase.rpc('edit_my_message', {
        p_token: studentToken, p_message_id: msg.id, p_new_text: newText,
      });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error);
      msg.text = newText;
      msg.edited_at = new Date().toISOString();
      wrapper.replaceWith(makeMessageEl(msg));
    } catch (e) {
      alert('Ошибка: ' + e.message);
    }
  };

  cancelBtn.onclick = () => {
    const newBubble = document.createElement('div');
    newBubble.style.cssText = bubble.style.cssText;
    newBubble.textContent = oldText;
    textarea.replaceWith(newBubble);
    btnRow.remove();
  };

  textarea.onkeydown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveBtn.click(); }
    if (e.key === 'Escape') cancelBtn.click();
  };
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  input.disabled = true;
  try {
    const roomType = chatState.currentRoom;
    const roomId = roomType === 'group' ? chatState.groupId : null;

    const { data, error } = await supabase.rpc('send_student_message', {
      p_token: studentToken, p_room_type: roomType, p_room_id: roomId, p_text: text,
    });
    if (error) throw error;
    if (data && !data.success) throw new Error(data.error);

    input.value = '';
    input.style.height = 'auto';
  } catch (e) {
    alert('Ошибка: ' + e.message);
  } finally {
    input.disabled = false;
    input.focus();
  }
}

function setupRealtime() {
  closeChannel();
  const roomType = chatState.currentRoom;
  const roomId = roomType === 'group' ? chatState.groupId : null;
  const filter = roomType === 'global' ? 'room_type=eq.global' : `room_id=eq.${roomId}`;
  const channelName = (roomType === 'global' ? 'messages:global:' : `messages:group:${roomId}:`) + studentToken.substring(0, 8);

  chatState.channel = supabase
    .channel(channelName)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'messages', filter,
    }, (payload) => {
      const newMsg = payload.new;
      if (roomType === 'global' && newMsg.room_type !== 'global') return;
      if (roomType === 'group' && newMsg.room_id !== roomId) return;

      chatState.messages.push({
        id: newMsg.id,
        author_type: newMsg.author_type,
        author_name: newMsg.author_name,
        text: newMsg.text,
        created_at: newMsg.created_at,
        is_mine: false,
      });
      renderMessages();

      const modal = document.getElementById('chat-modal');
      if (modal.style.display === 'none') updateUnreadBadges();
      else markRoomRead();
    })
    .subscribe();
}

function closeChannel() {
  if (chatState.channel) {
    supabase.removeChannel(chatState.channel);
    chatState.channel = null;
  }
}

async function markRoomRead() {
  const roomKey = chatState.currentRoom === 'global' ? 'global' : 'group:' + chatState.groupId;
  try {
    await supabase.rpc('mark_room_read', { p_token: studentToken, p_room_key: roomKey });
    updateUnreadBadges();
  } catch (e) { console.error('Ошибка:', e); }
}

async function updateUnreadBadges() {
  try {
    const [g, gl] = await Promise.all([
      supabase.rpc('get_unread_count', { p_token: studentToken, p_room_type: 'group', p_room_id: chatState.groupId }),
      supabase.rpc('get_unread_count', { p_token: studentToken, p_room_type: 'global', p_room_id: null }),
    ]);
    const total = (g.data || 0) + (gl.data || 0);

    const badge = document.getElementById('chat-badge');
    if (total > 0) {
      badge.textContent = total > 99 ? '99+' : total;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  } catch (e) { console.error('Ошибка:', e); }
}

// ============================================
// УТИЛИТЫ
// ============================================
function showStudentToast(msg, type = 'info') {
  const colors = { info: '#4f46e5', ok: '#22c55e', err: '#ef4444' };
  const toast = document.createElement('div');
  toast.style.cssText = `
    position:fixed;bottom:20px;left:50%;
    transform:translateX(-50%) translateY(20px);
    background:${colors[type]};color:#fff;
    padding:14px 22px;border-radius:14px;
    box-shadow:0 8px 24px rgba(0,0,0,.3);
    z-index:99999;font-size:1rem;
    max-width:90%;text-align:center;
    opacity:0;transition:all .3s ease;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================================
// СТАРТ
// ============================================
loadLessons();

if ('serviceWorker' in navigator) {
navigator.serviceWorker.register('./sw2.js').catch(console.error);
}

// ============================================
// ЗАГРУЗКА ФАЙЛОВ
// ============================================
function openFileUploader(homeworkId) {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.6);
    z-index:9999;display:flex;align-items:center;justify-content:center;
    padding:16px;
  `;

  const box = document.createElement('div');
  box.style.cssText = `
    background:#fff;border-radius:20px;padding:24px;
    max-width:500px;width:100%;text-align:center;
  `;

  box.innerHTML = `
    <h3 style="color:#4f46e5;margin-bottom:16px;">📎 Прикрепить файлы</h3>
    <p style="color:#6b7280;font-size:0.9rem;margin-bottom:16px;">
      Фото, PDF, документы, 3D-модели. До 5 файлов, до 50 МБ каждый.
    </p>
    <input type="file" id="file-input" multiple accept="*/*" style="display:none;">
    <button id="choose-files-btn" style="
      background:#4f46e5;color:#fff;padding:14px 24px;
      border:none;border-radius:12px;cursor:pointer;
      font-size:1rem;width:100%;margin-bottom:12px;
    ">📁 Выбрать файлы</button>
    <div id="selected-files" style="font-size:0.9rem;color:#666;margin-bottom:12px;"></div>
    <button id="upload-btn" style="
      background:#22c55e;color:#fff;padding:14px 24px;
      border:none;border-radius:12px;cursor:pointer;
      font-size:1rem;width:100%;display:none;
    ">📤 Загрузить</button>
    <button id="skip-btn" style="
      background:#e5e7eb;color:#1f2937;padding:12px 24px;
      border:none;border-radius:12px;cursor:pointer;
      font-size:0.95rem;width:100%;margin-top:8px;
    ">Пропустить</button>
  `;

  modal.appendChild(box);
  document.body.appendChild(modal);

  const fileInput = document.getElementById('file-input');
  const chooseBtn = document.getElementById('choose-files-btn');
  const uploadBtn = document.getElementById('upload-btn');
  const skipBtn = document.getElementById('skip-btn');
  const selectedDiv = document.getElementById('selected-files');

  let selectedFiles = [];

  chooseBtn.onclick = () => fileInput.click();

  fileInput.onchange = () => {
    selectedFiles = Array.from(fileInput.files).slice(0, 5);

    if (selectedFiles.length > 5) {
      alert('Максимум 5 файлов');
      selectedFiles = selectedFiles.slice(0, 5);
    }

    const tooBig = selectedFiles.find(f => f.size > 50 * 1024 * 1024);
    if (tooBig) {
      alert('Файл слишком большой (макс 50 МБ): ' + tooBig.name);
      selectedFiles = [];
      return;
    }

    selectedDiv.innerHTML = selectedFiles
      .map(f => `📄 ${f.name} (${(f.size / 1024).toFixed(1)} КБ)`)
      .join('<br>');

    uploadBtn.style.display = selectedFiles.length ? 'block' : 'none';
  };

  uploadBtn.onclick = async () => {
    uploadBtn.disabled = true;
    uploadBtn.textContent = '⏳ Загружаю...';

    try {
      for (const file of selectedFiles) {
        await db.uploadHomeworkFile(file, myStudentId, homeworkId);
      }
      showStudentToast(`📎 Загружено ${selectedFiles.length} файлов!`, 'ok');
      modal.remove();
      loadMyHomework();
    } catch (e) {
      showStudentToast('Ошибка: ' + e.message, 'err');
      uploadBtn.disabled = false;
      uploadBtn.textContent = '📤 Загрузить';
    }
  };

  skipBtn.onclick = () => modal.remove();
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };  
}

