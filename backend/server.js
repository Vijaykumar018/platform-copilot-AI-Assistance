import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));


const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const intents = {
  student: {
    name: "Student Assistant",
    dropdownOptions: [
      "Course Selection Advice",
      "Study Tips & Techniques",
      "Exam Preparation",
      "Career Guidance",
      "Scholarship Information",
      "Time Management"
    ],
    systemPrompt: "You are a professional student assistant. Provide practical, structured advice with specific details. Include relevant resource links when helpful (like study resources, scholarship websites, educational platforms)."
  },
  referrer: {
    name: "Referrer Assistant",
    dropdownOptions: [
      "Referral Program Details",
      "Commission Structure",
      "Marketing Materials",
      "Tracking Referrals",
      "Payment Process",
      "Best Practices"
    ],
    systemPrompt: "You are a professional referral program assistant. Provide structured, actionable guidance with specific details. Include links to referral program examples or tracking tools when relevant."
  },
  hr: {
    name: "HR Assistant",
    dropdownOptions: [
      "Recruitment Process",
      "Employee Onboarding",
      "Performance Reviews",
      "Leave Policy",
      "Training Programs",
      "Employee Relations"
    ],
    systemPrompt: "You are a professional HR assistant. Provide structured, compliant HR guidance with specific details. Include links to HR resources, policy templates, or legal guidelines when helpful."
  },
  college: {
    name: "College Administration",
    dropdownOptions: [
      "Admission Process",
      "Fee Structure",
      "Course Catalog",
      "Scholarship Programs",
      "Campus Facilities",
      "Placement Support"
    ],
    systemPrompt: "You are a professional college administrator. Provide structured, accurate information with specific details. Include links to official college websites, scholarship portals, or application forms when relevant."
  }
};

app.get('/api/intents', (req, res) => {
  const intentsList = Object.keys(intents).map(key => ({
    id: key,
    name: intents[key].name,
    options: intents[key].dropdownOptions
  }));
  res.json(intentsList);
});

// Generate follow-up questions
app.post('/api/followup', async (req, res) => {
  try {
    const { intent, category, lastQuestion, lastAnswer } = req.body;
    
    const prompt = `Based on this conversation:
User asked: "${lastQuestion}"
AI answered: "${lastAnswer}"

Generate 4 relevant follow-up questions that the user might want to ask next.
Return ONLY as a JSON array of strings.`;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "Return ONLY valid JSON arrays of questions." },
        { role: "user", content: prompt }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.9,
      max_tokens: 300,
    });
    
    let followupQuestions = [];
    try {
      let responseText = completion.choices[0]?.message?.content || '[]';
      responseText = responseText.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
      followupQuestions = JSON.parse(responseText);
      if (!Array.isArray(followupQuestions)) followupQuestions = [];
    } catch (e) {
      followupQuestions = [
        "Can you explain this in more detail?",
        "What are the key takeaways?",
        "Are there any best practices?",
        "Can you provide examples?"
      ];
    }
    
    res.json({ followup: followupQuestions.slice(0, 4) });
  } catch (error) {
    res.json({ 
      followup: [
        "Can you provide more details?",
        "What are the next steps?",
        "Any tips you can share?",
        "Can you explain with examples?"
      ]
    });
  }
});

app.get('/api/test', async (req, res) => {
  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: "Say 'API is working!'" }],
      model: "llama-3.1-8b-instant",
      max_tokens: 50,
    });
    res.json({ success: true, response: completion.choices[0]?.message?.content });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { intent, category, userQuestion, conversationHistory } = req.body;
    
    const intentConfig = intents[intent];
    if (!intentConfig) {
      return res.status(400).json({ error: 'Invalid intent' });
    }
    
    const structuredPrompt = `${intentConfig.systemPrompt} 

IMPORTANT: Your response will be rendered in a professional "Workspace" view.
Use Markdown extensively:
- Use # for the main title (e.g., # Student Study Plan)
- Use tables for structured data like Fees, Schedules, or Comparison lists.
- Use **Bold** for emphasis.
- Use lists for steps.
- Include HELPFUL LINKS.

Topic: ${category}`;
    
    const userMsg = userQuestion || `Please provide detailed information about ${category}. Include specific details and helpful links if available.`;
    
    const messages = [
      { role: "system", content: structuredPrompt },
      { role: "user", content: userMsg }
    ];
    
    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-8);
      messages.splice(1, 0, ...recentHistory);
    }
    
    const completion = await groq.chat.completions.create({
      messages: messages,
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
      max_tokens: 1000,
    });
    
    const aiResponse = completion.choices[0]?.message?.content;
    
    if (!aiResponse) {
      return res.status(500).json({ error: 'Empty response from AI' });
    }
    
    res.json({ response: aiResponse });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Failed to get response from AI',
      details: error.message
    });
  }
});

// Serve the frontend index.html for any other routes (Vercel Fix)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
}

export default app;