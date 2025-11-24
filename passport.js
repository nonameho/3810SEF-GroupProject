const passport = require('passport');
const LocalStrategy = require('passport-local');
const GoogleStrategy = require('passport-google-oauth20');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

// --- 1. Serialization/Deserialization ---
// Used to store user ID in the cookie
passport.serializeUser((user, done) => {
    // We only serialize the user's MongoDB ID
    done(null, user.id);
});

// Used to retrieve the user object from the database using the ID in the cookie
passport.deserializeUser((id, done) => {
    User.findById(id).then((user) => {
        done(null, user);
    });
});

// --- 2. Local Strategy (Login) ---
passport.use('local-login', new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password',
}, (username, password, done) => {
    
    // FIX: Search for the user using EITHER the username OR the email address
    User.findOne({ 
        $or: [
            // Check if the input matches the stored username (case-insensitive search is best practice)
            { username: new RegExp(`^${username}$`, 'i') }, 
            // Check if the input matches the stored email
            { email: username.toLowerCase() }
        ]
    }).then(async (user) => {
        if (!user) {
            // User not found (incorrect username/email)
            return done(null, false, { message: 'Incorrect username or password.' });
        }

        // Check if the account was registered locally (i.e., has a password)
        if (!user.password) {
             return done(null, false, { message: 'This account was created via OAuth (Google) and cannot be logged into with a password.' });
        }

        // Compare the provided password with the hashed password in the database
        const match = await bcrypt.compare(password, user.password);
        if (match) {
            // Successful login
            return done(null, user);
        } else {
            // Password mismatch
            return done(null, false, { message: 'Incorrect username or password.' });
        }
    }).catch(err => {
        // Handle database errors
        return done(err);
    });
}));


// --- 3. Google Strategy (OAuth) ---
passport.use(
    new GoogleStrategy({
        // Options for the Google strategy
        callbackURL: '/auth/google/redirect',
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        proxy: true // CRITICAL for cloud deployments
    }, (accessToken, refreshToken, profile, done) => {
        // Check if user already exists in our database
        User.findOne({ googleId: profile.id }).then((currentUser) => {
            if (currentUser) {
                // Already have this user, log them in
                done(null, currentUser);
            } else {
                // If not, create new user
                new User({
                    googleId: profile.id,
                    username: profile.displayName,
                    email: profile.emails ? profile.emails[0].value : null, // Get email if available
                    thumbnail: profile.photos[0].value
                }).save().then((newUser) => {
                    done(null, newUser);
                });
            }
        });
    })
);

// Note: Facebook Strategy removed per user request
