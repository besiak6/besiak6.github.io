// ==UserScript==
// @name          Znacznik Teleportów baddonz
// @version       1.0
// @description   Znacznik Teleportów
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function () {
    'use strict';

    const ADDON_ID = "ZT";

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.className = "zt-custom-styles";
    styleSheet.innerText = `
        .baddonz-zt-wnd { width:180px; min-width:180px; }
        .baddonz-zt-wnd .baddonz-window-body { padding: 4px 6px 6px 6px !important; gap: 3px !important; }
        .baddonz-zt-wnd .baddonz-setting-row { margin-bottom: 2px !important; }
        .baddonz-zt-wnd .baddonz-text { font-size: 11px; }
        .zt-modal-wnd { width: 220px; z-index: 12; }
    `;
    if (!document.querySelector(".zt-custom-styles")) document.head.appendChild(styleSheet);

    const config = {
        "610": "D.AUK", "1224": "KENDAL", "630": "PORT", "1297": "TRIST", "8116": "EVE",
        "3328": "SKAŁY", "1926": "MAHO", "3038": "K.LEG", "5858": "SK", "6773": "MARG",
        "2868": "RUIN", "2869": "CICH", "180": "ANDA", "580": "MUSH", "632": "K.TROP",
        "5738": "SHAE S1", "5740": "SHAE RED", "2532": "ZORG", "727": "WŁAD", "3149": "GOB",
        "4157": "DZIK", "4156": "DZIK", "5293": "TOL ST", "2308": "ALIAS", "176": "AGAR",
        "177": "AGAR", "125": "RAZIU", "2729": "KOB", "816": "KOB", "5395": "OWAD", "5397": "OWAD",
        "333": "VARI", "2646": "VARI", "3436": "KOZA", "3437": "KOZA", "6535": "JOTU", "6537": "JOTU",
        "6632": "TOL  P3", "6633": "TOL  P4", "6625": "LISZ", "6627": "LISZ", "6620": "GRAB", "6623": "GRAB",
        "1204": "STOPA", "3530": "STOPA", "6615": "ZBROJ", "6634": "CHOU P1", "6636": "CHOU P3",
        "6772": "NADZ", "6774": "MORT", "1325": "WIDMO", "3466": "OHYD", "1150": "GOPA",
        "6781": "G.FIG", "3765": "CENT", "229": "KAMB", "4998": "KAMB", "6938": "JERT",
        "6944": "M.RYC", "6946": "M.MAG", "6945": "M.ŁOW", "7066": "CZACH", "7069": "OZIR",
        "7357": "MORS", "1620": "K.REM", "4271": "K.STAT", "7368": "BORG", "7375": "STWORZ",
        "7057": "IFRY", "3409": "JACK", "1527": "HELG", "1525": "PIRAT", "1526": "HENRY",
        "7352": "EOL", "7351": "EOL", "6956": "GRUBY", "3265": "BERK", "352": "GÓRAL", "7340": "WÓJT",
        "7338": "TEŚC", "7466": "KOW", "7453": "AMUN", "7454": "AMUN", "7440": "FODUG", "7441": "FODUG",
        "1322": "ADA", "1315": "ADA", "5872": "DWK", "7473": "GONS", "7474": "GONS", "5856": "BURK",
        "5855": "BURK", "5851": "SHEB", "5849": "SHEB", "5862": "SK", "5861": "SK",
        "6053": "TOR","6051": "TOR","7345": "K.ŚNI","6054": "DD", "6055": "DD", "7693": "OGR","4185": "PM",
        "7688": "CERA", "7689": "CERA", "1912": "CZEM", "2063": "BREH", "7701": "MYSZ", "5940": "SADO", 
        "5941": "TS", "7694": "SAT", "5945": "BERG","5943": "ZUF", "7864": "MARL", "7843": "M.MAD",
        "7842": "M.MAD", "1480": "M.MAD", "1142": "ARACH", "1159": "ARACH","7859": "AI","7827": "HIPO",
        "8181": "FANG","8180": "FANG", "3615": "DEND", "3597": "DEND", "5660": "TOLY", "5693": "JAJO", 
        "8187": "WABI", "8186": "WABI", "5694": "JAJO", "5684": "P9", "5683": "P9", "3339": "PUST", 
        "2353": "ART", "2354": "ZOR", "2356": "FUR", "3039": "SET", "3035": "CHOP", "6064": "NYMF", 
        "1901": "CIUT", "4056": "SYBA", "3327": "TER", "3335": "Z. TER", "3334": "Z. TER", 
        "3341": "CHAG", "3340": "VERA",
        "3361": "36", "3883": "63", "202": "63", "4046": "83", "1387": "83", "7353": "114",
        "1739": "114", "4161": "144", "349": "144", "4066": "167", "264": "167", "4196": "190",
        "6052": "190", "4206": "213", "1131": "213", "4266": "244", "3596": "244",
        "4268": "279", "3037": "279", "189": "ORLA", "1746": "KIC", "6949": "RENE", "7060": "ARCY", 
        "7477": "ZONS", "6477": "ŁOWK", "6476": "PRZY", "7848": "MAGU", "5709": "TEZA", "5708": "TEZA",
        "3312": "BB", "2357": "TH", "2355": "TH",
    };

    let currentSettings = {
        enabled: true,
        windowOpacity: 2,
        windowVisible: true,
        customLabels: {},
        teleportmass: {},
        ignored_sign: {}
    };

    let uiMainWindow = null;
    let addWindow = null;
    let editWindow = null;
    let massEditWindow = null;
    let currentItemId = null;
    let isEngineHooked = false;

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

        let oldCustom = JSON.parse(localStorage.getItem('custom_teleport_sign'));
        let oldMass = JSON.parse(localStorage.getItem('teleportmass'));
        let oldIgnored = JSON.parse(localStorage.getItem('ignored_sign'));

        currentSettings = { ...currentSettings, ...accSettings };

        if (currentSettings.customLabels && Object.keys(currentSettings.customLabels).length === 0 && oldCustom) {
            currentSettings.customLabels = oldCustom || {};
            currentSettings.teleportmass = oldMass || {};
            currentSettings.ignored_sign = oldIgnored || {};
            
            localStorage.removeItem('custom_teleport_sign');
            localStorage.removeItem('teleportmass');
            localStorage.removeItem('ignored_sign');
            saveSettings();
        }
    }

    function saveSettings() {
        if (!window.BaddonzAPI) return;
        const accId = window.BaddonzAPI.accountId;
        window.BaddonzAPI.saveAddonSettings(ADDON_ID, {});
        
        try {
            let data = JSON.parse(localStorage.getItem('BaddonzData')) || {};
            if (!data[accId]) data[accId] = {};
            if (!data[accId].accountAddons) data[accId].accountAddons = {};
            data[accId].accountAddons[ADDON_ID] = currentSettings;
            localStorage.setItem('BaddonzData', JSON.stringify(data));
        } catch (e) {}
    }

    function txov(id, text) {
        const $it = document.querySelector(`.item-id-${id}`);
        if (!$it) return;

        let tz = $it.querySelector(".znacznik-teleport");
        if (tz && tz.innerText === text) return;

        if (!tz) {
            tz = document.createElement("span");
            tz.classList.add("znacznik-teleport");
            $it.appendChild(tz);
        }

        tz.innerText = text;
        Object.assign(tz.style, {
            position: "absolute", top: 0, left: 0,
            width: "100%", height: "100%", color: "#fff",
            fontSize: `${text.replace(/\s/g, '').length < 5 ? 9 : 8}px`,
            textAlign: "center", lineHeight: 1.5,
            textShadow: `-2px -2px 0 black, -1px -2px 0 black, 0px -2px 0 black, 1px -2px 0 black, 2px -2px 0 black, -2px -1px 0 black, 2px -1px 0 black, -2px 0px 0 black, 2px 0px 0 black, -2px 1px 0 black, 2px 1px 0 black, -2px 2px 0 black, -1px 2px 0 black, 0px 2px 0 black, 1px 2px 0 black, 2px 2px 0 black`,
            fontFamily: "'Arial Black', Gadget, sans-serif",
            userSelect: "none", pointerEvents: "none",
            textRendering: "optimizeLegibility",
            zIndex: "5"
        });
    }

    function removeTxov(id) {
        const $it = document.querySelector(`.item-id-${id}`);
        if (!$it) return;
        const tz = $it.querySelector(".znacznik-teleport");
        if (tz) tz.remove();
    }

    function parseStats(stats) {
        if (!stats || typeof stats !== "string") return {};
        const result = {};
        for (const pair of stats.split(";")) {
            const [key, value] = pair.split("=");
            if (key && value !== undefined) {
                result[key] = value;
            }
        }
        return result;
    }

    function getItemStats(it) {
        if (!it || typeof it !== "object") return {};
        if (!it._znacznikParsedStats) {
            it._znacznikParsedStats = parseStats(it.stat || it.stats || "");
        }
        return it._znacznikParsedStats;
    }

    function getItemTeleport(it) {
        const stats = getItemStats(it);
        let tp = "";
        if (stats.teleport) tp = stats.teleport;
        else if (stats.custom_teleport && stats.custom_teleport !== "true") tp = stats.custom_teleport;
        return tp;
    }

    function getTpMap(tp) {
        if (!tp || typeof tp !== "string") return "";
        return tp.split(",")[0];
    }

    function getAutoLabel(tp, tpMap) {
        return config[tp] || config[tpMap];
    }

    function applyLabelsToAllVisibleItems() {
        if (!window.Engine?.items?.fetchLocationItems) return;
        const itemsArray = window.Engine.items.fetchLocationItems("g");
        const items = {};
        for (const item of itemsArray) {
            if (item?.id) items[item.id] = item;
        }
        uiz(items);
    }

    function uiz(items) {
        if (!items || typeof items !== "object") return;
        for (const id in items) {
            const it = items[id];
            if (!it || typeof it !== "object") continue;

            if (!currentSettings.enabled) {
                removeTxov(id);
                continue;
            }

            const tp = getItemTeleport(it);
            const tpMap = getTpMap(tp);

            const customLabel = currentSettings.customLabels[id];
            const massLabelData = currentSettings.teleportmass[tpMap];
            const autoLabel = getAutoLabel(tp, tpMap);
            const isDefaultIgnored = currentSettings.ignored_sign[id];

            let finalLabel = null;
            if (isDefaultIgnored) {
                finalLabel = null;
            } else if (customLabel) {
                finalLabel = customLabel;
            } else if (massLabelData?.enabled) {
                finalLabel = massLabelData.label || '';
            } else if (autoLabel) {
                finalLabel = autoLabel;
            }

            if (finalLabel) {
                txov(id, finalLabel);
            } else {
                removeTxov(id);
            }
        }
    }

    const intercept = (obj, key, cb) => {
        const original = obj[key];
        obj[key] = function (...args) {
            cb(...args);
            return original.apply(this, args);
        };
    };

    function validateLabelInput(newLabelInput) {
        const MAX_CHARS_WITHOUT_SPACES = 8;
        const MAX_SPACES = 2;

        newLabelInput = newLabelInput.toUpperCase();
        const charsWithoutSpaces = newLabelInput.replace(/\s/g, '');
        const spaceCount = (newLabelInput.match(/\s/g) || []).length;
        if (charsWithoutSpaces.length > MAX_CHARS_WITHOUT_SPACES) return false;
        if (spaceCount > MAX_SPACES) return false;

        let finalLabel = newLabelInput;
        let cleanLabelForBreak = newLabelInput.replace(/\s/g, '');
        if (cleanLabelForBreak.length > 5 && newLabelInput.indexOf(' ') === -1) {
            const projectedLength = newLabelInput.slice(0, 5).length + 1 + newLabelInput.slice(5).length;
            if ((projectedLength - (spaceCount + 1)) <= MAX_CHARS_WITHOUT_SPACES) {
                finalLabel = newLabelInput.slice(0, 5) + ' ' + newLabelInput.slice(5);
            }
        }
        return finalLabel;
    }

    function bringToFront(wnd) {
        document.querySelectorAll('.baddonz-window').forEach(w => { w.style.zIndex = '11'; });
        if (wnd) wnd.style.zIndex = '12';
    }

    function centerWindow(windowElement) {
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const windowWidth = 220; 
        const windowHeight = 100;
        windowElement.style.left = `${(screenWidth - windowWidth) / 2}px`;
        windowElement.style.top = `${(screenHeight - windowHeight) / 2}px`;
    }

    function showAddWindow(id) {
        currentItemId = id;
        const input = addWindow.querySelector('.zt-add-input');
        input.value = '';
        addWindow.style.display = 'flex';
        centerWindow(addWindow);
        bringToFront(addWindow);
        input.focus();
    }

    function showEditWindow(id, currentLabel) {
        currentItemId = id;
        const input = editWindow.querySelector('.zt-edit-input');
        input.value = currentLabel;
        editWindow.style.display = 'flex';
        centerWindow(editWindow);
        bringToFront(editWindow);
        input.focus();
    }

    function showMassEditWindow(id, currentLabel) {
        currentItemId = id;
        const input = massEditWindow.querySelector('.zt-mass-edit-input');
        input.value = currentLabel;
        massEditWindow.style.display = 'flex';
        centerWindow(massEditWindow);
        bringToFront(massEditWindow);
        input.focus();
    }

    function handleAddLabel() {
        const input = addWindow.querySelector('.zt-add-input');
        const newLabelInput = input.value.trim();
        const finalLabel = validateLabelInput(newLabelInput);

        if (finalLabel) {
            currentSettings.customLabels[currentItemId] = finalLabel;
            delete currentSettings.ignored_sign[currentItemId];
            saveSettings();
            applyLabelsToAllVisibleItems();
            addWindow.style.display = 'none';
        } else if (newLabelInput === '') {
            addWindow.style.display = 'none';
        }
    }

    function handleEditLabel() {
        const input = editWindow.querySelector('.zt-edit-input');
        const newLabelInput = input.value.trim();
        const finalLabel = validateLabelInput(newLabelInput);

        if (finalLabel) {
            currentSettings.customLabels[currentItemId] = finalLabel;
            delete currentSettings.ignored_sign[currentItemId];
            saveSettings();
            applyLabelsToAllVisibleItems();
            editWindow.style.display = 'none';
        } else if (newLabelInput === '') {
            delete currentSettings.customLabels[currentItemId];
            currentSettings.ignored_sign[currentItemId] = true;
            saveSettings();
            applyLabelsToAllVisibleItems();
            editWindow.style.display = 'none';
        }
    }

    function handleMassEditLabel() {
        const input = massEditWindow.querySelector('.zt-mass-edit-input');
        const newLabelInput = input.value.trim();
        const finalLabel = validateLabelInput(newLabelInput);

        const item = window.Engine.items.getItemById(currentItemId);
        const tp = getItemTeleport(item);
        const tpMap = getTpMap(tp);

        if (finalLabel) {
            currentSettings.teleportmass[tpMap] = { enabled: true, label: finalLabel };
            saveSettings();
            applyLabelsToAllVisibleItems();
            massEditWindow.style.display = 'none';
        } else if (newLabelInput === '') {
            delete currentSettings.teleportmass[tpMap];
            saveSettings();
            applyLabelsToAllVisibleItems();
            massEditWindow.style.display = 'none';
        }
    }

    function buildUI() {
        const mainBodyHtml = `
            <div class="baddonz-setting-row" style="margin-bottom: 4px !important; display: flex; align-items: center;">
                <div class="baddonz-checkbox zt-checkbox ${currentSettings.enabled ? 'active' : ''}"></div>
                <span class="baddonz-text" style="padding: 0; margin-left: 5px;">Znaczniki Teleportów</span>
            </div>
        `;

        uiMainWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Znaczniki", mainBodyHtml, {
            width: '180px',
            customId: 'baddonz-zt-wnd',
            hasSettings: false,
            hasCollapse: false
        });
        uiMainWindow.classList.add('baddonz-zt-wnd');

        const ztCheckbox = uiMainWindow.querySelector(".zt-checkbox");
        ztCheckbox.addEventListener('click', () => {
            currentSettings.enabled = ztCheckbox.classList.toggle('active');
            saveSettings();
            applyLabelsToAllVisibleItems();
        });

        const dialogsHtml = `
            <div class="baddonz-window blur zt-modal-wnd zt-wnd-add" style="display: none; position: absolute;">
                <div class="baddonz-window-header">
                    <div class="baddonz-window-controls left"></div>
                    <div class="baddonz-window-title">Dodaj Znacznik</div>
                    <div class="baddonz-window-controls right">
                        <div class="baddonz-icon baddonz-close-button zt-add-close-btn"></div>
                    </div>
                </div>
                <div class="baddonz-window-body baddonz-flex column centered" style="padding: 10px;">
                    <input type="text" class="baddonz-input zt-add-input" placeholder="Wprowadź podpis" maxlength="8" style="width: 100%; text-align: center;" autocomplete="off">
                    <div class="baddonz-flex between" style="width: 100%; gap: 10px; margin-top: 10px;">
                        <button class="baddonz-button zt-add-cancel-btn" style="flex: 1;">Anuluj</button>
                        <button class="baddonz-button zt-add-ok-btn" style="flex: 1;">OK</button>
                    </div>
                </div>
            </div>

            <div class="baddonz-window blur zt-modal-wnd zt-wnd-edit" style="display: none; position: absolute;">
                <div class="baddonz-window-header">
                    <div class="baddonz-window-controls left"></div>
                    <div class="baddonz-window-title">Edytuj Znacznik</div>
                    <div class="baddonz-window-controls right">
                        <div class="baddonz-icon baddonz-close-button zt-edit-close-btn"></div>
                    </div>
                </div>
                <div class="baddonz-window-body baddonz-flex column centered" style="padding: 10px;">
                    <input type="text" class="baddonz-input zt-edit-input" maxlength="8" style="width: 100%; text-align: center;" autocomplete="off">
                    <div class="baddonz-flex between" style="width: 100%; gap: 10px; margin-top: 10px;">
                        <button class="baddonz-button zt-edit-cancel-btn" style="flex: 1;">Anuluj</button>
                        <button class="baddonz-button zt-edit-ok-btn" style="flex: 1;">OK</button>
                    </div>
                </div>
            </div>

            <div class="baddonz-window blur zt-modal-wnd zt-wnd-mass-edit" style="display: none; position: absolute;">
                <div class="baddonz-window-header">
                    <div class="baddonz-window-controls left"></div>
                    <div class="baddonz-window-title">Edytuj Podpisy</div>
                    <div class="baddonz-window-controls right">
                        <div class="baddonz-icon baddonz-close-button zt-mass-edit-close-btn"></div>
                    </div>
                </div>
                <div class="baddonz-window-body baddonz-flex column centered" style="padding: 10px;">
                    <input type="text" class="baddonz-input zt-mass-edit-input" maxlength="8" style="width: 100%; text-align: center;" autocomplete="off">
                    <div class="baddonz-flex between" style="width: 100%; gap: 10px; margin-top: 10px;">
                        <button class="baddonz-button zt-mass-edit-cancel-btn" style="flex: 1;">Anuluj</button>
                        <button class="baddonz-button zt-mass-edit-ok-btn" style="flex: 1;">OK</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', dialogsHtml);

        addWindow = document.querySelector('.zt-wnd-add');
        editWindow = document.querySelector('.zt-wnd-edit');
        massEditWindow = document.querySelector('.zt-wnd-mass-edit');

        document.querySelector('.zt-add-cancel-btn').addEventListener('click', () => addWindow.style.display = 'none');
        document.querySelector('.zt-edit-cancel-btn').addEventListener('click', () => editWindow.style.display = 'none');
        document.querySelector('.zt-mass-edit-cancel-btn').addEventListener('click', () => massEditWindow.style.display = 'none');

        document.querySelector('.zt-add-ok-btn').addEventListener('click', handleAddLabel);
        document.querySelector('.zt-edit-ok-btn').addEventListener('click', handleEditLabel);
        document.querySelector('.zt-mass-edit-ok-btn').addEventListener('click', handleMassEditLabel);

        addWindow.querySelector('.zt-add-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAddLabel(); });
        editWindow.querySelector('.zt-edit-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleEditLabel(); });
        massEditWindow.querySelector('.zt-mass-edit-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleMassEditLabel(); });

        if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
            $('.zt-add-close-btn').tip('Zamknij');
            $('.zt-edit-close-btn').tip('Zamknij');
            $('.zt-mass-edit-close-btn').tip('Zamknij');
        }
    }

    function addonInit() {
        loadSettings();
        if (!uiMainWindow) buildUI();

        if (!isEngineHooked) {
            intercept(window.Engine.communication, 'parseJSON', (data) => {
                if (data.item) uiz(data.item);
            });

            intercept(window.Engine.interface, 'showPopupMenu', (options, event) => {
                if (!currentSettings.enabled) return;

                const idMatch = event.target?.className?.match(/item-id-(\d+)/) || event.target?.parentElement?.className?.match(/item-id-(\d+)/);
                const id = idMatch ? idMatch[1] : null;
                if (!id) return;

                const item = window.Engine.items.getItemById(id);
                if (!item) return;

                const tp = getItemTeleport(item);
                const tpMap = getTpMap(tp);

                const autoLabel = getAutoLabel(tp, tpMap);
                const hasCustomLabel = currentSettings.customLabels.hasOwnProperty(id);
                const isMassLabeledGlobally = currentSettings.teleportmass[tpMap]?.enabled === true;
                const currentMassLabel = currentSettings.teleportmass[tpMap]?.label;
                const isIgnoredSingularly = currentSettings.ignored_sign.hasOwnProperty(id);
                
                let currentLabelSource = 'none';

                if (isIgnoredSingularly) {
                    currentLabelSource = 'ignored';
                } else if (hasCustomLabel) {
                    currentLabelSource = 'custom';
                } else if (isMassLabeledGlobally) {
                    currentLabelSource = 'mass';
                } else if (autoLabel) {
                    currentLabelSource = 'config';
                }

                let menuOptionsToAdd = [];
                let spliceIndex = options.length - 1;

                if (tp && (item._cachedStats.custom_teleport || item._cachedStats.teleport)) {
                    if (autoLabel) {
                        if (currentLabelSource === 'config') {
                            menuOptionsToAdd.push(['Edytuj Podpis', () => { showEditWindow(id, autoLabel); }, { button: { cls: 'menu-item--green' } }]);
                            menuOptionsToAdd.push(['Usuń Podpis', () => {
                                delete currentSettings.customLabels[id];
                                currentSettings.ignored_sign[id] = true;
                                saveSettings();
                                applyLabelsToAllVisibleItems();
                            }, { button: { cls: 'menu-item--red' } }]);
                        }
                        else if (currentLabelSource === 'ignored') {
                            menuOptionsToAdd.push(['Przywróć Domyślny Podpis', () => {
                                delete currentSettings.ignored_sign[id];
                                delete currentSettings.customLabels[id];
                                saveSettings();
                                applyLabelsToAllVisibleItems();
                            }, { button: { cls: 'menu-item--green' } }]);
                        }
                        else if (currentLabelSource === 'custom') {
                            menuOptionsToAdd.push(['Edytuj Podpis', () => { showEditWindow(id, currentSettings.customLabels[id]); }, { button: { cls: 'menu-item--green' } }]);
                            menuOptionsToAdd.push(['Podpisanie tych samych mapek teleportu', () => {
                                let labelToApply = currentSettings.customLabels[id] || autoLabel;
                                if (labelToApply) {
                                    currentSettings.teleportmass[tpMap] = { enabled: true, label: labelToApply };
                                    window.Engine.items.fetchLocationItems("g").forEach(it => {
                                        if (getTpMap(getItemTeleport(it)) === tpMap) {
                                            delete currentSettings.customLabels[it.id];
                                            delete currentSettings.ignored_sign[it.id];
                                        }
                                    });
                                    saveSettings();
                                    applyLabelsToAllVisibleItems();
                                }
                            }, { button: { cls: 'menu-item--green' } }]);
                            menuOptionsToAdd.push(['Usuń Podpis', () => {
                                delete currentSettings.customLabels[id];
                                currentSettings.ignored_sign[id] = true;
                                saveSettings();
                                applyLabelsToAllVisibleItems();
                            }, { button: { cls: 'menu-item--red' } }]);
                        }
                        else if (currentLabelSource === 'mass') {
                            menuOptionsToAdd.push(['Edytuj Podpisy', () => { showMassEditWindow(id, currentMassLabel); }, { button: { cls: 'menu-item--green' } }]);
                            menuOptionsToAdd.push(['Podpisywanie tych samych mapek teleportu', () => {
                                const labelToPersist = currentMassLabel;
                                delete currentSettings.teleportmass[tpMap];
                                window.Engine.items.fetchLocationItems("g").forEach(it => {
                                    if (getTpMap(getItemTeleport(it)) === tpMap) {
                                        if (it.id === id) {
                                            currentSettings.customLabels[it.id] = labelToPersist;
                                            delete currentSettings.ignored_sign[it.id];
                                        } else {
                                            removeTxov(it.id);
                                            delete currentSettings.customLabels[it.id];
                                            delete currentSettings.ignored_sign[it.id];
                                        }
                                    }
                                });
                                saveSettings();
                                applyLabelsToAllVisibleItems();
                            }, { button: { cls: 'menu-item--red' } }]);
                            menuOptionsToAdd.push(['Usuń Podpis', () => {
                                delete currentSettings.customLabels[id];
                                currentSettings.ignored_sign[id] = true;
                                saveSettings();
                                applyLabelsToAllVisibleItems();
                            }, { button: { cls: 'menu-item--red' } }]);
                        }
                    }
                    else {
                        if (currentLabelSource === 'none' || currentLabelSource === 'ignored') {
                            menuOptionsToAdd.push(['Dodaj Podpis', () => { showAddWindow(id); }, { button: { cls: 'menu-item--green' } }]);
                        }
                        else if (currentLabelSource === 'custom') {
                            menuOptionsToAdd.push(['Edytuj Podpis', () => { showEditWindow(id, currentSettings.customLabels[id]); }, { button: { cls: 'menu-item--green' } }]);
                            menuOptionsToAdd.push(['Podpisanie tych samych mapek teleportu', () => {
                                let labelToApply = currentSettings.customLabels[id];
                                if (labelToApply) {
                                    currentSettings.teleportmass[tpMap] = { enabled: true, label: labelToApply };
                                    window.Engine.items.fetchLocationItems("g").forEach(it => {
                                        if (getTpMap(getItemTeleport(it)) === tpMap) {
                                            delete currentSettings.customLabels[it.id];
                                            delete currentSettings.ignored_sign[it.id];
                                        }
                                    });
                                    saveSettings();
                                    applyLabelsToAllVisibleItems();
                                }
                            }, { button: { cls: 'menu-item--green' } }]);
                            menuOptionsToAdd.push(['Usuń Podpis', () => {
                                delete currentSettings.customLabels[id];
                                saveSettings();
                                applyLabelsToAllVisibleItems();
                            }, { button: { cls: 'menu-item--red' } }]);
                        }
                        else if (currentLabelSource === 'mass') {
                             menuOptionsToAdd.push(['Edytuj Podpisy', () => { showMassEditWindow(id, currentMassLabel); }, { button: { cls: 'menu-item--green' } }]);
                             menuOptionsToAdd.push(['Podpisywanie tych samych mapek teleportu', () => {
                                const labelToPersist = currentMassLabel;
                                delete currentSettings.teleportmass[tpMap];
                                window.Engine.items.fetchLocationItems("g").forEach(it => {
                                    if (getTpMap(getItemTeleport(it)) === tpMap) {
                                        if (it.id === id) {
                                            currentSettings.customLabels[it.id] = labelToPersist;
                                            delete currentSettings.ignored_sign[it.id];
                                        } else {
                                            removeTxov(it.id);
                                            delete currentSettings.customLabels[it.id];
                                            delete currentSettings.ignored_sign[it.id];
                                        }
                                    }
                                });
                                saveSettings();
                                applyLabelsToAllVisibleItems();
                            }, { button: { cls: 'menu-item--red' } }]);
                            menuOptionsToAdd.push(['Usuń Podpis', () => {
                                delete currentSettings.customLabels[id];
                                currentSettings.ignored_sign[id] = true;
                                saveSettings();
                                applyLabelsToAllVisibleItems();
                            }, { button: { cls: 'menu-item--red' } }]);
                        }
                    }
                    if (menuOptionsToAdd.length > 0) {
                        options.splice(spliceIndex, 0, ...menuOptionsToAdd);
                    }
                }
            });
            isEngineHooked = true;
        }

        applyLabelsToAllVisibleItems();
    }

    function addonStop() {
        if (uiMainWindow) { uiMainWindow.remove(); uiMainWindow = null; }
        if (addWindow) { addWindow.remove(); addWindow = null; }
        if (editWindow) { editWindow.remove(); editWindow = null; }
        if (massEditWindow) { massEditWindow.remove(); massEditWindow = null; }
        
        if (window.Engine?.items?.fetchLocationItems) {
            window.Engine.items.fetchLocationItems("g").forEach(it => {
                removeTxov(it.id);
            });
        }
    }

    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        if (uiMainWindow) {
            const ztCheckbox = uiMainWindow.querySelector(".zt-checkbox");
            if (ztCheckbox) {
                if (isEnabled) ztCheckbox.classList.add('active');
                else ztCheckbox.classList.remove('active');
            }
        }
        applyLabelsToAllVisibleItems();
    }

    const checkApi = () => {
        if (!window.BaddonzAPI || !window.BaddonzAPI.registerAddon) {
            setTimeout(checkApi, 500); return;
        }
        window.BaddonzAPI.registerAddon(ADDON_ID, { init: addonInit, stop: addonStop, onStateToggle: onStateToggle });
    };
    
    checkApi();

})();
