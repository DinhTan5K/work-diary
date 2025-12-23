import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs, updateDoc, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const COL = collection(db,"work_logs");
let USER_WAGE = parseInt(localStorage.getItem('shift_wage')) || 20000;

const CLOUD = "do48qpmut";
const PRESET = "shifttrack";

const $ = q=>document.querySelector(q);
const fmtMoney = n => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
// Keep format date for CSV, but UI uses custom split (Day/Month)
const fmtDateFull = d => new Date(d).toLocaleDateString('vi-VN', {day:'2-digit', month:'2-digit', year:'numeric'});

let tempImgFile = null;

// -------- Upload --------
async function upload(file){
  if(!file) return null;
  const f=new FormData();
  f.append("file",file);
  f.append("upload_preset",PRESET);
  const r=await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`,{method:"POST",body:f});
  const d=await r.json();
  return d.secure_url||null;
}

// -------- Modal Logic --------
const modal = $("#logModal");
const inpStart = $("#inpStart");
const inpEnd = $("#inpEnd");
const inpNote = $("#inpNote");
const imgName = $("#imgName");

$("#fab").onclick = () => {
  const now = new Date();
  const past = new Date(now.getTime() - 4*60*60*1000); 
  const toLocalISO = (date) => {
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0,16);
  };
  inpEnd.value = toLocalISO(now);
  inpStart.value = toLocalISO(past);
  inpNote.value = "";
  tempImgFile = null;
  imgName.innerText = "";
  modal.classList.remove("hidden");
};

$("#btnCancel").onclick = () => modal.classList.add("hidden");

$("#btnPickImg").onclick = () => {
  const i = document.createElement("input");
  i.type="file"; i.accept="image/*";
  i.onchange = () => {
    if(i.files[0]){
      tempImgFile = i.files[0];
      imgName.innerText = "Selected: " + i.files[0].name;
    }
  };
  i.click();
};

$("#btnSave").onclick = async () => {
  const start = new Date(inpStart.value).getTime();
  const end = new Date(inpEnd.value).getTime();
  const note = inpNote.value;

  if(start >= end){ alert("End time must be after Start time!"); return; }
  $("#btnSave").innerText = "Saving...";
  
  const dur = end - start;
  const wage = Math.round(USER_WAGE * (dur/3600000));
  const img = await upload(tempImgFile);

  await addDoc(COL, {
    start, end, duration: dur,
    wageRate: USER_WAGE,
    totalMoney: wage,
    note: note,
    image: img 
  });

  $("#btnSave").innerText = "Save Entry";
  modal.classList.add("hidden");
  render();
};

// -------- RENDER (TICKET STYLE) --------
async function render(){
  const snap = await getDocs(COL);
  const logs = snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>b.start-a.start);

  $("#timeline").innerHTML = "";

  const now = new Date();
  let mHours = 0, mMoney = 0, totalMoneyAll = 0;

  logs.forEach(l => {
    totalMoneyAll += l.totalMoney || 0;
    const d = new Date(l.start);
    if(d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()){
      mHours += (l.duration || 0);
      mMoney += (l.totalMoney || 0);
    }

    // --- Date Formatting for Ticket ---
    const day = d.getDate();
    const month = "T" + (d.getMonth() + 1);
    const startTime = new Date(l.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const endTime = new Date(l.end).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const hours = (l.duration/3600000).toFixed(1) + "h";
    
    // Escape quote for onClick
    const safeNote = (l.note || "").replace(/'/g, "\\'"); 

    const c = document.createElement("div");
    c.className = "card";
    
    c.innerHTML = `
      <div class="card-left">
        <div class="date-day">${day}</div>
        <div class="date-month">${month}</div>
      </div>

      <div class="card-body">
        <div class="time-row">
          <span class="time-start-end">${startTime} - ${endTime}</span>
          <span class="duration-badge">${hours}</span>
        </div>
        
        <div class="meta-row">
          ${l.note ? `<div class="note-text"><i class="fa-solid fa-note-sticky"></i> ${l.note}</div>` : '<div class="note-text" style="opacity:0.3">No note</div>'}
          ${l.image ? `<a href="${l.image}" target="_blank" class="btn-img-mini"><i class="fa-solid fa-image"></i> Pic</a>` : ''}
        </div>
      </div>

      <div class="card-right">
        <div class="money-tag">${fmtMoney(l.totalMoney)}</div>
        
        <div class="action-menu">
          <button class="btn-icon" onclick="updateNote('${l.id}', '${safeNote}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-icon del" onclick="del('${l.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `;
    $("#timeline").appendChild(c);
  });

  $("#monthHours").innerText = (mHours/3600000).toFixed(1) + "h";
  $("#monthMoney").innerText = fmtMoney(mMoney);
  $("#totalMoney").innerText = "Total: " + fmtMoney(totalMoneyAll);
}

// -------- Tools --------

window.updateNote = async (id, oldNote) => {
    const newNote = prompt("Update note:", oldNote);
    if(newNote !== null) {
        await updateDoc(doc(db, "work_logs", id), { note: newNote });
        render();
    }
}

$("#btnSettings").onclick = () => {
  const w = prompt("Hourly Rate (VND):", USER_WAGE);
  if(w && !isNaN(w)){
    USER_WAGE = parseInt(w);
    localStorage.setItem('shift_wage', USER_WAGE);
    alert("Saved!");
  }
};

$("#btnExport").onclick = async () => {
  if(!confirm("Download CSV?")) return;
  const snap = await getDocs(COL);
  const logs = snap.docs.map(d=>d.data()).sort((a,b)=>b.start-a.start);
  
  let csvContent = "\uFEFFDate,Start,End,Hours,Money,Note\n";
  logs.forEach(l => {
    const note = l.note ? `"${l.note.replace(/"/g, '""')}"` : "";
    csvContent += `${fmtDateFull(l.start)},${new Date(l.start).toLocaleTimeString()},${new Date(l.end).toLocaleTimeString()},${(l.duration/3600000).toFixed(2)},${l.totalMoney},${note}\n`;
  });
  
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
  link.download = `WorkLog_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
};

window.del = async id => {
  if(confirm("Delete this entry?")) {
    await deleteDoc(doc(db,"work_logs",id));
    render();
  }
};

render();
