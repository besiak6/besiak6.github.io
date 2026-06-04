// ==UserScript==
// @name          UPG baddonz
// @version       1.0 (Baddonz 2.0.5)
// @description   Automatyczne ulepszanie (Enhancement)
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function () {
    'use strict';

    const ADDON_ID = "UPG";
    const MICC_BASE_URL = 'https://micc.garmory-cdn.cloud/obrazki/itemy/';
    const PROGRESS_STORAGE_KEY = "baddonz-upg-progress";

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.className = "upg-custom-styles";
    styleSheet.innerText = `
        .baddonz-upg-wnd { width: 140px; min-width: 140px; }
        .baddonz-upg-wnd-settings { width: 250px; min-width: 250px; height: auto !important; min-height: unset !important; max-height: unset !important; }
        .baddonz-upg-wnd-settings .baddonz-window-body { height: auto !important; min-height: unset !important; display: flex; flex-direction: column; gap: 5px; }
        .baddonz-upg-wnd .baddonz-window-body { padding: 4px 6px 6px 6px !important; gap: 3px !important; }
        .upgrader-crafting-window { display: none !important; }
        
        .upg-typ-wrapper {
            display: flex; align-items: center; justify-content: center;
            cursor: url("https://gordion.margonem.pl/img/gui/cursor/5n.png") 4 0, pointer;
            gap: 3px; padding: 3px; background: rgba(0, 0, 0, 0.3); border-radius: 3px; user-select: none;
        }
        .upg-typ-wrapper:hover { background: rgba(255, 255, 255, 0.1); }
        .upg-item-cursor { cursor: url("https://gordion.margonem.pl/img/gui/cursor/1n.png") 4 0, pointer !important; }
        .upg-daily-limit { font-size: 11px; color: #fff; text-align: center; }
        .baddonz-upg-wnd.collapsed #upg-item-details { display: none !important; }
    `;
    if (!document.querySelector(".upg-custom-styles")) document.head.appendChild(styleSheet);

    const MAX_REAGENTS = 25;
    const BAG_CHECK_INTERVAL = 5000;
    const EVENT_KEYWORDS = ["Wakacje", "Urodziny Margonem", "Wielkanoc", "Noc Kupały", "Szabat Czarownic", "Halloween", "Gwiazdka", "Licytacja", "Licytacja eventowa"];
    
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
        5: 'Pomocnicze', 6: 'Różdżki', 7: 'Orby', 8: 'Zbroje', 9: 'Hełmy',
        10: 'Buty', 11: 'Rękawice', 12: 'Pierki', 13: 'Naszyjniki',
        14: 'Tarcze', 29: 'Strzały',
    };

    let currentSettings = {
        enabled: true,
        windowOpacity: 2,
        windowVisible: true,
        settingsWindowVisible: false,
        windowSettingsOpacity: 2,
        
        // Zmienne zapisywane do konta (wspólne)
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
        
        // Zmienne dla konkretnej postaci
        selectedItemId: ""
    };

    let uiMainWindow = null;
    let uiSettingsWindow = null;
    let dailyUpgradeCount = 0;
    let dailyUpgradeLimit = 2000;
    let isUpgrading = false;
    let windowEnabled = false;
    let isMenuIntercepted = false;
    let BADDONZ_BAG_INTERVAL = null;

    class Emitter {
        observe(obj, key, callback) {
            const originalFunction = obj[key];
            const originalContext = obj;
            obj[key] = (...args) => {
                callback.apply(this, args);
                return originalFunction.apply(originalContext, args);
            };
        }
    }
    const emitter = new Emitter();

    function loadSettings() {
        if (!window.BaddonzAPI) return;
        const accId = window.BaddonzAPI.accountId;
        let accSettings = {};
        
        try {
            const data = JSON.parse(localStorage.getItem('BaddonzData')) || {};
            if (data[accId] && data[accId].accountAddons) {
                accSettings = data[accId].accountAddons[ADDON_ID] || {};
            }
        } catch (e) {}

        let charSettings = window.BaddonzAPI.getAddonSettings(ADDON_ID) || {};
        currentSettings = { ...currentSettings, ...accSettings, ...charSettings };
        
        // Wczytanie globalnego progresu limitu
        const count = parseInt(localStorage.getItem("baddonz-daily-upgrade-count"));
        dailyUpgradeCount = !isNaN(count) ? count : 0;
    }

    function saveSettings() {
        if (!window.BaddonzAPI) return;
        const accId = window.BaddonzAPI.accountId;
        
        // Rozdział na konto i postać
        const charKeys = ['selectedItemId'];
        let accSettings = {};
        let charSettings = {};

        Object.keys(currentSettings).forEach(k => {
            if (charKeys.includes(k)) charSettings[k] = currentSettings[k];
            else accSettings[k] = currentSettings[k];
        });

        window.BaddonzAPI.saveAddonSettings(ADDON_ID, charSettings);

        try {
            let data = JSON.parse(localStorage.getItem('BaddonzData')) || {};
            if (!data[accId]) data[accId] = {};
            if (!data[accId].accountAddons) data[accId].accountAddons = {};
            data[accId].accountAddons[ADDON_ID] = accSettings;
            localStorage.setItem('BaddonzData', JSON.stringify(data));
        } catch (e) {}
    }

    function loadProgress(itemId) {
        const charId = window.Engine.hero?.d?.id;
        if (!charId) return null;
        try {
            const allProgress = JSON.parse(localStorage.getItem(`${PROGRESS_STORAGE_KEY}-${charId}`)) || {};
            return allProgress[itemId] || null;
        } catch (e) { return null; }
    }

    function saveProgress(itemId, progressText) {
        const charId = window.Engine.hero?.d?.id;
        if (!itemId || !progressText || progressText === "Brak danych" || !charId) return;

        const storageKey = `${PROGRESS_STORAGE_KEY}-${charId}`;
        let allProgress = {};
        try { allProgress = JSON.parse(localStorage.getItem(storageKey)) || {}; } catch (e) {}

        allProgress[itemId] = progressText;

        if (currentSettings.selectedItemId !== itemId) {
            delete allProgress[itemId];
        }

        localStorage.setItem(storageKey, JSON.stringify(allProgress));
    }

    function updateItemDisplay() {
        if (!uiMainWindow || typeof $ === 'undefined' || typeof window.Engine === 'undefined' || !window.Engine.items) return;
        
        const itemId = currentSettings.selectedItemId;
        const item = window.Engine.items.getItemById(itemId);
        
        const $slotWrapper = $('#upg-item-slot-wrapper');
        const nameEl = document.getElementById("upg-item-name");
        const progressEl = document.getElementById("upg-item-progress");

        $slotWrapper.empty();
        if (!nameEl || !progressEl) return;
        
        nameEl.textContent = "";
        progressEl.textContent = "";

        const $slotContainer = $(
            `<div class="enhance__item enhance__item--current interface-element-one-item-slot-decor" style="margin:0;">
                <div class="slot"></div>
                <div class="lvl" data-lvl="0"><div class="cl-icon icon-star-0"></div></div>
            </div>`
        );

        if (!item || !itemId) {
            nameEl.textContent = "Brak przedmiotu";
            nameEl.style.color = "#aaa";
            $slotWrapper.append($slotContainer);
            return;
        }

        const upgradeLvl = item.upgrade_lvl || 0;
        $slotContainer.find('.lvl').attr('data-lvl', upgradeLvl).html(`<div class="cl-icon icon-star-${upgradeLvl}"></div>`);
        
        nameEl.textContent = item.name;
        nameEl.style.color = "#ffcc00";

        const storedProgress = loadProgress(itemId);
        if (storedProgress) progressEl.textContent = `Progres: ${storedProgress}`;

        const $clonedItem = item.$.clone();
        $clonedItem.addClass('upg-item-cursor');
        
        $clonedItem.on('click', () => {
            currentSettings.selectedItemId = "";
            saveSettings();
            if (window.message) message(`Anulowano ulepszanie przedmiotu ${item.name}`);
            updateItemDisplay();
        });

        $clonedItem.css({ 'position': 'relative', 'width': '32px', 'height': '32px', 'top': '0', 'left': '0' });
        $clonedItem.find('canvas.icon, canvas.canvas-notice').remove();

        const iconSource = item.icon || (`${item.id}.png`);
        const gifName = iconSource.replace(/\.[^/.]+$/, '.gif');
        const imgUrl = MICC_BASE_URL + gifName;
        
        const $img = $('<img>').attr('src', imgUrl).css({ width: '32px', height: '32px', position: 'absolute', top: '0', left: '0', zIndex: '0' });
        $clonedItem.append($img);

        $slotContainer.find('.slot').append($clonedItem);
        $slotWrapper.append($slotContainer);
    }

    function generateItemTypeFiltersHtml() {
        const ITEM_CL_MAP = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 29];
        let html = '';
        ITEM_CL_MAP.forEach(cl => {
            const key = `cl${cl}`;
            html += `
                <div class="upg-typ-wrapper" data-key="${key}" data-cl="${cl}">
                    <div class="baddonz-checkbox" id="upg-cl-${cl}"></div>
                    <div class="baddonz-type-icon cl-${cl}"></div>
                </div>
            `;
        });
        return html;
    }

    function buildUI() {
        const mainBodyHtml = `
            <div class="baddonz-setting-row" style="margin-bottom: 5px !important; display: flex; align-items: center; justify-content: center;">
                <div class="baddonz-checkbox upg-enabled-checkbox ${currentSettings.enabled ? 'active' : ''}"></div>
                <span class="baddonz-text" style="padding: 0; margin-left: 5px;">Ulepszara</span>
            </div>
            <div id="upg-item-details" class="baddonz-flex column" style="border-top: 1px solid #303030; border-bottom: 1px solid #303030; padding: 5px 0; align-items: center; margin-bottom: 2px;">
                <div id="upg-item-slot-wrapper" class="baddonz-flex" style="min-height:32px;"></div>
                <div class="baddonz-text" id="upg-item-name" style="padding: 0; font-size: 11px; font-weight: bold; color: #aaa;"></div>
                <div class="baddonz-text" id="upg-item-progress" style="padding: 0; font-size: 10px; color: #aaa;"></div>
            </div>
            <div class="baddonz-text upg-daily-limit" id="upg-daily-limit-text">0/2000</div>
        `;

        uiMainWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "UPG", mainBodyHtml, { 
            width: '140px', 
            customId: 'baddonz-upg-wnd',
            hasSettings: true,
            hasCollapse: true,
            hasClose: false
        });

        const settingsBodyHtml = `
            <div class="baddonz-label-wrapper"><div class="baddonz-checkbox upg-use-common-cb"></div><div class="baddonz-text">Ulepszaj Zwyklakami</div></div>
            <div class="baddonz-label-wrapper"><div class="baddonz-checkbox upg-use-unique-cb"></div><div class="baddonz-text">Ulepszaj Unikatami</div></div>
            <div class="baddonz-label-wrapper"><div class="baddonz-checkbox upg-allow-bound-cb"></div><div class="baddonz-text" style="color:#ff5555;">Ulepszaj Związanymi</div></div>
            
            <hr style="width: 100%; border-color: #303030; margin: 5px 0;">
            <div class="baddonz-text" style="text-align: center;">Typy Itemów:</div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; margin-left: 5px; margin-bottom: 5px;">
                ${generateItemTypeFiltersHtml()}
            </div>
            
            <hr style="width: 100%; border-color: #303030; margin: 5px 0;">
            <div class="baddonz-setting-row" style="margin-bottom:2px;">
                <div class="baddonz-checkbox upg-hotkey-enabled-cb"></div><span class="baddonz-text">Klawisz Ulepszania</span>
                <input type="text" class="baddonz-input upg-hotkey-input keybind" style="width:50px; height:20px; font-size:11px; text-align:center; padding:1px; margin-left:auto;" readonly>
            </div>
            
            <div class="baddonz-setting-row" style="margin-bottom:2px;">
                <div class="baddonz-checkbox upg-endbattle-cb"></div><span class="baddonz-text">Po Walce (min. ilość)</span>
                <input type="number" class="baddonz-input upg-endbattle-input" min="1" max="50" style="width:40px; height:20px; font-size:11px; text-align:center; padding:1px; margin-left:auto;">
            </div>
            
            <div class="baddonz-setting-row" style="margin-bottom:2px;">
                <div class="baddonz-checkbox upg-bags-cb"></div><span class="baddonz-text">Torba (max. wolnych)</span>
                <input type="number" class="baddonz-input upg-bags-input" min="1" max="100" style="width:40px; height:20px; font-size:11px; text-align:center; padding:1px; margin-left:auto;">
            </div>
        `;

        uiSettingsWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "UPG Ustawienia", settingsBodyHtml, { width: '250px', customId: 'baddonz-upg-wnd-settings' });
        uiSettingsWindow.classList.add('settings-window');
        uiSettingsWindow.removeAttribute('data-addon-id');
        uiSettingsWindow.style.display = currentSettings.settingsWindowVisible ? 'flex' : 'none';

        const isUnified = localStorage.getItem('BaddonzData') && JSON.parse(localStorage.getItem('BaddonzData'))[window.BaddonzAPI.accountId]?.manager?.unifiedOpacityEnabled;
        if (!isUnified) {
            uiSettingsWindow.className = uiSettingsWindow.className.replace(/opacity-\d/, `opacity-${currentSettings.windowSettingsOpacity}`);
        }

        // Bindowanie Główne
        const enabledCb = uiMainWindow.querySelector('.upg-enabled-checkbox');
        enabledCb.addEventListener('click', () => {
            currentSettings.enabled = enabledCb.classList.toggle('active');
            saveSettings();
        });

        const settingsBtn = uiMainWindow.querySelector(".baddonz-settings-button");
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                const isVisible = uiSettingsWindow.style.display !== 'none';
                uiSettingsWindow.style.display = isVisible ? 'none' : 'flex';
                currentSettings.settingsWindowVisible = !isVisible;
                saveSettings();
            });
        }

        // Ustawienia Okienka Ustawień
        const bindCb = (selector, key) => {
            const cb = uiSettingsWindow.querySelector(selector);
            if(currentSettings[key]) cb.classList.add('active');
            cb.addEventListener('click', () => { currentSettings[key] = cb.classList.toggle('active'); saveSettings(); });
        };
        
        bindCb('.upg-use-common-cb', 'use_common');
        bindCb('.upg-use-unique-cb', 'use_unique');
        bindCb('.upg-allow-bound-cb', 'allow_bound_items');
        bindCb('.upg-hotkey-enabled-cb', 'hotkeyEnabled');
        bindCb('.upg-endbattle-cb', 'upgrade_endbattle');
        bindCb('.upg-bags-cb', 'bags_upgrade');

        // Bindowanie Typów
        uiSettingsWindow.querySelectorAll('.upg-typ-wrapper').forEach(wrapper => {
            const key = wrapper.getAttribute('data-key');
            const cl = wrapper.getAttribute('data-cl');
            const cb = wrapper.querySelector('.baddonz-checkbox');
            if (currentSettings[key]) cb.classList.add('active');
            
            if (typeof $ === 'function' && typeof $.fn.tip === 'function') $(wrapper).tip(ITEM_CL_NAMES[cl]);

            wrapper.addEventListener('click', () => {
                currentSettings[key] = cb.classList.toggle('active');
                saveSettings();
            });
        });

        // Bindowanie Hotkey
        const hkInput = uiSettingsWindow.querySelector('.upg-hotkey-input');
        hkInput.value = currentSettings.hotkeyKey.toUpperCase();
        let hkActive = false;
        
        hkInput.addEventListener('click', () => {
            hkActive = true;
            hkInput.focus();
            hkInput.classList.add('active-keybind-mode');
        });
        
        hkInput.addEventListener('blur', () => {
            hkActive = false;
            hkInput.classList.remove('active-keybind-mode');
            hkInput.value = currentSettings.hotkeyKey.toUpperCase();
        });
        
        hkInput.addEventListener('keydown', (e) => {
            if (!hkActive) return;
            e.preventDefault();
            const pressedKey = e.key.toLowerCase();
            if (['escape', 'enter', 'tab'].includes(pressedKey)) { hkInput.blur(); return; }
            if (window.BaddonzAPI && !window.BaddonzAPI.isValidHotkey(pressedKey)) return;
            if (pressedKey.length !== 1) return;
            
            currentSettings.hotkeyKey = pressedKey;
            hkInput.value = pressedKey.toUpperCase();
            saveSettings();
            hkInput.blur();
        });

        // Bindowanie Inputów Liczbowych
        const bindInput = (selector, key) => {
            const input = uiSettingsWindow.querySelector(selector);
            input.value = currentSettings[key];
            input.addEventListener('change', () => {
                let val = parseInt(input.value);
                if(isNaN(val) || val < 1) val = 1;
                currentSettings[key] = val;
                input.value = val;
                saveSettings();
            });
        };
        bindInput('.upg-endbattle-input', 'count_endbattle');
        bindInput('.upg-bags-input', 'count_bags_upgrade');

        // Zamknięcie
        uiSettingsWindow.querySelector('.baddonz-close-button').addEventListener('click', () => {
            currentSettings.settingsWindowVisible = false;
            saveSettings();
        });

        uiSettingsWindow.querySelector('.baddonz-opacity-button').addEventListener('click', () => {
            if (isUnified) return; 
            uiSettingsWindow.classList.remove(`opacity-${currentSettings.windowSettingsOpacity}`);
            currentSettings.windowSettingsOpacity = (currentSettings.windowSettingsOpacity + 1) % 5;
            uiSettingsWindow.classList.add(`opacity-${currentSettings.windowSettingsOpacity}`);
            saveSettings();
        });

        updateLimitDisplay();
        updateItemDisplay();
    }

    function updateLimitDisplay() {
        if (!uiMainWindow) return;
        const limitEl = uiMainWindow.querySelector("#upg-daily-limit-text");
        if (limitEl) limitEl.textContent = `Limit: ${dailyUpgradeCount}/${dailyUpgradeLimit}`;
    }

    // LOGIKA MARGONEM
    function isEventItem(item) {
        if (!item || !item.getTipContent) return false;
        const tip = item.getTipContent();
        if (!tip) return false;
        const plainText = tip.replace(/<[^>]+>/g, '');
        return EVENT_KEYWORDS.some(keyword => plainText.includes(keyword));
    }

    const getFreeSlots = () => {
        let totalFreeSlots = 0;
        if (typeof window.Engine !== 'undefined' && window.Engine.bags && Array.isArray(window.Engine.bags)) {
            const bagsToCount = window.Engine.bags.length > 0 ? window.Engine.bags.slice(0, window.Engine.bags.length - 1) : window.Engine.bags;
            bagsToCount.forEach(bag => {
                if (Array.isArray(bag) && bag.length >= 2) totalFreeSlots += Math.max(0, bag[0] - bag[1]);
            });
        }
        return totalFreeSlots;
    };

    const getReagents = () => {
        if (!window.Engine || !window.Engine.items) return [];
        return window.Engine.items.fetchLocationItems("g").reduce((acc, item) => {
            if (!item) return acc;

            const cached = item._cachedStats || {};
            const rarity = cached.rarity || item.rarity;
            const enhancement_upgrade_lvl = cached.enhancement_upgrade_lvl !== undefined ? cached.enhancement_upgrade_lvl : (item.enhancement_upgrade_lvl ?? undefined);
            
            const isWorthless = ((cached && Object.prototype.hasOwnProperty.call(cached, 'artisan_worthless')) || Object.prototype.hasOwnProperty.call(item, 'artisan_worthless'));
            const cursed_flag = (cached.cursed !== undefined ? cached.cursed : (item.cursed !== undefined ? item.cursed : false));
            const itemLevel = (item.lvl ?? item.level ?? cached.lvl ?? 0);
            const itemClass = item.cl;

            const isAllowedRarity = (currentSettings.use_common && rarity === 'common') || (currentSettings.use_unique && rarity === 'unique');
            const itemSettingKey = ITEM_TYPE_SETTINGS_MAP[itemClass];
            const isAllowedType = itemSettingKey ? currentSettings[itemSettingKey] : false;

            const isUpgraded = enhancement_upgrade_lvl !== undefined && enhancement_upgrade_lvl !== null;
            const isBound = (item.checkSoulbound && item.checkSoulbound()) || (item.checkPermbound && item.checkPermbound());

            let isPartOfBuild = false;
            try {
                if (typeof item.getBuildsWithThisItem === 'function') {
                    const builds = item.getBuildsWithThisItem();
                    if (builds && builds.length > 0) isPartOfBuild = true;
                }
            } catch (e) { isPartOfBuild = false; }

            if (itemLevel < 20 || cursed_flag || isWorthless) return acc;

            if (isAllowedType && isAllowedRarity && !isEventItem(item) && !isUpgraded && !isWorthless && (currentSettings.allow_bound_items || !isBound) && !isPartOfBuild) {
                let isPartOfBuildExtra = false;
                if (typeof window.Engine.buildsManager !== 'undefined' && item.getBuildsWithThisItem) {
                    try {
                        const builds = item.getBuildsWithThisItem();
                        if (builds && builds.length > 0) isPartOfBuildExtra = true;
                    } catch (e) { isPartOfBuildExtra = false; }
                }
                if (!isPartOfBuildExtra) acc.push(item.id);
            }
            return acc;
        }, []);
    };

    const chunkReagents = (reagents) => {
        const chunks = [];
        for (let i = 0; i < reagents.length; i += MAX_REAGENTS) chunks.push(reagents.slice(i, i + MAX_REAGENTS));
        return chunks;
    };

    function getEnhancementProgressText() {
        try {
            const currentProgressTextEl = window.Engine.crafting.window.wnd.$[0].querySelector('.enhance__progress-text--current');
            if (currentProgressTextEl) return currentProgressTextEl.textContent.trim();
        } catch (e) {}
        return "Brak danych";
    }

    const checkDailyLimit = () => dailyUpgradeCount < dailyUpgradeLimit;

    const toggleEnhancementWindow = () => {
        if (windowEnabled) {
            window.Engine.crafting.window.wnd.$.removeClass("upgrader-crafting-window");
            window.Engine.interface.clickCrafting();
            windowEnabled = false;
            return;
        }
        window.Engine.crafting.window.wnd.$.addClass("upgrader-crafting-window");
        window.Engine.interface.clickCrafting();
        windowEnabled = true;
    };

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const setEnhancedItem = (itemId) => {
        return new Promise((resolve) => {
            window._g(`enhancement&action=status&item=${itemId}`, (data) => {
                let current = 0, max = 0, isCompleted = false;
                if (data?.enhancement?.progress) {
                    const progress = data.enhancement.progress;
                    current = progress.current; max = progress.max;
                    if (current > 0 && current === max) isCompleted = true;
                }
                setTimeout(() => {
                    const progressText = getEnhancementProgressText();
                    if (progressText !== "Brak danych") saveProgress(itemId, progressText);
                    else if (isCompleted) saveProgress(itemId, `${max}/${max}`);
                    updateItemDisplay();
                    resolve({ current, max, isCompleted });
                }, 300);
            });
        });
    };

    const setReagents = (itemId, reagentIds) => {
        const reagents = reagentIds.join(",");
        return new Promise((resolve) => window._g(`enhancement&action=progress_preview&item=${itemId}&ingredients=${reagents}`, resolve));
    };

    const enhanceItem = (itemId, reagentIds) => {
        if (!itemId || !reagentIds) return;
        const reagents = reagentIds.join(",");
        return new Promise((resolve) => window._g(`enhancement&action=progress&item=${itemId}&ingredients=${reagents}`, resolve));
    };

    const processChunks = async (upgradedItemId, chunks) => {
        for (const chunk of chunks) {
            if (!checkDailyLimit()) {
                if (window.message) message(`Przerwano ulepszanie. Limit osiągnięty.`);
                return true;
            }
            await setReagents(upgradedItemId, chunk);
            await enhanceItem(upgradedItemId, chunk);
            await sleep(200);

            const progressInfo = await setEnhancedItem(upgradedItemId);
            await sleep(100);

            const progressText = getEnhancementProgressText();
            if (progressInfo.isCompleted) {
                if (window.message) message(`Ulepszono! Progres: ${progressText}. (MAX)`);
                return true;
            }
            if (window.message) message(`Ulepszono! Progres: ${progressText}`);
            await sleep(300);
        }
        return false;
    };

    const runEnhancementCycle = async (triggerMessage) => {
        if (!currentSettings.enabled || !checkDailyLimit() || isUpgrading) return;
        
        const upgradedItemId = currentSettings.selectedItemId;
        const upgradedItem = window.Engine.items.getItemById(upgradedItemId);
        if (!upgradedItem) return;

        const reagents = getReagents();
        if (reagents.length === 0) return;

        isUpgrading = true;
        if (window.message) message(triggerMessage.replace('{name}', upgradedItem.name));

        try {
            toggleEnhancementWindow();
            const progressInfo = await setEnhancedItem(upgradedItemId);

            if (progressInfo.isCompleted) {
                if (window.message) message(`Maksymalny progres osiągnięty.`);
                return;
            }
            const chunks = chunkReagents(reagents);
            await processChunks(upgradedItemId, chunks);
        } finally {
            toggleEnhancementWindow();
            isUpgrading = false;
        }
    };

    const handleBagCheck = async () => {
        if (!currentSettings.bags_upgrade) return;
        const freeSlots = getFreeSlots();
        const reagents = getReagents();
        if (reagents.length >= 1 && freeSlots <= currentSettings.count_bags_upgrade) {
            await runEnhancementCycle(`Wolne sloty: ${freeSlots}. Ulepszam! {name}.`);
        }
    };

    const handleEndBattle = async () => {
        if (!currentSettings.upgrade_endbattle) return;
        const reagents = getReagents();
        if (reagents.length >= currentSettings.count_endbattle) {
            await runEnhancementCycle(`Ulepszam! {name}.`);
        }
    };

    const handleKeyDown = async (e) => {
        if (!currentSettings.enabled || !currentSettings.hotkeyEnabled) return;
        const isInputActive = ["TEXTAREA", "MAGIC_INPUT", "INPUT"].includes(document.activeElement.tagName);
        if (isInputActive) return;

        if (e.key.toLowerCase() === currentSettings.hotkeyKey) {
            if (isUpgrading) { e.preventDefault(); return; }
            if (typeof window.Engine.battle.d !== 'undefined' && window.Engine.battle.d.id !== 0) {
                if (window.message) message("Nie można ręcznie ulepszać podczas walki.");
                return;
            }
            if (!checkDailyLimit()) {
                if (window.message) message(`Osiągnięto dzienny limit ulepszeń.`);
                return;
            }
            e.preventDefault();
            await runEnhancementCycle(`Start ulepszania z klawisza: {name}`);
        }
    };

    // INIT
    function addonInit() {
        loadSettings();
        if (!uiMainWindow) buildUI();

        // Podpięcie parsowania limitów
        if (window.Engine && window.Engine.communication) {
            emitter.observe(window.Engine.communication, 'parseJSON', data => {
                if (data?.enhancement?.usages_preview?.count !== undefined) {
                    dailyUpgradeCount = data.enhancement.usages_preview.count;
                    dailyUpgradeLimit = data.enhancement.usages_preview.limit || dailyUpgradeLimit;
                    localStorage.setItem("baddonz-daily-upgrade-count", dailyUpgradeCount);
                    updateLimitDisplay();
                }
            });
        }

        // Podpięcie walki
        if (window.Engine && window.Engine.battle && typeof window.Engine.battle.setEndBattle === 'function') {
            emitter.observe(window.Engine.battle, 'setEndBattle', () => {
                handleEndBattle();
            });
        }

        // Menu kontekstowe
        if (window.Engine && window.Engine.interface && !isMenuIntercepted) {
            const ogShowPopupMenu = window.Engine.interface.showPopupMenu;
            window.Engine.interface.showPopupMenu = function (menu, e) {
                const className = e.currentTarget?.className || "";
                const match = className.match(/item-id-(\d+)/);
                const itemId = match ? match[1] : null;
                const item = window.Engine.items.getItemById(itemId);

                if (!itemId || !ITEM_TYPE_SETTINGS_MAP.hasOwnProperty(item?.cl)) {
                    return ogShowPopupMenu.call(this, menu, e);
                }

                let menuItem;
                if (itemId === currentSettings.selectedItemId) {
                    menuItem = ["Anuluj ulepszanie", () => {
                        currentSettings.selectedItemId = "";
                        saveSettings();
                        if (window.message) message(`Anulowano ulepszanie przedmiotu ${item.name}`);
                        updateItemDisplay();
                    }, { button: { cls: "menu-item--red" } }];
                } else {
                    menuItem = ["Ulepsz ten przedmiot", async () => {
                        currentSettings.selectedItemId = itemId;
                        saveSettings();
                        if (window.message) message(`Wybrano do ulepszania: ${item.name}`);
                        updateItemDisplay();
                    }, { button: { cls: "menu-item--green" } }];
                }

                const updatedMenu = [menuItem, ...menu];
                return ogShowPopupMenu.call(this, updatedMenu, e);
            };
            isMenuIntercepted = true;
        }

        document.addEventListener("keydown", handleKeyDown);

        if (!BADDONZ_BAG_INTERVAL) {
            BADDONZ_BAG_INTERVAL = setInterval(handleBagCheck, BAG_CHECK_INTERVAL);
        }
    }

    function addonStop() {
        document.removeEventListener("keydown", handleKeyDown);
        if (BADDONZ_BAG_INTERVAL) {
            clearInterval(BADDONZ_BAG_INTERVAL);
            BADDONZ_BAG_INTERVAL = null;
        }
        if (uiMainWindow) { uiMainWindow.remove(); uiMainWindow = null; }
        if (uiSettingsWindow) { uiSettingsWindow.remove(); uiSettingsWindow = null; }
    }

    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        if (uiMainWindow) {
            const enabledCb = uiMainWindow.querySelector(".upg-enabled-checkbox");
            if (enabledCb) {
                if (isEnabled) enabledCb.classList.add('active');
                else enabledCb.classList.remove('active');
            }
        }
        saveSettings();
    }

    const checkApi = () => {
        if (!window.BaddonzAPI || !window.BaddonzAPI.registerAddon) {
            setTimeout(checkApi, 500);
            return;
        }
        window.BaddonzAPI.registerAddon(ADDON_ID, { init: addonInit, stop: addonStop, onStateToggle: onStateToggle });
    };

    checkApi();
})();
