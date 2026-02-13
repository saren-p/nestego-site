/**
 * Nestego Production JavaScript
 * Handles: Language toggle routing, theme toggle, navigation, mobile menu, forms
 */

(function() {
    'use strict';

    // ============================================
    // Route Equivalency Map (EN ↔ FR)
    // ============================================
    const routeMap = {
        // Core pages
        '/': '/fr/',
        '/about-us/': '/fr/a-propos/',
        '/case-studies/': '/fr/realisations/',
        '/resources/': '/fr/ressources/',
        '/contact/': '/fr/contact/',
        '/services/': '/fr/services/',

        // Services
        '/services/web-design/': '/fr/services/conception-web/',
        '/services/managed-it/': '/fr/services/services-ti-geres/',
        '/services/cybersecurity/': '/fr/services/cybersecurite/',
        '/services/cloud-infrastructure/': '/fr/services/cloud-infrastructure/',
        '/services/it-consulting/': '/fr/services/conseil-ti-vcio/',

        // Legal
        '/legal/privacy/': '/fr/legal/confidentialite/',
        '/legal/terms/': '/fr/legal/conditions/'
    };

    function normalizePath(path) {
        let normalizedPath = path || '/';

        // Remove GitHub Pages repository base path if present (e.g. /nestego-site)
        normalizedPath = normalizedPath.replace(/^\/nestego-site(?=\/|$)/, '');

        if (!normalizedPath.startsWith('/')) {
            normalizedPath = `/${normalizedPath}`;
        }
        if (!normalizedPath.endsWith('/')) {
            normalizedPath += '/';
        }

        return normalizedPath || '/';
    }

    function toRelativePath(fromPath, toPath) {
        const fromSegments = fromPath.replace(/^\//, '').replace(/\/$/, '').split('/').filter(Boolean);
        const toSegments = toPath.replace(/^\//, '').replace(/\/$/, '').split('/').filter(Boolean);

        let shared = 0;
        while (shared < fromSegments.length && shared < toSegments.length && fromSegments[shared] === toSegments[shared]) {
            shared += 1;
        }

        const upSegments = fromSegments.slice(shared).map(() => '..');
        const downSegments = toSegments.slice(shared);
        const relativeSegments = [...upSegments, ...downSegments];

        return relativeSegments.length ? `${relativeSegments.join('/')}/` : './';
    }

    // Create reverse map (FR → EN)
    const reverseRouteMap = {};
    Object.keys(routeMap).forEach(en => {
        reverseRouteMap[routeMap[en]] = en;
    });

    // ============================================
    // Helper Functions
    // ============================================

    /**
     * Get the current language based on URL path
     * @returns {'en' | 'fr'}
     */
    function getCurrentLanguage() {
        const path = normalizePath(window.location.pathname);
        return path.startsWith('/fr/') ? 'fr' : 'en';
    }

    /**
     * Get the equivalent route in the other language
     * @param {string} currentPath - Current URL path
     * @returns {string} - Equivalent path in other language
     */
    function getEquivalentRoute(currentPath) {
        const normalizedPath = normalizePath(currentPath);
        let targetPath;

        if (routeMap[normalizedPath]) {
            targetPath = routeMap[normalizedPath];
        } else if (reverseRouteMap[normalizedPath]) {
            targetPath = reverseRouteMap[normalizedPath];
        } else {
            const currentLang = getCurrentLanguage();
            targetPath = currentLang === 'en'
                ? `/fr${normalizedPath === '/' ? '/' : normalizedPath}`
                : normalizedPath.replace(/^\/fr/, '') || '/';
        }

        return toRelativePath(normalizedPath, normalizePath(targetPath));
    }

    /**
     * Set active navigation state based on current path
     */
    function setActiveNavigation() {
        const currentPath = window.location.pathname;
        const normalizedPath = currentPath.endsWith('/') ? currentPath : currentPath + '/';

        // Desktop navigation
        const navLinks = document.querySelectorAll('.nav-link');
        const dropdownLinks = document.querySelectorAll('.dropdown-link');
        const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');

        // Remove all active states first
        navLinks.forEach(link => link.classList.remove('active'));
        dropdownLinks.forEach(link => link.classList.remove('active'));
        mobileNavLinks.forEach(link => link.classList.remove('active'));

        // Check each nav link
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href === normalizedPath || (normalizedPath === '/' && href === '/') ||
                (normalizedPath !== '/' && href !== '/' && normalizedPath.startsWith(href))) {
                link.classList.add('active');
            }
        });

        // Check dropdown links for exact match
        dropdownLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href === normalizedPath) {
                link.classList.add('active');
                // Also activate parent nav item
                const parentNav = link.closest('.nav-item');
                if (parentNav) {
                    const parentLink = parentNav.querySelector('.nav-link');
                    if (parentLink) {
                        parentLink.classList.add('active');
                    }
                }
            }
        });

        // Mobile navigation
        mobileNavLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href === normalizedPath || (normalizedPath !== '/' && href !== '/' && normalizedPath.startsWith(href))) {
                link.classList.add('active');
            }
        });
    }

    /**
     * Update footer copyright year
     */
    function updateCopyright() {
        const copyrightEl = document.getElementById('copyright');
        if (copyrightEl) {
            const year = new Date().getFullYear();
            const lang = getCurrentLanguage();
            copyrightEl.textContent = `© ${year} Les Entreprises Nestego.`;
        }
    }

    /**
     * Show toast notification
     * @param {string} message - Message to display
     * @param {string} type - 'success' or 'error'
     */
    function showToast(message, type) {
        // Remove existing toast
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        // Create new toast
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('visible'), 10);

        // Auto hide
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 500);
        }, 5000);
    }

    // ============================================
    // Theme Toggle
    // ============================================

    function initThemeToggle() {
        // ALWAYS apply saved theme first, even if toggle doesn't exist on this page
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.setAttribute('data-theme', 'dark');
        }

        // Only attach click handler if toggle button exists
        const themeToggle = document.getElementById('themeToggle');
        if (!themeToggle) return;

        themeToggle.addEventListener('click', function() {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            
            // Add logo pop animation on theme toggle
            const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (!prefersReducedMotion) {
                const logo = document.getElementById('logo');
                if (logo) {
                    logo.classList.add('pop');
                    setTimeout(() => logo.classList.remove('pop'), 500);
                }
            }
        });
    }

    // ============================================
    // Language Toggle
    // ============================================

    function initLanguageToggle() {
        const langToggle = document.getElementById('langToggle');
        if (!langToggle) return;

        langToggle.addEventListener('click', function() {
            const equivalentRoute = getEquivalentRoute(window.location.pathname);
            window.location.href = equivalentRoute;
        });
    }

    // ============================================
    // Header Scroll Effect
    // ============================================

    function initHeaderScroll() {
        const header = document.getElementById('header');
        if (!header) return;

        function updateHeader() {
            if (window.pageYOffset > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        }

        window.addEventListener('scroll', updateHeader);
        updateHeader(); // Initial check
    }

    // ============================================
    // Mobile Menu
    // ============================================

    function initMobileMenu() {
        const mobileToggle = document.getElementById('mobileToggle');
        const mobileMenu = document.getElementById('mobileMenu');

        if (!mobileToggle || !mobileMenu) return;

        mobileMenu.setAttribute('aria-hidden', 'true');

        function openMenu() {
            mobileToggle.classList.add('active');
            mobileMenu.classList.add('active');
            mobileToggle.setAttribute('aria-expanded', 'true');
            mobileMenu.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        }

        function closeMenu() {
            mobileToggle.classList.remove('active');
            mobileMenu.classList.remove('active');
            mobileToggle.setAttribute('aria-expanded', 'false');
            mobileMenu.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
            mobileToggle.focus();
        }

        mobileToggle.addEventListener('click', function() {
            if (mobileToggle.classList.contains('active')) {
                closeMenu();
            } else {
                openMenu();
            }
        });

        // Close on link click
        mobileMenu.querySelectorAll('a').forEach(function(link) {
            link.addEventListener('click', closeMenu);
        });

        // Close on escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && mobileMenu.classList.contains('active')) {
                closeMenu();
            }
        });
    }

    // ============================================
    // Logo Animation
    // ============================================

    function initLogoAnimation() {
        const logo = document.getElementById('logo');
        if (!logo) return;

        logo.addEventListener('click', function(e) {
            // Only animate if staying on same page or going to home
            const href = this.getAttribute('href');
            const isHome = window.location.pathname === '/' || window.location.pathname === '/fr/';

            if (href === '/' || href === '/fr/') {
                this.classList.add('animate');
                setTimeout(() => this.classList.remove('animate'), 600);
            }
        });
    }

    // ============================================
    // Contact Form Handling
    // ============================================

    function initContactForm() {
        const form = document.getElementById('contactForm');
        if (!form) return;

        const submitBtn = form.querySelector('.form-submit');
        let originalBtnText = '';

        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            // Get form data
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            // Validate required fields
            const requiredFields = ['name', 'email', 'challenge'];
            let isValid = true;

            requiredFields.forEach(field => {
                const input = form.querySelector(`[name="${field}"]`);
                const errorEl = document.getElementById(`${field}-error`);

                if (!data[field] || data[field].trim() === '') {
                    isValid = false;
                    if (input) input.classList.add('error');
                    if (errorEl) errorEl.style.display = 'block';
                } else {
                    if (input) input.classList.remove('error');
                    if (errorEl) errorEl.style.display = 'none';
                }
            });

            // Email validation
            const emailInput = form.querySelector('[name="email"]');
            const emailError = document.getElementById('email-error');
            if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
                isValid = false;
                if (emailInput) emailInput.classList.add('error');
                if (emailError) emailError.style.display = 'block';
            }

            if (!isValid) {
                showToast('Please fill in all required fields correctly.', 'error');
                return;
            }

            // Show sending state
            if (submitBtn) {
                originalBtnText = submitBtn.innerHTML;
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span>Sending...</span>';
            }

            try {
                // POST to Cloudflare Worker endpoint
                const response = await fetch('https://YOUR-WORKER-URL.example/submit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    showToast('Message sent successfully! We\'ll get back to you within 24 hours.', 'success');
                    form.reset();
                } else {
                    throw new Error('Server error');
                }
            } catch (error) {
                showToast('Failed to send message. Please try again or email us directly.', 'error');
            } finally {
                // Restore button state
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnText;
                }
            }
        });

        // Remove error state on input
        form.querySelectorAll('.form-input, .form-textarea, .form-select').forEach(input => {
            input.addEventListener('input', function() {
                this.classList.remove('error');
                const errorEl = document.getElementById(`${this.name}-error`);
                if (errorEl) errorEl.style.display = 'none';
            });
        });
    }

    // ============================================
    // Scroll Reveal Animation
    // ============================================

    function initScrollReveal() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        // Observe elements with reveal class
        document.querySelectorAll('.reveal').forEach(el => {
            observer.observe(el);
        });
    }

    // ============================================
    // Count-Up Animation for Stats
    // ============================================

    function initCountUp() {
        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const countElements = document.querySelectorAll('.cred-stat-value');

        if (countElements.length === 0) return;

        const observerOptions = {
            threshold: 0.5,
            rootMargin: '0px'
        };

        const countObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    const originalText = el.textContent;

                    // Parse the value - handle formats like "10+", "150+", "99.9%"
                    const match = originalText.match(/^([\d.]+)(\+?%?)$/);
                    if (!match) {
                        countObserver.unobserve(el);
                        return;
                    }

                    const targetValue = parseFloat(match[1]);
                    const suffix = match[2]; // + or % or empty

                    if (prefersReducedMotion) {
                        // Just show final value without animation
                        el.textContent = originalText;
                    } else {
                        // Animate the count
                        animateCount(el, targetValue, suffix);
                    }

                    countObserver.unobserve(el);
                }
            });
        }, observerOptions);

        countElements.forEach(el => countObserver.observe(el));
    }

    function animateCount(element, targetValue, suffix) {
        const duration = 2000; // 2 seconds
        const startTime = performance.now();
        const startValue = 0;

        // Determine if it's a decimal (like 99.9)
        const isDecimal = targetValue % 1 !== 0;
        const decimals = isDecimal ? 1 : 0;

        function updateCount(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic for smoother finish
            const easeOutProgress = 1 - Math.pow(1 - progress, 3);
            const currentValue = startValue + (targetValue - startValue) * easeOutProgress;

            if (isDecimal) {
                element.textContent = currentValue.toFixed(decimals) + suffix;
            } else {
                element.textContent = Math.round(currentValue) + suffix;
            }

            if (progress < 1) {
                requestAnimationFrame(updateCount);
            } else {
                // Ensure final value is exact
                if (isDecimal) {
                    element.textContent = targetValue.toFixed(decimals) + suffix;
                } else {
                    element.textContent = targetValue + suffix;
                }
            }
        }

        requestAnimationFrame(updateCount);
    }

    // ============================================
    // Initialize Everything
    // ============================================

    function init() {
        initThemeToggle();
        initLanguageToggle();
        initHeaderScroll();
        initMobileMenu();
        initLogoAnimation();
        setActiveNavigation();
        updateCopyright();
        initContactForm();
        initScrollReveal();
        initCountUp();
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
