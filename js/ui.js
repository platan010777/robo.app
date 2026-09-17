// Утилиты для интерфейса

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else node.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (typeof c === 'string') node.appendChild(document.createTextNode(c));
    else if (c) node.appendChild(c);
  });
  return node;
}

export function toast(msg, type = 'info') {
  const colors = { info: '#4f46e5', ok: '#22c55e', err: '#ef4444' };
  const t = el('div', {
    style: `position:fixed;bottom:20px;left:50%;transform:translateX(-50%);
            background:${colors[type]};color:#fff;padding:12px 20px;
            border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.3);
            z-index:9999;font-size:1rem;max-width:90%;`,
  }, msg);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

export function openModal(title, contentNode, onSave) {
  const overlay = el('div', { class: 'modal show' });
  const box = el('div', { class: 'modal-box' });
  box.appendChild(el('h2', {}, title));
  box.appendChild(contentNode);

  const btnRow = el('div', { style: 'display:flex;gap:10px;margin-top:12px;' });
  const cancelBtn = el('button', {
    style: 'flex:1;background:#e5e7eb;color:#1f2937;',
    onclick: () => overlay.remove(),
  }, 'Отмена');
  const saveBtn = el('button', {
    style: 'flex:1;',
    onclick: async () => {
      try {
        await onSave();
        overlay.remove();
      } catch (e) {
        toast('Ошибка: ' + e.message, 'err');
      }
    },
  }, 'Сохранить');

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(saveBtn);
  box.appendChild(btnRow);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

export function confirmDialog(msg) {
  return confirm(msg);
}