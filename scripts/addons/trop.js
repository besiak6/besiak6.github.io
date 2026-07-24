(function() {
    'use strict';
    const ADDON_ID = "TROP";
    let intervalId = null;
    let isProcessing = false;

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function talkToNpcByName(nameFragment) {
        if (isProcessing) return;

        if (!window.Engine || !window.Engine.allInit || !window.Engine.npcs || !window.Engine.hero || !window.Engine.hero.d) return;

        const npcs = window.Engine.npcs.check();
        if (!npcs) return;

        for (let npcId in npcs) {
            const npc = npcs[npcId];
            if (!npc || !npc.d) continue;

            const npcName = npc.d.nick;

            if (npcName && npcName.toLowerCase().includes(nameFragment.toLowerCase())) {
                const playerX = window.Engine.hero.d.x;
                const playerY = window.Engine.hero.d.y;

                const npcX = npc.d.x;
                const npcY = npc.d.y;

                const distanceX = Math.abs(playerX - npcX);
                const distanceY = Math.abs(playerY - npcY);

                const checkDistance = (distanceX <= 1 && distanceY <= 1);

                if (checkDistance) {
                    isProcessing = true;
                    try {
                        await delay(300);
                        if (typeof window._g === 'function') {
                            window._g(`talk&id=${npcId}`);
                            await delay(300);
                            window._g(`talk&id=${npcId}&c=20.1`);
                            await delay(300);
                            window._g(`talk&id=${npcId}&c=20.1`);
                        }
                    } catch (e) {
                        console.error("Tropiciele Baddonz - błąd podczas interakcji:", e);
                    } finally {
                        isProcessing = false;
                    }
                    break;
                }
            }
        }
    }

    function addonInit() {
        if (intervalId) clearInterval(intervalId);

        intervalId = setInterval(() => {
            talkToNpcByName("Tropiciel Herosów");
        }, 1000);
    }

    function addonStop() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
        isProcessing = false;
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
