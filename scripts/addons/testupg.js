// ==UserScript==
// @name          Baddonz 2.0.5 - Ulepszator (UPG)
// @version       1.0
// @author        besiak (Aktualizacja pod baddonzAPI)
// @match         https://*.margonem.pl/
// @grant         none
// ==/UserScript==

(function () {
    'use strict';

    const MICC_BASE_URL = 'https://micc.garmory-cdn.cloud/obrazki/itemy/';

    // USTAWIENIA - wszystko oprócz wybranego itemu zapisujemy do konta
    const SETTINGS_KEY = "baddonz-settings-UPG";
    const DAILY_COUNT_KEY = "baddonz-daily-upgrade-count-UPG";
    const PROGRESS_STORAGE_KEY = "baddonz-enhancement-progress-UPG";
    const BAG_CHECK_INTERVAL = 5000;

    const DEFAULT_SETTINGS = {
        enabled: true,
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

    let settings = { ...DEFAULT_SETTINGS };
    let dailyUpgradeCount = 0;
    let dailyUpgradeLimit = 2000;
    let isUpgrading = false;

    const MAX_REAGENTS = 25;
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

    // --- FUNKCJE DANYCH I ZAPISU ---

    function loadSettings() {
        try {
            const storedSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY));
            settings = { ...DEFAULT_SETTINGS, ...storedSettings };
        } catch (e) {
            settings = { ...DEFAULT_SETTINGS };
        }
        const count = parseInt(localStorage.getItem(DAILY_COUNT_KEY));
        dailyUpgradeCount = !isNaN(count) ? count : 0;
    }

    function saveSettings() {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }

    // Wybrany item idzie DO POSTACI
    function getUpgradedItemId() {
        if (!window.Engine || !Engine.hero || !Engine.hero.d) return null;
        return window.localStorage.getItem(`upgrader-charId-${Engine.hero.d.id}`) || null;
    }

    function setUpgradedItemId(itemId) {
        if (!window.Engine || !Engine.hero || !Engine.hero.d) return;
        window.localStorage.setItem(`upgrader-charId-${Engine.hero.d.id}`, itemId);
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
        const currentItemId = getUpgradedItemId();
        if (currentItemId !== itemId) delete allProgress[itemId];

        localStorage.setItem(storageKey, JSON.stringify(allProgress));
    }

    // --- GENEROWANIE UI ---

    function generateItemTypeFiltersHtml() {
        const ITEM_CL_MAP = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 29];
        return ITEM_CL_MAP.map(cl => `
            <div class="baddonz-typ-wrapper" data-key="cl${cl}" data-cl="${cl}">
                <div class="baddonz-checkbox" id="baddonz-upgrader-cl-${cl}"></div>
                <div class="baddonz-type-icon cl-${cl}"></div>
            </div>
        `).join('');
    }

    const htmlTemplates = {
        main: `
            <div class="baddonz-window" id="wnd-ulepszara" data-addon="UPG" style="position: absolute; left: 100px; top: 100px;">
                <div class="baddonz-window-header baddonz-flex" style="justify-content: space-between;">
                    <div class="baddonz-window-controls left baddonz-flex" style="width: 70px;">
                        <div class="baddonz-icon baddonz-opacity-button"></div>
                        <div class="baddonz-icon baddonz-settings-button" id="baddonz-upgrader-main-settings-btn"></div>
                        <div class="baddonz-icon baddonz-state-button" id="baddonz-upgrader-state-button"></div>
                    </div>
                    <div class="baddonz-window-title" style="flex-grow: 1;">Ulepszara</div>
                    <div class="baddonz-window-controls right baddonz-flex" style="width: 50px;">
                       <div class="baddonz-icon baddonz-collapsed"></div>
                       <div class="baddonz-icon baddonz-close-button"></div>
                    </div>
                </div>
                <div class="baddonz-window-body baddonz-flex column" style="gap: 0; padding-bottom: 0;">
                    <div id="baddonz-upgrader-item-details" class="baddonz-flex column" style="display: block; border-bottom: 1px solid #303030; padding: 0 0 5px 0; align-items: center;">
                        <div id="baddonz-upgrader-item-display-container" class="baddonz-flex column" style="align-items: center; gap: 2px; margin-top: 5px; justify-content: center;">
                            <div id="baddonz-upgrader-item-slot-wrapper" class="baddonz-flex"></div>
                            <div class="baddonz-text" id="baddonz-upgrader-item-name" style="padding: 0; font-size: 11px; font-weight: bold; color: #ffcc00; text-shadow: 1px 1px #000;">Brak przedmiotu</div>
                            <div class="baddonz-text" id="baddonz-upgrader-item-progress" style="padding: 0; font-size: 10px; color: #aaa; text-shadow: 1px 1px #000;"></div>
                        </div>
                    </div>
                    <div class="baddonz-text baddonz-upgrader-daily-limit-wrapper" style="padding-top: 5px; margin-bottom: 0;">
                        <div id="baddonz-upgrader-daily-limit" class="baddonz-upgrader-daily-limit-single-line">0/2000</div>
                    </div>
                </div>
            </div>
        `,
        settings: `
            <div class="baddonz-window" id="wnd-ulepszara-settings" data-addon="UPG" style="position: absolute; left: 400px; top: 100px; display: none;">
                <div class="baddonz-window-header">
                    <div class="baddonz-window-controls left">
                        <div class="baddonz-icon baddonz-opacity-button"></div>
                    </div>
                    <div class="baddonz-window-title">Ulepszara - Ustawienia</div>
                    <div class="baddonz-window-controls right">
                        <div class="baddonz-icon baddonz-close-button" id="baddonz-upgrader-settings-close-btn"></div>
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
        `
    };

    // --- LOGIKA UI ---

    const updateItemDisplay = (itemId) => {
        if (typeof $ === 'undefined' || typeof Engine === 'undefined' || !Engine.items) return;
        const item = Engine.items.getItemById(itemId);
        const $slotWrapper = $('#baddonz-upgrader-item-slot-wrapper');
        const nameEl = document.getElementById("baddonz-upgrader-item-name");
        const progressEl = document.getElementById("baddonz-upgrader-item-progress");

        $slotWrapper.empty();
        nameEl.textContent = "";
        progressEl.textContent = "";

        const $slotContainer = $(`
            <div class="enhance__item enhance__item--current interface-element-one-item-slot-decor" id="baddonz-upgrader-main-item-slot">
                <div class="slot"></div><div class="lvl" data-lvl="0"><div class="cl-icon icon-star-0"></div></div>
            </div>
        `);

        if (!item) {
            nameEl.textContent = "Brak przedmiotu";
            $slotWrapper.append($slotContainer);
            return;
        }

        const upgradeLvl = item.upgrade_lvl || 0;
        $slotContainer.find('.lvl').attr('data-lvl', upgradeLvl).html(`<div class="cl-icon icon-star-${upgradeLvl}"></div>`);
        nameEl.textContent = item.name;

        const storedProgress = loadProgress(itemId);
        if (storedProgress) progressEl.textContent = `Progres: ${storedProgress}`;

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

        $clonedItem.append($('<img>').attr('src', imgUrl).attr('class', 'baddonz-upgrader-gif').css({ width: '32px', height: '32px', position: 'absolute', top: '0', left: '0', zIndex: '0' }));
        $slotContainer.find('.slot').append($clonedItem);
        $slotWrapper.append($slotContainer);
    };

    function updateUI() {
        const stateBtn = document.getElementById("baddonz-upgrader-state-button");
        if (stateBtn) {
            stateBtn.classList.toggle('baddonz-state-button--active', settings.enabled);
            if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
                $(stateBtn).tip(settings.enabled ? 'Wyłącz ulepszanie' : 'Włącz ulepszanie');
            }
        }

        updateItemDisplay(getUpgradedItemId());

        const dailyLimitEl = document.getElementById("baddonz-upgrader-daily-limit");
        if (dailyLimitEl) dailyLimitEl.textContent = `Dzienny Limit: ${dailyUpgradeCount}/${dailyUpgradeLimit}`;

        const settingsWnd = document.getElementById("wnd-ulepszara-settings");
        if (!settingsWnd) return;

        // Toggles
        ["hotkeyEnabled", "use_common", "use_unique", "allow_bound_items", "upgrade_endbattle", "bags_upgrade"].forEach(key => {
            const el = settingsWnd.querySelector(`#baddonz-upgrader-${key.replace(/_/g, '-').replace('Items', '').replace('Enabled', '-enabled').replace('bound-items', 'allow-bound').replace('endbattle', 'upgrade-endbattle-check').replace('bags-upgrade', 'bags-upgrade-check')}`);
            if(el) el.classList.toggle('active', settings[key]);
        });

        // Wartości inputów
        settingsWnd.querySelector("#baddonz-upgrader-count-endbattle-input").value = settings.count_endbattle;
        settingsWnd.querySelector("#baddonz-upgrader-count-bags-upgrade-input").value = settings.count_bags_upgrade;
        
        const hotkeyInput = settingsWnd.querySelector("#baddonz-upgrader-hotkey-input");
        if (document.activeElement !== hotkeyInput) {
            hotkeyInput.value = (settings.hotkeyKey === ' ' ? 'SPACJA' : settings.hotkeyKey.toUpperCase());
        }

        // Ukrywanie/Pokazywanie opcji
        document.getElementById("baddonz-upgrader-hotkey-options").style.display = settings.hotkeyEnabled ? 'flex' : 'none';
        document.getElementById("baddonz-upgrader-endbattle-options").style.display = settings.upgrade_endbattle ? 'flex' : 'none';
        document.getElementById("baddonz-upgrader-bags-options").style.display = settings.bags_upgrade ? 'flex' : 'none';

        // Typy itemów (checkboxy)
        const itemTypeFiltersContainer = document.getElementById("baddonz-upgrader-type-filters");
        if(itemTypeFiltersContainer) {
            itemTypeFiltersContainer.querySelectorAll('.baddonz-checkbox').forEach(cb => {
                const cl = cb.id.replace('baddonz-upgrader-cl-', '');
                cb.classList.toggle('active', settings[`cl${cl}`]);
            });
        }
    }

    function setupListeners() {
        const settingsBtn = document.getElementById("baddonz-upgrader-main-settings-btn");
        const settingsWnd = document.getElementById("wnd-ulepszara-settings");
        const stateBtn = document.getElementById("baddonz-upgrader-state-button");
        const closeSettingsBtn = document.getElementById("baddonz-upgrader-settings-close-btn");

        // Otwieranie dedykowanych ustawień dodatku
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                settingsWnd.style.display = settingsWnd.style.display === 'none' ? 'flex' : 'none';
            });
            if (typeof $ === 'function' && typeof $.fn.tip === 'function') $(settingsBtn).tip('Ustawienia Ulepszatora');
        }

        if (closeSettingsBtn) {
            closeSettingsBtn.addEventListener('click', () => { settingsWnd.style.display = 'none'; });
        }

        if (stateBtn) {
            stateBtn.addEventListener('click', () => {
                settings.enabled = !settings.enabled;
                saveSettings();
                updateUI();
            });
        }

        // Checkboxy główne
        const checkboxes = [
            { id: "baddonz-upgrader-hotkey-enabled", key: "hotkeyEnabled" },
            { id: "baddonz-upgrader-use-common", key: "use_common" },
            { id: "baddonz-upgrader-use-unique", key: "use_unique" },
            { id: "baddonz-upgrader-allow-bound", key: "allow_bound_items" },
            { id: "baddonz-upgrader-upgrade-endbattle-check", key: "upgrade_endbattle" },
            { id: "baddonz-upgrader-bags-upgrade-check", key: "bags_upgrade" },
        ];

        checkboxes.forEach(item => {
            const el = document.getElementById(item.id);
            if(el) {
                el.addEventListener('click', () => {
                    settings[item.key] = !settings[item.key];
                    saveSettings();
                    updateUI();
                });
            }
        });

        // Inputy liczbowe
        document.getElementById("baddonz-upgrader-count-endbattle-input").addEventListener('change', (e) => {
            settings.count_endbattle = Math.max(1, parseInt(e.target.value) || 1);
            saveSettings();
        });

        document.getElementById("baddonz-upgrader-count-bags-upgrade-input").addEventListener('change', (e) => {
            settings.count_bags_upgrade = Math.max(1, parseInt(e.target.value) || 1);
            saveSettings();
        });

        // Klawisz Hotkey
        const hotkeyInput = document.getElementById("baddonz-upgrader-hotkey-input");
        const handleHotkeySetting = (e) => {
            if (['Tab', 'Enter', 'Escape', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key) || (e.key.length > 1 && e.key !== ' ')) return;
            e.preventDefault(); e.stopPropagation();
            settings.hotkeyKey = e.key === ' ' ? ' ' : e.key.toLowerCase().slice(0, 1);
            hotkeyInput.blur();
            saveSettings();
            updateUI();
        };

        hotkeyInput.addEventListener('focus', () => hotkeyInput.addEventListener('keydown', handleHotkeySetting));
        hotkeyInput.addEventListener('blur', () => {
            hotkeyInput.removeEventListener('keydown', handleHotkeySetting);
            updateUI();
        });

        // Filtry typów
        document.querySelectorAll('.baddonz-typ-wrapper').forEach(wrapper => {
            const cl = parseInt(wrapper.getAttribute('data-cl'));
            if (typeof $ === 'function' && typeof $.fn.tip === 'function' && ITEM_CL_NAMES[cl]) {
                $(wrapper).tip(ITEM_CL_NAMES[cl]);
            }
            wrapper.addEventListener('click', () => {
                const key = wrapper.getAttribute('data-key');
                if (key) {
                    settings[key] = !settings[key];
                    saveSettings();
                    updateUI();
                }
            });
        });

        // Tooltipy informacyjne
        if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
            $("#baddonz-upgrader-allow-bound").tip('Używasz na własną odpowiedzialność! Uwaga na itemy z kolosów');
            $("#baddonz-upgrader-upgrade-endbattle-check").tip('Automatyczne ulepszanie po walce gdy mamy odpowiednią ilość składników');
            $("#baddonz-upgrader-count-bags-upgrade-input").tip('Ilość miejsc potrzebna do uruchomienia ulepszania z torby');
        }
    }

    // --- LOGIKA ULEPSZATORA ---

    function getReagents() {
        return Engine.items.fetchLocationItems("g").reduce((acc, item) => {
            if (!item) return acc;
            const cached = item._cachedStats || {};
            const rarity = cached.rarity || item.rarity;
            const enhancement_upgrade_lvl = cached.enhancement_upgrade_lvl !== undefined ? cached.enhancement_upgrade_lvl : (item.enhancement_upgrade_lvl ?? undefined);
            const isWorthless = Object.prototype.hasOwnProperty.call(cached, 'artisan_worthless') || Object.prototype.hasOwnProperty.call(item, 'artisan_worthless');
            const cursed_flag = cached.cursed !== undefined ? cached.cursed : (item.cursed !== undefined ? item.cursed : false);
            const itemLevel = item.lvl ?? item.level ?? cached.lvl ?? 0;
            const itemClass = item.cl;
            
            const isAllowedRarity = (settings.use_common && rarity === 'common') || (settings.use_unique && rarity === 'unique');
            const isAllowedType = ITEM_TYPE_SETTINGS_MAP[itemClass] ? settings[ITEM_TYPE_SETTINGS_MAP[itemClass]] : false;
            const isUpgraded = enhancement_upgrade_lvl !== undefined && enhancement_upgrade_lvl !== null;
            const isBound = (item.checkSoulbound && item.checkSoulbound()) || (item.checkPermbound && item.checkPermbound());

            let isPartOfBuild = false;
            try { if (typeof item.getBuildsWithThisItem === 'function' && item.getBuildsWithThisItem().length > 0) isPartOfBuild = true; } catch (e) {}

            if (itemLevel < 20 || cursed_flag || isWorthless) return acc;

            const isEventItem = (() => {
                if (!item.getTipContent) return false;
                const plainText = (item.getTipContent() || "").replace(/<[^>]+>/g, '');
                return EVENT_KEYWORDS.some(k => plainText.includes(k));
            })();

            if (isAllowedType && isAllowedRarity && !isEventItem && !isUpgraded && (settings.allow_bound_items || !isBound) && !isPartOfBuild) {
                acc.push(item.id);
            }
            return acc;
        }, []);
    }

    const chunkReagents = (reagents) => Array.from({ length: Math.ceil(reagents.length / MAX_REAGENTS) }, (v, i) => reagents.slice(i * MAX_REAGENTS, i * MAX_REAGENTS + MAX_REAGENTS));

    const checkDailyLimit = () => dailyUpgradeCount < dailyUpgradeLimit;

    function getEnhancementProgressText() {
        try {
            const el = Engine.crafting.window.wnd.$[0].querySelector('.enhance__progress-text--current');
            if (el) return el.textContent.trim();
        } catch (e) {}
        return "Brak danych";
    }

    let windowEnabled = false;
    const toggleEnhancementWindow = () => {
        if (windowEnabled) {
            Engine.crafting.window.wnd.$.removeClass("upgrader-crafting-window");
            Engine.interface.clickCrafting();
            windowEnabled = false;
        } else {
            Engine.crafting.window.wnd.$.addClass("upgrader-crafting-window");
            Engine.interface.clickCrafting();
            windowEnabled = true;
        }
    };

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
                updateUI();
                resolve({ current, max, isCompleted });
            }, 300);
        });
    });

    const setReagents = (itemId, reagentIds) => new Promise(res => _g(`enhancement&action=progress_preview&item=${itemId}&ingredients=${reagentIds.join(",")}`, res));
    const enhanceItem = (itemId, reagentIds) => new Promise(res => _g(`enhancement&action=progress&item=${itemId}&ingredients=${reagentIds.join(",")}`, res));

    const processChunks = async (upgradedItemId, chunks) => {
        for (const chunk of chunks) {
            if (!checkDailyLimit()) {
                message(`Przerwano ulepszanie. Limit ${dailyUpgradeLimit} osiągnięty.`);
                return true;
            }
            await setReagents(upgradedItemId, chunk);
            await enhanceItem(upgradedItemId, chunk);
            await sleep(200);
            const progressInfo = await setEnhancedItem(upgradedItemId);
            await sleep(100);
            if (progressInfo.isCompleted) {
                message(`Ulepszono! Progres: ${getEnhancementProgressText()}. (MAX)`);
                return true;
            }
            message(`Ulepszono! Progres: ${getEnhancementProgressText()}`);
            await sleep(300);
        }
        return false;
    };

    const getFreeSlots = () => {
        let slots = 0;
        if (Engine.bags && Array.isArray(Engine.bags)) {
            const bags = Engine.bags.length > 0 ? Engine.bags.slice(0, Engine.bags.length - 1) : Engine.bags;
            bags.forEach(bag => { if (Array.isArray(bag) && bag.length >= 2) slots += Math.max(0, bag[0] - bag[1]); });
        }
        return slots;
    };

    const handleBagCheck = async () => {
        if (!settings.enabled || !settings.bags_upgrade || !checkDailyLimit() || isUpgrading) return;
        const itemId = getUpgradedItemId();
        const item = Engine.items.getItemById(itemId);
        if (!item) return;

        const reagents = getReagents();
        const freeSlots = getFreeSlots();
        if (reagents.length >= 1 && freeSlots <= settings.count_bags_upgrade) {
            isUpgrading = true;
            message(`Wolne sloty: ${freeSlots}. Ulepszam! ${item.name}.`);
            try {
                toggleEnhancementWindow();
                const progressInfo = await setEnhancedItem(itemId);
                if (progressInfo.isCompleted) { message(`Maksymalny progres osiągnięty.`); return; }
                await processChunks(itemId, chunkReagents(reagents));
            } finally {
                toggleEnhancementWindow();
                isUpgrading = false;
            }
        }
    };

    const handleEndBattle = async () => {
        if (!settings.enabled || !settings.upgrade_endbattle || !checkDailyLimit() || isUpgrading) return;
        const itemId = getUpgradedItemId();
        const item = Engine.items.getItemById(itemId);
        if (!item) return;

        const reagents = getReagents();
        if (reagents.length < settings.count_endbattle) return;

        isUpgrading = true;
        message(`Ulepszam! ${item.name}.`);
        try {
            toggleEnhancementWindow();
            const progressInfo = await setEnhancedItem(itemId);
            if (progressInfo.isCompleted) { message(`Maksymalny progres osiągnięty.`); return; }
            await processChunks(itemId, chunkReagents(reagents));
        } finally {
            toggleEnhancementWindow();
            isUpgrading = false;
        }
    };

    // --- HOOKI I EVENTY ---
    const initItemContextMenu = () => {
        const ogShowPopupMenu = Engine.interface.showPopupMenu;
        Engine.interface.showPopupMenu = function (menu, e) {
            const match = e.currentTarget?.className?.match(/item-id-(\d+)/);
            const itemId = match ? match[1] : null;
            const item = Engine.items.getItemById(itemId);
            const currentSelected = getUpgradedItemId();

            if (!itemId || !ITEM_TYPE_SETTINGS_MAP.hasOwnProperty(item?.cl)) return ogShowPopupMenu.call(this, menu, e);

            let menuItem = itemId === currentSelected 
                ? ["Anuluj ulepszanie", () => { setUpgradedItemId(""); message(`Anulowano ulepszanie ${item.name}`); updateUI(); }, { button: { cls: "menu-item--red" } }]
                : ["Ulepsz ten przedmiot", async () => {
                    setUpgradedItemId(itemId);
                    message(`Wybrano do ulepszania: ${item.name}`);
                    toggleEnhancementWindow();
                    await setEnhancedItem(itemId);
                    toggleEnhancementWindow();
                }, { button: { cls: "menu-item--green" } }];

            ogShowPopupMenu.call(this, [menuItem, ...menu], e);
        };
    };

    const setupKeydownHandler = () => {
        window.document.addEventListener("keydown", async (event) => {
            if (event.key.toLowerCase() !== settings.hotkeyKey.toLowerCase() || ["TEXTAREA", "MAGIC_INPUT", "INPUT"].includes(document.activeElement.tagName)) return;
            if (isUpgrading) { event.preventDefault(); return; }

            if (settings.enabled && settings.hotkeyEnabled) {
                isUpgrading = true;
                try {
                    if (Engine.battle?.d?.id !== 0) { message("Nie można ręcznie ulepszać podczas walki."); return; }
                    if (!checkDailyLimit()) { message(`Osiągnięto limit ${dailyUpgradeLimit}.`); return; }

                    const itemId = getUpgradedItemId();
                    const item = Engine.items.getItemById(itemId);
                    if (!item) { message("Nie znaleziono wybranego przedmiotu."); return; }

                    const reagents = getReagents();
                    if (reagents.length === 0) { message("Brak składników."); return; }

                    event.preventDefault();
                    toggleEnhancementWindow();
                    const progressInfo = await setEnhancedItem(itemId);
                    if (progressInfo.isCompleted) {
                        message(`Ulepszanie zakończone. ${item.name} osiągnął MAX progres.`);
                    } else {
                        await processChunks(itemId, chunkReagents(reagents));
                    }
                    toggleEnhancementWindow();
                } finally {
                    isUpgrading = false;
                }
            }
        });
    };

    // --- BADDONZ API INTEGRATION & INIT ---
    
    const setupCSS = () => {
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
        `;
        document.head.insertAdjacentHTML("beforeend", `<style>${css}</style>`);
    };

    const UPG_Addon = {
        id: 'UPG',
        name: 'Ulepszator',
        init: function() {
            loadSettings();
            setupCSS();

            // Wstrzykujemy okna, główny skrypt baddonz API sam nada im właściwości draggable/opacity na podstawie klas ".baddonz-window"
            document.body.insertAdjacentHTML('beforeend', htmlTemplates.main + htmlTemplates.settings);

            setupListeners();
            setupKeydownHandler();
            initItemContextMenu();
            updateUI();

            // Hooki
            if (typeof Engine.battle.setEndBattle === 'function') {
                const og = Engine.battle.setEndBattle.bind(Engine.battle);
                Engine.battle.setEndBattle = function() { og(); handleEndBattle(); };
            }

            if (typeof Engine.communication.parseJSON === 'function') {
                const ogParse = Engine.communication.parseJSON;
                Engine.communication.parseJSON = function (data) {
                    if (data?.enhancement?.usages_preview?.count !== undefined) {
                        dailyUpgradeCount = data.enhancement.usages_preview.count;
                        dailyUpgradeLimit = data.enhancement.usages_preview.limit || dailyUpgradeLimit;
                        localStorage.setItem(DAILY_COUNT_KEY, dailyUpgradeCount);
                        updateUI();
                    }
                    return ogParse.call(this, data);
                };
            }

            setInterval(() => {
                if (settings.bags_upgrade && settings.enabled) handleBagCheck();
            }, BAG_CHECK_INTERVAL);
        }
    };

    // Rejestracja w ekosystemie baddonz
    const bootAddon = () => {
        if (!window.Engine?.allInit) { setTimeout(bootAddon, 500); return; }
        
        // Jeżeli baddonzAPI ma metodę registerAddon, korzystamy z niej, w przeciwnym razie inicjujemy ręcznie (stand-alone)
        if (window.baddonzAPI && typeof window.baddonzAPI.registerAddon === 'function') {
            window.baddonzAPI.registerAddon(UPG_Addon);
        } else {
            if (!window.baddonzAPI) window.baddonzAPI = { addons: {} };
            window.baddonzAPI.addons['UPG'] = UPG_Addon;
            UPG_Addon.init();
        }
    };

    bootAddon();
})();
