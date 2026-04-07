/**
 * index.html ↔ admin.html 공통 localStorage 키 및 동기화 유틸
 * @see KIMCHI_SETTINGS
 */
(function (global) {
  "use strict";

  /** 게임·관리자가 공유하는 설정 JSON (localStorage 단일 키) */
  var KIMCHI_SETTINGS = "KIMCHI_SETTINGS";

  /** BroadcastChannel 이름 — 미리보기·실시간 알림 */
  var KIMCHI_BROADCAST_CHANNEL = "kimchi-game-sync";

  function defaultSettings() {
    return {
      specialPageTiming: 10,
      kimchiPlaybackRate: 1,
      pendingSentences: "",
      specialArm: {
        armed: false,
        appearAt: 0,
      },
    };
  }

  function readSettings() {
    try {
      var raw = localStorage.getItem(KIMCHI_SETTINGS);
      if (!raw) {
        return defaultSettings();
      }
      var o = JSON.parse(raw);
      var base = defaultSettings();
      var merged = Object.assign({}, base, o);
      merged.specialArm = Object.assign({}, base.specialArm, o.specialArm || {});
      return merged;
    } catch (e) {
      return defaultSettings();
    }
  }

  /**
   * 설정 전체 덮어쓰기 (누락 필드는 기본값)
   */
  function writeSettingsFull(data) {
    var base = defaultSettings();
    var next = Object.assign({}, base, data);
    next.specialArm = Object.assign({}, base.specialArm, data.specialArm || {});
    localStorage.setItem(KIMCHI_SETTINGS, JSON.stringify(next));
    return next;
  }

  /**
   * 일부 필드만 병합 저장
   */
  function patchSettings(partial) {
    var cur = readSettings();
    var next = Object.assign({}, cur, partial);
    next.specialArm = Object.assign({}, cur.specialArm, partial.specialArm || {});
    localStorage.setItem(KIMCHI_SETTINGS, JSON.stringify(next));
    return next;
  }

  var _channel = null;

  function getBroadcastChannel() {
    if (typeof BroadcastChannel === "undefined") {
      return null;
    }
    if (!_channel) {
      _channel = new BroadcastChannel(KIMCHI_BROADCAST_CHANNEL);
    }
    return _channel;
  }

  global.KimchiSync = {
    KIMCHI_SETTINGS: KIMCHI_SETTINGS,
    KIMCHI_BROADCAST_CHANNEL: KIMCHI_BROADCAST_CHANNEL,
    defaultSettings: defaultSettings,
    readSettings: readSettings,
    writeSettingsFull: writeSettingsFull,
    patchSettings: patchSettings,
    getBroadcastChannel: getBroadcastChannel,
  };
})(typeof window !== "undefined" ? window : this);
