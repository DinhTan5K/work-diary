import { db } from "./firebase.js"; 
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";



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
// ------------------------

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
let USER_WAGE = parseInt(localStorage.getItem('shift_wage')) || 20000;
const TARGET_HOURS = 200; 
const CLOUD_NAME = "do48qpmut"; 
const UPLOAD_PRESET = "fora";

const $ = q => document.querySelector(q);
const fmtMoney = n => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
const getDayName = (d) => ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()];

let tempImgFile = null;

let selectedShift = null;

let customMode = false;

document.addEventListener("click", (e) => {

  if (!e.target.classList.contains("shift-btn")) return;

  document
    .querySelectorAll(".shift-btn")
    .forEach(btn => btn.classList.remove("active"));

  e.target.classList.add("active");

  if (e.target.dataset.custom) {

    customMode = true;

    $("#customShift").style.display = "block";

    selectedShift = null;

    return;
  }

  customMode = false;

  $("#customShift").style.display = "none";

  selectedShift = {
    start: e.target.dataset.start,
    end: e.target.dataset.end
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

// --- MODAL ---
const toggleModal = (show) => $("#logModal").classList.toggle("hidden", !show);

$("#fab").onclick = () => {

  selectedShift = null;
  customMode = false;

  $("#customShift").style.display = "none";
  $("#customStart").value = "";
  $("#customEnd").value = "";

  document
    .querySelectorAll(".shift-btn")
    .forEach(btn => btn.classList.remove("active"));

  $("#workDate").value =
    new Date().toISOString().split("T")[0];

  $("#inpNote").value = "";

  tempImgFile = null;

  $("#imgName").innerText = "";

  toggleModal(true);
};

$("#btnCancel").onclick = () => toggleModal(false);
$("#btnCloseTop").onclick = () => toggleModal(false);

$("#btnPickImg").onclick = () => {
  const i = document.createElement("input"); i.type="file"; i.accept="image/*";
  i.onchange = () => { if(i.files[0]) { tempImgFile=i.files[0]; $("#imgName").innerText = "File: " + i.files[0].name; }};
  i.click();
};

$("#btnSave").onclick = async () => {
  if (customMode) {
    const cS = $("#customStart").value;
    const cE = $("#customEnd").value;
    if (!cS || !cE) {
      alert("Nhập đủ giờ bắt đầu và kết thúc bro");
      return;
    }
    selectedShift = { start: cS, end: cE };
  }

  if (!selectedShift) {
    alert("Chọn ca trước bro");
    return;
  }

  const workDate = $("#workDate").value;

  if (!workDate) {
    alert("Chọn ngày trước bro");
    return;
  }

  let start = new Date(`${workDate}T${selectedShift.start}`).getTime();
  let end = new Date(`${workDate}T${selectedShift.end}`).getTime();

  if (start >= end) { 
    // Cộng thêm 1 ngày nếu qua đêm
    end += 86400000; 
  }
  
  $("#btnSave").innerText = "Đang lưu..."; $("#btnSave").disabled = true;
  const dur = end - start;
  const wage = Math.round(USER_WAGE * (dur / 3600000));
  const img = await upload(tempImgFile);

  await addDoc(COL, { start, end, duration: dur, wageRate: USER_WAGE, totalMoney: wage, note: $("#inpNote").value, image: img });

  $("#btnSave").innerText = "Lưu lại"; $("#btnSave").disabled = false;
  toggleModal(false); render();
};

// --- RENDER ---
async function render() {
  const tl = $("#timeline");
  const skel = $("#skeletonLoader");
  if(!skel || !tl.contains(skel)) tl.innerHTML = `<div id="skeletonLoader"><div class="skeleton-card"></div></div>`;

  const snap = await getDocs(COL);
  const logs = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.start - a.start);

  tl.innerHTML = ""; 
  let mHours = 0, mMoney = 0, totalMoneyAll = 0;
  const now = new Date();
  let currentMonthGroup = null;

  logs.forEach((l, idx) => {
    totalMoneyAll += l.totalMoney || 0;
    const d = new Date(l.start);
    if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
      mHours += (l.duration || 0); mMoney += (l.totalMoney || 0);
    }

    const monthKey = `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
    if (monthKey !== currentMonthGroup) {
      currentMonthGroup = monthKey;
      const header = document.createElement("div"); header.className = "timeline-header";
      header.innerHTML = `<h3 style="margin:15px 0 10px 0; font-size:0.9rem; opacity:0.7">${monthKey}</h3>`;
      tl.appendChild(header);
    }

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
          ${badges}
        </div>
        <div class="row-btm">
          <div class="note-text">
            ${l.note ? `<i class="fa-solid fa-note-sticky"></i> ${l.note}` : '...'}
          </div>
          ${l.image ? `<a href="${l.image}" target="_blank" style="color:var(--primary)"><i class="fa-solid fa-image"></i></a>` : ''}
        </div>
      </div>
      <div class="card-actions">
        <div class="wage-display">${fmtMoney(l.totalMoney)}</div>
        <div class="act-btns">
          <button class="btn-mini" onclick="updateNote('${l.id}', '${safeNote}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-mini del" onclick="del('${l.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `;
    tl.appendChild(div);
  });

  const totalHours = (mHours / 3600000);
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
      if(p>=1) circle.style.stroke = "#4ade80";
    }, 50);
  }
}

window.updateNote = async (id, old) => { const n = prompt("Sửa ghi chú:", old); if(n!==null) { await updateDoc(doc(db,"work_logs",id),{note:n}); render(); }};
window.del = async (id) => { if(confirm("Xóa ca làm này?")) { await deleteDoc(doc(db,"work_logs",id)); render(); }};
$("#btnSettings").onclick = () => { const w = prompt("Lương/giờ:", USER_WAGE); if(w) { USER_WAGE=parseInt(w); localStorage.setItem('shift_wage',USER_WAGE); render(); }};
$("#btnExport").onclick = async () => {
  const snap = await getDocs(COL);
  const logs = snap.docs.map(d => d.data()).sort((a,b) => b.start - a.start);
  let csv = "Ngày,Bắt đầu,Kết thúc,Thời gian (h),Lương/h,Tổng tiền,Ghi chú\n";
  logs.forEach(l => {
    const d = new Date(l.start).toLocaleDateString('vi-VN');
    const st = new Date(l.start).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit', hour12: false});
    const et = new Date(l.end).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit', hour12: false});
    const h = (l.duration / 3600000).toFixed(1);
    const n = (l.note || "").replace(/,/g, " ");
    csv += `${d},${st},${et},${h},${l.wageRate},${l.totalMoney},${n}\n`;
  });
  const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "kaito_logs.csv";
  a.click();
};

render();