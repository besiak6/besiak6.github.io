// ==UserScript==
// @name          Baddonz Addon - Ulepszator
// @version       1.0.0
// @author        besiak & Baddonz Team
// @match         https://*.margonem.pl/
// @grant         none
// ==/UserScript==

(function () {
    'use strict';

    const ADDON_ID = "UPG";
    const MICC_BASE_URL = 'https://micc.garmory-cdn.cloud/obrazki/itemy/';

    const SETTINGS_KEY_ACCOUNT = "baddonz-settings-upgrader-account";
    const SETTINGS_KEY_CHARACTER = "baddonz-settings-upgrader-character";
    const DAILY_COUNT_KEY = "baddonz-daily-upgrade-count";
    const PROGRESS_STORAGE_KEY = "baddonz-enhancement-progress-char";
    const VISIBILITY_CHECK_INTERVAL = 100;

    const DEFAULT_ACCOUNT_SETTINGS = {
        wnd_pos: { left: '100px', top: '100px' },
        wnd_opacity: 2,
        wnd_vsb: true,
        wnd_clp: false,
        wnd_settings_pos: { left: '400px', top: '100px' },
        wnd_settings_vsb: false,
        wnd_settings_opacity: 2,
        hotkeyKey: "j",
    };

    const DEFAULT_CHARACTER_SETTINGS = {
        enabled: false,
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

    let accountSettings = {};
    let charSettings = {};
    let dailyUpgradeCount = 0;
    let dailyUpgradeLimit = 2000;
    let isUpgrading = false;
    let windowEnabled = false;
    const settings = {};

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

    function saveDailyUpgradeCount(count) {
        localStorage.setItem(DAILY_COUNT_KEY, count);
    }

    function loadDailyUpgradeCount() {
        const count = parseInt(localStorage.getItem(DAILY_COUNT_KEY));
        dailyUpgradeCount = !isNaN(count) ? count : 0;
    }

    function setUpgradedItemId(itemId) {
        if (!window.Engine?.hero?.d) return;
        window.localStorage.setItem(`upgrader-charId-${Engine.hero.d.id}`, itemId);
    }

    function getUpgradedItemId() {
        try {
            return window.localStorage.getItem(`upgrader-charId-${Engine.hero.d.id}`);
        } catch (e) { return null; }
    }

    const updateItemDisplay = (itemId) => {
        if (typeof $ === 'undefined' || typeof Engine === 'undefined' || !Engine.items) return;
        const item = Engine.items.getItemById(itemId);
        const $slotWrapper = $('#baddonz-upgrader-item-slot-wrapper');
        const nameEl = document.getElementById("baddonz-upgrader-item-name");
        const progressEl = document.getElementById("baddonz-upgrader-item-progress");

        $slotWrapper.empty();
        if (nameEl) nameEl.textContent = "";
        if (progressEl) progressEl.textContent = "";

        const $slotContainer = $(
            `<div class="enhance__item enhance__item--current interface-element-one-item-slot-decor" id="baddonz-upgrader-main-item-slot">
                <div class="slot"></div>
                <div class="lvl" data-lvl="0">
                    <div class="cl-icon icon-star-0"></div>
                </div>
              </div>`
        );
        if (!item) {
            $slotWrapper.append($slotContainer);
            return;
        }

        const upgradeLvl = item.upgrade_lvl || 0;
        $slotContainer.find('.lvl')
            .attr('data-lvl', upgradeLvl)
            .html(`<div class="cl-icon icon-star-${upgradeLvl}"></div>`);
        if (nameEl) nameEl.textContent = item.name;

        const storedProgress = loadProgress(itemId);
        if (storedProgress && progressEl) {
            progressEl.textContent = `Progres: ${storedProgress}`;
        }

        const $clonedItem = item.$.clone();
        $clonedItem.addClass('baddonz-upgrader-item-cursor');
        $clonedItem.on('click', () => {
            setUpgradedItemId("");
            message(`Anulowano ulepszanie przedmiotu ${item.name}`);
            updateUI();
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
            .css({
                width: '32px',
                height: '32px',
                position: 'absolute',
                top: '0',
                left: '0',
                zIndex: '0'
            });

        $clonedItem.append($img);
        $slotContainer.find('.slot').append($clonedItem);
        $slotWrapper.append($slotContainer);
    };

    function loadSettings() {
        const charId = window.Engine?.hero?.d?.id;
        try {
            const storedAccSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY_ACCOUNT));
            accountSettings = { ...DEFAULT_ACCOUNT_SETTINGS, ...storedAccSettings };
        } catch (e) {
            accountSettings = { ...DEFAULT_ACCOUNT_SETTINGS };
        }

        if (!charId) return;
        try {
            const storedCharSettings = JSON.parse(localStorage.getItem(`${SETTINGS_KEY_CHARACTER}-${charId}`));
            charSettings = { ...DEFAULT_CHARACTER_SETTINGS, ...storedCharSettings };
        } catch (e) {
            charSettings = { ...DEFAULT_CHARACTER_SETTINGS };
        }

        Object.assign(settings, charSettings);
        loadDailyUpgradeCount();
    }

    function saveSettings(type = 'all') {
        const charId = window.Engine?.hero?.d?.id;
        if (type === 'account' || type === 'all') {
            localStorage.setItem(SETTINGS_KEY_ACCOUNT, JSON.stringify(accountSettings));
        }

        if (type === 'character' || type === 'all') {
            if (charId) {
                Object.assign(charSettings, settings);
                localStorage.setItem(`${SETTINGS_KEY_CHARACTER}-${charId}`, JSON.stringify(charSettings));
            }
        }
    }

    function syncOpacity(windowId, opacityKey) {
        const apWindow = document.getElementById(windowId);
        if (!apWindow) return;

        const opacityClasses = ['opacity-0', 'opacity-1', 'opacity-2', 'opacity-3', 'opacity-4'];
        const unifiedOpacityEnabled = localStorage.getItem('baddonz_unified_opacity_enabled') === 'true';

        apWindow.classList.remove(...opacityClasses);
        if (unifiedOpacityEnabled) {
            const globalOpacity = parseInt(localStorage.getItem('baddonz_current_opacity') || '2');
            apWindow.classList.add(opacityClasses[globalOpacity]);
        } else {
            apWindow.classList.add(opacityClasses[accountSettings[opacityKey]]);
        }
    }

    function handleOpacityClick(windowId, opacityKey) {
        const apWindow = document.getElementById(windowId);
        if (!apWindow) return;

        const opacityClasses = ['opacity-0', 'opacity-1', 'opacity-2', 'opacity-3', 'opacity-4'];
        const unifiedOpacityEnabled = localStorage.getItem('baddonz_unified_opacity_enabled') === 'true';
        if (unifiedOpacityEnabled) {
            if (window.setBaddonzGlobalOpacity) {
                let currentGlobalOpacity = parseInt(localStorage.getItem('baddonz_current_opacity') || '2');
                let newOpacity = (currentGlobalOpacity + 1) % opacityClasses.length;
                window.setBaddonzGlobalOpacity(newOpacity);
            }
        } else {
            apWindow.classList.remove(...opacityClasses);
            accountSettings[opacityKey] = (accountSettings[opacityKey] + 1) % opacityClasses.length;
            apWindow.classList.add(opacityClasses[accountSettings[opacityKey]]);
            saveSettings('account');
        }
    }

    function syncVisibilityFromDOM() {
        const mainWnd = document.getElementById("wnd-ulepszara");
        const settingsWnd = document.getElementById("wnd-ulepszara-settings");
        let mainChanged = false;
        let settingsChanged = false;

        if (mainWnd) {
            const isVisible = mainWnd.style.display !== 'none';
            if (accountSettings.wnd_vsb !== isVisible) {
                accountSettings.wnd_vsb = isVisible;
                mainChanged = true;
            }
        }

        if (settingsWnd) {
            const isVisible = settingsWnd.style.display !== 'none';
            if (accountSettings.wnd_settings_vsb !== isVisible) {
                accountSettings.wnd_settings_vsb = isVisible;
                settingsChanged = true;
            }
        }

        if (mainChanged || settingsChanged) {
            saveSettings('account');
        }
    }

    function updateUI() {
        const mainWnd = document.getElementById("wnd-ulepszara");
        if (!mainWnd) return;
        const stateBtn = document.getElementById("baddonz-upgrader-state-button");
        const collapseBtn = document.getElementById("baddonz-upgrader-main-collapse-btn");

        if (stateBtn) {
            stateBtn.classList.toggle('active', settings.enabled);
            if (typeof $ === 'function' && $.fn.tip) {
                $(stateBtn).tip(settings.enabled ? 'Wyłącz dodatek' : 'Włącz dodatek');
            }
        }

        const itemDetails = document.getElementById("baddonz-upgrader-item-details");
        if (accountSettings.wnd_clp) {
            mainWnd.classList.add("wnd-ulepszara-collapsed");
            if (itemDetails) itemDetails.style.display = 'none';
        } else {
            mainWnd.classList.remove("wnd-ulepszara-collapsed");
            if (itemDetails) itemDetails.style.display = 'flex';
        }

        const upgradedItemId = getUpgradedItemId();
        updateItemDisplay(upgradedItemId);

        const dailyLimitEl = document.getElementById("baddonz-upgrader-daily-limit");
        if (dailyLimitEl) {
            dailyLimitEl.textContent = `Limit: ${dailyUpgradeCount}/${dailyUpgradeLimit}`;
            dailyLimitEl.classList.toggle('baddonz-upgrader-daily-limit-single-line--expanded', !accountSettings.wnd_clp);
        }

        if (typeof $ === 'function' && $.fn.tip && collapseBtn) {
            $(collapseBtn).tip(accountSettings.wnd_clp ? 'Rozwiń' : 'Zwiń');
        }

        const settingsWnd = document.getElementById("wnd-ulepszara-settings");
        if (!settingsWnd) return;

        settingsWnd.querySelector("#baddonz-upgrader-hotkey-enabled").classList.toggle('active', settings.hotkeyEnabled);
        settingsWnd.querySelector("#baddonz-upgrader-use-common").classList.toggle('active', settings.use_common);
        settingsWnd.querySelector("#baddonz-upgrader-use-unique").classList.toggle('active', settings.use_unique);
        settingsWnd.querySelector("#baddonz-upgrader-allow-bound").classList.toggle('active', settings.allow_bound_items);
        settingsWnd.querySelector("#baddonz-upgrader-upgrade-endbattle-check").classList.toggle('active', settings.upgrade_endbattle);
        settingsWnd.querySelector("#baddonz-upgrader-bags-upgrade-check").classList.toggle('active', settings.bags_upgrade);

        settingsWnd.querySelector("#baddonz-upgrader-count-endbattle-input").value = settings.count_endbattle;
        settingsWnd.querySelector("#baddonz-upgrader-count-bags-upgrade-input").value = settings.count_bags_upgrade;
        
        const hotkeyInputWrapper = document.getElementById("baddonz-upgrader-hotkey-options");
        const hotkeyInput = settingsWnd.querySelector("#baddonz-upgrader-hotkey-input");
        if (document.activeElement !== hotkeyInput && hotkeyInput) {
            hotkeyInput.value = (accountSettings.hotkeyKey === ' ' ? 'SPACJA' : accountSettings.hotkeyKey.toUpperCase());
        }

        if (hotkeyInputWrapper) hotkeyInputWrapper.style.display = settings.hotkeyEnabled ? 'flex' : 'none';
        
        const endBattleOptions = document.getElementById("baddonz-upgrader-endbattle-options");
        if (endBattleOptions) endBattleOptions.style.display = settings.upgrade_endbattle ? 'flex' : 'none';
        
        const bagsOptions = document.getElementById("baddonz-upgrader-bags-options");
        if (bagsOptions) bagsOptions.style.display = settings.bags_upgrade ? 'flex' : 'none';

        const itemTypeFiltersContainer = document.getElementById("baddonz-upgrader-type-filters");
        if (itemTypeFiltersContainer) {
            itemTypeFiltersContainer.querySelectorAll('.baddonz-checkbox').forEach(cb => {
                const cl = cb.id.replace('baddonz-upgrader-cl-', '');
                const key = `cl${cl}`;
                cb.classList.toggle('active', settings[key]);
            });
        }
    }

    function setupDrag(windowId, posKey) {
        const apWindow = document.getElementById(windowId);
        if (!apWindow) return;
        const apTitleBar = apWindow.querySelector(".baddonz-window-title");
        if (!apTitleBar) return;

        let isDragging = false;
        let offsetX, offsetY;

        apTitleBar.addEventListener('mousedown', (e) => {
            isDragging = true;
            offsetX = e.clientX - apWindow.getBoundingClientRect().left;
            offsetY = e.clientY - apWindow.getBoundingClientRect().top;
            apWindow.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            let newX = e.clientX - offsetX;
            let newY = e.clientY - offsetY;

            const maxX = window.innerWidth - apWindow.offsetWidth;
            const maxY = window.innerHeight - apWindow.offsetHeight;
            newX = Math.max(0, Math.min(newX, maxX));
            newY = Math.max(0, Math.min(newY, maxY));

            apWindow.style.left = `${newX}px`;
            apWindow.style.top = `${newY}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                apWindow.style.cursor = '';
                accountSettings[posKey].left = apWindow.style.left;
                accountSettings[posKey].top = apWindow.style.top;
                saveSettings('account');
            }
        });
    }

    function generateItemTypeFiltersHtml() {
        const ITEM_CL_MAP = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 29];
        let html = '';

        ITEM_CL_MAP.forEach(cl => {
            const key = `cl${cl}`;
            html += `
                <div class="baddonz-typ-wrapper" data-key="${key}" data-cl="${cl}">
                    <div class="baddonz-checkbox" id="baddonz-upgrader-cl-${cl}"></div>
                    <div class="baddonz-type-icon cl-${cl}"></div>
                </div>
            `;
        });
        return html;
    }

    function createUI() {
        if (document.getElementById("wnd-ulepszara")) return;

        const settings_wnd_html = `
            <div class="baddonz-window baddonz-scroll" id="wnd-ulepszara-settings" style="position: absolute; z-index: 501; display: none;">
                <div class="baddonz-window-header">
                    <div class="baddonz-window-controls left">
                        <div class="baddonz-icon baddonz-opacity-button" id="baddonz-upgrader-settings-opacity-btn"></div>
                    </div>
                    <div class="baddonz-window-title">Ulepszara - Ustawienia</div>
                    <div class="baddonz-window-controls right">
                        <div class="baddonz-icon baddonz-close-button" id="baddonz-upgrader-settings-close-button"></div>
                    </div>
                </div>
                <div class="baddonz-window-body baddonz-flex column" style="width: 260px; gap: 4px;">
                    <div class="baddonz-setting-row baddonz-flex between centered">
                        <div class="baddonz-text">Ulepszaj Zwyklakami</div>
                        <div class="baddonz-checkbox" id="baddonz-upgrader-use-common"></div>
                    </div>
                    <div class="baddonz-setting-row baddonz-flex between centered">
                        <div class="baddonz-text">Ulepszaj Unikatami</div>
                        <div class="baddonz-checkbox" id="baddonz-upgrader-use-unique"></div>
                    </div>
                    <div class="baddonz-setting-row baddonz-flex between centered">
                        <div class="baddonz-text">Ulepszaj Związanymi</div>
                        <div class="baddonz-checkbox" id="baddonz-upgrader-allow-bound"></div>
                    </div>
                    
                    <hr class="baddonz-separator" style="width:100%; border:0; border-top:1px solid #303030; margin: 4px 0;">
                    <div class="baddonz-text" style="text-align: center; font-weight: bold; margin-bottom: 2px;">Filtry typów przedmiotów:</div>
                    <div id="baddonz-upgrader-type-filters">
                        ${generateItemTypeFiltersHtml()}
                    </div>
                    <hr class="baddonz-separator" style="width:100%; border:0; border-top:1px solid #303030; margin: 4px 0;">

                    <div class="baddonz-setting-row baddonz-flex between centered">
                        <div class="baddonz-text">Ulepszanie Klawiszem</div>
                        <div class="baddonz-checkbox" id="baddonz-upgrader-hotkey-enabled"></div>
                    </div>
                    <div id="baddonz-upgrader-hotkey-options" class="baddonz-flex between centered baddonz-setting-row" style="padding-left: 10px;">
                        <div class="baddonz-text">Klawisz skrótu:</div>
                        <input type="text" class="baddonz-input" id="baddonz-upgrader-hotkey-input" maxlength="7" style="width: 70px; text-transform: uppercase; text-align: center;">
                    </div>

                    <div class="baddonz-setting-row baddonz-flex between centered">
                        <div class="baddonz-text">Ulepszaj automatycznie po walce</div>
                        <div class="baddonz-checkbox" id="baddonz-upgrader-upgrade-endbattle-check"></div>
                    </div>
                    <div id="baddonz-upgrader-endbattle-options" class="baddonz-flex between centered baddonz-setting-row" style="padding-left: 10px;">
                        <div class="baddonz-text">Min. ilość reagentów:</div>
                        <input type="number" class="baddonz-input" id="baddonz-upgrader-count-endbattle-input" min="1" max="50" style="width: 50px; text-align: center;">
                    </div>

                    <div class="baddonz-setting-row baddonz-flex between centered">
                        <div class="baddonz-text">Ulepszaj gdy pełne torby</div>
                        <div class="baddonz-checkbox" id="baddonz-upgrader-bags-upgrade-check"></div>
                    </div>
                    <div id="baddonz-upgrader-bags-options" class="baddonz-flex between centered baddonz-setting-row" style="padding-left: 10px;">
                        <div class="baddonz-text">Max. wolnych slotów:</div>
                        <input type="number" class="baddonz-input" id="baddonz-upgrader-count-bags-upgrade-input" min="1" max="100" style="width: 50px; text-align: center;">
                    </div>
                </div>
            </div>
        `;

        const main_wnd_html = `
            <div class="baddonz-window" id="wnd-ulepszara" style="position: absolute; z-index: 500;">
                <div class="baddonz-window-header baddonz-flex between centered">
                    <div class="baddonz-window-controls left baddonz-flex" style="gap: 2px;">
                        <div class="baddonz-icon baddonz-opacity-button" id="baddonz-upgrader-main-opacity-btn"></div>
                        <div class="baddonz-icon baddonz-settings-button" id="baddonz-upgrader-main-settings-btn"></div>
                        <div class="baddonz-icon baddonz-button" id="baddonz-upgrader-state-button" style="width:14px; height:14px; padding:0; border-radius:50%;"></div>
                    </div>
                    <div class="baddonz-window-title" style="text-align: center; flex: 1;">Ulepszara</div>
                    <div class="baddonz-window-controls right baddonz-flex" style="gap: 2px;">
                       <div class="baddonz-icon baddonz-collapsed" id="baddonz-upgrader-main-collapse-btn"></div>
                       <div class="baddonz-icon baddonz-close-button" id="baddonz-upgrader-main-close-button"></div>
                    </div>
                </div>
                <div class="baddonz-window-body baddonz-flex column" style="padding: 6px; gap: 4px; min-width: 150px; align-items: center;">
                    <div id="baddonz-upgrader-item-details" class="baddonz-flex column centered" style="width: 100%; gap: 4px;">
                        <div id="baddonz-upgrader-item-display-container" class="baddonz-flex column centered" style="gap: 4px;">
                            <div id="baddonz-upgrader-item-slot-wrapper" class="baddonz-flex centered"></div>
                            <div class="baddonz-text" id="baddonz-upgrader-item-name" style="font-size: 11px; font-weight: bold; color: #ffcc00; text-align:center; max-width:140px; word-wrap:break-word;"></div>
                            <div class="baddonz-text" id="baddonz-upgrader-item-progress" style="font-size: 10px; color: #aaa;"></div>
                        </div>
                    </div>
                    <div class="baddonz-setting-row baddonz-flex centered" style="width: 100%; margin-top: 2px; padding: 2px 0;">
                        <div id="baddonz-upgrader-daily-limit" class="baddonz-text" style="font-weight: bold; font-size: 10px;">Limit: 0/2000</div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', main_wnd_html + settings_wnd_html);

        const mainWnd = document.getElementById("wnd-ulepszara");
        const settingsWnd = document.getElementById("wnd-ulepszara-settings");

        if (mainWnd) {
            mainWnd.style.left = accountSettings.wnd_pos.left;
            mainWnd.style.top = accountSettings.wnd_pos.top;
            mainWnd.style.display = accountSettings.wnd_vsb ? 'flex' : 'none';
            syncOpacity('wnd-ulepszara', 'wnd_opacity');
        }

        if (settingsWnd) {
            settingsWnd.style.left = accountSettings.wnd_settings_pos.left;
            settingsWnd.style.top = accountSettings.wnd_settings_pos.top;
            settingsWnd.style.display = accountSettings.wnd_settings_vsb ? 'flex' : 'none';
            syncOpacity('wnd-ulepszara-settings', 'wnd_settings_opacity');
        }

        updateUI();
        setupListeners();
    }

    function setupListeners() {
        setupDrag("wnd-ulepszara", 'wnd_pos');
        setupDrag("wnd-ulepszara-settings", 'wnd_settings_pos');

        const collapseBtn = document.getElementById("baddonz-upgrader-main-collapse-btn");
        const settingsBtn = document.getElementById("baddonz-upgrader-main-settings-btn");
        const stateBtn = document.getElementById("baddonz-upgrader-state-button");
        const opacityBtnMain = document.getElementById("baddonz-upgrader-main-opacity-btn");
        const closeBtnMain = document.getElementById("baddonz-upgrader-main-close-button");
        
        const mainWnd = document.getElementById("wnd-ulepszara");
        const settingsWnd = document.getElementById("wnd-ulepszara-settings");
        const closeBtnSettings = document.getElementById("baddonz-upgrader-settings-close-button");
        const opacityBtnSettings = document.getElementById("baddonz-upgrader-settings-opacity-btn");

        if (collapseBtn) {
            collapseBtn.addEventListener('click', () => {
                accountSettings.wnd_clp = !accountSettings.wnd_clp;
                saveSettings('account');
                updateUI();
            });
        }

        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                accountSettings.wnd_settings_vsb = !accountSettings.wnd_settings_vsb;
                if (settingsWnd) settingsWnd.style.display = accountSettings.wnd_settings_vsb ? 'flex' : 'none';
                syncOpacity('wnd-ulepszara-settings', 'wnd_settings_opacity');
                saveSettings('account');
            });
        }

        if (opacityBtnMain) {
            opacityBtnMain.addEventListener('click', () => handleOpacityClick('wnd-ulepszara', 'wnd_opacity'));
        }

        if (stateBtn) {
            stateBtn.addEventListener('click', () => {
                settings.enabled = !settings.enabled;
                saveSettings('character');
                updateUI();
            });
        }

        if (closeBtnMain) {
            closeBtnMain.addEventListener('click', () => {
                accountSettings.wnd_vsb = false;
                if (mainWnd) mainWnd.style.display = 'none';
                saveSettings('account');
            });
        }

        if (closeBtnSettings) {
            closeBtnSettings.addEventListener('click', () => {
                accountSettings.wnd_settings_vsb = false;
                if (settingsWnd) settingsWnd.style.display = 'none';
                saveSettings('account');
            });
        }

        if (opacityBtnSettings) {
            opacityBtnSettings.addEventListener('click', () => handleOpacityClick('wnd-ulepszara-settings', 'wnd_settings_opacity'));
        }

        const sWND_checkboxes = [
            { id: "baddonz-upgrader-hotkey-enabled", key: "hotkeyEnabled" },
            { id: "baddonz-upgrader-use-common", key: "use_common" },
            { id: "baddonz-upgrader-use-unique", key: "use_unique" },
            { id: "baddonz-upgrader-allow-bound", key: "allow_bound_items" },
            { id: "baddonz-upgrader-upgrade-endbattle-check", key: "upgrade_endbattle" },
            { id: "baddonz-upgrader-bags-upgrade-check", key: "bags_upgrade" },
        ];

        sWND_checkboxes.forEach(item => {
            const el = document.getElementById(item.id);
            if (el) {
                el.addEventListener('click', () => {
                    settings[item.key] = !settings[item.key];
                    saveSettings('character');
                    updateUI();
                });
            }
        });

        const countEndbattleInput = document.getElementById("baddonz-upgrader-count-endbattle-input");
        if (countEndbattleInput) {
            countEndbattleInput.addEventListener('change', () => {
                const val = Math.max(1, parseInt(countEndbattleInput.value) || 1);
                settings.count_endbattle = val;
                countEndbattleInput.value = val;
                saveSettings('character');
            });
        }

        const countBagsUpgradeInput = document.getElementById("baddonz-upgrader-count-bags-upgrade-input");
        if (countBagsUpgradeInput) {
            countBagsUpgradeInput.addEventListener('change', () => {
                const val = Math.max(1, parseInt(countBagsUpgradeInput.value) || 1);
                settings.count_bags_upgrade = val;
                countBagsUpgradeInput.value = val;
                saveSettings('character');
            });
        }

        const hotkeyInput = document.getElementById("baddonz-upgrader-hotkey-input");
        if (hotkeyInput) {
            const handleHotkeySetting = (e) => {
                if (['Tab', 'Enter', 'Escape', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key) || (e.key.length > 1 && e.key !== ' ')) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();

                let newKey = e.key.toLowerCase().slice(0, 1);
                if (newKey) {
                    accountSettings.hotkeyKey = newKey;
                } else if (e.key === ' ') {
                    accountSettings.hotkeyKey = ' ';
                }

                hotkeyInput.removeEventListener('keydown', handleHotkeySetting);
                hotkeyInput.blur();
                saveSettings('account');
                updateUI();
            };

            hotkeyInput.addEventListener('focus', () => {
                hotkeyInput.value = (accountSettings.hotkeyKey === ' ' ? 'SPACJA' : accountSettings.hotkeyKey.toUpperCase());
                hotkeyInput.addEventListener('keydown', handleHotkeySetting);
            });
            hotkeyInput.addEventListener('blur', () => {
                hotkeyInput.removeEventListener('keydown', handleHotkeySetting);
                updateUI();
            });
        }

        const itemTypeFiltersContainer = document.getElementById("baddonz-upgrader-type-filters");
        if (itemTypeFiltersContainer && typeof $ === 'function' && $.fn.tip) {
            const tip = (el, text) => $(el).tip(text);
            itemTypeFiltersContainer.querySelectorAll('.baddonz-typ-wrapper').forEach(wrapper => {
                const cl = parseInt(wrapper.getAttribute('data-cl'));
                if (cl && ITEM_CL_NAMES[cl]) {
                    tip(wrapper, ITEM_CL_NAMES[cl]);
                }

                wrapper.addEventListener('click', () => {
                    const key = wrapper.getAttribute('data-key');
                    if (key) {
                        settings[key] = !settings[key];
                        saveSettings('character');
                        updateUI();
                    }
                });
            });

            if (closeBtnMain) tip(closeBtnMain, 'Zamknij');
            if (closeBtnSettings) tip(closeBtnSettings, 'Zamknij');
            if (settingsBtn) tip(settingsBtn, 'Ustawienia');
            if (opacityBtnMain) tip(opacityBtnMain, 'Zmień przezroczystość');
            if (opacityBtnSettings) tip(opacityBtnSettings, 'Zmień przezroczystość');
            
            const boundCheck = settingsWnd ? settingsWnd.querySelector("#baddonz-upgrader-allow-bound") : null;
            if (boundCheck) tip(boundCheck, 'Używasz na własną odpowiedzialność! Uwaga na przedmioty z herosów/kolosów');
            
            const battleCheck = settingsWnd ? settingsWnd.querySelector("#baddonz-upgrader-upgrade-endbattle-check") : null;
            if (battleCheck) tip(battleCheck, 'Automatyczne ulepszanie po walce po zebraniu min. ilości składników');
        }
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
        if (typeof Engine !== 'undefined' && Engine.bags && Array.isArray(Engine.bags)) {
            const bagsToCount = Engine.bags.length > 0 ? Engine.bags.slice(0, Engine.bags.length - 1) : Engine.bags;
            bagsToCount.forEach(bag => {
                if (Array.isArray(bag) && bag.length >= 2) {
                    totalFreeSlots += Math.max(0, bag[0] - bag[1]);
                }
            });
        }
        return totalFreeSlots;
    };

    const initializeScript = () => {
        try {
            if (!window.Engine?.allInit) {
                setTimeout(initializeScript, 500);
                return;
            }
        } catch (error) {
            setTimeout(initializeScript, 500);
            return;
        }

        loadSettings();
        createUI();

        setupDOMAndListeners();
        setupCommunicationHook();

        setInterval(syncVisibilityFromDOM, VISIBILITY_CHECK_INTERVAL);

        if (typeof Engine.battle?.setEndBattle === 'function') {
            const originalSetEndBattle = Engine.battle.setEndBattle.bind(Engine.battle);
            Engine.battle.setEndBattle = function() {
                originalSetEndBattle();
                handleEndBattle();
            };
        }

        setTimeout(function bagLoop() {
            if (settings.bags_upgrade && settings.enabled) {
                handleBagCheck();
            }
            setTimeout(bagLoop, BAG_CHECK_INTERVAL);
        }, BAG_CHECK_INTERVAL);
    };

    const setupCommunicationHook = () => {
        if (typeof Engine.communication?.parseJSON !== 'function') {
            setTimeout(setupCommunicationHook, 500);
            return;
        }

        const originalParseJSON = Engine.communication.parseJSON;
        Engine.communication.parseJSON = function (data) {
            if (data?.enhancement?.usages_preview?.count !== undefined) {
                dailyUpgradeCount = data.enhancement.usages_preview.count;
                dailyUpgradeLimit = data.enhancement.usages_preview.limit || dailyUpgradeLimit;
                saveDailyUpgradeCount(dailyUpgradeCount);
                updateUI();
            }
            return originalParseJSON.call(this, data);
        };
    };

    const checkDailyLimit = () => dailyUpgradeCount < dailyUpgradeLimit;

    function getEnhancementProgressText() {
        try {
            const currentProgressTextEl = Engine.crafting?.window?.wnd?.$[0]?.querySelector('.enhance__progress-text--current');
            if (currentProgressTextEl) {
                return currentProgressTextEl.textContent.trim();
            }
        } catch (e) {}
        return "Brak danych";
    }

    const handleBagCheck = async () => {
        if (!settings.enabled || !settings.bags_upgrade || !checkDailyLimit() || isUpgrading) return;
        const upgradedItemId = getUpgradedItemId();
        const upgradedItem = Engine.items.getItemById(upgradedItemId);

        if (!upgradedItem) return;

        const reagents = getReagents();
        const freeSlots = getFreeSlots();
        if (reagents.length >= 1 && freeSlots <= settings.count_bags_upgrade) {
            isUpgrading = true;
            message(`Wolne sloty: ${freeSlots}. Automatyczne ulepszanie przedmiotu ${upgradedItem.name}.`);

            try {
                toggleEnhancementWindow();
                const progressInfo = await setEnhancedItem(upgradedItemId);

                if (progressInfo.isCompleted) {
                    message(`Maksymalny progres osiągnięty.`);
                    return;
                }

                const chunks = chunkReagents(reagents);
                await processChunks(upgradedItemId, chunks);
            } canvas {
            } finally {
                toggleEnhancementWindow();
                isUpgrading = false;
            }
        }
    };

    const handleEndBattle = async () => {
        if (!settings.enabled || !settings.upgrade_endbattle || !checkDailyLimit() || isUpgrading) return;
        const upgradedItemId = getUpgradedItemId();
        const upgradedItem = Engine.items.getItemById(upgradedItemId);

        if (!upgradedItem) return;

        const reagents = getReagents();
        if (reagents.length < settings.count_endbattle) return;

        message(`Automatyczne ulepszanie po walce: ${upgradedItem.name}.`);
        isUpgrading = true;

        try {
            toggleEnhancementWindow();
            const progressInfo = await setEnhancedItem(upgradedItemId);

            if (progressInfo.isCompleted) {
                message(`Maksymalny progres osiągnięty.`);
                return;
            }

            const chunks = chunkReagents(reagents);
            await processChunks(upgradedItemId, chunks);
        } finally {
            toggleEnhancementWindow();
            isUpgrading = false;
        }
    };

    const processChunks = async (upgradedItemId, chunks) => {
        for (const chunk of chunks) {
            if (!checkDailyLimit()) {
                message(`Przerwano ulepszanie. Limit dzienny osiągnięty.`);
                return true;
            }

            await setReagents(upgradedItemId, chunk);
            await enhanceItem(upgradedItemId, chunk);
            await sleep(200);

            const progressInfo = await setEnhancedItem(upgradedItemId);
            await sleep(100);

            const progressText = getEnhancementProgressText();
            if (progressInfo.isCompleted) {
                message(`Ulepszono! Progres: ${progressText}. (MAX)`);
                return true;
            }
            message(`Ulepszono! Progres: ${progressText}`);
            await sleep(300);
        }
        return false;
    };

    const setupCSS = () => {
        const css = `
            .upgrader-crafting-window { display: none !important; }
            .menu-item--baddonz-upgrader-active { background: rgb(57, 100, 17) !important; color: #fff !important; border-radius: 4px !important; }
            #wnd-ulepszara.wnd-ulepszara-collapsed { height: auto !important; }
            #wnd-ulepszara-settings #baddonz-upgrader-type-filters {
                display: grid;
                grid-template-columns: repeat(5, 1fr);
                gap: 4px;
                padding: 4px;
                background: rgba(0, 0, 0, 0.2);
                border-radius: 4px;
            }
            .baddonz-typ-wrapper {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                gap: 2px;
                padding: 4px 2px;
                background: rgba(255, 255, 255, 0.03);
                border-radius: 3px;
                border: 1px solid #222;
            }
            .baddonz-typ-wrapper:hover { background: rgba(255, 255, 255, 0.08); }
            .baddonz-typ-wrapper .baddonz-checkbox { width: 12px; height: 12px; }
            .baddonz-upgrader-item-cursor { cursor: pointer !important; }
            #baddonz-upgrader-state-button.active { background-color: #26ca3f !important; box-shadow: 0 0 4px #26ca3f; }
            #baddonz-upgrader-state-button:not(.active) { background-color: #ff3b30 !important; box-shadow: 0 0 4px #ff3b30; }
        `;
        const style = document.createElement("style");
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
    };

    const setupDOMAndListeners = () => {
        setupCSS();
        setupKeydownHandler();
        initItemContextMenu();
    };

    const setupKeydownHandler = () => {
        window.document.addEventListener("keydown", async (event) => {
            if (!accountSettings.hotkeyKey) return;
            const hotkey = accountSettings.hotkeyKey.toLowerCase();
            const isInputActive = ["TEXTAREA", "MAGIC_INPUT", "INPUT"].includes(document.activeElement.tagName);

            if (event.key.toLowerCase() !== hotkey || isInputActive) return;

            if (isUpgrading) {
                event.preventDefault();
                return;
            }

            if (settings.enabled && settings.hotkeyEnabled) {
                isUpgrading = true;

                try {
                    if (typeof Engine.battle?.d !== 'undefined' && Engine.battle.d.id !== 0) {
                        message("Nie można ręcznie ulepszać podczas walki.");
                        return;
                    }

                    if (!checkDailyLimit()) {
                        message(`Osiągnięto dzienny limit ulepszeń.`);
                        return;
                    }

                    const upgradedItemId = getUpgradedItemId();
                    const upgradedItem = Engine.items.getItemById(upgradedItemId);
                    if (!upgradedItem) { message("Nie wybrano przedmiotu bazowego."); return; }

                    const reagents = getReagents();
                    if (reagents.length === 0) { message("Brak odpowiednich składników w plecaku."); return; }

                    event.preventDefault();
                    toggleEnhancementWindow();
                    const chunks = chunkReagents(reagents);

                    const progressInfo = await setEnhancedItem(upgradedItemId);
                    if (progressInfo.isCompleted) {
                        message(`Przedmiot ${upgradedItem.name} posiada już maksymalny progres.`);
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

    const initItemContextMenu = () => {
        const ogShowPopupMenu = Engine.interface.showPopupMenu;
        Engine.interface.showPopupMenu = function (menu, e) {
            const itemId = getItemIdFromClassName(e.currentTarget?.className);
            const item = Engine.items.getItemById(itemId);
            const currentSelectedItemId = getUpgradedItemId();

            if (!itemId || !ITEM_TYPE_SETTINGS_MAP.hasOwnProperty(item?.cl)) {
                return ogShowPopupMenu.call(this, menu, e);
            }

            let menuItem;
            if (itemId === currentSelectedItemId) {
                menuItem = ["Anuluj ulepszanie baddonz", () => {
                    setUpgradedItemId("");
                    message(`Anulowano ulepszanie przedmiotu ${item.name}`);
                    updateUI();
                }, { button: { cls: "menu-item--baddonz-upgrader-active" } }];
            } else {
                menuItem = ["Ulepsz ten przedmiot baddonz", async () => {
                    setUpgradedItemId(itemId);
                    message(`Wybrano przedmiot do ulepszania: ${item.name}`);
                    toggleEnhancementWindow();
                    await setEnhancedItem(itemId);
                    toggleEnhancementWindow();
                }, { button: { cls: "menu-item--baddonz-upgrader-active" } }];
            }

            ogShowPopupMenu.call(this, [menuItem, ...menu], e);
        };
    };

    const getItemIdFromClassName = (className) => {
        if (!className) return null;
        const match = className.match(/item-id-(\d+)/);
        return match ? match[1] : null;
    };

    const toggleEnhancementWindow = () => {
        if (!Engine.crafting?.window?.wnd?.$) return;
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

    const getReagents = () => {
        if (!Engine.items) return [];
        return Engine.items.fetchLocationItems("g").reduce((acc, item) => {
            if (!item) return acc;

            const cached = item._cachedStats || {};
            const rarity = cached.rarity || item.rarity;
            const enhancement_upgrade_lvl = cached.enhancement_upgrade_lvl !== undefined ? cached.enhancement_upgrade_lvl : item.enhancement_upgrade_lvl;

            const isWorthless = (
                Object.prototype.hasOwnProperty.call(cached, 'artisan_worthless') ||
                Object.prototype.hasOwnProperty.call(item, 'artisan_worthless')
            );

            const cursed_flag = cached.cursed !== undefined ? cached.cursed : (item.cursed !== undefined ? item.cursed : false);
            const itemLevel = item.lvl ?? item.level ?? cached.lvl ?? 0;
            const itemClass = item.cl;

            const isAllowedRarity = (settings.use_common && rarity === 'common') || (settings.use_unique && rarity === 'unique');
            const itemSettingKey = ITEM_TYPE_SETTINGS_MAP[itemClass];
            const isAllowedType = itemSettingKey ? settings[itemSettingKey] : false;
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

            if (isAllowedType && isAllowedRarity && !isEventItem(item) && !isUpgraded && (settings.allow_bound_items || !isBound) && !isPartOfBuild) {
                let isPartOfBuildExtra = false;
                if (typeof Engine.buildsManager !== 'undefined' && item.getBuildsWithThisItem) {
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
        for (let i = 0; i < reagents.length; i += MAX_REAGENTS) {
            chunks.push(reagents.slice(i, i + MAX_REAGENTS));
        }
        return chunks;
    };

    const setEnhancedItem = (itemId) => {
        return new Promise((resolve) => {
            _g(`enhancement&action=status&item=${itemId}`, (data) => {
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
                    updateUI();
                    resolve({ current, max, isCompleted });
                }, 300);
            });
        });
    };

    const setReagents = (itemId, reagentIds) => {
        const reagents = reagentIds.join(",");
        return new Promise((resolve) => {
            _g(`enhancement&action=progress_preview&item=${itemId}&ingredients=${reagents}`, (data) => resolve(data));
        });
    };

    const enhanceItem = (itemId, reagentIds) => {
        if (!itemId || !reagentIds) return;
        const reagents = reagentIds.join(",");
        return new Promise((resolve) => {
            _g(`enhancement&action=progress&item=${itemId}&ingredients=${reagents}`, (data) => resolve(data));
        });
    };

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    initializeScript();
})();
