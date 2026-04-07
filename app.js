/**
 * 스페셜 대기 시간(밀리초). 관리자 창에서 「등장」을 누르면 이 값만큼 지난 뒤 다음 「다음 페이지」에서 스페셜이 한 번 열립니다.
 * 기본값: 10초(10000ms).
 * @type {number}
 */
var specialPageInterval = 10000;

(function () {
  "use strict";

  /** Fisher-Yates shuffle — 원본 배열을 바꾸지 않고 새 배열 반환 */
  function shuffleFisherYates(items) {
    const a = items.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function randomIntInclusive(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function ordinalEnglish(n) {
    if (n === 1) {
      return "1st";
    }
    if (n === 2) {
      return "2nd";
    }
    if (n === 3) {
      return "3rd";
    }
    return n + "th";
  }

  /**
   * Reverse 30%, God 20%, Goddess 20%, Nth 20%, Not this time 10%
   */
  function drawSpecialOption() {
    const r = Math.random();
    if (r < 0.3) {
      return "reverse";
    }
    if (r < 0.5) {
      return "god";
    }
    if (r < 0.7) {
      return "goddess";
    }
    if (r < 0.9) {
      return "nth";
    }
    return "notthis";
  }

  /**
   * 다음 페이지 클릭 몇 번 뒤에 김치가 뜰지: 1페이지 후 20%, 2페이지 후 50%, … 합계 100%.
   */
  function drawPagesUntilKimchi() {
    const r = Math.random();
    if (r < 0.2) {
      return 1;
    }
    if (r < 0.7) {
      return 2;
    }
    if (r < 0.9) {
      return 3;
    }
    if (r < 0.97) {
      return 4;
    }
    return 5;
  }

  /**
   * Final 모드: 김치까지 페이지 수 — 1페이지 후 20%, 2페이지 후 50%, 3페이지 후 20%, 4페이지 후 10%.
   */
  function drawFinalPagesUntilKimchi() {
    const r = Math.random();
    if (r < 0.2) {
      return 1;
    }
    if (r < 0.7) {
      return 2;
    }
    if (r < 0.9) {
      return 3;
    }
    return 4;
  }

  /**
   * 섞인 문장 배열을 페이지 단위로 나눔. 각 페이지는 1~3문장(무작위).
   * 마지막 페이지는 남은 문장을 모두 포함.
   */
  function buildPages(sentences) {
    const pages = [];
    let i = 0;
    const n = sentences.length;
    while (i < n) {
      const remaining = n - i;
      let take;
      if (remaining <= 3) {
        take = remaining;
      } else {
        take = randomIntInclusive(1, 3);
      }
      pages.push(sentences.slice(i, i + take));
      i += take;
    }
    return pages;
  }

  /** 한 페이지에서 문장마다 다음 줄에 배치 */
  function formatPageBlock(chunk) {
    return chunk.join("\n");
  }

  const viewSetup = document.getElementById("view-setup");
  const viewGame = document.getElementById("view-game");
  const viewKimchi = document.getElementById("view-kimchi");
  const viewSpecial = document.getElementById("view-special");
  const sentencesInput = document.getElementById("sentences-input");
  const setupError = document.getElementById("setup-error");
  const btnStart = document.getElementById("btn-start");
  const btnSettings = document.getElementById("btn-settings");
  const btnNext = document.getElementById("btn-next");
  const btnNextParticipant = document.getElementById("btn-next-participant");
  const btnKimchiToSetup = document.getElementById("btn-kimchi-to-setup");
  const btnSpecialContinue = document.getElementById("btn-special-continue");
  const gameText = document.getElementById("game-text");
  const kimchiVideo = document.getElementById("kimchi-video");
  const specialPrompt = document.getElementById("special-prompt");
  const specialResult = document.getElementById("special-result");
  const specialDeityWrap = document.getElementById("special-deity-wrap");
  const specialDeityImg = document.getElementById("special-deity-img");
  const specialLabel = document.getElementById("special-label");
  const specialMain = document.getElementById("special-main");
  const specialSub = document.getElementById("special-sub");
  const specialDiceWrap = document.getElementById("special-dice-wrap");
  const specialDice = document.getElementById("special-dice");
  const specialDiceHint = document.getElementById("special-dice-hint");
  const specialCardButtons = document.querySelectorAll(".special-card-btn");
  const gameFinalBadge = document.getElementById("game-final-badge");
  const gameToast = document.getElementById("game-toast");
  const btnFinal = document.getElementById("btn-final");
  const btnWinner = document.getElementById("btn-winner");
  const viewWinner = document.getElementById("view-winner");
  const confettiCanvas = document.getElementById("confetti-canvas");
  const victoryAudio = document.getElementById("victory-audio");
  const btnWinnerClose = document.getElementById("btn-winner-close");
  const btnAdminHidden = document.getElementById("btn-admin-hidden");

  /** 김치 영상 재생 속도 (playbackRate) */
  let kimchiPlaybackRate = 1;

  let sourceSentences = [];
  let pages = [];
  let pageIndex = 0;
  let textFadeAnim = null;
  /** 남은 '다음 페이지' 클릭 횟수(0이 되면 그 클릭에서 김치) */
  let remainingClicksUntilKimchi = 1;
  /** 관리자 「등장」으로 스페셜 타이머가 살아 있는지 */
  let specialAppearArmed = false;
  /** 이 시각(타임스탬프) 이후에만 스페셜 조건 충족 */
  let specialAppearAt = 0;
  /** 카드 뒤집기 완료 여부 */
  let specialCardPicked = false;
  let diceRollTimer = null;
  /** Final 라운드: 선택된 2~5문장만 사용 */
  let isFinalMode = false;
  let finalSentencePool = [];
  let confettiRaf = null;
  let confettiParticles = [];

  function getSpecialIntervalMs() {
    const v =
      typeof specialPageInterval === "number" && !isNaN(specialPageInterval)
        ? specialPageInterval
        : 10000;
    return v < 0 ? 0 : v;
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function applyKimchiPlaybackRateToVideo() {
    if (!kimchiVideo) {
      return;
    }
    let r = kimchiPlaybackRate;
    if (r < 0.5) {
      r = 0.5;
    }
    if (r > 3) {
      r = 3;
    }
    kimchiPlaybackRate = r;
    kimchiVideo.playbackRate = r;
  }

  function computeNextPagePreview() {
    if (sourceSentences.length === 0) {
      return {
        kind: "empty",
        title: "",
        body: "문장이 없습니다. 준비 화면에서 입력하세요.",
      };
    }
    const pool = getActiveSentencePool();
    if (pool.length === 0 || pages.length === 0) {
      return {
        kind: "empty",
        title: "",
        body: "표시할 페이지가 없습니다.",
      };
    }
    if (specialAppearArmed && Date.now() >= specialAppearAt) {
      return {
        kind: "special",
        title: "스페셜 카드",
        body: "물음표 카드 세 장 중 하나를 뒤집는 페이지가 열립니다.",
      };
    }
    if (remainingClicksUntilKimchi <= 1) {
      return {
        kind: "kimchi",
        title: "김치 (아웃)",
        body: "KIMCHI! 영상이 재생되는 김치 페이지입니다.",
      };
    }
    if (pageIndex < pages.length - 1) {
      return {
        kind: "text",
        title: "다음 문장 페이지",
        body: formatPageBlock(pages[pageIndex + 1]),
      };
    }
    const shuffled = shuffleFisherYates(pool);
    const nextPages = buildPages(shuffled);
    const sample = nextPages.length ? formatPageBlock(nextPages[0]) : "(없음)";
    return {
      kind: "reshuffle",
      title: "다시 섞인 뒤 첫 페이지",
      body: sample,
      note: "실제 내용은 그때그때 섞인 순서에 따라 달라질 수 있습니다.",
    };
  }

  function buildPreviewHtml() {
    const p = computeNextPagePreview();
    const kindLabel = {
      empty: "안내",
      special: "스페셜",
      kimchi: "김치",
      text: "문장",
      reshuffle: "재섞음",
    };
    const lab = kindLabel[p.kind] || "미리보기";
    let html =
      '<span class="preview-kind">' +
      escapeHtml(lab) +
      "</span>" +
      escapeHtml(p.body);
    if (p.note) {
      html += "<br /><br /><span>" + escapeHtml("※ " + p.note) + "</span>";
    }
    return html;
  }

  function getSpecialArmStatusText() {
    if (!specialAppearArmed) {
      return "등장 버튼을 누르면 타이머가 시작됩니다.";
    }
    const now = Date.now();
    if (now < specialAppearAt) {
      const left = Math.max(0, Math.ceil((specialAppearAt - now) / 1000));
      return "스페셜까지 약 " + left + "초 남음 — 이후 「다음 페이지」에서 열립니다.";
    }
    return "조건 충족 — 지금 「다음 페이지」를 누르면 스페셜이 열립니다.";
  }

  function appendSentencesFromText(raw) {
    const added = parseSentences(raw || "");
    if (added.length === 0) {
      showGameToast("추가할 문장을 한 줄 이상 입력해 주세요.");
      return { ok: false, count: 0 };
    }
    sourceSentences = sourceSentences.concat(added);
    if (isFinalMode) {
      finalSentencePool = finalSentencePool.concat(added);
    }
    sentencesInput.value = sourceSentences.join("\n");
    showGameToast(added.length + "개의 문장이 목록에 추가되었습니다.");
    return { ok: true, count: added.length };
  }

  function armSpecialAppearSeconds(seconds) {
    let sec = parseInt(seconds, 10);
    if (isNaN(sec) || sec < 1) {
      sec = 10;
    }
    if (sec > 999) {
      sec = 999;
    }
    specialPageInterval = sec * 1000;
    const appearAt = Date.now() + getSpecialIntervalMs();
    specialAppearAt = appearAt;
    specialAppearArmed = true;
    if (typeof KimchiSync !== "undefined") {
      KimchiSync.patchSettings({
        specialPageTiming: sec,
        specialArm: { armed: true, appearAt: appearAt },
      });
    }
  }

  function setKimchiPlaybackRateValue(r) {
    let x = parseFloat(r);
    if (isNaN(x)) {
      x = 1;
    }
    kimchiPlaybackRate = Math.min(3, Math.max(0.5, x));
    applyKimchiPlaybackRateToVideo();
  }

  function openAdminWindow() {
    const w = window.open(
      "admin.html",
      "kimchi-admin",
      "width=560,height=820,scrollbars=yes,resizable=yes"
    );
    if (w) {
      w.focus();
    }
  }

  function applySettingsFromStorage() {
    if (typeof KimchiSync === "undefined") {
      return;
    }
    const s = KimchiSync.readSettings();
    specialPageInterval = (s.specialPageTiming || 10) * 1000;
    if (s.kimchiPlaybackRate != null && !isNaN(s.kimchiPlaybackRate)) {
      setKimchiPlaybackRateValue(s.kimchiPlaybackRate);
    }
    const arm = s.specialArm || {};
    if (arm.armed && arm.appearAt) {
      specialAppearArmed = true;
      specialAppearAt = arm.appearAt;
    } else {
      specialAppearArmed = false;
      specialAppearAt = 0;
    }
    const pend = (s.pendingSentences || "").trim();
    if (pend && sourceSentences.length > 0) {
      const added = parseSentences(pend);
      if (added.length > 0) {
        sourceSentences = sourceSentences.concat(added);
        if (isFinalMode) {
          finalSentencePool = finalSentencePool.concat(added);
        }
        sentencesInput.value = sourceSentences.join("\n");
        KimchiSync.patchSettings({ pendingSentences: "" });
      }
    }
  }

  function broadcastGamePreview() {
    if (typeof KimchiSync === "undefined") {
      return;
    }
    const ch = KimchiSync.getBroadcastChannel();
    if (!ch) {
      return;
    }
    let cur = "";
    if (pages.length > 0 && pageIndex >= 0 && pageIndex < pages.length) {
      cur = formatPageBlock(pages[pageIndex]);
    }
    ch.postMessage({
      type: "kimchi-preview",
      currentText: cur,
      nextPreviewHtml: buildPreviewHtml(),
      pageIndex: pageIndex,
      totalPages: pages.length,
      ts: Date.now(),
    });
  }

  let gameToastTimer = null;

  function showGameToast(message) {
    if (!gameToast) {
      return;
    }
    if (gameToastTimer !== null) {
      clearTimeout(gameToastTimer);
      gameToastTimer = null;
    }
    gameToast.textContent = message;
    gameToast.hidden = false;
    gameToastTimer = setTimeout(function () {
      gameToast.hidden = true;
      gameToastTimer = null;
    }, 3200);
  }

  function updateFinalControls() {
    if (gameFinalBadge) {
      gameFinalBadge.hidden = !isFinalMode;
      gameFinalBadge.setAttribute("aria-hidden", isFinalMode ? "false" : "true");
    }
    if (btnFinal) {
      btnFinal.disabled =
        sourceSentences.length < 2 || isFinalMode;
    }
  }

  function resizeConfettiCanvas() {
    if (!confettiCanvas) {
      return;
    }
    const dpr = typeof window.devicePixelRatio === "number" ? window.devicePixelRatio : 1;
    const w = window.innerWidth || 800;
    const h = window.innerHeight || 600;
    confettiCanvas.width = Math.floor(w * dpr);
    confettiCanvas.height = Math.floor(h * dpr);
    confettiCanvas.style.width = w + "px";
    confettiCanvas.style.height = h + "px";
    const ctx = confettiCanvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function spawnConfettiParticle(w, h) {
    const colors = ["#f472b6", "#fbbf24", "#34d399", "#60a5fa", "#a78bfa", "#fb7185", "#f97316", "#38bdf8"];
    return {
      x: Math.random() * w,
      y: Math.random() * -h * 0.15,
      vy: 1.8 + Math.random() * 3.5,
      vx: (Math.random() - 0.5) * 4,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.15,
      color: colors[randomIntInclusive(0, colors.length - 1)],
      size: 5 + Math.random() * 8,
      w: w,
      h: h,
    };
  }

  function stopConfetti() {
    if (confettiRaf !== null) {
      cancelAnimationFrame(confettiRaf);
      confettiRaf = null;
    }
    confettiParticles = [];
    if (confettiCanvas) {
      const ctx = confettiCanvas.getContext("2d");
      if (ctx) {
        const w = window.innerWidth || 800;
        const h = window.innerHeight || 600;
        ctx.clearRect(0, 0, w, h);
      }
    }
  }

  function confettiFrame() {
    if (!confettiCanvas) {
      return;
    }
    const ctx = confettiCanvas.getContext("2d");
    if (!ctx) {
      return;
    }
    const w = window.innerWidth || 800;
    const h = window.innerHeight || 600;
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < confettiParticles.length; i++) {
      const p = confettiParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08;
      p.rot += p.vr;
      if (p.y > h + 24) {
        confettiParticles[i] = spawnConfettiParticle(w, h);
        continue;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size * 0.5, -p.size * 0.5, p.size, p.size * 0.6);
      ctx.restore();
    }
    confettiRaf = requestAnimationFrame(confettiFrame);
  }

  function startWinnerCelebration() {
    stopConfetti();
    resizeConfettiCanvas();
    const w = window.innerWidth || 800;
    const h = window.innerHeight || 600;
    const reduce =
      typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const n = reduce ? 32 : 130;
    confettiParticles = [];
    for (let i = 0; i < n; i++) {
      confettiParticles.push(spawnConfettiParticle(w, h));
    }
    if (!reduce) {
      confettiRaf = requestAnimationFrame(confettiFrame);
    }
    if (victoryAudio) {
      try {
        victoryAudio.currentTime = 0;
      } catch (e) {
        /* ignore */
      }
      const p = victoryAudio.play();
      if (p && typeof p.catch === "function") {
        p.catch(function () {
          /* 자동재생 제한 */
        });
      }
    }
  }

  function openWinnerPage() {
    showView("winner");
    startWinnerCelebration();
  }

  function closeWinnerPage() {
    stopConfetti();
    if (victoryAudio) {
      victoryAudio.pause();
      try {
        victoryAudio.currentTime = 0;
      } catch (e) {
        /* ignore */
      }
    }
    showView("game");
  }

  function startFinalRound() {
    if (sourceSentences.length < 2) {
      showGameToast("Final을 사용하려면 문장을 2개 이상 입력해 주세요.");
      return;
    }
    isFinalMode = true;
    const maxPick = Math.min(5, sourceSentences.length);
    const pickCount = randomIntInclusive(2, maxPick);
    const shuffled = shuffleFisherYates(sourceSentences);
    finalSentencePool = shuffled.slice(0, pickCount);
    remainingClicksUntilKimchi = drawFinalPagesUntilKimchi();
    pageIndex = 0;
    const shuffledAgain = shuffleFisherYates(finalSentencePool);
    pages = buildPages(shuffledAgain);
    updateFinalControls();
    renderCurrentPage();
  }

  function showView(which) {
    const views = [
      { el: viewSetup, name: "setup" },
      { el: viewGame, name: "game" },
      { el: viewKimchi, name: "kimchi" },
      { el: viewSpecial, name: "special" },
      { el: viewWinner, name: "winner" },
    ];
    views.forEach(({ el, name }) => {
      const on = name === which;
      el.hidden = !on;
      el.classList.toggle("hidden", !on);
      el.setAttribute("aria-hidden", on ? "false" : "true");
    });
  }

  function parseSentences(raw) {
    return raw
      .split(/\r?\n/)
      .map(function (s) {
        return s.trim();
      })
      .filter(function (s) {
        return s.length > 0;
      });
  }

  function getActiveSentencePool() {
    if (isFinalMode && finalSentencePool.length > 0) {
      return finalSentencePool;
    }
    return sourceSentences;
  }

  function reshuffleAndBuildPages() {
    const pool = getActiveSentencePool();
    const shuffled = shuffleFisherYates(pool);
    pages = buildPages(shuffled);
  }

  function prefersReducedMotion() {
    if (typeof matchMedia === "undefined") {
      return false;
    }
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function runTextFadeIn() {
    if (prefersReducedMotion()) {
      return;
    }
    if (textFadeAnim && typeof textFadeAnim.cancel === "function") {
      textFadeAnim.cancel();
    }
    if (typeof gameText.animate !== "function") {
      return;
    }
    textFadeAnim = gameText.animate(
      [{ opacity: 0.5 }, { opacity: 1 }],
      { duration: 400, easing: "ease-out", fill: "both" }
    );
  }

  function resetKimchiVideo() {
    if (!kimchiVideo) {
      return;
    }
    kimchiVideo.pause();
    try {
      kimchiVideo.currentTime = 0;
    } catch (e) {
      /* 일부 환경에서 currentTime 설정 실패 무시 */
    }
  }

  function playKimchiVideo() {
    if (!kimchiVideo) {
      return;
    }
    applyKimchiPlaybackRateToVideo();
    const p = kimchiVideo.play();
    if (p && typeof p.catch === "function") {
      p.catch(function () {
        /* 자동재생 제한 시 사용자가 컨트롤로 재생 */
      });
    }
  }

  function showKimchiPage() {
    showView("kimchi");
    playKimchiVideo();
  }

  function clearDiceRoll() {
    if (diceRollTimer !== null) {
      clearInterval(diceRollTimer);
      diceRollTimer = null;
    }
    if (specialDice) {
      specialDice.classList.remove("special-dice--rolling");
    }
  }

  function hideSpecialDeity() {
    if (!specialDeityWrap || !specialDeityImg) {
      return;
    }
    specialDeityWrap.hidden = true;
    specialDeityWrap.classList.remove("special-deity-wrap--goddess");
    specialDeityImg.removeAttribute("src");
    specialDeityImg.alt = "";
  }

  function showSpecialDeity(kind) {
    if (!specialDeityWrap || !specialDeityImg) {
      return;
    }
    if (kind === "god") {
      specialDeityImg.src = "god.jpg";
      specialDeityImg.alt = "God of Kimchi";
      specialDeityWrap.classList.remove("special-deity-wrap--goddess");
    } else {
      specialDeityImg.src = "goddess.jpg";
      specialDeityImg.alt = "Goddess of Kimchi";
      specialDeityWrap.classList.add("special-deity-wrap--goddess");
    }
    specialDeityWrap.hidden = false;
  }

  function cardFrontLabel(opt) {
    if (opt === "reverse") {
      return "REV";
    }
    if (opt === "god") {
      return "GOD";
    }
    if (opt === "goddess") {
      return "HER";
    }
    if (opt === "nth") {
      return "🎲";
    }
    return "OK";
  }

  function resetSpecialCardsUi() {
    specialCardPicked = false;
    clearDiceRoll();
    if (specialPrompt) {
      specialPrompt.hidden = false;
    }
    if (specialResult) {
      specialResult.hidden = true;
    }
    if (specialLabel) {
      specialLabel.textContent = "";
    }
    if (specialMain) {
      specialMain.textContent = "";
    }
    if (specialSub) {
      specialSub.textContent = "";
    }
    if (specialDiceWrap) {
      specialDiceWrap.hidden = true;
    }
    if (specialDiceHint) {
      specialDiceHint.textContent = "주사위를 굴리는 중…";
    }
    if (specialDice) {
      specialDice.textContent = "🎲";
    }
    hideSpecialDeity();
    if (btnSpecialContinue) {
      btnSpecialContinue.disabled = true;
    }
    specialCardButtons.forEach(function (btn) {
      btn.disabled = false;
      btn.classList.remove("is-flipped");
      const front = btn.querySelector(".special-card-front");
      if (front) {
        front.textContent = "";
        front.setAttribute("aria-hidden", "true");
      }
    });
  }

  function setContinueEnabled(on) {
    if (btnSpecialContinue) {
      btnSpecialContinue.disabled = !on;
    }
  }

  function finishNthPerson(finalN) {
    const ord = ordinalEnglish(finalN);
    const line = "The " + ord + " person from me is out";
    if (specialLabel) {
      specialLabel.textContent = "";
    }
    if (specialMain) {
      specialMain.textContent = line;
    }
    if (specialSub) {
      specialSub.textContent =
        "나에서 " +
        finalN +
        "번째에 해당하는 사람은 아웃입니다.";
    }
    if (specialDiceHint) {
      specialDiceHint.textContent = "결과: " + finalN;
    }
    if (specialDice) {
      specialDice.textContent = String(finalN);
    }
    specialCardButtons.forEach(function (btn) {
      if (btn.classList.contains("is-flipped")) {
        const front = btn.querySelector(".special-card-front");
        if (front) {
          front.textContent = String(finalN);
        }
      }
    });
    setContinueEnabled(true);
  }

  function runNthPersonDice() {
    hideSpecialDeity();
    const finalN = randomIntInclusive(1, 6);
    if (specialLabel) {
      specialLabel.textContent = "";
    }
    if (specialMain) {
      specialMain.textContent = "";
    }
    if (specialSub) {
      specialSub.textContent = "";
    }
    if (specialDiceHint) {
      specialDiceHint.textContent = "주사위를 굴리는 중…";
    }
    if (specialDiceWrap) {
      specialDiceWrap.hidden = false;
    }
    setContinueEnabled(false);
    if (prefersReducedMotion()) {
      finishNthPerson(finalN);
      return;
    }
    if (specialDice) {
      specialDice.classList.add("special-dice--rolling");
      specialDice.textContent = String(randomIntInclusive(1, 6));
    }
    let ticks = 0;
    const maxTicks = 28;
    diceRollTimer = setInterval(function () {
      ticks += 1;
      if (specialDice) {
        specialDice.textContent = String(randomIntInclusive(1, 6));
      }
      if (ticks >= maxTicks) {
        clearDiceRoll();
        finishNthPerson(finalN);
      }
    }, 50);
  }

  function fillStaticOutcome(opt) {
    if (opt === "reverse") {
      hideSpecialDeity();
      if (specialLabel) {
        specialLabel.textContent = "Reverse the direction";
      }
      if (specialMain) {
        specialMain.textContent = "Reverse the direction";
      }
      if (specialSub) {
        specialSub.textContent =
          "읽는 방향을 반대로 바꿉니다.";
      }
      return;
    }
    if (opt === "god") {
      showSpecialDeity("god");
      if (specialLabel) {
        specialLabel.textContent = "God of Kimchi";
      }
      if (specialMain) {
        specialMain.textContent = "God of Kimchi";
      }
      if (specialSub) {
        specialSub.textContent =
          "You can save one person!.";
      }
      return;
    }
    if (opt === "goddess") {
      showSpecialDeity("goddess");
      if (specialLabel) {
        specialLabel.textContent = "Goddess of Kimchi";
      }
      if (specialMain) {
        specialMain.textContent = "Goddess of Kimchi";
      }
      if (specialSub) {
        specialSub.textContent =
          "You can save one person.(boy chooses girl, girl chooses boy)";
      }
      return;
    }
    hideSpecialDeity();
    if (specialLabel) {
      specialLabel.textContent = "Not this time";
    }
    if (specialMain) {
      specialMain.textContent = "Not this time";
    }
    if (specialSub) {
      specialSub.textContent =
        "Nothing happened. Keep going.";
    }
  }

  function applySpecialOutcome(opt) {
    if (specialResult) {
      specialResult.hidden = false;
    }
    if (specialDiceWrap) {
      specialDiceWrap.hidden = opt !== "nth";
    }
    if (opt === "nth") {
      runNthPersonDice();
      return;
    }
    fillStaticOutcome(opt);
    setContinueEnabled(true);
  }

  function onSpecialCardClick(cardBtn) {
    if (specialCardPicked || !cardBtn) {
      return;
    }
    specialCardPicked = true;
    const opt = drawSpecialOption();
    cardBtn.classList.add("is-flipped");
    const front = cardBtn.querySelector(".special-card-front");
    if (front) {
      front.textContent = cardFrontLabel(opt);
      front.setAttribute("aria-hidden", "false");
    }
    specialCardButtons.forEach(function (b) {
      if (b !== cardBtn) {
        b.disabled = true;
      }
    });
    if (specialPrompt) {
      specialPrompt.hidden = true;
    }
    applySpecialOutcome(opt);
  }

  function openSpecialPage() {
    resetSpecialCardsUi();
    showView("special");
  }

  function closeSpecialPage() {
    clearDiceRoll();
    resetSpecialCardsUi();
    if (remainingClicksUntilKimchi <= 1) {
      nextParticipant();
      return;
    }
    showView("game");
  }

  function renderCurrentPage() {
    const pool = getActiveSentencePool();
    if (pool.length === 0 || pages.length === 0) {
      if (textFadeAnim && typeof textFadeAnim.cancel === "function") {
        textFadeAnim.cancel();
      }
      gameText.textContent = "표시할 문장이 없습니다. 준비 화면에서 문장을 입력하세요.";
      btnNext.disabled = true;
      updateFinalControls();
      return;
    }
    gameText.textContent = formatPageBlock(pages[pageIndex]);
    btnNext.disabled = false;
    runTextFadeIn();
    updateFinalControls();
    broadcastGamePreview();
  }

  function clearSetupError() {
    setupError.textContent = "";
    setupError.hidden = true;
    sentencesInput.setAttribute("aria-invalid", "false");
    sentencesInput.removeAttribute("aria-describedby");
  }

  function showSetupError(message) {
    setupError.textContent = message;
    setupError.hidden = false;
    sentencesInput.setAttribute("aria-invalid", "true");
    sentencesInput.setAttribute("aria-describedby", "setup-error");
  }

  sentencesInput.addEventListener("input", clearSetupError);

  function beginRoundOrGame() {
    isFinalMode = false;
    finalSentencePool = [];
    remainingClicksUntilKimchi = drawPagesUntilKimchi();
    reshuffleAndBuildPages();
    pageIndex = 0;
    if (typeof KimchiSync !== "undefined") {
      applySettingsFromStorage();
    }
    showView("game");
    renderCurrentPage();
  }

  function startGame() {
    clearSetupError();
    const list = parseSentences(sentencesInput.value);
    if (list.length === 0) {
      showSetupError("한 줄 이상의 문장을 입력해 주세요.");
      sentencesInput.focus();
      return;
    }
    sourceSentences = list;
    resetKimchiVideo();
    beginRoundOrGame();
    applySettingsFromStorage();
  }

  function nextPage() {
    if (sourceSentences.length === 0) {
      return;
    }
    applySettingsFromStorage();
    if (specialAppearArmed && Date.now() >= specialAppearAt) {
      specialAppearArmed = false;
      if (typeof KimchiSync !== "undefined") {
        KimchiSync.patchSettings({
          specialArm: { armed: false, appearAt: 0 },
        });
      }
      openSpecialPage();
      return;
    }
    remainingClicksUntilKimchi -= 1;
    if (remainingClicksUntilKimchi <= 0) {
      resetKimchiVideo();
      showKimchiPage();
      return;
    }
    if (pageIndex < pages.length - 1) {
      pageIndex += 1;
    } else {
      reshuffleAndBuildPages();
      pageIndex = 0;
    }
    renderCurrentPage();
  }

  function nextParticipant() {
    resetKimchiVideo();
    if (sourceSentences.length === 0) {
      showView("setup");
      return;
    }
    beginRoundOrGame();
  }

  function kimchiToSetup() {
    resetKimchiVideo();
    showView("setup");
  }

  specialCardButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      onSpecialCardClick(btn);
    });
  });

  btnStart.addEventListener("click", startGame);
  btnNext.addEventListener("click", nextPage);

  btnNextParticipant.addEventListener("click", nextParticipant);
  btnKimchiToSetup.addEventListener("click", kimchiToSetup);

  if (btnSpecialContinue) {
    btnSpecialContinue.addEventListener("click", closeSpecialPage);
  }

  btnSettings.addEventListener("click", openAdminWindow);
  if (btnAdminHidden) {
    btnAdminHidden.addEventListener("click", openAdminWindow);
  }

  if (btnFinal) {
    btnFinal.addEventListener("click", startFinalRound);
  }
  if (btnWinner) {
    btnWinner.addEventListener("click", openWinnerPage);
  }
  if (btnWinnerClose) {
    btnWinnerClose.addEventListener("click", closeWinnerPage);
  }

  window.addEventListener("resize", function () {
    if (viewWinner && !viewWinner.classList.contains("hidden")) {
      resizeConfettiCanvas();
    }
  });

  window.addEventListener("storage", function (e) {
    if (typeof KimchiSync === "undefined" || e.key !== KimchiSync.KIMCHI_SETTINGS) {
      return;
    }
    applySettingsFromStorage();
    if (viewGame && !viewGame.hidden) {
      renderCurrentPage();
    }
  });

  if (typeof KimchiSync !== "undefined") {
    applySettingsFromStorage();
  }

  window.KimchiGame = {
    appendSentences: function (text) {
      return appendSentencesFromText(text);
    },
    armSpecialAppear: function (seconds) {
      armSpecialAppearSeconds(seconds);
    },
    setKimchiPlaybackRate: function (r) {
      setKimchiPlaybackRateValue(r);
    },
    getSpecialDelaySeconds: function () {
      return Math.max(1, Math.round(getSpecialIntervalMs() / 1000));
    },
    getKimchiPlaybackRate: function () {
      return kimchiPlaybackRate;
    },
    getPreviewHtml: function () {
      return buildPreviewHtml();
    },
    getState: function () {
      return {
        specialDelaySeconds: Math.max(1, Math.round(getSpecialIntervalMs() / 1000)),
        kimchiPlaybackRate: kimchiPlaybackRate,
        specialArmStatus: getSpecialArmStatusText(),
      };
    },
  };
})();
