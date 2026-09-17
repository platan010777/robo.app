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

    // Показываем приветствие с ФИО
    groupInfo.innerHTML = `
      <div class="group-badge">👤 ${student.full_name}</div>
      ${student.group_name ? `<div style="font-size:0.95rem;color:#666;margin-top:8px;">🏫 ${student.group_name}</div>` : ''}
    `;

    // Загружаем статистику посещаемости
    const stats = await loadMyAttendance(student.student_id);
    if (stats) {
      renderMyStats(stats);
    }
        // Загружаем заявки ученика
    await loadMyRequests();

    // Загружаем занятия группы
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

loadLessons();

// Service Worker (для офлайн-режима)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(console.error);
}