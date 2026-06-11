// ==UserScript==
// @name          Sleeping Commander
// @version       1.2
// @description   Oddawanie d
// @author        besiak
// @match         https://*.margonem.pl/
// @grant         none
// ==/UserScript==

(function () {
    'use strict';

    const ADDON_ID = "SC";

    const TRIGGER_PHRASES = [
        "oddaj d", "daj d", "dawaj d", "dawaj mi d", "oddaj mi d", "daj mi d"
    ];

    const CHANNEL = { GROUP: "GROUP", LOCAL: "LOCAL", PRIVATE: "PRIVATE" };
    
    let originalAddMessage = null;
    let isChatHooked = false;
    let isReadyTimeout = null;
    let chatReady = false;

    function isLeader() {
        if (!window.Engine || !window.Engine.party || !window.Engine.hero) return false;
        const heroId = window.Engine.hero.d.id;
        
        if (typeof window.Engine.party.getMembers === 'function') {
            const members = window.Engine.party.getMembers();
            if (members instanceof Map) {
                for (const member of members.values()) {
                    if (member.leader) return member.id === heroId;
                }
            } else if (members) {
                for (const id in members) {
                    if (members[id].leader) return parseInt(id) === heroId;
                }
            }
        } else if (window.Engine.party.d) {
            const members = window.Engine.party.d;
            for (const id in members) {
                if (members[id].leader) return parseInt(id) === heroId;
            }
        }
        return false;
    }

    function getPlayerByNick(nick) {
        if (!window.Engine || !window.Engine.party) return undefined;
        let members = null;
        
        if (typeof window.Engine.party.getMembers === 'function') {
            members = window.Engine.party.getMembers();
        } else if (window.Engine.party.d) {
            members = window.Engine.party.d;
        }
        
        if (!members) return undefined;

        const lowerNick = nick.toLowerCase();

        if (members instanceof Map) {
            for (const memberData of members.values()) {
                if (memberData && memberData.nick && memberData.nick.toLowerCase() === lowerNick) {
                    return memberData;
                }
            }
        } else if (members && typeof members === 'object') {
            for (const id in members) {
                if (members[id] && members[id].nick && members[id].nick.toLowerCase() === lowerNick) {
                    return members[id];
                }
            }
        }
        return undefined;
    }

    function isInParty(nick) {
        return !!getPlayerByNick(nick);
    }

    function giveLeadership(nick) {
        const player = getPlayerByNick(nick);
        if (player && player.id) {
            window._g(`party&a=give&id=${player.id}`);
        }
    }

    function handleIncomingMessage(message) {
        if (!chatReady) return;
        if (!window.Engine || !window.Engine.hero) return;

        const content = message.text?.toLowerCase()?.trim();
        const author = message.authorBusinessCard?.getNick?.();
        const myNick = window.Engine.hero.d?.nick;

        if (!content || !author || author === myNick) return;
        if (![CHANNEL.GROUP, CHANNEL.LOCAL, CHANNEL.PRIVATE].includes(message.channel)) return;
        if (!TRIGGER_PHRASES.some(phrase => content.includes(phrase))) return;

        if (isLeader() && isInParty(author)) {
            giveLeadership(author);
        }
    }

    function addonInit() {
        if (isChatHooked) return;

        try {
            if (!window.getEngine || !window.getEngine().chatController) {
                setTimeout(addonInit, 500);
                return;
            }

            const chatController = window.getEngine().chatController;
            originalAddMessage = chatController.addMessage;

            chatController.addMessage = function (message) {
                originalAddMessage.call(this, message);
                try {
                    handleIncomingMessage(message);
                } catch (err) {
                    console.error("Sleeping Commander error inside chat hook:", err);
                }
            };

            isChatHooked = true;
            chatReady = false;
            
            isReadyTimeout = setTimeout(() => { 
                chatReady = true; 
            }, 2000);

        } catch (e) {
            console.error("Sleeping Commander initialization failed, retrying...", e);
            setTimeout(addonInit, 500);
        }
    }

    function addonStop() {
        if (isReadyTimeout) {
            clearTimeout(isReadyTimeout);
            isReadyTimeout = null;
        }
        chatReady = false;

        if (isChatHooked && originalAddMessage && window.getEngine && window.getEngine().chatController) {
            window.getEngine().chatController.addMessage = originalAddMessage;
        }
        originalAddMessage = null;
        isChatHooked = false;
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
