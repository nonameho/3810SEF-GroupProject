const router = require('express').Router();
const passport = require('passport');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// --- Helper Middleware ---

// Middleware to check if the user is authenticated (logged in)
const isAuthenticated = (req, res, next) => {
    // Passport adds 'isAuthenticated' to the request object
    if (req.isAuthenticated()) {
        return next();
    }
    // If not authenticated, redirect to the login page with an error
    req.flash('error', 'You must be logged in to view the dashboard.');
    res.redirect('/auth/login');
};

// --- Register Route ---

// GET /auth/register: Renders the registration form
router.get('/register', (req, res) => {
    // Pass error message from query (or flash if you switch to that)
    res.render('register', { errorMessage: req.query.error, user: req.user });
});

// POST /auth/register: Handles the form submission and user creation
router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    // Basic validation
    if (!username || !email || !password) {
        return res.redirect('/auth/register?error=' + encodeURIComponent('All fields are required.'));
    }1

    try {
        // 1. Check if username already exists (case-insensitive)
        const existingUsernameUser = await User.findOne({ 
            username: new RegExp(`^${username}$`, 'i') 
        });

        if (existingUsernameUser) {
            return res.redirect('/auth/register?error=' + encodeURIComponent(`The username "${username}" is already taken.`));
        }

        // 2. Check if email already exists (case-insensitive)
        const existingEmailUser = await User.findOne({ 
            email: email.toLowerCase() 
        });

        if (existingEmailUser) {
            return res.redirect('/auth/register?error=' + encodeURIComponent(`The email address "${email}" is already registered.`));
        }


        // 3. Hash the password securely (This is where the single hash MUST happen)
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 4. Create new user with local credentials
        const newUser = new User({
            username: username,
            email: email.toLowerCase(),
            password: hashedPassword,
            // Generate a default thumbnail
            thumbnail: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=38bdf8&color=0f172a&bold=true`
        });

        await newUser.save();
        
        // Success flash message
        req.flash('successMessage', 'Registration successful! You can now log in.');
        
        res.redirect('/auth/login');
        
    } catch (err) {
        console.error('Registration error:', err);
        res.redirect('/auth/register?error=' + encodeURIComponent('An unexpected error occurred during registration.'));
    }
});


// --- Local Login Route ---

// GET /auth/login: Renders the login form
router.get('/login', (req, res) => {
    // Get flash messages for errors (from passport failure) and success (from register success)
    const errorMessage = req.query.error || req.flash('error')[0];
    const successMessage = req.flash('successMessage')[0];

    res.render('login', { 
        errorMessage: errorMessage, 
        successMessage: successMessage,
        user: req.user 
    });
});

// POST /auth/login: Authenticates user using the 'local-login' strategy
router.post('/login', passport.authenticate('local-login', {
    // Redirect back to login with a flash error if failure occurs
    failureRedirect: '/auth/login',
    // Enable flash messages (used by passport-local internally)
    failureFlash: true,
    successRedirect: '/auth/dashboard',
}));


// --- Google OAuth Routes ---

// GET /auth/google: Initiates the Google authentication flow
router.get('/google', passport.authenticate('google', { 
    // Request permission to access profile info and email address
    scope: ['profile', 'email'] 
}));

// GET /auth/google/redirect: Google callback URI
router.get('/google/redirect', passport.authenticate('google', { 
    // Redirect to login on failure
    failureRedirect: '/auth/login?error=' + encodeURIComponent('Google login failed.') 
}), (req, res) => { 
    res.redirect('/dashboard'); 
});


// --- Dashboard/Protected Route (The destination after successful login) ---

router.get('/dashboard', isAuthenticated, (req, res) => {
    // req.user is automatically populated by Passport since the user is authenticated
    res.render('dashboard', { user: req.user });
});


// --- Logout Route ---

// GET /auth/logout: Logs the user out and clears the session cookie
router.get('/logout', (req, res, next) => {
    // passport's req.logout requires a callback in newer versions
    req.logout((err) => {
        if (err) { return next(err); }
        // Redirect to the login page
        res.redirect('/auth/login');
    });
});

module.exports = router;
