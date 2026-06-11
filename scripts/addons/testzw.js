// ==UserScript==
// @name          Zasięg walki baddonz
// @version       1.0
// @description   Podświetla graczy poza zasięgiem walki
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function() {
    'use strict';

    const ADDON_ID = "ZW";
    
    let isEnabled = false;
    let isHooked = false;
    let originalParseJSON = null;

    const isOtherInBattleRange = (other) => {
        if (!window.Engine?.hero?.d || !other?.d) return false;
        const { x: hx, y: hy } = window.Engine.hero.d;
        const { x, y } = other.d;
        return Math.max(Math.abs(x - hx), Math.abs(y - hy)) <= 20;
    };

    const updatePartyMembers = () => {
        if (!window.Engine?.party || !window.Engine.hero?.d) return;
        
        const getMembers = window.Engine.party.getMembers;
        if (typeof getMembers !== 'function') return;
        
        const members = getMembers();
        if (!members || !(members instanceof Map)) return;

        const others = window.Engine.others?.check() || {};
        const { id: hid } = window.Engine.hero.d;
        
        const $wnd = window.Engine.party.get$Wnd ? window.Engine.party.get$Wnd() : null;
        if ($wnd && $wnd[0]) {
            const amountEl = $wnd[0].querySelector(".amount");
            if (amountEl) amountEl.innerText = `(${members.size})`;
        }

        members.forEach((c, v) => {
            if (v == hid) return;
            const inRange = others[v] && isOtherInBattleRange(others[v]);
            if (c.el) {
                const nickText = c.el.querySelector(".nickname-text");
                if (nickText) {
                    nickText.style.color = inRange ? "" : "red";
                }
            }
        });
    };

    const resetPartyMembers = () => {
        if (!window.Engine?.party || typeof window.Engine.party.getMembers !== 'function') return;
        const members = window.Engine.party.getMembers();
        if (members instanceof Map) {
            members.forEach((c) => {
                if (c.el) {
                    const nickText = c.el.querySelector(".nickname-text");
                    if (nickText) nickText.style.color = "";
                }
            });
        }
    };

    function addonInit() {
        if (isHooked) {
            isEnabled = true;
            updatePartyMembers();
            return;
        }

        try {
            if (!window.Engine || !window.Engine.communication) {
                setTimeout(addonInit, 500);
                return;
            }

            originalParseJSON = window.Engine.communication.parseJSON;
            
            window.Engine.communication.parseJSON = function(data) {
                const result = originalParseJSON.apply(this, arguments);
                if (isEnabled && data && (data.h || data.party || data.other || data.o)) {
                    updatePartyMembers();
                }
                return result;
            };

            isHooked = true;
            isEnabled = true;
            
            updatePartyMembers();

        } catch (e) {
            console.error("Zasięg walki baddonz - błąd inicjalizacji", e);
            setTimeout(addonInit, 500);
        }
    }

    function addonStop() {
        isEnabled = false;
        resetPartyMembers(); 
    }
    
    function onStateToggle(enabledState) {
        isEnabled = enabledState;
        if (isEnabled) {
            updatePartyMembers();
        } else {
            resetPartyMembers();
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
