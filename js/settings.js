import { $, showToast } from "./utils.js";
import { state } from "./store.js";
import { render } from "./workLogs.js";

const DEFAULT_LOGO = "img/logo.png";

export function applyCustomSettings() {
  const loading = document.getElementById("appNameLoading");
  if (loading) loading.innerText = state.APP_NAME;
  const auth = document.getElementById("appNameAuth");
  if (auth) auth.innerText = state.APP_NAME;
}

export function applyCustomLogo(src) {
  document.querySelectorAll(".logo-img").forEach(img => img.src = src);
  const preview = $("#logoPreviewImg");
  if (preview) preview.src = src;
  const favicon = $("#favicon"); if (favicon) favicon.href = src;
  document.querySelectorAll('link[rel="apple-touch-icon"]').forEach(link => link.href = src);

  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    if (src && src.startsWith('data:')) {
      navigator.serviceWorker.controller.postMessage({ type: 'SET_CUSTOM_LOGO', logo: src });
    }
  }
}

export function loadSavedLogo() {
  const saved = localStorage.getItem('kaito_custom_logo');
  if (saved) applyCustomLogo(saved);
}

export function applyTheme(name) {
  document.body.className = name === 'default' ? '' : `theme-${name}`;
  localStorage.setItem('kaito_theme', name);
  
  document.querySelectorAll(".theme-dot").forEach(d => {
    d.classList.toggle("active", d.dataset.theme === name);
  });
}

export function initSettings() {
  const settingsModal = $("#settingsModal");
  const toggleSettings = (show) => settingsModal.classList.toggle("hidden", !show);

  if ($("#btnSettings")) {
    $("#btnSettings").onclick = () => {
      $("#inpWage").value = state.USER_WAGE;
      const inpAppName = $("#inpAppName"); if(inpAppName) inpAppName.value = state.APP_NAME;
      const inpTargetHours = $("#inpTargetHours"); if(inpTargetHours) inpTargetHours.value = state.TARGET_HOURS;
      const inpTargetDays = $("#inpTargetDays"); if(inpTargetDays) inpTargetDays.value = state.TARGET_DAYS;
      const chkShowSprites = $("#chkShowSprites"); if(chkShowSprites) chkShowSprites.checked = localStorage.getItem('kaito_show_sprites') !== 'false';
      
      const saved = localStorage.getItem('kaito_theme') || 'default';
      document.querySelectorAll(".theme-dot").forEach(d => {
        d.classList.toggle("active", d.dataset.theme === saved);
      });
      
      toggleSettings(true);
    };
  }

  if ($("#btnCloseSettings")) $("#btnCloseSettings").onclick = () => toggleSettings(false);
  
  if ($("#btnCloseSettingsBottom")) {
    $("#btnCloseSettingsBottom").onclick = () => {
      const w = parseInt($("#inpWage").value);
      if (w && w > 0) {
        state.USER_WAGE = w;
        localStorage.setItem('shift_wage', state.USER_WAGE);
      }
      
      const inpAppName = $("#inpAppName");
      if (inpAppName) {
        state.APP_NAME = inpAppName.value.trim() || "KAITO";
        localStorage.setItem('kaito_app_name', state.APP_NAME);
      }
      
      const th = parseInt($("#inpTargetHours").value);
      if (th && th > 0) {
        state.TARGET_HOURS = th;
        localStorage.setItem('kaito_target_hours', state.TARGET_HOURS);
      }
      
      const td = parseInt($("#inpTargetDays").value);
      if (td && td > 0) {
        state.TARGET_DAYS = td;
        localStorage.setItem('kaito_target_days', state.TARGET_DAYS);
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
  }

  const savedTheme = localStorage.getItem('kaito_theme') || 'default';
  applyTheme(savedTheme);

  document.querySelectorAll(".theme-dot").forEach(dot => {
    dot.onclick = () => applyTheme(dot.dataset.theme);
  });

  loadSavedLogo();

  if ($("#logoPreviewWrap")) $("#logoPreviewWrap").onclick = () => $("#inpLogoFile").click();

  if ($("#inpLogoFile")) {
    $("#inpLogoFile").onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      if (!file.type.startsWith('image/')) {
        showToast("Chỉ chấp nhận file ảnh!", "error");
        return;
      }
      
      if (file.size > 2 * 1024 * 1024) {
        showToast("Ảnh quá lớn! Tối đa 2MB.", "error");
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const size = 256; 
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          
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
      e.target.value = ''; 
    };
  }

  if ($("#btnResetLogo")) {
    $("#btnResetLogo").onclick = (e) => {
      e.stopPropagation();
      localStorage.removeItem('kaito_custom_logo');
      applyCustomLogo(DEFAULT_LOGO);
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CUSTOM_LOGO' });
      }
      showToast("Đã khôi phục logo mặc định!", "success");
    };
  }
}
