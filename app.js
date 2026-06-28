import { db, auth } from "./firebase.js"; 
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";



// === THEME REMOVED - NOW USING UNIFIED CLEAN UI ===

// === LOGIC ẨN/HIỆN TIỀN (MỚI) ===
let isMoneyVisible = localStorage.getItem('money_visible') === 'true'; // Lấy trạng thái đã lưu
const btnPrivacyList = document.querySelectorAll(".btn-toggle-privacy");

// --- ANIMATION HELPER ---
function animateValue(elementId, start, end, duration, formatter) {
  const obj = document.getElementById(elementId);
  if (!obj) return;
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 4); // easeOutQuart
    const current = progress === 1 ? end : start + (end - start) * ease;
    obj.innerText = formatter ? formatter(current) : current;
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
}

// --- TOAST NOTIFICATION ---
function showToast(msg, type = "error") {
  const container = document.getElementById("toastContainer");
  if(!container) return;
  const icon = type === "error" ? "fa-circle-exclamation" : "fa-circle-check";
  const div = document.createElement("div");
  div.className = `toast toast-${type}`;
  div.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${msg}</span>`;
  container.appendChild(div);
  setTimeout(() => {
    div.classList.add("toast-out");
    setTimeout(() => div.remove(), 300);
  }, 3000);
}
// --------------------------

const updatePrivacyIcon = () => {
  btnPrivacyList.forEach(btn => {
    btn.innerHTML = isMoneyVisible ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>';
  });
};

// Chạy 1 lần khi mở app
updatePrivacyIcon();

// Khi bấm nút
btnPrivacyList.forEach(btn => {
  btn.onclick = () => {
    isMoneyVisible = !isMoneyVisible; // Đảo ngược trạng thái
    localStorage.setItem('money_visible', isMoneyVisible); // Lưu vào bộ nhớ
    updatePrivacyIcon(); // Đổi icon
    render(); // Cập nhật lại giao diện ngay lập tức
  };
});
// ===============================


const COL = collection(db, "work_logs");
const SCH_COL = collection(db, "work_schedule");
let USER_WAGE = parseInt(localStorage.getItem('shift_wage')) || 25000;
let TARGET_HOURS = parseInt(localStorage.getItem('kaito_target_hours')) || 200;
let TARGET_DAYS = parseInt(localStorage.getItem('kaito_target_days')) || 27;
let APP_NAME = localStorage.getItem('kaito_app_name') || "KAITO";

function applyCustomSettings() {
  const loading = document.getElementById("appNameLoading");
  if (loading) loading.innerText = APP_NAME;
  const auth = document.getElementById("appNameAuth");
  if (auth) auth.innerText = APP_NAME;
}
setTimeout(applyCustomSettings, 100);

// === GREETING SYSTEM ===
function updateGreeting() {
  const hour = new Date().getHours();
  const helloEl = document.getElementById("greetingHello");
  const subEl = document.getElementById("greetingSub");
  const sectionEl = document.getElementById("greetingSection");
  if (!helloEl || !subEl || !sectionEl) return;
  
  let hello, sub, slot;
  if (hour >= 5 && hour < 12) {
    hello = "Chào buổi sáng,";
    sub = "Làm đi mấy cu em!";
    slot = "morning";
  } else if (hour >= 12 && hour < 14) {
    hello = "Buổi trưa rồi cu,";
    sub = "Kiếm chi đớp đi rồi làm cu!";
    slot = "noon";
  } else if (hour >= 14 && hour < 18) {
    hello = "Chào buổi chiều,";
    sub = "Roán đi sắp được về rồi!";
    slot = "afternoon";
  } else if (hour >= 18 && hour < 22) {
    hello = "Chào buổi tối,";
    sub = "Dề tắm miếng rồi mai làm tiếp :)))!";
    slot = "evening";
  } else {
    hello = "Khuya rồi,";
    sub = "Giờ ni vô chấm công làm đ gì =)))??!";
    slot = "night";
  }
  helloEl.innerText = hello;
  subEl.innerText = sub;

  // Luôn hiển thị popup mỗi khi vào web
  sectionEl.style.display = "flex";
  sectionEl.classList.remove("hide");
  
  // Tự động ẩn sau 3 giây
  setTimeout(() => {
    sectionEl.classList.add("hide");
    setTimeout(() => sectionEl.style.display = "none", 400);
  }, 3000);
}
updateGreeting();

const CLOUD_NAME = "do48qpmut"; 
const UPLOAD_PRESET = "fora";

const $ = q => document.querySelector(q);
const fmtMoney = n => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
const getDayName = (d) => ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()];

let selectedShift = null;
let customMode = false;
let isLoggingSchedule = false;
let editModeId = null;

let viewMonth = new Date().getMonth();
let viewYear = new Date().getFullYear();
let diaryViewMode = localStorage.getItem('kaito_diary_view') || 'timeline';

// --- DYNAMIC SHIFTS ---
const DEFAULT_SHIFTS = [
  { start: "07:30", end: "12:30" },
  { start: "07:30", end: "15:30" },
  { start: "12:30", end: "17:30" },
  { start: "14:30", end: "22:30" },
  { start: "15:30", end: "22:30" },
  { start: "17:30", end: "22:30" },
  { start: "18:30", end: "22:30" }
];
let savedShifts = JSON.parse(localStorage.getItem('preset_shifts')) || DEFAULT_SHIFTS;

function renderShifts() {
  const grid = $("#shiftGrid");
  if (!grid) return;
  grid.innerHTML = "";
  savedShifts.forEach((s, idx) => {
    const btn = document.createElement("button");
    btn.className = "shift-btn";
    btn.dataset.start = s.start;
    btn.dataset.end = s.end;
    btn.innerHTML = `${s.start} - ${s.end} <button class="btn-delete-shift" onclick="deleteShiftPreset(event, ${idx})"><i class="fa-solid fa-xmark"></i></button>`;
    grid.appendChild(btn);
  });

  const customBtn = document.createElement("button");
  customBtn.type = "button";
  customBtn.className = "shift-btn";
  customBtn.dataset.custom = "true";
  customBtn.innerHTML = "➕ Ca khác";
  grid.appendChild(customBtn);
}

window.deleteShiftPreset = (e, idx) => {
  e.stopPropagation();
  if(confirm("Bạn có chắc muốn xóa ca mẫu này?")) {
    savedShifts.splice(idx, 1);
    localStorage.setItem('preset_shifts', JSON.stringify(savedShifts));
    renderShifts();
    showToast("Đã xóa ca mẫu", "success");
  }
};

renderShifts(); // Gọi ngay khi load trang
// ----------------------

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".shift-btn");
  if (!btn) return;

  document
    .querySelectorAll(".shift-btn")
    .forEach(b => b.classList.remove("active"));

  btn.classList.add("active");

  if (btn.dataset.custom) {

    customMode = true;

    $("#customShift").style.display = "block";

    selectedShift = null;

    return;
  }

  customMode = false;

  $("#customShift").style.display = "none";

  selectedShift = {
    start: btn.dataset.start,
    end: btn.dataset.end
  };
});

// --- UPLOAD ---
async function upload(file) {
  if (!file) return null;
  const f = new FormData();
  f.append("file", file);
  f.append("upload_preset", UPLOAD_PRESET);
  try {
    const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: f });
    const d = await r.json();
    return d.secure_url || null;
  } catch (e) { return null; }
}

// --- TABS & MODALS ---
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    const target = btn.getAttribute("data-target");
    document.getElementById(target).classList.add("active");
  };
});

if ($("#btnGoToDiary")) {
  $("#btnGoToDiary").onclick = () => {
    const diaryTabBtn = document.querySelector(".tab-btn[data-target='tab-diary']");
    if (diaryTabBtn) diaryTabBtn.click();
  };
}

const toggleModal = (show) => $("#logModal").classList.toggle("hidden", !show);

$("#fab").onclick = () => {
  isLoggingSchedule = false;
  $("#modalTitle").innerText = "Ca làm việc mới";
  $("#inpNote").closest('.field-group').style.display = "block";

  $("#customShift").style.display = "none";
  $("#customStart").value = "";
  $("#customEnd").value = "";
  
  const chk = $("#chkSavePreset");
  if(chk) chk.checked = false;

  customMode = false;
  selectedShift = null;

  renderShifts(); // Tự xóa các class active cũ

  $("#workDate").value =
    new Date().toISOString().split("T")[0];

  $("#inpNote").value = "";
  $("#btnSave").innerText = "Lưu lại";
  editModeId = null;
  toggleModal(true);
};

$("#fab-schedule").onclick = () => {
  isLoggingSchedule = true;
  $("#modalTitle").innerText = "Thêm lịch làm việc";
  $("#inpNote").closest('.field-group').style.display = "none";

  $("#customShift").style.display = "none";
  $("#customStart").value = "";
  $("#customEnd").value = "";
  
  const chk = $("#chkSavePreset");
  if(chk) chk.checked = false;

  customMode = false;
  selectedShift = null;

  renderShifts(); 

  $("#workDate").value =
    new Date().toISOString().split("T")[0];

  $("#inpNote").value = "";

  toggleModal(true);
};

$("#btnCancel").onclick = () => { toggleModal(false); editModeId = null; };
$("#btnCloseTop").onclick = () => { toggleModal(false); editModeId = null; };

$("#btnSave").onclick = async () => {
  if (customMode) {
    const cS = $("#customStart").value;
    const cE = $("#customEnd").value;
    if (!cS || !cE) {
      showToast("Nhập đủ giờ bắt đầu và kết thúc bro", "error");
      return;
    }
    selectedShift = { start: cS, end: cE };
    
    // Lưu ca mẫu nếu được tick
    const chk = $("#chkSavePreset");
    if (chk && chk.checked) {
      const exists = savedShifts.some(s => s.start === cS && s.end === cE);
      if(!exists) {
        savedShifts.push({ start: cS, end: cE });
        savedShifts.sort((a,b) => a.start.localeCompare(b.start));
        localStorage.setItem('preset_shifts', JSON.stringify(savedShifts));
      }
    }
  }

  if (!selectedShift) {
    showToast("Chọn ca trước bro", "error");
    return;
  }

  const workDate = $("#workDate").value;

  if (!workDate) {
    showToast("Chọn ngày trước bro", "error");
    return;
  }

  let start = new Date(`${workDate}T${selectedShift.start}`).getTime();
  let end = new Date(`${workDate}T${selectedShift.end}`).getTime();

  if (start >= end) { end += 86400000; }
  
  $("#btnSave").innerText = "Đang lưu..."; $("#btnSave").disabled = true;
  const dur = end - start;

  if (isLoggingSchedule) {
    if (editModeId) {
      await updateDoc(doc(db, "work_schedule", editModeId), { start, end, duration: dur });
      showToast("Cập nhật lịch thành công!", "success");
    } else {
      await addDoc(SCH_COL, { start, end, duration: dur, uid: auth.currentUser.uid });
      showToast("Thêm lịch thành công!", "success");
    }
  } else {
    const wage = Math.round(USER_WAGE * (dur / 3600000));
    if (editModeId) {
      await updateDoc(doc(db, "work_logs", editModeId), { start, end, duration: dur, totalMoney: wage, note: $("#inpNote").value });
      showToast("Cập nhật ca làm thành công!", "success");
    } else {
      await addDoc(COL, { start, end, duration: dur, wageRate: USER_WAGE, totalMoney: wage, note: $("#inpNote").value, uid: auth.currentUser.uid });
      showToast("Lưu ca làm thành công!", "success");
    }
  }

  $("#btnSave").innerText = "Lưu lại"; $("#btnSave").disabled = false;
  toggleModal(false); 
  if (isLoggingSchedule) renderSchedule(); else render();
};

// --- RENDER SCHEDULE ---
async function renderSchedule() {
  const tl = $("#schedule-timeline");
  tl.innerHTML = `<div id="skeletonLoader"><div class="skeleton-card"></div></div>`;
  const q = query(SCH_COL, where("uid", "==", auth.currentUser.uid));
  const snap = await getDocs(q);
  const schLogs = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.start - b.start);
  
  tl.innerHTML = "";
  if (schLogs.length === 0) {
    tl.innerHTML = `<div style="text-align:center; padding: 40px 20px; color: var(--text-muted);">Cụ chưa có lịch trình nào sắp tới.</div>`;
    return;
  }

  schLogs.forEach((l, idx) => {
    const d = new Date(l.start);
    const wk = getDayName(d);
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const sT = new Date(l.start).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit', hour12: false});
    const eT = new Date(l.end).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit', hour12: false});
    const h = (l.duration/3600000).toFixed(1);

    // Check if schedule is today
    const today = new Date();
    const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();

    const div = document.createElement("div");
    div.className = `sch-card${isToday ? ' sch-today' : ''}`;
    div.style.animationDelay = `${idx * 0.07}s`;
    
    div.innerHTML = `
      <div class="sch-top">
        <div class="sch-date-badge">
          <span class="sch-weekday">${wk}</span>
          <span class="sch-day">${day}/${month}</span>
        </div>
        <div class="sch-time-info">
          <div class="sch-time">${sT} – ${eT}</div>
          <span class="sch-dur">${h} giờ</span>
        </div>
      </div>
      <div class="sch-bottom">
        <div class="sch-actions-left">
          <button class="sch-btn-edit" onclick="editSchedule('${l.id}', ${l.start}, ${l.end})" title="Sửa lịch này"><i class="fa-solid fa-pen-to-square"></i></button>
          <button class="sch-btn-del" onclick="delSchedule('${l.id}')" title="Xóa lịch này"><i class="fa-solid fa-trash-can"></i></button>
        </div>
        <button class="sch-btn-checkin" onclick="checkIn('${l.id}', ${l.start}, ${l.end}, ${l.duration})">
          <i class="fa-solid fa-circle-check"></i> Chấm công
        </button>
      </div>
    `;
    tl.appendChild(div);
  });
}

window.checkIn = async (id, start, end, duration) => {
  if(!confirm("Đã hoàn thành ca này và ném vào Nhật Ký Lương?")) return;
  const wage = Math.round(USER_WAGE * (duration / 3600000));
  await addDoc(COL, { start, end, duration: duration, wageRate: USER_WAGE, totalMoney: wage, note: "", uid: auth.currentUser.uid });
  await deleteDoc(doc(db,"work_schedule",id));
  showToast("Chấm công thành công!", "success");
  renderSchedule();
  render();

};

// --- RENDER ---
async function render() {
  const tl = $("#timeline");
  const calView = $("#calendar-view");
  const skel = $("#skeletonLoader");
  if(!skel || !tl.contains(skel)) tl.innerHTML = `<div id="skeletonLoader"><div class="skeleton-card"></div></div>`;

  const q = query(COL, where("uid", "==", auth.currentUser.uid));
  const snap = await getDocs(q);
  const logs = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.start - a.start);

  tl.innerHTML = ""; 
  if (calView) calView.innerHTML = "";
  
  let mHours = 0, mMoney = 0, totalDurationAll = 0, totalMoneyAll = 0;
  
  logs.forEach(l => { totalDurationAll += l.duration || 0; });

  const filteredLogs = logs.filter(l => {
    const d = new Date(l.start);
    return d.getMonth() === viewMonth && d.getFullYear() === viewYear;
  });

  const monthKey = `Tháng ${viewMonth + 1}/${viewYear}`;
  $("#lblCurrentMonth").innerText = monthKey;

  // View Mode Logic
  if (diaryViewMode === 'calendar') {
    tl.style.display = 'none';
    if (calView) {
      calView.style.display = 'block';
      renderCalendar(filteredLogs, viewMonth, viewYear, calView);
    }
  } else {
    if (calView) calView.style.display = 'none';
    tl.style.display = ''; // Clear inline display so it uses CSS default
  }

  if (filteredLogs.length === 0) {
    tl.innerHTML = `<div style="text-align:center; padding: 40px 20px; color: var(--text-muted);">Không có ca làm nào trong ${monthKey}.</div>`;
  } else {
    const header = document.createElement("div"); header.className = "timeline-header";
    header.innerHTML = `<h3 style="margin:15px 0 10px 0; font-size:0.9rem; opacity:0.7">Nhật ký ${monthKey}</h3>`;
    tl.appendChild(header);

    filteredLogs.forEach((l, idx) => {
      mHours += (l.duration || 0);
      const d = new Date(l.start);
      const wk = getDayName(d);
      const day = d.getDate();
      const sT = new Date(l.start).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit', hour12: false});
      const eT = new Date(l.end).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit', hour12: false});
      const h = (l.duration/3600000).toFixed(1);
      const safeNote = (l.note || "").replace(/'/g, "\\'");
      
      // BADGES Logic
      let badges = '';
      if(d.getDay()===0||d.getDay()===6) badges += `<span class="badge-tag tag-weekend">WEEKEND</span>`;

      const div = document.createElement("div");
      div.className = "work-card";
      div.style.animationDelay = `${idx * 0.05}s`;
      
      div.innerHTML = `
        <div class="card-date">
          <span class="d-weekday">${wk}</span>
          <span class="d-day">${day}</span>
        </div>
        <div class="card-content">
          <div class="row-top">
            <span class="time-range">${sT} - ${eT}</span>
            <span class="dur-tag">${h}h</span>
          </div>
          <div class="row-btm">
            ${badges}
            <div class="note-text">
              ${l.note ? `<i class="fa-solid fa-note-sticky"></i> ${l.note}` : '...'}
            </div>
            ${l.image ? `<a href="${l.image}" target="_blank" style="color:var(--primary)"><i class="fa-solid fa-image"></i></a>` : ''}
          </div>
        </div>
        <div class="card-actions">
          <div class="wage-display">${fmtMoney(Math.round((l.duration/3600000) * USER_WAGE))}</div>
          <div class="act-btns">
            <button class="btn-mini" onclick="editLog('${l.id}', ${l.start}, ${l.end}, '${safeNote}')" title="Sửa ca làm"><i class="fa-solid fa-pen"></i></button>
            <button class="btn-mini del" onclick="del('${l.id}')" title="Xóa ca làm"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      `;
      tl.appendChild(div);
    });
  }

  const totalHours = parseFloat((mHours / 3600000).toFixed(1));
  const grandTotalHours = parseFloat((totalDurationAll / 3600000).toFixed(1));
  
  mMoney = totalHours * USER_WAGE;
  totalMoneyAll = grandTotalHours * USER_WAGE;

  const uniqueDays = new Set(filteredLogs.map(l => new Date(l.start).getDate())).size;
  const allTimeUniqueDays = new Set(logs.map(l => new Date(l.start).toLocaleDateString())).size;

  animateValue("monthHours", 0, totalHours, 1000, (v) => v.toFixed(1));
  animateValue("monthDays", 0, uniqueDays, 1000, (v) => Math.round(v));

  // Update Overview Dashboard Stats
  $("#overviewCurrentTitle").innerText = `Tháng ${viewMonth + 1}/${viewYear}`;
  animateValue("overviewMonthHours", 0, totalHours, 1200, (v) => v.toFixed(1));
  animateValue("overviewMonthDays", 0, uniqueDays, 1200, (v) => Math.round(v));
  
  // Group logs by month for the history list
  const monthData = {};
  logs.forEach(l => {
    const d = new Date(l.start);
    const key = `${d.getMonth() + 1}/${d.getFullYear()}`;
    if (!monthData[key]) {
      monthData[key] = { month: d.getMonth(), year: d.getFullYear(), hours: 0, days: new Set() };
    }
    monthData[key].hours += (l.duration || 0);
    monthData[key].days.add(d.getDate());
  });

  const overviewList = document.getElementById("overviewMonthList");
  if (overviewList) {
    overviewList.innerHTML = "";
    const sortedKeys = Object.keys(monthData).sort((a, b) => {
      const [mA, yA] = a.split("/").map(Number);
      const [mB, yB] = b.split("/").map(Number);
      if (yA !== yB) return yB - yA;
      return mB - mA;
    });

    sortedKeys.forEach(k => {
      const mInfo = monthData[k];
      const mTotalHours = mInfo.hours / 3600000;
      const mTotalMoney = mTotalHours * USER_WAGE;
      
      const div = document.createElement("div");
      div.className = "rpg-history-card";
      div.onclick = () => {
        viewMonth = mInfo.month;
        viewYear = mInfo.year;
        render();
        const diaryTabBtn = document.querySelector(".tab-btn[data-target='tab-diary']");
        if (diaryTabBtn) diaryTabBtn.click();
      };
      
      div.innerHTML = `
        <i class="fa-solid fa-scroll" style="font-size: 1.2rem; margin-right: 12px;"></i>
        <span class="rpg-history-title" style="flex: 1;">Tháng ${k}</span>
        <i class="fa-solid fa-chevron-right" style="font-size: 0.9rem;"></i>
      `;
      overviewList.appendChild(div);
    });
  }

  // LOGIC KIỂM TRA ĐỂ ẨN/HIỆN TIỀN (MỚI)
  if (isMoneyVisible) {
    animateValue("monthMoney", 0, mMoney, 1200, fmtMoney);
    animateValue("totalMoney", 0, totalMoneyAll, 1200, (v) => "Tổng: " + fmtMoney(v));
    animateValue("overviewMonthMoney", 0, mMoney, 1200, fmtMoney);
  } else {
    $("#monthMoney").innerText = "******";
    $("#totalMoney").innerText = "Tổng: ******";
    $("#overviewMonthMoney").innerText = "******";
  }
  
  // Progress Ring
  const circle = document.getElementById("progressCircle");
  if(circle) {
    circle.style.transition = "none";
    circle.style.strokeDashoffset = 213; // Reset to 0
    setTimeout(() => {
      circle.style.transition = "stroke-dashoffset 1s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
      const p = Math.min(totalHours/TARGET_HOURS, 1);
      circle.style.strokeDashoffset = 213 - (213 * p); 
      if(p>=1) {
        circle.style.stroke = "#00ffaa";
        if(monthKey && localStorage.getItem('confetti_' + monthKey) !== 'true') {
           if(typeof confetti === 'function') {
             confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, zIndex: 9999, colors: ['#bc13fe', '#00ffaa', '#ffffff'] });
             localStorage.setItem('confetti_' + monthKey, 'true');
             setTimeout(() => showToast("Chúc mừng bro đã hoàn thành mục tiêu tháng!", "success"), 1000);
           }
        }
      } else {
        circle.style.stroke = "#00ffaa"; // Màu chuẩn
      }
    }, 50);
  }

  // Days Progress Ring
  const daysCircle = document.getElementById("progressDaysCircle");
  if(daysCircle) {
    daysCircle.style.transition = "none";
    daysCircle.style.strokeDashoffset = 213;
    setTimeout(() => {
      daysCircle.style.transition = "stroke-dashoffset 1s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
      const pDays = Math.min(uniqueDays / TARGET_DAYS, 1);
      daysCircle.style.strokeDashoffset = 213 - (213 * pDays); 
      daysCircle.style.stroke = pDays >= 1 ? "#00ffaa" : "#b5a5e3";
    }, 50);
  }

  // Mascot text
  const mascotEl = document.getElementById("mascotText");
  if(mascotEl) {
    if (uniqueDays >= TARGET_DAYS) mascotEl.innerText = `Đủ ${TARGET_DAYS} công!`;
    else if (uniqueDays >= TARGET_DAYS * 0.75) mascotEl.innerText = `Còn ${TARGET_DAYS - uniqueDays} công nữa!`;
    else if (uniqueDays >= TARGET_DAYS * 0.35) mascotEl.innerText = `${uniqueDays}/${TARGET_DAYS}`;
    else mascotEl.innerText = `${uniqueDays}/${TARGET_DAYS} công`;
  }
}

window.updateNote = async (id, old) => { const n = prompt("Sửa ghi chú:", old); if(n!==null) { await updateDoc(doc(db,"work_logs",id),{note:n}); render(); }};
window.del = async (id) => { if(confirm("Xóa ca làm này khỏi Nhật Ký?")) { await deleteDoc(doc(db,"work_logs",id)); render(); }};
window.delSchedule = async (id) => { if(confirm("Hủy lịch làm việc này?")) { await deleteDoc(doc(db,"work_schedule",id)); showToast("Đã xóa lịch!", "success"); renderSchedule(); }};

window.editLog = (id, start, end, note) => {
  editModeId = id;
  isLoggingSchedule = false;
  openEditModal("Sửa ca làm", start, end, note);
};

window.editSchedule = (id, start, end) => {
  editModeId = id;
  isLoggingSchedule = true;
  openEditModal("Sửa lịch làm", start, end, "");
};

function openEditModal(title, start, end, note) {
  const d = new Date(start);
  const sT = new Date(start).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit', hour12: false});
  const eT = new Date(end).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit', hour12: false});

  $("#workDate").value = d.toISOString().split("T")[0];
  $("#customStart").value = sT;
  $("#customEnd").value = eT;
  $("#inpNote").value = note;
  
  $("#modalTitle").innerText = title;
  $("#inpNote").closest('.field-group').style.display = isLoggingSchedule ? "none" : "block";
  
  // Set custom mode
  document.querySelectorAll(".shift-btn").forEach(b => b.classList.remove("active", "selected"));
  $("#customShift").style.display = "block";
  customMode = true;
  selectedShift = { start: sT, end: eT };
  
  const chk = $("#chkSavePreset");
  if(chk) chk.checked = false;

  $("#btnSave").innerText = "Cập nhật";
  toggleModal(true);
}
// === SETTINGS MODAL ===
const settingsModal = $("#settingsModal");
const toggleSettings = (show) => settingsModal.classList.toggle("hidden", !show);

// Open
$("#btnSettings").onclick = () => {
  $("#inpWage").value = USER_WAGE;
  const inpAppName = $("#inpAppName"); if(inpAppName) inpAppName.value = APP_NAME;
  const inpTargetHours = $("#inpTargetHours"); if(inpTargetHours) inpTargetHours.value = TARGET_HOURS;
  const inpTargetDays = $("#inpTargetDays"); if(inpTargetDays) inpTargetDays.value = TARGET_DAYS;
  const chkShowSprites = $("#chkShowSprites"); if(chkShowSprites) chkShowSprites.checked = localStorage.getItem('kaito_show_sprites') !== 'false';
  
  // Highlight active theme
  const saved = localStorage.getItem('kaito_theme') || 'default';
  document.querySelectorAll(".theme-dot").forEach(d => {
    d.classList.toggle("active", d.dataset.theme === saved);
  });
  
  toggleSettings(true);
};

// Close
$("#btnCloseSettings").onclick = () => toggleSettings(false);
$("#btnCloseSettingsBottom").onclick = () => {
  // Save wage
  const w = parseInt($("#inpWage").value);
  if (w && w > 0) {
    USER_WAGE = w;
    localStorage.setItem('shift_wage', USER_WAGE);
  }
  
  const inpAppName = $("#inpAppName");
  if (inpAppName) {
    APP_NAME = inpAppName.value.trim() || "KAITO";
    localStorage.setItem('kaito_app_name', APP_NAME);
  }
  
  const th = parseInt($("#inpTargetHours").value);
  if (th && th > 0) {
    TARGET_HOURS = th;
    localStorage.setItem('kaito_target_hours', TARGET_HOURS);
  }
  
  const td = parseInt($("#inpTargetDays").value);
  if (td && td > 0) {
    TARGET_DAYS = td;
    localStorage.setItem('kaito_target_days', TARGET_DAYS);
  }
  
  const chkShowSprites = $("#chkShowSprites");
  if (chkShowSprites) {
    const wasShowing = localStorage.getItem('kaito_show_sprites') !== 'false';
    const isShowing = chkShowSprites.checked;
    localStorage.setItem('kaito_show_sprites', isShowing);
    if (wasShowing !== isShowing) {
      showToast("Tải lại trang để áp dụng cài đặt thú cưng!", "success");
    }
  }


  applyCustomSettings();
  render();
  toggleSettings(false);
  showToast("Đã lưu cài đặt!", "success");
};

// Theme switching
function applyTheme(name) {
  document.body.className = name === 'default' ? '' : `theme-${name}`;
  localStorage.setItem('kaito_theme', name);
  
  // Update active dot
  document.querySelectorAll(".theme-dot").forEach(d => {
    d.classList.toggle("active", d.dataset.theme === name);
  });
}

// Load saved theme on start
const savedTheme = localStorage.getItem('kaito_theme') || 'default';
applyTheme(savedTheme);

// Theme dot click
document.querySelectorAll(".theme-dot").forEach(dot => {
  dot.onclick = () => applyTheme(dot.dataset.theme);
});

// === CUSTOM LOGO ===
const DEFAULT_LOGO = "logo.png";

function applyCustomLogo(src) {
  document.querySelectorAll(".logo-img").forEach(img => img.src = src);
  const preview = $("#logoPreviewImg");
  if (preview) preview.src = src;
  const favicon = $("#favicon"); if (favicon) favicon.href = src;
  // Cập nhật tất cả apple-touch-icon
  document.querySelectorAll('link[rel="apple-touch-icon"]').forEach(link => link.href = src);

  // Gửi ảnh cho Service Worker để cache, iOS sẽ lấy từ SW khi Add to Home Screen
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    if (src && src.startsWith('data:')) {
      navigator.serviceWorker.controller.postMessage({ type: 'SET_CUSTOM_LOGO', logo: src });
    }
  }
}

function loadSavedLogo() {
  const saved = localStorage.getItem('kaito_custom_logo');
  if (saved) applyCustomLogo(saved);
}

// Load on start
loadSavedLogo();

// Click preview to trigger file input
$("#logoPreviewWrap").onclick = () => $("#inpLogoFile").click();

// Handle file selection
$("#inpLogoFile").onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  // Validate file type
  if (!file.type.startsWith('image/')) {
    showToast("Chỉ chấp nhận file ảnh!", "error");
    return;
  }
  
  // Validate file size (max 2MB)
  if (file.size > 2 * 1024 * 1024) {
    showToast("Ảnh quá lớn! Tối đa 2MB.", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    // Compress image via canvas
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 256; // resize to 256x256
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      
      // Crop to square center
      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = (img.height - minDim) / 2;
      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
      
      const dataURL = canvas.toDataURL('image/jpeg', 0.85);
      localStorage.setItem('kaito_custom_logo', dataURL);
      applyCustomLogo(dataURL);
      showToast("Đã thay đổi ảnh đại diện!", "success");
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = ''; // Reset input
};

// Reset logo
$("#btnResetLogo").onclick = (e) => {
  e.stopPropagation();
  localStorage.removeItem('kaito_custom_logo');
  applyCustomLogo(DEFAULT_LOGO);
  // Xóa cache custom logo trong SW
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CUSTOM_LOGO' });
  }
  showToast("Đã khôi phục logo mặc định!", "success");
};

$("#btnPrevMonth").onclick = () => {
  viewMonth--;
  if(viewMonth < 0) { viewMonth = 11; viewYear--; }
  render();
};

$("#btnNextMonth").onclick = () => {
  viewMonth++;
  if(viewMonth > 11) { viewMonth = 0; viewYear++; }
  render();
};

const btnRescue = $("#btnRescue");
if (btnRescue) {
  btnRescue.onclick = async () => {
    const oldUid = prompt("Nhập UID cũ của tài khoản bị mất pass (ví dụ: YpVDNW6...):");
    if(!oldUid) return;
    if(!confirm(`Chắc chắn muốn chuyển toàn bộ dữ liệu từ UID [${oldUid}] sang tài khoản hiện tại không?`)) return;
    try {
      btnRescue.disabled = true;
      let count = 0;
      
      const snapLogs = await getDocs(COL);
      for (let d of snapLogs.docs) {
        if (d.data().uid === oldUid) {
          await updateDoc(doc(db, "work_logs", d.id), { uid: auth.currentUser.uid });
          count++;
        }
      }

      const snapSch = await getDocs(SCH_COL);
      for (let d of snapSch.docs) {
        if (d.data().uid === oldUid) {
          await updateDoc(doc(db, "work_schedule", d.id), { uid: auth.currentUser.uid });
          count++;
        }
      }

      showToast(`Đã cứu thành công ${count} mục từ UID cũ!`, "success");
      render();
      renderSchedule();
    } catch(e) {
      showToast("Lỗi: " + e.message, "error");
    } finally {
      btnRescue.disabled = false;
    }
  };
}

// --- AUTH LOGIC ---
const authScreen = $("#authScreen");
const mainApp = $("#mainApp");
const btnTabLogin = $("#btnTabLogin");
const btnTabRegister = $("#btnTabRegister");
const authForm = $("#authForm");
const btnLogout = $("#btnLogout");

let isRegistering = false;

btnTabLogin.onclick = () => {
  isRegistering = false;
  btnTabLogin.classList.add("active");
  btnTabRegister.classList.remove("active");
  $("#btnAuthSubmit").innerText = "Đăng Nhập";
};

btnTabRegister.onclick = () => {
  isRegistering = true;
  btnTabRegister.classList.add("active");
  btnTabLogin.classList.remove("active");
  $("#btnAuthSubmit").innerText = "Đăng Ký";
};

authForm.onsubmit = async (e) => {
  e.preventDefault();
  const username = $("#authUsername").value.trim().toLowerCase();
  const password = $("#authPassword").value;
  
  if (!username.match(/^[a-z0-9_]+$/)) {
    showToast("Tên đăng nhập viết liền không dấu, không ký tự đặc biệt nhé bro!", "error");
    return;
  }
  
  if (password.length < 6) {
    showToast("Mật khẩu phải có ít nhất 6 ký tự nha bro!", "error");
    return;
  }

  const email = `${username}@kaito.app`;

  try {
    $("#btnAuthSubmit").innerText = "Đang xử lý...";
    if (isRegistering) {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCred.user, { displayName: username });
      showToast("Đăng ký thành công!", "success");
    } else {
      await signInWithEmailAndPassword(auth, email, password);
      showToast("Đăng nhập thành công!", "success");
    }
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      showToast("Tên này có người lấy mất rồi!", "error");
    } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
      showToast("Sai tên hoặc mật khẩu rồi bro!", "error");
    } else {
      showToast("Lỗi: " + err.message, "error");
    }
    $("#btnAuthSubmit").innerText = isRegistering ? "Đăng Ký" : "Đăng Nhập";
  }
};

if (btnLogout) {
  btnLogout.onclick = async () => {
    await signOut(auth);
  };
}

let isInitialLoad = true;
onAuthStateChanged(auth, (user) => {
  if (isInitialLoad) {
    const loader = document.getElementById("loadingScreen");
    if (loader) loader.style.display = "none";
    isInitialLoad = false;
  }
  
  if (user) {
    if (authScreen) authScreen.style.display = "none";
    if (mainApp) mainApp.style.display = "block";
    const lblUserName = $("#lblUserName");
    if (lblUserName) lblUserName.innerText = user.displayName || user.email.split('@')[0];
    const lblUserRole = $("#lblUserRole");
    if (lblUserRole) lblUserRole.innerText = "KIN";
    render();
    renderSchedule();
  } else {
    if (authScreen) authScreen.style.display = "flex";
    if (mainApp) mainApp.style.display = "none";
    if (authForm) authForm.reset();
    $("#btnAuthSubmit").innerText = isRegistering ? "Đăng Ký" : "Đăng Nhập";
  }
});

// === CALENDAR LOGIC ===
function renderCalendar(logs, month, year, container) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  
  // Create Header
  const header = document.createElement("div");
  header.className = "calendar-header";
  ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].forEach(day => {
    header.innerHTML += `<div>${day}</div>`;
  });
  container.appendChild(header);

  // Create Grid
  const grid = document.createElement("div");
  grid.className = "calendar-grid";
  
  for (let i = 0; i < firstDayIndex; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "cal-day empty";
    grid.appendChild(emptyCell);
  }
  
  const today = new Date();
  
  for (let d = 1; d <= daysInMonth; d++) {
    const dayCell = document.createElement("div");
    dayCell.className = "cal-day";
    dayCell.innerHTML = `<span class="cal-day-num">${d}</span>`;
    
    if (today.getDate() === d && today.getMonth() === month && today.getFullYear() === year) {
      dayCell.classList.add("today");
    }
    
    const dayLogs = logs.filter(l => new Date(l.start).getDate() === d);
    if (dayLogs.length > 0) {
      dayCell.classList.add("has-shift");
      
      const shiftDots = document.createElement("div");
      shiftDots.className = "shift-dots";
      
      let hasMorning = false;
      let hasAfternoon = false;
      let hasEvening = false;
      
      dayLogs.forEach(l => {
        const hour = new Date(l.start).getHours();
        if (hour >= 5 && hour < 12) hasMorning = true;
        else if (hour >= 12 && hour < 17) hasAfternoon = true;
        else hasEvening = true;
      });
      
      if (hasMorning) shiftDots.innerHTML += `<div class="shift-dot morning" title="Ca sáng"></div>`;
      if (hasAfternoon) shiftDots.innerHTML += `<div class="shift-dot afternoon" title="Ca chiều"></div>`;
      if (hasEvening) shiftDots.innerHTML += `<div class="shift-dot evening" title="Ca tối"></div>`;
      
      dayCell.appendChild(shiftDots);
      
      dayCell.onclick = () => showDayDetail(d, month, year, dayLogs);
    }
    
    grid.appendChild(dayCell);
  }
  container.appendChild(grid);
  
  // Create Legend
  const legend = document.createElement("div");
  legend.className = "calendar-legend";
  legend.innerHTML = `
    <div class="legend-item"><div class="shift-dot morning"></div> Ca sáng</div>
    <div class="legend-item"><div class="shift-dot afternoon"></div> Ca chiều</div>
    <div class="legend-item"><div class="shift-dot evening"></div> Ca tối</div>
  `;
  container.appendChild(legend);
}

window.showDayDetail = function(day, month, year, dayLogs) {
  const list = $("#dayDetailList");
  if (!list) return;
  
  $("#dayDetailTitle").innerText = `Ngày ${day}/${month + 1}/${year}`;
  list.innerHTML = "";
  
  dayLogs.forEach((l, idx) => {
      const sT = new Date(l.start).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit', hour12: false});
      const eT = new Date(l.end).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit', hour12: false});
      const h = (l.duration/3600000).toFixed(1);
      const safeNote = (l.note || "").replace(/'/g, "\\'");
      
      const div = document.createElement("div");
      div.className = "work-card";
      
      div.innerHTML = `
        <div class="card-content" style="flex: 1;">
          <div class="row-top">
            <span class="time-range">${sT} - ${eT}</span>
            <span class="dur-tag">${h}h</span>
          </div>
          <div class="row-btm">
            <div class="note-text">
              ${l.note ? `<i class="fa-solid fa-note-sticky"></i> ${l.note}` : '...'}
            </div>
            ${l.image ? `<a href="${l.image}" target="_blank" style="color:var(--primary)"><i class="fa-solid fa-image"></i></a>` : ''}
          </div>
        </div>
        <div class="card-actions">
          <div class="wage-display">${fmtMoney(Math.round((l.duration/3600000) * USER_WAGE))}</div>
          <div class="act-btns">
            <button class="btn-mini" onclick="editLog('${l.id}', ${l.start}, ${l.end}, '${safeNote}')" title="Sửa"><i class="fa-solid fa-pen"></i></button>
            <button class="btn-mini del" onclick="del('${l.id}')" title="Xóa"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      `;
      list.appendChild(div);
  });
  
  $("#dayDetailModal").classList.remove("hidden");
  $("#dayDetailModal").style.display = "flex";
};

// TOGGLE EVENT LISTENERS
const btnViewTimeline = $("#btnViewTimeline");
const btnViewCalendar = $("#btnViewCalendar");
const btnCloseDayDetail = $("#btnCloseDayDetail");

if (btnViewTimeline && btnViewCalendar) {
  const updateToggleUI = () => {
    if (diaryViewMode === 'timeline') {
      btnViewTimeline.classList.add('active');
      btnViewCalendar.classList.remove('active');
    } else {
      btnViewCalendar.classList.add('active');
      btnViewTimeline.classList.remove('active');
    }
  };
  
  updateToggleUI(); // Init
  
  btnViewTimeline.onclick = () => {
    diaryViewMode = 'timeline';
    localStorage.setItem('kaito_diary_view', diaryViewMode);
    updateToggleUI();
    render();
  };
  
  btnViewCalendar.onclick = () => {
    diaryViewMode = 'calendar';
    localStorage.setItem('kaito_diary_view', diaryViewMode);
    updateToggleUI();
    render();
  };
}

if (btnCloseDayDetail) {
  btnCloseDayDetail.onclick = () => {
    $("#dayDetailModal").classList.add("hidden");
    setTimeout(() => {
      $("#dayDetailModal").style.display = "none";
    }, 200);
  };
}