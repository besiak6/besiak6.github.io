// ==UserScript==
// @name          Baddonz 2.0.5 - Ulepszator (UPG)
// @version       1.0.0
// @author        besiak (Update & Refactor)
// @match         https://*.margonem.pl/
// @grant         none
// ==/UserScript==

(function () {
    'use strict';

    const ADDON_ID = 'UPG';
    const MICC_BASE_URL = 'https://micc.garmory-cdn.cloud/obrazki/itemy/';

    // Klucze zapisu
    const SETTINGS_KEY_ACCOUNT = `baddonz-settings-${ADDON_ID}-account`;
    const PROGRESS_STORAGE_KEY = `baddonz-enhancement-progress-${ADDON_ID}`;
    
    // Ustawienia globalne (na konto)
    const DEFAULT_ACCOUNT_SETTINGS = {
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

    let settings = {};
    let dailyUpgradeCount = 0;
    let dailyUpgradeLimit = 2000;
    let isUpgrading = false;
    let windowEnabled = false;

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

    // ==========================================
    // ZARZĄDZANIE DANYMI (KONTO I POSTAĆ)
    // ==========================================
    function loadSettings() {
        try {
            const storedSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY_ACCOUNT));
            settings = { ...DEFAULT_ACCOUNT_SETTINGS, ...storedSettings };
        } catch (e) {
            settings = { ...DEFAULT_ACCOUNT_SETTINGS };
        }
    }

    function saveSettings() {
        localStorage.setItem(SETTINGS_KEY_ACCOUNT, JSON.stringify(settings));
    }

    function setUpgradedItemId(itemId) {
        if (!window.Engine || !Engine.hero || !Engine.hero.d) return;
        const charId = Engine.hero.d.id;
        window.localStorage.setItem(`baddonz-${ADDON_ID}-item-${charId}`, itemId);
    }

    function getUpgradedItemId() {
        try {
            if (!window.Engine || !Engine.hero || !Engine.hero.d) return null;
            const charId = Engine.hero.d.id;
            return window.localStorage.getItem(`baddonz-${ADDON_ID}-item-${charId}`);
        } catch (e) { return null; }
    }

    function saveProgress(itemId, progressText) {
        const charId = window.Engine?.hero?.d?.id;
        if (!itemId || !progressText || progressText === "Brak danych" || !charId) return;

        const storageKey = `${PROGRESS_STORAGE_KEY}-${charId}`;
        let allProgress = {};
        try { allProgress = JSON.parse(localStorage.getItem(storageKey)) || {}; } catch (e) {}

        allProgress[itemId] = progressText;

        const currentUpgradedItemId = getUpgradedItemId();
        if (currentUpgradedItemId !== itemId) delete allProgress[itemId];

        localStorage.setItem(storageKey, JSON.stringify(allProgress));
    }

    function loadProgress(itemId) {
        const charId = window.Engine?.hero?.d?.id;
        if (!charId) return null;
        try {
            const allProgress = JSON.parse(localStorage.getItem(`${PROGRESS_STORAGE_KEY}-${charId}`)) || {};
            return allProgress[itemId] || null;
        } catch (e) { return null; }
    }

    // ==========================================
    // LOGIKA ULEPSZANIA
    // ==========================================
    const checkDailyLimit = () => dailyUpgradeCount < dailyUpgradeLimit;

    function isEventItem(item) {
        if (!item || !item.getTipContent) return false;
        const tip = item.getTipContent();
        if (!tip) return false;
        return EVENT_KEYWORDS.some(keyword => tip.replace(/<[^>]+>/g, '').includes(keyword));
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

    const getReagents = () => {
        return Engine.items.fetchLocationItems("g").reduce((acc, item) => {
            if (!item) return acc;
            const cached = item._cachedStats || {};
            const rarity = cached.rarity || item.rarity;
            const enhancement_lvl = cached.enhancement_upgrade_lvl ?? item.enhancement_upgrade_lvl;
            const isWorthless = ('artisan_worthless' in cached) || ('artisan_worthless' in item);
            const cursed_flag = cached.cursed ?? item.cursed ?? false;
            const itemLevel = item.lvl ?? item.level ?? cached.lvl ?? 0;
            const itemClass = item.cl;
            
            const isAllowedRarity = (settings.use_common && rarity === 'common') || (settings.use_unique && rarity === 'unique');
            const isAllowedType = ITEM_TYPE_SETTINGS_MAP[itemClass] ? settings[ITEM_TYPE_SETTINGS_MAP[itemClass]] : false;
            const isUpgraded = enhancement_lvl !== undefined && enhancement_lvl !== null;
            const isBound = (item.checkSoulbound && item.checkSoulbound()) || (item.checkPermbound && item.checkPermbound());

            let isPartOfBuild = false;
            try {
                if (typeof item.getBuildsWithThisItem === 'function') {
                    const builds = item.getBuildsWithThisItem();
                    if (builds && builds.length > 0) isPartOfBuild = true;
                }
            } catch (e) {}

            if (itemLevel < 20 || cursed_flag || isWorthless || isEventItem(item) || isUpgraded || isPartOfBuild) return acc;
            if (isAllowedType && isAllowedRarity && (settings.allow_bound_items || !isBound)) {
                acc.push(item.id);
            }
            return acc;
        }, []);
    };

    function getEnhancementProgressText() {
        try {
            const el = Engine.crafting.window.wnd.$[0].querySelector('.enhance__progress-text--current');
            return el ? el.textContent.trim() : "Brak danych";
        } catch (e) { return "Brak danych"; }
    }

    const setEnhancedItem = (itemId) => {
        return new Promise((resolve) => {
            _g(`enhancement&action=status&item=${itemId}`, (data) => {
                let current = 0, max = 0, isCompleted = false;
                if (data?.enhancement?.progress) {
                    current = data.enhancement.progress.current;
                    max = data.enhancement.progress.max;
                    isCompleted = (current > 0 && current === max);
                }
                setTimeout(() => {
                    const progressText = getEnhancementProgressText();
                    if (progressText !== "Brak danych") {
                        saveProgress(itemId, progressText);
                    } else if (isCompleted) {
                        saveProgress(itemId, `${max}/${max}`);
                    }
                    if (window.baddonzAPI) updateUI();
                    resolve({ current, max, isCompleted });
                }, 300);
            });
        });
    };

    const processChunks = async (upgradedItemId, chunks) => {
        for (const chunk of chunks) {
            if (!checkDailyLimit()) {
                message(`Przerwano ulepszanie. Limit ${dailyUpgradeLimit} osiągnięty.`);
                return true;
            }
            await new Promise(r => _g(`enhancement&action=progress_preview&item=${upgradedItemId}&ingredients=${chunk.join(",")}`, r));
            await new Promise(r => _g(`enhancement&action=progress&item=${upgradedItemId}&ingredients=${chunk.join(",")}`, r));
            await sleep(200);

            const progressInfo = await setEnhancedItem(upgradedItemId);
            await sleep(100);

            if (progressInfo.isCompleted) {
                message(`Ulepszono! Progres: MAX`);
                return true;
            }
        }
        return false;
    }

    const runUpgradeCycle = async (reasonContext) => {
        if (!settings.enabled || isUpgrading || !checkDailyLimit()) return;
        const upgradedItemId = getUpgradedItemId();
        const upgradedItem = Engine.items.getItemById(upgradedItemId);
        if (!upgradedItem) return;

        const reagents = getReagents();
        if (reagents.length === 0) return;

        // Filtry uruchomienia
        if (reasonContext === 'bag' && getFreeSlots() > settings.count_bags_upgrade) return;
        if (reasonContext === 'battle' && reagents.length < settings.count_endbattle) return;

        isUpgrading = true;
        message(`Ulepszam: ${upgradedItem.name}`);

        try {
            toggleEnhancementWindow();
            const progressInfo = await setEnhancedItem(upgradedItemId);
            if (progressInfo.isCompleted) {
                message(`Osiągnięto maksymalny poziom ulepszenia.`);
                return;
            }
            
            const chunks = [];
            for (let i = 0; i < reagents.length; i += MAX_REAGENTS) chunks.push(reagents.slice(i, i + MAX_REAGENTS));
            
            await processChunks(upgradedItemId, chunks);
        } finally {
            toggleEnhancementWindow();
            isUpgrading = false;
        }
    };

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

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // ==========================================
    // INTERFEJS I BADDONZ API
    // ==========================================
    function generateItemTypeFiltersHtml() {
        return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 29].map(cl => `
            <div class="baddonz-typ-wrapper" data-key="cl${cl}" data-cl="${cl}" title="${ITEM_CL_NAMES[cl] || ''}">
                <div class="baddonz-checkbox" id="upg-cl-${cl}"></div>
                <div class="baddonz-type-icon cl-${cl}"></div>
            </div>
        `).join('');
    }

    const MAIN_HTML = `
        <div class="baddonz-flex column upg-main-container">
            <div class="baddonz-flex upg-state-header">
                <div class="baddonz-checkbox" id="upg-toggle-enabled"></div>
                <span style="font-size:12px; font-weight:bold;">Moduł Aktywny</span>
            </div>
            <div id="upg-item-details" class="baddonz-flex column upg-item-box">
                <div id="upg-item-slot-wrapper" class="baddonz-flex">Wybierz przedmiot PPM</div>
                <div class="baddonz-text upg-item-name" id="upg-item-name"></div>
                <div class="baddonz-text upg-item-progress" id="upg-item-progress"></div>
            </div>
            <div class="baddonz-text upg-daily-limit">
                Limit Dzienny: <span id="upg-daily-limit-text">0/2000</span>
            </div>
        </div>
    `;

    const SETTINGS_HTML = `
        <div class="baddonz-flex column" style="gap: 4px; padding: 5px;">
            <div class="baddonz-label-wrapper"><div class="baddonz-checkbox" id="upg-use-common"></div><div class="baddonz-text">Zwykłe</div></div>
            <div class="baddonz-label-wrapper"><div class="baddonz-checkbox" id="upg-use-unique"></div><div class="baddonz-text">Unikaty</div></div>
            <div class="baddonz-label-wrapper"><div class="baddonz-checkbox" id="upg-allow-bound"></div><div class="baddonz-text" style="color:#ff5555;">Związane (Uwaga)</div></div>
            <hr class="baddonz-hr"/>
            <div class="baddonz-text" style="text-align: center; font-size:11px;">Typy Przedmiotów</div>
            <div class="upg-grid-types">${generateItemTypeFiltersHtml()}</div>
            <hr class="baddonz-hr"/>
            <div class="baddonz-label-wrapper"><div class="baddonz-checkbox" id="upg-hotkey-enabled"></div><div class="baddonz-text">Klawisz ulepszania:</div>
                <input type="text" class="baddonz-input upg-small-input" id="upg-hotkey-input" maxlength="7">
            </div>
            <hr class="baddonz-hr"/>
            <div class="baddonz-label-wrapper"><div class="baddonz-checkbox" id="upg-upgrade-endbattle"></div><div class="baddonz-text">Po walce (min. itemów):</div>
                <input type="number" class="baddonz-input upg-small-input" id="upg-count-endbattle-input" min="1" max="50">
            </div>
            <div class="baddonz-label-wrapper"><div class="baddonz-checkbox" id="upg-bags-upgrade"></div><div class="baddonz-text">Gdy mało miejsca (max wolnych):</div>
                <input type="number" class="baddonz-input upg-small-input" id="upg-count-bags-input" min="1" max="100">
            </div>
        </div>
    `;

    function updateUI() {
        // Aktualizacja stanu UI oparta o HTML modułu
        const $e = (id) => document.getElementById(id);
        if (!$e('upg-toggle-enabled')) return;

        $e('upg-toggle-enabled').classList.toggle('active', settings.enabled);
        $e('upg-daily-limit-text').textContent = `${dailyUpgradeCount}/${dailyUpgradeLimit}`;
        
        $e('upg-use-common').classList.toggle('active', settings.use_common);
        $e('upg-use-unique').classList.toggle('active', settings.use_unique);
        $e('upg-allow-bound').classList.toggle('active', settings.allow_bound_items);
        $e('upg-hotkey-enabled').classList.toggle('active', settings.hotkeyEnabled);
        $e('upg-upgrade-endbattle').classList.toggle('active', settings.upgrade_endbattle);
        $e('upg-bags-upgrade').classList.toggle('active', settings.bags_upgrade);

        $e('upg-hotkey-input').value = settings.hotkeyKey === ' ' ? 'SPACJA' : settings.hotkeyKey.toUpperCase();
        $e('upg-count-endbattle-input').value = settings.count_endbattle;
        $e('upg-count-bags-input').value = settings.count_bags_upgrade;

        document.querySelectorAll('.upg-grid-types .baddonz-typ-wrapper').forEach(wrapper => {
            const key = wrapper.getAttribute('data-key');
            wrapper.querySelector('.baddonz-checkbox').classList.toggle('active', settings[key]);
        });

        // Odświeżanie głównego slota
        refreshItemSlot();
    }

    function refreshItemSlot() {
        const itemId = getUpgradedItemId();
        const wrapper = document.getElementById('upg-item-slot-wrapper');
        const nameEl = document.getElementById('upg-item-name');
        const progEl = document.getElementById('upg-item-progress');
        if (!wrapper) return;

        wrapper.innerHTML = '';
        if (!itemId || !Engine.items.getItemById(itemId)) {
            nameEl.textContent = 'Brak przedmiotu';
            progEl.textContent = '';
            return;
        }

        const item = Engine.items.getItemById(itemId);
        nameEl.textContent = item.name;
        progEl.textContent = `Progres: ${loadProgress(itemId) || '?'}`;

        const $slot = $(`
            <div class="enhance__item interface-element-one-item-slot-decor">
                <div class="slot"></div>
                <div class="lvl" data-lvl="${item.upgrade_lvl || 0}"><div class="cl-icon icon-star-${item.upgrade_lvl || 0}"></div></div>
            </div>
        `);

        const $cloned = item.$.clone().css({ position: 'relative', width: '32px', height: '32px' }).addClass('upg-pointer');
        $cloned.find('canvas').remove();
        
        const gifName = (item.icon || `${item.id}.png`).replace(/\.[^/.]+$/, '.gif');
        $cloned.append($('<img>').attr('src', MICC_BASE_URL + gifName).css({ width: '32px', height: '32px', position: 'absolute', top: 0, left: 0 }));

        $cloned.on('click', () => {
            setUpgradedItemId("");
            message("Anulowano ulepszanie.");
            updateUI();
        });

        $slot.find('.slot').append($cloned);
        wrapper.appendChild($slot[0]);
    }

    function bindUIEvents() {
        const toggleSetting = (id, key) => {
            const el = document.getElementById(id);
            if(el) el.addEventListener('click', () => { settings[key] = !settings[key]; saveSettings(); updateUI(); });
        };

        toggleSetting('upg-toggle-enabled', 'enabled');
        toggleSetting('upg-use-common', 'use_common');
        toggleSetting('upg-use-unique', 'use_unique');
        toggleSetting('upg-allow-bound', 'allow_bound_items');
        toggleSetting('upg-hotkey-enabled', 'hotkeyEnabled');
        toggleSetting('upg-upgrade-endbattle', 'upgrade_endbattle');
        toggleSetting('upg-bags-upgrade', 'bags_upgrade');

        document.querySelectorAll('.upg-grid-types .baddonz-typ-wrapper').forEach(wrapper => {
            wrapper.addEventListener('click', () => {
                const key = wrapper.getAttribute('data-key');
                settings[key] = !settings[key];
                saveSettings(); updateUI();
            });
        });

        const numInput = (id, key) => {
            const el = document.getElementById(id);
            if(el) el.addEventListener('change', () => {
                settings[key] = Math.max(1, parseInt(el.value) || 1);
                saveSettings(); updateUI();
            });
        };
        numInput('upg-count-endbattle-input', 'count_endbattle');
        numInput('upg-count-bags-input', 'count_bags_upgrade');

        const hkInput = document.getElementById('upg-hotkey-input');
        if (hkInput) {
            const handler = (e) => {
                if (['Tab', 'Enter', 'Escape', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
                e.preventDefault(); e.stopPropagation();
                settings.hotkeyKey = e.key === ' ' ? ' ' : e.key.toLowerCase().slice(0, 1);
                hkInput.blur(); saveSettings(); updateUI();
            };
            hkInput.addEventListener('focus', () => hkInput.addEventListener('keydown', handler));
            hkInput.addEventListener('blur', () => hkInput.removeEventListener('keydown', handler));
        }
    }

    function applyCSS() {
        const style = document.createElement('style');
        style.innerHTML = `
            .upgrader-crafting-window { display: none !important; }
            .upg-pointer { cursor: url("https://gordion.margonem.pl/img/gui/cursor/1n.png") 4 0, pointer !important; }
            .upg-main-container { padding: 5px; gap: 8px; }
            .upg-state-header { align-items: center; justify-content: center; gap: 8px; border-bottom: 1px solid #303030; padding-bottom: 5px; }
            .upg-item-box { align-items: center; justify-content: center; min-height: 60px; }
            .upg-item-name { font-size: 11px; font-weight: bold; color: #ffcc00; text-shadow: 1px 1px #000; text-align: center; }
            .upg-item-progress { font-size: 10px; color: #aaa; text-shadow: 1px 1px #000; text-align: center; }
            .upg-daily-limit { font-size: 10px; text-align: center; color: #ddd; border-top: 1px solid #303030; padding-top: 5px; }
            .upg-grid-types { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; margin: 0 5px; }
            .upg-small-input { width: 40px !important; text-align: center; height: 18px; font-size: 10px; padding: 0; }
            .baddonz-hr { border: none; border-bottom: 1px solid #303030; margin: 2px 0; width: 100%; }
        `;
        document.head.appendChild(style);
    }

    // ==========================================
    // INICJALIZACJA I BINDINGI GRY
    // ==========================================
    function initAddon() {
        loadSettings();
        applyCSS();

        // Integracja z Baddonz 2.0.5 API (Główny silnik zajmuje się oknami i ich właściwościami)
        if (window.baddonzAPI && typeof window.baddonzAPI.registerAddon === 'function') {
            window.baddonzAPI.registerAddon(ADDON_ID, {
                name: 'Ulepszara',
                mainContent: MAIN_HTML,
                settingsContent: SETTINGS_HTML,
                onReady: () => {
                    bindUIEvents();
                    updateUI();
                }
            });
        } else {
            console.warn(`[${ADDON_ID}] BaddonzAPI nie zostało wykryte - upewnij się, że główny skrypt Baddonz 2.0.5 jest włączony.`);
        }

        // Podpięcie pod Menu Kontekstowe Przedmiotu (PPM)
        const ogShowPopupMenu = Engine.interface.showPopupMenu;
        Engine.interface.showPopupMenu = function (menu, e) {
            const match = e.currentTarget?.className?.match(/item-id-(\d+)/);
            const itemId = match ? match[1] : null;
            const item = Engine.items.getItemById(itemId);
            const currentSelected = getUpgradedItemId();

            if (itemId && ITEM_TYPE_SETTINGS_MAP[item?.cl]) {
                const actionMenu = itemId === currentSelected
                    ? ["Anuluj ulepszanie", () => { setUpgradedItemId(""); updateUI(); }, { button: { cls: "menu-item--red" } }]
                    : ["Ulepsz ten przedmiot", async () => {
                        setUpgradedItemId(itemId);
                        message(`Wybrano: ${item.name}`);
                        toggleEnhancementWindow();
                        await setEnhancedItem(itemId);
                        toggleEnhancementWindow();
                    }, { button: { cls: "menu-item--green" } }];
                menu = [actionMenu, ...menu];
            }
            return ogShowPopupMenu.call(this, menu, e);
        };

        // Nasłuch Klawiatury
        document.addEventListener("keydown", (e) => {
            if (!settings.enabled || !settings.hotkeyEnabled || isUpgrading) return;
            if (["TEXTAREA", "MAGIC_INPUT", "INPUT"].includes(document.activeElement.tagName)) return;
            if (e.key.toLowerCase() === settings.hotkeyKey.toLowerCase()) {
                e.preventDefault();
                runUpgradeCycle('hotkey');
            }
        });

        // Nasłuch Komunikacji (Limit ulepszeń)
        const ogParseJSON = Engine.communication.parseJSON;
        Engine.communication.parseJSON = function (data) {
            if (data?.enhancement?.usages_preview?.count !== undefined) {
                dailyUpgradeCount = data.enhancement.usages_preview.count;
                dailyUpgradeLimit = data.enhancement.usages_preview.limit || dailyUpgradeLimit;
                if (window.baddonzAPI) updateUI();
            }
            return ogParseJSON.call(this, data);
        };

        // Nasłuch Końca Walki
        if (typeof Engine.battle.setEndBattle === 'function') {
            const ogSetEndBattle = Engine.battle.setEndBattle.bind(Engine.battle);
            Engine.battle.setEndBattle = function() {
                ogSetEndBattle();
                if (settings.upgrade_endbattle) runUpgradeCycle('battle');
            };
        }

        // Pętla sprawdzania torby
        setInterval(() => {
            if (settings.bags_upgrade) runUpgradeCycle('bag');
        }, BAG_CHECK_INTERVAL);
    }

    // Bootstrap uruchomieniowy
    const bootInterval = setInterval(() => {
        if (window.Engine && window.Engine.allInit && document.body) {
            clearInterval(bootInterval);
            initAddon();
        }
    }, 500);

})();
