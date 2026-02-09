/**
 * Mobile menu handler for index.html
 * Handles burger menu open/close functionality
 */

document.addEventListener('DOMContentLoaded', () => {
  const burgerButton = document.getElementById('headerBurger');
  const closeButton = document.getElementById('headerClose');
  const mobileMenu = document.getElementById('headerMobileMenu');
  const header = document.querySelector('.header');
  const body = document.body;

  if (!burgerButton || !closeButton || !mobileMenu) return;

  function openMenu() {
    mobileMenu.classList.add('header__mobile-menu--active');
    burgerButton.style.display = 'none';
    closeButton.style.display = 'flex';
    header.classList.add('header--menu-open');
    body.style.overflow = 'hidden';
  }

  function closeMenu() {
    mobileMenu.classList.remove('header__mobile-menu--active');
    burgerButton.style.display = 'flex';
    closeButton.style.display = 'none';
    header.classList.remove('header--menu-open');
    body.style.overflow = '';
  }

  // Initialize: ensure burger is visible and close is hidden on load
  burgerButton.style.display = 'flex';
  closeButton.style.display = 'none';

  burgerButton.addEventListener('click', openMenu);
  closeButton.addEventListener('click', closeMenu);

  // Close menu when clicking on menu links
  const menuLinks = mobileMenu.querySelectorAll('.header__mobile-link');
  menuLinks.forEach(link => {
    link.addEventListener('click', () => {
      setTimeout(closeMenu, 100);
    });
  });

  // Close menu on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileMenu.classList.contains('header__mobile-menu--active')) {
      closeMenu();
    }
  });
});

