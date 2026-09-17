// Страница ученика — публичный доступ к занятиям группы
// Открывается по ссылке: student.html?group=UUID

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ⚠️ ВСТАВЬ СВОИ ЗНАЧЕНИЯ ИЗ SUPABASE
const SUPABASE_URL = 'https://wyldhqsbgyhqcdmsjeud.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5bGRocXNiZ3locWNkbXNqZXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0OTA4ODcsImV4cCI6MjEwNTA2Njg4N30.haCb0Ihyfq3UxJ02cP-iOQ-kF35Gbd5D6hzZwMt5hSw';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
  return card;
}

loadLessons();

// Service Worker (для офлайн-режима)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(console.error);
}