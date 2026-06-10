// ==UserScript==
// @name          Znacznik Teleportów baddonz
// @version       10.06.2026
// @description   Znacznik Teleportów
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function () {
    'use strict';

    const ADDON_ID = "ZT";

    const config = {
        "610": "D.AUK", "1224": "KENDAL", "630": "PORT", "1297": "TRIST",
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

    let uiAddWindow = null;
    let uiEditWindow = null;
    let uiMassEditWindow = null;
    let currentItemId = null;
    let observer = null;
    let isMenuIntercepted = false;

    function loadSettings() {
        if (!window.BaddonzAPI) return;
        const saved = window.BaddonzAPI.getAddonSettings(ADDON_ID);
        currentSettings = { ...currentSettings, ...saved };
        if (!currentSettings.customLabels) currentSettings.customLabels = {};
        if (!currentSettings.teleportmass) currentSettings.teleportmass = {};
        if (!currentSettings.ignored_sign) currentSettings.ignored_sign = {};
    }

    function saveSettings() {
        if (!window.BaddonzAPI) return;
        window.BaddonzAPI.saveAddonSettings(ADDON_ID, { ...currentSettings });
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

    function getItemTeleport(it) {
        if (!it) return "";
        const stats = it._cachedStats || parseStats(it.stat || it.stats || "");
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

    function _addSpanToElement(el, text) {
        let tz = el.querySelector(".znacznik-teleport");
        if (tz && tz.innerText === text) return;

        if (!tz) {
            tz = document.createElement("span");
            tz.className = "znacznik-teleport";
            el.appendChild(tz);
        }

        tz.innerText = text;
        Object.assign(tz.style, {
            position: "absolute", top: "0", left: "0",
            width: "100%", height: "100%", color: "#fff",
            fontSize: `${text.replace(/\s/g, '').length < 5 ? 9 : 8}px`,
            textAlign: "center", lineHeight: "1.5",
            textShadow: `-2px -2px 0 black, -1px -2px 0 black, 0px -2px 0 black, 1px -2px 0 black, 2px -2px 0 black, -2px -1px 0 black, 2px -1px 0 black, -2px 0px 0 black, 2px 0px 0 black, -2px 1px 0 black, 2px 1px 0 black, -2px 2px 0 black, -1px 2px 0 black, 0px 2px 0 black, 1px 2px 0 black, 2px 2px 0 black`,
            fontFamily: "'Arial Black', Gadget, sans-serif",
            userSelect: "none", pointerEvents: "none",
            textRendering: "optimizeLegibility",
            zIndex: "2"
        });
    }

    function removeAllTxov() {
        document.querySelectorAll('.znacznik-teleport').forEach(el => el.remove());
    }

    function applyMarkerToElement(el) {
        if (!currentSettings.enabled) return;
        if (!el || el.nodeType !== 1) return;

        let $el = $(el);
        let itemData = $el.data('item');

        let idMatch = el.className.match(/item-id-(\d+)/);
        let id = idMatch ? idMatch[1] : null;

        if (!itemData && id && window.Engine && window.Engine.items) {
            itemData = window.Engine.items.getItemById(id);
        }

        if (!itemData || !id) return;

        const tp = getItemTeleport(itemData);
        if (!tp) {
            let tz = el.querySelector(".znacznik-teleport");
            if (tz) tz.remove();
            return;
        }

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
            _addSpanToElement(el, finalLabel);
        } else {
            let tz = el.querySelector(".znacznik-teleport");
            if (tz) tz.remove();
        }
    }

    function applyLabelsToAllVisibleItems() {
        if (!currentSettings.enabled) {
            removeAllTxov();
            return;
        }
        document.querySelectorAll('.item').forEach(applyMarkerToElement);
    }

    const intercept = (obj, key, cb) => {
        const _orig = obj[key];
        obj[key] = function (...args) {
            cb(...args);
            return _orig.apply(this, args);
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

    function centerWindow(windowElement) {
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const windowWidth = windowElement.offsetWidth || 200;
        const windowHeight = windowElement.offsetHeight || 100;
        windowElement.style.left = `${(screenWidth - windowWidth) / 2}px`;
        windowElement.style.top = `${(screenHeight - windowHeight) / 2}px`;
    }

    function buildUI() {
        const actionBodyHtml = `
            <div class="baddonz-flex column centered" style="padding: 5px;">
                <input type="text" class="baddonz-input zt-action-input" maxlength="8" style="width: 100%; text-align: center;" autocomplete="off">
                <div class="baddonz-flex between" style="width: 100%; gap: 10px; margin-top: 10px;">
                    <button class="baddonz-button zt-action-cancel-btn" style="flex: 1;">Anuluj</button>
                    <button class="baddonz-button zt-action-ok-btn" style="flex: 1;">OK</button>
                </div>
            </div>
        `;

        uiAddWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Dodaj Znacznik", actionBodyHtml, { width: '200px', customId: 'baddonz-zt-wnd-add', hasSettings: false, hasCollapse: false, hasClose: true });
        uiEditWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Edytuj Znacznik", actionBodyHtml, { width: '200px', customId: 'baddonz-zt-wnd-edit', hasSettings: false, hasCollapse: false, hasClose: true });
        uiMassEditWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Edytuj Podpisy", actionBodyHtml, { width: '200px', customId: 'baddonz-zt-wnd-mass', hasSettings: false, hasCollapse: false, hasClose: true });

        uiAddWindow.classList.add('baddonz-zt-wnd-add');
        uiEditWindow.classList.add('baddonz-zt-wnd-edit');
        uiMassEditWindow.classList.add('baddonz-zt-wnd-mass');

        // Okna tymczasowe — zawsze startują ukryte, nie zapisujemy ich widoczności
        uiAddWindow.style.display = 'none';
        uiEditWindow.style.display = 'none';
        uiMassEditWindow.style.display = 'none';

        const addInput = uiAddWindow.querySelector('.zt-action-input');
        const editInput = uiEditWindow.querySelector('.zt-action-input');
        const massEditInput = uiMassEditWindow.querySelector('.zt-action-input');

        uiAddWindow.querySelector('.baddonz-close-button').addEventListener('click', () => uiAddWindow.style.display = 'none');
        uiEditWindow.querySelector('.baddonz-close-button').addEventListener('click', () => uiEditWindow.style.display = 'none');
        uiMassEditWindow.querySelector('.baddonz-close-button').addEventListener('click', () => uiMassEditWindow.style.display = 'none');

        uiAddWindow.querySelector('.zt-action-cancel-btn').addEventListener('click', () => uiAddWindow.style.display = 'none');
        uiEditWindow.querySelector('.zt-action-cancel-btn').addEventListener('click', () => uiEditWindow.style.display = 'none');
        uiMassEditWindow.querySelector('.zt-action-cancel-btn').addEventListener('click', () => uiMassEditWindow.style.display = 'none');

        const handleAdd = () => {
            const finalLabel = validateLabelInput(addInput.value.trim());
            if (finalLabel) {
                currentSettings.customLabels[currentItemId] = finalLabel;
                delete currentSettings.ignored_sign[currentItemId];
                saveSettings(); applyLabelsToAllVisibleItems();
                uiAddWindow.style.display = 'none';
            } else if (addInput.value.trim() === '') uiAddWindow.style.display = 'none';
        };

        const handleEdit = () => {
            const finalLabel = validateLabelInput(editInput.value.trim());
            if (finalLabel) {
                currentSettings.customLabels[currentItemId] = finalLabel;
                delete currentSettings.ignored_sign[currentItemId];
                saveSettings(); applyLabelsToAllVisibleItems();
                uiEditWindow.style.display = 'none';
            } else if (editInput.value.trim() === '') {
                delete currentSettings.customLabels[currentItemId];
                currentSettings.ignored_sign[currentItemId] = true;
                saveSettings(); applyLabelsToAllVisibleItems();
                uiEditWindow.style.display = 'none';
            }
        };

        const handleMassEdit = () => {
            const finalLabel = validateLabelInput(massEditInput.value.trim());
            
            let el = document.querySelector(`.item-id-${currentItemId}`);
            let item = el ? $(el).data('item') : null;
            if (!item && window.Engine.items) item = window.Engine.items.getItemById(currentItemId);

            const tp = getItemTeleport(item);
            const tpMap = getTpMap(tp);

            if (finalLabel) {
                currentSettings.teleportmass[tpMap] = { enabled: true, label: finalLabel };
                saveSettings(); applyLabelsToAllVisibleItems();
                uiMassEditWindow.style.display = 'none';
            } else if (massEditInput.value.trim() === '') {
                delete currentSettings.teleportmass[tpMap];
                saveSettings(); applyLabelsToAllVisibleItems();
                uiMassEditWindow.style.display = 'none';
            }
        };

        uiAddWindow.querySelector('.zt-action-ok-btn').addEventListener('click', handleAdd);
        addInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAdd(); });

        uiEditWindow.querySelector('.zt-action-ok-btn').addEventListener('click', handleEdit);
        editInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleEdit(); });

        uiMassEditWindow.querySelector('.zt-action-ok-btn').addEventListener('click', handleMassEdit);
        massEditInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleMassEdit(); });
    }

    function showWindow(wnd, input, id, initialValue = '') {
        currentItemId = id;
        input.value = initialValue;
        wnd.style.display = 'flex';
        centerWindow(wnd);
        wnd.dispatchEvent(new Event('mousedown'));
        input.focus();
    }

    function addonInit() {
        loadSettings();
        if (!uiAddWindow) buildUI();

        if (!observer) {
            observer = new MutationObserver((mutations) => {
                if (!currentSettings.enabled) return;
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) {
                            if (node.classList && node.classList.contains('item')) {
                                applyMarkerToElement(node);
                            }
                            if (node.querySelectorAll) {
                                node.querySelectorAll('.item').forEach(applyMarkerToElement);
                            }
                        }
                    });
                });
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }

        if (!isMenuIntercepted) {
            intercept(window.Engine.interface, 'showPopupMenu', (options, event) => {
                if (!currentSettings.enabled) return;

                let target = event.target;
                let $itemEl = $(target).closest('.item');
                if (!$itemEl.length && target.classList.contains('item')) {
                    $itemEl = $(target);
                }

                const idMatch = $itemEl.attr('class')?.match(/item-id-(\d+)/);
                const id = idMatch ? idMatch[1] : null;
                if (!id) return;

                let item = $itemEl.data('item');
                if (!item && window.Engine.items) {
                    item = window.Engine.items.getItemById(id);
                }
                
                if (!item) return;

                const tp = getItemTeleport(item);
                if (!tp) return;

                const tpMap = getTpMap(tp);
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

                const stats = item._cachedStats || parseStats(item.stat || item.stats || "");

                if (tp && (stats.custom_teleport || stats.teleport)) {
                    if (autoLabel) {
                        if (currentLabelSource === 'config') {
                            menuOptionsToAdd.push(['Edytuj Podpis', () => showWindow(uiEditWindow, uiEditWindow.querySelector('.zt-action-input'), id, autoLabel), { button: { cls: 'menu-item--green' } }]);
                            menuOptionsToAdd.push(['Usuń Podpis', () => {
                                delete currentSettings.customLabels[id];
                                currentSettings.ignored_sign[id] = true;
                                saveSettings(); applyLabelsToAllVisibleItems();
                            }, { button: { cls: 'menu-item--red' } }]);
                        }
                        else if (currentLabelSource === 'ignored') {
                            menuOptionsToAdd.push(['Przywróć Domyślny Podpis', () => {
                                delete currentSettings.ignored_sign[id];
                                delete currentSettings.customLabels[id];
                                saveSettings(); applyLabelsToAllVisibleItems();
                            }, { button: { cls: 'menu-item--green' } }]);
                        }
                        else if (currentLabelSource === 'custom') {
                            menuOptionsToAdd.push(['Edytuj Podpis', () => showWindow(uiEditWindow, uiEditWindow.querySelector('.zt-action-input'), id, currentSettings.customLabels[id]), { button: { cls: 'menu-item--green' } }]);
                            menuOptionsToAdd.push(['Podpisanie tych samych mapek teleportu', () => {
                                let labelToApply = currentSettings.customLabels[id] || autoLabel;
                                if (labelToApply) {
                                    currentSettings.teleportmass[tpMap] = { enabled: true, label: labelToApply };
                                    if (window.Engine && window.Engine.items && window.Engine.items.fetchLocationItems) {
                                        window.Engine.items.fetchLocationItems("g").forEach(it => {
                                            if (getTpMap(getItemTeleport(it)) === tpMap) {
                                                delete currentSettings.customLabels[it.id];
                                                delete currentSettings.ignored_sign[it.id];
                                            }
                                        });
                                    }
                                    saveSettings(); applyLabelsToAllVisibleItems();
                                }
                            }, { button: { cls: 'menu-item--green' } }]);
                            menuOptionsToAdd.push(['Usuń Podpis', () => {
                                delete currentSettings.customLabels[id];
                                currentSettings.ignored_sign[id] = true;
                                saveSettings(); applyLabelsToAllVisibleItems();
                            }, { button: { cls: 'menu-item--red' } }]);
                        }
                        else if (currentLabelSource === 'mass') {
                            menuOptionsToAdd.push(['Edytuj Podpisy', () => showWindow(uiMassEditWindow, uiMassEditWindow.querySelector('.zt-action-input'), id, currentMassLabel), { button: { cls: 'menu-item--green' } }]);
                            menuOptionsToAdd.push(['Podpisywanie tych samych mapek teleportu', () => {
                                const labelToPersist = currentMassLabel;
                                delete currentSettings.teleportmass[tpMap];
                                if (window.Engine && window.Engine.items && window.Engine.items.fetchLocationItems) {
                                    window.Engine.items.fetchLocationItems("g").forEach(it => {
                                        if (getTpMap(getItemTeleport(it)) === tpMap) {
                                            if (it.id === id) {
                                                currentSettings.customLabels[it.id] = labelToPersist;
                                                delete currentSettings.ignored_sign[it.id];
                                            } else {
                                                delete currentSettings.customLabels[it.id];
                                                delete currentSettings.ignored_sign[it.id];
                                            }
                                        }
                                    });
                                }
                                saveSettings(); applyLabelsToAllVisibleItems();
                            }, { button: { cls: 'menu-item--red' } }]);
                            menuOptionsToAdd.push(['Usuń Podpis', () => {
                                delete currentSettings.customLabels[id];
                                currentSettings.ignored_sign[id] = true;
                                saveSettings(); applyLabelsToAllVisibleItems();
                            }, { button: { cls: 'menu-item--red' } }]);
                        }
                    } else {
                        if (currentLabelSource === 'none' || currentLabelSource === 'ignored') {
                            menuOptionsToAdd.push(['Dodaj Podpis', () => showWindow(uiAddWindow, uiAddWindow.querySelector('.zt-action-input'), id), { button: { cls: 'menu-item--green' } }]);
                        }
                        else if (currentLabelSource === 'custom') {
                            menuOptionsToAdd.push(['Edytuj Podpis', () => showWindow(uiEditWindow, uiEditWindow.querySelector('.zt-action-input'), id, currentSettings.customLabels[id]), { button: { cls: 'menu-item--green' } }]);
                            menuOptionsToAdd.push(['Podpisanie tych samych mapek teleportu', () => {
                                let labelToApply = currentSettings.customLabels[id];
                                if (labelToApply) {
                                    currentSettings.teleportmass[tpMap] = { enabled: true, label: labelToApply };
                                    if (window.Engine && window.Engine.items && window.Engine.items.fetchLocationItems) {
                                        window.Engine.items.fetchLocationItems("g").forEach(it => {
                                            if (getTpMap(getItemTeleport(it)) === tpMap) {
                                                delete currentSettings.customLabels[it.id];
                                                delete currentSettings.ignored_sign[it.id];
                                            }
                                        });
                                    }
                                    saveSettings(); applyLabelsToAllVisibleItems();
                                }
                            }, { button: { cls: 'menu-item--green' } }]);
                            menuOptionsToAdd.push(['Usuń Podpis', () => {
                                delete currentSettings.customLabels[id];
                                saveSettings(); applyLabelsToAllVisibleItems();
                            }, { button: { cls: 'menu-item--red' } }]);
                        }
                        else if (currentLabelSource === 'mass') {
                             menuOptionsToAdd.push(['Edytuj Podpisy', () => showWindow(uiMassEditWindow, uiMassEditWindow.querySelector('.zt-action-input'), id, currentMassLabel), { button: { cls: 'menu-item--green' } }]);
                             menuOptionsToAdd.push(['Podpisywanie tych samych mapek teleportu', () => {
                                const labelToPersist = currentMassLabel;
                                delete currentSettings.teleportmass[tpMap];
                                if (window.Engine && window.Engine.items && window.Engine.items.fetchLocationItems) {
                                    window.Engine.items.fetchLocationItems("g").forEach(it => {
                                        if (getTpMap(getItemTeleport(it)) === tpMap) {
                                            if (it.id === id) {
                                                currentSettings.customLabels[it.id] = labelToPersist;
                                                delete currentSettings.ignored_sign[it.id];
                                            } else {
                                                delete currentSettings.customLabels[it.id];
                                                delete currentSettings.ignored_sign[it.id];
                                            }
                                        }
                                    });
                                }
                                saveSettings(); applyLabelsToAllVisibleItems();
                            }, { button: { cls: 'menu-item--red' } }]);
                            menuOptionsToAdd.push(['Usuń Podpis', () => {
                                delete currentSettings.customLabels[id];
                                currentSettings.ignored_sign[id] = true;
                                saveSettings(); applyLabelsToAllVisibleItems();
                            }, { button: { cls: 'menu-item--red' } }]);
                        }
                    }
                    if (menuOptionsToAdd.length > 0) options.splice(spliceIndex, 0, ...menuOptionsToAdd);
                }
            });
            isMenuIntercepted = true;
        }

        setTimeout(applyLabelsToAllVisibleItems, 500);
    }

    function addonStop() {
        removeAllTxov();
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        if (uiAddWindow) { uiAddWindow.remove(); uiAddWindow = null; }
        if (uiEditWindow) { uiEditWindow.remove(); uiEditWindow = null; }
        if (uiMassEditWindow) { uiMassEditWindow.remove(); uiMassEditWindow = null; }
    }

    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        if (isEnabled) applyLabelsToAllVisibleItems();
        else removeAllTxov();
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
