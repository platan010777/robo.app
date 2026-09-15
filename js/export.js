// Экспорт отчётов в Excel и PDF

async function ensureXLSX() {
  if (window.XLSX) return;
  await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
}

async function ensurePDF() {
  if (window.jspdf) return;
  await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
  await loadScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js');
}

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

// Загрузка шрифта с нашего сервера и конвертация в base64
async function loadCyrillicFont() {
  const res = await fetch('./fonts/Roboto-Regular.ttf');
  if (!res.ok) throw new Error('Не удалось загрузить шрифт: ' + res.status);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  // Обрабатываем по частям, чтобы не переполнить стек на больших файлах
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// ============================================
// EXCEL
// ============================================
window.__exportExcel = async function(students, stats, dateFrom, dateTo) {
  await ensureXLSX();

  const rows = [['Ученик', 'Был', 'Опоздал', 'Не был', 'Уваж.', 'Бездельничал', 'Саботировал', 'Всего', '% посещаемости']];
  students.forEach(s => {
    const st = stats[s.id];
    if (st.total === 0) return;
    const percent = Math.round((st.present + st.late) / st.total * 100);
    rows.push([
      s.full_name,
      st.present,
      st.late,
      st.absent,
      st.excused,
      st.idle,
      st.sabotage,
      st.total,
      percent + '%',
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 30 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 8 },
    { wch: 15 }, { wch: 14 }, { wch: 8 }, { wch: 15 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Посещаемость');

  XLSX.writeFile(wb, `Посещаемость_${dateFrom}_${dateTo}.xlsx`);
};

// ============================================
// PDF (с поддержкой кириллицы)
// ============================================
window.__exportPDF = async function(students, stats, dateFrom, dateTo) {
  await ensurePDF();

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape' });

  // Подключаем русский шрифт с нашего сервера
  let fontLoaded = false;
  try {
    const fontBase64 = await loadCyrillicFont();
    doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.setFont('Roboto');
    fontLoaded = true;
    console.log('✅ Шрифт Roboto загружен');
  } catch (e) {
    console.error('❌ Не удалось загрузить шрифт:', e);
    alert('Ошибка загрузки шрифта для PDF: ' + e.message +
          '\n\nПроверь, что файл fonts/Roboto-Regular.ttf существует.');
    return;
  }

  doc.setFontSize(16);
  doc.text('Отчёт по посещаемости', 14, 20);
  doc.setFontSize(11);
  doc.text(`Период: ${dateFrom} — ${dateTo}`, 14, 28);

  const body = [];
  students.forEach(s => {
    const st = stats[s.id];
    if (st.total === 0) return;
    const percent = Math.round((st.present + st.late) / st.total * 100);
    body.push([
      s.full_name,
      st.present,
      st.late,
      st.absent,
      st.excused,
      st.idle,
      st.sabotage,
      st.total,
      percent + '%',
    ]);
  });

  doc.autoTable({
    startY: 35,
    head: [['Ученик', 'Был', 'Опоздал', 'Не был', 'Уваж.', 'Бездельничал', 'Саботировал', 'Всего', '%']],
    body: body,
    styles: {
      font: 'Roboto',
      fontSize: 10,
    },
    headStyles: {
      font: 'Roboto',
      fillColor: [79, 70, 229],
    },
  });

  doc.save(`Посещаемость_${dateFrom}_${dateTo}.pdf`);
};

console.log('✅ export.js загружен (с поддержкой кириллицы)');