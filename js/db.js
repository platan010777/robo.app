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