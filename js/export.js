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

window.__exportPDF = async function(students, stats, dateFrom, dateTo) {
  await ensurePDF();

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape' });

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
        head: [['Ученик', '✅', '⏰', '❌', '📝', '🥱', '🤬', 'Всего', '%']],
    body: body,
    styles: { font: 'helvetica', fontSize: 10 },
    headStyles: { fillColor: [79, 70, 229] },
  });

  doc.save(`Посещаемость_${dateFrom}_${dateTo}.pdf`);
};

console.log('✅ export.js загружен');