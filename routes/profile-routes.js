const router = require('express').Router();

// --- Placeholder Routes for the server to load ---
const authCheck = (req, res, next) => {
    if (!req.user) {
        res.redirect('/auth/login');
    } else {
        next();
    }
};

router.get('/', authCheck, (req, res) => {
    // This route will render the protected dashboard
    res.send('Welcome to your profile! (Needs dashboard.ejs view)');
});

module.exports = router;
