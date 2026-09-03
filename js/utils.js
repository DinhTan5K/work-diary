export const $ = q => document.querySelector(q);
export const fmtMoney = n => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
export const getDayName = (d) => ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()];

export function animateValue(elementId, start, end, duration, formatter) {
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

export function showToast(msg, type = "error") {
  const container = document.getElementById("toastContainer");
  if(!container) return;
  let icon = "fa-circle-check";
  if (type === "error") icon = "fa-circle-exclamation";
  else if (type === "info") icon = "fa-circle-info";
  const div = document.createElement("div");
  div.className = `toast toast-${type}`;
  div.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${msg}</span>`;
  div.style.pointerEvents = "auto";
  container.appendChild(div);
  setTimeout(() => {
    div.classList.add("toast-out");
    setTimeout(() => div.remove(), 300);
  }, 3000);
}

window.showConfirm = function(msg) {
  return new Promise(resolve => {
    const dialog = $("#customDialog");
    $("#customDialogTitle").innerText = "Xác nhận";
    $("#customDialogMessage").innerText = msg;
    $("#customDialogInputGroup").style.display = "none";
    dialog.classList.remove("hidden");

    const cleanup = () => {
      $("#btnDialogConfirm").onclick = null;
      $("#btnDialogCancel").onclick = null;
      $("#btnCloseDialogTop").onclick = null;
      dialog.classList.add("hidden");
    };

    $("#btnDialogConfirm").onclick = () => { cleanup(); resolve(true); };
    const cancelFn = () => { cleanup(); resolve(false); };
    $("#btnDialogCancel").onclick = cancelFn;
    $("#btnCloseDialogTop").onclick = cancelFn;
  });
};

window.showPrompt = function(msg, defaultVal = "") {
  return new Promise(resolve => {
    const dialog = $("#customDialog");
    $("#customDialogTitle").innerText = "Nhập thông tin";
    $("#customDialogMessage").innerText = msg;
    const inputGroup = $("#customDialogInputGroup");
    const input = $("#customDialogInput");
    inputGroup.style.display = "block";
    input.value = defaultVal;
    dialog.classList.remove("hidden");
    input.focus();

    const cleanup = () => {
      $("#btnDialogConfirm").onclick = null;
      $("#btnDialogCancel").onclick = null;
      $("#btnCloseDialogTop").onclick = null;
      dialog.classList.add("hidden");
    };

    $("#btnDialogConfirm").onclick = () => { cleanup(); resolve(input.value); };
    const cancelFn = () => { cleanup(); resolve(null); };
    $("#btnDialogCancel").onclick = cancelFn;
    $("#btnCloseDialogTop").onclick = cancelFn;
  });
};
