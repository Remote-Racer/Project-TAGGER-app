"use strict";
console.log(window.location.pathname);
const navbarButtons = document.querySelectorAll('.navbar-buttons');
const navbarViews = {
    '/': {
        '/test': 'Test',
        '/player': 'Play',
        '/spectator': 'Spectate',
        '/admin': 'Admin'
    },
    '/test': {
        '/test': 'Test',
        '/player': 'Play',
        '/admin': 'Admin',
        '/spectator': 'Spectate'
    },
    '/player': {
        '/test': 'Test',
        '/docs': 'Documentation'
    },
    '/docs': {
        '/test': 'Test',
        '/player': 'Play',
        '/spectator': 'Spectate'
    },
    '/admin': {
        '/test': 'Test',
        '/player': 'Play',
        '/admin': 'Admin',
        '/spectator': 'Spectate'
    }
};
function loadNavbar() {
    if (!navbarViews[window.location.pathname])
        return;
    for (const button of navbarButtons) {
        const buttonHREF = button.attributes.getNamedItem('href');
        if (!buttonHREF)
            continue;
        let viewCandidate = `${buttonHREF.value}`;
        if (navbarViews[window.location.pathname][viewCandidate]) {
            button.innerHTML = navbarViews[window.location.pathname][viewCandidate];
            button.classList.remove('deactivated');
        }
    }
}
loadNavbar();
