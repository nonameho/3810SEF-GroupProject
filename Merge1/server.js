// 1. Configure dotenv to load environment variables immediately
require('dotenv').config(); 

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const flash = require('connect-flash');

// --- Import Routes and Models ---
const authRoutes = require('./routes/auth-routes');
const profileRoutes = require('./routes/profile-routes');
// NEW: Import the Sentence Model directly (You MUST have models/Sentence.js)
const Sentence = require('./models/Sentence'); 

// Import the passport setup file to run the configuration
const passportSetup = require('./passport'); 

const app = express();

// --- CRITICAL: BODY PARSING AND STATIC MIDDLEWARE ---
// Handles form data and JSON data
app.use(express.urlencoded({ extended: true })); 
app.use(express.json()); 
// Serves static files (like public/script.js) from the 'public' directory
app.use(express.static('public'));
// ------------------------------------------

// Set up view engine
app.set('view engine', 'ejs');

// Print JSON responses in a more readable format
app.set('json spaces', 2);

// 2. Set up session and flash messages
app.use(session({
    secret: process.env.COOKIE_KEY, 
    resave: false, 
    saveUninitialized: false, 
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, 
    }
}));

app.use(flash());
// 3. Initialize passport
app.use(passport.initialize());
app.use(passport.session());

// 4. Connect to MongoDB 
const mongoURI = process.env.MONGO_URI;

mongoose.connect(mongoURI)
    .then(() => {
        console.log('Connected to MongoDB Atlas.');
    })
    .catch(err => {
        console.error('DB Error: MongooseError: Could not connect to MongoDB Atlas.');
        console.error('Error details:', err.message);
    });

// --- API AUTHENTICATION MIDDLEWARE ---
// Used to protect the CRUD API endpoints (Create/Delete).
const isAuthenticatedApi = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    // For API calls, respond with 401 Unauthorized instead of redirecting
    res.status(401).json({ error: 'Unauthorized: You must be logged in to modify data.' });
};


// 5. Set up all routes

// A. AUTHENTICATION AND PROFILE ROUTES
app.use('/auth', authRoutes);
app.use('/profile', profileRoutes); 

// B. BASE AND REDIRECT ROUTES
app.get('/', (req, res) => {
    res.status(200).send('Server is running');
    
    if (req.user) {
        res.redirect('/dashboard'); 
    } else {
        res.redirect('/auth/login');
    }
});

app.get('/dashboard', (req, res) => {
    res.redirect('/auth/dashboard');
});


// ------------------------------------------------------------------
// C. CONSOLIDATED CRUD API ROUTES (Moved from crud-routes.js)
// ------------------------------------------------------------------
// testing
app.post('/auth/test-login', (req, res) => {
    req.login({ 
        id: '507f1f77bcf86cd799439011', 
        username: 'Tester01',
        email: 'test@test.com' 
    }, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Login failed' });
        }
        res.json({ 
            message: 'Logged in successfully',
            user: req.user 
        });
    });
});

// --- CRUD: READ & Search (GET /api/sentences) ---
app.get('/api/sentences', async (req, res) => {
    try {
        const { category, user, sortBy, search } = req.query;
        let filter = {};
        
        // 1. Apply filters
        if (category && category !== 'all') { filter.category = category; }
        if (user && user !== 'all') { filter.name = user; }

        // 2. Search (Bonus: Case-insensitive search on message content OR author name)
        if (search && search.trim() !== '') {
            filter.$or = [
                { text: { $regex: search, $options: 'i' } }, 
                { name: { $regex: search, $options: 'i' } }  
            ];
        }

        // 3. Sort
        let sort = { createdAt: -1 }; // newest first
        if (sortBy === 'oldest') {
            sort = { createdAt: 1 };
        } else if (sortBy === 'name') {
            sort = { name: 1, createdAt: -1 }; 
        }

        const sentences = await Sentence.find(filter).sort(sort);
        res.json(sentences);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});


// --- CRUD: CREATE (POST /api/sentences) ---
// Protected
app.post('/api/sentences', isAuthenticatedApi, async (req, res) => {
    try {
        const { text, category } = req.body;
        // CRITICAL SECURITY: Get the author's name from the *authenticated user session*
        const name = req.user.username; 
        
        if (!text || text.trim() === '') {
            return res.status(400).json({ error: 'Message cannot be empty' });
        }
        
        const sentence = new Sentence({ 
            text: text.trim(), 
            name: name.trim(),
            category: category
        });
        await sentence.save();
        
        res.status(201).json(sentence);
    } catch (error) {
        res.status(500).json({ error: 'Failed to save message' });
    }
});

// --- CRUD: DELETE (DELETE /api/sentences/:id) ---
// Protected
app.delete('/api/sentences/:id', isAuthenticatedApi, async (req, res) => {
    try {
        const { id } = req.params;
        const sentence = await Sentence.findById(id);

        if (!sentence) {
            return res.status(404).json({ error: 'Message not found' });
        }
        
        // Check if the current user is the owner (Originality Bonus)
        if (sentence.name !== req.user.username) {
            return res.status(403).json({ error: 'Forbidden: You can only delete your own messages.' });
        }

        await Sentence.findByIdAndDelete(id);
        res.json({ message: 'Message deleted successfully' });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid message ID format.' });
        }
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

// --- CRUD: UPDATE (PUT /api/sentences/:id) ---
// Protected
app.put('/api/sentences/:id', isAuthenticatedApi, async (req, res) => {
  try {
    const { id } = req.params;
    const { text, category } = req.body;

    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const sentence = await Sentence.findById(id);

    if (!sentence) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if the current user is the owner
    if (sentence.name !== req.user.username) {
      return res.status(403).json({ error: 'Forbidden: You can only edit your own messages.' });
    }

    sentence.text = text.trim();
    if (category) sentence.category = category;
    await sentence.save();

    res.json({ message: 'Message updated successfully', sentence });

  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid message ID format.' });
    }
    res.status(500).json({ error: 'Failed to update message', details: error.message });
  }
});

// --- Helper: Get available users (For filter dropdown) ---
app.get('/api/sentences/users', async (req, res) => {
    try {
        const users = await Sentence.distinct('name');
        res.json(users.sort());
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// --- Get available users'sentences ---
app.get('/api/sentences/users/:name', async (req, res) => {
    try {
        const user = req.params.name;
        const sentences = await Sentence.find({ name: user });

        if (sentences.length == 0) {
            return res.status(404).json({ error: `User not found: ${user}` });
        }

        return res.status(200).json(sentences);

    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

const PORT = process.env.PORT || 8099;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
