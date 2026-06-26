// ==UserScript==
// @name          Baddonz
// @version       2.11
// @description   Menadżer dodatków by besiak
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// @icon          https://i.imgur.com/OAtRFEw.png
// @downloadURL   https://besiak6.github.io/scripts/beta.user.js
// @updateURL     https://besiak6.github.io/scripts/beta.user.js
// ==/UserScript==
(function () {
    const v = localStorage.getItem('bdz_ver') || '0';
    const s = document.createElement('script');
    s.src = `https://besiak6.github.io/scripts/beta.js?v=${v}`;
    document.head.appendChild(s);
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = `https://besiak6.github.io/styles/beta.css?v=${v}`;
    document.head.appendChild(l);
    fetch(`https://besiak6.github.io/scripts/version.json?t=${Date.now()}`)
        .then(r => r.json())
        .then(d => { if (d?.version !== v) localStorage.setItem('bdz_ver', d.version); })
        .catch(() => {});
})();
