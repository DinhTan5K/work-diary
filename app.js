/* ===== ShiftTrack — Firestore Version ===== */

import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ---------- Utils ---------- */
const haptic = (p=[8])=>{try{navigator.vibrate&&navigator.vibrate(p)}catch{}};
const fmtTime = ts => {
  const d=new Date(ts);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
};
const fmtDateTime = ts => {
  const d=new Date(ts),p=n=>String(n).padStart(2,"0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fmtHours = ms => (ms/3600000).toFixed(2).replace(".00","")+"h";
const todayKey = ()=>new Date().toISOString().slice(0,10);
const currency = n=>new Intl.NumberFormat("vi-VN").format(n);

/* ---------- Core (Firestore) ---------- */
const Core = (() => {
  const COL = collection(db,"work_logs");
  const WAGE = 20000;

  const normalize = d => ({ id:d.id, ...d.data() });

  return {
    getLogs: async (filters={}) => {
      const snap = await getDocs(COL);
      let arr = snap.docs.map(normalize).sort((a,b)=>b.start-a.start);

      const { range="all", shift="all" } = filters;
      const now=new Date();
      const startOf=t=>{
        const d=new Date(now);d.setHours(0,0,0,0);
        if(t==="week"){const day=d.getDay()||7;d.setDate(d.getDate()-(day-1))}
        if(t==="month"){d.setDate(1)}
        return d.getTime();
      };

      if(range!=="all"){
        const ts=startOf(range);
        arr=arr.filter(l=>l.start>=ts);
      }
      if(shift==="day") arr=arr.filter(l=>!l.isNight);
      if(shift==="night") arr=arr.filter(l=>l.isNight);
      return arr;
    },

    checkIn: async ()=>{
      const snap=await getDocs(query(COL,where("end","==",null)));
      if(!snap.empty) return;
      await addDoc(COL,{
        start:Date.now(),
        end:null,
        duration:0,
        wage:0,
        note:"",
        isNight:false,
        isOT:false
      });
    },

    checkOut: async ()=>{
      const snap=await getDocs(query(COL,where("end","==",null)));
      if(snap.empty) return;
      const d=snap.docs[0];
      const start=d.data().start;
      const end=Date.now();
      const duration=end-start;
      await updateDoc(doc(db,"work_logs",d.id),{
        end,
        duration,
        wage:Math.round(WAGE*duration/3600000),
        isOT:duration/3600000>8
      });
    },

    addLog: async (start,end,note="Manual")=>{
      const duration=end-start;
      await addDoc(COL,{
        start,end,duration,
        wage:Math.round(WAGE*duration/3600000),
        note,
        isNight:false,
        isOT:duration/3600000>8
      });
    },

    deleteLog: async id=>{
      await deleteDoc(doc(db,"work_logs",id));
    },

    addNote: async (id,note)=>{
      await updateDoc(doc(db,"work_logs",id),{note});
    },

    toggleOT: async id=>{
      const ref=doc(db,"work_logs",id);
      const snap=await getDocs(query(COL));
      const d=snap.docs.find(x=>x.id===id);
      if(d) await updateDoc(ref,{isOT:!d.data().isOT});
    },

    toggleNight: async id=>{
      const ref=doc(db,"work_logs",id);
      const snap=await getDocs(query(COL));
      const d=snap.docs.find(x=>x.id===id);
      if(d) await updateDoc(ref,{isNight:!d.data().isNight});
    },

    getStats: async ()=>{
      const logs=await Core.getLogs({range:"all"});
      const sod=new Date();sod.setHours(0,0,0,0);
      const sow=new Date(sod);sow.setDate(sow.getDate()-(sow.getDay()||7)+1);
      const som=new Date(sod);som.setDate(1);
      const sum=a=>a.reduce((s,l)=>s+(l.duration||0),0);
      return{
        today:sum(logs.filter(l=>l.start>=sod)),
        week:sum(logs.filter(l=>l.start>=sow)),
        month:sum(logs.filter(l=>l.start>=som)),
        wage:logs.reduce((s,l)=>s+(l.wage||0),0)
      };
    }
  };
})();

/* ---------- UI ---------- */
const UI={filters:{range:"today",shift:"all"},activeLogId:null};

const renderStats=async()=>{
  const s=await Core.getStats();
  statToday.textContent=fmtHours(s.today);
  statWeek.textContent=fmtHours(s.week);
  statMonth.textContent=fmtHours(s.month);
  statWage.textContent=currency(s.wage)+"đ";
};

const renderTimeline=async()=>{
  const logs=await Core.getLogs(UI.filters);
  skeleton.classList.add("hidden");
  timeline.innerHTML="";
  if(!logs.length){emptyState.classList.remove("hidden");return;}
  emptyState.classList.add("hidden");

  const groups={};
  logs.forEach(l=>{
    const k=new Date(l.start).toISOString().slice(0,10);
    (groups[k]=groups[k]||[]).push(l);
  });

  Object.entries(groups).sort((a,b)=>b[0].localeCompare(a[0])).forEach(([day,items])=>{
    const g=document.createElement("div");
    g.className="day-group";
    g.innerHTML=`<div class="day-header">
      <div class="day-title">${new Date(day).toLocaleDateString("vi-VN",{weekday:"long",day:"2-digit",month:"2-digit"})}</div>
      <div class="day-subtitle">${items.length} ca</div>
    </div>`;
    items.forEach(l=>{
      const c=document.createElement("div");
      c.className="card"+(day===todayKey()?" today":"");
      c.innerHTML=`
      <div class="card-icon"><i class="fa-solid fa-clock"></i></div>
      <div class="card-main">
        <div class="card-time">${fmtTime(l.start)}${l.end?" — "+fmtTime(l.end):""}</div>
        <div class="card-meta">
          ${l.end?fmtHours(l.duration):"Running"}
          ${l.wage?`<span class="badge pay">${currency(l.wage)}đ</span>`:""}
          ${l.isNight?`<span class="badge night">🌙</span>`:""}
          ${l.isOT?`<span class="badge ot">OT</span>`:""}
          ${l.note?`<span>📝 ${l.note}</span>`:""}
        </div>
      </div>
      <div class="card-actions">
        ${!l.end?`<button class="btn-mini" data-act="checkout" data-id="${l.id}">⏹</button>`:""}
        <button class="btn-mini" data-act="more" data-id="${l.id}">⋮</button>
      </div>`;
      g.appendChild(c);
    });
    timeline.appendChild(g);
  });

  timeline.querySelectorAll(".btn-mini").forEach(b=>{
    b.onclick=async e=>{
      const {act,id}=e.currentTarget.dataset;
      haptic([5]);
      if(act==="checkout") await Core.checkOut();
      if(act==="more"){UI.activeLogId=id;openBottomSheet(true);}
      await refresh();
    };
  });
};

const refresh=async()=>{await renderStats();await renderTimeline();};

/* ---------- Events ---------- */
window.addEventListener("DOMContentLoaded",async()=>{
  document.querySelectorAll(".chip").forEach(c=>{
    c.onclick=async e=>{
      document.querySelectorAll(".chip").forEach(x=>x.classList.remove("active"));
      e.target.classList.add("active");
      if(e.target.dataset.range) UI.filters.range=e.target.dataset.range;
      if(e.target.dataset.shift) UI.filters.shift=e.target.dataset.shift;
      await refresh();
    };
  });

  let t;
  fab.onpointerdown=()=>{t=setTimeout(openBottomSheet,500)};
  fab.onpointerup=async()=>{
    if(t){clearTimeout(t);const logs=await Core.getLogs({range:"today"});
      logs.some(l=>!l.end)?await Core.checkOut():await Core.checkIn();
      await refresh();
    }
  };

  sheetBackdrop.onclick=()=>bottomSheet.classList.add("hidden");
  await refresh();
});

function openBottomSheet() {
  sheetBackdrop.classList.remove("hidden");
  bottomSheet.classList.remove("hidden");

  sheetContent.innerHTML = `
    <div class="sheet-grid">
      <div class="sheet-btn" id="btnAddManual">
        <i class="fa-solid fa-plus"></i> Thêm ca thủ công
      </div>
      <div class="sheet-btn" id="btnCancel">
        <i class="fa-solid fa-xmark"></i> Huỷ
      </div>
    </div>
  `;

  document.getElementById("btnCancel").onclick = closeBottomSheet;
  document.getElementById("btnAddManual").onclick = addManualShift;
}

function closeBottomSheet() {
  sheetBackdrop.classList.add("hidden");
  bottomSheet.classList.add("hidden");
}

async function addManualShift() {
  try {
    const date = prompt("Ngày (YYYY-MM-DD)", todayKey());
    if (!date) return;

    const startTime = prompt("Giờ bắt đầu (HH:mm)", "08:00");
    if (!startTime) return;

    const endTime = prompt("Giờ kết thúc (HH:mm)", "17:00");
    if (!endTime) return;

    const start = new Date(`${date}T${startTime}`).getTime();
    const end = new Date(`${date}T${endTime}`).getTime();

    if (end <= start) {
      alert("❌ Giờ kết thúc phải lớn hơn giờ bắt đầu");
      return;
    }

    await Core.addLog(start, end, "Thêm thủ công");
    closeBottomSheet();
    await refresh();
  } catch (e) {
    alert("❌ Lỗi khi thêm ca");
    console.error(e);
  }
}
