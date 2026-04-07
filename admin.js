(function () {
  "use strict";

  const errEl = document.getElementById("admin-opener-error");
  const appendInput = document.getElementById("admin-append-input");
  const btnAppend = document.getElementById("btn-admin-append");
  const specialSeconds = document.getElementById("admin-special-seconds");
  const btnSpecialArm = document.getElementById("btn-admin-special-arm");
  const specialStatus = document.getElementById("admin-special-status");
  const kimchiRate = document.getElementById("admin-kimchi-rate");
  const kimchiRateValue = document.getElementById("admin-kimchi-rate-value");
  const nextPreview = document.getElementById("admin-next-preview");
  const btnRefreshPreview = document.getElementById("btn-admin-refresh-preview");
  const btnSave = document.getElementById("btn-admin-save");
  const btnSubmit = document.getElementById("btn-admin-submit");

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = String(str || "");
    return d.innerHTML;
  }

  function clampSpecial(sec) {
    let s = parseInt(sec, 10);
    if (isNaN(s) || s < 1) {
      s = 10;
    }
    if (s > 999) {
      s = 999;
    }
    return s;
  }

  function getGame() {
    return window.opener && window.opener.KimchiGame ? window.opener.KimchiGame : null;
  }

  function showError(msg) {
    if (!errEl) {
      return;
    }
    errEl.textContent = msg;
    errEl.hidden = false;
  }

  function hideError() {
    if (errEl) {
      errEl.hidden = true;
    }
  }

  function syncFormFromStorage() {
    if (typeof KimchiSync === "undefined") {
      return;
    }
    const s = KimchiSync.readSettings();
    if (specialSeconds) {
      specialSeconds.value = String(clampSpecial(s.specialPageTiming));
    }
    if (kimchiRate && s.kimchiPlaybackRate != null && !isNaN(s.kimchiPlaybackRate)) {
      kimchiRate.value = String(s.kimchiPlaybackRate);
    }
    if (kimchiRateValue && kimchiRate) {
      const r = parseFloat(kimchiRate.value);
      kimchiRateValue.textContent = (isNaN(r) ? 1 : r).toFixed(1) + "×";
    }
  }

  function updateSpecialStatusDisplay() {
    if (!specialStatus) {
      return;
    }
    if (typeof KimchiSync === "undefined") {
      specialStatus.textContent = "";
      return;
    }
    const s = KimchiSync.readSettings();
    const arm = s.specialArm || {};
    if (arm.armed && arm.appearAt) {
      const ms = arm.appearAt - Date.now();
      if (ms > 0) {
        specialStatus.textContent =
          "약 " + Math.ceil(ms / 1000) + "초 뒤 등장 조건이 충족됩니다.";
      } else {
        specialStatus.textContent =
          "등장 조건 충족 — 게임에서 「다음 페이지」 시 스페셜이 열립니다.";
      }
    } else {
      specialStatus.textContent = "등장 대기 (「등장」을 누르면 타이머가 시작됩니다)";
    }
  }

  function renderPreviewMessage(payload) {
    if (!nextPreview || !payload) {
      return;
    }
    const cur = payload.currentText || "";
    const html = payload.nextPreviewHtml || "";
    nextPreview.innerHTML =
      '<div class="admin-preview-block">' +
      '<span class="preview-kind">현재 화면</span>' +
      '<pre class="admin-preview-pre">' +
      escapeHtml(cur) +
      "</pre></div>" +
      '<div class="admin-preview-block admin-preview-block--next">' +
      '<span class="preview-kind">다음 페이지</span>' +
      html +
      "</div>";
  }

  function saveAllSettings() {
    if (typeof KimchiSync === "undefined") {
      return;
    }
    const sec = specialSeconds ? clampSpecial(specialSeconds.value) : 10;
    if (specialSeconds) {
      specialSeconds.value = String(sec);
    }
    let rate = parseFloat(kimchiRate && kimchiRate.value);
    if (isNaN(rate)) {
      rate = 1;
    }
    rate = Math.min(3, Math.max(0.5, rate));
    if (kimchiRate) {
      kimchiRate.value = String(rate);
    }
    if (kimchiRateValue) {
      kimchiRateValue.textContent = rate.toFixed(1) + "×";
    }
    KimchiSync.patchSettings({
      specialPageTiming: sec,
      kimchiPlaybackRate: rate,
    });
    hideError();
  }

  function refreshPreview() {
    const g = getGame();
    if (g && nextPreview) {
      nextPreview.innerHTML =
        '<div class="admin-preview-block admin-preview-block--next">' +
        '<span class="preview-kind">다음 페이지</span>' +
        g.getPreviewHtml() +
        "</div>";
      return;
    }
    if (nextPreview && !nextPreview.innerHTML.trim()) {
      nextPreview.innerHTML =
        '<p class="settings-hint admin-preview-placeholder">게임 탭에서 문장이 바뀌면 여기에 실시간으로 표시됩니다.</p>';
    }
  }

  if (typeof KimchiSync === "undefined") {
    showError("kimchi-sync.js를 불러오지 못했습니다. 같은 폴더에 있는지 확인해 주세요.");
  } else {
    syncFormFromStorage();
    updateSpecialStatusDisplay();
    refreshPreview();
    if (!getGame()) {
      hideError();
    } else {
      hideError();
      syncFromGameOpener();
    }
  }

  function syncFromGameOpener() {
    const g = getGame();
    if (!g) {
      return;
    }
    const st = g.getState();
    if (specialSeconds && typeof st.specialDelaySeconds === "number") {
      specialSeconds.value = String(clampSpecial(st.specialDelaySeconds));
    }
    if (kimchiRate && typeof st.kimchiPlaybackRate === "number") {
      kimchiRate.value = String(st.kimchiPlaybackRate);
    }
    if (kimchiRateValue && typeof st.kimchiPlaybackRate === "number") {
      kimchiRateValue.textContent = st.kimchiPlaybackRate.toFixed(1) + "×";
    }
    if (specialStatus && typeof st.specialArmStatus === "string") {
      specialStatus.textContent = st.specialArmStatus;
    }
    refreshPreview();
  }

  if (btnSave) {
    btnSave.addEventListener("click", saveAllSettings);
  }
  if (btnSubmit) {
    btnSubmit.addEventListener("click", saveAllSettings);
  }

  if (btnAppend) {
    btnAppend.addEventListener("click", function () {
      if (!appendInput || typeof KimchiSync === "undefined") {
        return;
      }
      const raw = appendInput.value.trim();
      if (!raw) {
        return;
      }
      const cur = KimchiSync.readSettings();
      const pend = (cur.pendingSentences || "").trim();
      const merged = pend ? pend + "\n" + raw : raw;
      KimchiSync.patchSettings({ pendingSentences: merged });
      appendInput.value = "";
    });
  }

  if (btnSpecialArm) {
    btnSpecialArm.addEventListener("click", function () {
      if (typeof KimchiSync === "undefined" || !specialSeconds) {
        return;
      }
      const sec = clampSpecial(specialSeconds.value);
      specialSeconds.value = String(sec);
      const appearAt = Date.now() + sec * 1000;
      KimchiSync.patchSettings({
        specialPageTiming: sec,
        specialArm: { armed: true, appearAt: appearAt },
      });
      updateSpecialStatusDisplay();
      const g = getGame();
      if (g) {
        g.armSpecialAppear(sec);
      }
    });
  }

  if (kimchiRate) {
    kimchiRate.addEventListener("input", function () {
      let r = parseFloat(kimchiRate.value);
      if (isNaN(r)) {
        r = 1;
      }
      r = Math.min(3, Math.max(0.5, r));
      if (kimchiRateValue) {
        kimchiRateValue.textContent = r.toFixed(1) + "×";
      }
      if (typeof KimchiSync !== "undefined") {
        KimchiSync.patchSettings({ kimchiPlaybackRate: r });
      }
      const g = getGame();
      if (g) {
        g.setKimchiPlaybackRate(r);
      }
    });
  }

  if (btnRefreshPreview) {
    btnRefreshPreview.addEventListener("click", refreshPreview);
  }

  if (typeof KimchiSync !== "undefined") {
    const ch = KimchiSync.getBroadcastChannel();
    if (ch) {
      ch.addEventListener("message", function (ev) {
        const d = ev.data;
        if (d && d.type === "kimchi-preview") {
          renderPreviewMessage(d);
        }
      });
    }
  }

  window.addEventListener("storage", function (e) {
    if (typeof KimchiSync === "undefined" || e.key !== KimchiSync.KIMCHI_SETTINGS) {
      return;
    }
    syncFormFromStorage();
    updateSpecialStatusDisplay();
  });

  setInterval(function () {
    const g = getGame();
    if (g && specialStatus) {
      const st = g.getState();
      if (typeof st.specialArmStatus === "string") {
        specialStatus.textContent = st.specialArmStatus;
      }
    } else if (typeof KimchiSync !== "undefined") {
      updateSpecialStatusDisplay();
    }
  }, 800);
})();
