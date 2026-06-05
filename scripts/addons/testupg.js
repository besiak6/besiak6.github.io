// ==UserScript==
// @name          UPG baddonz
// @version       01.06.2026
// @description   Automatyczne ulepszanie wybranego itemu
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function () {
    'use strict';

    const ADDON_ID = "UPG";
    const MICC_BASE_URL = 'https://micc.garmory-cdn.cloud/obrazki/itemy/';
    const MAX_REAGENTS = 25;
    const BAG_CHECK_INTERVAL = 5000;

    const EVENT_KEYWORDS = [
        "Wakacje", "Urodziny Margonem", "Wielkanoc", "Noc Kupały",
        "Szabat Czarownic", "Halloween", "Gwiazdka", "Licytacja",
        "Licytacja eventowa"
    ];

    const CL_NAMES = {
        1: 'Jednoręczne', 2: 'Dwuręczne', 3: 'Półtoraręczne', 4: 'Łuki',
        5: 'Pomocnicze', 6: 'Różdżki', 7: 'Orby', 8: 'Zbroje', 9: 'Heły',
        10: 'Buty', 11: 'Rękawice', 12: 'Pierki', 13: 'Naszyjniki',
        14: 'Tarcze', 29: 'Strzały',
    };
    const ITEM_TYPE_SETTINGS_MAP = {
        1: 'cl1', 2: 'cl2', 3: 'cl3', 4: 'cl4', 5: 'cl5', 6: 'cl6',
        7: 'cl7', 8: 'cl8', 9: 'cl9', 10: 'cl10', 11: 'cl11', 12: 'cl12',
        13: 'cl13', 14: 'cl14', 29: 'cl29',
    };

    const styleSheet = document.createElement("style");
    styleSheet.className = "upg-custom-styles";
    styleSheet.innerText = `
        .baddonz-upg-wnd { width: 150px; min-width: 150px; }
        .baddonz-upg-wnd .baddonz-window-body { padding: 5px 8px 8px 8px !important; gap: 4px !important; }
        
        /* Naprawa scrollbara i wysokości okna ustawień */
        .baddonz-upg-settings-wnd { width: 260px; min-width: 260px; }
        .baddonz-upg-settings-wnd .baddonz-window-body { 
            padding: 5px 8px 8px 8px !important; 
            gap: 3px !important; 
            height: auto !important; 
            max-height: none !important; 
            overflow: visible !important; 
        }
        
        .upg-item-slot-wrapper { display: flex; justify-content: center; align-items: center; min-height: 42px; margin-top: 4px; }
        .upg-item-name { font-size: 11px; font-weight: bold; color: #ffcc00; text-shadow: 1px 1px #000; text-align: center; padding: 0; }
        .upg-item-progress { font-size: 10px; color: #aaa; text-align: center; padding: 0; }
        .upg-daily-limit { font-size: 10px; color: #ccc; text-align: center; border-top: 1px solid #303030; padding-top: 4px; margin-top: 2px; }
        .upg-typ-wrapper { display: flex; align-items: center; justify-content: center; gap: 3px; padding: 3px; background: rgba(0,0,0,0.3); border-radius: 3px; cursor: url("https://gordion.margonem.pl/img/gui/cursor/5n.png") 4 0, pointer; user-select: none; }
        .upg-typ-wrapper:hover { background: rgba(255,255,255,0.1); }
        #baddonz-upg-type-filters { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; }
        .upg-section-divider { border: none; border-top: 1px solid #303030; margin: 3px 0; width: 100%; }
        .baddonz-upg-wnd .baddonz-window-title { text-align: center; }
        
        /* Style dla zintegrowanego hotkeya */
        .upg-hotkey-input {
            width: 22px;
            height: 18px;
            text-align: center;
            padding: 0;
            margin-left: auto;
            cursor: pointer;
            border: 1px solid #444;
            background: rgba(0,0,0,0.5);
            color: #fff;
            font-size: 10px;
        }
        .upg-hotkey-input.active-keybind-mode {
            border-color: #ffcc00;
            background: rgba(255,204,0,0.2);
            color: #ffcc00;
        }
    `;
    if (!document.querySelector(".upg-custom-styles")) document.head.appendChild(styleSheet);

    // ─── Stan ────────────────────────────────────────────────────────────────
    let currentSettings = {
        enabled: true,
        windowOpacity: 2,
        windowVisible: true,
        settingsWindowVisible: false,
        hotkeyKey: "j",
        hotkeyEnabled: true,
        use_common: false,
        use_unique: false,
        allow_bound_items: false,
        upgrade_endbattle: false,
        count_endbattle: 10,
        bags_upgrade: false,
        count_bags_upgrade: 3,
        cl1: true, cl2: true, cl3: true, cl4: true, cl5: true,
        cl6: true, cl7: true, cl8: true, cl9: true, cl10: true,
        cl11: true, cl12: true, cl13: true, cl14: true, cl29: true,
    };

    let dailyUpgradeCount = 0;
    let dailyUpgradeLimit = 2000;
    let isUpgrading = false;
    let windowEnabled = false;
    let isEndBattleHooked = false;
    let bagLoopTimer = null;
    let uiMainWindow = null;
    let uiSettingsWindow = null;
    let isKeyDownBound = false;

    // ─── Pomocnicze klucze localStorage poza BaddonzAPI ──────────────────────
    const getCharId   = () => window.BaddonzAPI?.charId;
    const getAccId    = () => window.BaddonzAPI?.accountId;
    const progressKey = () => `baddonz-upg-progress-${getCharId()}`;
    const upgItemKey  = () => `baddonz-upg-selected-${getCharId()}`;
    const dailyKey    = 'baddonz-upg-daily-count';

    // ─── Zapis/odczyt zaznaczonego itemu ─────────────────────────────────────
    function setUpgradedItemId(id) {
        if (!getCharId()) return;
        localStorage.setItem(upgItemKey(), id || '');
    }
    function getUpgradedItemId() {
        try { return localStorage.getItem(upgItemKey()) || null; } catch { return null; }
    }

    // ─── Zapis/odczyt progresu ────────────────────────────────────────────────
    function loadProgress(itemId) {
        try {
            const all = JSON.parse(localStorage.getItem(progressKey())) || {};
            return all[itemId] || null;
        } catch { return null; }
    }
    function saveProgress(itemId, text) {
        if (!itemId || !text || text === "Brak danych" || !getCharId()) return;
        try {
            const all = JSON.parse(localStorage.getItem(progressKey())) || {};
            if (getUpgradedItemId() === itemId) all[itemId] = text;
            else delete all[itemId];
            localStorage.setItem(progressKey(), JSON.stringify(all));
        } catch {}
    }

    // ─── Daily count ──────────────────────────────────────────────────────────
    function loadDailyCount() {
        const v = parseInt(localStorage.getItem(dailyKey));
        dailyUpgradeCount = isNaN(v) ? 0 : v;
    }
    function saveDailyCount(n) {
        dailyUpgradeCount = n;
        localStorage.setItem(dailyKey, n);
    }

    // ─── Ustawienia przez BaddonzAPI ──────────────────────────────────────────
    function loadSettings() {
        if (!window.BaddonzAPI) return;
        const accId = getAccId();

        let accSettings = {};
        try {
            const data = JSON.parse(localStorage.getItem('BaddonzData')) || {};
            if (data[accId]?.accountAddons) accSettings = data[accId].accountAddons[ADDON_ID] || {};
        } catch {}

        const charSettings = window.BaddonzAPI.getAddonSettings(ADDON_ID) || {};
        currentSettings = { ...currentSettings, ...accSettings, ...charSettings };
        loadDailyCount();
    }

    function saveSettings() {
        if (!window.BaddonzAPI) return;
        const accId = getAccId();

        const accKeys = [
            'enabled', 'windowOpacity', 'windowVisible', 'settingsWindowVisible',
            'hotkeyKey', 'hotkeyEnabled', 'use_common', 'use_unique', 'allow_bound_items',
            'upgrade_endbattle', 'count_endbattle', 'bags_upgrade', 'count_bags_upgrade',
            'cl1','cl2','cl3','cl4','cl5','cl6','cl7','cl8','cl9','cl10','cl11','cl12','cl13','cl14','cl29'
        ];

        const accSettings = {};
        accKeys.forEach(k => accSettings[k] = currentSettings[k]);

        window.BaddonzAPI.saveAddonSettings(ADDON_ID, {});

        try {
            const data = JSON.parse(localStorage.getItem('BaddonzData')) || {};
            if (!data[accId]) data[accId] = {};
            if (!data[accId].accountAddons) data[accId].accountAddons = {};
            data[accId].accountAddons[ADDON_ID] = accSettings;
            localStorage.setItem('BaddonzData', JSON.stringify(data));
        } catch {}
    }

    // ─── Wyświetlanie itemu w oknie głównym ───────────────────────────────────
    function updateItemDisplay(itemId) {
        if (!uiMainWindow) return;
        const slotWrapper  = uiMainWindow.querySelector('.upg-item-slot-wrapper');
        const nameEl       = uiMainWindow.querySelector('.upg-item-name');
        const progressEl   = uiMainWindow.querySelector('.upg-item-progress');
        if (!slotWrapper || !nameEl || !progressEl) return;

        slotWrapper.innerHTML = '';
        nameEl.textContent = '';
        progressEl.textContent = '';

        const emptySlot = `
            <div class="enhance__item enhance__item--current interface-element-one-item-slot-decor">
                <div class="slot"></div>
                <div class="lvl" data-lvl="0"><div class="cl-icon icon-star-0"></div></div>
            </div>`;
        slotWrapper.insertAdjacentHTML('beforeend', emptySlot);

        if (!itemId || typeof Engine === 'undefined' || !Engine.items) return;
        const item = Engine.items.getItemById(itemId);
        if (!item) return;

        const upgLvl = item.upgrade_lvl || 0;
        const slotEl = slotWrapper.querySelector('.lvl');
        if (slotEl) {
            slotEl.setAttribute('data-lvl', upgLvl);
            slotEl.innerHTML = `<div class="cl-icon icon-star-${upgLvl}"></div>`;
        }

        nameEl.textContent = item.name;

        const storedProgress = loadProgress(itemId);
        if (storedProgress) progressEl.textContent = `Progres: ${storedProgress}`;

        if (typeof $ !== 'undefined' && item.$) {
            const $cloned = item.$.clone();
            $cloned.css({ position: 'relative', width: '32px', height: '32px', top: '0', left: '0', cursor: 'url("https://gordion.margonem.pl/img/gui/cursor/1n.png") 4 0, pointer' });
            $cloned.find('canvas.icon, canvas.canvas-notice').remove();
            $cloned.data('item', item);
            $cloned.on('click', () => {
                setUpgradedItemId('');
                if (typeof window.message === 'function') window.message(`Anulowano ulepszanie: ${item.name}`);
                updateItemDisplay(null);
            });

            const iconSrc  = item.icon || `${item.id}.png`;
            const gifName  = iconSrc.replace(/\.[^/.]+$/, '.gif');
            const $img = $('<img>').attr('src', MICC_BASE_URL + gifName).css({ width: '32px', height: '32px', position: 'absolute', top: '0', left: '0', zIndex: '0' });
            $cloned.append($img);

            const $slot = $(slotWrapper).find('.slot');
            if ($slot.length) $slot.append($cloned);
        }
    }

    function updateDailyLimit() {
        if (!uiMainWindow) return;
        const el = uiMainWindow.querySelector('.upg-daily-limit');
        if (el) el.textContent = `Dzienny Limit: ${dailyUpgradeCount}/${dailyUpgradeLimit}`;
    }

    // ─── Budowanie UI ─────────────────────────────────────────────────────────
    function generateTypeFiltersHtml() {
        const CLS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,29];
        return CLS.map(cl => `
            <div class="upg-typ-wrapper" data-cl="${cl}">
                <div class="baddonz-checkbox upg-cl-cb ${currentSettings['cl'+cl] ? 'active' : ''}" data-key="cl${cl}"></div>
                <div class="baddonz-type-icon cl-${cl}"></div>
            </div>`).join('');
    }

    function buildUI() {
        const mainBodyHtml = `
            <div class="upg-item-slot-wrapper"></div>
            <div class="upg-item-name baddonz-text"></div>
            <div class="upg-item-progress baddonz-text"></div>
            <div class="upg-daily-limit">Dzienny Limit: 0/2000</div>
        `;

        uiMainWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Ulepszara", mainBodyHtml, {
            customId: 'baddonz-ulepszara-wnd',
            hasSettings: true,
            hasCollapse: true, // Zmienione z false na true! (Zwiń/Rozwiń)
            hasClose: true,
            width: '150px'
        });

        // Wstrzykiwanie baddonz-state-button do nagłówka
        const buttonsContainer = uiMainWindow.querySelector('.baddonz-window-buttons');
        if (buttonsContainer) {
            const stateBtn = document.createElement('div');
            stateBtn.className = `baddonz-window-button baddonz-state-button ${currentSettings.enabled ? 'active' : ''}`;
            stateBtn.title = "Włącz/Wyłącz dodatek";
            buttonsContainer.insertBefore(stateBtn, buttonsContainer.querySelector('.baddonz-settings-button'));

            stateBtn.addEventListener('click', () => {
                currentSettings.enabled = !currentSettings.enabled;
                stateBtn.classList.toggle('active', currentSettings.enabled);
                saveSettings();
                
                if (currentSettings.enabled) restartBagLoop();
                else if (bagLoopTimer) { clearInterval(bagLoopTimer); bagLoopTimer = null; }
                
                // Aktualizacja z dockiem, jeśli API posiada taką funkcję
                if (window.BaddonzAPI?.toggleDockState) {
                    window.BaddonzAPI.toggleDockState(ADDON_ID, currentSettings.enabled);
                }
            });
        }

        const settingsBodyHtml = `
            <div class="baddonz-setting-row">
                <div class="baddonz-checkbox upg-hotkey-enabled-cb ${currentSettings.hotkeyEnabled ? 'active' : ''}"></div>
                <span class="baddonz-text">Ulepszanie klawiszem:</span>
                <input type="text" class="baddonz-input upg-hotkey-input keybind" maxlength="1" readonly
                    value="${(currentSettings.hotkeyKey || 'j').toUpperCase()}">
            </div>
            <hr class="upg-section-divider">
            <div class="baddonz-setting-row">
                <div class="baddonz-checkbox upg-use-common-cb ${currentSettings.use_common ? 'active' : ''}"></div>
                <span class="baddonz-text">Ulepszaj Zwykłakami</span>
            </div>
            <div class="baddonz-setting-row">
                <div class="baddonz-checkbox upg-use-unique-cb ${currentSettings.use_unique ? 'active' : ''}"></div>
                <span class="baddonz-text">Ulepszaj Unikatami</span>
            </div>
            <div class="baddonz-setting-row">
                <div class="baddonz-checkbox upg-allow-bound-cb ${currentSettings.allow_bound_items ? 'active' : ''}"></div>
                <span class="baddonz-text">Ulepszaj Związanymi</span>
            </div>
            <hr class="upg-section-divider">
            <span class="baddonz-text" style="text-align:center; font-size:11px; padding:0; margin-bottom:2px;">Typy Itemów:</span>
            <div id="baddonz-upg-type-filters">${generateTypeFiltersHtml()}</div>
            <hr class="upg-section-divider">
            <div class="baddonz-setting-row">
                <div class="baddonz-checkbox upg-endbattle-cb ${currentSettings.upgrade_endbattle ? 'active' : ''}"></div>
                <span class="baddonz-text">Ulepszaj po walce</span>
            </div>
            <div class="upg-endbattle-options baddonz-flex column" style="margin-left:5px; display:${currentSettings.upgrade_endbattle ? 'flex' : 'none'};">
                <span class="baddonz-text" style="font-size:10px; padding:0; margin-bottom:3px;">Min. Liczba Reagentów:</span>
                <input type="number" class="baddonz-input upg-count-endbattle-input" min="1" max="50"
                    value="${currentSettings.count_endbattle}" style="width:100%; text-align:center;">
            </div>
            <div class="baddonz-setting-row">
                <div class="baddonz-checkbox upg-bags-cb ${currentSettings.bags_upgrade ? 'active' : ''}"></div>
                <span class="baddonz-text">Ulepszanie po torbie</span>
            </div>
            <div class="upg-bags-options baddonz-flex column" style="margin-left:5px; display:${currentSettings.bags_upgrade ? 'flex' : 'none'};">
                <span class="baddonz-text" style="font-size:10px; padding:0; margin-bottom:3px;">Max. Wolne Slotów:</span>
                <input type="number" class="baddonz-input upg-count-bags-input" min="1" max="100"
                    value="${currentSettings.count_bags_upgrade}" style="width:100%; text-align:center;">
            </div>
        `;

        uiSettingsWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Ulepszara - Ustawienia", settingsBodyHtml, {
            customId: 'baddonz-ulepszara-settings-wnd',
            hasSettings: false,
            hasCollapse: false,
            hasClose: true,
            width: '260px'
        });

        uiSettingsWindow.classList.add('settings-window', 'baddonz-upg-settings-wnd');
        uiSettingsWindow.removeAttribute('data-addon-id');
        uiSettingsWindow.style.display = currentSettings.settingsWindowVisible ? 'flex' : 'none';

        setupUIListeners();

        const settingsBtn = uiMainWindow.querySelector('.baddonz-settings-button');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                const isVisible = uiSettingsWindow.style.display !== 'none';
                uiSettingsWindow.style.display = isVisible ? 'none' : 'flex';
                currentSettings.settingsWindowVisible = !isVisible;
                saveSettings();
            });
        }

        updateItemDisplay(getUpgradedItemId());
        updateDailyLimit();
    }

    function setupUIListeners() {
        // ── Okno ustawień ────────────────────────────────────────────────────
        const hotkeyCb  = uiSettingsWindow.querySelector('.upg-hotkey-enabled-cb');
        hotkeyCb.addEventListener('click', () => {
            currentSettings.hotkeyEnabled = hotkeyCb.classList.toggle('active');
            saveSettings();
        });

        // Klawisz hotkey (teraz zintegrowany w wierszu)
        const hotkeyInput = uiSettingsWindow.querySelector('.upg-hotkey-input');
        let hotkeyActive = false;
        hotkeyInput.addEventListener('click', () => {
            hotkeyActive = true;
            hotkeyInput.classList.add('active-keybind-mode');
            hotkeyInput.focus();
        });
        hotkeyInput.addEventListener('focusout', () => {
            hotkeyActive = false;
            hotkeyInput.classList.remove('active-keybind-mode');
            hotkeyInput.value = (currentSettings.hotkeyKey || 'j').toUpperCase();
        });
        document.addEventListener('keydown', (e) => {
            if (!hotkeyActive) return;
            const key = e.key.toLowerCase();
            if (['escape','enter','tab'].includes(key)) { hotkeyInput.blur(); return; }
            if (key.length !== 1) return;
            e.preventDefault();
            currentSettings.hotkeyKey = key;
            hotkeyInput.value = key.toUpperCase();
            saveSettings();
            hotkeyActive = false;
            hotkeyInput.blur();
        });

        // Checkboxy rzadkości i zbrojenia
        const bindCb = (sel, key) => {
            const cb = uiSettingsWindow.querySelector(sel);
            if (!cb) return;
            cb.addEventListener('click', () => {
                currentSettings[key] = cb.classList.toggle('active');
                saveSettings();
            });
        };
        bindCb('.upg-use-common-cb',  'use_common');
        bindCb('.upg-use-unique-cb',  'use_unique');
        bindCb('.upg-allow-bound-cb', 'allow_bound_items');

        // Typy itemów
        const typeFilters = uiSettingsWindow.querySelector('#baddonz-upg-type-filters');
        typeFilters.querySelectorAll('.upg-typ-wrapper').forEach(wrapper => {
            const cl = parseInt(wrapper.dataset.cl);
            if (cl && CL_NAMES[cl] && typeof $ !== 'undefined' && $.fn.tip) {
                $(wrapper).tip(CL_NAMES[cl]);
            }
            const cb = wrapper.querySelector('.upg-cl-cb');
            wrapper.addEventListener('click', () => {
                const key = cb.dataset.key;
                currentSettings[key] = cb.classList.toggle('active');
                saveSettings();
            });
        });

        // Po walce
        const endbattleCb   = uiSettingsWindow.querySelector('.upg-endbattle-cb');
        const endbattleOpts = uiSettingsWindow.querySelector('.upg-endbattle-options');
        endbattleCb.addEventListener('click', () => {
            currentSettings.upgrade_endbattle = endbattleCb.classList.toggle('active');
            endbattleOpts.style.display = currentSettings.upgrade_endbattle ? 'flex' : 'none';
            saveSettings();
        });
        const countEndbattle = uiSettingsWindow.querySelector('.upg-count-endbattle-input');
        countEndbattle.addEventListener('change', () => {
            const v = Math.max(1, parseInt(countEndbattle.value) || 1);
            currentSettings.count_endbattle = v;
            countEndbattle.value = v;
            saveSettings();
        });

        // Po torbie
        const bagsCb   = uiSettingsWindow.querySelector('.upg-bags-cb');
        const bagsOpts = uiSettingsWindow.querySelector('.upg-bags-options');
        bagsCb.addEventListener('click', () => {
            currentSettings.bags_upgrade = bagsCb.classList.toggle('active');
            bagsOpts.style.display = currentSettings.bags_upgrade ? 'flex' : 'none';
            saveSettings();
            restartBagLoop();
        });
        const countBags = uiSettingsWindow.querySelector('.upg-count-bags-input');
        countBags.addEventListener('change', () => {
            const v = Math.max(1, parseInt(countBags.value) || 1);
            currentSettings.count_bags_upgrade = v;
            countBags.value = v;
            saveSettings();
        });

        // Tooltips
        if (typeof $ !== 'undefined' && $.fn.tip) {
            $(uiSettingsWindow.querySelector('.upg-allow-bound-cb'))
                .tip('Używasz na własną odpowiedzialność! Uwaga na itemy z kolosów');
            $(uiSettingsWindow.querySelector('.upg-endbattle-cb'))
                .tip('Automatyczne ulepszanie po walce gdy mamy odpowiednią ilość składników');
            $(uiSettingsWindow.querySelector('.upg-bags-cb'))
                .tip('Uruchomienie ulepszania gdy torba jest pełna');
        }
    }

    // ─── Logika ulepszania ────────────────────────────────────────────────────
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    function isChatFocused() {
        const el = document.activeElement;
        return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    }

    function checkDailyLimit() {
        return dailyUpgradeCount < dailyUpgradeLimit;
    }

    function isEventItem(item) {
        if (!item?.getTipContent) return false;
        const tip = item.getTipContent();
        if (!tip) return false;
        const plain = tip.replace(/<[^>]+>/g, '');
        return EVENT_KEYWORDS.some(kw => plain.includes(kw));
    }

    function getFreeSlots() {
        let total = 0;
        if (typeof Engine !== 'undefined' && Array.isArray(Engine.bags)) {
            const bags = Engine.bags.length > 0 ? Engine.bags.slice(0, Engine.bags.length - 1) : Engine.bags;
            bags.forEach(bag => {
                if (Array.isArray(bag) && bag.length >= 2) total += Math.max(0, bag[0] - bag[1]);
            });
        }
        return total;
    }

    function getReagents() {
        if (typeof Engine === 'undefined' || !Engine.items) return [];
        return Engine.items.fetchLocationItems("g").reduce((acc, item) => {
            if (!item) return acc;
            const cached   = item._cachedStats || {};
            const rarity   = cached.rarity || item.rarity;
            const isWorthless = Object.prototype.hasOwnProperty.call(cached, 'artisan_worthless')
                             || Object.prototype.hasOwnProperty.call(item, 'artisan_worthless');
            const cursed   = cached.cursed ?? item.cursed ?? false;
            const itemLvl  = item.lvl ?? item.level ?? cached.lvl ?? 0;
            const isUpgraded = cached.enhancement_upgrade_lvl != null || item.enhancement_upgrade_lvl != null;
            const isBound  = (item.checkSoulbound?.() || item.checkPermbound?.());
            const isAllowedRarity = (currentSettings.use_common && rarity === 'common') || (currentSettings.use_unique && rarity === 'unique');
            const settingKey = ITEM_TYPE_SETTINGS_MAP[item.cl];
            const isAllowedType = settingKey ? currentSettings[settingKey] : false;
            let isInBuild = false;
            try { const builds = item.getBuildsWithThisItem?.(); if (builds?.length > 0) isInBuild = true; } catch {}
            if (itemLvl < 20 || cursed || isWorthless) return acc;
            if (isAllowedType && isAllowedRarity && !isEventItem(item) && !isUpgraded && (currentSettings.allow_bound_items || !isBound) && !isInBuild) {
                acc.push(item.id);
            }
            return acc;
        }, []);
    }

    function chunkReagents(reagents) {
        const chunks = [];
        for (let i = 0; i < reagents.length; i += MAX_REAGENTS) chunks.push(reagents.slice(i, i + MAX_REAGENTS));
        return chunks;
    }

    function getEnhancementProgressText() {
        try {
            const el = Engine.crafting.window.wnd.$[0].querySelector('.enhance__progress-text--current');
            if (el) return el.textContent.trim();
        } catch {}
        return "Brak danych";
    }

    function isProgressCompleted() {
        try {
            const text = getEnhancementProgressText();
            if (text === "Brak danych") return false;
            const [c, m] = text.split('/').map(s => parseInt(s?.trim()));
            return c === m && c !== 0;
        } catch {}
        return false;
    }

    function toggleEnhancementWindow() {
        if (windowEnabled) {
            Engine.crafting.window.wnd.$.removeClass("upgrader-crafting-window");
            Engine.interface.clickCrafting();
            windowEnabled = false;
        } else {
            Engine.crafting.window.wnd.$.addClass("upgrader-crafting-window");
            Engine.interface.clickCrafting();
            windowEnabled = true;
        }
    }

    function setEnhancedItem(itemId) {
        return new Promise(resolve => {
            _g(`enhancement&action=status&item=${itemId}`, data => {
                let current = 0, max = 0, isCompleted = false;
                if (data?.enhancement?.progress) {
                    current = data.enhancement.progress.current;
                    max     = data.enhancement.progress.max;
                    if (current > 0 && current === max) isCompleted = true;
                }
                setTimeout(() => {
                    const progressText = getEnhancementProgressText();
                    if (progressText !== "Brak danych") saveProgress(itemId, progressText);
                    else if (isCompleted) saveProgress(itemId, `${max}/${max}`);
                    updateItemDisplay(itemId);
                    resolve({ current, max, isCompleted });
                }, 300);
            });
        });
    }

    function setReagents(itemId, reagentIds) {
        return new Promise(resolve => {
            _g(`enhancement&action=progress_preview&item=${itemId}&ingredients=${reagentIds.join(',')}`, resolve);
        });
    }

    function enhanceItem(itemId, reagentIds) {
        return new Promise(resolve => {
            _g(`enhancement&action=progress&item=${itemId}&ingredients=${reagentIds.join(',')}`, resolve);
        });
    }

    async function processChunks(upgradedItemId, chunks) {
        for (const chunk of chunks) {
            if (!checkDailyLimit()) {
                if (typeof window.message === 'function') window.message(`Przerwano. Limit ${dailyUpgradeLimit} osiągnięty.`);
                return true;
            }
            await setReagents(upgradedItemId, chunk);
            await enhanceItem(upgradedItemId, chunk);
            await sleep(200);
            const progressInfo = await setEnhancedItem(upgradedItemId);
            await sleep(100);
            const progressText = getEnhancementProgressText();
            if (progressInfo.isCompleted) {
                if (typeof window.message === 'function') window.message(`Ulepszono! Progres: ${progressText}. (MAX)`);
                return true;
            }
            if (typeof window.message === 'function') window.message(`Ulepszono! Progres: ${progressText}`);
            await sleep(300);
        }
        return false;
    }

    async function runUpgrade() {
        if (!currentSettings.enabled || isUpgrading || !checkDailyLimit()) return;
        const itemId = getUpgradedItemId();
        const item   = itemId ? Engine.items.getItemById(itemId) : null;
        if (!item) { if (typeof window.message === 'function') window.message("Nie wybrano itemu do ulepszania."); return; }
        const reagents = getReagents();
        if (!reagents.length) { if (typeof window.message === 'function') window.message("Brak odpowiednich składników."); return; }
        isUpgrading = true;
        try {
            toggleEnhancementWindow();
            const progressInfo = await setEnhancedItem(itemId);
            if (progressInfo.isCompleted) {
                if (typeof window.message === 'function') window.message(`${item.name} osiągnął MAX progres.`);
                toggleEnhancementWindow();
                return;
            }
            await processChunks(itemId, chunkReagents(reagents));
            toggleEnhancementWindow();
        } finally { isUpgrading = false; }
    }

    async function handleEndBattle() {
        if (!currentSettings.enabled || !currentSettings.upgrade_endbattle || !checkDailyLimit() || isUpgrading) return;
        const itemId = getUpgradedItemId();
        const item   = itemId ? Engine.items.getItemById(itemId) : null;
        if (!item) return;
        const reagents = getReagents();
        if (reagents.length < currentSettings.count_endbattle) return;
        if (typeof window.message === 'function') window.message(`Ulepszam po walce: ${item.name}`);
        isUpgrading = true;
        try {
            toggleEnhancementWindow();
            const progressInfo = await setEnhancedItem(itemId);
            if (progressInfo.isCompleted) { toggleEnhancementWindow(); return; }
            await processChunks(itemId, chunkReagents(reagents));
            toggleEnhancementWindow();
        } finally { isUpgrading = false; }
    }

    async function handleBagCheck() {
        if (!currentSettings.enabled || !currentSettings.bags_upgrade || !checkDailyLimit() || isUpgrading) return;
        const itemId = getUpgradedItemId();
        const item   = itemId ? Engine.items.getItemById(itemId) : null;
        if (!item) return;
        const reagents   = getReagents();
        const freeSlots  = getFreeSlots();
        if (reagents.length >= 1 && freeSlots <= currentSettings.count_bags_upgrade) {
            if (typeof window.message === 'function') window.message(`Wolne sloty: ${freeSlots}. Ulepszam: ${item.name}`);
            isUpgrading = true;
            try {
                toggleEnhancementWindow();
                const progressInfo = await setEnhancedItem(itemId);
                if (progressInfo.isCompleted) { toggleEnhancementWindow(); return; }
                await processChunks(itemId, chunkReagents(reagents));
                toggleEnhancementWindow();
            } finally { isUpgrading = false; }
        }
    }

    function restartBagLoop() {
        if (bagLoopTimer) { clearInterval(bagLoopTimer); bagLoopTimer = null; }
        if (currentSettings.enabled && currentSettings.bags_upgrade) {
            bagLoopTimer = setInterval(() => handleBagCheck(), BAG_CHECK_INTERVAL);
        }
    }

    // ─── Menu kontekstowe ─────────────────────────────────────────────────────
    function initItemContextMenu() {
        const ogShowPopupMenu = Engine.interface.showPopupMenu;
        Engine.interface.showPopupMenu = function (menu, e) {
            const cls    = e.currentTarget?.className || '';
            const match  = cls.match(/item-id-(\d+)/);
            const itemId = match ? match[1] : null;
            const item   = itemId ? Engine.items.getItemById(itemId) : null;
            const currentSelected = getUpgradedItemId();

            if (!itemId || !ITEM_TYPE_SETTINGS_MAP.hasOwnProperty(item?.cl)) {
                return ogShowPopupMenu.call(this, menu, e);
            }

            let menuItem;
            if (itemId === currentSelected) {
                menuItem = ["Anuluj ulepszanie", () => {
                    setUpgradedItemId('');
                    if (typeof window.message === 'function') window.message(`Anulowano: ${item.name}`);
                    updateItemDisplay(null);
                }, { button: { cls: "menu-item--red" } }];
            } else {
                menuItem = ["Ulepsz ten przedmiot", async () => {
                    setUpgradedItemId(itemId);
                    if (typeof window.message === 'function') window.message(`Wybrano do ulepszania: ${item.name}`);
                    toggleEnhancementWindow();
                    await setEnhancedItem(itemId);
                    toggleEnhancementWindow();
                }, { button: { cls: "menu-item--green" } }];
            }

            ogShowPopupMenu.call(this, [menuItem, ...menu], e);
        };
    }

    // ─── Hook communication + endbattle ───────────────────────────────────────
    function hookCommunication() {
        if (typeof Engine?.communication?.parseJSON !== 'function') {
            setTimeout(hookCommunication, 500); return;
        }
        const orig = Engine.communication.parseJSON;
        Engine.communication.parseJSON = function (data) {
            if (data?.enhancement?.usages_preview?.count !== undefined) {
                saveDailyCount(data.enhancement.usages_preview.count);
                dailyUpgradeLimit = data.enhancement.usages_preview.limit || dailyUpgradeLimit;
                updateDailyLimit();
            }
            return orig.call(this, data);
        };
    }

    function hookEndBattle() {
        if (isEndBattleHooked) return;
        if (typeof Engine?.battle?.setEndBattle !== 'function') { setTimeout(hookEndBattle, 500); return; }
        const orig = Engine.battle.setEndBattle.bind(Engine.battle);
        Engine.battle.setEndBattle = function () { orig(); handleEndBattle(); };
        isEndBattleHooked = true;
    }

    // ─── Keydown handler ──────────────────────────────────────────────────────
    function handleKeyDown(e) {
        if (!currentSettings.enabled || !currentSettings.hotkeyEnabled) return;
        if (isChatFocused()) return;
        if (e.key.toLowerCase() !== (currentSettings.hotkeyKey || 'j').toLowerCase()) return;
        if (typeof Engine?.battle?.d !== 'undefined' && Engine.battle.d.id !== 0) {
            if (typeof window.message === 'function') window.message("Nie można ręcznie ulepszać podczas walki.");
            return;
        }
        e.preventDefault();
        runUpgrade();
    }

    // ─── Init / Stop / Toggle ─────────────────────────────────────────────────
    function addonInit() {
        loadSettings();
        if (!uiMainWindow) buildUI();

        hookCommunication();
        hookEndBattle();
        initItemContextMenu();
        restartBagLoop();

        if (!isKeyDownBound) {
            document.addEventListener('keydown', handleKeyDown);
            isKeyDownBound = true;
        }
    }

    function addonStop() {
        if (isKeyDownBound) {
            document.removeEventListener('keydown', handleKeyDown);
            isKeyDownBound = false;
        }
        if (bagLoopTimer) { clearInterval(bagLoopTimer); bagLoopTimer = null; }
        if (uiMainWindow)     { uiMainWindow.remove();     uiMainWindow = null; }
        if (uiSettingsWindow) { uiSettingsWindow.remove(); uiSettingsWindow = null; }
    }

    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        if (uiMainWindow) {
            const stateBtn = uiMainWindow.querySelector('.baddonz-state-button');
            if (stateBtn) stateBtn.classList.toggle('active', isEnabled);
        }
        if (isEnabled) restartBagLoop();
        else if (bagLoopTimer) { clearInterval(bagLoopTimer); bagLoopTimer = null; }
    }

    // ─── Rejestracja ──────────────────────────────────────────────────────────
    const checkApi = () => {
        if (!window.BaddonzAPI?.registerAddon) { setTimeout(checkApi, 500); return; }
        window.BaddonzAPI.registerAddon(ADDON_ID, { init: addonInit, stop: addonStop, onStateToggle });
    };
    checkApi();

})();
