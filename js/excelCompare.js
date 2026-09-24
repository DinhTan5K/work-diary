import { db, auth } from "../firebase.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showToast } from "./utils.js";

export function initExcelCompare() {
  const btnCompare = document.getElementById("btnCompareExcel");
  const modal = document.getElementById("excelCompareModal");
  const btnClose = document.getElementById("btnCloseExcelCompare");
  const btnStart = document.getElementById("btnStartCompare");
  const resultDiv = document.getElementById("excelCompareResult");
  const tableWrapper = document.getElementById("excelCompareTableWrapper");

  if (!btnCompare || !modal) return;

  btnCompare.addEventListener("click", () => {
    modal.classList.remove("hidden");
    modal.style.display = "flex";
    const savedName = localStorage.getItem("kaito_excel_name");
    if (savedName) document.getElementById("inpExcelEmployeeName").value = savedName;
  });

  btnClose.addEventListener("click", () => {
    modal.classList.add("hidden");
    setTimeout(() => { modal.style.display = "none"; }, 300);
  });

  btnStart.addEventListener("click", async () => {
    const nameInput = document.getElementById("inpExcelEmployeeName").value.trim();
    const fileInput = document.getElementById("inpExcelFile");

    if (!nameInput) {
      showToast("Vui lòng nhập tên nhân viên!", "error");
      return;
    }
    if (!fileInput.files.length) {
      showToast("Vui lòng chọn file Excel!", "error");
      return;
    }

    localStorage.setItem("kaito_excel_name", nameInput);
    btnStart.innerText = "Đang xử lý...";
    btnStart.disabled = true;
    resultDiv.style.display = "none";

    try {
      // 1. Lấy dữ liệu từ Kaito App
      const q = query(collection(db, "work_logs"), where("uid", "==", auth.currentUser.uid));
      const snap = await getDocs(q);
      const appLogs = snap.docs.map(d => d.data());

      const appShiftsByDate = {};
      appLogs.forEach(log => {
        const d = new Date(log.start);
        const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        const sTime = d.toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit', hour12: false});
        const eTime = new Date(log.end).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit', hour12: false});
        
        if (!appShiftsByDate[dateStr]) appShiftsByDate[dateStr] = [];
        appShiftsByDate[dateStr].push({ start: sTime, end: eTime });
      });

      // Sắp xếp lại giờ trên app (để so sánh chuỗi cho chuẩn)
      for (let k in appShiftsByDate) {
         appShiftsByDate[k].sort((a,b) => a.start.localeCompare(b.start));
      }

      // 2. Đọc file Excel
      const file = fileInput.files[0];
      const reader = new FileReader();
      
      reader.onload = function(e) {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, {type: 'array'});
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {header: 1, defval: ""});

          let dateRowIdx = -1;
          let timeHeaderRowIdx = -1;
          let employeeRowIdx = -1;

          // Tìm dòng chứa "Giờ vào" / "Giờ ra" để suy ra dòng trên nó là Ngày tháng
          for (let i = 0; i < Math.min(10, jsonData.length); i++) {
            const rowStr = jsonData[i].map(c => String(c||"").toLowerCase().replace(/\s/g, '')).join("");
            if (rowStr.includes("giờvào") && rowStr.includes("giờra")) {
              timeHeaderRowIdx = i;
              dateRowIdx = i - 1;
              break;
            }
          }

          if (dateRowIdx === -1 || dateRowIdx < 0) {
            showToast("Không tìm thấy dòng tiêu đề 'Giờ vào' / 'Giờ ra' trong file", "error");
            btnStart.innerText = "Bắt đầu đối soát";
            btnStart.disabled = false;
            return;
          }

          // Tìm dòng chứa tên nhân viên
          let normalizedInput = nameInput.normalize('NFC').toLowerCase().replace(/\s+/g, '');
          for (let i = 0; i < jsonData.length; i++) {
            // Quét 3 cột đầu tiên để tìm tên (phòng trường hợp cột A là STT hoặc để trống)
            for (let c = 0; c < 3; c++) {
              const cellVal = String(jsonData[i][c] || "").normalize('NFC').toLowerCase().replace(/\s+/g, '');
              if (cellVal && cellVal === normalizedInput) {
                employeeRowIdx = i;
                break;
              }
            }
            if (employeeRowIdx !== -1) break;
          }

          if (employeeRowIdx === -1) {
            showToast(`Không tìm thấy nhân viên "${nameInput}" trong cột đầu tiên`, "error");
            btnStart.innerText = "Bắt đầu đối soát";
            btnStart.disabled = false;
            return;
          }

          const dateRow = jsonData[dateRowIdx];
          const empRow = jsonData[employeeRowIdx];

          const excelShiftsByDate = {};
          
          let currentDate = "";
          for (let col = 1; col < dateRow.length; col++) {
            let rawDate = dateRow[col];
            let cellDate = "";
            
            if (rawDate) {
               if (typeof rawDate === 'number') {
                  // Excel serial date to DD/MM/YYYY
                  const d = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
                  cellDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
               } else {
                  cellDate = String(rawDate).trim();
               }
            }

            if (cellDate && cellDate.match(/\d{1,2}\/\d{1,2}\/\d{4}/)) {
              currentDate = cellDate;
              // Chuẩn hóa thành DD/MM/YYYY nếu nó là D/M/YYYY
              const parts = currentDate.split('/');
              if(parts.length === 3) {
                 currentDate = `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
              }
            }
            
            if (currentDate) {
              let rawTimeIn = empRow[col];
              let rawTimeOut = empRow[col+1];
              
              let timeInStr = String(rawTimeIn || "").trim().toUpperCase();
              let timeOutStr = String(rawTimeOut || "").trim().toUpperCase();
              
              if (!excelShiftsByDate[currentDate]) excelShiftsByDate[currentDate] = [];
              
              if (timeInStr && timeInStr !== "OFF" && timeOutStr && timeOutStr !== "OFF") {
                 const headerText = String(jsonData[timeHeaderRowIdx][col] || "").toLowerCase().replace(/\s/g, '');
                 if (headerText.includes("giờvào") || headerText === "in") {
                     excelShiftsByDate[currentDate].push({
                       start: formatExcelTime(rawTimeIn),
                       end: formatExcelTime(rawTimeOut)
                     });
                 }
              }
            }
          }

          // Sắp xếp lại giờ trên excel
          for (let k in excelShiftsByDate) {
             excelShiftsByDate[k].sort((a,b) => a.start.localeCompare(b.start));
          }

          // 3. So sánh
          const mismatches = [];
          const excelMonths = new Set();
          
          for (const [date, exShifts] of Object.entries(excelShiftsByDate)) {
             // Lưu lại các tháng/năm có trong file Excel (VD: "08/2026")
             const parts = date.split('/');
             if (parts.length === 3) excelMonths.add(`${parts[1]}/${parts[2]}`);

             const apShifts = appShiftsByDate[date] || [];
             const exStr = exShifts.map(s => `${s.start}-${s.end}`).join(" | ");
             const apStr = apShifts.map(s => `${s.start}-${s.end}`).join(" | ");
             
             if (exStr !== apStr) {
                mismatches.push({
                   date: date,
                   excel: exStr || "OFF",
                   app: apStr || "OFF"
                });
             }
          }

          // Kiểm tra các ngày có trong App nhưng KHÔNG có trong Excel
          // CHỈ xét những ngày thuộc về các THÁNG mà file Excel đang báo cáo
          for (const [date, apShifts] of Object.entries(appShiftsByDate)) {
             const parts = date.split('/');
             if (parts.length === 3) {
                 const monthYear = `${parts[1]}/${parts[2]}`;
                 if (!excelMonths.has(monthYear)) continue; // Bỏ qua nếu tháng này không có trong Excel (VD: tháng 7, tháng 9)
             }

             if (!excelShiftsByDate[date]) {
                if (apShifts.length > 0) {
                    const apStr = apShifts.map(s => `${s.start}-${s.end}`).join(" | ");
                    if (!mismatches.some(m => m.date === date)) {
                        mismatches.push({ date: date, excel: "Không có trong bảng (Hoặc OFF)", app: apStr });
                    }
                }
             }
          }

          // 4. Hiển thị
          mismatches.sort((a, b) => {
              const pa = a.date.split('/');
              const pb = b.date.split('/');
              return new Date(`${pa[2]}-${pa[1]}-${pa[0]}`) - new Date(`${pb[2]}-${pb[1]}-${pb[0]}`);
          });

          resultDiv.style.display = "block";
          if (mismatches.length === 0) {
             tableWrapper.innerHTML = `<div style="padding: 15px; text-align: center; color: #4CAF50; font-weight: bold; background: rgba(76, 175, 80, 0.1); border-radius: 8px; border: 1px solid #4CAF50;"><i class="fa-solid fa-check-circle"></i> Tuyệt vời! Dữ liệu khớp 100% không lệch đồng nào!</div>`;
          } else {
             let html = `<div style="margin-bottom: 10px; color: #ffaa00;"><i class="fa-solid fa-triangle-exclamation"></i> Phát hiện <b>${mismatches.length}</b> ngày có sai lệch:</div>`;
             html += `<table class="expense-table" style="width:100%; border-collapse: collapse; font-size: 0.9rem;">
                <thead>
                   <tr style="background: rgba(255,255,255,0.05);">
                      <th style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: left;">Ngày</th>
                      <th style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: left;">Trên App Kaito</th>
                      <th style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: left;">File Excel (HR)</th>
                   </tr>
                </thead>
                <tbody>`;
             mismatches.forEach(m => {
                html += `<tr>
                   <td style="padding: 8px; border-bottom: 1px dotted rgba(255,255,255,0.05);">${m.date}</td>
                   <td style="padding: 8px; border-bottom: 1px dotted rgba(255,255,255,0.05); color: #4CAF50;">${m.app}</td>
                   <td style="padding: 8px; border-bottom: 1px dotted rgba(255,255,255,0.05); color: #ff4d4f; font-weight: 600;">${m.excel}</td>
                </tr>`;
             });
             html += `</tbody></table>`;
             tableWrapper.innerHTML = html;
          }

        } catch (err) {
           console.error(err);
           showToast("Lỗi khi đọc file Excel! (Xem Console)", "error");
        } finally {
           btnStart.innerText = "Bắt đầu đối soát";
           btnStart.disabled = false;
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error(error);
      showToast("Lỗi khi tải dữ liệu từ App", "error");
      btnStart.innerText = "Bắt đầu đối soát";
      btnStart.disabled = false;
    }
  });
}

function formatExcelTime(val) {
   if (val === undefined || val === null || val === "") return "";
   
   // Nếu nó là một chuỗi chứa số thập phân (như "0.3125"), chuyển thành số
   let numVal = Number(val);
   if (!isNaN(numVal) && String(val).trim() !== "" && typeof val !== 'boolean') {
      val = numVal;
   }

   if (typeof val === 'number') {
      let totalSeconds = Math.round(val * 24 * 3600);
      let h = Math.floor(totalSeconds / 3600);
      let m = Math.floor((totalSeconds % 3600) / 60);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
   }
   
   // Nếu nó đã là chuỗi chuẩn như "07:30"
   return String(val).trim();
}
