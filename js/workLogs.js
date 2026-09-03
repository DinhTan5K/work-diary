import { db, auth } from "../firebase.js";
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { state, COL } from "./store.js";
import { $, fmtMoney, getDayName, showToast, animateValue } from "./utils.js";
import { renderExpenses } from "./expenses.js";
import { checkAchievements } from "./achievements.js";
import { toggleModal } from "./ui.js";

function renderShifts() {
  const grid = $("#shiftGrid");
  if (!grid) return;
  grid.innerHTML = "";
  state.savedShifts.forEach((s, idx) => {
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

window.deleteShiftPreset = async (e, idx) => {
  e.stopPropagation();
  if(await showConfirm("Bạn có chắc muốn xóa ca mẫu này?")) {
    state.savedShifts.splice(idx, 1);
    localStorage.setItem('preset_shifts', JSON.stringify(state.savedShifts));
    renderShifts();
    showToast("Đã xóa ca mẫu", "success");
  }
};

export function initWorkLogs() {
  renderShifts();

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".shift-btn");
    if (!btn) return;

    document
      .querySelectorAll(".shift-btn")
      .forEach(b => b.classList.remove("active"));

    btn.classList.add("active");

    if (btn.dataset.custom) {
      state.customMode = true;
      $("#customShift").style.display = "block";
      state.selectedShift = null;
      return;
    }

    state.customMode = false;
    $("#customShift").style.display = "none";
    state.selectedShift = {
      start: btn.dataset.start,
      end: btn.dataset.end
    };
  });

  const btnRescue = $("#btnRescue");
  if (btnRescue) {
    btnRescue.onclick = async () => {
      const oldUid = await showPrompt("Nhập UID cũ của tài khoản bị mất pass (ví dụ: YpVDNW6...):");
      if(!oldUid) return;
      if(!(await showConfirm(`Chắc chắn muốn chuyển toàn bộ dữ liệu từ UID [${oldUid}] sang tài khoản hiện tại không?`))) return;
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

        showToast(`Đã cứu thành công ${count} mục từ UID cũ!`, "success");
        render();
        renderExpenses();
      } catch(e) {
        showToast("Lỗi: " + e.message, "error");
      } finally {
        btnRescue.disabled = false;
      }
    };
  }
  
  if ($("#btnSave")) {
    $("#btnSave").onclick = async () => {
      if (state.customMode) {
        const cS = $("#customStart").value;
        const cE = $("#customEnd").value;
        if (!cS || !cE) {
          showToast("Nhập đủ giờ bắt đầu và kết thúc bro", "error");
          return;
        }
        state.selectedShift = { start: cS, end: cE };
        
        const chk = $("#chkSavePreset");
        if (chk && chk.checked) {
          const exists = state.savedShifts.some(s => s.start === cS && s.end === cE);
          if(!exists) {
            state.savedShifts.push({ start: cS, end: cE });
            state.savedShifts.sort((a,b) => a.start.localeCompare(b.start));
            localStorage.setItem('preset_shifts', JSON.stringify(state.savedShifts));
          }
        }
      }

      if (!state.selectedShift) {
        showToast("Chọn ca trước bro", "error");
        return;
      }

      const workDate = $("#workDate").value;

      if (!workDate) {
        showToast("Chọn ngày trước bro", "error");
        return;
      }

      let start = new Date(`${workDate}T${state.selectedShift.start}`).getTime();
      let end = new Date(`${workDate}T${state.selectedShift.end}`).getTime();

      if (start >= end) { end += 86400000; }
      
      $("#btnSave").innerText = "Đang lưu..."; $("#btnSave").disabled = true;
      const dur = end - start;

      const wage = Math.round(state.USER_WAGE * (dur / 3600000));
      if (state.editModeId) {
        await updateDoc(doc(db, "work_logs", state.editModeId), { start, end, duration: dur, totalMoney: wage, note: $("#inpNote").value });
        showToast("Cập nhật ca làm thành công!", "success");
      } else {
        await addDoc(COL, { start, end, duration: dur, wageRate: state.USER_WAGE, totalMoney: wage, note: $("#inpNote").value, uid: auth.currentUser.uid });
        showToast("Lưu ca làm thành công!", "success");
      }

      $("#btnSave").innerText = "Lưu lại"; $("#btnSave").disabled = false;
      toggleModal(false); 
      render();
    };
  }
}

export async function render() {
  const tl = $("#timeline");
  const calView = $("#calendar-view");
  const skel = $("#skeletonLoader");
  if(!skel || !tl.contains(skel)) tl.innerHTML = `<div id="skeletonLoader"><div class="skeleton-card"></div></div>`;

  const detailModal = $("#dayDetailModal");
  if (detailModal) {
    detailModal.classList.add("hidden");
    detailModal.style.display = "none";
  }
  
  if (!auth.currentUser) return;

  const q = query(COL, where("uid", "==", auth.currentUser.uid));
  const snap = await getDocs(q);
  const logs = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.start - a.start);

  tl.innerHTML = ""; 
  if (calView) calView.innerHTML = "";
  
  let mHours = 0, mMoney = 0, totalDurationAll = 0, totalMoneyAll = 0;
  
  logs.forEach(l => { totalDurationAll += l.duration || 0; });

  const filteredLogs = logs.filter(l => {
    const d = new Date(l.start);
    return d.getMonth() === state.viewMonth && d.getFullYear() === state.viewYear;
  });

  const monthKey = `Tháng ${state.viewMonth + 1}/${state.viewYear}`;
  $("#lblCurrentMonth").innerText = monthKey;

  if (state.diaryViewMode === 'calendar') {
    tl.style.display = 'none';
    if (calView) {
      calView.style.display = 'block';
      renderCalendar(filteredLogs, state.viewMonth, state.viewYear, calView);
    }
  } else {
    if (calView) calView.style.display = 'none';
    tl.style.display = ''; 
  }

  let morningCount = 0;
  let eveningCount = 0;

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
      
      const sHour = new Date(l.start).getHours();
      const eHour = new Date(l.end).getHours();
      
      if (sHour >= 4 && sHour < 12) morningCount++;
      if (eHour >= 18 || eHour < 4) eveningCount++;

      const h = (l.duration/3600000).toFixed(1);
      const safeNote = (l.note || "").replace(/'/g, "\\'");
      
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
          <div class="wage-display">${fmtMoney(Math.round((l.duration/3600000) * state.USER_WAGE))}</div>
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
  
  mMoney = totalHours * state.USER_WAGE;
  state.currentMonthSalary = mMoney;
  totalMoneyAll = grandTotalHours * state.USER_WAGE;

  if (auth.currentUser) {
    const now = new Date();
    const currentMonthLogs = logs.filter(l => {
      const d = new Date(l.start);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    let realMonthDur = 0;
    currentMonthLogs.forEach(l => realMonthDur += (l.duration || 0));
    const realTotalHours = parseFloat((realMonthDur / 3600000).toFixed(1));
    const realTotalMoney = realTotalHours * state.USER_WAGE;

    const displayName = auth.currentUser.displayName || auth.currentUser.email.split('@')[0];
    const userRef = doc(db, "users", auth.currentUser.uid);
    const lastUpdatedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setDoc(userRef, {
      displayName: displayName,
      totalHours: realTotalHours,
      totalMoney: realTotalMoney,
      lastActive: new Date().getTime(),
      lastUpdatedMonth: lastUpdatedMonth
    }, { merge: true }).catch(e => console.error("Leaderboard sync err:", e));
  }

  const uniqueDays = new Set(filteredLogs.map(l => new Date(l.start).getDate())).size;
  const allTimeUniqueDays = new Set(logs.map(l => new Date(l.start).toLocaleDateString())).size;

  animateValue("monthHours", 0, totalHours, 1000, (v) => v.toFixed(1));
  animateValue("monthDays", 0, uniqueDays, 1000, (v) => Math.round(v));

  if($("#overviewCurrentTitle")) $("#overviewCurrentTitle").innerText = `Tháng ${state.viewMonth + 1}/${state.viewYear}`;
  animateValue("overviewMonthHours", 0, totalHours, 1200, (v) => v.toFixed(1));
  animateValue("overviewMonthDays", 0, uniqueDays, 1200, (v) => Math.round(v));
  if ($("#overviewMonthMorning")) animateValue("overviewMonthMorning", 0, morningCount, 1200, (v) => Math.round(v));
  if ($("#overviewMonthEvening")) animateValue("overviewMonthEvening", 0, eveningCount, 1200, (v) => Math.round(v));
  
  if (logs.length > 0) {
    const uniqueDatesStr = Array.from(new Set(logs.map(l => {
      const d = new Date(l.start);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }))).sort().reverse();
    
    let currentStreak = 0;
    let checkDate = new Date(); checkDate.setHours(0,0,0,0);
    let yesterday = new Date(checkDate); yesterday.setDate(yesterday.getDate() - 1);
    
    if (uniqueDatesStr.length > 0) {
      let maxActiveStreak = 0;
      let blockStreak = 1;
      let blockLatestDate = new Date(uniqueDatesStr[0]);
      let expectedDate = new Date(uniqueDatesStr[0]);
      expectedDate.setDate(expectedDate.getDate() - 1);
      
      for (let i = 1; i < uniqueDatesStr.length; i++) {
          const expectedStr = `${expectedDate.getFullYear()}-${String(expectedDate.getMonth()+1).padStart(2,'0')}-${String(expectedDate.getDate()).padStart(2,'0')}`;
          if (uniqueDatesStr[i] === expectedStr) {
              blockStreak++;
          } else {
              if (blockLatestDate >= yesterday) {
                  if (blockStreak > maxActiveStreak) maxActiveStreak = blockStreak;
              }
              blockStreak = 1;
              blockLatestDate = new Date(uniqueDatesStr[i]);
          }
          expectedDate = new Date(uniqueDatesStr[i]);
          expectedDate.setDate(expectedDate.getDate() - 1);
      }
      if (blockLatestDate >= yesterday) {
          if (blockStreak > maxActiveStreak) maxActiveStreak = blockStreak;
      }
      currentStreak = maxActiveStreak;
    }

    const headerStreakContainer = document.getElementById("headerStreakContainer");
    if (headerStreakContainer) {
      if (currentStreak >= 2) {
        headerStreakContainer.innerHTML = `
          <div class="header-streak-basic">
            <div class="streak-basic-icon"></div>
            <div class="streak-basic-text">${currentStreak}</div>
          </div>
        `;
      } else {
        headerStreakContainer.innerHTML = "";
      }
    }
  } else {
    const headerStreakContainer = document.getElementById("headerStreakContainer");
    if (headerStreakContainer) headerStreakContainer.innerHTML = "";
  }

  renderExpenses();
  checkAchievements(filteredLogs, mMoney);

  if (state.isMoneyVisible) {
    animateValue("monthMoney", 0, mMoney, 1200, fmtMoney);
    if($("#totalMoney")) animateValue("totalMoney", 0, totalMoneyAll, 1200, (v) => "Tổng: " + fmtMoney(v));
    if($("#overviewMonthMoney")) animateValue("overviewMonthMoney", 0, mMoney, 1200, fmtMoney);
  } else {
    if($("#monthMoney")) $("#monthMoney").innerText = "******";
    if($("#totalMoney")) $("#totalMoney").innerText = "Tổng: ******";
    if($("#overviewMonthMoney")) $("#overviewMonthMoney").innerText = "******";
  }
  
  const circle = document.getElementById("progressCircle");
  if(circle) {
    circle.style.transition = "none";
    circle.style.strokeDashoffset = 213;
    setTimeout(() => {
      circle.style.transition = "stroke-dashoffset 1s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
      const p = Math.min(totalHours/state.TARGET_HOURS, 1);
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
        circle.style.stroke = "#00ffaa"; 
      }
    }, 50);
  }

  const daysCircle = document.getElementById("progressDaysCircle");
  if(daysCircle) {
    daysCircle.style.transition = "none";
    daysCircle.style.strokeDashoffset = 213;
    setTimeout(() => {
      daysCircle.style.transition = "stroke-dashoffset 1s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
      const pDays = Math.min(uniqueDays / state.TARGET_DAYS, 1);
      daysCircle.style.strokeDashoffset = 213 - (213 * pDays); 
      daysCircle.style.stroke = pDays >= 1 ? "#00ffaa" : "#b5a5e3";
    }, 50);
  }

  const mascotEl = document.getElementById("mascotText");
  if(mascotEl) {
    if (uniqueDays >= state.TARGET_DAYS) mascotEl.innerText = `Đủ ${state.TARGET_DAYS} công!`;
    else if (uniqueDays >= state.TARGET_DAYS * 0.75) mascotEl.innerText = `Còn ${state.TARGET_DAYS - uniqueDays} công nữa!`;
    else if (uniqueDays >= state.TARGET_DAYS * 0.35) mascotEl.innerText = `${uniqueDays}/${state.TARGET_DAYS}`;
    else mascotEl.innerText = `${uniqueDays}/${state.TARGET_DAYS} công`;
  }
}

window.updateNote = async (id, old) => { const n = await showPrompt("Sửa ghi chú:", old); if(n!==null) { await updateDoc(doc(db,"work_logs",id),{note:n}); render(); }};
window.del = async (id) => { if(await showConfirm("Xóa ca làm này khỏi Nhật Ký?")) { await deleteDoc(doc(db,"work_logs",id)); render(); }};

window.editLog = (id, start, end, note) => {
  state.editModeId = id;
  openEditModal("Sửa ca làm", start, end, note);
};

function openEditModal(title, start, end, note) {
  const detailModal = $("#dayDetailModal");
  if (detailModal) {
    detailModal.classList.add("hidden");
    setTimeout(() => { detailModal.style.display = "none"; }, 200);
  }

  const d = new Date(start);
  const sT = new Date(start).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit', hour12: false});
  const eT = new Date(end).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit', hour12: false});

  $("#workDate").value = d.toISOString().split("T")[0];
  $("#customStart").value = sT;
  $("#customEnd").value = eT;
  $("#inpNote").value = note;
  
  $("#modalTitle").innerText = title;
  $("#inpNote").closest('.field-group').style.display = "block";
  
  document.querySelectorAll(".shift-btn").forEach(b => b.classList.remove("active", "selected"));
  $("#customShift").style.display = "block";
  state.customMode = true;
  state.selectedShift = { start: sT, end: eT };
  
  const chk = $("#chkSavePreset");
  if(chk) chk.checked = false;

  $("#btnSave").innerText = "Cập nhật";
  toggleModal(true);
}

function renderCalendar(logs, month, year, container) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  
  const header = document.createElement("div");
  header.className = "calendar-header";
  ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].forEach(day => {
    header.innerHTML += `<div>${day}</div>`;
  });
  container.appendChild(header);

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
          <div class="wage-display">${fmtMoney(Math.round((l.duration/3600000) * state.USER_WAGE))}</div>
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
