const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateQuiz(topic, difficulty = 'medium', numQuestions = 3) {
  try {
    const prompt = `Generate ${numQuestions} multiple-choice quiz questions about "${topic}".
    Difficulty level: ${difficulty}.
    Each question should have 4 options (A, B, C, D).
    
    Return a JSON array with this exact format:
    [
      {
        "question": "The question text here",
        "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
        "correctIndex": 0
      }
    ]
    
    The correctIndex should be 0, 1, 2, or 3 corresponding to the correct option.
    Make the questions engaging and the options challenging.`;
    
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a quiz master. Generate fun, engaging quiz questions."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });
    
    const content = response.choices[0].message.content;
    
    // Clean the response (sometimes OpenAI adds extra text)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // Fallback to default questions if parsing fails
    console.warn('Failed to parse OpenAI response, using fallback questions');
    return getFallbackQuestions(topic, numQuestions);
    
  } catch (error) {
    console.error('OpenAI API error:', error);
    return getFallbackQuestions(topic, numQuestions);
  }
}

function getFallbackQuestions(topic, numQuestions) {
  const fallbackQuestions = [
    {
      question: `What is the most interesting fact about ${topic}?`,
      options: [
        "It was discovered recently",
        "It has unique properties",
        "It's found everywhere",
        "It's very rare"
      ],
      correctIndex: 1
    },
    {
      question: `How does ${topic} typically work?`,
      options: [
        "Through complex processes",
        "By following simple rules",
        "Using advanced technology",
        "With human intervention"
      ],
      correctIndex: 0
    },
    {
      question: `Why is ${topic} important?`,
      options: [
        "It's not important",
        "It revolutionizes industries",
        "It's just interesting",
        "It helps in daily life"
      ],
      correctIndex: 3
    }
  ];
  
  return fallbackQuestions.slice(0, numQuestions);
}

module.exports = { generateQuiz };