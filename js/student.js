// Страница ученика — публичный доступ к занятиям группы
// Открывается по ссылке: student.html?group=UUID

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import * as db from './db.js';

// ⚠️ ВСТАВЬ СВОИ ЗНАЧЕНИЯ ИЗ SUPABASE
const SUPABASE_URL = 'https://wyldhqsbgyhqcdmsjeud.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5bGRocXNiZ3locWNkbXNqZXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0OTA4ODcsImV4cCI6MjEwNTA2Njg4N30.haCb0Ihyfq3UxJ02cP-iOQ-kF35Gbd5D6hzZwMt5hSw';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.supabase = supabase;  // для отладки

const lessonsList = document.getElementById('lessons-list');
const groupInfo = document.getElementById('group-info');

// Получаем ID группы из URL
const params = new URLSearchParams(window.location.search);
const groupId = params.get('group');
const studentToken = params.get('token');

async function loadLessons() {
  // Режим 1: по группе (общий QR)
  if (groupId) {
    await loadByGroup();
    return;
  }

  // Режим 2: по токену ученика (личный QR)
  if (studentToken) {
    await loadByToken();
    return;
  }

  // Ничего не указано
  lessonsList.innerHTML = `
    <div class="error-state">
      <span class="robot-emoji">🤖</span>
      Группа не указана.<br>
      <small>Отсканируй QR-код своей группы ещё раз.</small>
    </div>`;
}

async function loadByGroup() {
  try {
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('name, description')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      lessonsList.innerHTML = `
        <div class="error-state">
          <span class="robot-emoji">😕</span>
          Группа не найдена.<br>
          <small>Возможно, ссылка устарела. Обратись к преподавателю.</small>
        </div>`;
      return;
    }

    groupInfo.innerHTML = `<div class="group-badge">🏫 ${group.name}</div>`;

    const { data: lessons, error: lessonsError } = await supabase
      .from('lessons')
      .select('id, date, topic, teacher_name')
      .eq('group_id', groupId)
      .order('date', { ascending: false });

    if (lessonsError) throw lessonsError;
    renderLessonsList(lessons);
  } catch (e) {
    console.error('Ошибка:', e);
    lessonsList.innerHTML = `
      <div class="error-state">
        <span class="robot-emoji">❌</span>
        Ошибка: ${e.message}
      </div>`;
  }
}

async function loadByToken() {
  try {
    // Получаем данные ученика по токену через RPC
    const { data: studentData, error: studentError } = await supabase
      .rpc('get_student_by_token', { p_token: studentToken });

    if (studentError || !studentData || !studentData.length) {
      lessonsList.innerHTML = `
        <div class="error-state">
          <span class="robot-emoji">😕</span>
          Пропуск не найден или устарел.<br>
          <small>Обратись к преподавателю за новым.</small>
        </div>`;
      return;
    }

        const student = studentData[0];

    // 1. Показываем приветствие с ФИО
    groupInfo.innerHTML = `
      <div class="group-badge">👤 ${student.full_name}</div>
      ${student.group_name ? `<div style="font-size:0.95rem;color:#666;margin-top:8px;">🏫 ${student.group_name}</div>` : ''}
    `;

    // 2. Загружаем статистику посещаемости
    const stats = await loadMyAttendance(student.student_id);
    if (stats) {
      renderMyStats(stats);
    }

    // Инициализация чата
    initChat(student.group_id, student.full_name);

    // 3. Загружаем заявки ученика
    await loadMyRequests();

    // 4. Загружаем объявления ← ВСТАВИТ В ШАПКУ
    await loadMyAnnouncements();

    // 5. Загружаем комментарии
    await loadMyComments();

     // 6. Загружаем занятия группы
    const { data: lessons, error: lessonsError } = await supabase
      .from('lessons')
      .select('id, date, topic, teacher_name')
      .eq('group_id', student.group_id)
      .order('date', { ascending: false });

    if (lessonsError) throw lessonsError;
    renderLessonsList(lessons);
  } catch (e) {
    console.error('Ошибка:', e);
    lessonsList.innerHTML = `
      <div class="error-state">
        <span class="robot-emoji">❌</span>
        Ошибка: ${e.message}
      </div>`;
  }
}

    // Загружаем домашки
    await loadMyHomework();

    // Загружаем общий Топ-10
    await loadGlobalTop();

    // Кэш заявок ученика
let myRequests = {};  // { lesson_id: { status, reason, is_approved } }

async function loadMyRequests() {
  try {
    const { data, error } = await supabase
      .rpc('get_my_requests', { p_token: studentToken });

    if (error) throw error;
    
    myRequests = {};
    (data || []).forEach(r => {
      myRequests[r.lesson_id] = {
        status: r.status,
        reason: r.reason,
        is_approved: r.is_approved,
      };
    });
  } catch (e) {
    console.error('Ошибка загрузки заявок:', e);
  }
}

async function loadMyAnnouncements() {
  try {
    const { data, error } = await supabase
      .rpc('get_my_announcements', { p_token: studentToken });
    if (error) throw error;
    if (data && data.length) {
      renderAnnouncementsBox(data);
    }
  } catch (e) {
    console.error('Ошибка объявлений:', e);
  }
}

async function loadMyComments() {
  try {
    const { data, error } = await supabase
      .rpc('get_my_comments', { p_token: studentToken });
    if (error) throw error;
    if (data && data.length) {
      renderCommentsBox(data);
    }
  } catch (e) {
    console.error('Ошибка комментариев:', e);
  }
}

// ============================================
// ДОМАШКИ УЧЕНИКА
// ============================================
async function loadMyHomework() {
  try {
    // Получаем все домашки
    const { data: hwList, error: hwError } = await supabase
      .from('homework')
      .select('*')
      .order('created_at', { ascending: false });

    if (hwError) throw hwError;
    if (!hwList || !hwList.length) return;

    // Получаем student_id по токену
    const { data: studentData, error: stErr } = await supabase
      .rpc('get_student_by_token', { p_token: studentToken });

    if (stErr) throw stErr;
    if (!studentData || !studentData.length) return;

    const studentId = studentData[0].student_id;

    // Теперь получаем сдачи
    const { data: submissions, error: subErr } = await supabase
      .from('homework_submissions')
      .select('*')
      .eq('student_id', studentId);

    if (subErr) throw subErr;

    const subMap = {};
    (submissions || []).forEach(s => subMap[s.homework_id] = s);

    // Рендерим
    renderHomeworkBox(hwList, subMap, studentId);
  } catch (e) {
    console.error('Ошибка домашек:', e);
  }
}

function renderHomeworkBox(hwList, subMap, studentId) {
  const lessonsListEl = document.getElementById('lessons-list');
  if (!lessonsListEl) return;

  const box = document.createElement('div');
  box.id = 'homework-box';
  box.style.cssText = 'margin-bottom:20px;';

  box.innerHTML = `
    <div style="font-size:1.1rem;font-weight:bold;color:#4f46e5;margin-bottom:12px;">
      📚 Мои домашки
    </div>
  `;

  hwList.forEach(hw => {
    const sub = subMap[hw.id];
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

    card.innerHTML = `
      <div style="font-weight:bold;font-size:1rem;color:#4f46e5;">📚 ${hw.title}</div>
      ${hw.description ? `<div style="font-size:0.9rem;color:#6b7280;margin-top:6px;white-space:pre-wrap;">${hw.description}</div>` : ''}
      ${hw.due_date ? `<div style="font-size:0.8rem;color:#9ca3af;margin-top:6px;">📅 Срок: ${new Date(hw.due_date).toLocaleDateString('ru-RU')}</div>` : ''}
      ${statusHtml}
    `;

    // Обработчик "Сдать"
    const submitBtn = card.querySelector('.hw-submit-btn');
    if (submitBtn) {
      submitBtn.onclick = async () => {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Отправляю...';
        try {
          const { error } = await supabase
            .from('homework_submissions')
            .insert({
              homework_id: hw.id,
              student_id: studentId,
              score: null,
              is_submitted: true,
              is_approved: false,
            });
          if (error) throw error;
          alert('Домашка отправлена! Учитель проверит.');
          loadMyHomework();
        } catch (e) {
          alert('Ошибка: ' + e.message);
          submitBtn.disabled = false;
          submitBtn.textContent = '📤 Сдать';
        }
      };
    }

    box.appendChild(card);
  });

  lessonsListEl.parentNode.insertBefore(box, lessonsListEl);
}

// ============================================
// ТОП-10 ОБЩИЙ
// ============================================
async function loadGlobalTop() {
  try {
    const { data, error } = await supabase
      .rpc('get_global_top', { p_limit: 10 });

    if (error) throw error;
    if (!data || !data.length) return;

    // Получаем мой student_id
    const { data: studentData } = await supabase
      .rpc('get_student_by_token', { p_token: studentToken });

    const myId = studentData?.[0]?.student_id || null;

    renderTopBox(data, myId);
  } catch (e) {
    console.error('Ошибка топа:', e);
  }
}

function renderTopBox(students, myStudentId) {
  const lessonsListEl = document.getElementById('lessons-list');
  if (!lessonsListEl) return;

  const old = document.getElementById('global-top-box');
  if (old) old.remove();

  const box = document.createElement('div');
  box.id = 'global-top-box';
  box.style.cssText = 'margin-bottom:20px;background:#fff;border-radius:16px;padding:16px;box-shadow:0 2px 12px rgba(0,0,0,.08);';

  box.innerHTML = `<div style="font-size:1.1rem;font-weight:bold;color:#4f46e5;margin-bottom:14px;">🏆 Топ-10 школы</div>`;

  const medals = ['🥇', '🥈', '🥉'];

  students.forEach((s, idx) => {
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
    box.appendChild(row);
  });

  // Моё место (если не в топ-10)
  if (myStudentId && !students.find(s => s.student_id === myStudentId)) {
    const myPlace = document.createElement('div');
    myPlace.style.cssText = 'margin-top:10px;padding-top:10px;border-top:2px dashed #e5e7eb;text-align:center;font-size:0.85rem;color:#6b7280;';
    myPlace.textContent = '📍 Ты не в Топ-10. Продолжай в том же духе!';
    box.appendChild(myPlace);
  }

  lessonsListEl.parentNode.insertBefore(box, lessonsListEl);
}

function renderAnnouncementsBox(anns) {
  // Находим место под шапкой (после groupInfo)
  const groupInfoEl = document.getElementById('group-info');
  if (!groupInfoEl) return;

  // Удаляем старый блок, если есть
  const old = document.getElementById('announcements-header');
  if (old) old.remove();

  const box = document.createElement('div');
  box.id = 'announcements-header';
  box.style.cssText = `
    margin: 16px 0;
    animation: slideDown .5s ease-out;
  `;

  // Стили анимации — добавляем в head один раз
  if (!document.getElementById('ann-styles')) {
    const style = document.createElement('style');
    style.id = 'ann-styles';
    style.textContent = `
      @keyframes slideDown {
        from { opacity: 0; transform: translateY(-15px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes pulseGlow {
        0%, 100% { box-shadow: 0 4px 20px rgba(245, 158, 11, 0.4); }
        50% { box-shadow: 0 4px 30px rgba(245, 158, 11, 0.8); }
      }
      @keyframes wiggle {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(-15deg); }
        75% { transform: rotate(15deg); }
      }
      @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      .ann-card {
        background: linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #fbbf24 100%);
        background-size: 200% 200%;
        border-radius: 16px;
        padding: 16px 18px;
        margin-bottom: 12px;
        border-left: 6px solid #f59e0b;
        animation: pulseGlow 2s ease-in-out infinite;
        position: relative;
        overflow: hidden;
      }
      .ann-card::before {
        content: '';
        position: absolute;
        top: 0; left: -100%;
        width: 100%; height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);
        animation: shine 3s infinite;
      }
      @keyframes shine {
        0% { left: -100%; }
        50%, 100% { left: 100%; }
      }
      .ann-emoji {
        display: inline-block;
        animation: wiggle 1s ease-in-out infinite;
        margin-right: 6px;
      }
      .ann-title {
        font-weight: bold;
        font-size: 1.1rem;
        color: #92400e;
        margin-bottom: 8px;
        position: relative;
        z-index: 2;
        display: flex;
        align-items: center;
      }
      .ann-text {
        font-size: 1rem;
        color: #1f2937;
        white-space: pre-wrap;
        position: relative;
        z-index: 2;
        line-height: 1.5;
      }
      .ann-footer {
        font-size: 0.75rem;
        color: #92400e;
        opacity: 0.7;
        margin-top: 10px;
        position: relative;
        z-index: 2;
      }
      .ann-new-badge {
        background: #ef4444;
        color: #fff;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 0.7rem;
        font-weight: bold;
        margin-left: 8px;
        animation: blink 1.2s ease-in-out infinite;
      }
      .ann-header-title {
        font-size: 1rem;
        font-weight: bold;
        color: #4f46e5;
        margin-bottom: 10px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
    `;
    document.head.appendChild(style);
  }

  // Заголовок блока
  const header = document.createElement('div');
  header.className = 'ann-header-title';
  header.innerHTML = `<span class="ann-emoji">📢</span> Объявления`;
  box.appendChild(header);

  // Карточки объявлений
  anns.forEach((a, idx) => {
    const card = document.createElement('div');
    card.className = 'ann-card';
    // Первое объявление — с бейджем "NEW"
    const newBadge = idx === 0 ? '<span class="ann-new-badge">NEW</span>' : '';

    card.innerHTML = `
      <div class="ann-title">
        <span class="ann-emoji">📢</span>
        ${a.title}${newBadge}
      </div>
      <div class="ann-text">${a.text}</div>
      <div class="ann-footer">
        ${a.author || ''} · ${new Date(a.created_at).toLocaleDateString('ru-RU')}
      </div>
    `;
    box.appendChild(card);
  });

  // Вставляем СРАЗУ ПОСЛЕ group-info (в шапке)
  groupInfoEl.parentNode.insertBefore(box, groupInfoEl.nextSibling);
}

function renderCommentsBox(comments) {
  const lessonsListEl = document.getElementById('lessons-list');
  if (!lessonsListEl) return;

  const box = document.createElement('div');
  box.style.cssText = 'margin-bottom:20px;';

  box.innerHTML = `
    <div style="font-size:1.1rem;font-weight:bold;color:#4f46e5;margin-bottom:12px;">
      💬 Комментарии учителя
    </div>
  `;

  comments.forEach(c => {
    const card = document.createElement('div');
    card.style.cssText = `
      background: #eef2ff;
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 8px;
      border-left: 4px solid #4f46e5;
    `;
    card.innerHTML = `
      <div style="font-size:0.95rem;color:#1f2937;white-space:pre-wrap;">
        ${c.text}
      </div>
      <div style="font-size:0.75rem;color:#9ca3af;margin-top:6px;">
        👨‍🏫 ${c.teacher_name || 'Учитель'} · ${new Date(c.created_at).toLocaleDateString('ru-RU')}
      </div>
    `;
    box.appendChild(card);
  });

  lessonsListEl.parentNode.insertBefore(box, lessonsListEl);
}

// Функция отправки заявки
async function sendRequest(lessonId, status, reason = null) {
  try {
    const { data, error } = await supabase.rpc('submit_attendance_request', {
      p_token: studentToken,
      p_lesson_id: lessonId,
      p_status: status,
      p_reason: reason,
    });

    if (error) throw error;
    if (!data || !data.success) {
      throw new Error(data?.error || 'Не удалось отправить');
    }

    // Обновляем локальный кэш
    myRequests[lessonId] = { status, reason, is_approved: false };
    return true;
  } catch (e) {
    console.error('Ошибка отправки:', e);
    alert('Ошибка: ' + e.message);
    return false;
  }
}

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

// Общая функция отрисовки списка занятий
function renderLessonsList(lessons) {
  if (!lessons || !lessons.length) {
    lessonsList.innerHTML = `
      <div class="empty-state">
        <span class="robot-emoji">📭</span>
        Пока нет занятий.<br>
        <small>Загляни позже!</small>
      </div>`;
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const future = lessons
    .filter(l => l.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const past = lessons
    .filter(l => l.date < today)
    .sort((a, b) => b.date.localeCompare(a.date));

  lessonsList.innerHTML = '';

  if (future.length) {
    lessonsList.appendChild(makeSectionTitle('📅 Ближайшие занятия'));
    future.forEach(l => lessonsList.appendChild(makeLessonCard(l, false)));
  }

  if (past.length) {
    lessonsList.appendChild(makeSectionTitle('📚 Прошедшие занятия'));
    past.forEach(l => lessonsList.appendChild(makeLessonCard(l, true)));
  }
}

function renderMyStats(stats) {
  // Находим контейнер перед списком занятий
  const lessonsListEl = document.getElementById('lessons-list');
  
  const statsBox = document.createElement('div');
  statsBox.style.cssText = `
    background: linear-gradient(135deg, #4f46e5, #9333ea);
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 20px;
    color: #fff;
    box-shadow: 0 4px 20px rgba(79,70,229,.3);
  `;

  const percent = stats.attendance_percent || 0;
  const rating = stats.rating || 0;
  
  // Эмодзи и цвет по проценту
  let emoji = '🏆';
  let message = 'Ты супер!';
  if (percent < 50) {
    emoji = '😢';
    message = 'Надо подтянуться!';
  } else if (percent < 80) {
    emoji = '💪';
    message = 'Хорошо, но можно лучше!';
  }

  statsBox.innerHTML = `
    <div style="font-size:1.1rem;font-weight:bold;margin-bottom:16px;">
      📊 Моя посещаемость
    </div>
    
    <div style="font-size:3rem;font-weight:bold;text-align:center;margin:12px 0;">
      ${percent}%
    </div>
    
    <div style="text-align:center;font-size:1.1rem;margin-bottom:16px;">
      ${emoji} ${message}
    </div>
    
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

  // Вставляем ПЕРЕД списком занятий
  const container = lessonsListEl.parentNode;
  container.insertBefore(statsBox, lessonsListEl);
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
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'short',
  });

  const request = myRequests[lesson.id];

  // Основной контент карточки
  card.innerHTML = `
    <div class="lesson-date">
      📅 ${dateStr}
      ${isToday ? '<span class="today-badge">СЕГОДНЯ</span>' : ''}
    </div>
    <div class="lesson-topic">${lesson.topic || '— без темы —'}</div>
    ${lesson.teacher_name && !lesson.teacher_name.includes('@') 
      ? `<div class="lesson-teacher">👨‍🏫 ${lesson.teacher_name}</div>` 
      : ''}
  `;

  // Кнопки самозаписи — только для БУДУЩИХ занятий
  if (!isPast && studentToken) {
    const btnBox = document.createElement('div');
    btnBox.style.cssText = 'margin-top:12px;';

    // Если заявка уже есть — показываем статус
    if (request) {
      const statusInfo = getStatusInfo(request.status);
      const approvedBadge = request.is_approved
        ? '<span style="background:#22c55e;color:#fff;padding:2px 8px;border-radius:999px;font-size:0.75rem;margin-left:6px;">✅ Подтверждено</span>'
        : '<span style="background:#f59e0b;color:#fff;padding:2px 8px;border-radius:999px;font-size:0.75rem;margin-left:6px;">⏳ На проверке</span>';

      btnBox.innerHTML = `
        <div style="background:${statusInfo.color}22;border:2px solid ${statusInfo.color};border-radius:12px;padding:10px;text-align:center;">
          <div style="font-size:0.95rem;color:${statusInfo.color};font-weight:bold;">
            ${statusInfo.emoji} Твоя заявка: ${statusInfo.label}
            ${approvedBadge}
          </div>
          ${request.reason ? `<div style="font-size:0.85rem;color:#666;margin-top:4px;">💬 ${request.reason}</div>` : ''}
          <button class="change-request-btn" style="background:#fff;color:${statusInfo.color};border:2px solid ${statusInfo.color};padding:6px 12px;border-radius:8px;cursor:pointer;font-size:0.85rem;margin-top:8px;">
            ✏️ Изменить
          </button>
        </div>
      `;

      // Кнопка "Изменить" — сбрасывает заявку
      btnBox.querySelector('.change-request-btn').onclick = async () => {
        delete myRequests[lesson.id];
        // Перерисовываем
        const parent = card.parentNode;
        const newCard = makeLessonCard(lesson, isPast);
        parent.replaceChild(newCard, card);
      };
    } else {
      // Заявки нет — показываем 4 кнопки
      btnBox.innerHTML = `
        <div style="font-size:0.85rem;color:#666;margin-bottom:8px;">✍️ Отметься заранее:</div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">
          <button data-status="present" style="background:#22c55e;color:#fff;border:none;padding:10px;border-radius:10px;cursor:pointer;font-size:0.9rem;">✅ Буду</button>
          <button data-status="late" style="background:#f59e0b;color:#fff;border:none;padding:10px;border-radius:10px;cursor:pointer;font-size:0.9rem;">⏰ Опоздаю</button>
          <button data-status="excused" style="background:#3b82f6;color:#fff;border:none;padding:10px;border-radius:10px;cursor:pointer;font-size:0.9rem;">📝 Болею</button>
          <button data-status="absent" style="background:#ef4444;color:#fff;border:none;padding:10px;border-radius:10px;cursor:pointer;font-size:0.9rem;">❌ Не смогу</button>
        </div>
      `;

      // Обработчики
      btnBox.querySelectorAll('button[data-status]').forEach(btn => {
        btn.onclick = async () => {
          const status = btn.dataset.status;
          let reason = null;

          // Для "болею" и "не смогу" — спросить причину
          if (status === 'excused' || status === 'absent') {
            reason = prompt(
              status === 'excused' ? 'Что случилось? (причина)' : 'Почему не сможешь?',
              ''
            );
            if (reason === null) return; // отменил
          }

          const ok = await sendRequest(lesson.id, status, reason);
          if (ok) {
            // Перерисовываем карточку
            const parent = card.parentNode;
            const newCard = makeLessonCard(lesson, isPast);
            parent.replaceChild(newCard, card);
          }
        };
      });
    }

    card.appendChild(btnBox);
  }

  return card;
}

// Утилита: инфо о статусе
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
// ЧАТ
// ============================================
let chatState = {
  currentRoom: 'group',      // 'group' | 'global'
  groupId: null,
  studentName: null,
  channel: null,
  messages: [],
};

// Инициализация чата (вызывается после loadByToken)
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

  // Открыть чат
  chatBtn.onclick = () => {
    modal.style.display = 'flex';
    openRoom('group');
    updateUnreadBadges();
  };

  // Закрыть
  closeBtn.onclick = () => {
    modal.style.display = 'none';
    closeChannel();
  };

  // Закрытие по клику на фон
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
      closeChannel();
    }
  };

  // Переключение вкладок
  tabGroup.onclick = () => {
    if (chatState.currentRoom === 'group') return;
    openRoom('group');
  };
  tabGlobal.onclick = () => {
    if (chatState.currentRoom === 'global') return;
    openRoom('global');
  };

  // Отправка
  sendBtn.onclick = sendMessage;
  input.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Автоувеличение textarea
  input.oninput = () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  };

  // Обновляем счётчик непрочитанных каждые 30 сек
  setInterval(updateUnreadBadges, 30000);
  updateUnreadBadges();
}

function openRoom(roomType) {
  chatState.currentRoom = roomType;

  // Обновляем вкладки
  const tabGroup = document.getElementById('chat-tab-group');
  const tabGlobal = document.getElementById('chat-tab-global');

  if (roomType === 'group') {
    tabGroup.style.color = '#4f46e5';
    tabGroup.style.borderBottomColor = '#4f46e5';
    tabGroup.style.fontWeight = 'bold';
    tabGlobal.style.color = '#6b7280';
    tabGlobal.style.borderBottomColor = 'transparent';
    tabGlobal.style.fontWeight = 'normal';
  } else {
    tabGlobal.style.color = '#4f46e5';
    tabGlobal.style.borderBottomColor = '#4f46e5';
    tabGlobal.style.fontWeight = 'bold';
    tabGroup.style.color = '#6b7280';
    tabGroup.style.borderBottomColor = 'transparent';
    tabGroup.style.fontWeight = 'normal';
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

    const { data, error } = await supabase
      .rpc('get_my_messages', {
        p_token: studentToken,
        p_room_type: roomType,
        p_room_id: roomId,
        p_limit: 100,
      });

    if (error) throw error;

    chatState.messages = data || [];
    renderMessages();
  } catch (e) {
    console.error('Ошибка загрузки сообщений:', e);
    box.innerHTML = `<div style="color:#ef4444;text-align:center;padding:20px;">Ошибка: ${e.message}</div>`;
  }
}

function renderMessages() {
  const box = document.getElementById('chat-messages');
  box.innerHTML = '';

  if (!chatState.messages.length) {
    box.innerHTML = `
      <div style="text-align:center;color:#9ca3af;padding:40px 20px;">
        <div style="font-size:2rem;margin-bottom:8px;">💬</div>
        Пока нет сообщений.<br>
        Напиши первым!
      </div>
    `;
    return;
  }

  chatState.messages.forEach(m => {
    box.appendChild(makeMessageEl(m));
  });

  // Скролл вниз
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

  // Пометка «изменено»
  if (msg.edited_at) {
    const edited = document.createElement('span');
    edited.textContent = '(изменено)';
    edited.style.cssText = 'font-style:italic;';
    footer.appendChild(edited);
  }

  // Кнопка «Редактировать» — только для своих и в течение 15 минут
  if (isMine) {
    const age = Date.now() - new Date(msg.created_at).getTime();
    const within15min = age < 15 * 60 * 1000;

    if (within15min) {
      const editBtn = document.createElement('span');
      editBtn.textContent = '✏️';
      editBtn.style.cssText = 'cursor:pointer;';
      editBtn.title = 'Редактировать';
      editBtn.onclick = () => editMyMessage(msg, wrapper);
      footer.appendChild(editBtn);
    }
  }

  wrapper.appendChild(footer);

  return wrapper;
}

function editMyMessage(msg, wrapper) {
  const bubble = wrapper.querySelector('div:nth-child(2)');
  const oldText = msg.text;

  // Создаём textarea
  const textarea = document.createElement('textarea');
  textarea.value = oldText;
  textarea.style.cssText = `
    background:#fff;
    color:#1f2937;
    padding:10px 14px;
    border:2px solid #4f46e5;
    border-radius:16px;
    font-size:0.95rem;
    font-family:inherit;
    width:100%;
    min-width:200px;
    resize:none;
    outline:none;
  `;
  
  // Заменяем пузырь на textarea
  bubble.replaceWith(textarea);
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  textarea.style.height = textarea.scrollHeight + 'px';

  // Кнопки
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

  // Сохранение
  saveBtn.onclick = async () => {
    const newText = textarea.value.trim();
    if (!newText) return;
    if (newText === oldText) {
      cancelBtn.onclick();
      return;
    }

    try {
      const { data, error } = await supabase.rpc('edit_my_message', {
        p_token: studentToken,
        p_message_id: msg.id,
        p_new_text: newText,
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error);

      // Обновляем локальные данные
      msg.text = newText;
      msg.edited_at = new Date().toISOString();

      // Перерисовываем сообщение
      const newEl = makeMessageEl(msg);
      wrapper.replaceWith(newEl);
    } catch (e) {
      console.error('Ошибка редактирования:', e);
      alert('Ошибка: ' + e.message);
    }
  };

  // Отмена
  cancelBtn.onclick = () => {
    const newBubble = document.createElement('div');
    newBubble.style.cssText = bubble.style.cssText;
    newBubble.textContent = oldText;
    textarea.replaceWith(newBubble);
    btnRow.remove();
  };

  // Ctrl+Enter — сохранить
  textarea.onkeydown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      saveBtn.click();
    }
    if (e.key === 'Escape') {
      cancelBtn.click();
    }
  };
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  // Блокируем на время отправки
  input.disabled = true;

  try {
    const roomType = chatState.currentRoom;
    const roomId = roomType === 'group' ? chatState.groupId : null;

    const { data, error } = await supabase
      .rpc('send_student_message', {
        p_token: studentToken,
        p_room_type: roomType,
        p_room_id: roomId,
        p_text: text,
      });

    if (error) throw error;
    if (data && !data.success) throw new Error(data.error || 'Ошибка отправки');

    input.value = '';
    input.style.height = 'auto';
  } catch (e) {
    console.error('Ошибка отправки:', e);
    alert('Ошибка: ' + e.message);
  } finally {
    input.disabled = false;
    input.focus();
  }
}

// Realtime подписка
function setupRealtime() {
  closeChannel();

  const roomType = chatState.currentRoom;
  const roomId = roomType === 'group' ? chatState.groupId : null;

  const filter = roomType === 'global'
    ? 'room_type=eq.global'
    : `room_id=eq.${roomId}`;

  const channelName = roomType === 'global'
    ? 'messages:global:' + studentToken.substring(0, 8)
    : `messages:group:${roomId}:` + studentToken.substring(0, 8);

  chatState.channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: filter,
      },
      async (payload) => {
        const newMsg = payload.new;
        // Проверяем, что это наша комната
        if (roomType === 'global' && newMsg.room_type !== 'global') return;
        if (roomType === 'group' && newMsg.room_id !== roomId) return;

        // Проверяем, не наше ли сообщение (чтобы не дублировать)
        if (newMsg.author_type === 'student' && newMsg.author_id) {
          // Мы не знаем свой student_id напрямую, но можем проверить по имени
          // Проще — перезагрузить список
        }

        // Добавляем сообщение
        const msgForRender = {
          id: newMsg.id,
          author_type: newMsg.author_type,
          author_name: newMsg.author_name,
          text: newMsg.text,
          created_at: newMsg.created_at,
          is_mine: false, // пересчитаем при перезагрузке
        };

        chatState.messages.push(msgForRender);
        renderMessages();

        // Обновляем непрочитанные, если чат закрыт
        const modal = document.getElementById('chat-modal');
        if (modal.style.display === 'none') {
          updateUnreadBadges();
        } else {
          markRoomRead();
        }
      }
    )
    .subscribe();
}

function closeChannel() {
  if (chatState.channel) {
    supabase.removeChannel(chatState.channel);
    chatState.channel = null;
  }
}

async function markRoomRead() {
  const roomKey = chatState.currentRoom === 'global'
    ? 'global'
    : 'group:' + chatState.groupId;

  try {
    await supabase.rpc('mark_room_read', {
      p_token: studentToken,
      p_room_key: roomKey,
    });
    updateUnreadBadges();
  } catch (e) {
    console.error('Ошибка отметки прочтения:', e);
  }
}

async function updateUnreadBadges() {
  try {
    // Считаем непрочитанные в обеих комнатах
    const groupKey = 'group:' + chatState.groupId;

    const [groupRes, globalRes] = await Promise.all([
      supabase.rpc('get_unread_count', {
        p_token: studentToken,
        p_room_type: 'group',
        p_room_id: chatState.groupId,
      }),
      supabase.rpc('get_unread_count', {
        p_token: studentToken,
        p_room_type: 'global',
        p_room_id: null,
      }),
    ]);

    const groupUnread = groupRes.data || 0;
    const globalUnread = globalRes.data || 0;
    const total = groupUnread + globalUnread;

    // Обновляем бейдж в шапке
    const badge = document.getElementById('chat-badge');
    if (total > 0) {
      badge.textContent = total > 99 ? '99+' : total;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }

    // Обновляем бейджи на вкладках
    updateTabBadge('chat-tab-group', groupUnread);
    updateTabBadge('chat-tab-global', globalUnread);
  } catch (e) {
    console.error('Ошибка подсчёта непрочитанных:', e);
  }
}

function updateTabBadge(tabId, count) {
  const tab = document.getElementById(tabId);
  if (!tab) return;

  // Удаляем старый бейдж
  const old = tab.querySelector('.tab-badge');
  if (old) old.remove();

  if (count > 0) {
    const badge = document.createElement('span');
    badge.className = 'tab-badge';
    badge.textContent = count;
    badge.style.cssText = `
      background:#ef4444;color:#fff;
      border-radius:999px;
      padding:1px 7px;
      font-size:0.7rem;
      margin-left:6px;
      font-weight:bold;
    `;
    tab.appendChild(badge);
  }
}

loadLessons();

// Service Worker (для офлайн-режима)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(console.error);
}