// ==UserScript==
// @name          Ulepszara
// @version       1.0
// @author        besiak
// @match         https://*.margonem.pl/
// @grant         none
// ==/UserScript==

(function () {
    'use strict';

    const ADDON_ID = 'UPG';
    const MICC_BASE_URL = 'https://micc.garmory-cdn.cloud/obrazki/itemy/';
    const SETTINGS_KEY_ACCOUNT = "baddonz-settings-upgrader-account";
    const SETTINGS_KEY_CHARACTER = "baddonz-settings-upgrader-character";
    const DAILY_COUNT_KEY = "baddonz-daily-upgrade-count";
    const PROGRESS_STORAGE_KEY = "baddonz-enhancement-progress-char";
    const VISIBILITY_CHECK_INTERVAL = 100;
    const BAG_CHECK_INTERVAL = 5000;
    const MAX_REAGENTS = 25;

    const DEFAULT_ACCOUNT_SETTINGS = {
        wnd_pos: { left: '0', top: '0' },
        wnd_opacity: 2,
        wnd_vsb: true,
        wnd_clp: false,
        wnd_settings_pos: { left: '0', top: '0' },
        wnd_settings_vsb: false,
        wnd_settings_opacity: 2,
        hotkeyKey: "j",
    };

    const DEFAULT_CHARACTER_SETTINGS = {
        enabled: true,
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

    let accountSettings = {};
    let charSettings = {};
    let settings = {};
    let dailyUpgradeCount = 0;
    let dailyUpgradeLimit = 2000;
    let isUpgrading = false;
    let windowEnabled = false;

    // Przechowywanie identyfikatorów interwałów i listenerów dla czyszczenia w stop()
    let activeIntervals = [];
    let originalParseJSON = null;
    let originalShowPopupMenu = null;
    let boundKeydownHandler = null;

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
        const upgradedItemId = getUpgradedItemId();
        if (!upgradedItemId || upgradedItemId !== itemId) delete allProgress[itemId];
        localStorage.setItem(storageKey, JSON.stringify(allProgress));
    }

    function loadDailyUpgradeCount() {
        const count = parseInt(localStorage.getItem(DAILY_COUNT_KEY));
        dailyUpgradeCount = !isNaN(count) ? count : 0;
    }

    function saveDailyUpgradeCount(count) {
        localStorage.setItem(DAILY_COUNT_KEY, count);
    }

    function setUpgradedItemId(itemId) {
        if (window.Engine?.hero?.d) {
            window.localStorage.setItem(`upgrader-charId-${window.Engine.hero.d.id}`, itemId);
        }
    }

    function getUpgradedItemId() {
        try { return window.localStorage.getItem(`upgrader-charId-${window.Engine.hero.d.id}`); } 
        catch (e) { return null; }
    }

    function loadSettings() {
        const charId = window.Engine?.hero?.d?.id;
        try {
            const storedAccSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY_ACCOUNT));
            accountSettings = { ...DEFAULT_ACCOUNT_SETTINGS, ...storedAccSettings };
        } catch (e) { accountSettings = { ...DEFAULT_ACCOUNT_SETTINGS }; }

        if (!charId) return;
        try {
            const storedCharSettings = JSON.parse(localStorage.getItem(`${SETTINGS_KEY_CHARACTER}-${charId}`));
            charSettings = { ...DEFAULT_CHARACTER_SETTINGS, ...storedCharSettings };
        } catch (e) { charSettings = { ...DEFAULT_CHARACTER_SETTINGS }; }

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
        const wnd = document.getElementById(windowId);
        if (!wnd) return;
        const opacityClasses = ['opacity-0', 'opacity-1', 'opacity-2', 'opacity-3', 'opacity-4'];
        const unified = localStorage.getItem('baddonz_unified_opacity_enabled') === 'true';

        wnd.classList.remove(...opacityClasses);
        if (unified) {
            const globalOp = parseInt(localStorage.getItem('baddonz_current_opacity') || '2');
            wnd.classList.add(opacityClasses[globalOp]);
        } else {
            wnd.classList.add(opacityClasses[accountSettings[opacityKey]]);
        }
    }

    function handleOpacityClick(windowId, opacityKey) {
        const wnd = document.getElementById(windowId);
        if (!wnd) return;
        const opacityClasses = ['opacity-0', 'opacity-1', 'opacity-2', 'opacity-3', 'opacity-4'];
        const unified = localStorage.getItem('baddonz_unified_opacity_enabled') === 'true';

        if (unified && window.setBaddonzGlobalOpacity) {
            let currentGlobal = parseInt(localStorage.getItem('baddonz_current_opacity') || '2');
            window.setBaddonzGlobalOpacity((currentGlobal + 1) % opacityClasses.length);
        } else {
            wnd.classList.remove(...opacityClasses);
            accountSettings[opacityKey] = (accountSettings[opacityKey] + 1) % opacityClasses.length;
            wnd.classList.add(opacityClasses[accountSettings[opacityKey]]);
            saveSettings('account');
        }
    }

    function syncVisibilityFromDOM() {
        const mainWnd = document.getElementById("wnd-ulepszara");
        const settingsWnd = document.getElementById("wnd-ulepszara-settings");
        let changed = false;

        if (mainWnd && mainWnd.style.display !== 'none' !== accountSettings.wnd_vsb) {
            accountSettings.wnd_vsb = mainWnd.style.display !== 'none';
            changed = true;
        }
        if (settingsWnd && settingsWnd.style.display !== 'none' !== accountSettings.wnd_settings_vsb) {
            accountSettings.wnd_settings_vsb = settingsWnd.style.display !== 'none';
            changed = true;
        }
        if (changed) saveSettings('account');
    }

    function setupDrag(windowId, posKey) {
        const wnd = document.getElementById(windowId);
        const titleBar = wnd?.querySelector(".baddonz-window-title");
        if (!titleBar) return;

        let isDragging = false, offsetX, offsetY;
        
        const onMouseDown = (e) => {
            isDragging = true;
            offsetX = e.clientX - wnd.getBoundingClientRect().left;
            offsetY = e.clientY - wnd.getBoundingClientRect().top;
            wnd.style.cursor = 'grabbing';
            e.preventDefault();
        };

        const onMouseMove = (e) => {
            if (!isDragging) return;
            let newX = e.clientX - offsetX;
            let newY = e.clientY - offsetY;
            newX = Math.max(0, Math.min(newX, window.innerWidth - wnd.offsetWidth));
            newY = Math.max(0, Math.min(newY, window.innerHeight - wnd.offsetHeight));
            wnd.style.left = `${newX}px`;
            wnd.style.top = `${newY}px`;
        };

        const onMouseUp = () => {
            if (isDragging) {
                isDragging = false;
                wnd.style.cursor = '';
                accountSettings[posKey].left = wnd.style.left;
                accountSettings[posKey].top = wnd.style.top;
                saveSettings('account');
            }
        };

        titleBar.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        // Zapis do ewentualnego czyszczenia w stop()
        wnd._baddonzDragListeners = { onMouseDown, onMouseMove, onMouseUp };
    }

    function generateItemTypeFiltersHtml() {
        const ITEM_CL_MAP = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 29];
        return ITEM_CL_MAP.map(cl => `
            <div class="baddonz-typ-wrapper" data-key="cl${cl}" data-cl="${cl}">
                <div class="baddonz-checkbox" id="baddonz-upgrader-cl-${cl}"></div>
                <div class="baddonz-type-icon cl-${cl}"></div>
            </div>
        `).join('');
    }

    function createUI() {
        if (document.getElementById("wnd-ulepszara")) return; // Zapobiegaj duplikacji

        const settings_wnd_html = `
            <div class="baddonz-window" id="wnd-ulepszara-settings" style="position: absolute; z-index: 500;">
                <div class="baddonz-window-header">
                    <div class="baddonz-window-controls left">
                        <div class="baddonz-icon baddonz-opacity-button" id="baddonz-upgrader-settings-opacity-btn"></div>
                    </div>
                    <div class="baddonz-window-title">Ulepszara - Ustawienia</div>
                    <div class="baddonz-window-controls right">
                        <div class="baddonz-icon baddonz-close-button" id="baddonz-upgrader-settings-close-button"></div>
                    </div>
                </div>
                <div class="baddonz-window-body baddonz-flex column" style="gap: 2px; width: 250px;">
                    <div style="border-bottom: 1px solid #303030; padding-top: 1px;"></div>
                    <div class="baddonz-label-wrapper"><div class="baddonz-checkbox" id="baddonz-upgrader-use-common"></div><div class="baddonz-text">Ulepszaj Zwyklakami</div></div>
                    <div class="baddonz-label-wrapper"><div class="baddonz-checkbox" id="baddonz-upgrader-use-unique"></div><div class="baddonz-text">Ulepszaj Unikatami</div></div>
                    <div class="baddonz-label-wrapper"><div class="baddonz-checkbox" id="baddonz-upgrader-allow-bound"></div><div class="baddonz-text">Ulepszaj Związanymi</div></div>
                    <div style="border-bottom: 1px solid #303030; padding-top: 1px;"></div>
                    <div class="baddonz-text" style="text-align: center; border-bottom: 1px solid #303030; padding-bottom: 2px;">Typy Itemów:</div>
                    <div id="baddonz-upgrader-type-filters" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; margin-left: 5px;">
                        ${generateItemTypeFiltersHtml()}
                    </div>
                    <div style="border-bottom: 1px solid #303030; padding-top: 1px;"></div>
                    <div class="baddonz-label-wrapper"><div class="baddonz-checkbox" id="baddonz-upgrader-hotkey-enabled"></div><div class="baddonz-text">Ulepszanie Klawiszem</div></div>
                    <div id="baddonz-upgrader-hotkey-options" class="baddonz-flex column" style="margin-left: 5px;">
                        <div class="baddonz-text" style="font-size: 10px; margin-bottom: 3px;">Klawisz:</div>
                        <input type="text" class="baddonz-input" id="baddonz-upgrader-hotkey-input" maxlength="7" style="width: 100%; text-transform: uppercase; text-align: center;">
                    </div>
                    <div class="baddonz-label-wrapper"><div class="baddonz-checkbox" id="baddonz-upgrader-upgrade-endbattle-check"></div><div class="baddonz-text">Ulepszaj po walce</div></div>
                    <div id="baddonz-upgrader-endbattle-options" class="baddonz-flex column" style="margin-left: 5px;">
                        <div class="baddonz-text" style="font-size: 10px; margin-bottom: 3px;">Min. Liczba Reagentów:</div>
                        <input type="number" class="baddonz-input" id="baddonz-upgrader-count-endbattle-input" min="1" max="50" style="width: 100%; text-align: center;">
                    </div>
                    <div class="baddonz-label-wrapper"><div class="baddonz-checkbox" id="baddonz-upgrader-bags-upgrade-check"></div><div class="baddonz-text">Ulepszanie po miejscach w torbie</div></div>
                    <div id="baddonz-upgrader-bags-options" class="baddonz-flex column" style="margin-left: 5px;">
                        <div class="baddonz-text" style="font-size: 10px; margin-bottom: 3px;">Max. Wolne Slotów:</div>
                        <input type="number" class="baddonz-input" id="baddonz-upgrader-count-bags-upgrade-input" min="1" max="100" style="width: 100%; text-align: center;">
                    </div>
                </div>
            </div>
        `;

        const main_wnd_html = `
            <div class="baddonz-window" id="wnd-ulepszara" style="position: absolute; z-index: 400;">
                <div class="baddonz-window-header baddonz-flex" style="justify-content: space-between;">
                    <div class="baddonz-window-controls left baddonz-flex" style="width: 70px;">
                        <div class="baddonz-icon baddonz-opacity-button" id="baddonz-upgrader-main-opacity-btn"></div>
                        <div class="baddonz-icon baddonz-settings-button" id="baddonz-upgrader-main-settings-btn"></div>
                        <div class="baddonz-icon baddonz-state-button" id="baddonz-upgrader-state-button"></div>
                    </div>
                    <div class="baddonz-window-title" style="flex-grow: 1;">Ulepszara</div>
                    <div class="baddonz-window-controls right baddonz-flex" style="width: 50px;">
                       <div class="baddonz-icon baddonz-collapsed" id="baddonz-upgrader-main-collapse-btn"></div>
                       <div class="baddonz-icon baddonz-close-button" id="baddonz-upgrader-main-close-button"></div>
                    </div>
                </div>
                <div class="baddonz-window-body baddonz-flex column" style="gap: 0; padding-bottom: 0;">
                    <div id="baddonz-upgrader-item-details" class="baddonz-flex column" style="display: block; border-bottom: 1px solid #303030; padding: 0 0 5px 0; align-items: center;">
                        <div id="baddonz-upgrader-item-display-container" class="baddonz-flex column" style="align-items: center; gap: 2px; margin-top: 5px; justify-content: center;">
                            <div id="baddonz-upgrader-item-slot-wrapper" class="baddonz-flex"></div>
                            <div class="baddonz-text" id="baddonz-upgrader-item-name" style="padding: 0; font-size: 11px; font-weight: bold; color: #ffcc00; text-shadow: 1px 1px #000;"></div>
                            <div class="baddonz-text" id="baddonz-upgrader-item-progress" style="padding: 0; font-size: 10px; color: #aaa; text-shadow: 1px 1px #000;"></div>
                        </div>
                    </div>
                    <div class="baddonz-text baddonz-upgrader-daily-limit-wrapper" style="padding-top: 5px; margin-bottom: 0;">
                        <div id="baddonz-upgrader-daily-limit" class="baddonz-upgrader-daily-limit-single-line">0/2000</div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', main_wnd_html + settings_wnd_html);

        const mainWnd = document.getElementById("wnd-ulepszara");
        const settingsWnd = document.getElementById("wnd-ulepszara-settings");

        mainWnd.style.left = accountSettings.wnd_pos.left;
        mainWnd.style.top = accountSettings.wnd_pos.top;
        mainWnd.style.display = accountSettings.wnd_vsb ? 'flex' : 'none';
        syncOpacity('wnd-ulepszara', 'wnd_opacity');

        settingsWnd.style.left = accountSettings.wnd_settings_pos.left;
        settingsWnd.style.top = accountSettings.wnd_settings_pos.top;
        settingsWnd.style.display = accountSettings.wnd_settings_vsb ? 'flex' : 'none';
        syncOpacity('wnd-ulepszara-settings', 'wnd_settings_opacity');

        updateUI();
        setupListeners();
    }

    const updateItemDisplay = (itemId) => {
        if (typeof $ === 'undefined' || typeof window.Engine === 'undefined' || !window.Engine.items) return;
        const item = window.Engine.items.getItemById(itemId);
        const $slotWrapper = $('#baddonz-upgrader-item-slot-wrapper');
        const nameEl = document.getElementById("baddonz-upgrader-item-name");
        const progressEl = document.getElementById("baddonz-upgrader-item-progress");

        if (!$slotWrapper.length) return;

        $slotWrapper.empty();
        if (nameEl) nameEl.textContent = "";
        if (progressEl) progressEl.textContent = "";

        const $slotContainer = $(
            `<div class="enhance__item enhance__item--current interface-element-one-item-slot-decor" id="baddonz-upgrader-main-item-slot">
                <div class="slot"></div>
                <div class="lvl" data-lvl="0"><div class="cl-icon icon-star-0"></div></div>
            </div>`
        );

        if (!item) {
            $slotWrapper.append($slotContainer);
            return;
        }

        const upgradeLvl = item.upgrade_lvl || 0;
        $slotContainer.find('.lvl').attr('data-lvl', upgradeLvl).html(`<div class="cl-icon icon-star-${upgradeLvl}"></div>`);
        if (nameEl) nameEl.textContent = item.name;

        const storedProgress = loadProgress(itemId);
        if (storedProgress && progressEl) progressEl.textContent = `Progres: ${storedProgress}`;

        const $clonedItem = item.$.clone();
        $clonedItem.addClass('baddonz-upgrader-item-cursor');
        $clonedItem.on('click', () => {
            setUpgradedItemId("");
            message(`Anulowano ulepszanie przedmiotu ${item.name}`);
            updateUI();
        });
        
        $clonedItem.css({ 'position': 'relative', 'width': '32px', 'height': '32px', 'top': '0', 'left': '0' });
        $clonedItem.find('canvas.icon, canvas.canvas-notice').remove();

        const iconSource = item.icon || (`${item.id}.png`);
        const imgUrl = MICC_BASE_URL + iconSource.replace(/\.[^/.]+$/, '.gif');
        const $img = $('<img>').attr('src', imgUrl).attr('class', 'baddonz-upgrader-gif').css({
            width: '32px', height: '32px', position: 'absolute', top: '0', left: '0', zIndex: '0'
        });

        $clonedItem.append($img);
        $slotContainer.find('.slot').append($clonedItem);
        $slotWrapper.append($slotContainer);
    };

    function updateUI() {
        const mainWnd = document.getElementById("wnd-ulepszara");
        if (!mainWnd) return;
        
        const stateBtn = document.getElementById("baddonz-upgrader-state-button");
        const collapseBtn = document.getElementById("baddonz-upgrader-main-collapse-btn");

        if (stateBtn) {
            stateBtn.classList.toggle('baddonz-state-button--active', settings.enabled);
            if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
                $(stateBtn).tip(settings.enabled ? 'Wyłącz' : 'Włącz');
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

        updateItemDisplay(getUpgradedItemId());

        const dailyLimitEl = document.getElementById("baddonz-upgrader-daily-limit");
        if (dailyLimitEl) {
            dailyLimitEl.textContent = `Dzienny Limit: ${dailyUpgradeCount}/${dailyUpgradeLimit}`;
            dailyLimitEl.classList.toggle('baddonz-upgrader-daily-limit-single-line--expanded', !accountSettings.wnd_clp);
        }

        if (typeof $ === 'function' && typeof $.fn.tip === 'function' && collapseBtn) {
            $(collapseBtn).tip(accountSettings.wnd_clp ? 'Rozwiń' : 'Zwiń');
        }

        const settingsWnd = document.getElementById("wnd-ulepszara-settings");
        if (!settingsWnd) return;

        const syncCheck = (id, key) => settingsWnd.querySelector(id)?.classList.toggle('active', settings[key]);
        syncCheck("#baddonz-upgrader-hotkey-enabled", 'hotkeyEnabled');
        syncCheck("#baddonz-upgrader-use-common", 'use_common');
        syncCheck("#baddonz-upgrader-use-unique", 'use_unique');
        syncCheck("#baddonz-upgrader-allow-bound", 'allow_bound_items');
        syncCheck("#baddonz-upgrader-upgrade-endbattle-check", 'upgrade_endbattle');
        syncCheck("#baddonz-upgrader-bags-upgrade-check", 'bags_upgrade');

        const inputEndbattle = settingsWnd.querySelector("#baddonz-upgrader-count-endbattle-input");
        if (inputEndbattle) inputEndbattle.value = settings.count_endbattle;

        const inputBags = settingsWnd.querySelector("#baddonz-upgrader-count-bags-upgrade-input");
        if (inputBags) inputBags.value = settings.count_bags_upgrade;

        const hotkeyInput = settingsWnd.querySelector("#baddonz-upgrader-hotkey-input");
        if (hotkeyInput && document.activeElement !== hotkeyInput) {
            hotkeyInput.value = accountSettings.hotkeyKey === ' ' ? 'SPACJA' : accountSettings.hotkeyKey.toUpperCase();
        }

        settingsWnd.querySelector("#baddonz-upgrader-hotkey-options").style.display = settings.hotkeyEnabled ? 'flex' : 'none';
        settingsWnd.querySelector("#baddonz-upgrader-endbattle-options").style.display = settings.upgrade_endbattle ? 'flex' : 'none';
        settingsWnd.querySelector("#baddonz-upgrader-bags-options").style.display = settings.bags_upgrade ? 'flex' : 'none';

        const filtersContainer = document.getElementById("baddonz-upgrader-type-filters");
        if(filtersContainer) {
            filtersContainer.querySelectorAll('.baddonz-checkbox').forEach(cb => {
                const cl = cb.id.replace('baddonz-upgrader-cl-', '');
                cb.classList.toggle('active', settings[`cl${cl}`]);
            });
        }
    }

    function setupListeners() {
        setupDrag("wnd-ulepszara", 'wnd_pos');
        setupDrag("wnd-ulepszara-settings", 'wnd_settings_pos');

        const collapseBtn = document.getElementById("baddonz-upgrader-main-collapse-btn");
        const settingsBtn = document.getElementById("baddonz-upgrader-main-settings-btn");
        const stateBtn = document.getElementById("baddonz-upgrader-state-button");
        const opacityBtnMain = document.getElementById("baddonz-upgrader-main-opacity-btn");
        const mainWnd = document.getElementById("wnd-ulepszara");
        const closeBtnMain = document.getElementById("baddonz-upgrader-main-close-button");
        const settingsWnd = document.getElementById("wnd-ulepszara-settings");
        const closeBtnSettings = document.getElementById("baddonz-upgrader-settings-close-button");
        const opacityBtnSettings = document.getElementById("baddonz-upgrader-settings-opacity-btn");

        if (collapseBtn) collapseBtn.addEventListener('click', () => {
            accountSettings.wnd_clp = !accountSettings.wnd_clp; saveSettings('account'); updateUI();
        });

        if (settingsBtn) settingsBtn.addEventListener('click', () => {
            accountSettings.wnd_settings_vsb = !accountSettings.wnd_settings_vsb;
            settingsWnd.style.display = accountSettings.wnd_settings_vsb ? 'flex' : 'none';
            syncOpacity('wnd-ulepszara-settings', 'wnd_settings_opacity');
            saveSettings('account');
        });

        if (opacityBtnMain) opacityBtnMain.addEventListener('click', () => handleOpacityClick('wnd-ulepszara', 'wnd_opacity'));
        if (opacityBtnSettings) opacityBtnSettings.addEventListener('click', () => handleOpacityClick('wnd-ulepszara-settings', 'wnd_settings_opacity'));

        if (stateBtn) stateBtn.addEventListener('click', () => {
            settings.enabled = !settings.enabled;
            if (window.BaddonzAPI && window.BaddonzAPI.syncState) window.BaddonzAPI.syncState(ADDON_ID, settings.enabled);
            saveSettings('character');
            updateUI();
        });

        if (closeBtnMain) closeBtnMain.addEventListener('click', () => {
            accountSettings.wnd_vsb = false; mainWnd.style.display = 'none'; saveSettings('account');
        });

        if (closeBtnSettings) closeBtnSettings.addEventListener('click', () => {
            accountSettings.wnd_settings_vsb = false; settingsWnd.style.display = 'none'; saveSettings('account');
        });

        const checks = [
            { id: "baddonz-upgrader-hotkey-enabled", key: "hotkeyEnabled" },
            { id: "baddonz-upgrader-use-common", key: "use_common" },
            { id: "baddonz-upgrader-use-unique", key: "use_unique" },
            { id: "baddonz-upgrader-allow-bound", key: "allow_bound_items" },
            { id: "baddonz-upgrader-upgrade-endbattle-check", key: "upgrade_endbattle" },
            { id: "baddonz-upgrader-bags-upgrade-check", key: "bags_upgrade" }
        ];

        checks.forEach(item => {
            const el = document.getElementById(item.id);
            if (el) el.addEventListener('click', () => {
                settings[item.key] = !settings[item.key]; saveSettings('character'); updateUI();
            });
        });

        const handleInput = (id, key) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => {
                settings[key] = Math.max(1, parseInt(el.value) || 1); el.value = settings[key]; saveSettings('character');
            });
        };
        handleInput("baddonz-upgrader-count-endbattle-input", "count_endbattle");
        handleInput("baddonz-upgrader-count-bags-upgrade-input", "count_bags_upgrade");

        const hotkeyInput = document.getElementById("baddonz-upgrader-hotkey-input");
        const handleHotkeySetting = (e) => {
            if (['Tab', 'Enter', 'Escape', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key) || (e.key.length > 1 && e.key !== ' ')) return;
            e.preventDefault(); e.stopPropagation();
            accountSettings.hotkeyKey = e.key === ' ' ? ' ' : e.key.toLowerCase().slice(0, 1);
            hotkeyInput.blur(); saveSettings('account'); updateUI();
        };

        if (hotkeyInput) {
            hotkeyInput.addEventListener('focus', () => {
                hotkeyInput.value = accountSettings.hotkeyKey === ' ' ? 'SPACJA' : accountSettings.hotkeyKey.toUpperCase();
                hotkeyInput.addEventListener('keydown', handleHotkeySetting);
            });
            hotkeyInput.addEventListener('blur', () => {
                hotkeyInput.removeEventListener('keydown', handleHotkeySetting); updateUI();
            });
        }

        const filtersContainer = document.getElementById("baddonz-upgrader-type-filters");
        if (typeof $ === 'function' && typeof $.fn.tip === 'function' && filtersContainer) {
            filtersContainer.querySelectorAll('.baddonz-typ-wrapper').forEach(wrapper => {
                const cl = parseInt(wrapper.getAttribute('data-cl'));
                if (cl && ITEM_CL_NAMES[cl]) $(wrapper).tip(ITEM_CL_NAMES[cl]);
                wrapper.addEventListener('click', () => {
                    const key = wrapper.getAttribute('data-key');
                    if (key) { settings[key] = !settings[key]; saveSettings('character'); updateUI(); }
                });
            });
            $(closeBtnMain).tip('Zamknij'); $(closeBtnSettings).tip('Zamknij');
            $(settingsBtn).tip('Ustawienia'); $(opacityBtnMain).tip('Zmień przezroczystość okienka');
            $(settingsWnd.querySelector("#baddonz-upgrader-allow-bound")).tip('Używasz na własną odpowiedzialność! Uwaga na itemy z kolosów');
            $(settingsWnd.querySelector("#baddonz-upgrader-upgrade-endbattle-check")).tip('Automatyczne ulepszanie po walce');
        }
    }

    const setupDOMAndListeners = () => {
        setupCSS();
        boundKeydownHandler = handleGlobalKeydown;
        window.document.addEventListener("keydown", boundKeydownHandler);
        initItemContextMenu();
    };

    const handleGlobalKeydown = async (event) => {
        const hotkey = accountSettings.hotkeyKey.toLowerCase();
        const isInputActive = ["TEXTAREA", "MAGIC_INPUT", "INPUT"].includes(document.activeElement.tagName);
        if (event.key.toLowerCase() !== hotkey || isInputActive) return;
        if (isUpgrading) { event.preventDefault(); return; }

        if (settings.enabled && settings.hotkeyEnabled) {
            isUpgrading = true;
            try {
                if (window.Engine.battle?.d?.id !== 0) { message("Nie można ręcznie ulepszać podczas walki."); return; }
                if (!checkDailyLimit()) { message(`Osiągnięto dzienny limit ${dailyUpgradeLimit} ulepszeń.`); return; }

                const upgradedItemId = getUpgradedItemId();
                const upgradedItem = window.Engine.items.getItemById(upgradedItemId);
                if (!upgradedItem) { message("Nie znaleziono wybranego przedmiotu."); return; }

                const reagents = getReagents();
                if (reagents.length === 0) { message("Nie znaleziono odpowiednich składników."); return; }

                event.preventDefault();
                toggleEnhancementWindow();
                const chunks = chunkReagents(reagents);
                const progressInfo = await setEnhancedItem(upgradedItemId);

                if (progressInfo.isCompleted) {
                    message(`Ulepszanie zakończone. ${upgradedItem.name} osiągnął MAX progres.`);
                    toggleEnhancementWindow(); return;
                }
                await processChunks(upgradedItemId, chunks);
                toggleEnhancementWindow();
            } finally {
                isUpgrading = false;
            }
        }
    };

    const initItemContextMenu = () => {
        if (!window.Engine.interface.showPopupMenu) return;
        originalShowPopupMenu = window.Engine.interface.showPopupMenu;
        window.Engine.interface.showPopupMenu = function (menu, e) {
            const itemId = getItemIdFromClassName(e.currentTarget?.className);
            const item = window.Engine.items.getItemById(itemId);
            const currentSelectedItemId = getUpgradedItemId();

            if (!itemId || !ITEM_TYPE_SETTINGS_MAP.hasOwnProperty(item?.cl)) {
                return originalShowPopupMenu.call(this, menu, e);
            }

            let menuItem = itemId === currentSelectedItemId 
                ? ["Anuluj ulepszanie", () => {
                    setUpgradedItemId(""); message(`Anulowano ulepszanie przedmiotu ${item.name}`); updateUI();
                }, { button: { cls: "menu-item--red" } }]
                : ["Ulepsz ten przedmiot", async () => {
                    setUpgradedItemId(itemId); message(`Ulepszanie przedmiotu ${item.name}`);
                    toggleEnhancementWindow(); await setEnhancedItem(itemId); toggleEnhancementWindow();
                }, { button: { cls: "menu-item--green" } }];

            originalShowPopupMenu.call(this, [menuItem, ...menu], e);
        };
    };

    const getItemIdFromClassName = (className) => {
        const match = className?.match(/item-id-(\d+)/);
        return match ? match[1] : null;
    };

    const toggleEnhancementWindow = () => {
        if (windowEnabled) {
            window.Engine.crafting.window.wnd.$.removeClass("upgrader-crafting-window");
            window.Engine.interface.clickCrafting();
            windowEnabled = false;
        } else {
            window.Engine.crafting.window.wnd.$.addClass("upgrader-crafting-window");
            window.Engine.interface.clickCrafting();
            windowEnabled = true;
        }
    };

    const getReagents = () => {
        return window.Engine.items.fetchLocationItems("g").reduce((acc, item) => {
            if (!item) return acc;
            const cached = item._cachedStats || {};
            const rarity = cached.rarity || item.rarity;
            const enhancement_upgrade_lvl = cached.enhancement_upgrade_lvl ?? item.enhancement_upgrade_lvl ?? undefined;
            const isWorthless = (Object.prototype.hasOwnProperty.call(cached, 'artisan_worthless') || Object.prototype.hasOwnProperty.call(item, 'artisan_worthless'));
            const cursed_flag = cached.cursed ?? item.cursed ?? false;
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

            if (isAllowedType && isAllowedRarity && !isEventItem(item) && !isUpgraded && !isWorthless && (settings.allow_bound_items || !isBound) && !isPartOfBuild) {
                acc.push(item.id);
            }
            return acc;
        }, []);
    };

    const isEventItem = (item) => {
        if (!item?.getTipContent) return false;
        const plainText = item.getTipContent().replace(/<[^>]+>/g, '');
        return EVENT_KEYWORDS.some(keyword => plainText.includes(keyword));
    };

    const checkDailyLimit = () => dailyUpgradeCount < dailyUpgradeLimit;
    const chunkReagents = (reagents) => {
        const chunks = [];
        for (let i = 0; i < reagents.length; i += MAX_REAGENTS) chunks.push(reagents.slice(i, i + MAX_REAGENTS));
        return chunks;
    };

    const getFreeSlots = () => {
        let totalFreeSlots = 0;
        if (window.Engine?.bags && Array.isArray(window.Engine.bags)) {
            const bagsToCount = window.Engine.bags.length > 0 ? window.Engine.bags.slice(0, window.Engine.bags.length - 1) : window.Engine.bags;
            bagsToCount.forEach(bag => {
                if (Array.isArray(bag) && bag.length >= 2) totalFreeSlots += Math.max(0, bag[0] - bag[1]);
            });
        }
        return totalFreeSlots;
    };

    function getEnhancementProgressText() {
        try {
            const currentProgressTextEl = window.Engine.crafting.window.wnd.$[0].querySelector('.enhance__progress-text--current');
            if (currentProgressTextEl) return currentProgressTextEl.textContent.trim();
        } catch (e) {}
        return "Brak danych";
    }

    const processChunks = async (upgradedItemId, chunks) => {
        for (const chunk of chunks) {
            if (!checkDailyLimit()) { message(`Przerwano ulepszanie. Limit ${dailyUpgradeLimit} osiągnięty.`); return true; }
            await setReagents(upgradedItemId, chunk);
            await enhanceItem(upgradedItemId, chunk);
            await sleep(200);

            const progressInfo = await setEnhancedItem(upgradedItemId);
            await sleep(100);

            const progressText = getEnhancementProgressText();
            if (progressInfo.isCompleted) { message(`Ulepszono! Progres: ${progressText}. (MAX)`); return true; }
            message(`Ulepszono! Progres: ${progressText}`);
            await sleep(300);
        }
        return false;
    }

    const setEnhancedItem = (itemId) => new Promise((resolve) => {
        _g(`enhancement&action=status&item=${itemId}`, (data) => {
            let current = 0, max = 0, isCompleted = false;
            if (data?.enhancement?.progress) {
                current = data.enhancement.progress.current;
                max = data.enhancement.progress.max;
                if (current > 0 && current === max) isCompleted = true;
            }
            setTimeout(() => {
                const progressText = getEnhancementProgressText();
                if (progressText !== "Brak danych") saveProgress(itemId, progressText);
                else if (isCompleted) saveProgress(itemId, `${max}/${max}`);
                updateUI(); resolve({ current, max, isCompleted });
            }, 300);
        });
    });

    const setReagents = (itemId, reagentIds) => new Promise((resolve) => _g(`enhancement&action=progress_preview&item=${itemId}&ingredients=${reagentIds.join(",")}`, resolve));
    const enhanceItem = (itemId, reagentIds) => {
        if (!itemId || !reagentIds) return;
        return new Promise((resolve) => _g(`enhancement&action=progress&item=${itemId}&ingredients=${reagentIds.join(",")}`, resolve));
    };

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const handleBagCheck = async () => {
        if (!settings.enabled || !settings.bags_upgrade || !checkDailyLimit() || isUpgrading) return;
        const upgradedItemId = getUpgradedItemId();
        const upgradedItem = window.Engine.items.getItemById(upgradedItemId);
        if (!upgradedItem) return;

        const reagents = getReagents();
        const freeSlots = getFreeSlots();
        if (reagents.length >= 1 && freeSlots <= settings.count_bags_upgrade) {
            isUpgrading = true;
            message(`Wolne sloty: ${freeSlots}. Ulepszam! ${upgradedItem.name}.`);
            try {
                toggleEnhancementWindow();
                const progressInfo = await setEnhancedItem(upgradedItemId);
                if (progressInfo.isCompleted) { message(`Maksymalny progres osiągnięty.`); return; }
                await processChunks(upgradedItemId, chunkReagents(reagents));
            } finally { toggleEnhancementWindow(); isUpgrading = false; }
        }
    };

    const handleEndBattle = async () => {
        if (!settings.enabled || !settings.upgrade_endbattle || !checkDailyLimit() || isUpgrading) return;
        const upgradedItemId = getUpgradedItemId();
        const upgradedItem = window.Engine.items.getItemById(upgradedItemId);
        if (!upgradedItem) return;

        const reagents = getReagents();
        if (reagents.length < settings.count_endbattle) return;

        isUpgrading = true;
        message(`Ulepszam! ${upgradedItem.name}.`);
        try {
            toggleEnhancementWindow();
            const progressInfo = await setEnhancedItem(upgradedItemId);
            if (progressInfo.isCompleted) { message(`Maksymalny progres osiągnięty.`); return; }
            await processChunks(upgradedItemId, chunkReagents(reagents));
        } finally { toggleEnhancementWindow(); isUpgrading = false; }
    };

    const setupCSS = () => {
        if (document.getElementById('baddonz-upgrader-css')) return;
        const css = `
            .upgrader-crafting-window { display: none !important; }
            .menu-item--yellow { background:rgb(57, 100, 17) !important; color: #fff !important; border-radius: 5px !important; padding: 5px !important; }
            #wnd-ulepszara.wnd-ulepszara-collapsed { height: auto !important; }
            #wnd-ulepszara .baddonz-window-title { text-align: center; }
            #wnd-ulepszara-settings .baddonz-window-body { gap: 2px !important; }
            #baddonz-upgrader-type-filters { gap: 2px !important; }
            .baddonz-label-wrapper { justify-content: flex-start !important; gap: 5px; }
            .baddonz-typ-wrapper { display: flex; align-items: center; justify-content: center; cursor: url("https://gordion.margonem.pl/img/gui/cursor/5n.png") 4 0, pointer; gap: 3px; padding: 3px; background: rgba(0, 0, 0, 0.3); border-radius: 3px; user-select: none; }
            .baddonz-typ-wrapper:hover { background: rgba(255, 255, 255, 0.1); }
            #baddonz-upgrader-hotkey-input { font-weight: bold; }
            .baddonz-upgrader-item-cursor { cursor: url("https://gordion.margonem.pl/img/gui/cursor/1n.png") 4 0, pointer !important; }
            #baddonz-upgrader-main-item-slot { margin: 0; }
            .baddonz-upgrader-daily-limit-wrapper { text-align: center; padding: 0; margin-top: 0; display: block; gap: 0; }
            .baddonz-upgrader-daily-limit-single-line { font-size: 11px; color: #fff; font-weight: normal; padding: 0; margin: 0; display: block; }
            .baddonz-upgrader-daily-limit-single-line--expanded { font-size: 9px !important; }
            #baddonz-upgrader-main-close-button { position: relative; top: -1px; }
        `;
        const style = document.createElement("style");
        style.id = 'baddonz-upgrader-css';
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
    };

    // --- BADDONZ MODULE LIFECYCLE ---

    const init = () => {
        loadSettings();
        createUI();
        setupDOMAndListeners();

        activeIntervals.push(setInterval(syncVisibilityFromDOM, VISIBILITY_CHECK_INTERVAL));

        if (window.Engine.communication && typeof window.Engine.communication.parseJSON === 'function') {
            originalParseJSON = window.Engine.communication.parseJSON;
            window.Engine.communication.parseJSON = function (data) {
                if (data?.enhancement?.usages_preview?.count !== undefined) {
                    dailyUpgradeCount = data.enhancement.usages_preview.count;
                    dailyUpgradeLimit = data.enhancement.usages_preview.limit || dailyUpgradeLimit;
                    saveDailyUpgradeCount(dailyUpgradeCount);
                    updateUI();
                }
                return originalParseJSON.call(this, data);
            };
        }

        if (typeof window.Engine.battle.setEndBattle === 'function') {
            const originalSetEndBattle = window.Engine.battle.setEndBattle.bind(window.Engine.battle);
            window.Engine.battle.setEndBattle = function() {
                originalSetEndBattle();
                handleEndBattle();
            };
        }

        activeIntervals.push(setInterval(() => {
            if (settings.bags_upgrade && settings.enabled) handleBagCheck();
        }, BAG_CHECK_INTERVAL));
    };

    const stop = () => {
        // Czyszczenie interwałów
        activeIntervals.forEach(clearInterval);
        activeIntervals = [];

        // Przywracanie oryginalnych funkcji silnika
        if (originalParseJSON) window.Engine.communication.parseJSON = originalParseJSON;
        if (originalShowPopupMenu) window.Engine.interface.showPopupMenu = originalShowPopupMenu;

        // Odpinanie eventów
        if (boundKeydownHandler) window.document.removeEventListener("keydown", boundKeydownHandler);

        // Usuwanie elementów DOM
        document.getElementById("wnd-ulepszara")?.remove();
        document.getElementById("wnd-ulepszara-settings")?.remove();
        document.getElementById("baddonz-upgrader-css")?.remove();
    };

    const onStateToggle = (isEnabled) => {
        settings.enabled = isEnabled;
        saveSettings('character');
        updateUI();
    };

    // Pętla nasłuchująca na gotowość API Baddonza
    const checkApi = () => {
        if (typeof window.BaddonzAPI !== 'undefined' && window.Engine && window.Engine.allInit) {
            window.BaddonzAPI.registerAddon(ADDON_ID, { init, stop, onStateToggle });
        } else {
            setTimeout(checkApi, 500);
        }
    };

    checkApi();
})();
