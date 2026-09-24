// Kaito App Entry Point
import { initAuth } from "./js/auth.js";
import { initSettings } from "./js/settings.js";
import { initUI } from "./js/ui.js";
import { initExpensesUI } from "./js/expenses.js";
import { initWorkLogs } from "./js/workLogs.js";
import { initExcelCompare } from "./js/excelCompare.js";

document.addEventListener("DOMContentLoaded", () => {
  initAuth();
  initSettings();
  initUI();
  initExpensesUI();
  initWorkLogs();
  initExcelCompare();
});
