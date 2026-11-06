import { supabase } from './db.js';

let groupsCache = [];
let lessonsCache = [];
let currentWeekStart = null;

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'onclick') e.onclick = v;
    else if (k === 'style') e.style.cssText = v;
    else e.setAttribute(k, v);
  }
  for (const child of children) {
    if (typeof child === 'string') e.appendChild(document.createTextNode(child));
    else if (child) e.appendChild(child);
  }
  return e;
}

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

async function loadAll() {
  try {
    const { data: groups } = await supabase.from('groups').select('*').order('name');
    const HIDDEN_GROUPS = ['RGB-ТЕХНОЛОГИИ'];
    groupsCache = (groups || []).filter(g => !HIDDEN_GROUPS.includes(g.name));

    const { data: lessons } = await supabase.from('lessons').select('*').order('date');
    lessonsCache = lessons || [];
  } catch (e) {
    console.error('Ошибка загрузки:', e);
  }
}

async function renderSchedule() {
  const root = document.getElementById('schedule-container');
  root.innerHTML = '';

  if (!currentWeekStart) {
    currentWeekStart = getMondayOfWeek(new Date());
  }

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

  const allLessons = lessonsCache;
  const days = [
    { name: 'Пн', offset: 0 },
    { name: 'Вт', offset: 1 },
    { name: 'Ср', offset: 2 },
    { name: 'Чт', offset: 3 },
    { name: 'Пт', offset: 4 },
  ];
  const todayStr = formatLocalDate(new Date());
  const isMobile = window.innerWidth <= 768;

  const table = el('div', {
    style: 'overflow-x:auto;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08);',
  });

  const headerRow = el('div', {
    style: `display:grid;grid-template-columns:${isMobile ? '80px' : '140px'} repeat(5, minmax(0, 1fr));gap:1px;background:#e5e7eb;${isMobile ? '' : 'min-width:800px;'}`,
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

  groupsCache.forEach(group => {
    const row = el('div', {
      style: `display:grid;grid-template-columns:${isMobile ? '80px' : '140px'} repeat(5, minmax(0, 1fr));gap:1px;background:#e5e7eb;${isMobile ? '' : 'min-width:800px;'}`,
    });

    row.appendChild(el('div', {
      style: `padding:${isMobile ? '6px 4px' : '10px 8px'};background:#f9fafb;font-weight:bold;font-size:${isMobile ? '0.65rem' : '0.8rem'};word-break:break-word;line-height:1.25;`,
      title: group.name,
    }, group.name));

    days.forEach(day => {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() + day.offset);
      const dateStr = formatLocalDate(d);

      const dayLessons = allLessons.filter(l =>
        l.group_id === group.id && l.date === dateStr
      );

      const cell = el('div', {
        style: `padding:${isMobile ? '4px' : '6px'};background:#fff;min-height:${isMobile ? '40px' : '60px'};font-size:${isMobile ? '0.65rem' : '0.75rem'};line-height:1.3;`,
      });

      if (dayLessons.length) {
        dayLessons.forEach(l => {
          cell.appendChild(el('div', {
            style: `background:#eef2ff;border-left:${isMobile ? '2px' : '3px'} solid #4f46e5;padding:${isMobile ? '3px 4px' : '4px 6px'};border-radius:6px;margin-bottom:4px;font-size:${isMobile ? '0.6rem' : '0.72rem'};line-height:1.25;word-break:break-word;`,
          }, l.topic || '— без темы —'));
        });
      }

      row.appendChild(cell);
    });

    table.appendChild(row);
  });

  root.appendChild(table);
}

// ============================================
// СТАРТ
// ============================================
(async () => {
  await loadAll();
  await renderSchedule();
})();