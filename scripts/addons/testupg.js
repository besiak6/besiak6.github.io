// ==UserScript==
// @name          Ulepszator baddonz
// @version       0.4
// @author        besiak
// @match         https://*.margonem.pl/
// @grant         none
// ==/UserScript==

(function () {
    'use strict';

    const ADDON_ID = "UPG";
    const MICC_BASE_URL = 'https://micc.garmory-cdn.cloud/obrazki/itemy/';

    const DAILY_COUNT_KEY = "baddonz-daily-upgrade-count";
    const PROGRESS_STORAGE_KEY = "baddonz-enhancement-progress-char";
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
        5: 'Pomocnicze', 6: 'Różdżki', 7: 'Orby', 8: 'Zbroje', 9: 'Hełmy',
        10: 'Buty', 11: 'Rękawice', 12: 'Pierścienie', 13: 'Naszyjniki',
        14: 'Tarcze', 29: 'Strzały',
    };

    let currentSettings = {
        enabled: true,
        windowOpacity: 2,
        windowVisible: true,
        settingsWindowVisible: false,
        windowSettingsOpacity: 2,
        hotkeyEnabled: true,
        hotkeyKey: "j",
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

    let uiMainWindow = null;
    let uiSettingsWindow = null;
    let dailyUpgradeCount = 0;
    let dailyUpgradeLimit = 2000;
    let isUpgrading = false;
    let windowEnabled = false;
    let bagLoopInterval = null;
    let isEngineObserved = false;
    let isEndBattleHooked = false;
    let isMenuIntercepted = false;

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.className = "upg-custom-styles";
    styleSheet.innerText = `
        .upgrader-crafting-window { display: none !important; }
        .baddonz-upg-wnd-settings { width:250px; min-width:250px; height: auto !important; min-height: unset !important; max-height: unset !important; }
        .baddonz-upg-wnd-settings .baddonz-window-body { height: auto !important; min-height: unset !important; display: flex; flex-direction: column; gap: 4px; padding-top: 4px !important; }
        .baddonz-upg-wnd { width:150px; min-width:150px; }
        .baddonz-upg-wnd .baddonz-window-body { padding: 4px 6px 6px 6px !important; gap: 3px !important; }
        .baddonz-upg-wnd hr { margin: 3px 0 !important; border-color: #303030; }
        
        .baddonz-typ-wrapper {
            display: flex; align-items: center; justify-content: center;
            cursor: url("https://gordion.margonem.pl/img/gui/cursor/5n.png") 4 0, pointer;
            gap: 3px; padding: 3px; background: rgba(0, 0, 0, 0.3); border-radius: 3px; user-select: none;
            box-shadow: inset 0 0 3px rgba(0,0,0,0.5); border: 1px solid transparent;
        }
        .baddonz-typ-wrapper:hover { background: rgba(255, 255, 255, 0.1); border-color: rgba(255,255,255,0.2); }
        .baddonz-upgrader-item-cursor { cursor: url("https://gordion.margonem.pl/img/gui/cursor/1n.png") 4 0, pointer !important; }
        #baddonz-upg-item-slot { margin: 0 auto; }
        .upg-limit-text { font-size: 11px; color: #fff; text-align: center; }
        .upg-stats-text { font-size: 10px; color: #aaa; text-align: center; text-shadow: 1px 1px #000; }
        .upg-name-text { font-size: 11px; font-weight: bold; color: #ffcc00; text-align: center; text-shadow: 1px 1px #000; }
        .baddonz-setting-row span { font-size: 11px; white-space: nowrap; }
    `;
    if (!document.querySelector(".upg-custom-styles")) document.head.appendChild(styleSheet);

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

        const count = parseInt(localStorage.getItem(DAILY_COUNT_KEY));
        dailyUpgradeCount = !isNaN(count) ? count : 0;
    }

    function saveSettings() {
        if (!window.BaddonzAPI) return;
        const accId = window.BaddonzAPI.accountId;
        
        const accKeys = ['enabled', 'windowOpacity', 'windowVisible', 'settingsWindowVisible', 'windowSettingsOpacity', 'hotkeyKey'];
        const charKeys = ['use_common', 'use_unique', 'allow_bound_items', 'upgrade_endbattle', 'count_endbattle', 'bags_upgrade', 'count_bags_upgrade', 'hotkeyEnabled', 'cl1', 'cl2', 'cl3', 'cl4', 'cl5', 'cl6', 'cl7', 'cl8', 'cl9', 'cl10', 'cl11', 'cl12', 'cl13', 'cl14', 'cl29'];

        let accSettings = {};
        let charSettings = {};

        accKeys.forEach(k => accSettings[k] = currentSettings[k]);
        charKeys.forEach(k => charSettings[k] = currentSettings[k]);

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
        const storageKey = `${PROGRESS_STORAGE_KEY}-${charId}`;
        try {
            const allProgress = JSON.parse(localStorage.getItem(storageKey)) || {};
            return allProgress[itemId] || null;
        } catch (e) { return null; }
    }

    function saveProgress(itemId, progressText) {
        const charId = window.Engine.hero?.d?.id;
        if (!itemId || !progressText || progressText === "Brak danych" || !charId) return;

        const storageKey = `${PROGRESS_STORAGE_KEY}-${charId}`;
        let allProgress = {};
        try {
            allProgress = JSON.parse(localStorage.getItem(storageKey)) || {};
        } catch (e) {}

        allProgress[itemId] = progressText;

        const upgradedItemId = getUpgradedItemId();
        if (!upgradedItemId || upgradedItemId !== itemId) {
             delete allProgress[itemId];
        }
        localStorage.setItem(storageKey, JSON.stringify(allProgress));
    }

    function setUpgradedItemId(itemId) {
        if (!window.Engine || !window.Engine.hero || !window.Engine.hero.d) return;
        window.localStorage.setItem(`upgrader-charId-${window.Engine.hero.d.id}`, itemId);
    }

    function getUpgradedItemId() {
        try {
            return window.localStorage.getItem(`upgrader-charId-${window.Engine.hero.d.id}`);
        } catch (e) { return null; }
    }

    function parseStats(stats) {
        if (!stats || typeof stats !== "string") return {};
        const result = {};
        for (const pair of stats.split(";")) {
            const [key, value] = pair.split("=");
            if (key && value !== undefined) result[key] = value;
        }
        return result;
    }

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
                if (Array.isArray(bag) && bag.length >= 2) {
                    totalFreeSlots += Math.max(0, bag[0] - bag[1]);
                }
            });
        }
        return totalFreeSlots;
    };

    function updateItemDisplay(itemId) {
        if (!uiMainWindow || typeof $ === 'undefined' || typeof window.Engine === 'undefined' || !window.Engine.items) return;
        
        const item = window.Engine.items.getItemById(itemId);
        const $slotWrapper = $(uiMainWindow.querySelector('#baddonz-upg-item-slot-wrapper'));
        const nameEl = uiMainWindow.querySelector("#baddonz-upg-item-name");
        const progressEl = uiMainWindow.querySelector("#baddonz-upg-item-progress");

        $slotWrapper.empty();
        nameEl.textContent = "Brak przedmiotu";
        progressEl.textContent = "";

        const $slotContainer = $(
            `<div class="enhance__item enhance__item--current interface-element-one-item-slot-decor" id="baddonz-upg-item-slot">
                <div class="slot"></div>
                <div class="lvl" data-lvl="0"><div class="cl-icon icon-star-0"></div></div>
             </div>`
        );

        if (!item) {
            $slotWrapper.append($slotContainer);
            return;
        }

        const stats = item._cachedStats || parseStats(item.stat || item.stats || "");
        const upgradeLvl = stats.enhancement_upgrade_lvl || item.enhancement_upgrade_lvl || 0;
        
        $slotContainer.find('.lvl')
            .attr('data-lvl', upgradeLvl)
            .html(`<div class="cl-icon icon-star-${upgradeLvl}"></div>`);
        
        nameEl.textContent = item.name;

        const storedProgress = loadProgress(itemId);
        if (storedProgress) {
            progressEl.textContent = `Progres: ${storedProgress}`;
        }

        const $clonedItem = item.$.clone();
        $clonedItem.addClass('baddonz-upgrader-item-cursor');
        $clonedItem.on('click', () => {
            setUpgradedItemId("");
            if (window.message) window.message(`Anulowano ulepszanie przedmiotu ${item.name}`);
            updateItemDisplay("");
        });
        $clonedItem.data('item', item);

        $clonedItem.css({
            'position': 'relative',
            'width': '32px',
            'height': '32px',
            'top': '0',
            'left': '0'
        });
        $clonedItem.find('canvas.icon, canvas.canvas-notice').remove();

        const iconSource = item.icon || (`${item.id}.png`);
        const gifName = iconSource.replace(/\.[^/.]+$/, '.gif');
        const imgUrl = MICC_BASE_URL + gifName;
        
        const $img = $('<img>')
            .attr('src', imgUrl)
            .attr('class', 'baddonz-upgrader-gif')
            .css({ width: '32px', height: '32px', position: 'absolute', top: '0', left: '0', zIndex: '0' });
            
        $clonedItem.append($img);
        $slotContainer.find('.slot').append($clonedItem);
        $slotWrapper.append($slotContainer);
    }

    function generateItemTypeFiltersHtml() {
        const ITEM_CL_MAP = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 29];
        let html = '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px;">';
        ITEM_CL_MAP.forEach(cl => {
            const key = `cl${cl}`;
            const isActive = currentSettings[key] ? 'active' : '';
            html += `
                <div class="baddonz-typ-wrapper" data-key="${key}" data-cl="${cl}">
                    <div class="baddonz-checkbox ${isActive}"></div>
                    <div class="baddonz-type-icon cl-${cl}"></div>
                </div>
            `;
        });
        html += '</div>';
        return html;
    }

    function buildUI() {
        const mainBodyHtml = `
            <div id="baddonz-upg-item-slot-wrapper" class="baddonz-flex" style="justify-content: center; min-height: 40px; margin-bottom: 2px;"></div>
            <div class="upg-name-text" id="baddonz-upg-item-name">Brak przedmiotu</div>
            <div class="upg-stats-text" id="baddonz-upg-item-progress"></div>
            <hr>
            <div class="upg-limit-text" id="baddonz-upg-daily-limit">Dzienny Limit: ${dailyUpgradeCount}/${dailyUpgradeLimit}</div>
        `;

        uiMainWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Ulepszara", mainBodyHtml, { 
            width: '150px', 
            customId: 'baddonz-upg-wnd',
            hasSettings: true,
            hasCollapse: true,
            hasClose: false
        });
        uiMainWindow.classList.add('baddonz-upg-wnd');

        const settingsBodyHtml = `
            <div class="baddonz-setting-row"><div class="baddonz-checkbox upg-chk" data-key="use_common" ${currentSettings.use_common ? 'active' : ''}></div><span>Ulepszaj Zwyklakami</span></div>
            <div class="baddonz-setting-row"><div class="baddonz-checkbox upg-chk" data-key="use_unique" ${currentSettings.use_unique ? 'active' : ''}></div><span>Ulepszaj Unikatami</span></div>
            <div class="baddonz-setting-row"><div class="baddonz-checkbox upg-chk" data-key="allow_bound_items" ${currentSettings.allow_bound_items ? 'active' : ''}></div><span>Ulepszaj Związanymi</span></div>
            
            <hr>
            <div style="text-align: center; font-size: 11px; margin-bottom: 2px;">Typy Itemów:</div>
            ${generateItemTypeFiltersHtml()}
            
            <hr>
            <div class="baddonz-setting-row"><div class="baddonz-checkbox upg-chk" data-key="hotkeyEnabled" ${currentSettings.hotkeyEnabled ? 'active' : ''}></div><span>Ulepszanie Klawiszem</span></div>
            <div class="upg-opt-hotkey baddonz-flex column" style="display: ${currentSettings.hotkeyEnabled ? 'flex' : 'none'}; padding: 0 5px;">
                <input type="text" class="baddonz-input" id="upg-hotkey-input" maxlength="7" style="text-transform: uppercase; text-align: center; height: 22px !important;" value="${currentSettings.hotkeyKey === ' ' ? 'SPACJA' : currentSettings.hotkeyKey.toUpperCase()}">
            </div>

            <div class="baddonz-setting-row"><div class="baddonz-checkbox upg-chk" data-key="upgrade_endbattle" ${currentSettings.upgrade_endbattle ? 'active' : ''}></div><span>Ulepszaj po walce</span></div>
            <div class="upg-opt-battle baddonz-flex column" style="display: ${currentSettings.upgrade_endbattle ? 'flex' : 'none'}; padding: 0 5px;">
                <span style="font-size: 10px; margin-bottom: 2px;">Min. Liczba Reagentów:</span>
                <input type="number" class="baddonz-input" id="upg-battle-input" min="1" max="50" style="text-align: center; height: 22px !important;" value="${currentSettings.count_endbattle}">
            </div>

            <div class="baddonz-setting-row"><div class="baddonz-checkbox upg-chk" data-key="bags_upgrade" ${currentSettings.bags_upgrade ? 'active' : ''}></div><span>Ulepszaj po miejscu w torbie</span></div>
            <div class="upg-opt-bags baddonz-flex column" style="display: ${currentSettings.bags_upgrade ? 'flex' : 'none'}; padding: 0 5px;">
                <span style="font-size: 10px; margin-bottom: 2px;">Max. Wolne Sloty:</span>
                <input type="number" class="baddonz-input" id="upg-bags-input" min="1" max="100" style="text-align: center; height: 22px !important;" value="${currentSettings.count_bags_upgrade}">
            </div>
        `;

        uiSettingsWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Ustawienia Ulepszarki", settingsBodyHtml, { width: '250px', customId: 'baddonz-upg-wnd-settings' });
        uiSettingsWindow.classList.add('baddonz-upg-wnd-settings');
        uiSettingsWindow.removeAttribute('data-addon-id');
        uiSettingsWindow.style.display = currentSettings.settingsWindowVisible ? 'flex' : 'none';

        const isUnified = localStorage.getItem('BaddonzData') && JSON.parse(localStorage.getItem('BaddonzData'))[window.BaddonzAPI.accountId]?.manager?.unifiedOpacityEnabled;
        if (!isUnified) {
            uiSettingsWindow.className = uiSettingsWindow.className.replace(/opacity-\d/, `opacity-${currentSettings.windowSettingsOpacity}`);
        }

        const updateLimitDisplay = () => {
            const limitEl = uiMainWindow.querySelector("#baddonz-upg-daily-limit");
            if(limitEl) limitEl.textContent = `Dzienny Limit: ${dailyUpgradeCount}/${dailyUpgradeLimit}`;
        };

        // Nasłuchiwanie przycisku opcji z Głównego Okna
        const settingsBtn = uiMainWindow.querySelector(".baddonz-settings-button");
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                const isVisible = uiSettingsWindow.style.display !== 'none';
                uiSettingsWindow.style.display = isVisible ? 'none' : 'flex';
                currentSettings.settingsWindowVisible = !isVisible;
                saveSettings();
            });
        }

        // Przyciski w Ustawieniach
        uiSettingsWindow.querySelector('.baddonz-close-button').addEventListener('click', () => {
            currentSettings.settingsWindowVisible = false;
            uiSettingsWindow.style.display = 'none';
            saveSettings();
        });

        uiSettingsWindow.querySelector('.baddonz-opacity-button').addEventListener('click', () => {
            if (isUnified) return; 
            uiSettingsWindow.classList.remove(`opacity-${currentSettings.windowSettingsOpacity}`);
            currentSettings.windowSettingsOpacity = (currentSettings.windowSettingsOpacity + 1) % 5;
            uiSettingsWindow.classList.add(`opacity-${currentSettings.windowSettingsOpacity}`);
            saveSettings();
        });

        // Eventy Checkboxów Settings
        uiSettingsWindow.querySelectorAll('.upg-chk').forEach(cb => {
            cb.addEventListener('click', () => {
                const key = cb.getAttribute('data-key');
                const isActive = cb.classList.toggle('active');
                currentSettings[key] = isActive;
                
                if (key === 'hotkeyEnabled') uiSettingsWindow.querySelector('.upg-opt-hotkey').style.display = isActive ? 'flex' : 'none';
                if (key === 'upgrade_endbattle') uiSettingsWindow.querySelector('.upg-opt-battle').style.display = isActive ? 'flex' : 'none';
                if (key === 'bags_upgrade') uiSettingsWindow.querySelector('.upg-opt-bags').style.display = isActive ? 'flex' : 'none';
                
                saveSettings();
            });
        });

        // Typy Itemów
        if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
            uiSettingsWindow.querySelectorAll('.baddonz-typ-wrapper').forEach(wrapper => {
                const cl = parseInt(wrapper.getAttribute('data-cl'));
                if (cl && ITEM_CL_NAMES[cl]) $(wrapper).tip(ITEM_CL_NAMES[cl]);

                wrapper.addEventListener('click', () => {
                    const key = wrapper.getAttribute('data-key');
                    const cb = wrapper.querySelector('.baddonz-checkbox');
                    if (key) {
                        currentSettings[key] = !currentSettings[key];
                        if (currentSettings[key]) cb.classList.add('active');
                        else cb.classList.remove('active');
                        saveSettings();
                    }
                });
            });
        }

        // Inputy Numeryczne
        const battleInput = uiSettingsWindow.querySelector("#upg-battle-input");
        battleInput.addEventListener('change', () => {
            currentSettings.count_endbattle = Math.max(1, parseInt(battleInput.value) || 1);
            battleInput.value = currentSettings.count_endbattle;
            saveSettings();
        });

        const bagsInput = uiSettingsWindow.querySelector("#upg-bags-input");
        bagsInput.addEventListener('change', () => {
            currentSettings.count_bags_upgrade = Math.max(1, parseInt(bagsInput.value) || 1);
            bagsInput.value = currentSettings.count_bags_upgrade;
            saveSettings();
        });

        // Hotkey
        const hotkeyInput = uiSettingsWindow.querySelector("#upg-hotkey-input");
        const handleHotkeySetting = (e) => {
            if (['Tab', 'Enter', 'Escape', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key) || (e.key.length > 1 && e.key !== ' ')) return;
            e.preventDefault(); e.stopPropagation();
            let newKey = e.key.toLowerCase().slice(0, 1);
            if (newKey) currentSettings.hotkeyKey = newKey;
            else if (e.key === ' ') currentSettings.hotkeyKey = ' ';
            hotkeyInput.removeEventListener('keydown', handleHotkeySetting);
            hotkeyInput.blur();
            saveSettings();
        };

        hotkeyInput.addEventListener('focus', () => {
            hotkeyInput.value = (currentSettings.hotkeyKey === ' ' ? 'SPACJA' : currentSettings.hotkeyKey.toUpperCase());
            hotkeyInput.addEventListener('keydown', handleHotkeySetting);
        });
        hotkeyInput.addEventListener('blur', () => {
            hotkeyInput.value = (currentSettings.hotkeyKey === ' ' ? 'SPACJA' : currentSettings.hotkeyKey.toUpperCase());
            hotkeyInput.removeEventListener('keydown', handleHotkeySetting);
        });

        updateItemDisplay(getUpgradedItemId());
        updateLimitDisplay();

        // Przypinamy funkcję na zewnątrz by interfejs odświeżał limit 
        window._baddonz_upg_updateLimit = updateLimitDisplay;
    }

    const toggleEnhancementWindow = () => {
        if (!window.Engine || !window.Engine.crafting) return;
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

    const getReagents = () => {
        if (!window.Engine || !window.Engine.items) return [];
        return window.Engine.items.fetchLocationItems("g").reduce((acc, item) => {
            if (!item) return acc;

            const cached = item._cachedStats || parseStats(item.stat || item.stats || "");
            const rarity = cached.rarity || item.rarity;
            const enhancement_upgrade_lvl = cached.enhancement_upgrade_lvl !== undefined ? cached.enhancement_upgrade_lvl : (item.enhancement_upgrade_lvl ?? undefined);

            const isWorthless = ((cached && Object.prototype.hasOwnProperty.call(cached, 'artisan_worthless')) || Object.prototype.hasOwnProperty.call(item, 'artisan_worthless'));
            const cursed_flag = (cached.cursed !== undefined ? cached.cursed : (item.cursed !== undefined ? item.cursed : false));
            const itemLevel = parseInt(item.lvl ?? item.level ?? cached.lvl ?? 0, 10);
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
                acc.push(item.id);
            }
            return acc;
        }, []);
    };

    const chunkReagents = (reagents) => {
        const chunks = [];
        for (let i = 0; i < reagents.length; i += MAX_REAGENTS) {
            chunks.push(reagents.slice(i, i + MAX_REAGENTS));
        }
        return chunks;
    };

    function getEnhancementProgressText() {
        try {
            const currentProgressTextEl = window.Engine.crafting.window.wnd.$[0].querySelector('.enhance__progress-text--current');
            if (currentProgressTextEl) {
                return currentProgressTextEl.textContent.trim();
            }
        } catch (e) {}
        return "Brak danych";
    }

    const setEnhancedItem = (itemId) => {
        return new Promise((resolve) => {
            if(!window._g) return resolve({ current: 0, max: 0, isCompleted: false });
            window._g(`enhancement&action=status&item=${itemId}`, (data) => {
                let current = 0;
                let max = 0;
                let isCompleted = false;

                if (data?.enhancement?.progress) {
                    const progress = data.enhancement.progress;
                    current = progress.current;
                    max = progress.max;
                    if (current > 0 && current === max) {
                        isCompleted = true;
                    }
                }

                setTimeout(() => {
                    const progressText = getEnhancementProgressText();
                    if (progressText !== "Brak danych") {
                        saveProgress(itemId, progressText);
                    } else if (isCompleted) {
                        saveProgress(itemId, `${max}/${max}`);
                    }
                    updateItemDisplay(getUpgradedItemId());
                    resolve({ current, max, isCompleted });
                }, 300);
            });
        });
    };

    const setReagents = (itemId, reagentIds) => {
        const reagents = reagentIds.join(",");
        return new Promise((resolve) => {
            window._g(`enhancement&action=progress_preview&item=${itemId}&ingredients=${reagents}`, (data) => resolve(data));
        });
    };

    const enhanceItem = (itemId, reagentIds) => {
        if (!itemId || !reagentIds) return;
        const reagents = reagentIds.join(",");
        return new Promise((resolve) => {
            window._g(`enhancement&action=progress&item=${itemId}&ingredients=${reagents}`, (data) => resolve(data));
        });
    };

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const processChunks = async (upgradedItemId, chunks) => {
        for (const chunk of chunks) {
            if (dailyUpgradeCount >= dailyUpgradeLimit) {
                if(window.message) window.message(`Przerwano ulepszanie. Limit ${dailyUpgradeLimit} osiągnięty.`);
                return true;
            }

            await setReagents(upgradedItemId, chunk);
            await enhanceItem(upgradedItemId, chunk);
            await sleep(200);

            const progressInfo = await setEnhancedItem(upgradedItemId);
            await sleep(100);

            const progressText = getEnhancementProgressText();
            if (progressInfo.isCompleted) {
                if(window.message) window.message(`Ulepszono! Progres: ${progressText}. (MAX)`);
                return true;
            }
            if(window.message) window.message(`Ulepszono! Progres: ${progressText}`);
            await sleep(300);
        }
        return false;
    };

    const handleBagCheck = async () => {
        if (!currentSettings.enabled || !currentSettings.bags_upgrade || dailyUpgradeCount >= dailyUpgradeLimit || isUpgrading) return;
        const upgradedItemId = getUpgradedItemId();
        const upgradedItem = window.Engine?.items?.getItemById(upgradedItemId);

        if (!upgradedItem) return;

        const reagents = getReagents();
        const freeSlots = getFreeSlots();
        if (reagents.length >= 1 && freeSlots <= currentSettings.count_bags_upgrade) {
            isUpgrading = true;
            if(window.message) window.message(`Wolne sloty: ${freeSlots}. Ulepszam! ${upgradedItem.name}.`);

            try {
                toggleEnhancementWindow();
                const progressInfo = await setEnhancedItem(upgradedItemId);

                if (progressInfo.isCompleted) {
                    if(window.message) window.message(`Maksymalny progres osiągnięty.`);
                    return;
                }

                const chunks = chunkReagents(reagents);
                await processChunks(upgradedItemId, chunks);
            } finally {
                toggleEnhancementWindow();
                isUpgrading = false;
            }
        }
    };

    const handleEndBattle = async () => {
        if (!currentSettings.enabled || !currentSettings.upgrade_endbattle || dailyUpgradeCount >= dailyUpgradeLimit || isUpgrading) return;
        const upgradedItemId = getUpgradedItemId();
        const upgradedItem = window.Engine?.items?.getItemById(upgradedItemId);

        if (!upgradedItem) return;

        const reagents = getReagents();

        if (reagents.length < currentSettings.count_endbattle) return;
        if(window.message) window.message(`Ulepszam! ${upgradedItem.name}.`);

        isUpgrading = true;

        try {
            toggleEnhancementWindow();
            const progressInfo = await setEnhancedItem(upgradedItemId);

            if (progressInfo.isCompleted) {
                if(window.message) window.message(`Maksymalny progres osiągnięty.`);
                return;
            }

            const chunks = chunkReagents(reagents);
            await processChunks(upgradedItemId, chunks);
        } finally {
            toggleEnhancementWindow();
            isUpgrading = false;
        }
    };

    const setupKeydownHandler = () => {
        window.document.addEventListener("keydown", async (event) => {
            if(!currentSettings) return;
            const hotkey = currentSettings.hotkeyKey.toLowerCase();
            const isInputActive = ["TEXTAREA", "MAGIC_INPUT", "INPUT"].includes(document.activeElement.tagName);

            if (event.key.toLowerCase() !== hotkey || isInputActive) return;

            if (isUpgrading) {
                event.preventDefault();
                return;
            }

            if (currentSettings.enabled && currentSettings.hotkeyEnabled) {
                isUpgrading = true;

                try {
                    if (typeof window.Engine.battle?.d !== 'undefined' && window.Engine.battle.d.id !== 0) {
                        if(window.message) window.message("Nie można ręcznie ulepszać podczas walki.");
                        return;
                    }

                    if (dailyUpgradeCount >= dailyUpgradeLimit) {
                        if(window.message) window.message(`Osiągnięto dzienny limit ${dailyUpgradeLimit} ulepszeń.`);
                        return;
                    }

                    const upgradedItemId = getUpgradedItemId();
                    const upgradedItem = window.Engine.items.getItemById(upgradedItemId);
                    if (!upgradedItem) { if(window.message) window.message("Nie znaleziono wybranego przedmiotu."); return; }

                    const reagents = getReagents();
                    if (reagents.length === 0) { if(window.message) window.message("Nie znaleziono odpowiednich składników."); return; }

                    event.preventDefault();
                    toggleEnhancementWindow();
                    const chunks = chunkReagents(reagents);

                    const progressInfo = await setEnhancedItem(upgradedItemId);
                    if (progressInfo.isCompleted) {
                        if(window.message) window.message(`Ulepszanie zakończone. ${upgradedItem.name} osiągnął MAX progres.`);
                        toggleEnhancementWindow();
                        return;
                    }

                    await processChunks(upgradedItemId, chunks);
                    toggleEnhancementWindow();

                } finally {
                    isUpgrading = false;
                }
            }
        });
    };

    const intercept = (obj, key, cb) => {
        const _orig = obj[key];
        obj[key] = function (...args) {
            cb(...args);
            return _orig.apply(this, args);
        };
    };

    function addonInit() {
        loadSettings();
        if (!uiMainWindow) buildUI();

        if (!isMenuIntercepted && window.Engine && window.Engine.interface) {
            intercept(window.Engine.interface, 'showPopupMenu', (options, event) => {
                if (!currentSettings.enabled) return;

                let target = event.target;
                let $itemEl = $(target).closest('.item');
                if (!$itemEl.length && target.classList.contains('item')) {
                    $itemEl = $(target);
                }

                const idMatch = $itemEl.attr('class')?.match(/item-id-(\d+)/);
                const itemId = idMatch ? idMatch[1] : null;
                if (!itemId) return;

                const item = window.Engine.items.getItemById(itemId);
                if (!item || !ITEM_TYPE_SETTINGS_MAP.hasOwnProperty(item.cl)) return;

                const currentSelectedItemId = getUpgradedItemId();

                let menuItem;
                if (itemId === currentSelectedItemId) {
                    menuItem = ["Anuluj ulepszanie", () => {
                        setUpgradedItemId("");
                        if(window.message) window.message(`Anulowano ulepszanie przedmiotu ${item.name}`);
                        updateItemDisplay("");
                    }, { button: { cls: "menu-item--red" } }];
                } else {
                    menuItem = ["Ulepsz ten przedmiot", async () => {
                        setUpgradedItemId(itemId);
                        if(window.message) window.message(`Ulepszanie przedmiotu ${item.name}`);
                        toggleEnhancementWindow();
                        await setEnhancedItem(itemId);
                        toggleEnhancementWindow();
                    }, { button: { cls: "menu-item--green" } }];
                }

                options.unshift(menuItem);
            });
            isMenuIntercepted = true;
        }

        if (!isEngineObserved) {
            if (window.Engine && window.Engine.communication) {
                const originalParseJSON = window.Engine.communication.parseJSON;
                window.Engine.communication.parseJSON = function (data) {
                    if (data?.enhancement?.usages_preview?.count !== undefined) {
                        dailyUpgradeCount = data.enhancement.usages_preview.count;
                        dailyUpgradeLimit = data.enhancement.usages_preview.limit || dailyUpgradeLimit;
                        localStorage.setItem(DAILY_COUNT_KEY, dailyUpgradeCount);
                        if (typeof window._baddonz_upg_updateLimit === 'function') {
                            window._baddonz_upg_updateLimit();
                        }
                    }
                    return originalParseJSON.call(this, data);
                };
                isEngineObserved = true;
            }
        }

        if (!isEndBattleHooked && typeof window.Engine?.battle?.setEndBattle === 'function') {
            const originalSetEndBattle = window.Engine.battle.setEndBattle.bind(window.Engine.battle);
            window.Engine.battle.setEndBattle = function() { 
                originalSetEndBattle(); 
                handleEndBattle(); 
            };
            isEndBattleHooked = true;
        }

        setupKeydownHandler();

        bagLoopInterval = setInterval(() => { 
            handleBagCheck(); 
        }, BAG_CHECK_INTERVAL); 
    }

    function addonStop() {
        if (bagLoopInterval) clearInterval(bagLoopInterval);
        bagLoopInterval = null;

        if (uiMainWindow) { uiMainWindow.remove(); uiMainWindow = null; }
        if (uiSettingsWindow) { uiSettingsWindow.remove(); uiSettingsWindow = null; }
    }

    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        saveSettings();
    }

    const checkApi = () => {
        if (!window.BaddonzAPI || !window.BaddonzAPI.registerAddon) {
            setTimeout(checkApi, 500); return;
        }
        window.BaddonzAPI.registerAddon(ADDON_ID, { init: addonInit, stop: addonStop, onStateToggle: onStateToggle });
    };
    checkApi();

})();
