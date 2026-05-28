// ==UserScript==
// @name          Szybka Grupa baddonz
// @version       1.0
// @description   Szybka Grupa
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function() {
    'use strict';

    const ADDON_ID = "ZAP";

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.id = "zap-custom-styles";
    styleSheet.innerText = `
        #baddonz-zap-wnd { width:195px; min-width:195px; }
        #baddonz-zap-wnd .baddonz-window-body { padding: 4px 6px 6px 6px !important; gap: 3px !important; }
        #baddonz-zap-wnd .baddonz-setting-row { margin-bottom: 2px !important; }
        #baddonz-zap-wnd .baddonz-text { font-size: 11px; }
        #baddonz-zap-wnd hr { margin: 3px 0 !important; }
        .baddonz-grid-3col { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px 5px; width: 100%; box-sizing: border-box; }
    `;
    if (!document.getElementById("zap-custom-styles")) document.head.appendChild(styleSheet);

    const MARGONEM_RELATIONS = {
        NONE: 1,
        FRIEND: 2,
        ENEMY: 3,
        CLAN: 4,
        CLAN_ALLY: 5,
        CLAN_ENEMY: 6
    };

    const PROFESSION_NAMES = {
        't': 'Tropiciel',
        'b': 'T. Ostrzy',
        'w': 'Wojownik',
        'p': 'Paladyn',
        'm': 'Mag',
        'h': 'Łowca'
    };

    let currentSettings = {
        enabled: true,
        windowOpacity: 2,
        windowVisible: true,
        inviteKey: "b",
        InviteRandoms: false,
        InviteNear: false,
        InvitebyLevel: false,
        minLevel: 0,
        maxLevel: 500,
        FilterbyProfession: false,
        SelectedProfessions: { 't': true, 'b': true, 'w': true, 'p': true, 'm': true, 'h': true },
        autoAcceptEnabled: true,
        acceptClan: true,
        acceptAlly: true,
        acceptFriend: true,
        acceptOthers: false,
        rejectUnchecked: false,
    };

    let uiWindowElement = null;
    let keybindInputActive = false;
    let isKeyDownBound = false;

    const partyInviteRegexPL = /Czy chcesz dołączyć do drużyny gracza <strong>(.+?)<\/strong>\?/;
    const partyInviteRegexEN = /Party invitation received from <strong>(.+?)<\/strong>\. Would you like to join\?/;

    function loadSettings() {
        if (window.BaddonzAPI) {
            const loaded = window.BaddonzAPI.getAddonSettings(ADDON_ID);
            currentSettings = { ...currentSettings, ...loaded };
            if (!currentSettings.SelectedProfessions) {
                currentSettings.SelectedProfessions = { 't': true, 'b': true, 'w': true, 'p': true, 'm': true, 'h': true };
            }
        }
    }

    function saveSettings() {
        if (window.BaddonzAPI) window.BaddonzAPI.saveAddonSettings(ADDON_ID, currentSettings);
    }

    function isChatFocused() {
        const el = document.activeElement;
        return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    }

    function isInParty(otherId) {
        if (!window.Engine || !window.Engine.party) return false;
        
        let members = null;
        if (typeof window.Engine.party.getMembers === 'function') {
            members = window.Engine.party.getMembers();
        } else if (window.Engine.party.d) {
            members = window.Engine.party.d;
        }

        if (!members) return false;

        if (members instanceof Map) {
            return members.has(otherId) || members.has(Number(otherId));
        } else if (Array.isArray(members)) {
            return members.some(p => p.id === otherId);
        } else if (typeof members === 'object') {
            return !!members[otherId];
        }
        return false;
    }

    function is_he_in_any_party(player) {
        return player && player.d && typeof player.d.pid === 'number' && player.d.pid > 0;
    }

    function isFriendlyRelation(player) {
        if (!player || typeof player.d?.relation !== 'number') return false;
        return [MARGONEM_RELATIONS.FRIEND, MARGONEM_RELATIONS.CLAN, MARGONEM_RELATIONS.CLAN_ALLY].includes(player.d.relation);
    }

    function isRandomOrEnemyRelation(player) {
        if (!player || typeof player.d?.relation !== 'number') return false;
        return [MARGONEM_RELATIONS.NONE, MARGONEM_RELATIONS.ENEMY, MARGONEM_RELATIONS.CLAN_ENEMY].includes(player.d.relation);
    }

    function isInRange(player, range) {
        if (!window.Engine.hero || !player || !player.d) return false;
        const heroX = typeof window.Engine.hero.d.rx !== 'undefined' ? window.Engine.hero.d.rx : window.Engine.hero.d.x;
        const heroY = typeof window.Engine.hero.d.ry !== 'undefined' ? window.Engine.hero.d.ry : window.Engine.hero.d.y;
        const playerX = typeof player.d.rx !== 'undefined' ? player.d.rx : player.d.x;
        const playerY = typeof player.d.ry !== 'undefined' ? player.d.ry : player.d.y;
        
        return Math.abs(heroX - playerX) <= range && Math.abs(heroY - playerY) <= range;
    }

    function getPlayersToInvite() {
        if (!window.Engine.others || typeof window.Engine.others.getDrawableList !== 'function') return [];
        
        const idInvites = [];
        const partyMemberNicks = new Set();

        if (window.Engine.party) {
            let members = typeof window.Engine.party.getMembers === 'function' ? window.Engine.party.getMembers() : window.Engine.party.d;
            if (members instanceof Map) {
                members.forEach(member => {
                    if (member && member.nick) partyMemberNicks.add(member.nick.toLowerCase());
                });
            } else if (members && typeof members === 'object') {
                for (const memberId in members) {
                    if (members[memberId] && members[memberId].nick) {
                        partyMemberNicks.add(members[memberId].nick.toLowerCase());
                    }
                }
            }
        }

        let playersOnMap = Object.values(window.Engine.others.getDrawableList()).filter(entry =>
            entry.isPlayer && entry.d && entry.d.id !== window.Engine.hero.d.id && !isInParty(entry.d.id) && !is_he_in_any_party(entry)
        );

        playersOnMap.forEach(player => {
            const lowerCasePlayerNick = player.d.nick.toLowerCase();
            if (partyMemberNicks.has(lowerCasePlayerNick)) return;
            if (idInvites.some(invite => invite.type === 'id' && invite.value === player.d.id)) return;

            let shouldInvite = true;

            if (isRandomOrEnemyRelation(player)) {
                if (!isInRange(player, 1)) shouldInvite = false;
                if (!currentSettings.InviteRandoms) shouldInvite = false;
            } else if (isFriendlyRelation(player)) {
                shouldInvite = true;
            } else {
                shouldInvite = false;
            }

            if (shouldInvite && currentSettings.InvitebyLevel) {
                const playerLevel = parseInt(player.d.lvl);
                const minLvl = parseInt(currentSettings.minLevel);
                const maxLvl = parseInt(currentSettings.maxLevel);
                if (isNaN(playerLevel) || playerLevel < minLvl || playerLevel > maxLvl) shouldInvite = false;
            }

            if (shouldInvite && currentSettings.FilterbyProfession) {
                const playerProf = player.d.prof;
                if (!currentSettings.SelectedProfessions[playerProf]) shouldInvite = false;
            }

            if (shouldInvite) {
                idInvites.push({ type: 'id', value: player.d.id });
            }
        });

        return idInvites;
    }

    function invitePlayer(inviteData) {
        if (!isChatFocused()) {
            if (inviteData.type === 'id') window._g("party&a=inv&id=" + inviteData.value);
        }
    }

    function Ginvite() {
        if (!currentSettings.enabled) return;
        const playersToInvite = getPlayersToInvite();
        playersToInvite.forEach(inviteData => invitePlayer(inviteData));
    }

    function handleNewAsk(eventData) {
        if (!currentSettings.autoAcceptEnabled) return;

        if (eventData && Array.isArray(eventData) && eventData[0] && typeof eventData[0].q === 'string' && typeof eventData[0].re === 'string' && eventData[0].re.startsWith("party&a=accept")) {
            const questionText = eventData[0].q;
            let inviterNick = null;

            let match = questionText.match(partyInviteRegexPL) || questionText.match(partyInviteRegexEN);

            if (match && match[1]) {
                inviterNick = match[1].trim();
                let foundInviter = null;
                
                if (window.Engine && window.Engine.others && typeof window.Engine.others.getDrawableList === 'function') {
                    const drawableList = window.Engine.others.getDrawableList();
                    for (const id in drawableList) {
                        const player = drawableList[id];
                        if (player.isPlayer && player.d && player.d.nick && player.d.nick.toLowerCase() === inviterNick.toLowerCase()) {
                            foundInviter = player;
                            break;
                        }
                    }
                }

                if (foundInviter) {
                    const inviterRelation = foundInviter.d.relation;
                    let shouldAccept = false;
                    let shouldReject = false;

                    if (currentSettings.acceptClan && inviterRelation === MARGONEM_RELATIONS.CLAN) shouldAccept = true;
                    if (currentSettings.acceptAlly && inviterRelation === MARGONEM_RELATIONS.CLAN_ALLY) shouldAccept = true;
                    if (currentSettings.acceptFriend && inviterRelation === MARGONEM_RELATIONS.FRIEND) shouldAccept = true;
                    if (currentSettings.acceptOthers && (inviterRelation === MARGONEM_RELATIONS.NONE || inviterRelation === MARGONEM_RELATIONS.ENEMY || inviterRelation === MARGONEM_RELATIONS.CLAN_ENEMY)) shouldAccept = true;

                    if (shouldAccept) {
                        window._g(eventData[0].re + "1");
                    } else if (currentSettings.rejectUnchecked) {
                        shouldReject = true;
                        window._g(eventData[0].re + "0");
                    }

                    if (shouldAccept || shouldReject) {
                        if (typeof window.closeModal === "function") window.closeModal();
                        if (eventData[1] && eventData[1].$ && typeof eventData[1].$.remove === 'function') {
                            eventData[1].$.remove();
                            if (eventData[1].$backdrop && typeof eventData[1].$backdrop.remove === 'function') {
                                eventData[1].$backdrop.remove();
                            }
                        }
                    }
                }
            }
        }
    }

    function handleKeyDown(e) {
        if (!currentSettings.enabled) return;
        const zapKeybindInput = uiWindowElement ? uiWindowElement.querySelector("#zap-keybind-input") : null;

        if (keybindInputActive && zapKeybindInput) {
            e.preventDefault();
            const pressedKey = e.key.toLowerCase();
            if (['escape', 'enter', 'tab', 'shift', 'control', 'alt', 'meta', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'capslock', 'numlock', 'scrolllock'].includes(pressedKey)) {
                if (['escape', 'enter', 'tab'].includes(pressedKey)) zapKeybindInput.blur();
                return;
            }

            if (pressedKey === ' ') {
                currentSettings.inviteKey = "space";
                zapKeybindInput.value = "[SPACJA]";
            } else if (pressedKey.length === 1) {
                currentSettings.inviteKey = pressedKey;
                zapKeybindInput.value = pressedKey.toUpperCase();
            } else {
                return;
            }

            saveSettings();
            keybindInputActive = false;
            zapKeybindInput.blur();
            zapKeybindInput.classList.remove('active-keybind-mode');
            return;
        }

        if (!isChatFocused() && e.key.toLowerCase() === currentSettings.inviteKey) {
            e.preventDefault();
            Ginvite();
        }
    }

    function buildUI() {
        const createProfessionsCheckboxes = () => {
            let html = '';
            Object.keys(PROFESSION_NAMES).forEach(code => {
                html += `
                    <div class="baddonz-label-wrapper" style="justify-content: flex-start; align-items: center; gap: 4px;">
                        <div class="baddonz-checkbox" id="prof-checkbox-${code}"></div>
                        <div class="baddonz-text" style="padding: 0; font-size: 11px;" title="${PROFESSION_NAMES[code]}">${code.toUpperCase()}</div>
                    </div>
                `;
            });
            return html;
        };

        const bodyHtml = `
            <div class="baddonz-setting-row" style="margin-bottom: 4px !important; display: flex; align-items: center;">
                <div class="baddonz-checkbox ${currentSettings.enabled ? 'active' : ''}" id="zap-checkbox"></div>
                <span class="baddonz-text" style="padding: 0; margin-left: 5px;">Szybka Grupa</span>
                <input type="text" class="baddonz-input keybind" id="zap-keybind-input" value="${currentSettings.inviteKey === "space" ? "[SPACJA]" : currentSettings.inviteKey.toUpperCase()}" readonly style="width: 50px; height: 20px; line-height: 18px; font-size: 11px; padding: 1px 0; margin-left: auto;">
            </div>

            <div class="baddonz-setting-row">
                <div class="baddonz-checkbox ${currentSettings.InviteRandoms ? 'active' : ''}" id="zap-randoms-checkbox" title="Zapraszaj wszystkich graczy"></div>
                <span class="baddonz-text" style="padding:0;">Zapraszaj randomów obok</span>
            </div>

            <div class="baddonz-setting-row">
                <div class="baddonz-checkbox ${currentSettings.InviteNear ? 'active' : ''}" id="zap-from-square-checkbox" title="Przydatne na tytanów"></div>
                <span class="baddonz-text" style="padding:0;">Grupa z kratki (inne relacje)</span>
            </div>

            <div class="baddonz-setting-row">
                <div class="baddonz-checkbox ${currentSettings.InvitebyLevel ? 'active' : ''}" id="zap-by-level-checkbox"></div>
                <span class="baddonz-text" style="padding:0;">Grupa po levelu</span>
            </div>

            <div id="zap-level-range-section" style="display: ${currentSettings.InvitebyLevel ? 'flex' : 'none'}; flex-direction: row; align-items: center; justify-content: center; gap: 5px; margin-bottom: 2px; width: 100%;">
                <input type="number" class="baddonz-input compact" id="zap-min-level-input" value="${currentSettings.minLevel}" min="0" max="500" placeholder="Od" style="width: 45px; margin: 0;">
                <span style="color: #fff; font-size: 16px; line-height: 1;">-</span>
                <input type="number" class="baddonz-input compact" id="zap-max-level-input" value="${currentSettings.maxLevel}" min="0" max="500" placeholder="Do" style="width: 45px; margin: 0;">
            </div>

            <div class="baddonz-setting-row">
                <div class="baddonz-checkbox ${currentSettings.FilterbyProfession ? 'active' : ''}" id="zap-filter-by-profession-checkbox"></div>
                <span class="baddonz-text" style="padding:0;">Grupa po profesjach</span>
            </div>

            <div id="zap-profession-filter-section" class="baddonz-grid-3col" style="display: ${currentSettings.FilterbyProfession ? 'grid' : 'none'}; width: 100%; margin-bottom: 2px;">
                ${createProfessionsCheckboxes()}
            </div>

            <hr style="width: 100%; border-color: #303030;">

            <div class="baddonz-setting-row">
                <div class="baddonz-checkbox ${currentSettings.autoAcceptEnabled ? 'active' : ''}" id="zap-auto-accept-checkbox"></div>
                <span class="baddonz-text" style="padding:0;">Auto akceptacja zaproszeń</span>
            </div>

            <div id="zap-accept-options-section" class="baddonz-flex column" style="display: ${currentSettings.autoAcceptEnabled ? 'flex' : 'none'}; width: 100%; gap: 2px;">
                <div class="baddonz-grid-2col">
                    <div class="baddonz-label-wrapper"><div class="baddonz-checkbox ${currentSettings.acceptFriend ? 'active' : ''}" id="accept-friend-checkbox"></div><span class="baddonz-text">Znaj</span></div>
                    <div class="baddonz-label-wrapper"><div class="baddonz-checkbox ${currentSettings.acceptAlly ? 'active' : ''}" id="accept-ally-checkbox"></div><span class="baddonz-text">Sojusz</span></div>
                    <div class="baddonz-label-wrapper"><div class="baddonz-checkbox ${currentSettings.acceptClan ? 'active' : ''}" id="accept-clan-checkbox"></div><span class="baddonz-text">Klan</span></div>
                    <div class="baddonz-label-wrapper"><div class="baddonz-checkbox ${currentSettings.acceptOthers ? 'active' : ''}" id="accept-others-checkbox"></div><span class="baddonz-text">Obcy</span></div>
                </div>
                <div class="baddonz-setting-row" style="margin-top: 2px; margin-bottom: 0;">
                    <div class="baddonz-checkbox ${currentSettings.rejectUnchecked ? 'active' : ''}" id="reject-unchecked-checkbox"></div>
                    <span class="baddonz-text" style="padding:0;">Odrzucaj zaproszenia</span>
                </div>
            </div>
        `;

        uiWindowElement = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Szybka Grupa", bodyHtml, {
            width: '195px',
            customId: 'baddonz-zap-wnd',
            hasSettings: false,
            hasCollapse: false
        });

        const zapCheckbox = uiWindowElement.querySelector("#zap-checkbox");
        const zapKeybindInput = uiWindowElement.querySelector("#zap-keybind-input");

        const zapRandomsCheckbox = uiWindowElement.querySelector("#zap-randoms-checkbox");
        const zapFromSquareCheckbox = uiWindowElement.querySelector("#zap-from-square-checkbox");
        const zapByLevelCheckbox = uiWindowElement.querySelector("#zap-by-level-checkbox");
        const zapLevelRangeSection = uiWindowElement.querySelector("#zap-level-range-section");
        const zapMinLevelInput = uiWindowElement.querySelector("#zap-min-level-input");
        const zapMaxLevelInput = uiWindowElement.querySelector("#zap-max-level-input");
        
        const zapFilterByProfessionCheckbox = uiWindowElement.querySelector("#zap-filter-by-profession-checkbox");
        const zapProfessionFilterSection = uiWindowElement.querySelector("#zap-profession-filter-section");

        const autoAcceptCheckbox = uiWindowElement.querySelector("#zap-auto-accept-checkbox");
        const acceptOptionsSection = uiWindowElement.querySelector("#zap-accept-options-section");
        const acceptClanCheckbox = uiWindowElement.querySelector("#accept-clan-checkbox");
        const acceptAllyCheckbox = uiWindowElement.querySelector("#accept-ally-checkbox");
        const acceptFriendCheckbox = uiWindowElement.querySelector("#accept-friend-checkbox");
        const acceptOthersCheckbox = uiWindowElement.querySelector("#accept-others-checkbox");
        const rejectUncheckedCheckbox = uiWindowElement.querySelector("#reject-unchecked-checkbox");

        zapCheckbox.addEventListener('click', () => {
            currentSettings.enabled = zapCheckbox.classList.toggle('active');
            saveSettings();
        });

        zapKeybindInput.addEventListener('click', () => {
            keybindInputActive = true;
            zapKeybindInput.focus();
            zapKeybindInput.classList.add('active-keybind-mode');
        });

        zapKeybindInput.addEventListener('focusout', () => {
            if (keybindInputActive) {
                keybindInputActive = false;
                zapKeybindInput.value = currentSettings.inviteKey === "space" ? "[SPACJA]" : currentSettings.inviteKey.toUpperCase();
            }
            zapKeybindInput.classList.remove('active-keybind-mode');
        });

        zapRandomsCheckbox.addEventListener('click', () => { currentSettings.InviteRandoms = zapRandomsCheckbox.classList.toggle('active'); saveSettings(); });
        zapFromSquareCheckbox.addEventListener('click', () => { currentSettings.InviteNear = zapFromSquareCheckbox.classList.toggle('active'); saveSettings(); });
        
        zapByLevelCheckbox.addEventListener('click', () => { 
            currentSettings.InvitebyLevel = zapByLevelCheckbox.classList.toggle('active'); 
            zapLevelRangeSection.style.display = currentSettings.InvitebyLevel ? 'flex' : 'none';
            saveSettings(); 
        });

        const handleLevelChange = (el, key) => {
            let val = parseInt(el.value);
            if (isNaN(val) || val < 0) val = 0;
            if (val > 500) val = 500;
            el.value = val;
            currentSettings[key] = val;
            saveSettings();
        };

        zapMinLevelInput.addEventListener('change', (e) => handleLevelChange(e.target, 'minLevel'));
        zapMaxLevelInput.addEventListener('change', (e) => handleLevelChange(e.target, 'maxLevel'));

        zapFilterByProfessionCheckbox.addEventListener('click', () => {
            currentSettings.FilterbyProfession = zapFilterByProfessionCheckbox.classList.toggle('active');
            zapProfessionFilterSection.style.display = currentSettings.FilterbyProfession ? 'grid' : 'none';
            saveSettings();
        });

        Object.keys(PROFESSION_NAMES).forEach(profCode => {
            const checkbox = uiWindowElement.querySelector(`#prof-checkbox-${profCode}`);
            if (checkbox) {
                if (currentSettings.SelectedProfessions[profCode]) checkbox.classList.add('active');
                checkbox.addEventListener('click', () => {
                    currentSettings.SelectedProfessions[profCode] = checkbox.classList.toggle('active');
                    saveSettings();
                });
            }
        });

        autoAcceptCheckbox.addEventListener('click', () => {
            currentSettings.autoAcceptEnabled = autoAcceptCheckbox.classList.toggle('active');
            acceptOptionsSection.style.display = currentSettings.autoAcceptEnabled ? 'flex' : 'none';
            saveSettings();
        });

        acceptClanCheckbox.addEventListener('click', () => { currentSettings.acceptClan = acceptClanCheckbox.classList.toggle('active'); saveSettings(); });
        acceptAllyCheckbox.addEventListener('click', () => { currentSettings.acceptAlly = acceptAllyCheckbox.classList.toggle('active'); saveSettings(); });
        acceptFriendCheckbox.addEventListener('click', () => { currentSettings.acceptFriend = acceptFriendCheckbox.classList.toggle('active'); saveSettings(); });
        acceptOthersCheckbox.addEventListener('click', () => { currentSettings.acceptOthers = acceptOthersCheckbox.classList.toggle('active'); saveSettings(); });
        rejectUncheckedCheckbox.addEventListener('click', () => { currentSettings.rejectUnchecked = rejectUncheckedCheckbox.classList.toggle('active'); saveSettings(); });
    }

    function addonInit() {
        loadSettings();
        if (!uiWindowElement) buildUI();

        if (!isKeyDownBound) {
            document.addEventListener('keydown', handleKeyDown);
            isKeyDownBound = true;
        }

        if (typeof window.API !== 'undefined' && typeof window.Engine.apiData !== 'undefined' && window.Engine.apiData.NEW_ASK) {
            window.API.addCallbackToEvent(window.Engine.apiData.NEW_ASK, handleNewAsk);
        }
    }

    function addonStop() {
        if (isKeyDownBound) {
            document.removeEventListener('keydown', handleKeyDown);
            isKeyDownBound = false;
        }
        if (uiWindowElement) {
            uiWindowElement.remove();
            uiWindowElement = null;
        }
    }

    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        if (uiWindowElement) {
            const zapCheckbox = uiWindowElement.querySelector("#zap-checkbox");
            if (zapCheckbox) {
                if (isEnabled) zapCheckbox.classList.add('active');
                else zapCheckbox.classList.remove('active');
            }
        }
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
