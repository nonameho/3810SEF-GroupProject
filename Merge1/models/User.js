const mongoose = require('mongoose');

// Define the User Schema
const userSchema = new mongoose.Schema({
    // Local Authentication Fields
    username: { 
        type: String, 
        required: false, 
    },
    email: { 
        type: String, 
        required: false,
        lowercase: true,
    },
    password: { 
        type: String, 
        required: false 
    },

    // OAuth Fields
    googleId: { 
        type: String, 
        required: false,
    },
    
    // Profile Information
    thumbnail: {
        type: String,
        default: 'https://ui-avatars.com/api/?name=User' // Fallback to a generic placeholder
    },
    
    // Timestamp
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Create the model
const User = mongoose.model('user', userSchema);

module.exports = User;
