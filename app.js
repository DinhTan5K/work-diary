import { db, auth } from "./firebase.js"; 
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";



// === THEME REMOVED - NOW USING UNIFIED CLEAN UI ===

// === LOGIC ẨN/HIỆN TIỀN (MỚI) ===
let isMoneyVisible = localStorage.getItem('money_visible') === 'true'; // Lấy trạng thái đã lưu
const btnPrivacy = document.querySelector("#btnTogglePrivacy");

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
  if (btnPrivacy) {
    // Nếu đang hiện -> icon mắt mở, Nếu đang ẩn -> icon mắt gạch chéo
    btnPrivacy.innerHTML = isMoneyVisible ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>';
  }
};

// Chạy 1 lần khi mở app
updatePrivacyIcon();

// Khi bấm nút
if (btnPrivacy) {
  btnPrivacy.onclick = () => {
    isMoneyVisible = !isMoneyVisible; // Đảo ngược trạng thái
    localStorage.setItem('money_visible', isMoneyVisible); // Lưu vào bộ nhớ
    updatePrivacyIcon(); // Đổi icon
    render(); // Cập nhật lại giao diện ngay lập tức
  };
}
// ===============================


const COL = collection(db, "work_logs");
const SCH_COL = collection(db, "work_schedule");
let USER_WAGE = parseInt(localStorage.getItem('shift_wage')) || 25000;
const TARGET_HOURS = 200; 
const CLOUD_NAME = "do48qpmut"; 
const UPLOAD_PRESET = "fora";

const $ = q => document.querySelector(q);
const fmtMoney = n => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
const getDayName = (d) => ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()];

let selectedShift = null;
let customMode = false;
let isLoggingSchedule = false;

let viewMonth = new Date().getMonth();
let viewYear = new Date().getFullYear();

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

  renderShifts(); // Tự xóa các class active cũ

  $("#workDate").value =
    new Date().toISOString().split("T")[0];

  $("#inpNote").value = "";

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

  renderShifts(); 

  $("#workDate").value =
    new Date().toISOString().split("T")[0];

  $("#inpNote").value = "";

  toggleModal(true);
};

$("#btnCancel").onclick = () => toggleModal(false);
$("#btnCloseTop").onclick = () => toggleModal(false);

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
    await addDoc(SCH_COL, { start, end, duration: dur, uid: auth.currentUser.uid });
    showToast("Thêm lịch thành công!", "success");
  } else {
    const wage = Math.round(USER_WAGE * (dur / 3600000));
    await addDoc(COL, { start, end, duration: dur, wageRate: USER_WAGE, totalMoney: wage, note: $("#inpNote").value, uid: auth.currentUser.uid });
    showToast("Lưu ca làm thành công!", "success");
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

    const div = document.createElement("div");
    div.className = "work-card";
    div.style.animationDelay = `${idx * 0.05}s`;
    
    div.innerHTML = `
      <div class="card-date">
        <span class="d-weekday">${wk}</span>
        <span class="d-day">${day}/${month}</span>
      </div>
      <div class="card-content" style="justify-content: center;">
        <div class="row-top">
          <span class="time-range">${sT} - ${eT}</span>
          <span class="dur-tag">${h}h</span>
        </div>
      </div>
      <div class="card-actions" style="justify-content: center;">
        <div style="display: flex; gap: 10px; align-items: center;">
          <button class="btn-mini del" onclick="delSchedule('${l.id}')" title="Xóa lịch này" style="width: 40px; height: 40px;"><i class="fa-solid fa-trash"></i></button>
          <button class="btn-checkin" onclick="checkIn('${l.id}', ${l.start}, ${l.end}, ${l.duration})" style="padding: 12px 20px;">
            <i class="fa-solid fa-check"></i> Chấm công
          </button>
        </div>
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
  showToast("Chấm công thành công! Tiền đã về túi.", "success");
  renderSchedule();
  render();

};

// --- RENDER ---
async function render() {
  const tl = $("#timeline");
  const skel = $("#skeletonLoader");
  if(!skel || !tl.contains(skel)) tl.innerHTML = `<div id="skeletonLoader"><div class="skeleton-card"></div></div>`;

  const q = query(COL, where("uid", "==", auth.currentUser.uid));
  const snap = await getDocs(q);
  const logs = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.start - a.start);

  tl.innerHTML = ""; 
  let mHours = 0, mMoney = 0, totalDurationAll = 0, totalMoneyAll = 0;
  
  logs.forEach(l => { totalDurationAll += l.duration || 0; });

  const filteredLogs = logs.filter(l => {
    const d = new Date(l.start);
    return d.getMonth() === viewMonth && d.getFullYear() === viewYear;
  });

  const monthKey = `Tháng ${viewMonth + 1}/${viewYear}`;
  $("#lblCurrentMonth").innerText = monthKey;

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
            <button class="btn-mini" onclick="updateNote('${l.id}', '${safeNote}')"><i class="fa-solid fa-pen"></i></button>
            <button class="btn-mini del" onclick="del('${l.id}')"><i class="fa-solid fa-trash"></i></button>
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

  animateValue("monthHours", 0, totalHours, 1000, (v) => v.toFixed(1));

  // LOGIC KIỂM TRA ĐỂ ẨN/HIỆN TIỀN (MỚI)
  if (isMoneyVisible) {
    animateValue("monthMoney", 0, mMoney, 1200, fmtMoney);
    animateValue("totalMoney", 0, totalMoneyAll, 1200, (v) => "Tổng: " + fmtMoney(v));
  } else {
    $("#monthMoney").innerText = "******";
    $("#totalMoney").innerText = "Tổng: ******";
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
}

window.updateNote = async (id, old) => { const n = prompt("Sửa ghi chú:", old); if(n!==null) { await updateDoc(doc(db,"work_logs",id),{note:n}); render(); }};
window.del = async (id) => { if(confirm("Xóa ca làm này khỏi Nhật Ký?")) { await deleteDoc(doc(db,"work_logs",id)); render(); }};
window.delSchedule = async (id) => { if(confirm("Hủy lịch làm việc này?")) { await deleteDoc(doc(db,"work_schedule",id)); showToast("Đã xóa lịch!", "success"); renderSchedule(); }};
$("#btnSettings").onclick = () => { const w = prompt("Lương/giờ:", USER_WAGE); if(w) { USER_WAGE=parseInt(w); localStorage.setItem('shift_wage',USER_WAGE); render(); }};

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

$("#btnExport").onclick = async () => {
  const q = query(COL, where("uid", "==", auth.currentUser.uid));
  const snap = await getDocs(q);
  const logs = snap.docs.map(d => d.data()).sort((a,b) => b.start - a.start);
  let csv = "Ngày,Bắt đầu,Kết thúc,Thời gian (h),Lương/h,Tổng tiền,Ghi chú\n";
  logs.forEach(l => {
    const d = new Date(l.start).toLocaleDateString('vi-VN');
    const st = new Date(l.start).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit', hour12: false});
    const et = new Date(l.end).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit', hour12: false});
    const h = parseFloat((l.duration / 3600000).toFixed(1));
    const n = (l.note || "").replace(/,/g, " ");
    const money = Math.round(h * USER_WAGE);
    csv += `${d},${st},${et},${h},${USER_WAGE},${money},${n}\n`;
  });
  const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "kaito_logs.csv";
  a.click();
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