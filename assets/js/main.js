// Theme Toggle
const themeToggle = document.querySelector('.theme-toggle');
const html = document.documentElement;

const savedTheme = localStorage.getItem('theme') || 'dark';
html.setAttribute('data-theme', savedTheme);
updateThemeIcon(savedTheme);

themeToggle.addEventListener('click', () => {
  const current = html.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeIcon(next);
});

function updateThemeIcon(theme) {
  const icon = themeToggle.querySelector('i');
  icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// Mobile Nav Toggle
const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');

if (navToggle) {
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('active');
  });
}

// Intersection Observer for fade-in animations
const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('fade-in');
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

document.querySelectorAll('.post-card, .stat-item, .skill-card, .project-card').forEach(el => {
  el.style.opacity = '0';
  observer.observe(el);
});

// Animated counter for stats
function animateCounters() {
  document.querySelectorAll('.stat-number').forEach(counter => {
    const target = counter.getAttribute('data-count');
    if (!target) return;
    const targetNum = parseInt(target);
    const suffix = counter.getAttribute('data-suffix') || '';
    const duration = 2000;
    const step = targetNum / (duration / 16);
    let current = 0;

    const timer = setInterval(() => {
      current += step;
      if (current >= targetNum) {
        current = targetNum;
        clearInterval(timer);
      }
      counter.textContent = Math.floor(current).toLocaleString() + suffix;
    }, 16);
  });
}

const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCounters();
      statsObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

const statsBar = document.querySelector('.stats-bar');
if (statsBar) statsObserver.observe(statsBar);
