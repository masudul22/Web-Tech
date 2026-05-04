/* ============================================================
   THEPORTAL — movie-detail.js
   ============================================================ */
(function () {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const TMDB_API_KEY = '99d5132ea896f2ea9f1ff32ef2f4baf0';

  function parseCSV(text) {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const movies = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      // Parse CSV line properly, handling quoted fields
      const values = [];
      let currentValue = '';
      let insideQuotes = false;
      
      for (let j = 0; j < lines[i].length; j++) {
        const char = lines[i][j];
        const nextChar = lines[i][j + 1];
        
        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim());
      
      const movie = {};
      headers.forEach((header, index) => {
        // Remove surrounding quotes from the value
        let value = values[index] || '';
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        movie[header] = value;
      });
      
      movies.push(movie);
    }
    
    return movies;
  }

  // Helper function to clean title (remove quotation marks)
  function cleanTitle(title) {
    if (!title) return '';
    // Remove leading and trailing quotation marks
    return title.replace(/^["']|["']$/g, '');
  }

  // Get movie ID from URL query parameter
  const urlParams = new URLSearchParams(window.location.search);
  const movieId = urlParams.get('id');
  const movieTitle = urlParams.get('title');

  if (movieId || movieTitle) {
    (async function loadMovieDetail() {
      try {
        // First, fetch movie data from CSV
        const csvResponse = await fetch('imdb.csv');
        if (!csvResponse.ok) throw new Error('Failed to fetch CSV');
        
        const csvText = await csvResponse.text();
        const movies = parseCSV(csvText);
        let csvMovie;
        
        // Find movie by ID or title
        if (movieId) {
          csvMovie = movies.find(m => m.Const === movieId);
        } else if (movieTitle) {
          csvMovie = movies.find(m => 
            cleanTitle(m.Title).toLowerCase() === movieTitle.toLowerCase()
          );
        }
        
        if (!csvMovie) {
          throw new Error('Movie not found in database');
        }
        
        // Clean the title
        const cleanedTitle = cleanTitle(csvMovie.Title);
        
        // Update page title
        document.title = `${cleanedTitle} - ThePortal`;
        
        // Build the detail HTML structure
        const detailHTML = `
          <div class="movie-detail-content-wrapper">
            <div class="movie-detail-poster-section">
              <button class="back-button" onclick="history.back()" aria-label="Go back to previous page" title="Go back">
                <svg class="back-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
                <span>Back</span>
              </button>
              <img id="detail-movie-poster" src="" alt="${cleanedTitle} poster" class="movie-detail-poster" style="display: none;" />
              <div id="detail-movie-poster-placeholder" class="movie-detail-poster-placeholder">
                <p>Poster Not Found</p>
              </div>
            </div>
            
            <div class="movie-detail-info">
              <h1 class="movie-detail-title" id="detail-movie-title">${cleanedTitle}</h1>
              
              <div class="movie-detail-ratings">
                <span class="detail-rating-badge detail-rating-imdb" id="detail-movie-rating">IMDb: ${csvMovie['IMDb Rating'] || '—'}</span>
                <span class="detail-rating-badge detail-rating-mine" id="detail-movie-your-rating">My Rating: ${csvMovie['Your Rating'] || '—'}</span>
                <button id="wishlist-btn" class="movie-wishlist-btn" aria-label="Add to wishlist">♡ Add to Wishlist</button>
              </div>
              
              <div class="movie-detail-meta-info">
                <span class="movie-detail-year" id="detail-movie-year">${csvMovie.Year || ''}</span>
                <span class="movie-detail-genres" id="detail-movie-genres">${csvMovie.Genres || ''}</span>
              </div>
              
              <p class="movie-detail-description" id="detail-movie-description">No description available.</p>
            </div>
          </div>
        `;
        
        const movieDetailEl = $('#movie-detail');
        movieDetailEl.innerHTML = detailHTML;
        
        // Set up wishlist button
        setTimeout(() => {
          setupWishlistButton(movieId, cleanedTitle, csvMovie);
        }, 100);
        
        
        // Try to fetch poster and description from TMDB
        try {
          const tmdbQuery = encodeURIComponent(cleanedTitle);
          const yearParam = csvMovie.Year ? `&year=${csvMovie.Year}` : '';
          const keyParam = TMDB_API_KEY ? `&api_key=${TMDB_API_KEY}` : '';
          
          // Search for both movies and TV shows
          const movieSearchUrl = `https://api.themoviedb.org/3/search/movie?query=${tmdbQuery}${yearParam}${keyParam}&page=1`;
          const tvSearchUrl = `https://api.themoviedb.org/3/search/tv?query=${tmdbQuery}${yearParam}${keyParam}&page=1`;
          
          const [movieResponse, tvResponse] = await Promise.all([
            fetch(movieSearchUrl),
            fetch(tvSearchUrl)
          ]);
          
          if (movieResponse.ok && tvResponse.ok) {
            const movieData = await movieResponse.json();
            const tvData = await tvResponse.json();
            
            // Combine results from both searches and sort by popularity
            let allResults = [
              ...(movieData.results || []).map(r => ({ ...r, type: 'movie' })),
              ...(tvData.results || []).map(r => ({ ...r, type: 'tv' }))
            ];
            
            allResults.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
            
            if (allResults && allResults.length > 0) {
              const tmdbMovie = allResults[0];
              
              // Update poster
              if (tmdbMovie.poster_path) {
                const posterImg = $('#detail-movie-poster');
                posterImg.src = `https://image.tmdb.org/t/p/w500${tmdbMovie.poster_path}`;
                posterImg.style.display = 'block';
                
                const placeholder = $('#detail-movie-poster-placeholder');
                if (placeholder) placeholder.style.display = 'none';
              }
              
              // Update description
              if (tmdbMovie.overview) {
                const descEl = $('#detail-movie-description');
                if (descEl) descEl.textContent = tmdbMovie.overview;
              }
            }
          }
        } catch (tmdbError) {
          console.warn('Could not fetch from TMDB:', tmdbError);
          // Continue with CSV data only
        }
        
      } catch (error) {
        console.error('Error loading movie detail:', error);
        const detailCard = $('#movie-detail');
        if (detailCard) {
          detailCard.innerHTML = `<div style="color: var(--text-muted); padding: 40px; text-align: center;"><p>${error.message}</p></div>`;
        }
      }
    })();
  } else {
    // No movie ID provided, redirect to home
    window.location.href = '/';
  }

  // Setup wishlist button functionality
  async function setupWishlistButton(movieId, title, movieData) {
    const wishlistBtn = $('#wishlist-btn');
    if (!wishlistBtn) return;

    const token = localStorage.getItem('authToken');

    // Hide button if not logged in
    if (!token) {
      wishlistBtn.style.display = 'none';
      return;
    }

    // Show button for logged in users
    wishlistBtn.style.display = 'inline-block';

    // Check if movie is already in wishlist
    try {
      const response = await fetch(`/api/user/wishlist/check/${movieId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to check wishlist');

      const data = await response.json();
      updateWishlistButtonState(wishlistBtn, data.inWishlist);

      // Add click handler with state tracking
      let isInWishlist = data.inWishlist;
      wishlistBtn.addEventListener('click', async () => {
        await toggleWishlist(wishlistBtn, movieId, title, movieData, token, isInWishlist);
        // Toggle the state after successful update
        isInWishlist = !isInWishlist;
      });
    } catch (error) {
      console.error('Error checking wishlist:', error);
      alert('Error loading wishlist status. Please refresh the page.');
    }
  }

  function updateWishlistButtonState(btn, inWishlist) {
    if (inWishlist) {
      btn.classList.add('in-wishlist');
      btn.textContent = '❤ In Wishlist';
      btn.setAttribute('aria-label', 'Remove from wishlist');
    } else {
      btn.classList.remove('in-wishlist');
      btn.textContent = '♡ Add to Wishlist';
      btn.setAttribute('aria-label', 'Add to wishlist');
    }
  }

  async function toggleWishlist(btn, movieId, title, movieData, token, currentState) {
    btn.disabled = true;

    try {
      if (currentState) {
        // Remove from wishlist
        console.log('Removing from wishlist:', movieId);
        const response = await fetch(`/api/user/wishlist/${movieId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('Delete response status:', response.status);
        const data = await response.json();
        console.log('Delete response data:', data);

        if (!response.ok) {
          throw new Error(data.error || 'Failed to remove from wishlist');
        }

        updateWishlistButtonState(btn, false);
      } else {
        // Add to wishlist
        console.log('Adding to wishlist:', movieId);
        const posterSrc = $('#detail-movie-poster')?.src || '';
        const payload = {
          movieId: movieId,
          title: title,
          year: movieData.Year || '',
          imdbRating: movieData['IMDb Rating'] || '',
          poster: posterSrc
        };

        console.log('Payload being sent:', payload);
        console.log('Token:', token ? 'Present' : 'Missing');

        const response = await fetch('/api/user/wishlist', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        console.log('Add response status:', response.status);
        const data = await response.json();
        console.log('Add response data:', data);

        if (!response.ok) {
          throw new Error(data.error || 'Failed to add to wishlist');
        }

        updateWishlistButtonState(btn, true);
      }
    } catch (error) {
      console.error('Wishlist error:', error);
      alert(`Failed to update wishlist: ${error.message}`);
    }

    btn.disabled = false;
  }

})();

