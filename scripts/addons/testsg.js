// ==UserScript==
// @name          Szybka Grupa baddonz
// @version       2.1.0
// @description   Szybka Grupa
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function() {
    'use strict';

    const ADDON_ID = "ZAP";

    const MARGONEM_RELATIONS = { NONE:1, FRIEND:2, ENEMY:3, CLAN:4, CLAN_ALLY:5, CLAN_ENEMY:6 };
    const PROFESSION_NAMES   = { t:'Tropiciel', b:'T. Ostrzy', w:'Wojownik', p:'Paladyn', m:'Mag', h:'Łowca' };

    // Ustawienia konta — wspólne dla wszystkich postaci
    const DEFAULT_ACC = {
        enabled:          true,
        windowVisible:    true,
        windowOpacity:    2,
        inviteKey:        "b",
        InviteRandoms:    false,
        InviteNear:       false,
        autoAcceptEnabled:true,
        acceptClan:       true,
        acceptAlly:       true,
        acceptFriend:     true,
        acceptOthers:     false,
        rejectUnchecked:  false
    };

    // Ustawienia postaci — per-character
    const DEFAULT_CHAR = {
        InvitebyLevel:       false,
        minLevel:            0,
        maxLevel:            500,
        FilterbyProfession:  false,
        SelectedProfessions: { t:true, b:true, w:true, p:true, m:true, h:true }
    };

    let S = { ...DEFAULT_ACC, ...DEFAULT_CHAR };
    let uiWindowElement    = null;
    let keybindInputActive = false;
    let isKeyDownBound     = false;

    const partyInvRegexPL = /Czy chcesz dołączyć do drużyny gracza <strong>(.+?)<\/strong>\?/;
    const partyInvRegexEN = /Party invitation received from <strong>(.+?)<\/strong>\. Would you like to join\?/;

    function loadSettings() {
        if (!window.BaddonzAPI) return;
        const accS  = window.BaddonzAPI.getAccSettings(ADDON_ID);
        const charS = window.BaddonzAPI.getCharSettings(ADDON_ID);
        S = { ...DEFAULT_ACC, ...DEFAULT_CHAR, ...accS, ...charS };
        if (!S.SelectedProfessions) S.SelectedProfessions = { ...DEFAULT_CHAR.SelectedProfessions };
    }

    function saveSettings() {
        if (!window.BaddonzAPI) return;
        // Ustawienia konta
        const accData = {};
        Object.keys(DEFAULT_ACC).forEach(k => accData[k] = S[k]);
        window.BaddonzAPI.saveAccSettings(ADDON_ID, accData);
        // Ustawienia postaci
        const charData = {};
        Object.keys(DEFAULT_CHAR).forEach(k => charData[k] = S[k]);
        window.BaddonzAPI.saveCharSettings(ADDON_ID, charData);
    }

    // ─── Logika ───────────────────────────────────────────────────────────────
    function isChatFocused() {
        const el = document.activeElement;
        return el && (el.tagName==="INPUT" || el.tagName==="TEXTAREA" || el.isContentEditable);
    }

    function isInParty(otherId) {
        if (!window.Engine?.party) return false;
        const members = typeof window.Engine.party.getMembers === 'function' ? window.Engine.party.getMembers() : window.Engine.party.d;
        if (!members) return false;
        if (members instanceof Map) return members.has(otherId) || members.has(Number(otherId));
        if (Array.isArray(members)) return members.some(p => p.id === otherId);
        if (typeof members === 'object') return !!members[otherId];
        return false;
    }

    const isInAnyParty    = (p) => p?.d && typeof p.d.pid === 'number' && p.d.pid > 0;
    const isFriendlyRel   = (p) => p?.d?.relation !== undefined && [MARGONEM_RELATIONS.FRIEND, MARGONEM_RELATIONS.CLAN, MARGONEM_RELATIONS.CLAN_ALLY].includes(p.d.relation);
    const isInRange       = (p, r) => {
        if (!window.Engine?.hero || !p?.d) return false;
        const hx = window.Engine.hero.d.rx ?? window.Engine.hero.d.x;
        const hy = window.Engine.hero.d.ry ?? window.Engine.hero.d.y;
        const px = p.d.rx ?? p.d.x;
        const py = p.d.ry ?? p.d.y;
        return Math.abs(hx-px) <= r && Math.abs(hy-py) <= r;
    };

    function getPlayersToInvite() {
        if (!window.Engine?.others?.getDrawableList) return [];
        const partyNicks = new Set();
        if (window.Engine.party) {
            const members = typeof window.Engine.party.getMembers === 'function' ? window.Engine.party.getMembers() : window.Engine.party.d;
            if (members instanceof Map) members.forEach(m => { if (m?.nick) partyNicks.add(m.nick.toLowerCase()); });
            else if (members && typeof members === 'object') for (const id in members) { if (members[id]?.nick) partyNicks.add(members[id].nick.toLowerCase()); }
        }

        const players = Object.values(window.Engine.others.getDrawableList())
            .filter(e => e.isPlayer && e.d && e.d.id !== window.Engine.hero.d.id && !isInParty(e.d.id) && !isInAnyParty(e))
            .map(e => ({ p:e, sort:Math.random() }))
            .sort((a,b) => a.sort-b.sort)
            .map(o => o.p);

        const result = [];
        players.forEach(player => {
            if (partyNicks.has(player.d.nick.toLowerCase())) return;
            if (result.some(inv => inv.value === player.d.id)) return;

            let ok = false;
            if (S.InviteRandoms)                              ok = true;
            else if (isFriendlyRel(player))                   ok = true;
            else if (S.InviteNear && isInRange(player, 1))    ok = true;
            if (S.InviteNear && !isInRange(player, 1))        ok = false;

            if (ok && S.InvitebyLevel) {
                const lvl = parseInt(player.d.lvl);
                if (isNaN(lvl) || lvl < S.minLevel || lvl > S.maxLevel) ok = false;
            }
            if (ok && S.FilterbyProfession) {
                if (!S.SelectedProfessions[player.d.prof]) ok = false;
            }
            if (ok) result.push({ type:'id', value: player.d.id });
        });
        return result;
    }

    function Ginvite() {
        if (!S.enabled || isChatFocused()) return;
        getPlayersToInvite().forEach(inv => window._g("party&a=inv&id=" + inv.value));
    }

    function handleNewAsk(eventData) {
        if (!S.autoAcceptEnabled) return;
        if (!Array.isArray(eventData) || !eventData[0]?.q || !eventData[0]?.re?.startsWith("party&a=accept")) return;
        const m = eventData[0].q.match(partyInvRegexPL) || eventData[0].q.match(partyInvRegexEN);
        if (!m?.[1]) return;
        const nick = m[1].trim();
        let inviter = null;
        if (window.Engine?.others?.getDrawableList) {
            for (const e of Object.values(window.Engine.others.getDrawableList())) {
                if (e.isPlayer && e.d?.nick?.toLowerCase() === nick.toLowerCase()) { inviter = e; break; }
            }
        }
        let accept = false, reject = false;
        if (inviter) {
            const rel = inviter.d.relation;
            if (S.acceptClan    && rel === MARGONEM_RELATIONS.CLAN)      accept = true;
            if (S.acceptAlly    && rel === MARGONEM_RELATIONS.CLAN_ALLY) accept = true;
            if (S.acceptFriend  && rel === MARGONEM_RELATIONS.FRIEND)    accept = true;
            if (S.acceptOthers  && [MARGONEM_RELATIONS.NONE, MARGONEM_RELATIONS.ENEMY, MARGONEM_RELATIONS.CLAN_ENEMY].includes(rel)) accept = true;
        } else {
            if (S.acceptClan || S.acceptFriend) accept = true;
        }
        if (!accept && S.rejectUnchecked) reject = true;
        if (accept) window._g(eventData[0].re + "1");
        else if (reject) window._g(eventData[0].re + "0");
        if (accept || reject) {
            typeof window.closeModal === "function" && window.closeModal();
            eventData[1]?.$?.remove();
            eventData[1]?.$backdrop?.remove();
        }
    }

    function handleKeyDown(e) {
        if (!S.enabled) return;
        const kbInput = uiWindowElement?.querySelector(".zap-keybind-input");

        if (keybindInputActive && kbInput) {
            e.preventDefault();
            const key = e.key.toLowerCase();
            if (['escape','enter','tab'].includes(key)) { kbInput.blur(); return; }
            if (!window.BaddonzAPI?.isValidHotkey(key) || key.length !== 1) return;
            S.inviteKey = key;
            kbInput.value = key.toUpperCase();
            saveSettings();
            keybindInputActive = false;
            kbInput.blur();
            kbInput.classList.remove('active-keybind-mode');
            return;
        }
        if (!isChatFocused() && e.key.toLowerCase() === S.inviteKey) { e.preventDefault(); Ginvite(); }
    }

    // ─── UI ───────────────────────────────────────────────────────────────────
    function buildUI() {
        const profCheckboxes = Object.keys(PROFESSION_NAMES).map(code => `
            <div class="baddonz-label-wrapper prof-row-${code}" style="justify-content:flex-start;align-items:center;gap:4px;">
                <div class="baddonz-checkbox prof-cb-${code} ${S.SelectedProfessions[code] ? 'active' : ''}"></div>
                <div class="baddonz-text" style="padding:0;font-size:11px;">${code.toUpperCase()}</div>
            </div>`).join('');

        const bodyHtml = `
            <div class="baddonz-setting-row" style="margin-bottom:4px!important;display:flex;align-items:center;">
                <div class="baddonz-checkbox zap-enabled ${S.enabled ? 'active' : ''}"></div>
                <span class="baddonz-text" style="padding:0;margin-left:5px;">Szybka Grupa</span>
                <input type="text" class="baddonz-input keybind zap-keybind-input" value="${S.inviteKey.toUpperCase()}" readonly
                       style="width:50px;height:20px;line-height:18px;font-size:11px;padding:1px 0;margin-left:auto;">
            </div>
            <div class="baddonz-setting-row">
                <div class="baddonz-checkbox zap-randoms ${S.InviteRandoms ? 'active' : ''}"></div>
                <span class="baddonz-text" style="padding:0;">Zapraszaj randomów obok</span>
            </div>
            <div class="baddonz-setting-row">
                <div class="baddonz-checkbox zap-near ${S.InviteNear ? 'active' : ''}"></div>
                <span class="baddonz-text" style="padding:0;">Grupa z kratki (inne relacje)</span>
            </div>
            <div class="baddonz-setting-row">
                <div class="baddonz-checkbox zap-bylevel ${S.InvitebyLevel ? 'active' : ''}"></div>
                <span class="baddonz-text" style="padding:0;">Grupa po levelu</span>
            </div>
            <div class="zap-level-section" style="display:${S.InvitebyLevel ? 'flex' : 'none'};flex-direction:row;align-items:center;justify-content:center;gap:5px;margin-bottom:2px;width:100%;">
                <input type="number" class="baddonz-input compact zap-min-level" value="${S.minLevel}" min="0" max="500" placeholder="Od">
                <span style="color:#fff;font-size:16px;line-height:1;">-</span>
                <input type="number" class="baddonz-input compact zap-max-level" value="${S.maxLevel}" min="0" max="500" placeholder="Do">
            </div>
            <div class="baddonz-setting-row">
                <div class="baddonz-checkbox zap-byprof ${S.FilterbyProfession ? 'active' : ''}"></div>
                <span class="baddonz-text" style="padding:0;">Grupa po profesjach</span>
            </div>
            <div class="baddonz-grid-3col zap-prof-section" style="display:${S.FilterbyProfession ? 'grid' : 'none'};width:100%;margin-bottom:2px;">
                ${profCheckboxes}
            </div>
            <hr style="width:100%;border-color:#303030;">
            <div class="baddonz-setting-row">
                <div class="baddonz-checkbox zap-autoaccept ${S.autoAcceptEnabled ? 'active' : ''}"></div>
                <span class="baddonz-text" style="padding:0;">Auto akceptacja zaproszeń</span>
            </div>
            <div class="baddonz-flex column zap-accept-section" style="display:${S.autoAcceptEnabled ? 'flex' : 'none'};width:100%;gap:2px;">
                <div class="baddonz-grid-2col">
                    <div class="baddonz-label-wrapper"><div class="baddonz-checkbox zap-acc-friend ${S.acceptFriend ? 'active' : ''}"></div><span class="baddonz-text">Znaj</span></div>
                    <div class="baddonz-label-wrapper"><div class="baddonz-checkbox zap-acc-ally ${S.acceptAlly ? 'active' : ''}"></div><span class="baddonz-text">Sojusz</span></div>
                    <div class="baddonz-label-wrapper"><div class="baddonz-checkbox zap-acc-clan ${S.acceptClan ? 'active' : ''}"></div><span class="baddonz-text">Klan</span></div>
                    <div class="baddonz-label-wrapper"><div class="baddonz-checkbox zap-acc-others ${S.acceptOthers ? 'active' : ''}"></div><span class="baddonz-text">Obcy</span></div>
                </div>
                <div class="baddonz-setting-row" style="margin-top:2px;margin-bottom:0;">
                    <div class="baddonz-checkbox zap-reject ${S.rejectUnchecked ? 'active' : ''}"></div>
                    <span class="baddonz-text" style="padding:0;">Odrzucaj zaproszenia</span>
                </div>
            </div>`;

        uiWindowElement = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Szybka Grupa", bodyHtml, {
            width: '195px', customId: 'baddonz-zap-wnd', hasSettings: false, hasCollapse: false
        });

        const g = (sel) => uiWindowElement.querySelector(sel);
        const cbToggle = (sel, key) => g(sel).addEventListener('click', () => { S[key] = g(sel).classList.toggle('active'); saveSettings(); });

        g('.zap-enabled').addEventListener('click', () => { S.enabled = g('.zap-enabled').classList.toggle('active'); saveSettings(); });

        const kbInput = g('.zap-keybind-input');
        kbInput.addEventListener('click', () => { keybindInputActive = true; kbInput.focus(); kbInput.classList.add('active-keybind-mode'); });
        kbInput.addEventListener('focusout', () => { if (keybindInputActive) { keybindInputActive = false; kbInput.value = S.inviteKey.toUpperCase(); } kbInput.classList.remove('active-keybind-mode'); });

        cbToggle('.zap-randoms',    'InviteRandoms');
        cbToggle('.zap-near',       'InviteNear');

        g('.zap-bylevel').addEventListener('click', () => {
            S.InvitebyLevel = g('.zap-bylevel').classList.toggle('active');
            g('.zap-level-section').style.display = S.InvitebyLevel ? 'flex' : 'none';
            saveSettings();
        });

        const fixLevel = (el, key) => {
            el.addEventListener('change', () => {
                let v = parseInt(el.value); if (isNaN(v)||v<0) v=0; if (v>500) v=500; el.value = v; S[key] = v; saveSettings();
            });
        };
        fixLevel(g('.zap-min-level'), 'minLevel');
        fixLevel(g('.zap-max-level'), 'maxLevel');

        g('.zap-byprof').addEventListener('click', () => {
            S.FilterbyProfession = g('.zap-byprof').classList.toggle('active');
            g('.zap-prof-section').style.display = S.FilterbyProfession ? 'grid' : 'none';
            saveSettings();
        });

        Object.keys(PROFESSION_NAMES).forEach(code => {
            const el = g(`.prof-cb-${code}`);
            if (el) el.addEventListener('click', () => { S.SelectedProfessions[code] = el.classList.toggle('active'); saveSettings(); });
            const row = g(`.prof-row-${code}`);
            if (row && typeof $ === 'function' && typeof $.fn.tip === 'function') $(row).tip(PROFESSION_NAMES[code]);
        });

        g('.zap-autoaccept').addEventListener('click', () => {
            S.autoAcceptEnabled = g('.zap-autoaccept').classList.toggle('active');
            g('.zap-accept-section').style.display = S.autoAcceptEnabled ? 'flex' : 'none';
            saveSettings();
        });
        cbToggle('.zap-acc-clan',   'acceptClan');
        cbToggle('.zap-acc-ally',   'acceptAlly');
        cbToggle('.zap-acc-friend', 'acceptFriend');
        cbToggle('.zap-acc-others', 'acceptOthers');
        cbToggle('.zap-reject',     'rejectUnchecked');

        if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
            $(g('.zap-randoms')).tip("Zapraszaj wszystkich graczy");
            $(g('.zap-near')).tip("Przydatne na tytanów");
        }
    }

    // ─── Lifecycle ────────────────────────────────────────────────────────────
    function addonInit() {
        loadSettings();
        if (!uiWindowElement) buildUI();
        if (uiWindowElement) uiWindowElement.style.display = S.windowVisible ? '' : 'none';
        if (!isKeyDownBound) { document.addEventListener('keydown', handleKeyDown); isKeyDownBound = true; }
        if (typeof window.API !== 'undefined' && window.Engine?.apiData?.NEW_ASK)
            window.API.addCallbackToEvent(window.Engine.apiData.NEW_ASK, handleNewAsk);
    }

    function addonStop() {
        if (isKeyDownBound) { document.removeEventListener('keydown', handleKeyDown); isKeyDownBound = false; }
        if (uiWindowElement) { uiWindowElement.remove(); uiWindowElement = null; }
    }

    function onStateToggle(isEnabled) {
        S.enabled = isEnabled;
        if (uiWindowElement) {
            const el = uiWindowElement.querySelector(".zap-enabled");
            if (el) el.classList.toggle('active', isEnabled);
        }
    }

    const checkApi = () => {
        if (!window.BaddonzAPI?.registerAddon) { setTimeout(checkApi, 500); return; }
        window.BaddonzAPI.registerAddon(ADDON_ID, { init: addonInit, stop: addonStop, onStateToggle });
    };
    checkApi();
})();
