"use strict";
console.log(window.location.pathname);
const navbarButtons = document.querySelectorAll('.navbar-buttons');
const navbarViews = {
    '/': {
        '/test': 'Test',
        '/player': 'Sign-in',
        '/spectate': 'Spectate'
    },
    '/test': {
        '/test': 'Test',
        '/player': 'Sign-in',
        '/spectate': 'Spectate'
    },
    '/player': {
        '/test': 'Test',
        '/player': 'Sign-in'
    }
};
function loadNavbar() {
    if (!navbarViews[window.location.pathname])
        return;
    for (const button of navbarButtons) {
        let viewCandidate = `${button.attributes.getNamedItem('href').value}`;
        if (navbarViews[window.location.pathname][viewCandidate]) {
            button.innerHTML = navbarViews[window.location.pathname][viewCandidate];
        }
        else {
            button.style.display = 'none';
        }
    }
}
loadNavbar();
