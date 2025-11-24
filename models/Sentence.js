// models/Sentence.js
const mongoose = require('mongoose');

const sentenceSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    maxlength: 500 // Added max length for safety
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['thoughts', 'quotes', 'stories', 'jokes', 'questions', 'facts', 'other'],
    default: 'other' // Changed default from 'thoughts' to 'other' (minor fix)
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Sentence', sentenceSchema);
