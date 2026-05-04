/* ============================================================
   SERVER.JS — Express server for ThePortal
   ============================================================ */
require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const cors = require('cors');

// Database connection
const connectDatabase = require('./database');
const User = require('./models/User');
const { protect } = require('./middleware/auth');

const app = express();
const PORT = 3000;

// Connect to MongoDB
connectDatabase();

// TMDb API Key (loaded from .env file)
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_URL = 'https://image.tmdb.org/t/p/w500';

// Validate API key
if (!TMDB_API_KEY) {
  console.error('❌ ERROR: TMDB_API_KEY not found in .env file');
  console.error('Please create a .env file with: TMDB_API_KEY=your_key_here');
  process.exit(1);
}

// Enable CORS
app.use(cors());

// Serve static files with cache headers for quotes
app.use('/quotes', express.static(path.join(__dirname, 'quotes'), {
  maxAge: '1d', // Cache images for 1 day
  etag: false
}));

// Serve static files
app.use(express.static(path.join(__dirname)));
app.use(express.json());

/* ============================================================
   TMDB POSTER & DESCRIPTION FETCHER
   ============================================================ */
async function fetchMovieDetails(movieTitle, movieYear) {
  try {
    // Search for both movies and TV series
    const movieSearchUrl = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(movieTitle)}&year=${movieYear}`;
    const tvSearchUrl = `${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(movieTitle)}&first_air_date_year=${movieYear}`;
    
    console.log(`🎬 Searching TMDb for: ${movieTitle} (${movieYear})`);
    
    // Fetch both searches in parallel
    const [movieResponse, tvResponse] = await Promise.all([
      fetch(movieSearchUrl),
      fetch(tvSearchUrl)
    ]);
    
    if (!movieResponse.ok || !tvResponse.ok) {
      console.log(`❌ TMDb search error: Movies ${movieResponse.status}, TV ${tvResponse.status}`);
      return { poster: null, description: null };
    }
    
    const movieData = await movieResponse.json();
    const tvData = await tvResponse.json();
    
    console.log(`📊 TMDb Search Results: ${movieData.results.length} movies, ${tvData.results.length} TV series found`);
    
    // Combine results and prioritize by popularity/rating
    let allResults = [
      ...(movieData.results || []).map(r => ({ ...r, type: 'movie' })),
      ...(tvData.results || []).map(r => ({ ...r, type: 'tv' }))
    ];
    
    // Sort by popularity (descending) to get the best match
    allResults.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    
    // Find the best match
    if (allResults && allResults.length > 0) {
      const result = allResults[0];
      
      let posterUrl = null;
      if (result.poster_path) {
        posterUrl = `${TMDB_IMAGE_URL}${result.poster_path}`;
        console.log(`✅ Poster found (${result.type}): ${posterUrl}`);
      }
      
      let description = null;
      if (result.overview) {
        description = result.overview;
        console.log(`✅ Description found (${result.type}): ${description.substring(0, 50)}...`);
      } else {
        console.log(`⚠️  No description found`);
      }
      
      return { poster: posterUrl, description: description };
    }
    
    console.log(`⚠️  No movie or TV series found for: ${movieTitle}`);
    return { poster: null, description: null };
  } catch (error) {
    console.error('❌ Error fetching movie details:', error);
    return { poster: null, description: null };
  }
}

/* ============================================================
   CSV PARSER UTILITY
   ============================================================ */
function parseIMDbCSV() {
  try {
    const csvPath = path.join(__dirname, 'imdb.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    
    return records;
  } catch (error) {
    console.error('Error parsing CSV:', error);
    return [];
  }
}

// Helper function to generate JWT token
function generateToken(userId) {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '2h' });
}

/* ============================================================
   AUTHENTICATION ENDPOINTS
   ============================================================ */

// Register new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, name, password, passwordConfirm } = req.body;

    // Validate input
    if (!username || !email || !name || !password) {
      return res.status(400).json({ error: 'Please provide all required fields' });
    }

    if (password !== passwordConfirm) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    // Check if user already exists
    const userExists = await User.findOne({
      $or: [{ email: email }, { username: username }]
    });

    if (userExists) {
      return res.status(400).json({ error: 'Email or username already in use' });
    }

    // Create user
    const user = await User.create({
      username,
      email,
      name,
      password,
    });

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle MongoDB validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ error: `${field.charAt(0).toUpperCase() + field.slice(1)} already in use` });
    }
    
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }

    // Check for user (need to select password since it's hidden by default)
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isPasswordMatch = await user.matchPassword(password);

    if (!isPasswordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Verify token & get current user
app.get('/api/auth/verify', protect, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Failed to verify user' });
  }
});

/* ============================================================
   USER PROFILE ENDPOINTS
   ============================================================ */

// Get user profile
app.get('/api/user/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update user profile
app.put('/api/user/profile', protect, async (req, res) => {
  try {
    const { name, username, email } = req.body;

    // Validate input
    if (!name || !username || !email) {
      return res.status(400).json({ error: 'Please provide all required fields' });
    }

    // Check if username or email already exists (excluding current user)
    const existingUser = await User.findOne({
      $or: [{ email: email }, { username: username }],
      _id: { $ne: req.userId }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email or username already in use' });
    }

    // Update user
    const user = await User.findByIdAndUpdate(
      req.userId,
      { name, username, email, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/* ============================================================
   WISHLIST ENDPOINTS
   ============================================================ */

// Get user's wishlist
app.get('/api/user/wishlist', protect, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    res.json({
      success: true,
      wishlist: user.wishlist,
    });
  } catch (error) {
    console.error('Get wishlist error:', error);
    res.status(500).json({ error: 'Failed to get wishlist' });
  }
});

// Add movie to wishlist
app.post('/api/user/wishlist', protect, async (req, res) => {
  try {
    const { movieId, title, year, imdbRating, poster } = req.body;

    if (!movieId || !title) {
      return res.status(400).json({ error: 'Please provide movie details' });
    }

    const user = await User.findById(req.userId);

    // Check if movie already in wishlist
    const exists = user.wishlist.some(item => item.movieId === movieId);

    if (exists) {
      return res.status(400).json({ error: 'Movie already in wishlist' });
    }

    // Add to wishlist
    user.wishlist.push({
      movieId,
      title,
      year,
      imdbRating,
      poster,
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: 'Movie added to wishlist',
      wishlist: user.wishlist,
    });
  } catch (error) {
    console.error('Add to wishlist error:', error);
    res.status(500).json({ error: 'Failed to add to wishlist' });
  }
});

// Remove movie from wishlist
app.delete('/api/user/wishlist/:movieId', protect, async (req, res) => {
  try {
    const { movieId } = req.params;

    const user = await User.findById(req.userId);

    // Remove from wishlist
    user.wishlist = user.wishlist.filter(item => item.movieId !== movieId);

    await user.save();

    res.json({
      success: true,
      message: 'Movie removed from wishlist',
      wishlist: user.wishlist,
    });
  } catch (error) {
    console.error('Remove from wishlist error:', error);
    res.status(500).json({ error: 'Failed to remove from wishlist' });
  }
});

// Check if movie is in wishlist
app.get('/api/user/wishlist/check/:movieId', protect, async (req, res) => {
  try {
    const { movieId } = req.params;
    const user = await User.findById(req.userId);

    const exists = user.wishlist.some(item => item.movieId === movieId);

    res.json({
      success: true,
      inWishlist: exists,
    });
  } catch (error) {
    console.error('Check wishlist error:', error);
    res.status(500).json({ error: 'Failed to check wishlist' });
  }
});

/* ============================================================
   API ENDPOINT: Search movies
   ============================================================ */
app.get('/api/search', async (req, res) => {
  const query = req.query.q || '';
  
  if (!query || query.trim().length === 0) {
    return res.json([]);
  }

  try {
    const movies = parseIMDbCSV();
    const searchTerm = query.toLowerCase().trim();
    
    // Filter movies by title, genres, or directors
    const results = movies.filter(movie => {
      const title = (movie['Title'] || '').toLowerCase();
      const genres = (movie['Genres'] || '').toLowerCase();
      const directors = (movie['Directors'] || '').toLowerCase();
      
      return title.includes(searchTerm) || 
             genres.includes(searchTerm) || 
             directors.includes(searchTerm);
    }).slice(0, 10); // Limit to 10 results

    // Fetch TMDb details for top results
    const resultsWithDetails = await Promise.all(
      results.map(async (movie) => {
        const details = await fetchMovieDetails(movie['Title'], movie['Year']);
        return {
          title: movie['Title'],
          year: parseInt(movie['Year']),
          genres: movie['Genres'],
          imdbRating: parseFloat(movie['IMDb Rating']),
          yourRating: parseInt(movie['Your Rating']),
          url: movie['URL'],
          id: movie['Const'],
          poster: details.poster,
          description: details.description,
        };
      })
    );

    res.json(resultsWithDetails);
  } catch (error) {
    console.error('Error searching movies:', error);
    res.status(500).json({ error: 'Failed to search movies' });
  }
});

/* ============================================================
   API ENDPOINT: Get last watched movie
   ============================================================ */
app.get('/api/last-movie', async (req, res) => {
  const movies = parseIMDbCSV();
  
  if (movies.length === 0) {
    return res.status(404).json({ error: 'No movies found' });
  }

  // Find the most recent movie by "Date Rated"
  const lastMovie = movies.reduce((latest, current) => {
    const currentDate = new Date(current['Date Rated']);
    const latestDate = new Date(latest['Date Rated']);
    return currentDate > latestDate ? current : latest;
  });

  // Fetch poster and description from TMDb
  const movieDetails = await fetchMovieDetails(lastMovie['Title'], lastMovie['Year']);

  // Format response with only required fields
  const movieData = {
    title: lastMovie['Title'],
    imdbRating: parseFloat(lastMovie['IMDb Rating']),
    year: parseInt(lastMovie['Year']),
    genres: lastMovie['Genres'],
    yourRating: parseInt(lastMovie['Your Rating']),
    dateRated: lastMovie['Date Rated'],
    url: lastMovie['URL'],
    directors: lastMovie['Directors'],
    runtime: lastMovie['Runtime (mins)'],
    poster: movieDetails.poster,
    description: movieDetails.description,
  };

  res.json(movieData);
});

/* ============================================================
   API ENDPOINT: Get APOD (Astronomy Picture of the Day)
   ============================================================ */
app.get('/api/apod', async (req, res) => {
  try {
    const apiKey = 'DEMO_KEY';
    const response = await fetch(
      `https://api.nasa.gov/planetary/apod?api_key=${apiKey}`
    );
    
    if (!response.ok) {
      console.error('NASA APOD Error:', response.status);
      throw new Error(`APOD API error: ${response.status}`);
    }
    
    const apodData = await response.json();
    res.json(apodData);
  } catch (error) {
    console.error('Error fetching APOD:', error);
    // Return a fallback image
    res.json({
      title: "Astronomy Picture of the Day",
      explanation: "The NASA API is currently unavailable. Check back later for the latest astronomy picture.",
      url: "https://apod.nasa.gov/apod/image/2404/M51_2024.jpg",
      date: new Date().toISOString().split('T')[0]
    });
  }
});

/* ============================================================
   API ENDPOINT: Get random quote
   ============================================================ */
app.get('/api/quote', async (req, res) => {
  try {
    const response = await fetch('https://api.quotable.io/random');
    
    if (!response.ok) {
      throw new Error(`Quotable API error: ${response.status}`);
    }
    
    const quoteData = await response.json();
    res.json(quoteData);
  } catch (error) {
    console.error('Error fetching quote:', error);
    // Return a fallback quote
    res.json({
      content: "The only way to do great work is to love what you do.",
      author: "Steve Jobs"
    });
  }
});

/* ============================================================
   API ENDPOINT: Get random quote image
   ============================================================ */
// Cache quote image files on startup
let cachedQuoteFiles = [];
function loadQuoteImages() {
  try {
    const quotesDir = path.join(__dirname, 'quotes');
    cachedQuoteFiles = fs.readdirSync(quotesDir).filter(file => {
      return /\.(jpg|jpeg|png|gif)$/i.test(file);
    });
    console.log(`Loaded ${cachedQuoteFiles.length} quote images into cache`);
  } catch (error) {
    console.error('Error loading quote images:', error);
  }
}

// Load on startup
loadQuoteImages();

app.get('/api/random-quote-image', (req, res) => {
  try {
    if (cachedQuoteFiles.length === 0) {
      return res.status(404).json({ error: 'No quote images found' });
    }
    
    const randomFile = cachedQuoteFiles[Math.floor(Math.random() * cachedQuoteFiles.length)];
    const movieName = randomFile.replace(/\.[^.]+$/, ''); // Remove file extension
    
    res.json({
      filename: randomFile,
      movieName: movieName,
      url: `/quotes/${encodeURIComponent(randomFile)}`
    });
  } catch (error) {
    console.error('Error fetching random quote image:', error);
    res.status(500).json({ error: 'Failed to fetch random quote image' });
  }
});

/* ============================================================
   START SERVER
   ============================================================ */
app.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  let localIP = 'localhost';
  
  for (const name of Object.keys(networkInterfaces)) {
    for (const iface of networkInterfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIP = iface.address;
        break;
      }
    }
  }
  
  console.log(`🎬 ThePortal server running at http://localhost:${PORT}`);
  console.log(`🌐 Also accessible at http://${localIP}:${PORT}`);
  console.log(`📍 Serving static files from ${__dirname}`);
  console.log(`🔑 TMDb API Key loaded from .env`);
  console.log(`\n✅ Server ready! Visit http://localhost:${PORT} in your browser.\n`);
});
