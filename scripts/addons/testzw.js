// ==UserScript==
// @name          Zasięg Walki baddonz
// @version       1.2
// @description   Podświetla graczy w grupie poza zasięgiem
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function() {
    'use strict';

    const ADDON_ID = "ZW";

    let isEnabled = false;
    let isEngineHooked = false;
    let originalParseJSON = null;

    function isOtherInBattleRange(otherId) {
        if (!window.Engine || !window.Engine.hero || !window.Engine.hero.d) return false;
        
        const other = window.Engine.others.getById(otherId);
        if (!other || !other.d) return false;

        const hero = window.Engine.hero.d;
        const hx = typeof hero.rx !== 'undefined' ? hero.rx : hero.x;
        const hy = typeof hero.ry !== 'undefined' ? hero.ry : hero.y;
        const ox = typeof other.d.rx !== 'undefined' ? other.d.rx : other.d.x;
        const oy = typeof other.d.ry !== 'undefined' ? other.d.ry : other.d.y;

        return Math.max(Math.abs(ox - hx), Math.abs(oy - hy)) <= 20;
    }
    function updatePartyMembers() {
        if (!isEnabled || !window.Engine || !window.Engine.party || !window.Engine.hero) return;
        
        const heroId = window.Engine.hero.d.id;
        let members = null;
        if (typeof window.Engine.party.getMembers === 'function') {
            members = window.Engine.party.getMembers();
        } else if (window.Engine.party.d) {
            members = window.Engine.party.d;
        }

        if (!members) return;
        try {
            if (window.Engine.party.get$Wnd && typeof window.Engine.party.get$Wnd === 'function') {
                const $wnd = window.Engine.party.get$Wnd();
                if ($wnd && $wnd.length) {
                    const amountEl = $wnd[0].querySelector(".amount");
                    if (amountEl) {
                        const size = members instanceof Map ? members.size : Object.keys(members).length;
                        amountEl.innerText = `(${size})`;
                    }
                }
            }
        } catch (e) {}
        const applyColorToMember = (id, memberObj) => {
            if (parseInt(id) === heroId) return;

            const inRange = isOtherInBattleRange(id);
            let el = memberObj.$ ? memberObj.$[0] : memberObj.el;

            if (el) {
                const nickEl = el.querySelector(".nickname-text") || el.querySelector(".nick") || el.querySelector(".name");
                if (nickEl) {
                    nickEl.style.color = inRange ? "" : "#ff5555";
                }
            }
        };

        if (members instanceof Map) {
            for (const [id, member] of members.entries()) {
                applyColorToMember(id, member);
            }
        } else if (typeof members === 'object') {
            for (const id in members) {
                applyColorToMember(id, members[id]);
            }
        }
    }
    function resetPartyMembersUI() {
        if (!window.Engine || !window.Engine.party) return;
        
        let members = null;
        if (typeof window.Engine.party.getMembers === 'function') {
            members = window.Engine.party.getMembers();
        } else if (window.Engine.party.d) {
            members = window.Engine.party.d;
        }

        if (!members) return;

        const clearColor = (memberObj) => {
            let el = memberObj.$ ? memberObj.$[0] : memberObj.el;
            if (el) {
                const nickEl = el.querySelector(".nickname-text") || el.querySelector(".nick") || el.querySelector(".name");
                if (nickEl) nickEl.style.color = "";
            }
        };

        if (members instanceof Map) {
            for (const member of members.values()) clearColor(member);
        } else if (typeof members === 'object') {
            for (const id in members) clearColor(members[id]);
        }
    }
    function addonInit() {
        isEnabled = true;

        if (!isEngineHooked) {
            if (window.Engine && window.Engine.communication) {
                originalParseJSON = window.Engine.communication.parseJSON;
                
                window.Engine.communication.parseJSON = function(data) {
                    const result = originalParseJSON.apply(this, arguments);
                    if (isEnabled && data && (data.h || data.party || data.other)) {
                        updatePartyMembers();
                    }
                    
                    return result;
                };
                
                isEngineHooked = true;
            } else {
                setTimeout(addonInit, 500);
                return;
            }
        }
        updatePartyMembers();
    }
    function addonStop() {
        isEnabled = false;
        resetPartyMembersUI();
    }
    function onStateToggle(state) {
        if (state) {
            addonInit();
        } else {
            addonStop();
        }
    }

    const checkApi = () => {
        if (!window.BaddonzAPI || !window.BaddonzAPI.registerAddon) {
            setTimeout(checkApi, 500);
            return;
        }
        window.BaddonzAPI.registerAddon(ADDON_ID, { 
            init: addonInit, 
            stop: addonStop,
            onStateToggle: onStateToggle
        });
    };

    checkApi();
})();
