import { auth, db } from "../firebase.js";
import { addDoc, getDocs, deleteDoc, doc, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { state, EXP_COL } from "./store.js";
import { $, fmtMoney, showToast } from "./utils.js";

export async function renderExpenses() {
  const tbody = $("#expenseTableBody");
  const emptyEl = $("#expenseEmpty");
  const wrapperEl = $("#expenseTableWrapper");
  const footerEl = $("#expenseFooter");
  if (!tbody) return;

  const salaryEl = $("#expenseSalaryValue");
  if (salaryEl) salaryEl.innerText = fmtMoney(state.currentMonthSalary);

  if (!auth.currentUser) return;
  const q = query(EXP_COL, where("uid", "==", auth.currentUser.uid));
  const snap = await getDocs(q);
  const expenses = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(e => e.month === (state.viewMonth + 1) && e.year === state.viewYear)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  tbody.innerHTML = "";

  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const balance = state.currentMonthSalary - totalSpent;
  if ($("#expenseTotalSpent")) $("#expenseTotalSpent").innerText = fmtMoney(totalSpent);
  if ($("#expenseTotalBalance")) {
    $("#expenseTotalBalance").innerText = fmtMoney(balance);
    if (balance < 0) {
      $("#expenseTotalBalance").classList.add("negative");
    } else {
      $("#expenseTotalBalance").classList.remove("negative");
    }
  }

  if (expenses.length === 0) {
    if (wrapperEl) wrapperEl.style.display = "none";
    if (footerEl) footerEl.style.display = "none";
    if (emptyEl) emptyEl.style.display = "block";
    return;
  }

  if (wrapperEl) wrapperEl.style.display = "block";
  if (footerEl) footerEl.style.display = "block";
  if (emptyEl) emptyEl.style.display = "none";

  let runningTotal = 0;
  expenses.forEach((exp, idx) => {
    runningTotal += exp.amount;
    const currentBalance = state.currentMonthSalary - runningTotal;
    const tr = document.createElement("tr");
    tr.className = "expense-row";
    tr.style.animationDelay = `${idx * 0.05}s`;
    tr.innerHTML = `
      <td class="exp-col-stt">${idx + 1}</td>
      <td class="exp-col-name">${exp.name}</td>
      <td class="exp-col-amount"> -${fmtMoney(exp.amount)}</td>
      <td class="exp-col-balance ${currentBalance < 0 ? 'negative' : ''}">${fmtMoney(currentBalance)}</td>
      <td class="exp-col-action">
        <button class="btn-mini del" onclick="delExpense('${exp.id}')" title="Xóa">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.delExpense = async (id) => {
  if (await showConfirm("Xóa khoản chi tiêu này?")) {
    await deleteDoc(doc(db, "work_schedule", id));
    showToast("Đã xóa chi tiêu!", "success");
    renderExpenses();
  }
};

export function initExpensesUI() {
  $("#fab-expense").onclick = () => {
    $("#expenseModalTitle").innerText = "Thêm chi tiêu";
    $("#inpExpenseName").value = "";
    $("#inpExpenseAmount").value = "";
    $("#expenseModal").classList.remove("hidden");
  };

  $("#btnCloseExpense").onclick = () => $("#expenseModal").classList.add("hidden");
  $("#btnCancelExpense").onclick = () => $("#expenseModal").classList.add("hidden");

  $("#inpExpenseAmount").addEventListener("input", function() {
    let val = this.value.replace(/\D/g, '');
    if (val) {
      this.value = val.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    } else {
      this.value = "";
    }
  });

  $("#btnSaveExpense").onclick = async () => {
    const name = $("#inpExpenseName").value.trim();
    const amount = parseInt($("#inpExpenseAmount").value.replace(/\./g, ''));
    if (!name) { showToast("Nhập tên chi tiêu!", "error"); return; }
    if (!amount || amount <= 0) { showToast("Nhập số tiền hợp lệ!", "error"); return; }
    $("#btnSaveExpense").innerText = "Đang lưu...";
    $("#btnSaveExpense").disabled = true;
    await addDoc(EXP_COL, {
      name, amount,
      month: state.viewMonth + 1,
      year: state.viewYear,
      uid: auth.currentUser.uid,
      createdAt: Date.now()
    });
    $("#btnSaveExpense").innerText = "Lưu chi tiêu";
    $("#btnSaveExpense").disabled = false;
    $("#expenseModal").classList.add("hidden");
    showToast("Thêm chi tiêu thành công!", "success");
    renderExpenses();
  };
}
