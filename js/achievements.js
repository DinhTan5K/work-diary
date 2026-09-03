import { db, auth } from "../firebase.js";
import { getDocs, collection } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { state } from "./store.js";
import { $, showToast } from "./utils.js";

const ACHIEVEMENTS = [
  { id: 'achi-bee', name: 'Ong chăm chỉ', desc: 'Làm việc 7 ngày liên tục', icon: '<i class="fa-solid fa-bug"></i>', color: '#FFD700' },
  { id: 'achi-owl', name: 'Chiến thần ca tối', desc: '3 ngày liên tiếp có ca tối', icon: '<i class="fa-solid fa-moon"></i>', color: '#7C4DFF' },
  { id: 'achi-rich', name: 'Đại gia', desc: 'Thu nhập > 3.500.000₫', icon: '<i class="fa-solid fa-gem"></i>', color: '#E91E63' },
  { id: 'achi-sunrise', name: 'Chiến binh bình minh', desc: '3 ca sáng liên tiếp', icon: '<i class="fa-solid fa-sun"></i>', color: '#FF9800' },
  { id: 'achi-sunrise-pro', name: 'Vua ca sáng', desc: '15 ca sáng trong 1 tháng', icon: '<i class="fa-solid fa-crown"></i>', color: '#FF6F00' },
  { id: 'achi-double', name: 'Người không ngủ', desc: 'Làm 2 ca trong 1 ngày', icon: '<i class="fa-solid fa-bolt"></i>', color: '#00BCD4' },
  { id: 'achi-hours', name: 'Vua tăng ca', desc: 'Tổng > 150 giờ trong tháng', icon: '<i class="fa-solid fa-fire"></i>', color: '#FF5722' },
  { id: 'achi-weekend', name: 'Siêu nhân cuối tuần', desc: 'Làm 5+ ngày cuối tuần', icon: '<i class="fa-solid fa-shield-halved"></i>', color: '#4CAF50' },
  { id: 'achi-newbie', name: 'Tân binh', desc: 'Ghi nhận ca đầu tiên', icon: '<i class="fa-solid fa-seedling"></i>', color: '#8BC34A' },
  { id: 'achi-marathon', name: 'Marathon', desc: 'Làm 10 ngày liên tục', icon: '<i class="fa-solid fa-person-running"></i>', color: '#2196F3' },
  { id: 'achi-responsible', name: 'Trách nhiệm', desc: 'Đạt 27 công trong tháng', icon: '<i class="fa-solid fa-medal"></i>', color: '#9C27B0' },
  { id: 'achi-infinity', name: 'Găng Tay Vô Cực', desc: 'Đã thu thập đủ 11 viên đá thành tựu', icon: '<i class="fa-solid fa-hand-fist"></i>', color: '#8A2BE2' }
];

export function checkAchievements(monthLogs, currentMonthMoney) {
  state.currentMonthAchievements = [];
  
  if (monthLogs.length > 0) state.currentMonthAchievements.push('achi-newbie');
  if (currentMonthMoney >= 3500000) state.currentMonthAchievements.push('achi-rich');

  const ascLogs = [...monthLogs].sort((a, b) => a.start - b.start);
  const datesMap = new Map();
  
  ascLogs.forEach(l => {
    const d = new Date(l.start);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!datesMap.has(dateStr)) datesMap.set(dateStr, []);
    datesMap.get(dateStr).push(l);
  });
  
  const uniqueDatesStr = Array.from(datesMap.keys()).sort();
  
  let streak = 0;
  let maxStreak = 0;
  for (let i = 0; i < uniqueDatesStr.length; i++) {
    if (i === 0) {
      streak = 1;
    } else {
      const prevDate = new Date(uniqueDatesStr[i-1]);
      const currDate = new Date(uniqueDatesStr[i]);
      const diffTime = Math.abs(currDate - prevDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays === 1) streak++;
      else streak = 1;
    }
    if (streak > maxStreak) maxStreak = streak;
  }
  if (maxStreak >= 7) state.currentMonthAchievements.push('achi-bee');
  if (maxStreak >= 10) state.currentMonthAchievements.push('achi-marathon');

  let owlStreak = 0;
  let lastNightShiftDate = null;
  for (let i = 0; i < uniqueDatesStr.length; i++) {
    const dStr = uniqueDatesStr[i];
    const dayLogs = datesMap.get(dStr);
    let hasNightShift = false;
    
    for (let l of dayLogs) {
      const st = new Date(l.start);
      const nightStart = new Date(st.getFullYear(), st.getMonth(), st.getDate(), 17, 30, 0).getTime();
      const nightEnd = new Date(st.getFullYear(), st.getMonth(), st.getDate(), 22, 30, 0).getTime();
      if (l.start <= nightEnd && l.end >= nightStart) { 
        hasNightShift = true; 
        break; 
      }
    }

    if (hasNightShift) {
      if (!lastNightShiftDate) {
        owlStreak = 1;
      } else {
        const diffTime = Math.abs(new Date(dStr) - new Date(lastNightShiftDate));
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 1) owlStreak++;
        else owlStreak = 1;
      }
      lastNightShiftDate = dStr;
      
      if (owlStreak >= 3) {
        state.currentMonthAchievements.push('achi-owl');
        break;
      }
    }
  }

  let morningDayCount = 0;
  let sunriseStreak = 0;
  let lastMorningShiftDate = null;
  let achievedSunrise = false;

  for (let i = 0; i < uniqueDatesStr.length; i++) {
    const dStr = uniqueDatesStr[i];
    const dayLogs = datesMap.get(dStr);
    let hasMorningShift = false;
    for (let l of dayLogs) {
      const hour = new Date(l.start).getHours();
      if (hour >= 5 && hour < 12) {
        hasMorningShift = true;
        break;
      }
    }
    
    if (hasMorningShift) {
      morningDayCount++;
      if (!lastMorningShiftDate) {
        sunriseStreak = 1;
      } else {
        const diffTime = Math.abs(new Date(dStr) - new Date(lastMorningShiftDate));
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 1) sunriseStreak++;
        else sunriseStreak = 1;
      }
      lastMorningShiftDate = dStr;
      
      if (sunriseStreak >= 3) {
        achievedSunrise = true;
      }
    }
  }
  
  if (achievedSunrise) state.currentMonthAchievements.push('achi-sunrise');
  if (morningDayCount >= 15) state.currentMonthAchievements.push('achi-sunrise-pro');

  for (const [dStr, dayLogs] of datesMap) {
    if (dayLogs.length >= 2) {
      state.currentMonthAchievements.push('achi-double');
      break;
    }
  }

  let totalHours = 0;
  monthLogs.forEach(l => {
    totalHours += (l.end - l.start) / (1000 * 60 * 60);
  });
  if (totalHours > 150) state.currentMonthAchievements.push('achi-hours');

  let weekendCount = 0;
  for (const [dStr, dayLogs] of datesMap) {
    const dayOfWeek = new Date(dStr).getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) weekendCount++;
  }
  if (weekendCount >= 5) state.currentMonthAchievements.push('achi-weekend');

  if (uniqueDatesStr.length >= 27) state.currentMonthAchievements.push('achi-responsible');

  // Check Găng Tay Vô Cực (11 achievements max before this one)
  if (state.currentMonthAchievements.length === 11) {
    state.currentMonthAchievements.push('achi-infinity');
  }

  renderAchievements();
  loadLeaderboard();
}

export function renderAchievements() {
  const container = $("#achievementsList");
  if (!container) return;
  container.innerHTML = "";
  
  ACHIEVEMENTS.forEach(ach => {
    const isUnlocked = state.currentMonthAchievements.includes(ach.id);
    const div = document.createElement("div");
    div.className = "badge-item" + (isUnlocked ? " unlocked" : " locked");
    if (isUnlocked && ach.id === 'achi-infinity') {
      div.classList.add('infinity-badge');
    }
    if (isUnlocked && ach.color) {
      div.style.setProperty('--badge-accent', ach.color);
    }
    div.innerHTML = `
      ${!isUnlocked ? '<div class="badge-locked-overlay"><i class="fa-solid fa-lock"></i></div>' : ''}
      <div class="badge-icon-wrap">${ach.icon}</div>
      <div class="badge-name">${ach.name}</div>
    `;
    if (isUnlocked) {
      div.onclick = () => showToast(`${ach.name} — ${ach.desc}`, "info");
    }
    container.appendChild(div);
  });
}

window.toggleAchievements = function() {
  const grid = document.getElementById("achievementsList");
  const btn = document.getElementById("btnToggleAchievements");
  if (grid.classList.contains("expanded")) {
    grid.classList.remove("expanded");
    btn.innerHTML = 'Xem tất cả <i class="fa-solid fa-chevron-down"></i>';
  } else {
    grid.classList.add("expanded");
    btn.innerHTML = 'Thu gọn <i class="fa-solid fa-chevron-up"></i>';
  }
};

export async function loadLeaderboard() {
  const listEl = document.getElementById("leaderboardList");
  if (!listEl) return;
  listEl.innerHTML = `<div class="rank-empty"><i class="fa-solid fa-spinner fa-spin"></i> ĐANG TẢI...</div>`;
  
  try {
    const snap = await getDocs(collection(db, "users"));
    let users = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // Filter users who have synced this month and have > 0 hours
    users = users.filter(u => u.lastUpdatedMonth === currentMonthKey && (u.totalHours || 0) > 0);
    
    users.sort((a, b) => (b.totalHours || 0) - (a.totalHours || 0));
    
    listEl.innerHTML = "";
    
    if (users.length === 0) {
      listEl.innerHTML = `<div class="rank-empty"><i class="fa-solid fa-ghost"></i> Tháng này chưa có ai cày cuốc cả</div>`;
      return;
    }
    
    users.forEach((u, index) => {
      const pos = index + 1;
      let posClass = pos <= 3 ? "top-" + pos : "";
      
      let title = "";
      let titleIcon = "";
      if (pos === 1) { title = "NÔ LỆ TƯ BẢN"; titleIcon = "fa-solid fa-hand-fist"; }
      else if (pos == 2 ) {title = "CẦN TIỀN HƠN TÌNH"; titleIcon = "fa-solid fa-fire";}
      else if (pos == 3) { title = "THUA MỖI TRÂU CÀY"; titleIcon = "fa-solid fa-fire"; }
      else { title = "ĐỦ MUA TRÀ SỮA"; titleIcon = "fa-solid fa-seedling"; }
      
      const isMe = (auth.currentUser && u.uid === auth.currentUser.uid);
      
      const div = document.createElement("div");
      div.className = `rank-card ${posClass} ${isMe ? "rank-me" : ""}`;
      div.style.animationDelay = `${index * 0.06}s`;
      div.innerHTML = `
        <div class="rank-pos-box ${posClass}">
          <span class="rank-hash">#</span>
          <span class="rank-num">${pos}</span>
        </div>
        <div class="rank-detail">
          <div class="rank-name-row">
            <span class="rank-username">${u.displayName || "Ẩn danh"}</span>
            ${isMe ? `<span class="rank-you-tag">YOU</span>` : ""}
          </div>
          <span class="rank-badge"><i class="${titleIcon}"></i> ${title}</span>
        </div>
      `;
      listEl.appendChild(div);
    });
    
  } catch(err) {
    console.error(err);
    listEl.innerHTML = `<div class="rank-empty"><i class="fa-solid fa-triangle-exclamation"></i> Lỗi tải bảng xếp hạng!</div>`;
  }
}
