/* ============================================================
   THEPORTAL — lists.js
   ============================================================ */
(function () {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  const announce = (msg) => {
    const r = $('#live-region');
    if (!r) return;
    r.textContent = '';
    requestAnimationFrame(() => { r.textContent = msg; });
  };

  let lastFocusedElement = null;

  /* ============================================================
     CSV PARSER
     ============================================================ */
  function parseCSV(text) {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const movies = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',').map(v => v.trim());
      const movie = {};
      
      headers.forEach((header, index) => {
        movie[header] = values[index] || '';
      });
      
      movies.push(movie);
    }
    
    return movies;
  }

  // Helper function to parse date
  function parseDate(dateString) {
    if (!dateString) return new Date(0);
    const parts = dateString.split('-');
    if (parts.length === 3) {
      return new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
    }
    const slashParts = dateString.split('/');
    if (slashParts.length === 3) {
      return new Date(`${slashParts[2]}-${slashParts[1]}-${slashParts[0]}`);
    }
    return new Date(0);
  }

  // Helper function to fetch poster from TMDB
  async function fetchTMDBPoster(title, year, posterImg, posterPlaceholder, callback) {
    try {
      const TMDB_API_KEY = '99d5132ea896f2ea9f1ff32ef2f4baf0';
      
      const query = encodeURIComponent(title);
      const yearParam = year ? `&year=${year}` : '';
      const keyParam = TMDB_API_KEY ? `&api_key=${TMDB_API_KEY}` : '';
      const searchUrl = `https://api.themoviedb.org/3/search/movie?query=${query}${yearParam}${keyParam}`;
      
      const response = await fetch(searchUrl);
      
      if (!response.ok) return false;
      
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const tmdbMovie = data.results[0];
        
        if (tmdbMovie.poster_path) {
          const posterUrl = `https://image.tmdb.org/t/p/w500${tmdbMovie.poster_path}`;
          posterImg.src = posterUrl;
          posterImg.style.display = 'block';
          posterPlaceholder.style.display = 'none';
          
          if (callback) callback(posterUrl);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.warn(`Could not fetch poster for ${title}:`, error);
      return false;
    }
  }

  /* ============================================================
     MODAL MANAGEMENT
     ============================================================ */
  function openModal(modalId) {
    const modal = $(`#${modalId}`);
    if (!modal) return;
    
    lastFocusedElement = document.activeElement;
    modal.hidden = false;
    announce('Modal opened');
    modal.addEventListener('keydown', trapFocus);
  }

  function closeModal(modalId) {
    const modal = $(`#${modalId}`);
    if (!modal) return;
    
    modal.hidden = true;
    modal.removeEventListener('keydown', trapFocus);
    announce('Modal closed');

    if (lastFocusedElement) {
      lastFocusedElement.focus();
      lastFocusedElement = null;
    }
  }

  function trapFocus(e) {
    if (e.key !== 'Tab' && e.key !== 'Escape') return;

    if (e.key === 'Escape') {
      e.preventDefault();
      const backdrop = e.currentTarget;
      closeModal(backdrop.id);
      return;
    }

    const backdrop  = e.currentTarget;
    const focusable = [...backdrop.querySelectorAll('button, a, [tabindex]:not([tabindex="-1"])')].filter(el => !el.hidden && el.offsetParent !== null);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
  }

  /* ============================================================
     LOAD MOVIES BY GENRE
     ============================================================ */
  function loadMoviesByGenre(config) {
    const { genreName, toggleBtnId, modalId, listId, cardPosterId, cardPlaceholderId, cardImgId } = config;
    
    const toggleBtn = $(`#${toggleBtnId}`);
    const modal = $(`#${modalId}`);
    const listElement = $(`#${listId}`);
    const closeBtn = $(`#${modalId.replace('modal', 'modal-close')}`);
    
    if (!toggleBtn || !modal || !listElement) return;
    
    // Modal open/close handlers
    toggleBtn.addEventListener('click', () => openModal(modalId));
    
    if (closeBtn) {
      closeBtn.addEventListener('click', () => closeModal(modalId));
    }
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modalId);
      }
    });
    
    // Load movies
    (async function loadGenreMovies() {
      try {
        const response = await fetch('imdb.csv');
        if (!response.ok) throw new Error('Failed to fetch CSV');
        
        const csvText = await response.text();
        const movies = parseCSV(csvText);
        
        // Filter: Genre AND Your Rating > 7
        const genreMovies = movies.filter(movie => {
          const genres = movie.Genres || '';
          const myRating = parseFloat(movie['Your Rating'] || 0);
          return genres.toLowerCase().includes(genreName.toLowerCase()) && myRating > 7;
        });
        
        // Sort by Release Date descending (latest first)
        genreMovies.sort((a, b) => {
          const dateA = parseDate(a['Release Date'] || '');
          const dateB = parseDate(b['Release Date'] || '');
          return dateB - dateA;
        });
        
        // Get top 10 movies
        const topTenMovies = genreMovies.slice(0, 10);
        
        // Populate the modal list
        listElement.innerHTML = '';
        
        if (topTenMovies.length === 0) {
          const li = document.createElement('li');
          li.className = `${genreName.toLowerCase().replace('-', '')}-list-item`;
          li.innerHTML = '<span style="color: var(--text-muted);">No movies found in this genre</span>';
          listElement.appendChild(li);
          return;
        }
        
        for (const [index, movie] of topTenMovies.entries()) {
          const li = document.createElement('li');
          li.className = `${genreName.toLowerCase().replace('-', '')}-list-item`;
          
          // Create link wrapper
          const a = document.createElement('a');
          a.href = `movie-detail.html?id=${encodeURIComponent(movie.Const)}`;
          a.className = `${genreName.toLowerCase().replace('-', '')}-link-wrapper`;
          
          // Add item number
          const span = document.createElement('span');
          span.className = 'item-num';
          span.textContent = String(index + 1).padStart(2, '0');
          a.appendChild(span);
          
          // Add poster container
          const posterDiv = document.createElement('div');
          posterDiv.className = `${genreName.toLowerCase().replace('-', '')}-poster-container`;
          
          const posterImg = document.createElement('img');
          posterImg.className = `${genreName.toLowerCase().replace('-', '')}-poster`;
          posterImg.alt = `${movie.Title} poster`;
          posterImg.style.display = 'none';
          
          const posterPlaceholder = document.createElement('div');
          posterPlaceholder.className = `${genreName.toLowerCase().replace('-', '')}-poster-placeholder`;
          posterPlaceholder.textContent = '—';
          
          posterDiv.appendChild(posterImg);
          posterDiv.appendChild(posterPlaceholder);
          a.appendChild(posterDiv);
          
          // Add title and ratings container
          const infoDiv = document.createElement('div');
          infoDiv.className = `${genreName.toLowerCase().replace('-', '')}-info`;
          
          // Add title
          const titleSpan = document.createElement('span');
          titleSpan.className = `${genreName.toLowerCase().replace('-', '')}-title`;
          titleSpan.textContent = movie.Title;
          infoDiv.appendChild(titleSpan);
          
          // Add ratings
          const ratingsSpan = document.createElement('span');
          ratingsSpan.className = `${genreName.toLowerCase().replace('-', '')}-ratings`;
          const imdbRating = movie['IMDb Rating'] || '—';
          const myRating = movie['Your Rating'] || '—';
          ratingsSpan.textContent = `IMDb: ${imdbRating} • Mine: ${myRating}`;
          infoDiv.appendChild(ratingsSpan);
          
          a.appendChild(infoDiv);
          
          li.appendChild(a);
          listElement.appendChild(li);
          
          // Fetch poster from TMDB asynchronously for list item
          fetchTMDBPoster(movie.Title, movie.Year, posterImg, posterPlaceholder);
        }
        
        // Fetch poster for card preview from first available movie with a poster
        if (topTenMovies.length > 0 && cardImgId && cardPlaceholderId && cardPosterId) {
          const cardImg = $(`#${cardImgId}`);
          const cardPlaceholder = $(`#${cardPlaceholderId}`);
          const cardPoster = $(`#${cardPosterId}`);
          
          if (cardImg && cardPlaceholder) {
            // Try to fetch poster from each movie in order until one succeeds
            (async () => {
              let posterFound = false;
              for (const movie of topTenMovies) {
                const success = await fetchTMDBPoster(movie.Title, movie.Year, cardImg, cardPlaceholder, (posterUrl) => {
                  if (posterUrl && cardPoster) {
                    cardPoster.style.display = 'block';
                  }
                });
                if (success) {
                  posterFound = true;
                  break;
                }
              }
            })();
          }
        }
      } catch (error) {
        console.error(`Error loading ${genreName} movies:`, error);
        listElement.innerHTML = `<li><span style="color: var(--text-muted);">Unable to load ${genreName} movies</span></li>`;
      }
    })();
  }

  /* ============================================================
     LOAD ALL GENRE LISTS
     ============================================================ */
  const genres = [
    { genreName: 'Thriller', toggleBtnId: 'thriller-toggle', modalId: 'thriller-modal', listId: 'thriller-list', cardPosterId: 'thriller-poster-preview', cardPlaceholderId: 'thriller-poster-placeholder', cardImgId: 'thriller-poster-img' },
    { genreName: 'Romance', toggleBtnId: 'romance-toggle', modalId: 'romance-modal', listId: 'romance-list', cardPosterId: 'romance-poster-preview', cardPlaceholderId: 'romance-poster-placeholder', cardImgId: 'romance-poster-img' },
    { genreName: 'Horror', toggleBtnId: 'horror-toggle', modalId: 'horror-modal', listId: 'horror-list', cardPosterId: 'horror-poster-preview', cardPlaceholderId: 'horror-poster-placeholder', cardImgId: 'horror-poster-img' },
    { genreName: 'Comedy', toggleBtnId: 'comedy-toggle', modalId: 'comedy-modal', listId: 'comedy-list', cardPosterId: 'comedy-poster-preview', cardPlaceholderId: 'comedy-poster-placeholder', cardImgId: 'comedy-poster-img' },
    { genreName: 'Drama', toggleBtnId: 'drama-toggle', modalId: 'drama-modal', listId: 'drama-list', cardPosterId: 'drama-poster-preview', cardPlaceholderId: 'drama-poster-placeholder', cardImgId: 'drama-poster-img' },
    { genreName: 'Sci-Fi', toggleBtnId: 'scifi-toggle', modalId: 'scifi-modal', listId: 'scifi-list', cardPosterId: 'scifi-poster-preview', cardPlaceholderId: 'scifi-poster-placeholder', cardImgId: 'scifi-poster-img' },
    { genreName: 'Fantasy', toggleBtnId: 'fantasy-toggle', modalId: 'fantasy-modal', listId: 'fantasy-list', cardPosterId: 'fantasy-poster-preview', cardPlaceholderId: 'fantasy-poster-placeholder', cardImgId: 'fantasy-poster-img' },
    { genreName: 'Action', toggleBtnId: 'action-toggle', modalId: 'action-modal', listId: 'action-list', cardPosterId: 'action-poster-preview', cardPlaceholderId: 'action-poster-placeholder', cardImgId: 'action-poster-img' },
  ];

  genres.forEach(config => {
    loadMoviesByGenre(config);
  });

})();
