import { db, auth } from "../firebase.js";
import { collection } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const state = {
  USER_WAGE: parseInt(localStorage.getItem('shift_wage')) || 25000,
  TARGET_HOURS: parseInt(localStorage.getItem('kaito_target_hours')) || 200,
  TARGET_DAYS: parseInt(localStorage.getItem('kaito_target_days')) || 27,
  APP_NAME: localStorage.getItem('kaito_app_name') || "KAITO",
  isMoneyVisible: localStorage.getItem('money_visible') === 'true',
  viewMonth: new Date().getMonth(),
  viewYear: new Date().getFullYear(),
  diaryViewMode: localStorage.getItem('kaito_diary_view') || 'timeline',
  customMode: false,
  selectedShift: null,
  currentMonthSalary: 0,
  editModeId: null,
  currentMonthAchievements: [],
  notifiedAchievements: new Set(),
  savedShifts: JSON.parse(localStorage.getItem('preset_shifts')) || [
    { start: "07:30", end: "12:30" },
    { start: "07:30", end: "15:30" },
    { start: "12:30", end: "17:30" },
    { start: "14:30", end: "22:30" },
    { start: "15:30", end: "22:30" },
    { start: "17:30", end: "22:30" },
    { start: "18:30", end: "22:30" }
  ]
};

export const COL = collection(db, "work_logs");
export const SCH_COL = collection(db, "work_schedule");
export const EXP_COL = collection(db, "work_schedule"); // Reverted to work_schedule for permissions and existing data
