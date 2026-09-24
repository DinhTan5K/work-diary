import { auth } from "../firebase.js";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { $, showToast } from "./utils.js";
import { render } from "./workLogs.js";
import { renderExpenses } from "./expenses.js";

const authScreen = $("#authScreen");
const mainApp = $("#mainApp");
const btnTabLogin = $("#btnTabLogin");
const btnTabRegister = $("#btnTabRegister");
const authForm = $("#authForm");
const btnLogout = $("#btnLogout");

let isRegistering = false;

export function initAuth() {
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
      window.location.reload();
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
      renderExpenses();
    } else {
      if (authScreen) authScreen.style.display = "flex";
      if (mainApp) mainApp.style.display = "none";
      if (authForm) authForm.reset();
      $("#btnAuthSubmit").innerText = isRegistering ? "Đăng Ký" : "Đăng Nhập";
    }
  });
}
