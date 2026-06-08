// ==UserScript==
// @name          Ulepszara baddonz
// @version       08.06.2026
// @description   Automatyczne ulepszanie
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==
(function() {
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

    const CL = {
        ONE_HAND_WEAPON: 1, TWO_HAND_WEAPON: 2, ONE_AND_HALF_HAND_WEAPON: 3, DISTANCE_WEAPON: 4,
        HELP_WEAPON: 5, WAND_WEAPON: 6, ORB_WEAPON: 7, ARMOR: 8, HELMET: 9, BOOTS: 10,
        GLOVES: 11, RING: 12, NECKLACE: 13, SHIELD: 14, QUIVER: 29
    };
    
    const ITEM_TYPE_SETTINGS_MAP = {
        [CL.ONE_HAND_WEAPON]: 'cl1', [CL.TWO_HAND_WEAPON]: 'cl2', [CL.ONE_AND_HALF_HAND_WEAPON]: 'cl3',
        [CL.DISTANCE_WEAPON]: 'cl4', [CL.HELP_WEAPON]: 'cl5', [CL.WAND_WEAPON]: 'cl6',
        [CL.ORB_WEAPON]: 'cl7', [CL.ARMOR]: 'cl8', [CL.HELMET]: 'cl9', [CL.BOOTS]: 'cl10',
        [CL.GLOVES]: 'cl11', [CL.RING]: 'cl12', [CL.NECKLACE]: 'cl13', [CL.SHIELD]: 'cl14',
        [CL.QUIVER]: 'cl29',
    };
    
    const ITEM_CL_NAMES = {
        1: 'Jednoręczne', 2: 'Dwuręczne', 3: 'Półtoraręczne', 4: 'Łuki',
        5: 'Pomocnicze', 6: 'Różdżki', 7: 'Orby', 8: 'Zbroje', 9: 'Heły',
        10: 'Buty', 11: 'Rękawice', 12: 'Pierki', 13: 'Naszyjniki',
        14: 'Tarcze', 29: 'Strzały',
    };
    
    // ─── Ustawienia domyślne ───────────────────────────────────────────────────
    const DEFAULT_ACC_SETTINGS = {
        windowOpacity: 2,
        windowVisible: true,
        settingsWindowVisible: false,
        windowSettingsOpacity: 2,
        isCollapsed: false,
        hotkeyKey: "j",
    };
    
    const DEFAULT_CHAR_SETTINGS = {
        enabled: true,
        hotkeyEnabled: true,
        use_common: false,
        use_unique: false,
        allow_bound_items: false,
        upgrade_endbattle: false,
        count_endbattle: 10,
        bags_upgrade: false,
        count_bags_upgrade: 3,
        cl1: true, cl2: true, cl3: true, cl4: true, 
        cl5: true, cl6: true, cl7: true, cl8: true, cl9: true, cl10: true,
        cl11: true, cl12: true, cl13: true, cl14: true, cl29: true,
    };
    
    let currentSettings = { ...DEFAULT_ACC_SETTINGS, ...DEFAULT_CHAR_SETTINGS };

    let uiMainWindow   = null;
    let uiSettingsWindow = null;
    let isUpgrading    = false;
    let windowEnabled  = false;
    let dailyUpgradeCount = 0;
    let dailyUpgradeLimit = 2000;
    let bagLoopTimeout = null;

    // ─── Storage helpers ──────────────────────────────────────────────────────
    function loadSettings() {
        if (!window.BaddonzAPI) return;
        const accId = window.BaddonzAPI.accountId;

        let accSettings = {};
        try {
            const data = JSON.parse(localStorage.getItem('BaddonzData')) || {};
            if (data[accId] && data[accId].accountAddons) {
                accSettings = data[accId].accountAddons[ADDON_ID] || {};
            }
        } catch(e) {}

        currentSettings = { ...DEFAULT_ACC_SETTINGS, ...DEFAULT_CHAR_SETTINGS, ...accSettings };
        const count = parseInt(localStorage.getItem('baddonz-daily-upgrade-count'));
        dailyUpgradeCount = !isNaN(count) ? count : 0;
    }

    function saveSettings() {
        if (!window.BaddonzAPI) return;
        const accId = window.BaddonzAPI.accountId;

        const accKeys = ['windowOpacity','windowVisible','settingsWindowVisible','windowSettingsOpacity','isCollapsed','hotkeyKey',
                         'enabled','hotkeyEnabled','use_common','use_unique','allow_bound_items','upgrade_endbattle','count_endbattle',
                         'bags_upgrade','count_bags_upgrade','cl1','cl2','cl3','cl4','cl5','cl6','cl7','cl8','cl9','cl10','cl11','cl12','cl13','cl14','cl29'];
        const accSettings = {};
        accKeys.forEach(k => accSettings[k] = currentSettings[k]);

        // NAPRAWIONE: Przekazujemy zapisane ustawienia do Baddonza zamiast pustego obiektu {}
        window.BaddonzAPI.saveAddonSettings(ADDON_ID, accSettings);
        try {
            let data = JSON.parse(localStorage.getItem('BaddonzData')) || {};
            if (!data[accId]) data[accId] = {};
            if (!data[accId].accountAddons) data[accId].accountAddons = {};
            data[accId].accountAddons[ADDON_ID] = accSettings;
            localStorage.setItem('BaddonzData', JSON.stringify(data));
        } catch(e) {}
    }

    // ─── Progress / item helpers ──────────────────────────────────────────────
    function getCharId() { return window.Engine?.hero?.d?.id; }

    function loadProgress(itemId) {
        const charId = getCharId();
        if (!charId) return null;
        try {
            const all = JSON.parse(localStorage.getItem(`baddonz-enhancement-progress-char-${charId}`)) || {};
            return all[itemId] || null;
        } catch(e) { return null; }
    }

    function saveProgress(itemId, progressText) {
        const charId = getCharId();
        if (!itemId || !progressText || progressText === "Brak danych" || !charId) return;
        const storageKey = `baddonz-enhancement-progress-char-${charId}`;
        let all = {};
        try { all = JSON.parse(localStorage.getItem(storageKey)) || {}; } catch(e) {}
        if (getUpgradedItemId() === itemId) all[itemId] = progressText;
        else delete all[itemId];
        localStorage.setItem(storageKey, JSON.stringify(all));
    }

    function setUpgradedItemId(itemId) {
        if (!window.Engine?.hero?.d) return;
        localStorage.setItem(`upgrader-charId-${Engine.hero.d.id}`, itemId);
    }

    function getUpgradedItemId() {
        try { return localStorage.getItem(`upgrader-charId-${Engine.hero.d.id}`); } catch(e) { return null; }
    }

    function checkDailyLimit() { return dailyUpgradeCount < dailyUpgradeLimit; }

    function isEventItem(item) {
        if (!item) return false;
        const cached = item._cachedStats || {};
        const hasEtiquette = cached.etiquette !== undefined || item.etiquette !== undefined;
        if (hasEtiquette) return true;
        if (!item.getTipContent) return false;
        const tip = item.getTipContent();
        if (!tip) return false;
        const plainText = tip.replace(/<[^>]+>/g, '');
        return EVENT_KEYWORDS.some(kw => plainText.includes(kw));
    }

    const getFreeSlots = () => {
        let total = 0;
        if (typeof Engine !== 'undefined' && Engine.bags && Array.isArray(Engine.bags)) {
            const bags = Engine.bags.length > 0 ? Engine.bags.slice(0, Engine.bags.length - 1) : Engine.bags;
            bags.forEach(bag => { if (Array.isArray(bag) && bag.length >= 2) total += Math.max(0, bag[0] - bag[1]); });
        }
        return total;
    };
    
    const getReagents = () => {
        return Engine.items.fetchLocationItems("g").reduce((acc, item) => {
            if (!item) return acc;
            const cached = item._cachedStats || {};
            const rarity = cached.rarity || item.rarity;
            const enhancement_upgrade_lvl = cached.enhancement_upgrade_lvl !== undefined ? cached.enhancement_upgrade_lvl : (item.enhancement_upgrade_lvl ?? undefined);
           
            const isWorthless = (cached && Object.prototype.hasOwnProperty.call(cached, 'artisan_worthless')) || Object.prototype.hasOwnProperty.call(item, 'artisan_worthless');
            const cursed_flag = cached.cursed !== undefined ? cached.cursed : (item.cursed !== undefined ? item.cursed : false);
            const itemLevel = item.lvl ?? item.level ?? cached.lvl ?? 0;
            const itemClass = item.cl;
            const isAllowedRarity = (currentSettings.use_common && rarity === 'common') || (currentSettings.use_unique && rarity === 'unique');
  
            const itemSettingKey = ITEM_TYPE_SETTINGS_MAP[itemClass];
            const isAllowedType = itemSettingKey ? currentSettings[itemSettingKey] : false;
            const isUpgraded = enhancement_upgrade_lvl !== undefined && enhancement_upgrade_lvl !== null;
            const isBound = (item.checkSoulbound && item.checkSoulbound()) || (item.checkPermbound && item.checkPermbound());
            let isPartOfBuild = false;
            try { if (typeof item.getBuildsWithThisItem === 'function') { const builds = item.getBuildsWithThisItem();
            if (builds && builds.length > 0) isPartOfBuild = true; } } catch(e) {}
            if (itemLevel < 20) return acc;
            if (cursed_flag) return acc;
            if (isWorthless) return acc;
            if (isAllowedType && isAllowedRarity && !isEventItem(item) && !isUpgraded && (currentSettings.allow_bound_items || !isBound) && !isPartOfBuild) {
                let extra = false;
                try { if (typeof Engine.buildsManager !== 'undefined' && item.getBuildsWithThisItem) { const b = item.getBuildsWithThisItem();
                if (b && b.length > 0) extra = true; } } catch(e) {}
                if (!extra) acc.push(item.id);
            }
            return acc;
        }, []);
    };
    
    const chunkReagents = (reagents) => {
        const chunks = [];
        for (let i = 0; i < reagents.length; i += MAX_REAGENTS) chunks.push(reagents.slice(i, i + MAX_REAGENTS));
        return chunks;
    };
    
    const getEnhancementProgressText = () => {
        try {
            const el = Engine.crafting.window.wnd.$[0].querySelector('.enhance__progress-text--current');
            if (el) return el.textContent.trim();
        } catch(e) {}
        return "Brak danych";
    };
    
    const toggleEnhancementWindow = () => {
        if (windowEnabled) {
            Engine.crafting.window.wnd.$.removeClass("upgrader-crafting-window");
            Engine.interface.clickCrafting();
            windowEnabled = false;
            return;
        }
        Engine.crafting.window.wnd.$.addClass("upgrader-crafting-window");
        Engine.interface.clickCrafting();
        windowEnabled = true;
    };
    
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    const setEnhancedItem = (itemId) => new Promise(resolve => {
        _g(`enhancement&action=status&item=${itemId}`, data => {
            let current = 0, max = 0, isCompleted = false;
            if (data?.enhancement?.progress) {
                const p = data.enhancement.progress;
                current = p.current; max = p.max;
                if (current > 0 && current === max) isCompleted = true;
            }
            setTimeout(() => {
                const progressText = getEnhancementProgressText();
                if (progressText !== "Brak danych") saveProgress(itemId, progressText);
                else if (isCompleted) saveProgress(itemId, `${max}/${max}`);
                updateMainUI();
                resolve({ current, max, isCompleted });
            }, 300);
        });
    });
    
    const setReagents = (itemId, reagentIds) => new Promise(resolve => {
        _g(`enhancement&action=progress_preview&item=${itemId}&ingredients=${reagentIds.join(",")}`, data => resolve(data));
    });
    
    const enhanceItem = (itemId, reagentIds) => {
        if (!itemId || !reagentIds) return;
        return new Promise(resolve => {
            _g(`enhancement&action=progress&item=${itemId}&ingredients=${reagentIds.join(",")}`, data => {
                dailyUpgradeCount++;
                localStorage.setItem('baddonz-daily-upgrade-count', dailyUpgradeCount);
                resolve(data);
            });
        });
    };

    const processChunks = async (upgradedItemId, chunks) => {
        for (const chunk of chunks) {
            if (!checkDailyLimit()) { message(`Przerwano ulepszanie. Limit ${dailyUpgradeLimit} osiągnięty.`);
            return true; }
            await setReagents(upgradedItemId, chunk);
            await enhanceItem(upgradedItemId, chunk);
            await sleep(200);
            const progressInfo = await setEnhancedItem(upgradedItemId);
            await sleep(100);
            const progressText = getEnhancementProgressText();
            if (progressInfo.isCompleted) { message(`Ulepszono! Progres: ${progressText}. (MAX)`);
            return true; }
            message(`Ulepszono! Progres: ${progressText}`);
            await sleep(300);
        }
        return false;
    };
    
    // ─── Item display ─────────────────────────────────────────────────────────
    const updateItemDisplay = (itemId) => {
        if (typeof $ === 'undefined' || typeof Engine === 'undefined' || !Engine.items) return;
        const item = Engine.items.getItemById(itemId);

        const $slotWrapper = $('#baddonz-upgrader-item-slot-wrapper');
        const nameEl       = document.getElementById("baddonz-upgrader-item-name");
        const progressEl   = document.getElementById("baddonz-upgrader-item-progress");
        if (!$slotWrapper.length || !nameEl || !progressEl) return;

        $slotWrapper.empty();
        nameEl.textContent    = "";
        progressEl.textContent = "";

        const $slotContainer = $(
            `<div class="enhance__item enhance__item--current interface-element-one-item-slot-decor" id="baddonz-upgrader-main-item-slot">
                <div class="slot"></div>
                <div class="lvl" data-lvl="0"><div class="cl-icon icon-star-0"></div></div>
            </div>`
        );
        if (!item) { $slotWrapper.append($slotContainer); return; }

        const upgradeLvl = item.upgrade_lvl || 0;
        $slotContainer.find('.lvl').attr('data-lvl', upgradeLvl).html(`<div class="cl-icon icon-star-${upgradeLvl}"></div>`);
        nameEl.textContent    = item.name;
        const storedProgress  = loadProgress(itemId);
        if (storedProgress)   progressEl.textContent = `Progres: ${storedProgress}`;

        const $clonedItem = item.$.clone();
        $clonedItem.addClass('baddonz-upgrader-item-cursor');
        $clonedItem.on('click', () => { setUpgradedItemId(""); message(`Anulowano ulepszanie przedmiotu ${item.name}`); updateMainUI(); });
        $clonedItem.data('item', item);
        $clonedItem.css({ position:'relative', width:'32px', height:'32px', top:'0', left:'0' });
        $clonedItem.find('canvas.icon, canvas.canvas-notice').remove();

        const iconSource = item.icon || `${item.id}.png`;
        const gifName    = iconSource.replace(/\.[^/.]+$/, '.gif');
        const $img = $('<img>').attr('src', MICC_BASE_URL + gifName).attr('class', 'baddonz-upgrader-gif').css({ width:'32px', height:'32px', position:'absolute', top:'0', left:'0', zIndex:'0' });
        $clonedItem.append($img);
        $slotContainer.find('.slot').append($clonedItem);
        $slotWrapper.append($slotContainer);
    };
    
    // ─── UI update ────────────────────────────────────────────────────────────
    function updateMainUI() {
        if (!uiMainWindow) return;
        const stateBtn = uiMainWindow.querySelector('.upg-state-button');
        if (stateBtn) {
            stateBtn.classList.toggle('baddonz-state-button--active', currentSettings.enabled);
            if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
                $(stateBtn).tip(currentSettings.enabled ? 'Wyłącz ulepszanie' : 'Włącz ulepszanie');
            }
        }

        const collapseBtn = uiMainWindow.querySelector('.upg-collapse-btn');
        if (collapseBtn && typeof $ === 'function' && typeof $.fn.tip === 'function') {
            $(collapseBtn).tip(currentSettings.isCollapsed ? 'Rozwiń' : 'Zwiń');
        }
        uiMainWindow.classList.toggle('wnd-clp', currentSettings.isCollapsed);
        
        const upgradedItemId = getUpgradedItemId();
        updateItemDisplay(upgradedItemId);
        
        const dailyEl = uiMainWindow.querySelector('.upg-daily-text');
        if (dailyEl) dailyEl.textContent = `Dzienny Limit: ${dailyUpgradeCount}/${dailyUpgradeLimit}`;

        updateSettingsUI();
    }

    function updateSettingsUI() {
        if (!uiSettingsWindow) return;
        const toggleCb = (id, value) => {
            const el = uiSettingsWindow.querySelector(`#${id}`);
            if (el) el.classList.toggle('active', value);
        };
        toggleCb('upg-hotkey-enabled',       currentSettings.hotkeyEnabled);
        toggleCb('upg-use-common',            currentSettings.use_common);
        toggleCb('upg-use-unique',            currentSettings.use_unique);
        toggleCb('upg-allow-bound',           currentSettings.allow_bound_items);
        toggleCb('upg-upgrade-endbattle',     currentSettings.upgrade_endbattle);
        toggleCb('upg-bags-upgrade',          currentSettings.bags_upgrade);

        const endbattleInput = uiSettingsWindow.querySelector('#upg-count-endbattle-input');
        if (endbattleInput) endbattleInput.value = currentSettings.count_endbattle;
        const bagsInput = uiSettingsWindow.querySelector('#upg-count-bags-upgrade-input');
        if (bagsInput) bagsInput.value = currentSettings.count_bags_upgrade;

        const hotkeyInput = uiSettingsWindow.querySelector('#upg-hotkey-input');
        if (hotkeyInput && document.activeElement !== hotkeyInput) {
            hotkeyInput.value = currentSettings.hotkeyKey === ' ' ? 'SPACJA' : currentSettings.hotkeyKey.toUpperCase();
        }

        const hotkeyOptions = uiSettingsWindow.querySelector('#upg-hotkey-options');
        if (hotkeyOptions) hotkeyOptions.style.display = currentSettings.hotkeyEnabled ? 'flex' : 'none';

        const endbattleOptions = uiSettingsWindow.querySelector('#upg-endbattle-options');
        if (endbattleOptions) endbattleOptions.style.display = currentSettings.upgrade_endbattle ? 'flex' : 'none';

        const bagsOptions = uiSettingsWindow.querySelector('#upg-bags-options');
        if (bagsOptions) bagsOptions.style.display = currentSettings.bags_upgrade ? 'flex' : 'none';
        
        const filtersContainer = uiSettingsWindow.querySelector('#baddonz-upgrader-type-filters');
        if (filtersContainer) {
            filtersContainer.querySelectorAll('.baddonz-typ-wrapper').forEach(wrapper => {
                const key = wrapper.dataset.key;
                if (key) wrapper.classList.toggle('typ-active', !!currentSettings[key]);
            });
        }
    }

    // ─── Build UI ─────────────────────────────────────────────────────────────
    function generateItemTypeFiltersHtml() {
        const CL_LIST = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,29];
        return CL_LIST.map(cl => `
            <div class="baddonz-typ-wrapper" data-key="cl${cl}" data-cl="${cl}">
                <div class="baddonz-type-icon cl-${cl}"></div>
            </div>
        `).join('');
    }

    function buildUI() {
        const mainBodyHtml = `
            <div class="upg-item-box">
                <div id="baddonz-upgrader-item-slot-wrapper" class="upg-item-slot-wrapper"></div>
                <div class="upg-item-name" id="baddonz-upgrader-item-name"></div>
                <div class="upg-item-progress" id="baddonz-upgrader-item-progress"></div>
            </div>
    
            <div class="upg-daily-row">
                <span class="upg-daily-text">Dzienny Limit: 0/2000</span>
            </div>
        `;
        uiMainWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Ulepszara", mainBodyHtml, {
            customId: 'wnd-ulepszara',
            hasSettings: true,
            hasCollapse: true,
            hasClose: true
        });
        const leftControls = uiMainWindow.querySelector('.baddonz-window-controls.left');
        if (leftControls) {
            const stateBtn = document.createElement('div');
            stateBtn.className = 'baddonz-state-button upg-state-button';
            stateBtn.classList.toggle('baddonz-state-button--active', currentSettings.enabled);
            leftControls.appendChild(stateBtn);
        }

        const rightControls = uiMainWindow.querySelector('.baddonz-window-controls.right');
        if (rightControls) {
            const collBtn = rightControls.querySelector('.baddonz-collapsed');
            if (collBtn) collBtn.classList.add('upg-collapse-btn');
        }

        applyOpacityClass(uiMainWindow, currentSettings.windowOpacity);
        if (currentSettings.isCollapsed) uiMainWindow.classList.add('wnd-clp');

        // WYMUSZENIE WIDOCZNOŚCI ZGODNIE Z ZAPISANYM STANEM:
        uiMainWindow.style.display = currentSettings.windowVisible ? 'flex' : 'none';

        const settingsBodyHtml = `
            <div class="upg-settings-section">
                <div class="upg-setting-row">
                    <div class="baddonz-checkbox" id="upg-use-common"></div>
                    <span class="upg-text">Ulepszaj Zwyklakami</span>
                </div>
    
                <div class="upg-setting-row">
                    <div class="baddonz-checkbox" id="upg-use-unique"></div>
                    <span class="upg-text">Ulepszaj Unikatami</span>
                </div>
                <div class="upg-setting-row">
          
                    <div class="baddonz-checkbox" id="upg-allow-bound"></div>
                    <span class="upg-text">Ulepszaj Związanymi</span>
                </div>
            </div>

            <div class="upg-settings-label">Typy Itemów:</div>
            <div id="baddonz-upgrader-type-filters">
           
                ${generateItemTypeFiltersHtml()}
            </div>

            <div class="upg-settings-section" style="margin-top:4px;">
                <div class="upg-setting-row">
                    <div class="baddonz-checkbox" id="upg-hotkey-enabled"></div>
                    <span class="upg-text">Ulepszanie Klawiszem</span>
        
                </div>
                <div id="upg-hotkey-options" class="upg-input-row" style="display:none;">
                    <span class="upg-settings-label">Klawisz:</span>
                    <input type="text" class="baddonz-input upg-hotkey-input" id="upg-hotkey-input" maxlength="7">
                </div>
           
            </div>

            <div class="upg-settings-section">
                <div class="upg-setting-row">
                    <div class="baddonz-checkbox" id="upg-upgrade-endbattle"></div>
                    <span class="upg-text">Ulepszaj po walce</span>
                </div>
        
                <div id="upg-endbattle-options" class="upg-input-row" style="display:none;">
                    <span class="upg-settings-label">Min. Liczba składników:</span>
                    <input type="number" class="baddonz-input upg-number-input" id="upg-count-endbattle-input" min="1" max="50">
                </div>
            </div>

            <div>
                <div class="upg-setting-row">
                
                    <div class="baddonz-checkbox" id="upg-bags-upgrade"></div>
                    <span class="upg-text">Ulepszaj po wolnych slotach</span>
                </div>
                <div id="upg-bags-options" class="upg-input-row" style="display:none;">
                    <span class="upg-settings-label">Max. Wolnych Slotów:</span>
                    <input type="number" class="baddonz-input upg-number-input" id="upg-count-bags-upgrade-input" min="1" max="100">
                </div>
            </div>
        `;
        uiSettingsWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Ulepszara Ustawienia", settingsBodyHtml, {
            customId: 'wnd-ulepszara-settings',
            width: '255px'
        });
        uiSettingsWindow.classList.add('settings-window', 'wnd-ulepszara-settings');
        uiSettingsWindow.removeAttribute('data-addon-id');
        
        // WYMUSZENIE WIDOCZNOŚCI ZGODNIE Z ZAPISANYM STANEM:
        uiSettingsWindow.style.display = currentSettings.settingsWindowVisible ? 'flex' : 'none';
        applyOpacityClass(uiSettingsWindow, currentSettings.windowSettingsOpacity);
        
        setupListeners();
        updateMainUI();
    }

    function applyOpacityClass(wnd, opacity) {
        for (let i = 0; i < 5; i++) wnd.classList.remove(`opacity-${i}`);
        const baddonzData = JSON.parse(localStorage.getItem('BaddonzData') || '{}');
        const accId = window.BaddonzAPI?.accountId;
        const unified = baddonzData[accId]?.manager?.unifiedOpacityEnabled;
        if (unified) {
            const globalOp = baddonzData[accId]?.manager?.currentOpacity ?? 2;
            wnd.classList.add(`opacity-${globalOp}`);
        } else {
            wnd.classList.add(`opacity-${opacity}`);
        }
    }

    function setupListeners() {
        if (!uiMainWindow || !uiSettingsWindow) return;
        const stateBtn    = uiMainWindow.querySelector('.upg-state-button');
        const settingsBtn = uiMainWindow.querySelector('.baddonz-settings-button');
        const collapseBtn = uiMainWindow.querySelector('.upg-collapse-btn');
        const opacityBtn  = uiMainWindow.querySelector('.baddonz-opacity-button');
        const mainCloseBtn = uiMainWindow.querySelector('.baddonz-close-button'); // Systemowy krzyżyk głównego okna
        
        if (stateBtn) {
            stateBtn.addEventListener('click', () => {
                currentSettings.enabled = !currentSettings.enabled;
                saveSettings(); updateMainUI();
            });
        }

        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                const visible = uiSettingsWindow.style.display !== 'none';
                uiSettingsWindow.style.display = visible ? 'none' : 'flex';
                currentSettings.settingsWindowVisible = !visible;
                saveSettings();
            });
        }

        if (collapseBtn) {
            collapseBtn.addEventListener('click', () => {
                currentSettings.isCollapsed = !currentSettings.isCollapsed;
                uiMainWindow.classList.toggle('wnd-clp', currentSettings.isCollapsed);
                saveSettings(); updateMainUI();
            });
        }

        if (opacityBtn) {
            opacityBtn.addEventListener('click', () => {
                const baddonzData = JSON.parse(localStorage.getItem('BaddonzData') || '{}');
                const accId = window.BaddonzAPI?.accountId;
                const unified = baddonzData[accId]?.manager?.unifiedOpacityEnabled;
                
                if (unified && window.setBaddonzGlobalOpacity) {
                    const cur = baddonzData[accId]?.manager?.currentOpacity ?? 2;
                    window.setBaddonzGlobalOpacity((cur + 1) % 5);
                } else {
                    currentSettings.windowOpacity = (currentSettings.windowOpacity + 1) % 5;
                    applyOpacityClass(uiMainWindow, currentSettings.windowOpacity);
                    saveSettings();
                }
            });
        }

        // NAPRAWIONE: Zapisywanie zamknięcia głównego okna krzyżykiem "X"
        if (mainCloseBtn) {
            mainCloseBtn.addEventListener('click', () => {
                currentSettings.windowVisible = false;
                saveSettings();
            });
        }

        const settingsCloseBtn   = uiSettingsWindow.querySelector('.baddonz-close-button');
        const settingsOpacityBtn = uiSettingsWindow.querySelector('.baddonz-opacity-button');
        
        if (settingsCloseBtn) {
            settingsCloseBtn.addEventListener('click', () => {
                uiSettingsWindow.style.display = 'none';
                currentSettings.settingsWindowVisible = false;
                saveSettings();
            });
        }

        if (settingsOpacityBtn) {
            settingsOpacityBtn.addEventListener('click', () => {
                const baddonzData = JSON.parse(localStorage.getItem('BaddonzData') || '{}');
                const accId = window.BaddonzAPI?.accountId;
                const unified = baddonzData[accId]?.manager?.unifiedOpacityEnabled;
                
                if (unified && window.setBaddonzGlobalOpacity) {
                    const cur = baddonzData[accId]?.manager?.currentOpacity ?? 2;
                    window.setBaddonzGlobalOpacity((cur + 1) % 5);
                } else {
                    currentSettings.windowSettingsOpacity = (currentSettings.windowSettingsOpacity + 1) % 5;
                    applyOpacityClass(uiSettingsWindow, currentSettings.windowSettingsOpacity);
                    saveSettings();
                }
            });
        }

        const checkboxMap = [
            { id: 'upg-hotkey-enabled',   key: 'hotkeyEnabled' },
            { id: 'upg-use-common',       key: 'use_common' },
            { id: 'upg-use-unique',       key: 'use_unique' },
            { id: 'upg-allow-bound',      key: 'allow_bound_items' },
            { id: 'upg-upgrade-endbattle',key: 'upgrade_endbattle' },
            { id: 'upg-bags-upgrade',     key: 'bags_upgrade' },
        ];
        
        checkboxMap.forEach(({ id, key }) => {
            const el = uiSettingsWindow.querySelector(`#${id}`);
            if (el) el.addEventListener('click', () => {
                currentSettings[key] = !currentSettings[key];
                saveSettings(); updateSettingsUI();
            });
        });
        
        const endbattleInput = uiSettingsWindow.querySelector('#upg-count-endbattle-input');
        if (endbattleInput) {
            endbattleInput.addEventListener('change', () => {
                const val = Math.max(1, parseInt(endbattleInput.value) || 1);
                currentSettings.count_endbattle = val; endbattleInput.value = val;
                saveSettings();
            });
        }

        const bagsInput = uiSettingsWindow.querySelector('#upg-count-bags-upgrade-input');
        if (bagsInput) {
            bagsInput.addEventListener('change', () => {
                const val = Math.max(1, parseInt(bagsInput.value) || 1);
                currentSettings.count_bags_upgrade = val; bagsInput.value = val;
                saveSettings();
            });
        }

        const hotkeyInput = uiSettingsWindow.querySelector('#upg-hotkey-input');
        if (hotkeyInput) {
            const handleHotkeySetting = (e) => {
                if (['Tab','Enter','Escape','Shift','Control','Alt','Meta'].includes(e.key) || (e.key.length > 1 && e.key !== ' ')) return;
                e.preventDefault(); e.stopPropagation();
                let newKey = e.key.toLowerCase().slice(0, 1);
                if (newKey) currentSettings.hotkeyKey = newKey;
                else if (e.key === ' ') currentSettings.hotkeyKey = ' ';
                hotkeyInput.removeEventListener('keydown', handleHotkeySetting);
                hotkeyInput.blur(); saveSettings(); updateSettingsUI();
            };
            hotkeyInput.addEventListener('focus', () => {
                hotkeyInput.value = currentSettings.hotkeyKey === ' ' ? 'SPACJA' : currentSettings.hotkeyKey.toUpperCase();
                hotkeyInput.addEventListener('keydown', handleHotkeySetting);
            });
            hotkeyInput.addEventListener('blur', () => {
                hotkeyInput.removeEventListener('keydown', handleHotkeySetting);
                updateSettingsUI();
            });
        }

        const filtersContainer = uiSettingsWindow.querySelector('#baddonz-upgrader-type-filters');
        if (filtersContainer) {
            filtersContainer.querySelectorAll('.baddonz-typ-wrapper').forEach(wrapper => {
                const cl = parseInt(wrapper.dataset.cl);
                if (cl && ITEM_CL_NAMES[cl] && typeof $ === 'function' && typeof $.fn.tip === 'function') {
                    $(wrapper).tip(ITEM_CL_NAMES[cl]);
                }
                wrapper.addEventListener('click', () => {
                    const key = wrapper.dataset.key;
                    if (key) { currentSettings[key] = !currentSettings[key]; saveSettings(); updateSettingsUI(); }
                });
            });
        }

        if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
            if (stateBtn) $(stateBtn).tip(currentSettings.enabled ? 'Wyłącz ulepszanie' : 'Włącz ulepszanie');
            if (settingsBtn) $(settingsBtn).tip('Ustawienia');
            if (opacityBtn)  $(opacityBtn).tip('Zmień przezroczystość');
            if (collapseBtn) $(collapseBtn).tip(currentSettings.isCollapsed ? 'Rozwiń' : 'Zwiń');
            if (settingsCloseBtn)   $(settingsCloseBtn).tip('Zamknij');
            if (settingsOpacityBtn) $(settingsOpacityBtn).tip('Zmień przezroczystość');

            const allowBoundEl = uiSettingsWindow.querySelector('#upg-allow-bound');
            if (allowBoundEl) $(allowBoundEl).tip('Używasz na własną odpowiedzialność! Uwaga na itemy z kolosów');
            const endbattleEl = uiSettingsWindow.querySelector('#upg-upgrade-endbattle');
            if (endbattleEl) $(endbattleEl).tip('Automatyczne ulepszanie po walce gdy mamy odpowiednią ilość składników');
            if (bagsInput) $(bagsInput).tip('Ilość miejsc potrzebna do uruchomienia ulepszania');
        }
    }

    // ─── Gameplay logic ───────────────────────────────────────────────────────
    const handleEndBattle = async () => {
        if (!currentSettings.enabled || !currentSettings.upgrade_endbattle || !checkDailyLimit() || isUpgrading) return;
        const upgradedItemId = getUpgradedItemId();
        const upgradedItem   = Engine.items.getItemById(upgradedItemId);
        if (!upgradedItem) return;
        const reagents = getReagents();
        if (reagents.length < currentSettings.count_endbattle) return;
        message(`Ulepszam! ${upgradedItem.name}.`);
        isUpgrading = true;
        try {
            toggleEnhancementWindow();
            const progressInfo = await setEnhancedItem(upgradedItemId);
            if (progressInfo.isCompleted) { message(`Maksymalny progres osiągnięty.`); return; }
            const chunks = chunkReagents(reagents);
            await processChunks(upgradedItemId, chunks);
        } finally { toggleEnhancementWindow(); isUpgrading = false; }
    };
    
    const handleBagCheck = async () => {
        if (!currentSettings.enabled || !currentSettings.bags_upgrade || !checkDailyLimit() || isUpgrading) return;
        const upgradedItemId = getUpgradedItemId();
        const upgradedItem   = Engine.items.getItemById(upgradedItemId);
        if (!upgradedItem) return;
        const reagents  = getReagents();
        const freeSlots = getFreeSlots();
        if (reagents.length >= 1 && freeSlots <= currentSettings.count_bags_upgrade) {
            isUpgrading = true;
            message(`Wolne sloty: ${freeSlots}. Ulepszam! ${upgradedItem.name}.`);
            try {
                toggleEnhancementWindow();
                const progressInfo = await setEnhancedItem(upgradedItemId);
                if (progressInfo.isCompleted) { message(`Maksymalny progres osiągnięty.`); return; }
                const chunks = chunkReagents(reagents);
                await processChunks(upgradedItemId, chunks);
            } finally { toggleEnhancementWindow(); isUpgrading = false; }
        }
    };
    
    const setupCommunicationHook = () => {
        if (typeof Engine.communication.parseJSON !== 'function') { setTimeout(setupCommunicationHook, 500);
        return; }
        const originalParseJSON = Engine.communication.parseJSON;
        Engine.communication.parseJSON = function(data) {
            if (data?.enhancement?.usages_preview?.count !== undefined) {
                dailyUpgradeCount = data.enhancement.usages_preview.count;
                dailyUpgradeLimit = data.enhancement.usages_preview.limit || dailyUpgradeLimit;
                localStorage.setItem('baddonz-daily-upgrade-count', dailyUpgradeCount);
                updateMainUI();
            }
            return originalParseJSON.call(this, data);
        };
    };

    const setupKeydownHandler = () => {
        document.addEventListener("keydown", async (event) => {
            const hotkey = currentSettings.hotkeyKey.toLowerCase();
            const isInputActive = ["TEXTAREA","MAGIC_INPUT","INPUT"].includes(document.activeElement?.tagName);
            if (event.key.toLowerCase() !== hotkey || isInputActive) return;
            if (isUpgrading) { event.preventDefault(); return; }
            if (!currentSettings.enabled || !currentSettings.hotkeyEnabled) return;
            isUpgrading = true;
            try {
                if (typeof Engine.battle.d !== 'undefined' && Engine.battle.d.id !== 0) { message("Nie można ręcznie ulepszać podczas walki."); return; }
                if (!checkDailyLimit()) { message(`Osiągnięto dzienny limit ${dailyUpgradeLimit} ulepszeń.`); return; }
               
                const upgradedItemId = getUpgradedItemId();
                const upgradedItem   = Engine.items.getItemById(upgradedItemId);
                if (!upgradedItem) { message("Nie znaleziono wybranego przedmiotu."); return; }
                const reagents = getReagents();
                if (reagents.length === 0) { message("Nie znaleziono odpowiednich składników."); return; }
                event.preventDefault();
                toggleEnhancementWindow();
                const chunks       = chunkReagents(reagents);
                const progressInfo = await setEnhancedItem(upgradedItemId);
                if (progressInfo.isCompleted) { message(`Ulepszanie zakończone. ${upgradedItem.name} osiągnął MAX progres.`); toggleEnhancementWindow(); return; }
                await processChunks(upgradedItemId, chunks);
                toggleEnhancementWindow();
            } finally { isUpgrading = false; }
        });
    };
    
    const initItemContextMenu = () => {
        const ogShowPopupMenu = Engine.interface.showPopupMenu;
        Engine.interface.showPopupMenu = function(menu, e) {
            const itemId            = getItemIdFromClassName(e.currentTarget?.className);
            const item              = Engine.items.getItemById(itemId);
            const currentSelectedId = getUpgradedItemId();
            if (!itemId || !ITEM_TYPE_SETTINGS_MAP.hasOwnProperty(item?.cl)) return ogShowPopupMenu.call(this, menu, e);

            let menuItem;
            if (itemId === currentSelectedId) {
                menuItem = ["Anuluj ulepszanie", () => { setUpgradedItemId("");
                message(`Anulowano ulepszanie przedmiotu ${item.name}`); updateMainUI(); }, { button: { cls: "menu-item--red" } }];
            } else {
                menuItem = ["Ulepsz ten przedmiot", async () => {
                    setUpgradedItemId(itemId);
                    message(`Ulepszanie przedmiotu ${item.name}`);
                    toggleEnhancementWindow();
                    await setEnhancedItem(itemId);
                    toggleEnhancementWindow();
                }, { button: { cls: "menu-item--green" } }];
            }
            ogShowPopupMenu.call(this, [menuItem, ...menu], e);
        };
    };
    
    const getItemIdFromClassName = (className) => {
        if (!className) return null;
        const match = className.match(/item-id-(\d+)/);
        return match ? match[1] : null;
    };
    
    // ─── Init / Stop ──────────────────────────────────────────────────────────
    function addonInit() {
        loadSettings();
        if (!uiMainWindow) buildUI();

        setupCommunicationHook();
        setupKeydownHandler();
        initItemContextMenu();

        if (typeof Engine.battle.setEndBattle === 'function') {
            const origEndBattle = Engine.battle.setEndBattle.bind(Engine.battle);
            Engine.battle.setEndBattle = function() { origEndBattle(); handleEndBattle(); };
        }

        if (currentSettings.bags_upgrade && currentSettings.enabled) {
            const bagLoop = () => { handleBagCheck();
            bagLoopTimeout = setTimeout(bagLoop, BAG_CHECK_INTERVAL); };
            bagLoopTimeout = setTimeout(bagLoop, BAG_CHECK_INTERVAL);
        }

        updateMainUI();
    }

    function addonStop() {
        if (bagLoopTimeout) { clearTimeout(bagLoopTimeout);
        bagLoopTimeout = null; }
        if (uiMainWindow)    { uiMainWindow.style.display = 'none'; }
        if (uiSettingsWindow){ uiSettingsWindow.style.display = 'none'; }
    }
    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        currentSettings.windowVisible = isEnabled;
        if (!isEnabled) {
            currentSettings.settingsWindowVisible = false;
        }
        if (uiMainWindow) uiMainWindow.style.display = isEnabled ? 'flex' : 'none';
        if (uiSettingsWindow) uiSettingsWindow.style.display = (isEnabled && currentSettings.settingsWindowVisible) ? 'flex' : 'none';
        saveSettings();
        updateMainUI();
    }

    const checkApi = () => {
        if (!window.BaddonzAPI || !window.BaddonzAPI.registerAddon) { setTimeout(checkApi, 500); return; }
        window.BaddonzAPI.registerAddon(ADDON_ID, { init: addonInit, stop: addonStop, onStateToggle: onStateToggle });
    };
    checkApi();
})();
