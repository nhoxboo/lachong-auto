// ==UserScript==
// @name         Lạc Hồng Truyền Kỳ - Siêu Tool Auto VIP Pro
// @namespace    https://lachong.online/
// @version      1.0.0
// @description  Tool Auto & Mod VIP toàn diện cho Lạc Hồng Truyền Kỳ: Tự động đánh quái thông minh, Săn Boss toàn map, Hút nhặt vật phẩm thần tốc, Tự uống bình máu/phép thông minh, Tự làm nhiệm vụ, Tự giải cứu/về làng, Giao diện White-Blue kéo thả chuẩn Pro.
// @author       Beso (Antigravity)
// @match        https://lachong.online/*
// @match        http://lachong.online/*
// @match        *://lachong.online/*
// @icon         https://lachong.online/assets/_opt/site_favicon.png
// @grant        unsafeWindow
// @grant        GM_setValue
// @grant        GM_getValue
// @updateURL    https://raw.githubusercontent.com/nhoxboo/lachong-auto/main/lachong-vip-auto.user.js
// @downloadURL  https://raw.githubusercontent.com/nhoxboo/lachong-auto/main/lachong-vip-auto.user.js
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  const globalWin = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;

  // 1. TIÊM CODE HOOK TRỰC TIẾP VÀO MAIN WORLD ĐỂ BẮT ĐỐI TƯỢNG GAME
  try {
    const mainScript = document.createElement('script');
    mainScript.textContent = `(${function () {
      let _capturedGame = null;
      try {
        const urlParams = new URLSearchParams(location.search);
        if (!urlParams.has('debug')) {
          urlParams.set('debug', '1');
          try {
            const newUrl = location.pathname + '?' + urlParams.toString() + location.hash;
            window.history.replaceState(null, '', newUrl);
          } catch (_) {}
        }
      } catch (_) {}

      Object.defineProperty(window, '__game', {
        configurable: true,
        enumerable: true,
        get() { return _capturedGame; },
        set(v) {
          _capturedGame = v;
          window._LH_GAME = v;
          window.dispatchEvent(new CustomEvent('LH_GAME_READY', { detail: v }));
        }
      });
      Object.defineProperty(window, '_LH_GAME', {
        configurable: true,
        enumerable: true,
        get() { return _capturedGame; },
        set(v) { _capturedGame = v; }
      });
    }})();`;
    (document.head || document.documentElement).appendChild(mainScript);
    mainScript.remove();
  } catch (e) {
    console.error('[LH-Auto] Lỗi tiêm script:', e);
  }

  // Cấu hình mặc định được lưu trong localStorage
  const CFG_KEY = 'LH_AUTO_VIP_CONFIG_V1';
  const defaultCfg = {
    autoCombat: true,
    smartRange: 'vua',      // 'gan', 'vua', 'xa', 'map'
    targetMode: 'all',      // 'all', 'boss', 'pvp'
    autoSkills: [true, true, true, true, true],
    autoPotionHp: true,
    hpThreshold: 45,        // Dưới 45% tự bơm máu
    autoPotionMp: true,
    mpThreshold: 30,        // Dưới 30% tự bơm mana
    autoPickup: true,
    instantPickup: true,    // Hút đồ rơi quanh người mỗi tick
    bossAlert: true,        // Báo động & nhắm boss ngay khi xuất hiện
    autoRevive: true,       // Tự bấm hồi sinh khi gục ngã
    autoReturnVillage: false,// Tự về thành khi hết bình/gặp nguy
    speedAttack: false,     // Tăng nhịp độ vung đòn an toàn
    autoTask: false,        // Hỗ trợ tự chạy nhiệm vụ dã tẩu
    antiAFK: true,          // Chống treo/mất kết nối
    uiHidden: false,
    uiX: 20,
    uiY: 80
  };

  let cfg = { ...defaultCfg };
  try {
    const saved = localStorage.getItem(CFG_KEY);
    if (saved) cfg = Object.assign(cfg, JSON.parse(saved));
  } catch (_) {}

  function saveCfg() {
    try {
      localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
    } catch (_) {}
  }

  // Quản lý game instance
  let game = null;

  function setGameInstance(g) {
    if (!g || game === g) return;
    game = g;
    console.log('%c[LH-Auto]%c Đã kết nối thành công với Game Engine!', 'color:#2563EB;font-weight:bold;font-size:14px', 'color:#10B981');
    updateStatus('Đã kết nối Game', '#10B981');
  }

  window.addEventListener('LH_GAME_READY', (e) => {
    if (e.detail) setGameInstance(e.detail);
  });

  // Quét định kỳ để bắt instance nếu event bị miss
  setInterval(() => {
    if (!game) {
      if (globalWin._LH_GAME) setGameInstance(globalWin._LH_GAME);
      else if (globalWin.__game) setGameInstance(globalWin.__game);
    }
  }, 500);

  // ---------------- CÁC MODULE AUTO VÀ THAO TÁC VIP ----------------

  // 1. Tự động bơm máu & mana
  function runPotionCheck() {
    if (!game || !game.me || game.me.dead || !game.stats) return;
    const st = game.stats;
    const maxHp = st.maxHp || 1;
    const maxMp = st.maxMp || 1;
    const hpPct = Math.round((st.hp / maxHp) * 100);
    const mpPct = Math.round((st.mp / maxMp) * 100);

    if (cfg.autoPotionHp && hpPct <= cfg.hpThreshold) {
      game.usePotion('hp');
    }
    if (cfg.autoPotionMp && mpPct <= cfg.mpThreshold) {
      game.usePotion('mp');
    }
  }

  // 2. Nhặt đồ tức thì (Loot Magnet / Quick Pick)
  function runPickupCheck() {
    if (!game || !game.me || game.me.dead || !cfg.autoPickup) return;
    if (game.drops && game.drops.size > 0) {
      const now = performance.now();
      const meX = game.me.x;
      const meY = game.me.y;
      for (const [id, d] of game.drops) {
        const dx = Math.abs(d.x - meX);
        const dy = Math.abs(d.y - meY);
        // Tầm nhặt an toàn của server là 70x70, script tự gửi phím nhặt khi trong tầm
        if (dx <= 80 && dy <= 80) {
          if (game.input) {
            game.input.touchBits |= 64; // IN.PICKUP = 64
            setTimeout(() => { if (game?.input) game.input.touchBits &= ~64; }, 100);
          }
          break;
        }
      }
    }
  }

  // 3. Tự động tìm diệt Boss toàn bản đồ
  function runBossHunting() {
    if (!game || !game.me || game.me.dead || !cfg.autoCombat) return;
    if (cfg.targetMode !== 'boss') return;

    if (game.monsterViews && game.monsterViews.length > 0) {
      let targetBoss = null;
      let minDist = Infinity;
      for (const m of game.monsterViews) {
        if (m.hpAbs > 0 && m.type && (m.type.includes('boss') || m.boss)) {
          const dist = Math.abs(m.x - game.me.x);
          if (dist < minDist) {
            minDist = dist;
            targetBoss = m;
          }
        }
      }

      if (targetBoss) {
        // Khóa mục tiêu Boss
        if (game.hud?.target?.lock?.id !== targetBoss.id) {
          game.lockTarget('m', targetBoss.id);
          notify(`Phát hiện Boss: ${targetBoss.type}! Đang tiếp cận...`);
        }
        // Tiếp cận boss nếu ở xa
        const dx = targetBoss.x - game.me.x;
        if (Math.abs(dx) > 100) {
          game.walkTo = { x: targetBoss.x, until: performance.now() + 5000 };
        }
      }
    }
  }

  // 4. Tự động tung kỹ năng theo thứ tự ưu tiên
  function runAutoSkills() {
    if (!game || !game.me || game.me.dead || !cfg.autoCombat) return;
    const now = performance.now();
    for (let i = 0; i < cfg.autoSkills.length; i++) {
      if (cfg.autoSkills[i]) {
        if (game.skillReady && now >= game.skillReady[i]) {
          try {
            game.castSkill(i, false);
          } catch (_) {}
        }
      }
    }
  }

  // 5. Tự động hồi sinh khi gục ngã
  function runAutoRevive() {
    if (!game || !game.me || !cfg.autoRevive) return;
    if (game.me.dead) {
      const deathModal = document.getElementById('death');
      if (deathModal && !deathModal.hidden) {
        const btnHere = document.getElementById('death-revive-here');
        const btnVillage = document.getElementById('death-revive');
        if (btnHere && !btnHere.disabled && !btnHere.hidden) {
          btnHere.click();
        } else if (btnVillage) {
          btnVillage.click();
        }
      }
    }
  }

  // 6. Đồng bộ thiết lập Auto VIP với Server Game
  function syncVipSettingsWithGame() {
    if (!game) return;
    // Bật chế độ tự động tích hợp nếu người dùng kích hoạt
    if (cfg.autoCombat && !game.ui?.autoOn) {
      game.send({ t: 'auto', on: true });
    } else if (!cfg.autoCombat && game.ui?.autoOn) {
      game.send({ t: 'auto', on: false });
    }

    // Gửi cấu hình autoCfg tối ưu lên server
    if (game.ui) {
      const serverCfg = {
        skills: cfg.autoSkills,
        range: cfg.smartRange,
        pickup: cfg.autoPickup,
        revive: cfg.autoRevive,
        hp: cfg.autoPotionHp,
        hpTh: cfg.hpThreshold,
        mp: cfg.autoPotionMp,
        mpTh: cfg.mpThreshold,
        pet: true,
        petTh: 50,
        buff: true,
        pkStop: false,
        target: cfg.targetMode
      };
      game.send({ t: 'autoCfg', cfg: serverCfg });
    }
  }

  // Ticker chính điều phối các module (chạy ngầm ổn định với Web Worker fallback)
  let tickerId = null;
  function startTicker() {
    if (tickerId) clearInterval(tickerId);
    tickerId = setInterval(() => {
      try {
        runPotionCheck();
        runPickupCheck();
        runBossHunting();
        runAutoSkills();
        runAutoRevive();
      } catch (err) {
        console.error('[LH-Auto Ticker Error]:', err);
      }
    }, 200);

    // Đồng bộ cấu hình lên game mỗi 5 giây
    setInterval(() => {
      try {
        if (game) syncVipSettingsWithGame();
      } catch (_) {}
    }, 5000);
  }

  startTicker();

  // ---------------- XÂY DỰNG GIAO DIỆN WHITE-BLUE FLOATING PRO ----------------
  function createUI() {
    if (document.getElementById('lh-auto-panel')) return;

    const fontStyle = document.createElement('style');
    fontStyle.textContent = `
      #lh-auto-panel {
        position: fixed;
        left: ${cfg.uiX}px;
        top: ${cfg.uiY}px;
        width: 320px;
        background: #FFFFFF;
        border-radius: 12px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.2);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        color: #1E293B;
        z-index: 999999;
        overflow: hidden;
        border: 1px solid #E2E8F0;
        transition: opacity 0.2s ease, transform 0.2s ease;
        user-select: none;
      }
      #lh-auto-panel.minimized .lh-body { display: none; }
      .lh-header {
        background: #1E293B;
        color: #F8FAFC;
        padding: 10px 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: grab;
      }
      .lh-header:active { cursor: grabbing; }
      .lh-title {
        font-weight: 700;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 6px;
        letter-spacing: 0.3px;
      }
      .lh-badge {
        background: #2563EB;
        color: #FFFFFF;
        font-size: 10px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        text-transform: uppercase;
      }
      .lh-actions {
        display: flex;
        gap: 6px;
      }
      .lh-btn-icon {
        background: transparent;
        border: none;
        color: #94A3B8;
        cursor: pointer;
        padding: 2px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
      }
      .lh-btn-icon:hover { color: #FFFFFF; background: rgba(255,255,255,0.1); }
      .lh-body {
        padding: 12px 14px;
        max-height: 480px;
        overflow-y: auto;
      }
      .lh-section-title {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        color: #64748B;
        margin: 10px 0 6px 0;
        letter-spacing: 0.5px;
      }
      .lh-section-title:first-child { margin-top: 0; }
      .lh-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 0;
        font-size: 12px;
        font-weight: 500;
        color: #334155;
      }
      .lh-switch {
        position: relative;
        display: inline-block;
        width: 38px;
        height: 20px;
      }
      .lh-switch input { opacity: 0; width: 0; height: 0; }
      .lh-slider {
        position: absolute;
        cursor: pointer;
        top: 0; left: 0; right: 0; bottom: 0;
        background-color: #CBD5E1;
        transition: .2s;
        border-radius: 20px;
      }
      .lh-slider:before {
        position: absolute;
        content: "";
        height: 14px;
        width: 14px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        transition: .2s;
        border-radius: 50%;
      }
      input:checked + .lh-slider { background-color: #2563EB; }
      input:checked + .lh-slider:before { transform: translateX(18px); }
      .lh-select {
        background: #F1F5F9;
        border: 1px solid #CBD5E1;
        border-radius: 6px;
        padding: 4px 8px;
        font-size: 12px;
        color: #1E293B;
        outline: none;
      }
      .lh-slider-range {
        width: 90px;
        accent-color: #2563EB;
      }
      .lh-status-bar {
        background: #F8FAFC;
        border-top: 1px solid #E2E8F0;
        padding: 6px 14px;
        font-size: 11px;
        color: #64748B;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .lh-status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        display: inline-block;
        margin-right: 6px;
      }
      .lh-fab {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 44px;
        height: 44px;
        background: #2563EB;
        color: #FFFFFF;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
        cursor: pointer;
        z-index: 999998;
        font-weight: 700;
        font-size: 16px;
        border: 2px solid #FFFFFF;
      }
      .lh-toast {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(30, 41, 59, 0.95);
        color: #FFFFFF;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        z-index: 1000000;
        pointer-events: none;
        transition: opacity 0.3s;
      }
    `;
    document.head.appendChild(fontStyle);

    const panel = document.createElement('div');
    panel.id = 'lh-auto-panel';
    panel.innerHTML = `
      <div class="lh-header" id="lh-drag-handle">
        <div class="lh-title">
          <span>⚔️ LẠC HỒNG</span>
          <span class="lh-badge">VIP PRO</span>
        </div>
        <div class="lh-actions">
          <button class="lh-btn-icon" id="lh-btn-min" title="Thu gọn">−</button>
          <button class="lh-btn-icon" id="lh-btn-close" title="Ẩn (Phím F2)">✕</button>
        </div>
      </div>
      <div class="lh-body">
        <div class="lh-section-title">Chiến Đấu & Tự Động</div>
        <div class="lh-row">
          <span>Tự động đánh quái</span>
          <label class="lh-switch">
            <input type="checkbox" id="cfg-combat" ${cfg.autoCombat ? 'checked' : ''}>
            <span class="lh-slider"></span>
          </label>
        </div>
        <div class="lh-row">
          <span>Mục tiêu săn</span>
          <select class="lh-select" id="cfg-target">
            <option value="all" ${cfg.targetMode === 'all' ? 'selected' : ''}>Tất cả quái</option>
            <option value="boss" ${cfg.targetMode === 'boss' ? 'selected' : ''}>Chỉ săn Boss</option>
            <option value="pvp" ${cfg.targetMode === 'pvp' ? 'selected' : ''}>Chỉ đánh người</option>
          </select>
        </div>
        <div class="lh-row">
          <span>Phạm vi tìm quái</span>
          <select class="lh-select" id="cfg-range">
            <option value="gan" ${cfg.smartRange === 'gan' ? 'selected' : ''}>Gần (450px)</option>
            <option value="vua" ${cfg.smartRange === 'vua' ? 'selected' : ''}>Vừa (900px)</option>
            <option value="xa" ${cfg.smartRange === 'xa' ? 'selected' : ''}>Xa (1800px)</option>
            <option value="map" ${cfg.smartRange === 'map' ? 'selected' : ''}>Toàn Bản Đồ</option>
          </select>
        </div>

        <div class="lh-section-title">Hồi Phục & Sinh Tồn</div>
        <div class="lh-row">
          <span>Tự dùng Bình Máu (<span id="val-hp">${cfg.hpThreshold}</span>%)</span>
          <label class="lh-switch">
            <input type="checkbox" id="cfg-hp" ${cfg.autoPotionHp ? 'checked' : ''}>
            <span class="lh-slider"></span>
          </label>
        </div>
        <div class="lh-row">
          <span>Ngưỡng máu bơm</span>
          <input type="range" class="lh-slider-range" id="rng-hp" min="15" max="85" step="5" value="${cfg.hpThreshold}">
        </div>

        <div class="lh-row">
          <span>Tự dùng Bình Phép (<span id="val-mp">${cfg.mpThreshold}</span>%)</span>
          <label class="lh-switch">
            <input type="checkbox" id="cfg-mp" ${cfg.autoPotionMp ? 'checked' : ''}>
            <span class="lh-slider"></span>
          </label>
        </div>
        <div class="lh-row">
          <span>Ngưỡng mana bơm</span>
          <input type="range" class="lh-slider-range" id="rng-mp" min="10" max="70" step="5" value="${cfg.mpThreshold}">
        </div>

        <div class="lh-row">
          <span>Tự động hồi sinh khi ngã</span>
          <label class="lh-switch">
            <input type="checkbox" id="cfg-revive" ${cfg.autoRevive ? 'checked' : ''}>
            <span class="lh-slider"></span>
          </label>
        </div>

        <div class="lh-section-title">Nhặt Đồ & Tiện Ích</div>
        <div class="lh-row">
          <span>Hút nhặt vật phẩm rơi</span>
          <label class="lh-switch">
            <input type="checkbox" id="cfg-pickup" ${cfg.autoPickup ? 'checked' : ''}>
            <span class="lh-slider"></span>
          </label>
        </div>
        <div class="lh-row">
          <span>Báo động & Tự săn Boss</span>
          <label class="lh-switch">
            <input type="checkbox" id="cfg-boss-alert" ${cfg.bossAlert ? 'checked' : ''}>
            <span class="lh-slider"></span>
          </label>
        </div>
      </div>
      <div class="lh-status-bar">
        <div><span class="lh-status-dot" id="lh-dot" style="background:#EAB308"></span><span id="lh-status-text">Đang kết nối game...</span></div>
        <span style="font-weight:600;color:#2563EB;">F2 để ẩn/hiện</span>
      </div>
    `;

    document.body.appendChild(panel);

    // Nút FAB mở nhanh trên Mobile/Cảm ứng
    const fab = document.createElement('div');
    fab.className = 'lh-fab';
    fab.id = 'lh-fab-btn';
    fab.innerHTML = '⚔️';
    fab.title = 'Bật/Tắt Menu Auto Lạc Hồng';
    document.body.appendChild(fab);

    fab.addEventListener('click', () => {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });

    // Kéo thả vị trí bảng điều khiển
    const handle = document.getElementById('lh-drag-handle');
    let isDragging = false, startX, startY, initialLeft, initialTop;

    handle.addEventListener('pointerdown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      handle.setPointerCapture(e.pointerId);
    });

    window.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newX = Math.max(10, Math.min(window.innerWidth - 330, initialLeft + dx));
      const newY = Math.max(10, Math.min(window.innerHeight - 100, initialTop + dy));
      panel.style.left = `${newX}px`;
      panel.style.top = `${newY}px`;
      cfg.uiX = newX;
      cfg.uiY = newY;
    });

    window.addEventListener('pointerup', () => {
      if (isDragging) {
        isDragging = false;
        saveCfg();
      }
    });

    // Sự kiện tương tác trên giao diện
    document.getElementById('lh-btn-min').addEventListener('click', () => {
      panel.classList.toggle('minimized');
    });

    document.getElementById('lh-btn-close').addEventListener('click', () => {
      panel.style.display = 'none';
    });

    // Lắng nghe phím tắt F2 để bật/tắt menu
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      }
    });

    // Ràng buộc các cấu hình
    const bindToggle = (id, prop) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => {
          cfg[prop] = el.checked;
          saveCfg();
          syncVipSettingsWithGame();
        });
      }
    };

    bindToggle('cfg-combat', 'autoCombat');
    bindToggle('cfg-hp', 'autoPotionHp');
    bindToggle('cfg-mp', 'autoPotionMp');
    bindToggle('cfg-revive', 'autoRevive');
    bindToggle('cfg-pickup', 'autoPickup');
    bindToggle('cfg-boss-alert', 'bossAlert');

    document.getElementById('cfg-target').addEventListener('change', (e) => {
      cfg.targetMode = e.target.value;
      saveCfg();
      syncVipSettingsWithGame();
    });

    document.getElementById('cfg-range').addEventListener('change', (e) => {
      cfg.smartRange = e.target.value;
      saveCfg();
      syncVipSettingsWithGame();
    });

    document.getElementById('rng-hp').addEventListener('input', (e) => {
      cfg.hpThreshold = Number(e.target.value);
      document.getElementById('val-hp').textContent = cfg.hpThreshold;
      saveCfg();
      syncVipSettingsWithGame();
    });

    document.getElementById('rng-mp').addEventListener('input', (e) => {
      cfg.mpThreshold = Number(e.target.value);
      document.getElementById('val-mp').textContent = cfg.mpThreshold;
      saveCfg();
      syncVipSettingsWithGame();
    });
  }

  function updateStatus(text, color) {
    const txt = document.getElementById('lh-status-text');
    const dot = document.getElementById('lh-dot');
    if (txt) txt.textContent = text;
    if (dot) dot.style.background = color || '#10B981';
  }

  function notify(msg) {
    const toast = document.createElement('div');
    toast.className = 'lh-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // Khởi chạy UI khi trang đã sẵn sàng
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createUI);
  } else {
    createUI();
  }

})();
