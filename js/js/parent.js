// Страница родителя — публичный доступ по токену
// Открывается: parent.html?token=XXX

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://wyldhqsbgyhqcdmsjeud.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5bGRocXNiZ3locWNkbXNqZXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0OTA4ODcsImV4cCI6MjEwNTA2Njg4N30.haCb0Ihyfq3UxJ02cP-iOQ-kF35Gbd5D6hzZwMt5hSw';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabase = supabase;

const params = new URLSearchParams(window.location.search);
const parentToken = params.get('token');

const content = document.getElementById('content');

async function loadParentView() {
  if (!parentToken) {
    content.innerHTML = `
      <div class="error-state">
        <span class="robot-emoji">🤖</span>
        Ссылка не указана.<br>
        <small>Попроси ребёнка создать ссылку заново.</small>
      </div>`;
    return;
  }

  try {
    // Получаем данные ребёнка по токену родителя
    const { data: childData, error } = await supabase
      .rpc('get_child_by_parent_token', { p_parent_token: parentToken });

    if (error || !childData || !childData.length) {
      content.innerHTML = `
        <div class="error-state">
          <span class="robot-emoji">😕</span>
          Ссылка устарела.<br>
          <small>Попроси ребёнка создать новую.</small>
        </div>`;
      return;
    }

    const child = childData[0];
    const studentToken = child.student_token;

    // Загружаем статистику ребёнка
    let stats = null;
    if (studentToken) {
      const { data: statsData } = await supabase
        .rpc('get_my_attendance', { p_token: studentToken });
      stats = statsData && statsData.length ? statsData[0] : null;
    }

    // Загружаем занятия группы
    const { data: lessons } = await supabase
      .from('lessons')
      .select('id, date, topic, teacher_name')
      .eq('group_id', child.group_id)
      .order('date', { ascending: false })
      .limit(10);

    // Загружаем домашки
    const { data: homework } = await supabase
      .from('homework')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    // Загружаем объявления
    let announcements = [];
    if (studentToken) {
      const { data: annData } = await supabase
        .rpc('get_my_announcements', { p_token: studentToken });
      announcements = annData || [];
    }

    // Рендерим
    content.innerHTML = '';

    // === ЗАГОЛОВОК: ФИО ребёнка ===
    const nameBox = document.createElement('div');
    nameBox.innerHTML = `<div class="child-name">👤 ${child.full_name}</div>
      ${child.group_name ? `<div style="font-size:0.95rem;color:#6b7280;margin-bottom:16px;">🏫 ${child.group_name}</div>` : ''}`;
    content.appendChild(nameBox);

    // === ОБЪЯВЛЕНИЯ ===
    if (announcements.length) {
      const annBox = document.createElement('div');
      annBox.className = 'card';
      annBox.innerHTML = `<div style="font-weight:bold;color:#be185d;font-size:1.05rem;margin-bottom:12px;">📢 Объявления</div>`;
      
      announcements.slice(0, 3).forEach(a => {
        const aCard = document.createElement('div');
        aCard.style.cssText = 'background:#fce7f3;padding:12px;border-radius:10px;margin-bottom:8px;';
        aCard.innerHTML = `
          <div style="font-weight:bold;color:#be185d;margin-bottom:6px;">${a.title}</div>
          <div style="font-size:0.9rem;color:#1f2937;white-space:pre-wrap;">${a.text}</div>
        `;
        annBox.appendChild(aCard);
      });
      content.appendChild(annBox);
    }

    // === ПОСЕЩАЕМОСТЬ ===
    if (stats) {
      const statsBox = document.createElement('div');
      statsBox.className = 'card';
      statsBox.innerHTML = `
        <div style="font-weight:bold;color:#be185d;font-size:1.05rem;margin-bottom:12px;">📊 Посещаемость</div>
        <div style="font-size:2.5rem;font-weight:bold;color:#be185d;text-align:center;margin-bottom:16px;">
          ${stats.attendance_percent || 0}%
        </div>
        <div class="stats-grid">
          <div class="stat">
            <div class="stat-value">${stats.present || 0}</div>
            <div class="stat-label">✅ Был</div>
          </div>
          <div class="stat">
            <div class="stat-value">${stats.late || 0}</div>
            <div class="stat-label">⏰ Опоздал</div>
          </div>
          <div class="stat">
            <div class="stat-value">${stats.absent || 0}</div>
            <div class="stat-label">❌ Не был</div>
          </div>
        </div>
        <div style="background:#fce7f3;padding:12px;border-radius:12px;text-align:center;margin-top:12px;">
          <div style="font-size:0.9rem;color:#6b7280;">🏆 Рейтинг</div>
          <div style="font-size:1.5rem;font-weight:bold;color:#be185d;">${stats.rating || 0} очков</div>
          <div style="font-size:0.8rem;color:#6b7280;">Всего занятий: ${stats.total_lessons || 0}</div>
        </div>
      `;
      content.appendChild(statsBox);
    }

    // === ДОМАШКИ ===
    if (homework && homework.length) {
      const hwBox = document.createElement('div');
      hwBox.className = 'card';
      hwBox.innerHTML = `<div style="font-weight:bold;color:#be185d;font-size:1.05rem;margin-bottom:12px;">📚 Домашки</div>`;

      homework.slice(0, 5).forEach(hw => {
        const hwCard = document.createElement('div');
        hwCard.className = 'hw-card';
        hwCard.innerHTML = `
          <div style="font-weight:bold;color:#be185d;margin-bottom:4px;">📚 ${hw.title}</div>
          ${hw.description ? `<div style="font-size:0.85rem;color:#6b7280;">${hw.description}</div>` : ''}
          ${hw.due_date ? `<div style="font-size:0.75rem;color:#9ca3af;margin-top:6px;">📅 До ${new Date(hw.due_date).toLocaleDateString('ru-RU')}</div>` : ''}
        `;
        hwBox.appendChild(hwCard);
      });
      content.appendChild(hwBox);
    }

    // === РАСПИСАНИЕ ===
    if (lessons && lessons.length) {
      const lessonsBox = document.createElement('div');
      lessonsBox.className = 'card';
      lessonsBox.innerHTML = `<div style="font-weight:bold;color:#be185d;font-size:1.05rem;margin-bottom:12px;">📅 Последние занятия</div>`;

      lessons.slice(0, 5).forEach(l => {
        const lCard = document.createElement('div');
        lCard.className = 'lesson-card';
        const date = new Date(l.date + 'T00:00:00');
        const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });
        lCard.innerHTML = `
          <div style="font-weight:bold;color:#ec4899;margin-bottom:4px;">📅 ${dateStr}</div>
          <div style="font-size:0.95rem;color:#1f2937;">${l.topic || '— без темы —'}</div>
        `;
        lessonsBox.appendChild(lCard);
      });
      content.appendChild(lessonsBox);
    }

  } catch (e) {
    console.error('Ошибка:', e);
    content.innerHTML = `
      <div class="error-state">
        <span class="robot-emoji">❌</span>
        Ошибка: ${e.message}
      </div>`;
  }
}

loadParentView();

// Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(console.error);
}