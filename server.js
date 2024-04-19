const express = require('express');
const { MongoClient } = require('mongodb');
const natural = require('natural');
const lda = require('lda');

// Simulated static data for reviews with location (replace this with your data source)
const staticReviews = [
  { id: 1, location: "Restaurant A", reviewText: "Great experience! Friendly staff and excellent service." },
  { id: 2, location: "Restaurant B", reviewText: "Not satisfied with the quality. The product was damaged." },
  { id: 3, location: "Cafe X", reviewText: "Highly recommended. Will definitely visit again." }
];

// Initialize Express app
const app = express();
const PORT = 5000;

// Middleware to parse JSON bodies
app.use(express.json());

// Function to perform sentiment analysis on review text focusing on specific topics
function analyzeSentimentByTopics(reviewText, topicKeywords) {
  const tokenizer = new natural.WordTokenizer();
  const analyzer = new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn');
  const tokens = tokenizer.tokenize(reviewText);

  // Calculate sentiment score based on specific topic combinations
  let totalSentiment = 0;
  let totalWeight = 0;

  // Iterate through the topic combinations
  for (const topic of topicKeywords) {
    const topicTerms = topic.split(', ').map(term => term.trim().toLowerCase());
    const matchingTokens = tokens.filter(token => topicTerms.includes(token.toLowerCase()));
    
    if (matchingTokens.length > 0) {
      const sentiment = analyzer.getSentiment(matchingTokens);
      totalSentiment += sentiment * topicTerms.length; // Weight sentiment by the number of terms in the topic
      totalWeight += topicTerms.length;
    }
  }

  // Calculate average sentiment score across all relevant topics
  const averageSentiment = totalWeight > 0 ? totalSentiment / totalWeight : 0;
  return averageSentiment;
}

// Function to extract topics from review texts using LDA
function extractTopics(reviewTexts) {
  try {
    // Filter out invalid or empty review texts
    const filteredTexts = reviewTexts.filter(text => typeof text === 'string' && text.trim() !== '');

    if (filteredTexts.length === 0) {
      throw new Error('No valid review texts available for topic extraction');
    }

    // Prepare documents array for LDA input
    const documents = filteredTexts.map(text => text.toLowerCase()); // Convert text to lowercase

    // Extract topics using LDA
    const result = lda(documents, 2, 3); // 2 topics, 3 terms per topic

    const topics = result.map(topic => ({
      terms: topic.map(term => term.term),
      probability: topic.reduce((acc, term) => acc + term.probability, 0) / topic.length
    }));

    return topics;
  } catch (error) {
    console.error('Error extracting topics:', error);
    return []; // Return empty array or handle the error appropriately
  }
}

// API endpoint to process reviews for a specific location and analyze sentiment by topics
app.get('/location-reviews/:location', async (req, res) => {
  const { location } = req.params;

  try {
    const reviews = staticReviews.filter(review => review.location === location);

    if (!reviews || reviews.length === 0) {
      return res.status(404).json({ message: 'Location reviews not found' });
    }

    // Extract topics from review texts
    const reviewTexts = reviews.map(review => review.reviewText);
    const topics = extractTopics(reviewTexts);

    // Analyze sentiment focusing on specific topic combinations extracted from the review texts
    const sentimentByTopics = topics.map(topic => {
      const sentiment = analyzeSentimentByTopics(reviewTexts.join(' '), [topic.terms.join(', ')]);
      return {
        topic: topic.terms.join(', '),
        sentiment
      };
    });

    res.json({ location, sentimentByTopics, topics });
  } catch (error) {
    console.error('Error processing location reviews:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
