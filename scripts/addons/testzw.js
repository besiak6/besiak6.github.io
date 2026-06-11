// ==UserScript==
// @name          Zasięg walki baddonz
// @version       1.0
// @description   Podświetla graczy poza zasięgiem walki w grupie
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function() {
    'use strict';

    const ADDON_ID = "ZW";

    let originalParseJSON = null;
    let isHooked = false;

    const isOtherInBattleRange = (other) => {
        if (!window.Engine || !window.Engine.hero || !window.Engine.hero.d || !other || !other.d) return false;
        const { x: hx, y: hy } = window.Engine.hero.d;
        const { x, y } = other.d;
        return Math.max(Math.abs(x - hx), Math.abs(y - hy)) <= 20;
    };

    const updatePartyMembers = () => {
        if (!window.Engine || !window.Engine.party || typeof window.Engine.party.getMembers !== 'function') return;
        
        const members = window.Engine.party.getMembers();
        if (!members) return;

        const others = window.Engine.others ? window.Engine.others.check() : {};
        const hid = window.Engine.hero.d.id;
        
        // Zabezpieczona aktualizacja nagłówka z liczbą osób
        if (typeof window.Engine.party.get$Wnd === 'function') {
            const $wnd = window.Engine.party.get$Wnd();
            if ($wnd && $wnd[0]) {
                const amountEl = $wnd[0].querySelector(".amount");
                if (amountEl) {
                    const count = members instanceof Map ? members.size : Object.keys(members).length;
                    amountEl.innerText = `(${count})`;
                }
            }
        }

        // Zabezpieczone sprawdzanie zasięgu na nowym/starym formacie party
        if (members instanceof Map) {
            members.forEach((c, v) => {
                if (v == hid || !c.el) return;
                const inRange = others[v] && isOtherInBattleRange(others[v]);
                const nickText = c.el.querySelector(".nickname-text");
                if (nickText) nickText.style.color = inRange ? "" : "red";
            });
        } else if (typeof members === 'object') {
            for (const v in members) {
                const c = members[v];
                if (v == hid || !c.el) continue;
                const inRange = others[v] && isOtherInBattleRange(others[v]);
                const nickText = c.el.querySelector(".nickname-text");
                if (nickText) nickText.style.color = inRange ? "" : "red";
            }
        }
    };

    const resetPartyMembersColor = () => {
        if (!window.Engine || !window.Engine.party || typeof window.Engine.party.getMembers !== 'function') return;
        const members = window.Engine.party.getMembers();
        if (!members) return;

        if (members instanceof Map) {
            members.forEach((c) => {
                if (c.el) {
                    const nickText = c.el.querySelector(".nickname-text");
                    if (nickText) nickText.style.color = "";
                }
            });
        } else if (typeof members === 'object') {
            for (const v in members) {
                const c = members[v];
                if (c.el) {
                    const nickText = c.el.querySelector(".nickname-text");
                    if (nickText) nickText.style.color = "";
                }
            }
        }
    };

    function addonInit() {
        if (isHooked) return;

        if (!window.Engine || !window.Engine.communication || typeof window.Engine.communication.parseJSON !== 'function') {
            setTimeout(addonInit, 500);
            return;
        }

        originalParseJSON = window.Engine.communication.parseJSON;
        
        window.Engine.communication.parseJSON = function(data) {
            const result = originalParseJSON.apply(this, arguments);
            
            if (data && (data.h || data.party || data.other)) {
                try {
                    updatePartyMembers();
                } catch (e) {
                    console.error("Zasięg walki baddonz - błąd podczas aktualizacji UI grupy:", e);
                }
            }
            return result;
        };
        
        isHooked = true;
        
        // Wykonaj pierwsze odświeżenie grupy przy uruchomieniu dodatku
        setTimeout(() => {
            updatePartyMembers();
        }, 500);
    }

    function addonStop() {
        if (isHooked && originalParseJSON && window.Engine && window.Engine.communication) {
            window.Engine.communication.parseJSON = originalParseJSON;
        }
        
        originalParseJSON = null;
        isHooked = false;
        
        resetPartyMembersColor();
    }

    const checkApi = () => {
        if (!window.BaddonzAPI || !window.BaddonzAPI.registerAddon) {
            setTimeout(checkApi, 500);
            return;
        }
        window.BaddonzAPI.registerAddon(ADDON_ID, { 
            init: addonInit, 
            stop: addonStop 
        });
    };

    checkApi();

})();
