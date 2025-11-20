(function() {
    'use strict';

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function talkToNpcByName(nameFragment) {
        const npcs = Engine.npcs.check();

        for (let npcId in npcs) {
            const npc = npcs[npcId];
            const npcName = npc.d.nick;

            if (npcName && npcName.toLowerCase().includes(nameFragment.toLowerCase())) {
                const playerX = Engine.hero.d.x;
                const playerY = Engine.hero.d.y;

                const npcX = npc.d.x;
                const npcY = npc.d.y;

                const distanceX = Math.abs(playerX - npcX);
                const distanceY = Math.abs(playerY - npcY);

                const checkDistance = (distanceX <= 1 && distanceY <= 1);

                if (checkDistance) {
                    await delay(300);
                    _g(`talk&id=${npcId}`);
                    await delay(300);
                    _g(`talk&id=${npcId}&c=20.1`);
                    await delay(300);
                    _g(`talk&id=${npcId}&c=20.1`);
                }
            }
        }
    }

    function init() {
        if (Engine.allInit) {
            setInterval(() => {
                talkToNpcByName("Tropiciel Herosów");
            }, 3000);
        } else {
            setTimeout(init, 1000);
        }
    }

    init();
})();
