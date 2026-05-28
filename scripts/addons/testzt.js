// ==UserScript==
// @name          Znacznik Teleportów baddonz
// @version       28.05.2026
// @description   Znacznik Teleportów
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function () {
    'use strict';

    const ADDON_ID = "ZT";

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
        "6053": "TOR","6051": "TOR","7345": "K.ŚNI","6054": "DD", "6055": "DD", "7693": "OGR","4185": "PM","7688": "CERA", "7689": "CERA", "1912": "CZEM",
        "2063": "BREH", "7701": "MYSZ", "5940": "SADO", "5941": "TS", "7694": "SAT", "5945": "BERG","5943": "ZUF",
        "7864": "MARL", "7843": "M.MAD","7842": "M.MAD", "1480": "M.MAD", "1142": "ARACH", "1159": "ARACH","7859": "AI","7827": "HIPO",
        "8181": "FANG","8180": "FANG", "3615": "DEND", "3597": "DEND", "5660": "TOLY", "5693": "JAJO", "8187": "WABI", "8186": "WABI",
        "5694": "JAJO", "5684": "P9", "5683": "P9", "3339": "PUST", "2353": "ART", "2354": "ZOR",
        "2356": "FUR", "3039": "SET", "3035": "CHOP", "6064": "NYMF", "1901": "CIUT", "4056": "SYBA",
        "3327": "TER", "3335": "Z. TER", "3334": "Z. TER", "3341": "CHAG", "3340": "VERA",
        "3361": "36", "3883": "63", "202": "63", "4046": "83", "1387": "83", "7353": "114",
        "1739": "114", "4161": "144", "349": "144", "4066": "167", "264": "167", "4196": "190",
        "6052": "190", "4206": "213", "1131": "213", "4266": "244", "3596": "244",
        "4268": "279", "3037": "279", "189": "ORLA", "1746": "KIC", "6949": "RENE", "7060": "ARCY", "7477": "ZONS",
        "6477": "ŁOWK", "6476": "PRZY", "7848": "MAGU", "5709": "TEZA", "5708": "TEZA",
        "3312": "BB", "2357": "TH", "2355": "TH"
    };

    let currentSettings = {
        enabled: true,
        customLabels: {},
        teleportmass: {},
        ignored_sign: {}
    };

    let uiPromptWindow = null;
    let promptMode = ''; 
    let promptItemId = null;
    let isIntercepted = false;

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

        currentSettings = { ...currentSettings, ...accSettings };
        if (!currentSettings.customLabels) currentSettings.customLabels = {};
        if (!currentSettings.teleportmass) currentSettings.teleportmass = {};
        if (!currentSettings.ignored_sign) currentSettings.ignored_sign = {};
    }

    function saveSettings() {
        if (!window.BaddonzAPI) return;
        const accId = window.BaddonzAPI.accountId;
        
        const accKeys = ['enabled', 'customLabels', 'teleportmass', 'ignored_sign'];
        let accSettings = {};
        accKeys.forEach(k => accSettings[k] = currentSettings[k]);
        
        window.BaddonzAPI.saveAddonSettings(ADDON_ID, {});
        
        try {
            let data = JSON.parse(localStorage.getItem('BaddonzData')) || {};
            if (!data[accId]) data[accId] = {};
            if (!data[accId].accountAddons) data[accId].accountAddons = {};
            data[accId].accountAddons[ADDON_ID] = accSettings;
            localStorage.setItem('BaddonzData', JSON.stringify(data));
        } catch (e) {}
    }

    function txov(id, text) {
        const itemElement = document.querySelector(`.item-id-${id}`);
        if (!itemElement) return;

        let tz = itemElement.querySelector(".znacznik-teleport");
        if (tz && tz.innerText === text) return;

        if (!tz) {
            tz = document.createElement("span");
            tz.className = "znacznik-teleport";
            itemElement.appendChild(tz);
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
        });
    }

    function removeTxov(id) {
        const itemElement = document.querySelector(`.item-id-${id}`);
        if (!itemElement) return;
        const tz = itemElement.querySelector(".znacznik-teleport");
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
            if (item?.id) {
                items[item.id] = item;
            }
        }
        uiz(items);
    }

    function removeAllLabels() {
        document.querySelectorAll('.znacznik-teleport').forEach(el => el.remove());
    }

    function uiz(items) {
        if (!items || typeof items !== "object") return;
        for (const id in items) {
            const it = items[id];
            if (!it || typeof it !== "object") continue;

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

            if (finalLabel && currentSettings.enabled) {
                txov(id, finalLabel);
            } else {
                removeTxov(id);
            }
        }
    }

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

    function showPrompt(mode, id, currentLabel) {
        promptMode = mode;
        promptItemId = id;
        const input = uiPromptWindow.querySelector('.zt-prompt-input');
        const title = uiPromptWindow.querySelector('.baddonz-window-title');

        title.innerText = mode === 'mass' ? 'Edytuj (Masowo)' : (mode === 'add' ? 'Dodaj Znacznik' : 'Edytuj Znacznik');
        input.value = currentLabel || '';

        uiPromptWindow.style.display = 'flex';
        uiPromptWindow.style.left = `${(window.innerWidth - uiPromptWindow.offsetWidth) / 2}px`;
        uiPromptWindow.style.top = `${(window.innerHeight - uiPromptWindow.offsetHeight) / 2}px`;
        input.focus();
    }

    function handlePromptSubmit() {
        const input = uiPromptWindow.querySelector('.zt-prompt-input');
        const newLabel = input.value.trim();
        const finalLabel = validateLabelInput(newLabel);

        const id = promptItemId;
        const item = window.Engine.items.getItemById(id);
        const tpMap = getTpMap(getItemTeleport(item));

        if (promptMode === 'add' || promptMode === 'edit') {
            if (finalLabel) {
                currentSettings.customLabels[id] = finalLabel;
                delete currentSettings.ignored_sign[id];
            } else if (newLabel === '') {
                delete currentSettings.customLabels[id];
                currentSettings.ignored_sign[id] = true;
            }
        } else if (promptMode === 'mass') {
            if (finalLabel) {
                currentSettings.teleportmass[tpMap] = { enabled: true, label: finalLabel };
            } else if (newLabel === '') {
                delete currentSettings.teleportmass[tpMap];
            }
        }

        saveSettings();
        applyLabelsToAllVisibleItems();
        uiPromptWindow.style.display = 'none';
    }

    function handleContextMenu(options, event) {
        const id = event.target?.className?.match(/item-id-(\d+)/)?.[1];
        if (!id) return;

        const item = window.Engine.items.getItemById(id);
        if (!item) return;

        const tp = getItemTeleport(item);
        const tpMap = getTpMap(tp);

        if (!tp && !(item._cachedStats && (item._cachedStats.custom_teleport || item._cachedStats.teleport))) return;

        const autoLabel = getAutoLabel(tp, tpMap);
        const hasCustomLabel = currentSettings.customLabels.hasOwnProperty(id);
        const isMassLabeledGlobally = currentSettings.teleportmass[tpMap]?.enabled === true;
        const currentMassLabel = currentSettings.teleportmass[tpMap]?.label;
        const isIgnoredSingularly = currentSettings.ignored_sign.hasOwnProperty(id);

        let currentLabelSource = 'none';

        if (isIgnoredSingularly) currentLabelSource = 'ignored';
        else if (hasCustomLabel) currentLabelSource = 'custom';
        else if (isMassLabeledGlobally) currentLabelSource = 'mass';
        else if (autoLabel) currentLabelSource = 'config';

        let menuOptionsToAdd = [];
        let spliceIndex = options.length - 1;

        const applyMass = (labelToApply) => {
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
        };

        const unMass = (labelToPersist) => {
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
        };

        if (autoLabel) {
            if (currentLabelSource === 'config') {
                menuOptionsToAdd.push(['Edytuj Podpis', () => showPrompt('edit', id, autoLabel), { button: { cls: 'menu-item--green' } }]);
                menuOptionsToAdd.push(['Usuń Podpis', () => { delete currentSettings.customLabels[id]; currentSettings.ignored_sign[id] = true; saveSettings(); applyLabelsToAllVisibleItems(); }, { button: { cls: 'menu-item--red' } }]);
            } else if (currentLabelSource === 'ignored') {
                menuOptionsToAdd.push(['Przywróć Domyślny', () => { delete currentSettings.ignored_sign[id]; delete currentSettings.customLabels[id]; saveSettings(); applyLabelsToAllVisibleItems(); }, { button: { cls: 'menu-item--green' } }]);
            } else if (currentLabelSource === 'custom') {
                menuOptionsToAdd.push(['Edytuj Podpis', () => showPrompt('edit', id, currentSettings.customLabels[id]), { button: { cls: 'menu-item--green' } }]);
                menuOptionsToAdd.push(['Zastosuj dla wszystkich', () => applyMass(currentSettings.customLabels[id] || autoLabel), { button: { cls: 'menu-item--green' } }]);
                menuOptionsToAdd.push(['Usuń Podpis', () => { delete currentSettings.customLabels[id]; currentSettings.ignored_sign[id] = true; saveSettings(); applyLabelsToAllVisibleItems(); }, { button: { cls: 'menu-item--red' } }]);
            } else if (currentLabelSource === 'mass') {
                menuOptionsToAdd.push(['Edytuj Podpisy', () => showPrompt('mass', id, currentMassLabel), { button: { cls: 'menu-item--green' } }]);
                menuOptionsToAdd.push(['Rozdziel podpisy', () => unMass(currentMassLabel), { button: { cls: 'menu-item--red' } }]);
                menuOptionsToAdd.push(['Usuń Podpis', () => { delete currentSettings.customLabels[id]; currentSettings.ignored_sign[id] = true; saveSettings(); applyLabelsToAllVisibleItems(); }, { button: { cls: 'menu-item--red' } }]);
            }
        } else {
            if (currentLabelSource === 'none' || currentLabelSource === 'ignored') {
                menuOptionsToAdd.push(['Dodaj Podpis', () => showPrompt('add', id, ''), { button: { cls: 'menu-item--green' } }]);
            } else if (currentLabelSource === 'custom') {
                menuOptionsToAdd.push(['Edytuj Podpis', () => showPrompt('edit', id, currentSettings.customLabels[id]), { button: { cls: 'menu-item--green' } }]);
                menuOptionsToAdd.push(['Zastosuj dla wszystkich', () => applyMass(currentSettings.customLabels[id]), { button: { cls: 'menu-item--green' } }]);
                menuOptionsToAdd.push(['Usuń Podpis', () => { delete currentSettings.customLabels[id]; saveSettings(); applyLabelsToAllVisibleItems(); }, { button: { cls: 'menu-item--red' } }]);
            } else if (currentLabelSource === 'mass') {
                menuOptionsToAdd.push(['Edytuj Podpisy', () => showPrompt('mass', id, currentMassLabel), { button: { cls: 'menu-item--green' } }]);
                menuOptionsToAdd.push(['Rozdziel podpisy', () => unMass(currentMassLabel), { button: { cls: 'menu-item--red' } }]);
                menuOptionsToAdd.push(['Usuń Podpis', () => { delete currentSettings.customLabels[id]; currentSettings.ignored_sign[id] = true; saveSettings(); applyLabelsToAllVisibleItems(); }, { button: { cls: 'menu-item--red' } }]);
            }
        }

        if (menuOptionsToAdd.length > 0) {
            options.splice(spliceIndex, 0, ...menuOptionsToAdd);
        }
    }

    function buildUI() {
        const promptBodyHtml = `
            <div class="baddonz-flex column centered">
                <input type="text" class="baddonz-input zt-prompt-input" maxlength="8" style="width: 100%; text-align: center;" autocomplete="off" placeholder="Podpis">
                <div class="baddonz-flex between" style="width: 100%; gap: 10px; margin-top: 5px;">
                    <button class="baddonz-button zt-prompt-cancel-btn" style="flex: 1;">Anuluj</button>
                    <button class="baddonz-button zt-prompt-ok-btn" style="flex: 1;">OK</button>
                </div>
            </div>
        `;
        uiPromptWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Znacznik", promptBodyHtml, { 
            width: '180px', 
            customId: 'baddonz-zt-prompt-wnd',
            hasSettings: false,
            hasCollapse: false,
            hasClose: true
        });
        uiPromptWindow.classList.add('baddonz-zt-prompt-wnd');
        uiPromptWindow.style.display = 'none';

        const input = uiPromptWindow.querySelector('.zt-prompt-input');
        const okBtn = uiPromptWindow.querySelector('.zt-prompt-ok-btn');
        const cancelBtn = uiPromptWindow.querySelector('.zt-prompt-cancel-btn');
        const closeBtn = uiPromptWindow.querySelector('.baddonz-close-button');

        okBtn.addEventListener('click', handlePromptSubmit);
        cancelBtn.addEventListener('click', () => uiPromptWindow.style.display = 'none');
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') handlePromptSubmit(); });
        
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            uiPromptWindow.style.display = 'none';
        });
    }

    function addonInit() {
        loadSettings();
        if (!uiPromptWindow) buildUI();

        if (!isIntercepted) {
            const originalParseJSON = window.Engine.communication.parseJSON;
            window.Engine.communication.parseJSON = function (data) {
                const res = originalParseJSON.apply(this, arguments);
                if (currentSettings.enabled && data.item) {
                    uiz(data.item);
                }
                return res;
            };

            const originalShowPopupMenu = window.Engine.interface.showPopupMenu;
            window.Engine.interface.showPopupMenu = function (options, event) {
                if (currentSettings.enabled) {
                    handleContextMenu(options, event);
                }
                return originalShowPopupMenu.apply(this, arguments);
            };

            isIntercepted = true;
        }

        if (currentSettings.enabled) applyLabelsToAllVisibleItems();
    }

    function addonStop() {
        if (uiPromptWindow) {
            uiPromptWindow.remove();
            uiPromptWindow = null;
        }
        removeAllLabels();
    }

    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        if (isEnabled) applyLabelsToAllVisibleItems();
        else removeAllLabels();
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
