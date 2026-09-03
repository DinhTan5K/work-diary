import { $ } from "./utils.js";
import { state } from "./store.js";
import { render } from "./workLogs.js";
import { applyCustomSettings } from "./settings.js";

const btnPrivacyList = document.querySelectorAll(".btn-toggle-privacy");

export const updatePrivacyIcon = () => {
  btnPrivacyList.forEach(btn => {
    btn.innerHTML = state.isMoneyVisible ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>';
  });
};

export function initUI() {
  setTimeout(applyCustomSettings, 100);

  updatePrivacyIcon();
  btnPrivacyList.forEach(btn => {
    btn.onclick = () => {
      state.isMoneyVisible = !state.isMoneyVisible;
      localStorage.setItem('money_visible', state.isMoneyVisible);
      updatePrivacyIcon();
      render();
    };
  });

  const hour = new Date().getHours();
  const helloEl = document.getElementById("greetingHello");
  const subEl = document.getElementById("greetingSub");
  const sectionEl = document.getElementById("greetingSection");
  if (helloEl && subEl && sectionEl) {
    let hello, sub;
    if (hour >= 5 && hour < 12) {
      hello = "Chào buổi sáng,";
      sub = "Làm đi mấy cu em!";
    } else if (hour >= 12 && hour < 14) {
      hello = "Buổi trưa rồi cu,";
      sub = "Kiếm chi đớp đi rồi làm cu!";
    } else if (hour >= 14 && hour < 18) {
      hello = "Chào buổi chiều,";
      sub = "Roán đi sắp được về rồi!";
    } else if (hour >= 18 && hour < 22) {
      hello = "Chào buổi tối,";
      sub = "Dề tắm miếng rồi mai làm tiếp :)))!";
    } else {
      hello = "Khuya rồi,";
      sub = "Giờ ni vô chấm công làm đ gì =)))??!";
    }
    helloEl.innerText = hello;
    subEl.innerText = sub;

    sectionEl.style.display = "flex";
    sectionEl.classList.remove("hide");
    
    setTimeout(() => {
      sectionEl.classList.add("hide");
      setTimeout(() => sectionEl.style.display = "none", 400);
    }, 3000);
  }

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.getAttribute("data-target");
      document.getElementById(target).classList.add("active");
      
      if (target === "tab-expense") {
        $("#fab").style.display = "none";
        $("#fab-expense").style.display = "flex";
      } else {
        $("#fab").style.display = "flex";
        $("#fab-expense").style.display = "none";
      }
    };
  });

  if ($("#btnGoToDiary")) {
    $("#btnGoToDiary").onclick = () => {
      const diaryTabBtn = document.querySelector(".tab-btn[data-target='tab-diary']");
      if (diaryTabBtn) diaryTabBtn.click();
    };
  }

  $("#fab").onclick = () => {
    $("#modalTitle").innerText = "Ca làm việc mới";
    $("#inpNote").closest('.field-group').style.display = "block";
    $("#customShift").style.display = "none";
    $("#customStart").value = "";
    $("#customEnd").value = "";
    
    const chk = $("#chkSavePreset");
    if(chk) chk.checked = false;

    state.customMode = false;
    state.selectedShift = null;

    document.querySelectorAll(".shift-btn").forEach(b => b.classList.remove("active", "selected"));

    $("#workDate").value = new Date().toISOString().split("T")[0];
    $("#inpNote").value = "";
    $("#btnSave").innerText = "Lưu lại";
    state.editModeId = null;
    toggleModal(true);
  };

  $("#btnCancel").onclick = () => { toggleModal(false); state.editModeId = null; };
  $("#btnCloseTop").onclick = () => { toggleModal(false); state.editModeId = null; };

  $("#btnPrevMonth").onclick = () => {
    state.viewMonth--;
    if(state.viewMonth < 0) { state.viewMonth = 11; state.viewYear--; }
    render();
  };

  $("#btnNextMonth").onclick = () => {
    state.viewMonth++;
    if(state.viewMonth > 11) { state.viewMonth = 0; state.viewYear++; }
    render();
  };

  const btnViewTimeline = $("#btnViewTimeline");
  const btnViewCalendar = $("#btnViewCalendar");
  if (btnViewTimeline && btnViewCalendar) {
    const updateToggleUI = () => {
      if (state.diaryViewMode === 'timeline') {
        btnViewTimeline.classList.add('active');
        btnViewCalendar.classList.remove('active');
      } else {
        btnViewCalendar.classList.add('active');
        btnViewTimeline.classList.remove('active');
      }
    };
    
    updateToggleUI();
    
    btnViewTimeline.onclick = () => {
      state.diaryViewMode = 'timeline';
      localStorage.setItem('kaito_diary_view', state.diaryViewMode);
      updateToggleUI();
      render();
    };
    
    btnViewCalendar.onclick = () => {
      state.diaryViewMode = 'calendar';
      localStorage.setItem('kaito_diary_view', state.diaryViewMode);
      updateToggleUI();
      render();
    };
  }

  const btnCloseDayDetail = $("#btnCloseDayDetail");
  if (btnCloseDayDetail) {
    btnCloseDayDetail.onclick = () => {
      $("#dayDetailModal").classList.add("hidden");
      setTimeout(() => {
        $("#dayDetailModal").style.display = "none";
      }, 200);
    };
  }
}

export const toggleModal = (show) => $("#logModal").classList.toggle("hidden", !show);
