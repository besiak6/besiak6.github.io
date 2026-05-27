// ==UserScript==
// @name          Szybka Grupa baddonz
// @version       2.3.0
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function() {
    'use strict';

    const ADDON_ID = "ZAP";

    const MARGONEM_RELATIONS = {
        NONE: 1, FRIEND: 2, ENEMY: 3, CLAN: 4, CLAN_ALLY: 5, CLAN_ENEMY: 6
    };

    const PROFESSION_NAMES = {
        't': 'Tropiciel', 'b': 'T. Ostrzy', 'w': 'Wojownik', 'p': 'Paladyn', 'm': 'Mag', 'h': 'Łowca'
    };

    let currentSettings = {
        enabled: true,
        windowOpacity: 2,
        windowVisible: true,
        isExpanded: false,
        inviteKey: "b",
        InviteRandoms: false,
        InviteNear: false,
        InvitebyLevel: false,
        minLevel: 0,
        maxLevel: 500,
        InvitebyNick: false,
        specificNicksList: [],
        FilterbyProfession: false,
        SelectedProfessions: { 't': true, 'b': true, 'w': true, 'p': true, 'm': true, 'h': true },
        autoAcceptEnabled: true,
        acceptClan: true,
        acceptAlly: true,
        acceptFriend: true,
        acceptOthers: false,
        rejectUnchecked: false
    };

    let uiWindowElement = null;
    let keybindInputActive = false;
    let isKeyDownBound = false;
    let isNewAskBound = false;

    function loadSettings() {
        if (window.BaddonzAPI) {
            const loaded = window.BaddonzAPI.getAddonSettings(ADDON_ID);
            currentSettings = { ...currentSettings, ...loaded };
            if (!currentSettings.SelectedProfessions) currentSettings.SelectedProfessions = { 't': true, 'b': true, 'w': true, 'p': true, 'm': true, 'h': true };
        }
    }

    function saveSettings() {
        if (window.BaddonzAPI) window.BaddonzAPI.saveAddonSettings(ADDON_ID, currentSettings);
    }

    function isChatFocused() {
        const el = document.activeElement;
        return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    }

    function isInParty(id) {
        if (!window.Engine || !window.Engine.party) return false;
        let members = null;
        
        if (typeof window.Engine.party.getMembers === 'function') {
            members = window.Engine.party.getMembers();
        } else if (window.Engine.party.d) {
            members = window.Engine.party.d;
        }

        if (!members) return false;

        if (members instanceof Map) {
            return members.has(id) || members.has(Number(id));
        } else if (Array.isArray(members)) {
            return members.some(p => p.id === id);
        } else if (typeof members === 'object') {
            return !!members[id];
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
        const heroX = window.Engine.hero.d.x;
        const heroY = window.Engine.hero.d.y;
        const playerX = player.d.x;
        const playerY = player.d.y;
        const distanceX = Math.abs(heroX - playerX);
        const distanceY = Math.abs(heroY - playerY);

        return distanceX <= range && distanceY <= range;
    }

    const getPlayersToInvite = () => {
        if (!window.Engine.others || !window.Engine.others.getDrawableList) return [];
        const nickInvites = [];
        const idInvites = [];
        const partyMemberNicks = new Set();

        if (window.Engine.party) {
            let members = null;
            if (typeof window.Engine.party.getMembers === 'function') members = window.Engine.party.getMembers();
            else if (window.Engine.party.d) members = window.Engine.party.d;

            if (members instanceof Map) {
                members.forEach(member => { if (member && member.nick) partyMemberNicks.add(member.nick.toLowerCase()); });
            } else if (members) {
                for (const memberId in members) {
                    if (members[memberId] && members[memberId].nick) partyMemberNicks.add(members[memberId].nick.toLowerCase());
                }
            }
        }

        if (currentSettings.InvitebyNick && currentSettings.specificNicksList.length > 0) {
            currentSettings.specificNicksList.forEach(nickToInvite => {
                const lowerCaseNickToInvite = nickToInvite.toLowerCase();
                if (partyMemberNicks.has(lowerCaseNickToInvite)) return;

                const foundPlayerOnMapFullList = Object.values(window.Engine.others.getDrawableList()).find(p =>
                    p.isPlayer && p.d && p.d.nick.toLowerCase() === lowerCaseNickToInvite &&
                    p.d.id !== window.Engine.hero.d.id &&
                    !isInParty(p.d.id) &&
                    !is_he_in_any_party(p)
                );

                if (foundPlayerOnMapFullList) {
                    idInvites.push({ type: 'id', value: foundPlayerOnMapFullList.d.id });
                } else {
                    nickInvites.push({ type: 'nick', value: nickToInvite });
                }
            });
        }

        let playersOnMap = Object.values(window.Engine.others.getDrawableList())
            .filter(entry =>
                entry.isPlayer && entry.d && entry.d.id !== window.Engine.hero.d.id &&
                !isInParty(entry.d.id) && !is_he_in_any_party(entry)
            );

        playersOnMap.forEach(player => {
            const lowerCasePlayerNick = player.d.nick.toLowerCase();
            if (partyMemberNicks.has(lowerCasePlayerNick)) return;

            const alreadyAddedById = idInvites.some(invite => invite.type === 'id' && invite.value === player.d.id);
            if (alreadyAddedById) return;

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

        return [...nickInvites, ...idInvites];
    };

    function invitePlayer(inviteData) {
        if (!isChatFocused()) {
            if (inviteData.type === 'id') window._g("party&a=inv&id=" + inviteData.value);
            else if (inviteData.type === 'nick') window._g("party&a=inv&nick=" + inviteData.value);
        }
    }

    function Ginvite() {
        if (!currentSettings.enabled) return;
        const playersToInvite = getPlayersToInvite();
        playersToInvite.forEach(inviteData => invitePlayer(inviteData));
    }

    const partyInviteRegexPL = /Czy chcesz dołączyć do drużyny gracza <strong>(.+?)<\/strong>\?/;
    const partyInviteRegexEN = /Party invitation received from <strong>(.+?)<\/strong>\. Would you like to join\?/;

    function handleNewAsk(eventData) {
        if (!currentSettings.enabled || !currentSettings.autoAcceptEnabled) return;

        if (eventData && Array.isArray(eventData) && eventData[0] && typeof eventData[0].q === 'string' && typeof eventData[0].re === 'string' && eventData[0].re.startsWith("party&a=accept")) {
            const questionText = eventData[0].q;
            let inviterNick = null;

            let match = questionText.match(partyInviteRegexPL);
            if (!match && window.g && window.g.lang === 'en') match = questionText.match(partyInviteRegexEN);

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
                            if (eventData[1].$backdrop && typeof eventData[1].$backdrop.remove === 'function') eventData[1].$backdrop.remove();
                        }
                    }
                }
            }
        }
    }

    function handleKeyDown(e) {
        if (!currentSettings.enabled) return;
        
        const zapKeybindInput = document.getElementById("zap-keybind-input");
        if (keybindInputActive && zapKeybindInput) {
            e.preventDefault();
            e.stopPropagation();
            const pressedKey = e.key.toLowerCase();
            
            if (['escape', 'enter', 'tab'].includes(pressedKey)) {
                keybindInputActive = false;
                zapKeybindInput.blur();
                zapKeybindInput.classList.remove('active-keybind-mode');
                return;
            }
            if (['shift', 'control', 'alt', 'meta', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'capslock', 'numlock', 'scrolllock'].includes(pressedKey)) {
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
                    <div class="baddonz-label-wrapper" style="justify-content: flex-start; align-items: center; gap: 5px;">
                        <div class="baddonz-checkbox ${currentSettings.SelectedProfessions[code] ? 'active' : ''}" id="prof-checkbox-${code}"></div>
                        <div class="baddonz-text" style="padding: 0; font-size: 12px; font-weight: bold;">${code.toUpperCase()}</div>
                    </div>
                `;
            });
            return html;
        };

        const bodyHtml = `
            <div class="baddonz-scroll" style="display:flex; flex-direction:column; overflow-y:auto; overflow-x:hidden; max-height:400px; padding-right:4px; gap: 5px;">
                
                <div class="baddonz-setting-row" style="justify-content: space-between;">
                    <div class="baddonz-label-wrapper" style="gap: 5px;">
                        <div class="baddonz-checkbox ${currentSettings.enabled ? 'active' : ''}" id="zap-checkbox"></div>
                        <span style="font-weight:bold;">Szybka Grupa</span>
                    </div>
                    <input type="text" class="baddonz-input keybind" id="zap-keybind-input" value="${currentSettings.inviteKey === "space" ? "[SPACJA]" : currentSettings.inviteKey.toUpperCase()}" readonly style="width: 70px;">
                </div>

                <div id="zap-options-container" style="display: ${currentSettings.enabled ? 'flex' : 'none'}; flex-direction:column; gap:5px;">
                    <div class="baddonz-setting-row">
                        <div class="baddonz-checkbox ${currentSettings.InviteRandoms ? 'active' : ''}" id="zap-randoms-checkbox"></div>
                        <span>Zapraszaj randomów obok</span>
                    </div>

                    <div class="baddonz-setting-row">
                        <div class="baddonz-checkbox ${currentSettings.InviteNear ? 'active' : ''}" id="zap-from-square-checkbox"></div>
                        <span>Grupa z kratki (inne relacje)</span>
                    </div>

                    <div class="baddonz-setting-row">
                        <div class="baddonz-checkbox ${currentSettings.InvitebyLevel ? 'active' : ''}" id="zap-by-level-checkbox"></div>
                        <span>Grupa po levelu</span>
                    </div>
                    <div id="zap-level-range-section" style="display: ${currentSettings.InvitebyLevel ? 'flex' : 'none'}; flex-direction: row; align-items: center; gap: 5px;">
                        <input type="number" class="baddonz-input compact" id="zap-min-level-input" value="${currentSettings.minLevel}" min="0" max="500" placeholder="Od" style="flex-grow:1;">
                        <span style="color: #fff; font-weight:bold;">-</span>
                        <input type="number" class="baddonz-input compact" id="zap-max-level-input" value="${currentSettings.maxLevel}" min="0" max="500" placeholder="Do" style="flex-grow:1;">
                    </div>

                    <div class="baddonz-setting-row">
                        <div class="baddonz-checkbox ${currentSettings.FilterbyProfession ? 'active' : ''}" id="zap-filter-by-profession-checkbox"></div>
                        <span>Grupa po profesjach</span>
                    </div>
                    <div id="zap-profession-filter-section" class="baddonz-grid-2col" style="display: ${currentSettings.FilterbyProfession ? 'grid' : 'none'}; width: 100%; margin-top: 3px;">
                        ${createProfessionsCheckboxes()}
                    </div>

                    <div class="baddonz-setting-row">
                        <div class="baddonz-checkbox ${currentSettings.InvitebyNick ? 'active' : ''}" id="zap-specific-nicks-checkbox"></div>
                        <span>Zapraszaj po nickach</span>
                    </div>

                    <div id="zap-specific-nicks-list-section" class="baddonz-flex column" style="gap: 5px; display: ${currentSettings.InvitebyNick ? 'flex' : 'none'};">
                        <hr style="width: 100%; border-color: #303030; margin: 0;">
                        <div class="baddonz-input-addbutton">
                            <input type="text" class="baddonz-input" id="zap-specific-nick-input" placeholder="Wpisz nick" maxlength="24">
                            <button class="baddonz-button" id="zap-add-nick-btn">+</button>
                        </div>
                        <div class="baddonz-scroll" id="zap-specific-nicks-list" style="max-height: 86px; overflow-y: auto; width: 100%;"></div>
                    </div>

                    <hr style="width: 100%; border-color: #303030; margin: 2px 0;">

                    <div class="baddonz-setting-row">
                        <div class="baddonz-checkbox ${currentSettings.autoAcceptEnabled ? 'active' : ''}" id="zap-auto-accept-checkbox"></div>
                        <span>Auto akceptacja zaproszeń</span>
                    </div>

                    <div id="zap-accept-options-section" class="baddonz-flex column" style="display: ${currentSettings.autoAcceptEnabled ? 'flex' : 'none'}; gap: 5px;">
                        <span style="color:#aaa; font-size:10px;">Akceptuj od:</span>
                        <div class="baddonz-grid-2col">
                            <div class="baddonz-label-wrapper" style="justify-content: flex-start; align-items: center; gap: 5px;">
                                <div class="baddonz-checkbox ${currentSettings.acceptFriend ? 'active' : ''}" id="accept-friend-checkbox"></div>
                                <div class="baddonz-text" style="padding: 0; font-size: 12px;">Znaj</div>
                            </div>
                            <div class="baddonz-label-wrapper" style="justify-content: flex-start; align-items: center; gap: 5px;">
                                <div class="baddonz-checkbox ${currentSettings.acceptAlly ? 'active' : ''}" id="accept-ally-checkbox"></div>
                                <div class="baddonz-text" style="padding: 0; font-size: 12px;">Sojusz</div>
                            </div>
                            <div class="baddonz-label-wrapper" style="justify-content: flex-start; align-items: center; gap: 5px;">
                                <div class="baddonz-checkbox ${currentSettings.acceptClan ? 'active' : ''}" id="accept-clan-checkbox"></div>
                                <div class="baddonz-text" style="padding: 0; font-size: 12px;">Klan</div>
                            </div>
                            <div class="baddonz-label-wrapper" style="justify-content: flex-start; align-items: center; gap: 5px;">
                                <div class="baddonz-checkbox ${currentSettings.acceptOthers ? 'active' : ''}" id="accept-others-checkbox"></div>
                                <div class="baddonz-text" style="padding: 0; font-size: 12px;">Pozostali</div>
                            </div>
                        </div>
                        <div class="baddonz-setting-row" style="margin-top: 5px;">
                            <div class="baddonz-checkbox ${currentSettings.rejectUnchecked ? 'active' : ''}" id="reject-unchecked-checkbox"></div>
                            <span>Odrzucaj pozostałe</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        uiWindowElement = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Szybka Grupa", bodyHtml, { 
            width: '220px', 
            customId: 'zap-wnd',
            hasSettings: false,
            hasCollapse: true,
            hasClose: true
        });

        const zapCheckbox = uiWindowElement.querySelector("#zap-checkbox");
        const zapOptionsContainer = uiWindowElement.querySelector("#zap-options-container");
        const zapKeybindInput = uiWindowElement.querySelector("#zap-keybind-input");

        const zapRandomsCheckbox = uiWindowElement.querySelector("#zap-randoms-checkbox");
        const zapFromSquareCheckbox = uiWindowElement.querySelector("#zap-from-square-checkbox");
        
        const zapByLevelCheckbox = uiWindowElement.querySelector("#zap-by-level-checkbox");
        const zapLevelRangeSection = uiWindowElement.querySelector("#zap-level-range-section");
        const zapMinLevelInput = uiWindowElement.querySelector("#zap-min-level-input");
        const zapMaxLevelInput = uiWindowElement.querySelector("#zap-max-level-input");

        const zapFilterByProfessionCheckbox = uiWindowElement.querySelector("#zap-filter-by-profession-checkbox");
        const zapProfessionFilterSection = uiWindowElement.querySelector("#zap-profession-filter-section");

        const zapSpecificNicksCheckbox = uiWindowElement.querySelector("#zap-specific-nicks-checkbox");
        const zapSpecificNicksListSection = uiWindowElement.querySelector("#zap-specific-nicks-list-section");
        const zapSpecificNickInput = uiWindowElement.querySelector("#zap-specific-nick-input");
        const zapAddNickBtn = uiWindowElement.querySelector("#zap-add-nick-btn");
        const zapSpecificNicksList = uiWindowElement.querySelector("#zap-specific-nicks-list");

        const autoAcceptCheckbox = uiWindowElement.querySelector("#zap-auto-accept-checkbox");
        const acceptOptionsSection = uiWindowElement.querySelector("#zap-accept-options-section");
        const acceptClanCheckbox = uiWindowElement.querySelector("#accept-clan-checkbox");
        const acceptAllyCheckbox = uiWindowElement.querySelector("#accept-ally-checkbox");
        const acceptFriendCheckbox = uiWindowElement.querySelector("#accept-friend-checkbox");
        const acceptOthersCheckbox = uiWindowElement.querySelector("#accept-others-checkbox");
        const rejectUncheckedCheckbox = uiWindowElement.querySelector("#reject-unchecked-checkbox");

        const renderSpecificNicks = () => {
            zapSpecificNicksList.innerHTML = '';
            currentSettings.specificNicksList.forEach((nick, index) => {
                const nickEntry = document.createElement('div');
                nickEntry.className = 'baddonz-list-item';
                nickEntry.innerHTML = `
                    <input type="text" class="baddonz-input" value="${nick}" readonly data-index="${index}" maxlength="24">
                    <div class="baddonz-icon baddonz-close-button baddonz-remove-x" data-index="${index}" title="Usuń z listy"></div>
                `;
                zapSpecificNicksList.appendChild(nickEntry);
            });
        };

        const handleCheckboxClick = (element, key, sectionToToggle = null, displayType = 'flex') => {
            const isActive = element.classList.toggle('active');
            currentSettings[key] = isActive;
            if (sectionToToggle) sectionToToggle.style.display = isActive ? displayType : 'none';
            saveSettings();
        };

        zapCheckbox.addEventListener('click', () => handleCheckboxClick(zapCheckbox, 'enabled', zapOptionsContainer, 'flex'));
        zapRandomsCheckbox.addEventListener('click', () => handleCheckboxClick(zapRandomsCheckbox, 'InviteRandoms'));
        zapFromSquareCheckbox.addEventListener('click', () => handleCheckboxClick(zapFromSquareCheckbox, 'InviteNear'));
        
        zapByLevelCheckbox.addEventListener('click', () => handleCheckboxClick(zapByLevelCheckbox, 'InvitebyLevel', zapLevelRangeSection, 'flex'));
        
        zapFilterByProfessionCheckbox.addEventListener('click', () => handleCheckboxClick(zapFilterByProfessionCheckbox, 'FilterbyProfession', zapProfessionFilterSection, 'grid'));
        
        zapSpecificNicksCheckbox.addEventListener('click', () => handleCheckboxClick(zapSpecificNicksCheckbox, 'InvitebyNick', zapSpecificNicksListSection, 'flex'));

        autoAcceptCheckbox.addEventListener('click', () => handleCheckboxClick(autoAcceptCheckbox, 'autoAcceptEnabled', acceptOptionsSection, 'flex'));
        acceptClanCheckbox.addEventListener('click', () => handleCheckboxClick(acceptClanCheckbox, 'acceptClan'));
        acceptAllyCheckbox.addEventListener('click', () => handleCheckboxClick(acceptAllyCheckbox, 'acceptAlly'));
        acceptFriendCheckbox.addEventListener('click', () => handleCheckboxClick(acceptFriendCheckbox, 'acceptFriend'));
        acceptOthersCheckbox.addEventListener('click', () => handleCheckboxClick(acceptOthersCheckbox, 'acceptOthers'));
        rejectUncheckedCheckbox.addEventListener('click', () => handleCheckboxClick(rejectUncheckedCheckbox, 'rejectUnchecked'));

        Object.keys(PROFESSION_NAMES).forEach(profCode => {
            const cb = uiWindowElement.querySelector(`#prof-checkbox-${profCode}`);
            if (cb) {
                cb.addEventListener('click', () => {
                    const isActive = cb.classList.toggle('active');
                    currentSettings.SelectedProfessions[profCode] = isActive;
                    saveSettings();
                });
                if (typeof $ === 'function' && typeof $.fn.tip === 'function') $(cb).tip(PROFESSION_NAMES[profCode]);
            }
        });

        zapKeybindInput.addEventListener('click', () => {
            if (currentSettings.enabled) {
                keybindInputActive = true;
                zapKeybindInput.focus();
                zapKeybindInput.classList.add('active-keybind-mode');
            }
        });

        const handleLevelInputChange = (inputElement, settingKey) => {
            let value = parseInt(inputElement.value);
            if (isNaN(value) || value < 0) value = 0;
            else if (value > 500) value = 500;
            inputElement.value = value;
            currentSettings[settingKey] = value;
            saveSettings();
        };

        zapMinLevelInput.addEventListener('change', (e) => handleLevelInputChange(e.target, 'minLevel'));
        zapMaxLevelInput.addEventListener('change', (e) => handleLevelInputChange(e.target, 'maxLevel'));

        const addSpecificNick = () => {
            const nick = zapSpecificNickInput.value.trim();
            if (nick && !currentSettings.specificNicksList.some(n => n.toLowerCase() === nick.toLowerCase())) {
                currentSettings.specificNicksList.push(nick);
                zapSpecificNickInput.value = '';
                saveSettings();
                renderSpecificNicks();
                zapSpecificNicksList.scrollTop = zapSpecificNicksList.scrollHeight;
            }
        };

        zapAddNickBtn.addEventListener('click', addSpecificNick);
        zapSpecificNickInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addSpecificNick(); });

        zapSpecificNicksList.addEventListener('click', (e) => {
            if (e.target.classList.contains('baddonz-remove-x')) {
                currentSettings.specificNicksList.splice(parseInt(e.target.dataset.index), 1);
                saveSettings();
                renderSpecificNicks();
            } else if (e.target.tagName === 'INPUT' && e.target.classList.contains('baddonz-input')) {
                const inputElement = e.target;
                const index = parseInt(inputElement.dataset.index);
                const originalNick = currentSettings.specificNicksList[index];
                
                inputElement.readOnly = false;
                inputElement.focus();
                inputElement.setSelectionRange(inputElement.value.length, inputElement.value.length);

                const handleBlur = () => {
                    inputElement.readOnly = true;
                    const newNick = inputElement.value.trim();
                    if (newNick && newNick.toLowerCase() !== originalNick.toLowerCase()) {
                        const isDuplicate = currentSettings.specificNicksList.some((n, i) => i !== index && n.toLowerCase() === newNick.toLowerCase());
                        if (!isDuplicate) currentSettings.specificNicksList[index] = newNick;
                        else inputElement.value = originalNick;
                    } else if (!newNick) {
                        currentSettings.specificNicksList.splice(index, 1);
                    } else {
                        inputElement.value = originalNick;
                    }
                    saveSettings();
                    renderSpecificNicks();
                    inputElement.removeEventListener('blur', handleBlur);
                    inputElement.removeEventListener('keydown', handleKeyDownEdit);
                };

                const handleKeyDownEdit = (ev) => { if (ev.key === 'Enter') inputElement.blur(); };
                inputElement.addEventListener('blur', handleBlur);
                inputElement.addEventListener('keydown', handleKeyDownEdit);
            }
        });

        if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
            $(zapRandomsCheckbox).tip('Zapraszaj wszystkich graczy (nie tylko znaj/klan/soj)');
            $(zapFromSquareCheckbox).tip('Przydatne na tytanów, żeby zrobić szybką grupe po przerwie technicznej');
            $(zapAddNickBtn).tip('Dodaj nick do listy zapraszania');
            $(zapByLevelCheckbox).tip('Zapraszanie graczy po poziomie');
            $(zapMinLevelInput).tip('Minimalny poziom gracza do zaproszenia');
            $(zapMaxLevelInput).tip('Maksymalny poziom gracza do zaproszenia');
            $(zapFilterByProfessionCheckbox).tip('Filtruj graczy po profesji');
            $(autoAcceptCheckbox).tip('Automatycznie akceptuj zaproszenia do grupy');
            $(acceptClanCheckbox).tip('Akceptuj zaproszenia od klanowiczy');
            $(acceptAllyCheckbox).tip('Akceptuj zaproszenia od sojuszników');
            $(acceptFriendCheckbox).tip('Akceptuj zaproszenia od przyjaciół');
            $(acceptOthersCheckbox).tip('Akceptuj zaproszenia od (braku relacji/wrogów/wrogów klanu)');
            $(rejectUncheckedCheckbox).tip('Odrzucaj zaproszenia');
            $(zapKeybindInput).tip('Skrót zapraszania');
        }

        renderSpecificNicks();
    }

    function addonInit() {
        loadSettings();
        if (!uiWindowElement) buildUI();

        if (!isKeyDownBound) {
            document.addEventListener('keydown', handleKeyDown);
            isKeyDownBound = true;
        }

        if (!isNewAskBound && typeof window.API !== 'undefined' && typeof window.Engine?.apiData?.NEW_ASK !== 'undefined') {
            window.API.addCallbackToEvent(window.Engine.apiData.NEW_ASK, handleNewAsk);
            isNewAskBound = true;
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
            const zapOptionsContainer = uiWindowElement.querySelector("#zap-options-container");
            if (zapCheckbox) {
                if (isEnabled) zapCheckbox.classList.add('active');
                else zapCheckbox.classList.remove('active');
            }
            if (zapOptionsContainer) zapOptionsContainer.style.display = isEnabled ? 'flex' : 'none';
        }
    }

    const checkApi = () => {
        if (!window.BaddonzAPI || !window.BaddonzAPI.registerAddon) {
            setTimeout(checkApi, 500); return;
        }
        window.BaddonzAPI.registerAddon(ADDON_ID, { init: addonInit, stop: addonStop, onStateToggle: onStateToggle });
    };
    
    checkApi();

})();
