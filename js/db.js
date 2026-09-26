import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import Dexie from 'https://cdn.jsdelivr.net/npm/dexie@4/+esm';

// ⚠️ ВСТАВЬ СВОИ ЗНАЧЕНИЯ ИЗ SUPABASE
const SUPABASE_URL = 'https://wyldhqsbgyhqcdmsjeud.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5bGRocXNiZ3locWNkbXNqZXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0OTA4ODcsImV4cCI6MjEwNTA2Njg4N30.haCb0Ihyfq3UxJ02cP-iOQ-kF35Gbd5D6hzZwMt5hSw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Локальный кэш (IndexedDB)
export const localDb = new Dexie('robotAttendance');
localDb.version(1).stores({
  groups: 'id, name',
  students: 'id, full_name, group_id, is_active',
  lessons: 'id, group_id, date',
  attendance: 'id, lesson_id, student_id, status',
  queue: '++id, table, action, payload, created_at',
});

console.log('✅ db.js загружен');

// ============================================
// ФУНКЦИИ РАБОТЫ С SUPABASE
// ============================================

// --- ГРУППЫ ---
export async function fetchGroups() {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .order('name');
  if (error) throw error;
  // Кэшируем локально
  await localDb.groups.clear();
  await localDb.groups.bulkPut(data);
  return data;
}

export async function createGroup(group) {
  const { data, error } = await supabase
    .from('groups')
    .insert(group)
    .select()
    .single();
  if (error) throw error;
  await localDb.groups.put(data);
  return data;
}

export async function updateGroup(id, updates) {
  const { data, error } = await supabase
    .from('groups')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  await localDb.groups.put(data);
  return data;
}

export async function deleteGroup(id) {
  const { error } = await supabase.from('groups').delete().eq('id', id);
  if (error) throw error;
  await localDb.groups.delete(id);
}

// --- УЧЕНИКИ ---
export async function fetchStudents() {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .order('full_name');
  if (error) throw error;
  await localDb.students.clear();
  await localDb.students.bulkPut(data);
  return data;
}

export async function createStudent(student) {
  const { data, error } = await supabase
    .from('students')
    .insert(student)
    .select()
    .single();
  if (error) throw error;
  await localDb.students.put(data);
  return data;
}

export async function updateStudent(id, updates) {
  const { data, error } = await supabase
    .from('students')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  await localDb.students.put(data);
  return data;
}

export async function deleteStudent(id) {
  const { error } = await supabase.from('students').delete().eq('id', id);
  if (error) throw error;
  await localDb.students.delete(id);
}

// --- ЗАНЯТИЯ ---
export async function fetchLessons() {
  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .order('date', { ascending: false });
  if (error) throw error;
  await localDb.lessons.clear();
  await localDb.lessons.bulkPut(data);
  return data;
}

export async function createLesson(lesson) {
  const { data, error } = await supabase
    .from('lessons')
    .insert(lesson)
    .select()
    .single();
  if (error) throw error;
  await localDb.lessons.put(data);
  return data;
}

export async function updateLesson(id, updates) {
  const { data, error } = await supabase
    .from('lessons')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  await localDb.lessons.put(data);
  return data;
}

export async function deleteLesson(id) {
  const { error } = await supabase.from('lessons').delete().eq('id', id);
  if (error) throw error;
  await localDb.lessons.delete(id);
}

// ============================================
// ПОСЕЩАЕМОСТЬ
// ============================================

export async function fetchAttendanceForLesson(lessonId) {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('lesson_id', lessonId);
  if (error) throw error;
  await localDb.attendance.where('lesson_id').equals(lessonId).delete();
  await localDb.attendance.bulkPut(data);
  return data;
}

export async function upsertAttendance(record) {
  // record: { lesson_id, student_id, status, comment, marked_by }
  const { data, error } = await supabase
    .from('attendance')
    .upsert(record, { onConflict: 'lesson_id,student_id' })
    .select()
    .single();
  if (error) throw error;
  await localDb.attendance.put(data);
  return data;
}

export async function fetchAllAttendance() {
  const { data, error } = await supabase
    .from('attendance')
    .select('*');
  if (error) throw error;
  await localDb.attendance.clear();
  await localDb.attendance.bulkPut(data);
  return data;
}
// ============================================
// ТОКЕНЫ УЧЕНИКОВ (QR-пропуска)
// ============================================

// Генерация случайного токена (24 символа)
function generateToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 24; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

// Получить активный токен ученика (или создать новый)
export async function getOrCreateToken(studentId) {
  // Проверяем, есть ли уже активный токен
  const { data: existing, error: selectError } = await supabase
    .from('student_tokens')
    .select('*')
    .eq('student_id', studentId)
    .eq('is_active', true)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing;

  // Создаём новый
  const token = generateToken();
  const { data, error } = await supabase
    .from('student_tokens')
    .insert({ student_id: studentId, token })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Перевыпустить токен (заблокировать старый, создать новый)
export async function rotateToken(studentId) {
  // Блокируем все старые
  await supabase
    .from('student_tokens')
    .update({ is_active: false })
    .eq('student_id', studentId);

  // Создаём новый
  const token = generateToken();
  const { data, error } = await supabase
    .from('student_tokens')
    .insert({ student_id: studentId, token })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Получить все активные токены (для отображения)
export async function fetchStudentsWithTokens() {
  const { data, error } = await supabase
    .from('student_tokens')
    .select('student_id, token, is_active')
    .eq('is_active', true);
  if (error) throw error;
  return data;
}

// ============================================
// ЗАЯВКИ НА ПОСЕЩЕНИЕ (для учителя)
// ============================================

// Все заявки (для вкладки)
export async function fetchAllRequests() {
  const { data, error } = await supabase
    .from('attendance_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// Заявки по занятию
export async function fetchRequestsForLesson(lessonId) {
  const { data, error } = await supabase
    .from('attendance_requests')
    .select('*')
    .eq('lesson_id', lessonId);
  if (error) throw error;
  return data;
}

// Подтвердить заявку
export async function approveRequest(requestId, teacherName) {
  const { data: req, error: reqError } = await supabase
    .from('attendance_requests')
    .select('*')
    .eq('id', requestId)
    .single();
  if (reqError) throw reqError;

  await supabase
    .from('attendance')
    .upsert({
      lesson_id: req.lesson_id,
      student_id: req.student_id,
      status: req.status,
      comment: req.reason,
      marked_by: teacherName,
    }, { onConflict: 'lesson_id,student_id' });

  await supabase
    .from('attendance_requests')
    .update({
      is_approved: true,
      approved_by: teacherName,
      approved_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  return true;
}

// Отклонить заявку
export async function rejectRequest(requestId) {
  const { error } = await supabase
    .from('attendance_requests')
    .delete()
    .eq('id', requestId);
  if (error) throw error;
  return true;
}

// ============================================
// ОБЪЯВЛЕНИЯ
// ============================================
export async function fetchAnnouncements() {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createAnnouncement(ann) {
  const { data, error } = await supabase
    .from('announcements')
    .insert(ann)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAnnouncement(id) {
  const { error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ============================================
// ДОМАШКА
// ============================================
export async function fetchHomeworkForLesson(lessonId) {
  const { data, error } = await supabase
    .from('homework')
    .select('*')
    .eq('lesson_id', lessonId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createHomework(hw) {
  const { data, error } = await supabase
    .from('homework')
    .insert(hw)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteHomework(id) {
  const { error } = await supabase
    .from('homework')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ============================================
// КОММЕНТАРИИ
// ============================================
export async function fetchCommentsForStudent(studentId) {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createComment(comment) {
  const { data, error } = await supabase
    .from('comments')
    .insert(comment)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteComment(id) {
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ============================================
// ЧАТ
// ============================================

// === ДЛЯ УЧИТЕЛЯ ===

// Все сообщения комнаты (для учителя)
export async function fetchMessages(roomType, roomId = null, limit = 100) {
  let query = supabase
    .from('messages')
    .select('*')
    .eq('room_type', roomType)
    //.eq('is_deleted', false) // НЕТ фильтра is_deleted — учитель видит ВСЁ
    .order('created_at', { ascending: false })
    .limit(limit);

  if (roomType === 'global') {
    query = query.is('room_id', null);
  } else {
    query = query.eq('room_id', roomId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).reverse();
}

// Учитель отправляет сообщение
export async function sendTeacherMessage(roomType, roomId, text, teacherName) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      room_type: roomType,
      room_id: roomId,
      author_type: 'teacher',
      author_id: null,
      author_name: teacherName,
      text: text,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Мягкое удаление сообщения (is_deleted = true)
export async function deleteMessage(messageId) {
  const { error } = await supabase
    .from('messages')
    .update({ is_deleted: true })
    .eq('id', messageId);
  if (error) throw error;
}

// Учитель редактирует сообщение (на всякий случай)
export async function editMessage(messageId, newText) {
  const { error } = await supabase
    .from('messages')
    .update({ 
      text: newText,
      edited_at: new Date().toISOString(),
    })
    .eq('id', messageId);
  if (error) throw error;
}

// Восстановить удалённое сообщение (только учитель)
export async function restoreMessage(messageId) {
  const { error } = await supabase
    .from('messages')
    .update({ is_deleted: false })
    .eq('id', messageId);
  if (error) throw error;
}

// Непрочитанные для учителя (по последнему прочтению)
export async function getTeacherUnreadCount(roomKey) {
  const { data: readRow } = await supabase
    .from('message_reads')
    .select('last_read_at')
    .eq('user_token', 'teacher')
    .eq('room_key', roomKey)
    .maybeSingle();

  const lastRead = readRow?.last_read_at || '1970-01-01';

  let query = supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .gt('created_at', lastRead)
    .eq('is_deleted', false)
    .neq('author_type', 'teacher');

  if (roomKey === 'global') {
    query = query.eq('room_type', 'global').is('room_id', null);
  } else {
    const groupId = roomKey.replace('group:', '');
    query = query.eq('room_type', 'group').eq('room_id', groupId);
  }

  const { count } = await query;
  return count || 0;
}

// Отметить комнату прочитанной для учителя
export async function markRoomReadTeacher(roomKey) {
  await supabase
    .from('message_reads')
    .upsert({
      user_token: 'teacher',
      room_key: roomKey,
      last_read_at: new Date().toISOString(),
    }, { onConflict: 'user_token,room_key' });
}

// === REALTIME ПОДПИСКА ===
export function subscribeToMessages(roomType, roomId, callback) {
  const channelName = roomType === 'global'
    ? 'messages:global'
    : `messages:group:${roomId}`;

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: roomType === 'global'
          ? 'room_type=eq.global'
          : `room_id=eq.${roomId}`,
      },
      (payload) => callback(payload.new)
    )
    .subscribe();

  return channel;
}

export function unsubscribeFromMessages(channel) {
  if (channel) supabase.removeChannel(channel);
}

// ============================================
// ОЧИСТКА СТАРЫХ ФАЙЛОВ
// ============================================

// Запустить очистку файлов старше 30 дней
export async function cleanupOldFiles() {
  const { data, error } = await supabase
    .rpc('cleanup_old_homework_files');
  
  if (error) throw error;
  return data; // число удалённых файлов
}

// Получить статистику файлов (для отображения)
export async function fetchFilesStats() {
  const { data, error } = await supabase
    .from('homework_files')
    .select('id, file_size, uploaded_at');
  
  if (error) throw error;

  const total = data.length;
  const totalSize = data.reduce((sum, f) => sum + (f.file_size || 0), 0);
  
  // Файлы старше 30 дней
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const old = data.filter(f => new Date(f.uploaded_at) < thirtyDaysAgo);

  return {
    total,
    totalSize,
    oldCount: old.length,
    oldSize: old.reduce((sum, f) => sum + (f.file_size || 0), 0),
  };
}

// ============================================
// ФАЙЛЫ ДОМАШЕК
// ============================================

// Загрузить файл
export async function uploadHomeworkFile(file, studentId, homeworkId) {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${studentId}/${homeworkId}/${timestamp}_${safeName}`;

  // Загружаем в Storage
  const { error: uploadError } = await supabase.storage
    .from('homework-files')
    .upload(path, file, { cacheControl: '3600', upsert: false });

  if (uploadError) throw uploadError;

  // Записываем в БД
  const { data, error } = await supabase
    .from('homework_files')
    .insert({
      homework_id: homeworkId,
      student_id: studentId,
      file_path: path,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      uploaded_by: 'student',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Получить временную ссылку
export async function getFileUrl(filePath, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from('homework-files')
    .createSignedUrl(filePath, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

// Файлы домашки
export async function fetchHomeworkFiles(homeworkId, studentId = null) {
  let query = supabase
    .from('homework_files')
    .select('*')
    .eq('homework_id', homeworkId)
    .order('uploaded_at', { ascending: false });

  if (studentId) query = query.eq('student_id', studentId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Удалить файл
export async function deleteHomeworkFile(fileId, filePath) {
  const { error: storageError } = await supabase.storage
    .from('homework-files')
    .remove([filePath]);
  if (storageError) throw storageError;

  const { error } = await supabase
    .from('homework_files')
    .delete()
    .eq('id', fileId);
  if (error) throw error;
}

// ============================================
// ФАЙЛЫ ДОМАШЕК — учитель
// ============================================

// Загрузить файл к домашке от учителя
export async function uploadTeacherHomeworkFile(file, homeworkId) {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `teacher/${homeworkId}/${timestamp}_${safeName}`;

  // Загружаем в Storage
  const { error: uploadError } = await supabase.storage
    .from('homework-files')
    .upload(path, file, { cacheControl: '3600', upsert: false });

  if (uploadError) throw uploadError;

  // Записываем в БД
  const { data, error } = await supabase
    .from('homework_files')
    .insert({
      homework_id: homeworkId,
      student_id: null,  // ← учительский файл, без ученика
      file_path: path,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      uploaded_by: 'teacher',
      is_teacher_file: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Получить файлы, прикреплённые учителем к домашке
export async function fetchTeacherFilesForHomework(homeworkId) {
  const { data, error } = await supabase
    .from('homework_files')
    .select('*')
    .eq('homework_id', homeworkId)
    .eq('is_teacher_file', true);
  if (error) throw error;
  return data || [];
}

// ============================================
// ТОКЕНЫ РОДИТЕЛЕЙ
// ============================================

// Ученик создаёт токен родителя
export async function createParentToken(studentToken, parentName = null) {
  const { data, error } = await supabase
    .rpc('create_parent_token', {
      p_student_token: studentToken,
      p_parent_name: parentName,
    });
  if (error) throw error;
  return data;  // { success, token, existing }
}

// Получить данные ребёнка по токену родителя
export async function getChildByParentToken(parentToken) {
  const { data, error } = await supabase
    .rpc('get_child_by_parent_token', {
      p_parent_token: parentToken,
    });
  if (error) throw error;
  return data && data.length ? data[0] : null;
}

// Получить все токены родителей для ученика (для отображения)
export async function fetchParentTokensForStudent(studentId) {
  const { data, error } = await supabase
    .from('parent_tokens')
    .select('*')
    .eq('student_id', studentId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Перевыпустить токен (если потеряли)
export async function rotateParentToken(studentId) {
  // Блокируем старые
  await supabase
    .from('parent_tokens')
    .update({ is_active: false })
    .eq('student_id', studentId);

  // Создаём новый
  const newToken = Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const { data, error } = await supabase
    .from('parent_tokens')
    .insert({ student_id: studentId, token: newToken })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// БОНУСЫ УЧЕНИКОВ
// ============================================

// Добавить бонус (учитель)
export async function addBonus(studentId, points, reason, teacherName) {
  const { data, error } = await supabase
    .from('student_bonuses')
    .insert({
      student_id: studentId,
      points: points,
      reason: reason,
      teacher_name: teacherName,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Удалить бонус
export async function deleteBonus(bonusId) {
  const { error } = await supabase
    .from('student_bonuses')
    .delete()
    .eq('id', bonusId);
  if (error) throw error;
}

// Получить все бонусы ученика (учитель)
export async function fetchBonusesForStudent(studentId) {
  const { data, error } = await supabase
    .from('student_bonuses')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Получить бонусы по токену (ученик)
export async function fetchMyBonuses(studentToken) {
  const { data, error } = await supabase
    .rpc('get_my_bonuses', { p_token: studentToken });
  if (error) throw error;
  return data || [];
}

window.__db = { 
  fetchMessages, 
  sendTeacherMessage, 
  deleteMessage,
  subscribeToMessages,
};