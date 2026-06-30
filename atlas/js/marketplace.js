/* ============================================
   ATLAS AI CLOUD — Marketplace Logic
   ============================================ */

(function () {
  'use strict';

  /* ---- DOM Refs ---- */
  var searchInput = document.getElementById('marketplace-search');
  var chips = document.querySelectorAll('.filter-chip');
  var sortSelect = document.getElementById('marketplace-sort');
  var cards = document.querySelectorAll('.model-card');
  var noResults = document.getElementById('no-results');
  var resultsCount = document.getElementById('results-count');
  var resultsNumber = document.getElementById('results-number');
  var grid = document.getElementById('model-grid');

  var activeCategory = 'all';

  /* ---- Normalize text for search ---- */
  function normalize(text) {
    return text.toLowerCase().trim();
  }

  /* ---- Filter Cards ---- */
  function filterCards() {
    var query = normalize(searchInput.value);
    var visibleCount = 0;

    cards.forEach(function (card) {
      var name = normalize(card.getAttribute('data-name') || '');
      var desc = normalize(card.getAttribute('data-desc') || '');
      var publisher = normalize(card.getAttribute('data-publisher') || '');
      var category = normalize(card.getAttribute('data-category') || '');

      var matchesSearch = !query || name.indexOf(query) !== -1 || desc.indexOf(query) !== -1 || publisher.indexOf(query) !== -1;
      var matchesCategory = activeCategory === 'all' || category === activeCategory;

      if (matchesSearch && matchesCategory) {
        card.style.display = '';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });

    // Update results count
    resultsNumber.textContent = visibleCount;

    // Show/hide no results
    if (visibleCount === 0) {
      noResults.classList.add('no-results--visible');
      resultsCount.style.display = 'none';
    } else {
      noResults.classList.remove('no-results--visible');
      resultsCount.style.display = '';
    }
  }

  /* ---- Sort Cards ---- */
  function sortCards() {
    var sortBy = sortSelect.value;
    var cardsArray = Array.prototype.slice.call(cards);

    cardsArray.sort(function (a, b) {
      switch (sortBy) {
        case 'popular':
          return parseFloat(b.getAttribute('data-deploys')) - parseFloat(a.getAttribute('data-deploys'));
        case 'recent':
          return parseInt(b.getAttribute('data-recent'), 10) - parseInt(a.getAttribute('data-recent'), 10);
        case 'performance':
          return parseFloat(a.getAttribute('data-latency')) - parseFloat(b.getAttribute('data-latency'));
        default:
          return 0;
      }
    });

    // Re-append sorted cards
    cardsArray.forEach(function (card) {
      grid.appendChild(card);
    });
  }

  /* ---- Search Input ---- */
  var searchTimeout;
  searchInput.addEventListener('input', function () {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(function () {
      filterCards();
    }, 150);
  });

  /* ---- Category Chips ---- */
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      chips.forEach(function (c) { c.classList.remove('chip--active'); });
      chip.classList.add('chip--active');
      activeCategory = normalize(chip.getAttribute('data-category'));
      filterCards();
    });
  });

  /* ---- Sort Select ---- */
  sortSelect.addEventListener('change', function () {
    sortCards();
    filterCards();
  });

  /* ---- Initial State ---- */
  filterCards();

  /* ---- Scroll Animations ---- */
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.animate-on-scroll').forEach(function (el) {
    observer.observe(el);
  });

})();
