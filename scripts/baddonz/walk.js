(function() {
    'use strict';

    const init = () => {
        if (!window.Engine || !window.Engine.allInit || (typeof window.__build !== "object" && typeof window.__bootNI === "undefined")) {
            setTimeout(init, 1000);
            return;
        }
        main();
    };

    const main = async () => {
        const windowHtml = `
            <div class="baddonz-window" id="walk-wnd" style="position: absolute; z-index: 500;">
                <div class="baddonz-window-header">
                    <div class="baddonz-window-controls left">
                        <div class="baddonz-icon baddonz-opacity-button" id="walk-opacity-btn"></div>
                    </div>
                    <div class="baddonz-window-title">Przechodzenie</div>
                    <div class="baddonz-window-controls right">
                        <div class="baddonz-icon baddonz-close-button" id="walk-close-button"></div>
                    </div>
                </div>
                <div class="baddonz-window-body baddonz-flex column" style="gap: 5px;">
                    <div class="baddonz-label-wrapper" style="justify-content: flex-start; align-items: center; gap: 5px;">
                        <div class="baddonz-checkbox" id="enableWalking"></div>
                        <div class="baddonz-text" style="padding: 0;">Włącz Przechodzenie</div>
                    </div>
                    <div class="baddonz-label-wrapper" style="justify-content: flex-start; align-items: center; gap: 5px;">
                        <div class="baddonz-checkbox" id="fastWalking"></div>
                        <div class="baddonz-text" style="padding: 0;">Szybko</div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', windowHtml);

        const walkWnd = document.getElementById("walk-wnd");
        const closeBtn = document.getElementById("walk-close-button");
        const opacityBtn = document.getElementById("walk-opacity-btn");
        const titleBar = walkWnd.querySelector(".baddonz-window-header");
        const enableWalkingCheckbox = document.getElementById("enableWalking");
        const fastWalkingCheckbox = document.getElementById("fastWalking");

        const characterId = window.Engine?.hero?.d?.id || 'default_character';
        const SETTINGS_KEY = `baddonz-settings-auto-walk-${characterId}`;

        let autoWalkTimeout = null;

        const saveSettings = () => {
            const x = parseInt(walkWnd.style.left, 10) || 0;
            const y = parseInt(walkWnd.style.top, 10) || 0;
            const isEnabled = enableWalkingCheckbox.classList.contains("active");
            const isFast = fastWalkingCheckbox.classList.contains("active");
            const isVisible = walkWnd.style.display !== 'none';

            const opacityClasses = ['opacity-0', 'opacity-1', 'opacity-2', 'opacity-3', 'opacity-4'];
            let currentLocalOpacity = 2;
            for (let i = 0; i < opacityClasses.length; i++) {
                if (walkWnd.classList.contains(opacityClasses[i])) {
                    currentLocalOpacity = i;
                    break;
                }
            }

            localStorage.setItem(SETTINGS_KEY, JSON.stringify({
                x, y, isEnabled, isFast, isVisible, currentOpacity: currentLocalOpacity
            }));
        };

        function syncOpacityWithBaddonzManager() {
            if (walkWnd && window.localStorage && localStorage.getItem('baddonz_unified_opacity_enabled') === 'true') {
                const globalOpacity = parseInt(localStorage.getItem('baddonz_current_opacity') || '2');
                const opacityClasses = ['opacity-0', 'opacity-1', 'opacity-2', 'opacity-3', 'opacity-4'];
                walkWnd.classList.remove(...opacityClasses);
                walkWnd.classList.add(opacityClasses[globalOpacity]);
            }
        }

        const loadSettings = () => {
            const s = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
            walkWnd.style.left = `${s.x || 0}px`;
            walkWnd.style.top = `${s.y || 0}px`;
            enableWalkingCheckbox.classList.toggle("active", s.isEnabled || false);
            fastWalkingCheckbox.classList.toggle("active", s.isFast || false);
            walkWnd.style.display = s.isVisible !== false ? 'flex' : 'none';

            const opacityClasses = ['opacity-0', 'opacity-1', 'opacity-2', 'opacity-3', 'opacity-4'];
            const localOpacity = typeof s.currentOpacity === 'number' ? s.currentOpacity : 2;
            walkWnd.classList.remove(...opacityClasses);
            walkWnd.classList.add(opacityClasses[localOpacity]);

            syncOpacityWithBaddonzManager();

            if (enableWalkingCheckbox.classList.contains("active")) {
                startAutoWalk();
            }
        };

        if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
            $(closeBtn).tip('Zamknij');
            $(opacityBtn).tip('Zmień przezroczystość okienka');
            $(enableWalkingCheckbox).tip('Automatyczne przechodzenie przez przejścia.');
            $(fastWalkingCheckbox).tip('Szybciej przechodzi');
        }

        closeBtn.addEventListener('click', () => {
            walkWnd.style.display = 'none';
            saveSettings();
        });

        opacityBtn.addEventListener('click', () => {
            const opacityClasses = ['opacity-0', 'opacity-1', 'opacity-2', 'opacity-3', 'opacity-4'];
            if (window.setBaddonzGlobalOpacity && localStorage.getItem('baddonz_unified_opacity_enabled') === 'true') {
                let currentGlobalOpacity = parseInt(localStorage.getItem('baddonz_current_opacity') || '2');
                let newOpacity = (currentGlobalOpacity + 1) % opacityClasses.length;
                window.setBaddonzGlobalOpacity(newOpacity);
            } else {
                let currentLocalOpacity = 2;
                for (let i = 0; i < opacityClasses.length; i++) {
                    if (walkWnd.classList.contains(opacityClasses[i])) {
                        currentLocalOpacity = i;
                        break;
                    }
                }
                let newLocalOpacity = (currentLocalOpacity + 1) % opacityClasses.length;
                walkWnd.classList.remove(...opacityClasses);
                walkWnd.classList.add(opacityClasses[newLocalOpacity]);
                saveSettings();
            }
        });

        let isDragging = false;
        let offsetX, offsetY;

        titleBar.addEventListener('mousedown', (e) => {
            if (e.target.closest('.baddonz-window-controls')) return;
            isDragging = true;
            offsetX = e.clientX - walkWnd.getBoundingClientRect().left;
            offsetY = e.clientY - walkWnd.getBoundingClientRect().top;
            walkWnd.style.cursor = 'grabbing';
            walkWnd.classList.add('top');
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            let newX = e.clientX - offsetX;
            let newY = e.clientY - offsetY;
            const maxX = window.innerWidth - walkWnd.offsetWidth;
            const maxY = window.innerHeight - walkWnd.offsetHeight;
            newX = Math.max(0, Math.min(newX, maxX));
            newY = Math.max(0, Math.min(newY, maxY));
            walkWnd.style.left = `${newX}px`;
            walkWnd.style.top = `${newY}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                walkWnd.style.cursor = '';
                walkWnd.classList.remove('top');
                saveSettings();
            }
        });

        const autoWalkLoop = () => {
            if (!enableWalkingCheckbox.classList.contains("active")) {
                autoWalkTimeout = null;
                return;
            }

            const gateway = Engine.map.gateways.getDrawableItems().filter(o => o.d.x === Engine.hero.d.x && o.d.y === Engine.hero.d.y)[0];
            if (gateway) {
                window._g('walk');
            }

            const minTime = fastWalkingCheckbox.classList.contains("active") ? 500 : 5000;
            const maxTime = fastWalkingCheckbox.classList.contains("active") ? 5000 : 15000;
            const randomTime = Math.random() * (maxTime - minTime) + minTime;

            autoWalkTimeout = setTimeout(autoWalkLoop, randomTime);
        };

        const startAutoWalk = () => {
            if (!autoWalkTimeout) {
                autoWalkLoop();
            }
        };

        const stopAutoWalk = () => {
            if (autoWalkTimeout) {
                clearTimeout(autoWalkTimeout);
                autoWalkTimeout = null;
            }
        };

        enableWalkingCheckbox.addEventListener('click', () => {
            enableWalkingCheckbox.classList.toggle("active");
            saveSettings();
            if (enableWalkingCheckbox.classList.contains("active")) {
                startAutoWalk();
            } else {
                stopAutoWalk();
            }
        });

        fastWalkingCheckbox.addEventListener('click', () => {
            fastWalkingCheckbox.classList.toggle("active");
            saveSettings();
            if (enableWalkingCheckbox.classList.contains("active")) {
                stopAutoWalk();
                startAutoWalk();
            }
        });

        loadSettings();
    };

    init();
})();
